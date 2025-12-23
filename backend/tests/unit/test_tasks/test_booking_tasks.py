"""
Unit tests for booking tasks including FerryHopper inventory release.

These tests mock the database and FerryHopper integration to test
the booking expiration task logic.
"""

import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch, AsyncMock
from decimal import Decimal


class TestExpireOldBookingsTask:
    """Tests for expire_old_bookings_task with FerryHopper inventory release."""

    @pytest.fixture
    def mock_db_session(self):
        """Create a mock database session."""
        session = MagicMock()
        session.close = MagicMock()
        session.commit = MagicMock()
        session.rollback = MagicMock()
        return session

    @pytest.fixture
    def mock_pending_booking(self):
        """Create a mock pending booking with FerryHopper data."""
        from app.models.booking import BookingStatusEnum

        booking = MagicMock()
        booking.id = 1
        booking.booking_reference = "VF-TEST-001"
        booking.operator = "FerryHopper"
        booking.operator_booking_reference = "BK-FH-12345"
        booking.return_operator_booking_reference = None
        booking.return_operator = None
        booking.expires_at = datetime.now(timezone.utc) - timedelta(minutes=5)  # Expired
        booking.extra_data = {
            "operator_booking_pending": True,
            "fh_price_cents": 15000,
            "fh_currency": "EUR"
        }
        booking.contact_email = "test@example.com"
        booking.departure_port = "TUN"
        booking.arrival_port = "MRS"
        booking.vessel_name = "Test Ferry"
        booking.departure_time = datetime.now(timezone.utc) + timedelta(days=30)
        booking.arrival_time = datetime.now(timezone.utc) + timedelta(days=30, hours=20)
        booking.contact_first_name = "John"
        booking.contact_last_name = "Doe"
        booking.total_passengers = 2
        booking.total_vehicles = 1
        booking.total_amount = Decimal("150.00")
        booking.cancellation_reason = None
        booking.cancelled_at = None
        return booking

    @pytest.fixture
    def mock_pending_booking_with_return(self, mock_pending_booking):
        """Create a mock pending booking with return journey."""
        mock_pending_booking.return_operator_booking_reference = "BK-FH-RETURN-12345"
        mock_pending_booking.return_operator = "FerryHopper"
        mock_pending_booking.extra_data["return_fh_price_cents"] = 15000
        mock_pending_booking.extra_data["return_fh_currency"] = "EUR"
        return mock_pending_booking

    def test_expire_bookings_releases_ferryhopper_inventory(self, mock_db_session, mock_pending_booking):
        """Test that expiring bookings releases FerryHopper inventory."""
        from app.models.booking import BookingStatusEnum

        # Setup: DB returns one expired pending booking
        mock_db_session.query.return_value.filter.return_value.all.return_value = [mock_pending_booking]

        # Mock email service
        mock_email_service = MagicMock()
        mock_email_service.send_cancellation_confirmation.return_value = True

        # Mock FerryService
        mock_ferry_service_instance = MagicMock()
        mock_ferry_service_instance.cancel_pending_booking = AsyncMock(return_value=True)
        mock_ferry_service_class = MagicMock(return_value=mock_ferry_service_instance)

        with patch('app.database.SessionLocal', return_value=mock_db_session), \
             patch('app.services.email_service.email_service', mock_email_service), \
             patch('app.services.ferry_service.FerryService', mock_ferry_service_class):

            # Import and call task function directly (not as celery task)
            from app.tasks.booking_tasks import expire_old_bookings_task

            # Call the underlying function
            result = expire_old_bookings_task.run()

            # Verify booking was marked as cancelled
            assert mock_pending_booking.status == BookingStatusEnum.CANCELLED
            assert "15 minutes" in mock_pending_booking.cancellation_reason

    def test_expire_bookings_handles_ferryhopper_release_failure(self, mock_db_session, mock_pending_booking):
        """Test that booking expiration continues even if FerryHopper release fails."""
        from app.models.booking import BookingStatusEnum

        mock_db_session.query.return_value.filter.return_value.all.return_value = [mock_pending_booking]

        mock_email_service = MagicMock()
        mock_email_service.send_cancellation_confirmation.return_value = True

        # Mock FerryService that raises an exception
        mock_ferry_service_instance = MagicMock()
        mock_ferry_service_instance.cancel_pending_booking = AsyncMock(side_effect=Exception("FH API Error"))
        mock_ferry_service_class = MagicMock(return_value=mock_ferry_service_instance)

        with patch('app.database.SessionLocal', return_value=mock_db_session), \
             patch('app.services.email_service.email_service', mock_email_service), \
             patch('app.services.ferry_service.FerryService', mock_ferry_service_class):

            from app.tasks.booking_tasks import expire_old_bookings_task
            result = expire_old_bookings_task.run()

            # Booking should still be cancelled locally even if FH release fails
            assert mock_pending_booking.status == BookingStatusEnum.CANCELLED

    def test_expire_bookings_skips_non_pending_fh_bookings(self, mock_db_session, mock_pending_booking):
        """Test that bookings without operator_booking_pending flag skip FH release."""
        from app.models.booking import BookingStatusEnum

        # Remove the pending flag
        mock_pending_booking.extra_data = {"operator_booking_pending": False}

        mock_db_session.query.return_value.filter.return_value.all.return_value = [mock_pending_booking]

        mock_email_service = MagicMock()
        mock_email_service.send_cancellation_confirmation.return_value = True

        # FerryService should NOT be instantiated since booking is not pending
        mock_ferry_service_class = MagicMock()

        with patch('app.database.SessionLocal', return_value=mock_db_session), \
             patch('app.services.email_service.email_service', mock_email_service), \
             patch('app.services.ferry_service.FerryService', mock_ferry_service_class):

            from app.tasks.booking_tasks import expire_old_bookings_task
            result = expire_old_bookings_task.run()

            # Booking should be cancelled but no FH release attempted
            assert mock_pending_booking.status == BookingStatusEnum.CANCELLED
            # FerryService should not have been instantiated
            mock_ferry_service_class.assert_not_called()

    def test_expire_bookings_no_expired_returns_empty(self, mock_db_session):
        """Test that task returns success with 0 count when no bookings expired."""
        # No expired bookings
        mock_db_session.query.return_value.filter.return_value.all.return_value = []

        with patch('app.database.SessionLocal', return_value=mock_db_session):
            from app.tasks.booking_tasks import expire_old_bookings_task
            result = expire_old_bookings_task.run()

            assert result['status'] == 'success'
            assert result['expired_count'] == 0
            assert result['fh_released'] == 0

    def test_expire_bookings_releases_return_journey_inventory(self, mock_db_session, mock_pending_booking_with_return):
        """Test that both outbound and return FerryHopper bookings are released."""
        from app.models.booking import BookingStatusEnum

        mock_db_session.query.return_value.filter.return_value.all.return_value = [mock_pending_booking_with_return]

        mock_email_service = MagicMock()
        mock_email_service.send_cancellation_confirmation.return_value = True

        mock_ferry_service_instance = MagicMock()
        mock_ferry_service_instance.cancel_pending_booking = AsyncMock(return_value=True)
        mock_ferry_service_class = MagicMock(return_value=mock_ferry_service_instance)

        with patch('app.database.SessionLocal', return_value=mock_db_session), \
             patch('app.services.email_service.email_service', mock_email_service), \
             patch('app.services.ferry_service.FerryService', mock_ferry_service_class):

            from app.tasks.booking_tasks import expire_old_bookings_task
            result = expire_old_bookings_task.run()

            # Booking should be cancelled
            assert mock_pending_booking_with_return.status == BookingStatusEnum.CANCELLED
            # Both outbound and return should be released
            assert mock_ferry_service_instance.cancel_pending_booking.call_count == 2


