"""
Celery tasks for payment processing and webhook handling.

These tasks handle Stripe webhooks and payment verification asynchronously.
"""
import logging
from typing import Dict, Any
from datetime import datetime
from celery import Task
from sqlalchemy.orm import Session
from app.celery_app import celery_app
from app.database import SessionLocal
from app.models.booking import Booking, BookingStatusEnum
from app.models.payment import Payment, PaymentStatusEnum
from app.tasks.email_tasks import (
    send_payment_success_email_task,
    send_payment_failed_email_task,
)
import stripe
import os

logger = logging.getLogger(__name__)

# Initialize Stripe
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")


class PaymentTask(Task):
    """Base task for payment processing with retry logic."""
    autoretry_for = (Exception,)
    retry_kwargs = {"max_retries": 5}
    retry_backoff = True
    retry_backoff_max = 300  # 5 minutes
    retry_jitter = True


@celery_app.task(
    base=PaymentTask,
    name="app.tasks.payment_tasks.process_payment_webhook",
    bind=True
)
def process_payment_webhook_task(
    self,
    event_type: str,
    payment_intent_id: str,
    event_data: Dict[str, Any]
):
    """
    Process Stripe payment webhook events asynchronously.

    Args:
        event_type: Stripe event type (e.g., 'payment_intent.succeeded')
        payment_intent_id: Stripe payment intent ID
        event_data: Full event data from Stripe

    This task:
    1. Updates payment and booking status in database
    2. Triggers email notification task (decoupled)
    """
    db: Session = SessionLocal()
    try:
        logger.info(f"Processing payment webhook: {event_type} for {payment_intent_id}")

        # Find payment by Stripe payment intent ID
        payment = db.query(Payment).filter(
            Payment.stripe_payment_intent_id == payment_intent_id
        ).first()

        if not payment:
            logger.error(f"Payment not found for intent {payment_intent_id}")
            return {"status": "error", "message": "Payment not found"}

        # Find associated booking
        booking = db.query(Booking).filter(Booking.id == payment.booking_id).first()

        if not booking:
            logger.error(f"Booking not found for payment {payment.id}")
            return {"status": "error", "message": "Booking not found"}

        # Handle different event types
        if event_type == "payment_intent.succeeded":
            logger.info(f"✅ Payment succeeded for booking {booking.booking_reference}")

            # Update payment status
            payment.status = PaymentStatusEnum.COMPLETED
            payment.processed_at = datetime.utcnow()

            # Update booking status
            booking.status = BookingStatusEnum.CONFIRMED
            booking.updated_at = datetime.utcnow()

            db.commit()
            db.refresh(payment)
            db.refresh(booking)

            # Prepare data for email
            booking_data = {
                "id": booking.id,
                "booking_reference": booking.booking_reference,
                "operator": booking.operator,
                "departure_port": booking.departure_port,
                "arrival_port": booking.arrival_port,
                "departure_time": booking.departure_time.isoformat() if booking.departure_time else None,
                "arrival_time": booking.arrival_time.isoformat() if booking.arrival_time else None,
                "vessel_name": booking.vessel_name,
                "contact_email": booking.contact_email,
                "contact_first_name": booking.contact_first_name,
                "contact_last_name": booking.contact_last_name,
                "total_passengers": booking.total_passengers,
                "total_vehicles": booking.total_vehicles,
                "total_amount": float(booking.total_amount) if booking.total_amount else 0,
                "currency": booking.currency or "EUR",
                "base_url": os.getenv("BASE_URL", "http://localhost:3001")
            }

            payment_data = {
                "amount": float(payment.amount) if payment.amount else 0,
                "currency": payment.currency,
                "payment_method": payment.payment_method,
                "card_last_four": payment.card_last_four,
                "card_brand": payment.card_brand,
            }

            # Trigger async email task (decoupled from payment processing)
            send_payment_success_email_task.delay(
                booking_data=booking_data,
                payment_data=payment_data,
                to_email=booking.contact_email
            )

            logger.info(f"✅ Payment webhook processed successfully. Email task queued.")
            return {
                "status": "success",
                "booking_reference": booking.booking_reference,
                "payment_id": payment.id
            }

        elif event_type == "payment_intent.payment_failed":
            logger.warning(f"⚠️ Payment failed for booking {booking.booking_reference}")

            # Update payment status
            payment.status = PaymentStatusEnum.FAILED
            failure_data = event_data.get("last_payment_error", {})
            payment.failure_code = failure_data.get("code")
            payment.failure_message = failure_data.get("message")

            # Keep booking in PENDING status (user can retry)
            booking.status = BookingStatusEnum.PENDING
            booking.updated_at = datetime.utcnow()

            db.commit()

            # Send payment failed email
            booking_data = {
                "booking_reference": booking.booking_reference,
                "contact_email": booking.contact_email,
            }

            send_payment_failed_email_task.delay(
                booking_data=booking_data,
                error_message=payment.failure_message or "Payment processing failed",
                to_email=booking.contact_email
            )

            logger.info(f"Payment failure processed. Email task queued.")
            return {
                "status": "failed",
                "booking_reference": booking.booking_reference,
                "error": payment.failure_message
            }

        elif event_type == "payment_intent.canceled":
            logger.info(f"Payment canceled for booking {booking.booking_reference}")

            payment.status = PaymentStatusEnum.CANCELLED
            booking.status = BookingStatusEnum.CANCELLED
            booking.updated_at = datetime.utcnow()

            db.commit()

            return {
                "status": "canceled",
                "booking_reference": booking.booking_reference
            }

        else:
            logger.info(f"Unhandled event type: {event_type}")
            return {"status": "ignored", "event_type": event_type}

    except Exception as e:
        logger.error(f"❌ Error processing payment webhook: {str(e)}")
        db.rollback()
        raise

    finally:
        db.close()


@celery_app.task(
    base=PaymentTask,
    name="app.tasks.payment_tasks.verify_payment_status",
    bind=True
)
def verify_payment_status_task(
    self,
    payment_intent_id: str
):
    """
    Verify payment status with Stripe (for manual verification or recovery).

    Args:
        payment_intent_id: Stripe payment intent ID

    Returns:
        Dict with payment status information
    """
    try:
        logger.info(f"Verifying payment status for {payment_intent_id}")

        # Retrieve payment intent from Stripe
        payment_intent = stripe.PaymentIntent.retrieve(payment_intent_id)

        logger.info(f"Payment status: {payment_intent.status}")

        return {
            "status": "success",
            "payment_intent_id": payment_intent_id,
            "payment_status": payment_intent.status,
            "amount": payment_intent.amount / 100,  # Convert from cents
            "currency": payment_intent.currency,
        }

    except stripe.StripeError as e:
        logger.error(f"❌ Stripe error verifying payment: {str(e)}")
        raise

    except Exception as e:
        logger.error(f"❌ Error verifying payment status: {str(e)}")
        raise
