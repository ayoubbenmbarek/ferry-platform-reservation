"""
Celery tasks for sending emails asynchronously.

These tasks are decoupled from payment/booking logic and run in separate workers.
"""
import logging
from typing import Dict, Any
from celery import Task
from app.celery_app import celery_app
from app.services.email_service import email_service

logger = logging.getLogger(__name__)


class EmailTask(Task):
    """Base task for email sending with retry logic."""
    autoretry_for = (Exception,)
    retry_kwargs = {"max_retries": 3}
    retry_backoff = True
    retry_backoff_max = 600  # 10 minutes
    retry_jitter = True


@celery_app.task(
    base=EmailTask,
    name="app.tasks.email_tasks.send_booking_confirmation",
    bind=True
)
def send_booking_confirmation_email_task(
    self,
    booking_data: Dict[str, Any],
    to_email: str
):
    """
    Send booking confirmation email asynchronously.

    Args:
        booking_data: Dict containing booking information
        to_email: Recipient email address

    Retries automatically on failure with exponential backoff.
    """
    try:
        logger.info(f"Sending booking confirmation email to {to_email} for booking {booking_data.get('booking_reference')}")

        email_service.send_booking_confirmation(
            booking_data=booking_data,
            to_email=to_email
        )

        logger.info(f"✅ Booking confirmation email sent successfully to {to_email}")
        return {"status": "success", "email": to_email, "booking_ref": booking_data.get("booking_reference")}

    except Exception as e:
        logger.error(f"❌ Failed to send booking confirmation email to {to_email}: {str(e)}")
        # Celery will automatically retry based on autoretry_for configuration
        raise


@celery_app.task(
    base=EmailTask,
    name="app.tasks.email_tasks.send_payment_success",
    bind=True
)
def send_payment_success_email_task(
    self,
    booking_data: Dict[str, Any],
    payment_data: Dict[str, Any],
    to_email: str
):
    """
    Send payment success email asynchronously.

    Args:
        booking_data: Dict containing booking information
        payment_data: Dict containing payment information
        to_email: Recipient email address
    """
    try:
        logger.info(f"Sending payment success email to {to_email}")

        email_service.send_payment_confirmation(
            booking_data=booking_data,
            payment_data=payment_data,
            to_email=to_email
        )

        logger.info(f"✅ Payment success email sent successfully to {to_email}")
        return {"status": "success", "email": to_email}

    except Exception as e:
        logger.error(f"❌ Failed to send payment success email to {to_email}: {str(e)}")
        raise


@celery_app.task(
    base=EmailTask,
    name="app.tasks.email_tasks.send_refund_confirmation",
    bind=True
)
def send_refund_confirmation_email_task(
    self,
    booking_data: Dict[str, Any],
    to_email: str
):
    """
    Send refund confirmation email asynchronously.

    Args:
        booking_data: Dict containing booking and refund information
        to_email: Recipient email address
    """
    try:
        logger.info(f"Sending refund confirmation email to {to_email} for booking {booking_data.get('booking_reference')}")

        email_service.send_refund_confirmation(
            booking_data=booking_data,
            to_email=to_email
        )

        logger.info(f"✅ Refund confirmation email sent successfully to {to_email}")
        return {"status": "success", "email": to_email, "refund_amount": booking_data.get("refund_amount")}

    except Exception as e:
        logger.error(f"❌ Failed to send refund confirmation email to {to_email}: {str(e)}")
        raise


@celery_app.task(
    base=EmailTask,
    name="app.tasks.email_tasks.send_cancellation",
    bind=True
)
def send_cancellation_email_task(
    self,
    booking_data: Dict[str, Any],
    to_email: str
):
    """
    Send booking cancellation email asynchronously.

    Args:
        booking_data: Dict containing booking and cancellation information
        to_email: Recipient email address
    """
    try:
        logger.info(f"Sending cancellation email to {to_email} for booking {booking_data.get('booking_reference')}")

        email_service.send_cancellation_confirmation(
            booking_data=booking_data,
            to_email=to_email
        )

        logger.info(f"✅ Cancellation email sent successfully to {to_email}")
        return {"status": "success", "email": to_email}

    except Exception as e:
        logger.error(f"❌ Failed to send cancellation email to {to_email}: {str(e)}")
        raise


@celery_app.task(
    base=EmailTask,
    name="app.tasks.email_tasks.send_payment_failed",
    bind=True
)
def send_payment_failed_email_task(
    self,
    booking_data: Dict[str, Any],
    error_message: str,
    to_email: str
):
    """
    Send payment failed notification email asynchronously.

    Args:
        booking_data: Dict containing booking information
        error_message: Error message from payment processor
        to_email: Recipient email address
    """
    try:
        logger.info(f"Sending payment failed email to {to_email}")

        # You can create a specific email template for payment failures
        # For now, we'll use a simple notification
        email_service.send_email(
            to_email=to_email,
            subject=f"Payment Failed - Booking {booking_data.get('booking_reference')}",
            html_content=f"""
            <h2>Payment Failed</h2>
            <p>We were unable to process your payment for booking {booking_data.get('booking_reference')}.</p>
            <p><strong>Error:</strong> {error_message}</p>
            <p>Please try again or contact support for assistance.</p>
            """,
            text_content=f"Payment failed for booking {booking_data.get('booking_reference')}: {error_message}"
        )

        logger.info(f"✅ Payment failed email sent successfully to {to_email}")
        return {"status": "success", "email": to_email}

    except Exception as e:
        logger.error(f"❌ Failed to send payment failed email to {to_email}: {str(e)}")
        raise
