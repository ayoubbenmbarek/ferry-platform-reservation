"""
Unit tests for Payment models.
"""

import pytest
from datetime import datetime
from decimal import Decimal

from app.models.payment import Payment, PaymentMethod, PaymentStatusEnum, PaymentMethodEnum


class TestPaymentModel:
    """Tests for the Payment model."""

    def test_create_payment(self, db_session, sample_booking):
        """Test creating a basic payment."""
        payment = Payment(
            booking_id=sample_booking.id,
            amount=Decimal("495.00"),
            currency="EUR",
            payment_method=PaymentMethodEnum.CREDIT_CARD,
            status=PaymentStatusEnum.PENDING,
            net_amount=Decimal("480.00"),
            transaction_fee=Decimal("15.00")
        )
        db_session.add(payment)
        db_session.commit()

        assert payment.id is not None
        assert payment.amount == Decimal("495.00")
        assert payment.status == PaymentStatusEnum.PENDING

    def test_payment_default_status(self, db_session, sample_booking):
        """Test that new payments have PENDING status by default."""
        payment = Payment(
            booking_id=sample_booking.id,
            amount=Decimal("100.00"),
            payment_method=PaymentMethodEnum.CREDIT_CARD,
            net_amount=Decimal("97.00")
        )
        db_session.add(payment)
        db_session.commit()

        assert payment.status == PaymentStatusEnum.PENDING

    def test_payment_status_transitions(self, db_session, sample_payment):
        """Test payment status transitions."""
        # PENDING -> PROCESSING
        sample_payment.status = PaymentStatusEnum.PROCESSING
        db_session.commit()
        assert sample_payment.status == PaymentStatusEnum.PROCESSING

        # PROCESSING -> COMPLETED
        sample_payment.status = PaymentStatusEnum.COMPLETED
        sample_payment.processed_at = datetime.now()
        db_session.commit()
        assert sample_payment.status == PaymentStatusEnum.COMPLETED

    def test_payment_with_stripe_details(self, db_session, sample_booking):
        """Test payment with Stripe details."""
        payment = Payment(
            booking_id=sample_booking.id,
            amount=Decimal("495.00"),
            payment_method=PaymentMethodEnum.CREDIT_CARD,
            status=PaymentStatusEnum.COMPLETED,
            net_amount=Decimal("480.00"),
            stripe_payment_intent_id="pi_test_123456789",
            stripe_charge_id="ch_test_123456789",
            card_brand="visa",
            card_last_four="4242",
            card_exp_month=12,
            card_exp_year=2025
        )
        db_session.add(payment)
        db_session.commit()

        assert payment.stripe_payment_intent_id == "pi_test_123456789"
        assert payment.card_brand == "visa"
        assert payment.card_last_four == "4242"

    def test_payment_failure(self, db_session, sample_booking):
        """Test recording payment failure."""
        payment = Payment(
            booking_id=sample_booking.id,
            amount=Decimal("495.00"),
            payment_method=PaymentMethodEnum.CREDIT_CARD,
            status=PaymentStatusEnum.FAILED,
            net_amount=Decimal("0.00"),
            failure_code="card_declined",
            failure_message="Your card was declined due to insufficient funds."
        )
        db_session.add(payment)
        db_session.commit()

        assert payment.status == PaymentStatusEnum.FAILED
        assert payment.failure_code == "card_declined"
        assert "insufficient funds" in payment.failure_message

    def test_payment_refund(self, db_session, sample_payment):
        """Test recording a refund."""
        sample_payment.status = PaymentStatusEnum.REFUNDED
        sample_payment.refund_amount = sample_payment.amount
        sample_payment.refund_reason = "Customer cancellation"
        sample_payment.refunded_at = datetime.now()
        sample_payment.stripe_refund_id = "re_test_123456789"
        db_session.commit()

        assert sample_payment.status == PaymentStatusEnum.REFUNDED
        assert sample_payment.refund_amount == sample_payment.amount
        assert sample_payment.stripe_refund_id is not None

    def test_partial_refund(self, db_session, sample_payment):
        """Test partial refund."""
        original_amount = sample_payment.amount
        sample_payment.refund_amount = Decimal("100.00")
        sample_payment.refund_reason = "Partial cancellation"
        sample_payment.refunded_at = datetime.now()
        db_session.commit()

        assert sample_payment.refund_amount < original_amount
        assert sample_payment.refund_amount == Decimal("100.00")

    def test_is_successful_property(self, db_session, sample_payment):
        """Test is_successful property."""
        sample_payment.status = PaymentStatusEnum.COMPLETED
        db_session.commit()
        assert sample_payment.is_successful is True

        sample_payment.status = PaymentStatusEnum.FAILED
        db_session.commit()
        assert sample_payment.is_successful is False

    def test_can_be_refunded_property(self, db_session, sample_payment):
        """Test can_be_refunded property."""
        sample_payment.status = PaymentStatusEnum.COMPLETED
        sample_payment.refund_amount = None
        db_session.commit()
        assert sample_payment.can_be_refunded is True

        # After refund
        sample_payment.refund_amount = Decimal("100.00")
        db_session.commit()
        assert sample_payment.can_be_refunded is False

    def test_payment_repr(self, sample_payment):
        """Test payment string representation."""
        repr_str = repr(sample_payment)
        assert "Payment" in repr_str
        assert str(sample_payment.amount) in repr_str

    def test_payment_with_user(self, db_session, sample_booking, sample_user):
        """Test payment linked to user."""
        payment = Payment(
            booking_id=sample_booking.id,
            user_id=sample_user.id,
            amount=Decimal("495.00"),
            payment_method=PaymentMethodEnum.CREDIT_CARD,
            net_amount=Decimal("480.00")
        )
        db_session.add(payment)
        db_session.commit()

        assert payment.user_id == sample_user.id
        assert payment.user == sample_user

    def test_apple_pay_payment(self, db_session, sample_booking):
        """Test Apple Pay payment method."""
        payment = Payment(
            booking_id=sample_booking.id,
            amount=Decimal("495.00"),
            payment_method=PaymentMethodEnum.APPLE_PAY,
            status=PaymentStatusEnum.COMPLETED,
            net_amount=Decimal("480.00"),
            stripe_payment_intent_id="pi_apple_123"
        )
        db_session.add(payment)
        db_session.commit()

        assert payment.payment_method == PaymentMethodEnum.APPLE_PAY

    def test_google_pay_payment(self, db_session, sample_booking):
        """Test Google Pay payment method."""
        payment = Payment(
            booking_id=sample_booking.id,
            amount=Decimal("495.00"),
            payment_method=PaymentMethodEnum.GOOGLE_PAY,
            status=PaymentStatusEnum.COMPLETED,
            net_amount=Decimal("480.00"),
            stripe_payment_intent_id="pi_google_123"
        )
        db_session.add(payment)
        db_session.commit()

        assert payment.payment_method == PaymentMethodEnum.GOOGLE_PAY


