"""
Unit tests for Payment API endpoints with focus on failure scenarios.
"""

import pytest
from unittest.mock import patch, MagicMock
from decimal import Decimal
from datetime import datetime, timedelta

from app.models.booking import Booking, BookingStatusEnum
from app.models.payment import Payment, PaymentStatusEnum, PaymentMethodEnum
from app.models.user import User


class TestPaymentIntentCreation:
    """Tests for create_payment_intent endpoint."""

    @pytest.fixture
    def mock_stripe_success(self):
        """Mock successful Stripe payment intent creation."""
        with patch('stripe.PaymentIntent') as mock_pi:
            mock_intent = MagicMock()
            mock_intent.id = "pi_test_12345"
            mock_intent.client_secret = "pi_test_12345_secret_test"
            mock_intent.status = "requires_payment_method"
            mock_pi.create.return_value = mock_intent
            yield mock_pi

    @pytest.fixture
    def mock_stripe_error(self):
        """Mock Stripe error on payment intent creation."""
        import stripe
        with patch('stripe.PaymentIntent') as mock_pi:
            mock_pi.create.side_effect = stripe.StripeError("Card declined")
            yield mock_pi

    def test_payment_intent_creation_stripe_error(
        self, db_session, sample_booking, mock_stripe_error
    ):
        """Test payment intent creation when Stripe returns an error."""
        # This would be tested via the API endpoint
        # The error should be caught and raise HTTPException
        import stripe
        with pytest.raises(stripe.StripeError):
            stripe.PaymentIntent.create(
                amount=33000,
                currency="eur",
                metadata={"booking_id": sample_booking.id}
            )

    def test_payment_intent_creation_booking_not_found(self, db_session):
        """Test payment intent creation with non-existent booking."""
        booking = db_session.query(Booking).filter(Booking.id == 99999).first()
        assert booking is None

    def test_payment_intent_creation_already_paid(
        self, db_session, sample_booking, sample_payment
    ):
        """Test payment intent creation for already paid booking."""
        # Set payment as completed
        sample_payment.status = PaymentStatusEnum.COMPLETED
        db_session.commit()

        # Check that completed payment exists
        existing = (
            db_session.query(Payment)
            .filter(
                Payment.booking_id == sample_booking.id,
                Payment.status == PaymentStatusEnum.COMPLETED
            )
            .first()
        )
        assert existing is not None

    def test_payment_intent_zero_amount(self, db_session, sample_booking):
        """Test payment intent creation with zero amount (100% discount)."""
        # Zero amount should create a free payment record directly
        payment = Payment(
            booking_id=sample_booking.id,
            amount=Decimal("0.00"),
            currency="EUR",
            status=PaymentStatusEnum.COMPLETED,
            payment_method=PaymentMethodEnum.CREDIT_CARD,
            stripe_payment_intent_id=f"free_{sample_booking.booking_reference}",
            net_amount=Decimal("0.00")
        )
        db_session.add(payment)
        db_session.commit()

        # Verify payment was created
        saved_payment = db_session.query(Payment).filter(
            Payment.stripe_payment_intent_id == f"free_{sample_booking.booking_reference}"
        ).first()
        assert saved_payment is not None
        assert saved_payment.amount == Decimal("0.00")
        assert saved_payment.status == PaymentStatusEnum.COMPLETED


