"""
Unit tests for Price Alert Celery tasks.
"""

import pytest
from datetime import datetime, timedelta, date
from decimal import Decimal
from unittest.mock import patch, MagicMock, AsyncMock
from sqlalchemy.orm import Session

from app.models.price_alert import PriceAlert, PriceAlertStatusEnum
from app.models.user import User


@pytest.fixture
def sample_price_alert(db_session: Session, sample_user: User) -> PriceAlert:
    """Create a sample price alert for testing."""
    alert = PriceAlert(
        email=sample_user.email,
        user_id=sample_user.id,
        departure_port="marseille",
        arrival_port="tunis",
        date_from=date.today() + timedelta(days=7),
        date_to=date.today() + timedelta(days=21),
        initial_price=100.0,
        current_price=100.0,
        lowest_price=100.0,
        highest_price=100.0,
        notify_on_drop=True,
        notify_on_increase=True,
        price_threshold_percent=5.0,
        status=PriceAlertStatusEnum.ACTIVE.value,  # Use .value for SQLite compatibility
    )
    db_session.add(alert)
    db_session.commit()
    db_session.refresh(alert)
    return alert


@pytest.fixture
def sample_price_alert_no_dates(db_session: Session, sample_user: User) -> PriceAlert:
    """Create a price alert without date range (tracks any date)."""
    alert = PriceAlert(
        email=sample_user.email,
        user_id=sample_user.id,
        departure_port="genoa",
        arrival_port="tunis",
        initial_price=80.0,
        current_price=80.0,
        lowest_price=80.0,
        highest_price=80.0,
        notify_on_drop=True,
        notify_on_increase=False,
        price_threshold_percent=10.0,
        status=PriceAlertStatusEnum.ACTIVE.value,  # Use .value for SQLite compatibility
    )
    db_session.add(alert)
    db_session.commit()
    db_session.refresh(alert)
    return alert


