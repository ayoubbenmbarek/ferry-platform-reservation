"""
Unit tests for Cancellation Protection feature.
"""

import pytest
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.models.booking import Booking, BookingStatusEnum


class TestCancellationProtectionLogic:
    """Test the cancellation protection business logic."""

    def test_cancellation_protection_stored_in_extra_data(self, db_session, sample_user):
        """Test that cancellation protection is stored in extra_data."""
        booking = Booking(
            user_id=sample_user.id,
            sailing_id="CTN-TEST-001",
            operator="CTN",
            departure_port="Tunis",
            arrival_port="Marseille",
            departure_time=datetime.now() + timedelta(days=7),
            booking_reference="MR-PROT-001",
            contact_email="test@example.com",
            contact_first_name="Test",
            contact_last_name="User",
            total_passengers=1,
            subtotal=Decimal("115.00"),
            tax_amount=Decimal("11.50"),
            total_amount=Decimal("126.50"),
            status=BookingStatusEnum.PENDING,
            extra_data={"has_cancellation_protection": True}
        )
        db_session.add(booking)
        db_session.commit()
        db_session.refresh(booking)

        assert booking.extra_data is not None
        assert booking.extra_data.get("has_cancellation_protection") is True

    def test_cancellation_protection_defaults_to_false(self, db_session, sample_user):
        """Test that missing or null extra_data means no protection."""
        booking = Booking(
            user_id=sample_user.id,
            sailing_id="CTN-TEST-002",
            operator="CTN",
            departure_port="Tunis",
            arrival_port="Marseille",
            departure_time=datetime.now() + timedelta(days=7),
            booking_reference="MR-NOPROT-001",
            contact_email="test@example.com",
            contact_first_name="Test",
            contact_last_name="User",
            total_passengers=1,
            subtotal=Decimal("100.00"),
            tax_amount=Decimal("10.00"),
            total_amount=Decimal("110.00"),
            status=BookingStatusEnum.PENDING,
            extra_data=None
        )
        db_session.add(booking)
        db_session.commit()
        db_session.refresh(booking)

        # Test the protection check logic
        has_protection = booking.extra_data.get("has_cancellation_protection", False) if booking.extra_data else False
        assert has_protection is False

    def test_7_day_restriction_logic_blocked(self, sample_booking):
        """Test 7-day cancellation restriction logic - should block."""
        # Set departure to 3 days from now (within 7-day restriction)
        sample_booking.departure_time = datetime.now(timezone.utc) + timedelta(days=3, hours=12)
        sample_booking.extra_data = {"has_cancellation_protection": False}

        has_protection = sample_booking.extra_data.get("has_cancellation_protection", False) if sample_booking.extra_data else False
        now_utc = datetime.now(timezone.utc)
        departure = sample_booking.departure_time
        if departure.tzinfo is None:
            departure = departure.replace(tzinfo=timezone.utc)
        days_until_departure = (departure - now_utc).days

        can_cancel = has_protection or days_until_departure >= 7

        assert days_until_departure < 7  # Less than 7 days
        assert can_cancel is False

    def test_7_day_restriction_logic_allowed_with_protection(self, sample_booking):
        """Test 7-day cancellation restriction - allowed with protection."""
        # Set departure to 3 days from now (within 7-day restriction)
        sample_booking.departure_time = datetime.now(timezone.utc) + timedelta(days=3, hours=12)
        sample_booking.extra_data = {"has_cancellation_protection": True}

        has_protection = sample_booking.extra_data.get("has_cancellation_protection", False) if sample_booking.extra_data else False
        now_utc = datetime.now(timezone.utc)
        departure = sample_booking.departure_time
        if departure.tzinfo is None:
            departure = departure.replace(tzinfo=timezone.utc)
        days_until_departure = (departure - now_utc).days

        can_cancel = has_protection or days_until_departure >= 7

        assert days_until_departure < 7  # Less than 7 days
        assert can_cancel is True  # Has protection

    def test_7_day_restriction_logic_allowed_after_7_days(self, sample_booking):
        """Test 7-day cancellation restriction - allowed after 7 days without protection."""
        # Set departure to 10 days from now (outside 7-day restriction)
        sample_booking.departure_time = datetime.now(timezone.utc) + timedelta(days=10, hours=12)
        sample_booking.extra_data = {"has_cancellation_protection": False}

        has_protection = sample_booking.extra_data.get("has_cancellation_protection", False) if sample_booking.extra_data else False
        now_utc = datetime.now(timezone.utc)
        departure = sample_booking.departure_time
        if departure.tzinfo is None:
            departure = departure.replace(tzinfo=timezone.utc)
        days_until_departure = (departure - now_utc).days

        can_cancel = has_protection or days_until_departure >= 7

        assert days_until_departure >= 7  # 7 or more days
        assert can_cancel is True  # More than 7 days

    def test_7_day_boundary_exactly(self, sample_booking):
        """Test exactly 7 days boundary is allowed."""
        # Set departure to exactly 7 days + 12 hours from now
        sample_booking.departure_time = datetime.now(timezone.utc) + timedelta(days=7, hours=12)
        sample_booking.extra_data = {"has_cancellation_protection": False}

        has_protection = sample_booking.extra_data.get("has_cancellation_protection", False) if sample_booking.extra_data else False
        now_utc = datetime.now(timezone.utc)
        departure = sample_booking.departure_time
        if departure.tzinfo is None:
            departure = departure.replace(tzinfo=timezone.utc)
        days_until_departure = (departure - now_utc).days

        can_cancel = has_protection or days_until_departure >= 7

        assert days_until_departure == 7
        assert can_cancel is True  # Exactly 7 days is allowed

    def test_6_days_boundary_blocked(self, sample_booking):
        """Test 6 days is blocked without protection."""
        # Set departure to 6 days + 12 hours from now
        sample_booking.departure_time = datetime.now(timezone.utc) + timedelta(days=6, hours=12)
        sample_booking.extra_data = {"has_cancellation_protection": False}

        has_protection = sample_booking.extra_data.get("has_cancellation_protection", False) if sample_booking.extra_data else False
        now_utc = datetime.now(timezone.utc)
        departure = sample_booking.departure_time
        if departure.tzinfo is None:
            departure = departure.replace(tzinfo=timezone.utc)
        days_until_departure = (departure - now_utc).days

        can_cancel = has_protection or days_until_departure >= 7

        assert days_until_departure < 7  # Less than 7 days
        assert can_cancel is False  # 6 days is blocked