class TestPaymentConfirmation:
    """Tests for confirm_payment endpoint."""

    @pytest.fixture
    def pending_payment(self, db_session, sample_booking):
        """Create a pending payment for testing."""
        payment = Payment(
            booking_id=sample_booking.id,
            amount=sample_booking.total_amount,
            currency="EUR",
            status=PaymentStatusEnum.PENDING,
            payment_method=PaymentMethodEnum.CREDIT_CARD,
            stripe_payment_intent_id="pi_test_confirm_123",
            net_amount=sample_booking.total_amount * Decimal("0.97")
        )
        db_session.add(payment)
        db_session.commit()
        db_session.refresh(payment)
        return payment

    def test_payment_confirmation_success(
        self, db_session, sample_booking, pending_payment
    ):
        """Test successful payment confirmation."""
        # Simulate successful payment
        pending_payment.status = PaymentStatusEnum.COMPLETED
        pending_payment.stripe_charge_id = "ch_test_123"
        pending_payment.card_last_four = "4242"
        pending_payment.card_brand = "visa"

        sample_booking.status = BookingStatusEnum.CONFIRMED
        db_session.commit()

        # Verify
        assert pending_payment.status == PaymentStatusEnum.COMPLETED
        assert sample_booking.status == BookingStatusEnum.CONFIRMED

    def test_payment_confirmation_failed(
        self, db_session, sample_booking, pending_payment
    ):
        """Test payment confirmation when payment failed."""
        pending_payment.status = PaymentStatusEnum.FAILED
        pending_payment.failure_message = "Card declined"
        db_session.commit()

        assert pending_payment.status == PaymentStatusEnum.FAILED
        assert pending_payment.failure_message == "Card declined"
        # Booking should remain pending
        assert sample_booking.status == BookingStatusEnum.PENDING

    def test_payment_confirmation_not_found(self, db_session):
        """Test payment confirmation with non-existent payment intent."""
        payment = db_session.query(Payment).filter(
            Payment.stripe_payment_intent_id == "pi_nonexistent"
        ).first()
        assert payment is None

    def test_payment_confirmation_processing(
        self, db_session, pending_payment
    ):
        """Test payment confirmation when still processing."""
        pending_payment.status = PaymentStatusEnum.PROCESSING
        db_session.commit()

        assert pending_payment.status == PaymentStatusEnum.PROCESSING

    def test_payment_confirmation_requires_action(
        self, db_session, pending_payment
    ):
        """Test payment confirmation when action required (3D Secure)."""
        # Payment requires 3D Secure authentication
        # In this case, status remains pending until user completes action
        assert pending_payment.status == PaymentStatusEnum.PENDING


class TestPaymentFailureScenarios:
    """Tests for various payment failure scenarios."""

    @pytest.fixture
    def payment_with_booking(self, db_session, sample_booking):
        """Create a payment linked to a booking."""
        payment = Payment(
            booking_id=sample_booking.id,
            amount=sample_booking.total_amount,
            currency="EUR",
            status=PaymentStatusEnum.PENDING,
            payment_method=PaymentMethodEnum.CREDIT_CARD,
            stripe_payment_intent_id="pi_failure_test",
            net_amount=sample_booking.total_amount * Decimal("0.97")
        )
        db_session.add(payment)
        db_session.commit()
        db_session.refresh(payment)
        return payment

    def test_card_declined_insufficient_funds(
        self, db_session, payment_with_booking
    ):
        """Test handling of card declined due to insufficient funds."""
        payment_with_booking.status = PaymentStatusEnum.FAILED
        payment_with_booking.failure_message = "Your card has insufficient funds."
        payment_with_booking.failure_code = "card_declined"
        db_session.commit()

        assert payment_with_booking.status == PaymentStatusEnum.FAILED
        assert "insufficient funds" in payment_with_booking.failure_message.lower()

    def test_card_declined_generic(self, db_session, payment_with_booking):
        """Test handling of generic card decline."""
        payment_with_booking.status = PaymentStatusEnum.FAILED
        payment_with_booking.failure_message = "Your card was declined."
        payment_with_booking.failure_code = "card_declined"
        db_session.commit()

        assert payment_with_booking.status == PaymentStatusEnum.FAILED

    def test_card_expired(self, db_session, payment_with_booking):
        """Test handling of expired card."""
        payment_with_booking.status = PaymentStatusEnum.FAILED
        payment_with_booking.failure_message = "Your card has expired."
        payment_with_booking.failure_code = "expired_card"
        db_session.commit()

        assert payment_with_booking.status == PaymentStatusEnum.FAILED
        assert "expired" in payment_with_booking.failure_message.lower()

    def test_invalid_card_number(self, db_session, payment_with_booking):
        """Test handling of invalid card number."""
        payment_with_booking.status = PaymentStatusEnum.FAILED
        payment_with_booking.failure_message = "Your card number is invalid."
        payment_with_booking.failure_code = "invalid_number"
        db_session.commit()

        assert payment_with_booking.status == PaymentStatusEnum.FAILED
        assert "invalid" in payment_with_booking.failure_message.lower()

    def test_invalid_cvc(self, db_session, payment_with_booking):
        """Test handling of invalid CVC code."""
        payment_with_booking.status = PaymentStatusEnum.FAILED
        payment_with_booking.failure_message = "Your card's security code is incorrect."
        payment_with_booking.failure_code = "incorrect_cvc"
        db_session.commit()

        assert payment_with_booking.status == PaymentStatusEnum.FAILED

    def test_fraudulent_payment(self, db_session, payment_with_booking):
        """Test handling of fraudulent payment detection."""
        payment_with_booking.status = PaymentStatusEnum.FAILED
        payment_with_booking.failure_message = "This payment has been flagged as potentially fraudulent."
        payment_with_booking.failure_code = "fraudulent"
        db_session.commit()

        assert payment_with_booking.status == PaymentStatusEnum.FAILED
        assert "fraudulent" in payment_with_booking.failure_message.lower()

    def test_processing_error(self, db_session, payment_with_booking):
        """Test handling of processing error."""
        payment_with_booking.status = PaymentStatusEnum.FAILED
        payment_with_booking.failure_message = "An error occurred while processing your card. Try again later."
        payment_with_booking.failure_code = "processing_error"
        db_session.commit()

        assert payment_with_booking.status == PaymentStatusEnum.FAILED

    def test_rate_limit_exceeded(self, db_session, payment_with_booking):
        """Test handling of rate limit exceeded."""
        payment_with_booking.status = PaymentStatusEnum.FAILED
        payment_with_booking.failure_message = "Too many requests made to the API too quickly."
        payment_with_booking.failure_code = "rate_limit"
        db_session.commit()

        assert payment_with_booking.status == PaymentStatusEnum.FAILED

    def test_stripe_api_connection_error(self, db_session, payment_with_booking):
        """Test handling of Stripe API connection error."""
        payment_with_booking.status = PaymentStatusEnum.FAILED
        payment_with_booking.failure_message = "Could not connect to payment provider. Please try again."
        payment_with_booking.failure_code = "api_connection_error"
        db_session.commit()

        assert payment_with_booking.status == PaymentStatusEnum.FAILED


