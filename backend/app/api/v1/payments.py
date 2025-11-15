"""
Payment API endpoints for handling Stripe payments.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional
import stripe
import os
from dotenv import load_dotenv

from app.database import get_db
from app.models.user import User
from app.models.booking import Booking
from app.models.payment import Payment, PaymentStatusEnum, PaymentMethodEnum
from app.schemas.payment import (
    PaymentCreate,
    PaymentResponse,
    PaymentIntent,
    PaymentConfirmation,
)
from app.api.v1.auth import get_current_active_user

# Load environment variables
load_dotenv()

router = APIRouter(tags=["payments"])

# Configure Stripe
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")


@router.post("/create-intent", response_model=PaymentIntent)
async def create_payment_intent(
    payment_data: PaymentCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Create a Stripe payment intent for a booking.
    """
    try:
        # Validate booking exists and belongs to user (or user is admin)
        booking = db.query(Booking).filter(Booking.id == payment_data.booking_id).first()
        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found"
            )

        # Check if user has permission to pay for this booking
        if booking.user_id != current_user.id and not current_user.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to process payment for this booking",
            )

        # Check if booking is already paid
        existing_payment = (
            db.query(Payment)
            .filter(
                Payment.booking_id == payment_data.booking_id,
                Payment.status == PaymentStatusEnum.COMPLETED,
            )
            .first()
        )
        if existing_payment:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Booking is already paid",
            )

        # Convert amount to cents for Stripe
        amount_cents = int(payment_data.amount * 100)

        # Create Stripe payment intent
        intent = stripe.PaymentIntent.create(
            amount=amount_cents,
            currency=payment_data.currency.value.lower(),
            metadata={
                "booking_id": payment_data.booking_id,
                "user_id": current_user.id,
                "booking_reference": booking.booking_reference,
            },
            automatic_payment_methods={"enabled": True},
        )

        # Create payment record in database
        # Convert PaymentMethod (schema) to PaymentMethodEnum (model)
        payment_method_enum = PaymentMethodEnum[payment_data.payment_method.name]

        payment = Payment(
            booking_id=payment_data.booking_id,
            user_id=current_user.id,
            amount=payment_data.amount,
            currency=payment_data.currency.value,
            status=PaymentStatusEnum.PENDING,
            payment_method=payment_method_enum,
            stripe_payment_intent_id=intent.id,
            net_amount=payment_data.amount,  # Will be updated after fees
        )
        db.add(payment)
        db.commit()

        return PaymentIntent(
            client_secret=intent.client_secret,
            payment_intent_id=intent.id,
            amount=payment_data.amount,
            currency=payment_data.currency.value,
            status=intent.status,
        )

    except stripe.StripeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Stripe error: {str(e)}",
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Payment intent creation failed: {str(e)}",
        )