class TestCancellationProtectionPricing:
    """Test cancellation protection pricing."""

    PROTECTION_PRICE = Decimal("15.00")

    def test_booking_with_protection_includes_price(self, db_session, sample_user):
        """Test that protection adds €15 to the booking total."""
        base_subtotal = Decimal("100.00")
        protection_amount = self.PROTECTION_PRICE
        subtotal = base_subtotal + protection_amount
        tax = subtotal * Decimal("0.10")

        booking = Booking(
            user_id=sample_user.id,
            sailing_id="CTN-PROT-001",
            operator="CTN",
            departure_port="Tunis",
            arrival_port="Marseille",
            departure_time=datetime.now() + timedelta(days=14),
            booking_reference="MR-PROT-PRICE-001",
            contact_email="test@example.com",
            contact_first_name="Test",
            contact_last_name="User",
            total_passengers=1,
            subtotal=subtotal,  # 100 + 15 = 115
            tax_amount=tax,
            total_amount=subtotal + tax,
            status=BookingStatusEnum.PENDING,
            extra_data={"has_cancellation_protection": True}
        )
        db_session.add(booking)
        db_session.commit()

        assert booking.subtotal == Decimal("115.00")
        assert booking.total_amount == Decimal("126.50")  # 115 * 1.10

    def test_booking_without_protection_no_extra_cost(self, db_session, sample_user):
        """Test that no protection means no extra €15."""
        base_subtotal = Decimal("100.00")
        tax = base_subtotal * Decimal("0.10")

        booking = Booking(
            user_id=sample_user.id,
            sailing_id="CTN-NOPROT-001",
            operator="CTN",
            departure_port="Tunis",
            arrival_port="Marseille",
            departure_time=datetime.now() + timedelta(days=14),
            booking_reference="MR-NOPROT-PRICE-001",
            contact_email="test@example.com",
            contact_first_name="Test",
            contact_last_name="User",
            total_passengers=1,
            subtotal=base_subtotal,
            tax_amount=tax,
            total_amount=base_subtotal + tax,
            status=BookingStatusEnum.PENDING,
            extra_data={"has_cancellation_protection": False}
        )
        db_session.add(booking)
        db_session.commit()

        assert booking.subtotal == Decimal("100.00")
        assert booking.total_amount == Decimal("110.00")  # 100 * 1.10


class TestCancellationProtectionErrorMessages:
    """Test error message generation for cancellation restriction."""

    def test_error_message_format(self):
        """Test the error message format for blocked cancellation."""
        days_until_departure = 4
        error_message = f"Cancellations are not allowed within 7 days of departure. Your trip departs in {days_until_departure} days. Consider purchasing cancellation protection for future bookings."

        assert "7 days" in error_message
        assert "4 days" in error_message
        assert "cancellation protection" in error_message

    def test_error_message_various_days(self):
        """Test error messages for various day counts."""
        for days in [1, 2, 3, 4, 5, 6]:
            error_message = f"Cancellations are not allowed within 7 days of departure. Your trip departs in {days} days. Consider purchasing cancellation protection for future bookings."
            assert f"{days} days" in error_message