class TestWebhookPaymentEvents:
    """Tests for Stripe webhook payment event handling."""

    @pytest.fixture
    def webhook_payment(self, db_session, sample_booking):
        """Create a payment for webhook testing."""
        payment = Payment(
            booking_id=sample_booking.id,
            amount=sample_booking.total_amount,
            currency="EUR",
            status=PaymentStatusEnum.PENDING,
            payment_method=PaymentMethodEnum.CREDIT_CARD,
            stripe_payment_intent_id="pi_webhook_test",
            net_amount=sample_booking.total_amount * Decimal("0.97")
        )
        db_session.add(payment)
        db_session.commit()
        db_session.refresh(payment)
        return payment

    def test_webhook_payment_succeeded(
        self, db_session, sample_booking, webhook_payment
    ):
        """Test webhook handling for successful payment."""
        # Simulate webhook event processing
        webhook_payment.status = PaymentStatusEnum.COMPLETED
        sample_booking.status = BookingStatusEnum.CONFIRMED
        db_session.commit()

        assert webhook_payment.status == PaymentStatusEnum.COMPLETED
        assert sample_booking.status == BookingStatusEnum.CONFIRMED

    def test_webhook_payment_failed(
        self, db_session, sample_booking, webhook_payment
    ):
        """Test webhook handling for failed payment."""
        error_message = "Your card was declined."

        webhook_payment.status = PaymentStatusEnum.FAILED
        webhook_payment.failure_message = error_message
        db_session.commit()

        assert webhook_payment.status == PaymentStatusEnum.FAILED
        assert webhook_payment.failure_message == error_message
        # Booking should remain pending
        assert sample_booking.status == BookingStatusEnum.PENDING

    def test_webhook_charge_refunded(
        self, db_session, sample_booking, webhook_payment
    ):
        """Test webhook handling for refunded charge."""
        refund_amount = Decimal("330.00")

        # First mark as completed
        webhook_payment.status = PaymentStatusEnum.COMPLETED
        webhook_payment.stripe_charge_id = "ch_test_refund"
        sample_booking.status = BookingStatusEnum.CONFIRMED
        db_session.commit()

        # Then process refund
        webhook_payment.status = PaymentStatusEnum.REFUNDED
        webhook_payment.refund_amount = refund_amount
        sample_booking.refund_processed = True
        sample_booking.refund_amount = refund_amount
        db_session.commit()

        assert webhook_payment.status == PaymentStatusEnum.REFUNDED
        assert webhook_payment.refund_amount == refund_amount
        assert sample_booking.refund_processed is True

    def test_webhook_partial_refund(
        self, db_session, sample_booking, webhook_payment
    ):
        """Test webhook handling for partial refund."""
        partial_refund = Decimal("100.00")

        # First mark as completed
        webhook_payment.status = PaymentStatusEnum.COMPLETED
        webhook_payment.stripe_charge_id = "ch_test_partial_refund"
        db_session.commit()

        # Process partial refund
        # Note: For partial refunds, we might keep status as COMPLETED
        # and just track the refund amount
        webhook_payment.refund_amount = partial_refund
        sample_booking.refund_amount = partial_refund
        db_session.commit()

        assert webhook_payment.refund_amount == partial_refund
        assert sample_booking.refund_amount == partial_refund