class TestPaymentMethodModel:
    """Tests for the PaymentMethod (saved payment methods) model."""

    def test_create_saved_card(self, db_session, sample_user):
        """Test saving a card payment method."""
        payment_method = PaymentMethod(
            user_id=sample_user.id,
            method_type=PaymentMethodEnum.CREDIT_CARD,
            stripe_payment_method_id="pm_test_123456",
            card_brand="visa",
            card_last_four="4242",
            card_exp_month=12,
            card_exp_year=2025,
            is_default=True
        )
        db_session.add(payment_method)
        db_session.commit()

        assert payment_method.id is not None
        assert payment_method.is_default is True
        assert payment_method.card_brand == "visa"

    def test_multiple_payment_methods(self, db_session, sample_user):
        """Test user with multiple saved payment methods."""
        methods = [
            PaymentMethod(
                user_id=sample_user.id,
                method_type=PaymentMethodEnum.CREDIT_CARD,
                card_brand="visa",
                card_last_four="4242",
                is_default=True
            ),
            PaymentMethod(
                user_id=sample_user.id,
                method_type=PaymentMethodEnum.CREDIT_CARD,
                card_brand="mastercard",
                card_last_four="5555",
                is_default=False
            )
        ]
        db_session.add_all(methods)
        db_session.commit()

        user_methods = db_session.query(PaymentMethod).filter(
            PaymentMethod.user_id == sample_user.id
        ).all()
        assert len(user_methods) == 2

    def test_payment_method_with_billing_address(self, db_session, sample_user):
        """Test payment method with billing address."""
        payment_method = PaymentMethod(
            user_id=sample_user.id,
            method_type=PaymentMethodEnum.CREDIT_CARD,
            card_brand="visa",
            card_last_four="4242",
            billing_name="John Doe",
            billing_address_line1="123 Main St",
            billing_city="Paris",
            billing_postal_code="75001",
            billing_country="FR"
        )
        db_session.add(payment_method)
        db_session.commit()

        assert payment_method.billing_name == "John Doe"
        assert payment_method.billing_country == "FR"

    def test_display_name_property(self, db_session, sample_user):
        """Test display_name property for cards."""
        payment_method = PaymentMethod(
            user_id=sample_user.id,
            method_type=PaymentMethodEnum.CREDIT_CARD,
            card_brand="visa",
            card_last_four="4242"
        )
        db_session.add(payment_method)
        db_session.commit()

        assert "visa" in payment_method.display_name
        assert "4242" in payment_method.display_name

    def test_deactivate_payment_method(self, db_session, sample_user):
        """Test deactivating a payment method."""
        payment_method = PaymentMethod(
            user_id=sample_user.id,
            method_type=PaymentMethodEnum.CREDIT_CARD,
            card_brand="visa",
            card_last_four="4242",
            is_active=True
        )
        db_session.add(payment_method)
        db_session.commit()

        payment_method.is_active = False
        db_session.commit()

        assert payment_method.is_active is False

    def test_payment_method_repr(self, db_session, sample_user):
        """Test payment method string representation."""
        payment_method = PaymentMethod(
            user_id=sample_user.id,
            method_type=PaymentMethodEnum.CREDIT_CARD,
            card_brand="visa",
            card_last_four="4242"
        )
        db_session.add(payment_method)
        db_session.commit()

        repr_str = repr(payment_method)
        assert "PaymentMethod" in repr_str
        assert "credit_card" in repr_str


class TestPaymentRelationships:
    """Tests for payment relationships."""

    def test_payment_booking_relationship(self, sample_payment, sample_booking):
        """Test payment-booking relationship."""
        assert sample_payment.booking == sample_booking
        assert sample_payment in sample_booking.payments

    def test_multiple_payments_per_booking(self, db_session, sample_booking):
        """Test multiple payments for a single booking (e.g., split payment)."""
        payments = [
            Payment(
                booking_id=sample_booking.id,
                amount=Decimal("250.00"),
                payment_method=PaymentMethodEnum.CREDIT_CARD,
                net_amount=Decimal("242.50"),
                status=PaymentStatusEnum.COMPLETED
            ),
            Payment(
                booking_id=sample_booking.id,
                amount=Decimal("245.00"),
                payment_method=PaymentMethodEnum.PAYPAL,
                net_amount=Decimal("237.65"),
                status=PaymentStatusEnum.COMPLETED
            )
        ]
        db_session.add_all(payments)
        db_session.commit()

        db_session.refresh(sample_booking)
        assert len(sample_booking.payments) >= 2

        total_paid = sum(p.amount for p in sample_booking.payments if p.status == PaymentStatusEnum.COMPLETED)
        assert total_paid >= Decimal("495.00")