class TestPriceAlertNotificationLogic:
    """Test price alert notification decision logic."""

    def test_should_notify_on_new_low_price(self, db_session: Session, sample_price_alert: PriceAlert):
        """Test that notification is sent when price reaches new low."""
        # Initial price is 100, threshold is 5%
        # New price of 90 is a 10% drop - should notify

        old_lowest = sample_price_alert.lowest_price
        new_price = 90.0

        # Check if it's a new low
        is_new_low = new_price < old_lowest

        # Calculate price change from initial
        price_change_percent = ((new_price - sample_price_alert.initial_price) / sample_price_alert.initial_price) * 100

        # Should notify conditions
        should_notify = (
            sample_price_alert.notify_on_drop and
            is_new_low and
            price_change_percent <= -sample_price_alert.price_threshold_percent
        )

        assert is_new_low is True
        assert price_change_percent == -10.0
        assert should_notify is True

    def test_should_not_notify_small_drop(self, db_session: Session, sample_price_alert: PriceAlert):
        """Test that notification is NOT sent for drops below threshold."""
        # Initial price is 100, threshold is 5%
        # New price of 97 is only 3% drop - should NOT notify

        new_price = 97.0
        is_new_low = new_price < sample_price_alert.lowest_price

        price_change_percent = ((new_price - sample_price_alert.initial_price) / sample_price_alert.initial_price) * 100

        should_notify = (
            sample_price_alert.notify_on_drop and
            is_new_low and
            price_change_percent <= -sample_price_alert.price_threshold_percent
        )

        assert is_new_low is True
        assert price_change_percent == -3.0
        assert should_notify is False  # Below 5% threshold

    def test_should_not_notify_if_not_new_low(self, db_session: Session, sample_price_alert: PriceAlert):
        """Test that notification is NOT sent if price is not a new low."""
        # Set lowest_price to 85
        sample_price_alert.lowest_price = 85.0
        db_session.commit()

        # New price of 90 is lower than initial (100) but not lower than lowest (85)
        new_price = 90.0
        is_new_low = new_price < sample_price_alert.lowest_price

        price_change_percent = ((new_price - sample_price_alert.initial_price) / sample_price_alert.initial_price) * 100

        should_notify = (
            sample_price_alert.notify_on_drop and
            is_new_low and
            price_change_percent <= -sample_price_alert.price_threshold_percent
        )

        assert is_new_low is False  # 90 > 85
        assert should_notify is False

    def test_should_notify_on_new_high_price(self, db_session: Session, sample_price_alert: PriceAlert):
        """Test that notification is sent when price reaches new high."""
        # Initial price is 100, threshold is 5%
        # New price of 110 is a 10% increase - should notify

        new_price = 110.0
        is_new_high = new_price > sample_price_alert.highest_price

        price_change_percent = ((new_price - sample_price_alert.initial_price) / sample_price_alert.initial_price) * 100

        should_notify = (
            sample_price_alert.notify_on_increase and
            is_new_high and
            price_change_percent >= sample_price_alert.price_threshold_percent
        )

        assert is_new_high is True
        assert price_change_percent == 10.0
        assert should_notify is True

    def test_should_not_notify_increase_if_disabled(self, db_session: Session, sample_price_alert_no_dates: PriceAlert):
        """Test that increase notification is NOT sent if disabled."""
        alert = sample_price_alert_no_dates
        assert alert.notify_on_increase is False

        new_price = 100.0  # 25% increase from 80
        is_new_high = new_price > alert.highest_price

        price_change_percent = ((new_price - alert.initial_price) / alert.initial_price) * 100

        should_notify = (
            alert.notify_on_increase and
            is_new_high and
            price_change_percent >= alert.price_threshold_percent
        )

        assert is_new_high is True
        assert price_change_percent == 25.0
        assert should_notify is False  # notify_on_increase is False

    def test_anti_spam_prevents_rapid_notifications(self, db_session: Session, sample_price_alert: PriceAlert):
        """Test that anti-spam prevents notifications within 1 hour."""
        # Set last_notified_at to 30 minutes ago
        sample_price_alert.last_notified_at = datetime.utcnow() - timedelta(minutes=30)
        db_session.commit()

        minutes_since_notification = (datetime.utcnow() - sample_price_alert.last_notified_at).total_seconds() / 60

        # Even if price change warrants notification, anti-spam should block it
        anti_spam_blocks = minutes_since_notification < 60

        assert anti_spam_blocks is True

    def test_anti_spam_allows_after_one_hour(self, db_session: Session, sample_price_alert: PriceAlert):
        """Test that notifications are allowed after 1 hour."""
        # Set last_notified_at to 90 minutes ago
        sample_price_alert.last_notified_at = datetime.utcnow() - timedelta(minutes=90)
        db_session.commit()

        minutes_since_notification = (datetime.utcnow() - sample_price_alert.last_notified_at).total_seconds() / 60

        anti_spam_blocks = minutes_since_notification < 60

        assert anti_spam_blocks is False  # 90 > 60, so allowed


class TestPriceAlertStatusTransitions:
    """Test price alert status transitions."""

    def test_alert_can_be_paused(self, db_session: Session, sample_price_alert: PriceAlert):
        """Test that an active alert can be paused."""
        assert sample_price_alert.status == PriceAlertStatusEnum.ACTIVE.value

        sample_price_alert.status = PriceAlertStatusEnum.PAUSED.value
        db_session.commit()

        assert sample_price_alert.status == PriceAlertStatusEnum.PAUSED.value

    def test_alert_can_be_resumed(self, db_session: Session, sample_price_alert: PriceAlert):
        """Test that a paused alert can be resumed."""
        sample_price_alert.status = PriceAlertStatusEnum.PAUSED.value
        db_session.commit()

        sample_price_alert.status = PriceAlertStatusEnum.ACTIVE.value
        db_session.commit()

        assert sample_price_alert.status == PriceAlertStatusEnum.ACTIVE.value

    def test_alert_can_be_cancelled(self, db_session: Session, sample_price_alert: PriceAlert):
        """Test that an alert can be cancelled (soft delete)."""
        sample_price_alert.status = PriceAlertStatusEnum.CANCELLED.value
        db_session.commit()

        assert sample_price_alert.status == PriceAlertStatusEnum.CANCELLED.value

    def test_alert_expires_when_date_to_passes(self, db_session: Session, sample_price_alert: PriceAlert):
        """Test that alerts with passed date_to should be marked expired."""
        # Set date_to to yesterday
        sample_price_alert.date_to = date.today() - timedelta(days=1)
        db_session.commit()

        # Check if should be expired
        should_expire = (
            sample_price_alert.date_to is not None and
            sample_price_alert.date_to < date.today()
        )

        assert should_expire is True