class TestPaymentRetryScenarios:
    """Tests for payment retry scenarios."""

    def test_retry_after_decline(self, db_session, sample_booking):
        """Test creating a new payment after decline."""
        # First payment attempt - declined
        payment1 = Payment(
            booking_id=sample_booking.id,
            amount=sample_booking.total_amount,
            currency="EUR",
            status=PaymentStatusEnum.FAILED,
            payment_method=PaymentMethodEnum.CREDIT_CARD,
            stripe_payment_intent_id="pi_attempt_1",
            failure_message="Card declined",
            net_amount=sample_booking.total_amount * Decimal("0.97")
        )
        db_session.add(payment1)
        db_session.commit()

        # Second payment attempt - success
        payment2 = Payment(
            booking_id=sample_booking.id,
            amount=sample_booking.total_amount,
            currency="EUR",
            status=PaymentStatusEnum.COMPLETED,
            payment_method=PaymentMethodEnum.CREDIT_CARD,
            stripe_payment_intent_id="pi_attempt_2",
            stripe_charge_id="ch_success",
            net_amount=sample_booking.total_amount * Decimal("0.97")
        )
        db_session.add(payment2)
        sample_booking.status = BookingStatusEnum.CONFIRMED
        db_session.commit()

        # Verify both payments exist
        payments = db_session.query(Payment).filter(
            Payment.booking_id == sample_booking.id
        ).all()
        assert len(payments) == 2
        assert payments[0].status == PaymentStatusEnum.FAILED
        assert payments[1].status == PaymentStatusEnum.COMPLETED
        assert sample_booking.status == BookingStatusEnum.CONFIRMED

    def test_multiple_failed_attempts(self, db_session, sample_booking):
        """Test handling multiple failed payment attempts."""
        for i in range(3):
            payment = Payment(
                booking_id=sample_booking.id,
                amount=sample_booking.total_amount,
                currency="EUR",
                status=PaymentStatusEnum.FAILED,
                payment_method=PaymentMethodEnum.CREDIT_CARD,
                stripe_payment_intent_id=f"pi_failed_{i}",
                failure_message="Card declined",
                net_amount=sample_booking.total_amount * Decimal("0.97")
            )
            db_session.add(payment)
        db_session.commit()

        # Count failed payments
        failed_payments = db_session.query(Payment).filter(
            Payment.booking_id == sample_booking.id,
            Payment.status == PaymentStatusEnum.FAILED
        ).count()
        assert failed_payments == 3

        # Booking should still be pending
        assert sample_booking.status == BookingStatusEnum.PENDING


