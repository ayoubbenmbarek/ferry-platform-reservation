"""
Celery tasks for async processing.
"""

# Import tasks to register them with Celery
# These imports happen when Celery worker starts

__all__ = [
    # Email tasks
    "send_booking_confirmation_email_task",
    "send_payment_success_email_task",
    "send_refund_confirmation_email_task",
    "send_cancellation_email_task",
    "send_email_verification_task",
    # Payment tasks
    "process_payment_webhook_task",
    "verify_payment_status_task",
    # Booking tasks
    "check_ferry_availability_task",
    "confirm_booking_with_operator_task",
]