@router.post("/confirm/{payment_intent_id}", response_model=PaymentConfirmation)
async def confirm_payment(
    payment_intent_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Confirm a payment after successful Stripe payment intent.
    """
    try:
        # Retrieve the payment intent from Stripe with expanded charges
        intent = stripe.PaymentIntent.retrieve(
            payment_intent_id,
            expand=['latest_charge']
        )

        # Find the payment in our database
        payment = (
            db.query(Payment)
            .filter(Payment.stripe_payment_intent_id == payment_intent_id)
            .first()
        )

        if not payment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Payment not found",
            )

        # Verify user has permission
        if payment.user_id != current_user.id and not current_user.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to confirm this payment",
            )

        # Update payment based on Stripe status
        if intent.status == "succeeded":
            payment.status = PaymentStatusEnum.COMPLETED

            # Extract charge info if available
            latest_charge = getattr(intent, 'latest_charge', None)
            if latest_charge:
                # If latest_charge is a string ID, we need to expand it
                if isinstance(latest_charge, str):
                    charge = stripe.Charge.retrieve(latest_charge)
                else:
                    charge = latest_charge

                payment.stripe_charge_id = charge.id

                # Extract card details if present
                payment_method_details = getattr(charge, 'payment_method_details', None)
                if payment_method_details and hasattr(payment_method_details, 'card'):
                    card = payment_method_details.card
                    payment.card_last_four = getattr(card, 'last4', None)
                    payment.card_brand = getattr(card, 'brand', None)
                    payment.card_exp_month = getattr(card, 'exp_month', None)
                    payment.card_exp_year = getattr(card, 'exp_year', None)

            # Update booking status to CONFIRMED
            booking = db.query(Booking).filter(Booking.id == payment.booking_id).first()
            if booking:
                booking.status = "CONFIRMED"
                booking.payment_status = "PAID"

        elif intent.status == "processing":
            payment.status = PaymentStatusEnum.PROCESSING
        elif intent.status in ["canceled", "requires_payment_method"]:
            payment.status = PaymentStatusEnum.FAILED
            payment.failure_message = f"Payment {intent.status}"

        db.commit()
        db.refresh(payment)

        # Get the booking for response
        booking = db.query(Booking).filter(Booking.id == payment.booking_id).first()

        # Get receipt URL from latest charge
        receipt_url = None
        latest_charge = getattr(intent, 'latest_charge', None)
        if latest_charge:
            if isinstance(latest_charge, str):
                charge = stripe.Charge.retrieve(latest_charge)
            else:
                charge = latest_charge
            receipt_url = getattr(charge, 'receipt_url', None)

        return PaymentConfirmation(
            payment_id=payment.id,
            booking_reference=booking.booking_reference if booking else "",
            amount=float(payment.amount),
            currency=payment.currency,
            status=payment.status.value.lower(),
            transaction_id=payment.stripe_charge_id or payment_intent_id,
            receipt_url=receipt_url,
            confirmation_number=booking.booking_reference if booking else "",
        )

    except stripe.StripeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Stripe error: {str(e)}",
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Payment confirmation failed: {str(e)}",
        )


@router.get("/booking/{booking_id}", response_model=Optional[PaymentResponse])
async def get_booking_payment(
    booking_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Get payment details for a specific booking.
    """
    # Verify booking exists and user has access
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found"
        )

    if booking.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this payment",
        )

    # Get the most recent payment for this booking
    payment = (
        db.query(Payment)
        .filter(Payment.booking_id == booking_id)
        .order_by(Payment.created_at.desc())
        .first()
    )

    if not payment:
        return None

    return PaymentResponse.model_validate(payment)


@router.get("/methods")
async def get_payment_methods():
    """
    Get available payment methods.
    This is a simple endpoint that returns supported payment methods.
    """
    return [
        {
            "id": "card",
            "name": "Credit/Debit Card",
            "description": "Pay securely with your credit or debit card",
            "icon": "credit_card",
        },
        {
            "id": "paypal",
            "name": "PayPal",
            "description": "Pay with your PayPal account",
            "icon": "paypal",
            "coming_soon": True,
        },
    ]


@router.get("/config")
async def get_stripe_config():
    """
    Get Stripe publishable key for frontend.
    """
    return {
        "publishableKey": os.getenv("STRIPE_PUBLISHABLE_KEY"),
        "currency": "EUR",
    }


@router.post("/webhook")
async def stripe_webhook(
    request: dict,
    db: Session = Depends(get_db),
):
    """
    Handle Stripe webhook events.
    This endpoint receives notifications from Stripe about payment events.
    """
    from fastapi import Request as FastAPIRequest

    # In production, verify the webhook signature
    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")

    try:
        # Get the event type
        event_type = request.get("type")
        event_data = request.get("data", {}).get("object", {})

        if event_type == "payment_intent.succeeded":
            # Payment was successful
            payment_intent_id = event_data.get("id")

            # Find and update the payment in database
            payment = (
                db.query(Payment)
                .filter(Payment.stripe_payment_intent_id == payment_intent_id)
                .first()
            )

            if payment:
                payment.status = PaymentStatusEnum.COMPLETED

                # Update booking status
                booking = db.query(Booking).filter(Booking.id == payment.booking_id).first()
                if booking:
                    booking.status = "CONFIRMED"
                    booking.payment_status = "PAID"

                db.commit()

        elif event_type == "payment_intent.payment_failed":
            # Payment failed
            payment_intent_id = event_data.get("id")
            error_message = event_data.get("last_payment_error", {}).get("message")

            payment = (
                db.query(Payment)
                .filter(Payment.stripe_payment_intent_id == payment_intent_id)
                .first()
            )

            if payment:
                payment.status = PaymentStatusEnum.FAILED
                payment.failure_message = error_message
                db.commit()

        elif event_type == "charge.refunded":
            # Charge was refunded
            charge_id = event_data.get("id")
            refund_amount = event_data.get("amount_refunded", 0) / 100  # Convert from cents

            payment = (
                db.query(Payment)
                .filter(Payment.stripe_charge_id == charge_id)
                .first()
            )

            if payment:
                payment.status = PaymentStatusEnum.REFUNDED
                payment.refund_amount = refund_amount
                db.commit()

        return {"status": "success"}

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Webhook error: {str(e)}",
        )