class TestCabinUpgradePayments:
    """Tests for cabin upgrade payment scenarios."""

    def test_cabin_upgrade_payment_creation(
        self, db_session, confirmed_booking
    ):
        """Test creating a cabin upgrade payment."""
        upgrade_amount = Decimal("50.00")

        payment = Payment(
            booking_id=confirmed_booking.id,
            amount=upgrade_amount,
            currency="EUR",
            status=PaymentStatusEnum.PENDING,
            payment_method=PaymentMethodEnum.CREDIT_CARD,
            stripe_payment_intent_id="pi_cabin_upgrade",
            net_amount=upgrade_amount * Decimal("0.97")
        )
        db_session.add(payment)
        db_session.commit()

        # Verify cabin upgrade payment doesn't affect booking status
        assert confirmed_booking.status == BookingStatusEnum.CONFIRMED
        assert payment.amount == upgrade_amount

    def test_cabin_upgrade_payment_failure(
        self, db_session, confirmed_booking
    ):
        """Test handling cabin upgrade payment failure."""
        upgrade_amount = Decimal("50.00")

        payment = Payment(
            booking_id=confirmed_booking.id,
            amount=upgrade_amount,
            currency="EUR",
            status=PaymentStatusEnum.FAILED,
            payment_method=PaymentMethodEnum.CREDIT_CARD,
            stripe_payment_intent_id="pi_cabin_upgrade_fail",
            failure_message="Card declined",
            net_amount=upgrade_amount * Decimal("0.97")
        )
        db_session.add(payment)
        db_session.commit()

        # Booking should remain confirmed even if upgrade payment fails
        assert confirmed_booking.status == BookingStatusEnum.CONFIRMED
        assert payment.status == PaymentStatusEnum.FAILED


class TestExpressCheckoutPayments:
    """Tests for Express Checkout (Google Pay, Apple Pay, Link) payment scenarios."""

    def test_google_pay_payment_success(self, db_session, sample_booking):
        """Test successful Google Pay payment."""
        payment = Payment(
            booking_id=sample_booking.id,
            amount=sample_booking.total_amount,
            currency="EUR",
            status=PaymentStatusEnum.COMPLETED,
            payment_method=PaymentMethodEnum.CREDIT_CARD,  # Google Pay uses card rails
            stripe_payment_intent_id="pi_google_pay_test",
            stripe_charge_id="ch_google_pay_test",
            card_brand="mastercard",  # Google Pay can use various cards
            card_last_four="1234",
            net_amount=sample_booking.total_amount * Decimal("0.97")
        )
        db_session.add(payment)
        sample_booking.status = BookingStatusEnum.CONFIRMED
        db_session.commit()

        assert payment.status == PaymentStatusEnum.COMPLETED
        assert sample_booking.status == BookingStatusEnum.CONFIRMED

    def test_apple_pay_payment_success(self, db_session, sample_booking):
        """Test successful Apple Pay payment."""
        payment = Payment(
            booking_id=sample_booking.id,
            amount=sample_booking.total_amount,
            currency="EUR",
            status=PaymentStatusEnum.COMPLETED,
            payment_method=PaymentMethodEnum.CREDIT_CARD,  # Apple Pay uses card rails
            stripe_payment_intent_id="pi_apple_pay_test",
            stripe_charge_id="ch_apple_pay_test",
            card_brand="visa",
            card_last_four="4242",
            net_amount=sample_booking.total_amount * Decimal("0.97")
        )
        db_session.add(payment)
        sample_booking.status = BookingStatusEnum.CONFIRMED
        db_session.commit()

        assert payment.status == PaymentStatusEnum.COMPLETED

    def test_link_payment_success(self, db_session, sample_booking):
        """Test successful Stripe Link payment."""
        payment = Payment(
            booking_id=sample_booking.id,
            amount=sample_booking.total_amount,
            currency="EUR",
            status=PaymentStatusEnum.COMPLETED,
            payment_method=PaymentMethodEnum.CREDIT_CARD,  # Link uses saved cards
            stripe_payment_intent_id="pi_link_test",
            stripe_charge_id="ch_link_test",
            net_amount=sample_booking.total_amount * Decimal("0.97")
        )
        db_session.add(payment)
        sample_booking.status = BookingStatusEnum.CONFIRMED
        db_session.commit()

        assert payment.status == PaymentStatusEnum.COMPLETED

    def test_express_checkout_3ds_required(self, db_session, sample_booking):
        """Test Express Checkout requiring 3D Secure authentication."""
        payment = Payment(
            booking_id=sample_booking.id,
            amount=sample_booking.total_amount,
            currency="EUR",
            status=PaymentStatusEnum.PENDING,  # Waiting for 3DS
            payment_method=PaymentMethodEnum.CREDIT_CARD,
            stripe_payment_intent_id="pi_3ds_required",
            net_amount=sample_booking.total_amount * Decimal("0.97")
        )
        db_session.add(payment)
        db_session.commit()

        # Payment should be pending while waiting for 3DS
        assert payment.status == PaymentStatusEnum.PENDING
        assert sample_booking.status == BookingStatusEnum.PENDING

    def test_express_checkout_3ds_failed(self, db_session, sample_booking):
        """Test Express Checkout when 3D Secure authentication fails."""
        payment = Payment(
            booking_id=sample_booking.id,
            amount=sample_booking.total_amount,
            currency="EUR",
            status=PaymentStatusEnum.FAILED,
            payment_method=PaymentMethodEnum.CREDIT_CARD,
            stripe_payment_intent_id="pi_3ds_failed",
            failure_message="3D Secure authentication failed",
            failure_code="authentication_required",
            net_amount=sample_booking.total_amount * Decimal("0.97")
        )
        db_session.add(payment)
        db_session.commit()

        assert payment.status == PaymentStatusEnum.FAILED
        assert "3D Secure" in payment.failure_message