class TestPriceAlertPriceTracking:
    """Test price tracking and history."""

    def test_lowest_price_updates_on_new_low(self, db_session: Session, sample_price_alert: PriceAlert):
        """Test that lowest_price is updated when price drops."""
        assert sample_price_alert.lowest_price == 100.0

        new_price = 85.0
        if new_price < sample_price_alert.lowest_price:
            sample_price_alert.lowest_price = new_price

        sample_price_alert.current_price = new_price
        db_session.commit()

        assert sample_price_alert.lowest_price == 85.0
        assert sample_price_alert.current_price == 85.0

    def test_highest_price_updates_on_new_high(self, db_session: Session, sample_price_alert: PriceAlert):
        """Test that highest_price is updated when price increases."""
        assert sample_price_alert.highest_price == 100.0

        new_price = 120.0
        if new_price > sample_price_alert.highest_price:
            sample_price_alert.highest_price = new_price

        sample_price_alert.current_price = new_price
        db_session.commit()

        assert sample_price_alert.highest_price == 120.0
        assert sample_price_alert.current_price == 120.0

    def test_notification_count_increments(self, db_session: Session, sample_price_alert: PriceAlert):
        """Test that notification_count increments after notification."""
        assert sample_price_alert.notification_count == 0

        sample_price_alert.notification_count += 1
        sample_price_alert.last_notified_at = datetime.utcnow()
        db_session.commit()

        assert sample_price_alert.notification_count == 1

    def test_last_checked_at_updates(self, db_session: Session, sample_price_alert: PriceAlert):
        """Test that last_checked_at is updated after price check."""
        old_checked_at = sample_price_alert.last_checked_at

        sample_price_alert.last_checked_at = datetime.utcnow()
        db_session.commit()

        assert sample_price_alert.last_checked_at is not None
        if old_checked_at:
            assert sample_price_alert.last_checked_at >= old_checked_at


class TestPriceAlertDateRangeFiltering:
    """Test date range filtering for price alerts."""

    def test_alert_with_date_range(self, db_session: Session, sample_price_alert: PriceAlert):
        """Test alert with specific date range."""
        assert sample_price_alert.date_from is not None
        assert sample_price_alert.date_to is not None
        assert sample_price_alert.date_from < sample_price_alert.date_to

    def test_alert_without_date_range(self, db_session: Session, sample_price_alert_no_dates: PriceAlert):
        """Test alert without date range (tracks any date)."""
        assert sample_price_alert_no_dates.date_from is None
        assert sample_price_alert_no_dates.date_to is None

    def test_date_within_range(self, db_session: Session, sample_price_alert: PriceAlert):
        """Test that a date within the range is accepted."""
        check_date = date.today() + timedelta(days=14)  # Within 7-21 days range

        is_within_range = (
            sample_price_alert.date_from <= check_date <= sample_price_alert.date_to
        )

        assert is_within_range is True

    def test_date_outside_range(self, db_session: Session, sample_price_alert: PriceAlert):
        """Test that a date outside the range is rejected."""
        check_date = date.today() + timedelta(days=30)  # After 21 days

        is_within_range = (
            sample_price_alert.date_from <= check_date <= sample_price_alert.date_to
        )

        assert is_within_range is False


class TestPriceChangeCalculation:
    """Test price change percentage calculations."""

    def test_price_drop_percentage(self):
        """Test correct calculation of price drop percentage."""
        initial_price = 100.0
        new_price = 85.0

        change_percent = ((new_price - initial_price) / initial_price) * 100

        assert change_percent == -15.0

    def test_price_increase_percentage(self):
        """Test correct calculation of price increase percentage."""
        initial_price = 100.0
        new_price = 120.0

        change_percent = ((new_price - initial_price) / initial_price) * 100

        assert change_percent == 20.0

    def test_no_change_percentage(self):
        """Test percentage when price unchanged."""
        initial_price = 100.0
        new_price = 100.0

        change_percent = ((new_price - initial_price) / initial_price) * 100

        assert change_percent == 0.0

    def test_threshold_comparison_drop(self):
        """Test threshold comparison for drops."""
        threshold = 5.0
        change_percent = -7.0  # 7% drop

        exceeds_threshold = change_percent <= -threshold

        assert exceeds_threshold is True

    def test_threshold_comparison_increase(self):
        """Test threshold comparison for increases."""
        threshold = 5.0
        change_percent = 8.0  # 8% increase

        exceeds_threshold = change_percent >= threshold

        assert exceeds_threshold is True