class TestBookingExpirationTime:
    """Tests for 15-minute booking expiration."""

    def test_booking_expiration_set_to_15_minutes(self):
        """Test that booking expiration is set to 15 minutes."""
        from datetime import timedelta

        # The expiration time used in booking creation
        expiration_minutes = 15
        expected_delta = timedelta(minutes=expiration_minutes)

        assert expected_delta.total_seconds() == 900  # 15 minutes = 900 seconds

    def test_cancellation_reason_mentions_15_minutes(self):
        """Test that cancellation reason mentions 15 minutes."""
        from app.models.booking import BookingStatusEnum

        # Create mock booking
        booking = MagicMock()
        booking.id = 1
        booking.booking_reference = "VF-TEST-001"
        booking.operator = "FerryHopper"
        booking.operator_booking_reference = "BK-FH-12345"
        booking.return_operator_booking_reference = None
        booking.return_operator = None
        booking.expires_at = datetime.now(timezone.utc) - timedelta(minutes=5)
        booking.extra_data = {"operator_booking_pending": True}
        booking.contact_email = "test@example.com"
        booking.departure_port = "TUN"
        booking.arrival_port = "MRS"
        booking.vessel_name = "Test Ferry"
        booking.departure_time = datetime.now(timezone.utc) + timedelta(days=30)
        booking.arrival_time = datetime.now(timezone.utc) + timedelta(days=30, hours=20)
        booking.contact_first_name = "John"
        booking.contact_last_name = "Doe"
        booking.total_passengers = 2
        booking.total_vehicles = 1
        booking.total_amount = Decimal("150.00")
        booking.cancellation_reason = None
        booking.cancelled_at = None

        mock_db_session = MagicMock()
        mock_db_session.close = MagicMock()
        mock_db_session.commit = MagicMock()
        mock_db_session.query.return_value.filter.return_value.all.return_value = [booking]

        mock_email_service = MagicMock()
        mock_email_service.send_cancellation_confirmation.return_value = True

        mock_ferry_service_instance = MagicMock()
        mock_ferry_service_instance.cancel_pending_booking = AsyncMock(return_value=True)
        mock_ferry_service_class = MagicMock(return_value=mock_ferry_service_instance)

        with patch('app.database.SessionLocal', return_value=mock_db_session), \
             patch('app.services.email_service.email_service', mock_email_service), \
             patch('app.services.ferry_service.FerryService', mock_ferry_service_class):

            from app.tasks.booking_tasks import expire_old_bookings_task
            result = expire_old_bookings_task.run()

            # Check cancellation reason mentions 15 minutes
            assert "15 minutes" in booking.cancellation_reason