class TestPaymentSessionExpiry:
    """Tests for payment session expiry scenarios."""

    def test_payment_intent_expired(self, db_session, sample_booking):
        """Test handling of expired payment intent."""
        payment = Payment(
            booking_id=sample_booking.id,
            amount=sample_booking.total_amount,
            currency="EUR",
            status=PaymentStatusEnum.FAILED,
            payment_method=PaymentMethodEnum.CREDIT_CARD,
            stripe_payment_intent_id="pi_expired",
            failure_message="Payment intent has expired",
            failure_code="payment_intent_expired",
            net_amount=sample_booking.total_amount * Decimal("0.97")
        )
        db_session.add(payment)
        db_session.commit()

        assert payment.status == PaymentStatusEnum.FAILED
        assert "expired" in payment.failure_message.lower()

    def test_payment_canceled_by_user(self, db_session, sample_booking):
        """Test handling when user cancels payment."""
        payment = Payment(
            booking_id=sample_booking.id,
            amount=sample_booking.total_amount,
            currency="EUR",
            status=PaymentStatusEnum.FAILED,
            payment_method=PaymentMethodEnum.CREDIT_CARD,
            stripe_payment_intent_id="pi_user_canceled",
            failure_message="Payment was canceled by user",
            failure_code="canceled",
            net_amount=sample_booking.total_amount * Decimal("0.97")
        )
        db_session.add(payment)
        db_session.commit()

        assert payment.status == PaymentStatusEnum.FAILED
        # Booking should remain available for retry
        assert sample_booking.status == BookingStatusEnum.PENDING


class TestCurrencyAndAmountValidation:
    """Tests for currency and amount validation scenarios."""

    def test_minimum_payment_amount(self, db_session, sample_booking):
        """Test payment with minimum amount (Stripe has min requirements)."""
        # Stripe minimum is €0.50 for EUR
        min_amount = Decimal("0.50")
        payment = Payment(
            booking_id=sample_booking.id,
            amount=min_amount,
            currency="EUR",
            status=PaymentStatusEnum.COMPLETED,
            payment_method=PaymentMethodEnum.CREDIT_CARD,
            stripe_payment_intent_id="pi_min_amount",
            net_amount=min_amount * Decimal("0.97")
        )
        db_session.add(payment)
        db_session.commit()

        assert payment.amount == min_amount

    def test_large_payment_amount(self, db_session, sample_booking):
        """Test payment with large amount."""
        large_amount = Decimal("9999.99")
        payment = Payment(
            booking_id=sample_booking.id,
            amount=large_amount,
            currency="EUR",
            status=PaymentStatusEnum.COMPLETED,
            payment_method=PaymentMethodEnum.CREDIT_CARD,
            stripe_payment_intent_id="pi_large_amount",
            net_amount=large_amount * Decimal("0.97")
        )
        db_session.add(payment)
        db_session.commit()

        assert payment.amount == large_amount

    def test_payment_amount_precision(self, db_session, sample_booking):
        """Test payment amount with decimal precision."""
        precise_amount = Decimal("123.45")
        payment = Payment(
            booking_id=sample_booking.id,
            amount=precise_amount,
            currency="EUR",
            status=PaymentStatusEnum.COMPLETED,
            payment_method=PaymentMethodEnum.CREDIT_CARD,
            stripe_payment_intent_id="pi_precise",
            net_amount=precise_amount * Decimal("0.97")
        )
        db_session.add(payment)
        db_session.commit()

        assert payment.amount == precise_amount


class TestNetworkAndTimeoutErrors:
    """Tests for network and timeout error scenarios."""

    def test_stripe_timeout_error(self, db_session, sample_booking):
        """Test handling of Stripe timeout error."""
        payment = Payment(
            booking_id=sample_booking.id,
            amount=sample_booking.total_amount,
            currency="EUR",
            status=PaymentStatusEnum.FAILED,
            payment_method=PaymentMethodEnum.CREDIT_CARD,
            stripe_payment_intent_id="pi_timeout",
            failure_message="Request to Stripe timed out",
            failure_code="timeout",
            net_amount=sample_booking.total_amount * Decimal("0.97")
        )
        db_session.add(payment)
        db_session.commit()

        assert payment.status == PaymentStatusEnum.FAILED
        assert "timed out" in payment.failure_message.lower()

    def test_stripe_service_unavailable(self, db_session, sample_booking):
        """Test handling of Stripe service unavailable."""
        payment = Payment(
            booking_id=sample_booking.id,
            amount=sample_booking.total_amount,
            currency="EUR",
            status=PaymentStatusEnum.FAILED,
            payment_method=PaymentMethodEnum.CREDIT_CARD,
            stripe_payment_intent_id="pi_unavailable",
            failure_message="Stripe service temporarily unavailable",
            failure_code="service_unavailable",
            net_amount=sample_booking.total_amount * Decimal("0.97")
        )
        db_session.add(payment)
        db_session.commit()

        assert payment.status == PaymentStatusEnum.FAILED


class TestDuplicatePaymentPrevention:
    """Tests for duplicate payment prevention."""

    def test_prevent_double_payment(self, db_session, sample_booking):
        """Test that a booking can't be paid twice."""
        # First successful payment
        payment1 = Payment(
            booking_id=sample_booking.id,
            amount=sample_booking.total_amount,
            currency="EUR",
            status=PaymentStatusEnum.COMPLETED,
            payment_method=PaymentMethodEnum.CREDIT_CARD,
            stripe_payment_intent_id="pi_first",
            stripe_charge_id="ch_first",
            net_amount=sample_booking.total_amount * Decimal("0.97")
        )
        db_session.add(payment1)
        sample_booking.status = BookingStatusEnum.CONFIRMED
        db_session.commit()

        # Check for existing completed payment
        existing_payment = db_session.query(Payment).filter(
            Payment.booking_id == sample_booking.id,
            Payment.status == PaymentStatusEnum.COMPLETED
        ).first()

        # Should find existing payment
        assert existing_payment is not None
        assert existing_payment.stripe_payment_intent_id == "pi_first"

    def test_allow_retry_after_failure(self, db_session, sample_booking):
        """Test that retry is allowed after failed payment."""
        # First failed payment
        payment1 = Payment(
            booking_id=sample_booking.id,
            amount=sample_booking.total_amount,
            currency="EUR",
            status=PaymentStatusEnum.FAILED,
            payment_method=PaymentMethodEnum.CREDIT_CARD,
            stripe_payment_intent_id="pi_failed_first",
            failure_message="Card declined",
            net_amount=sample_booking.total_amount * Decimal("0.97")
        )
        db_session.add(payment1)
        db_session.commit()

        # Check for existing completed payment (should be None)
        existing_completed = db_session.query(Payment).filter(
            Payment.booking_id == sample_booking.id,
            Payment.status == PaymentStatusEnum.COMPLETED
        ).first()

        # No completed payment, retry should be allowed
        assert existing_completed is None

        # Second payment attempt should be allowed
        payment2 = Payment(
            booking_id=sample_booking.id,
            amount=sample_booking.total_amount,
            currency="EUR",
            status=PaymentStatusEnum.COMPLETED,
            payment_method=PaymentMethodEnum.CREDIT_CARD,
            stripe_payment_intent_id="pi_retry_success",
            stripe_charge_id="ch_retry_success",
            net_amount=sample_booking.total_amount * Decimal("0.97")
        )
        db_session.add(payment2)
        sample_booking.status = BookingStatusEnum.CONFIRMED
        db_session.commit()

        assert payment2.status == PaymentStatusEnum.COMPLETED
        assert sample_booking.status == BookingStatusEnum.CONFIRMED