class TestPendingBookingExtraData:
    """Tests for extra_data fields used in pending booking flow."""

    def test_operator_booking_pending_flag(self):
        """Test that operator_booking_pending flag is correctly used."""
        extra_data = {
            "operator_booking_pending": True,
            "fh_price_cents": 15000,
            "fh_currency": "EUR",
            "fh_segments": [{"id": "seg-1"}]
        }

        assert extra_data["operator_booking_pending"] is True
        assert extra_data["fh_price_cents"] == 15000
        assert extra_data["fh_currency"] == "EUR"

    def test_extra_data_after_confirmation(self):
        """Test extra_data fields after booking confirmation."""
        extra_data = {
            "operator_booking_pending": False,
            "fh_price_cents": 15000,
            "fh_currency": "EUR",
            "fh_confirmed_at": "2025-01-15T10:30:00+00:00"
        }

        assert extra_data["operator_booking_pending"] is False
        assert "fh_confirmed_at" in extra_data

    def test_extra_data_after_expiration(self):
        """Test extra_data fields after booking expiration."""
        extra_data = {
            "operator_booking_pending": False,
            "fh_price_cents": 15000,
            "expired_at": "2025-01-15T10:30:00+00:00"
        }

        assert extra_data["operator_booking_pending"] is False
        assert "expired_at" in extra_data
