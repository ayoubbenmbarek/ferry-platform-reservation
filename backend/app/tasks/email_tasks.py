"""
Celery tasks for sending emails asynchronously.

These tasks are decoupled from payment/booking logic and run in separate workers.
Failed emails are stored in a dead-letter queue for manual retry.
"""
import logging
import json
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from celery import Task
from app.celery_app import celery_app
from app.services.email_service import email_service

logger = logging.getLogger(__name__)

# Redis key for dead-letter queue
DEAD_LETTER_QUEUE_KEY = "email:dead_letter_queue"


def _get_redis_client():
    """Get Redis client for dead-letter queue operations."""
    import redis
    import os
    # Use Celery result backend URL, fallback to REDIS_URL, then default
    # Default uses container hostname "redis" (works inside Docker)
    redis_url = os.getenv("CELERY_RESULT_BACKEND") or os.getenv("REDIS_URL") or "redis://redis:6379/1"

    # Handle test environments that use memory:// URLs (not supported by redis-py)
    if redis_url.startswith("memory://"):
        # In test mode, skip Redis operations - return None and handle gracefully
        logger.warning("Memory URL detected for Redis - dead-letter queue operations will be skipped in test mode")
        return None

    return redis.from_url(redis_url)


class EmailTask(Task):
    """Base task for email sending with retry logic and dead-letter queue."""
    autoretry_for = (Exception,)
    retry_kwargs = {"max_retries": 5}  # Increased from 3 to 5 retries
    retry_backoff = True
    retry_backoff_max = 1800  # Increased to 30 minutes max between retries
    retry_jitter = True

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """
        Called when task fails after all retries exhausted.
        Stores failed email in dead-letter queue for manual retry.
        """
        try:
            redis_client = _get_redis_client()
            if redis_client is None:
                # Test mode - skip dead-letter queue
                logger.warning(f"Skipping dead-letter queue (test mode) for task {task_id}")
                super().on_failure(exc, task_id, args, kwargs, einfo)
                return

            failed_email = {
                "task_id": task_id,
                "task_name": self.name,
                "args": args,
                "kwargs": _serialize_kwargs(kwargs),
                "error": str(exc),
                "failed_at": datetime.now(timezone.utc).isoformat(),
                "retry_count": 0
            }

            # Add to dead-letter queue
            redis_client.lpush(DEAD_LETTER_QUEUE_KEY, json.dumps(failed_email, default=str))

            logger.error(
                f"📭 Email task {self.name} failed permanently after all retries. "
                f"Added to dead-letter queue. Task ID: {task_id}, Error: {exc}"
            )
        except Exception as dlq_error:
            logger.error(f"Failed to add email to dead-letter queue: {dlq_error}")

        super().on_failure(exc, task_id, args, kwargs, einfo)


def _serialize_kwargs(kwargs: Dict) -> Dict:
    """Serialize kwargs for JSON storage, handling datetime objects."""
    serialized = {}
    for key, value in kwargs.items():
        if isinstance(value, datetime):
            serialized[key] = value.isoformat()
        elif isinstance(value, dict):
            serialized[key] = _serialize_kwargs(value)
        elif isinstance(value, list):
            serialized[key] = [
                _serialize_kwargs(item) if isinstance(item, dict) else item
                for item in value
            ]
        else:
            serialized[key] = value
    return serialized


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

        success = email_service.send_booking_confirmation(
            booking_data=booking_data,
            to_email=to_email
        )

        if not success:
            raise Exception(f"Failed to send booking confirmation email to {to_email}")

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
    to_email: str,
    passengers: Optional[list] = None,
    vehicles: Optional[list] = None,
    meals: Optional[list] = None,
    generate_invoice: bool = True
):
    """
    Send payment success email asynchronously with optional invoice generation.

    Args:
        booking_data: Dict containing booking information
        payment_data: Dict containing payment information
        to_email: Recipient email address
        passengers: Optional list of passenger dictionaries
        vehicles: Optional list of vehicle dictionaries
        meals: Optional list of meal dictionaries
        generate_invoice: Whether to generate and attach invoice PDF (default: True)
    """
    try:
        logger.info(f"Sending payment success email to {to_email}")

        attachments = None

        # Generate invoice PDF asynchronously in Celery worker
        if generate_invoice:
            try:
                from app.services.invoice_service import invoice_service

                logger.info(f"📄 Generating invoice PDF for booking {booking_data.get('booking_reference')}")

                # Generate PDF in worker process
                pdf_content = invoice_service.generate_invoice(
                    booking=booking_data,
                    payment=payment_data,
                    passengers=passengers or [],
                    vehicles=vehicles or [],
                    meals=meals or []
                )

                # Create attachment
                attachments = [{
                    'content': pdf_content,
                    'filename': f"invoice_{booking_data.get('booking_reference')}.pdf",
                    'content_type': 'application/pdf'
                }]

                logger.info(f"✅ Invoice PDF generated successfully ({len(pdf_content)} bytes)")

            except Exception as invoice_error:
                logger.error(f"❌ Failed to generate invoice PDF: {str(invoice_error)}", exc_info=True)
                # Continue sending email without invoice
                logger.info("Continuing to send email without invoice attachment")

        # Send email with or without invoice
        success = email_service.send_payment_confirmation(
            booking_data=booking_data,
            payment_data=payment_data,
            to_email=to_email,
            attachments=attachments
        )

        if not success:
            raise Exception(f"Failed to send payment confirmation email to {to_email}")

        logger.info(f"✅ Payment success email sent successfully to {to_email}")
        return {"status": "success", "email": to_email, "invoice_attached": bool(attachments)}

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

        success = email_service.send_refund_confirmation(
            booking_data=booking_data,
            to_email=to_email
        )

        if not success:
            raise Exception(f"Failed to send refund confirmation email to {to_email}")

        logger.info(f"✅ Refund confirmation email sent successfully to {to_email}")
        return {"status": "success", "email": to_email, "refund_amount": booking_data.get("refund_amount")}

    except Exception as e:
        logger.error(f"❌ Failed to send refund confirmation email to {to_email}: {str(e)}")
        raise


@celery_app.task(
    base=EmailTask,
    name="app.tasks.email_tasks.send_cabin_upgrade_confirmation",
    bind=True
)
def send_cabin_upgrade_confirmation_email_task(
    self,
    booking_data: Dict[str, Any],
    cabin_data: Dict[str, Any],
    payment_data: Dict[str, Any],
    to_email: str
):
    """
    Send cabin upgrade confirmation email with separate cabin upgrade invoice.

    Args:
        booking_data: Dict containing booking information
        cabin_data: Dict containing cabin upgrade details (cabin_name, cabin_type, unit_price, total_price, quantity, journey_type)
        payment_data: Dict containing payment information
        to_email: Recipient email address
    """
    try:
        from app.services.invoice_service import invoice_service

        logger.info(f"Sending cabin upgrade confirmation email to {to_email} for booking {booking_data.get('booking_reference')}")

        # Generate separate cabin upgrade invoice
        pdf_content = invoice_service.generate_cabin_upgrade_invoice(
            booking=booking_data,
            cabin_data=cabin_data,
            payment=payment_data
        )

        # Build cabin upgrade email content
        journey_label = "Return" if cabin_data.get('journey_type') == 'return' else "Outbound"
        # Calculate tax
        subtotal = cabin_data.get('total_price', 0)
        tax_rate = 0.10  # 10% tax
        tax_amount = subtotal * tax_rate
        total_with_tax = subtotal + tax_amount
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #7c3aed, #6d28d9); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }}
                .content {{ background: #f8fafc; padding: 20px; border-radius: 0 0 8px 8px; }}
                .cabin-box {{ background: white; border: 2px solid #7c3aed; border-radius: 8px; padding: 15px; margin: 15px 0; }}
                .price {{ font-size: 24px; font-weight: bold; color: #7c3aed; }}
                .booking-ref {{ background: #ede9fe; padding: 10px; border-radius: 6px; text-align: center; margin: 15px 0; }}
                .footer {{ text-align: center; margin-top: 20px; color: #64748b; font-size: 12px; }}
                .invoice-note {{ background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 10px; margin-top: 15px; font-size: 13px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🛏️ Cabin Upgrade Confirmed!</h1>
                </div>
                <div class="content">
                    <p>Great news! Your cabin upgrade has been successfully added to your booking.</p>

                    <div class="booking-ref">
                        <p style="margin: 0; font-size: 12px; color: #64748b;">Original Booking Reference</p>
                        <p style="margin: 5px 0 0 0; font-size: 20px; font-weight: bold; color: #7c3aed;">{booking_data.get('booking_reference')}</p>
                    </div>

                    <div class="cabin-box">
                        <h3 style="margin-top: 0; color: #7c3aed;">Cabin Upgrade Details</h3>
                        <p><strong>Journey:</strong> {journey_label}</p>
                        <p><strong>Route:</strong> {booking_data.get('departure_port', '').title()} → {booking_data.get('arrival_port', '').title()}</p>
                        <p><strong>Cabin:</strong> {cabin_data.get('cabin_name', 'Cabin')} ({cabin_data.get('cabin_type', 'Standard')})</p>
                        <p><strong>Quantity:</strong> {cabin_data.get('quantity', 1)}</p>
                        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 15px 0;">
                        <p style="color: #666;">Subtotal: €{subtotal:.2f}</p>
                        <p style="color: #666;">Tax (10%): €{tax_amount:.2f}</p>
                        <p class="price">Amount Paid: €{total_with_tax:.2f}</p>
                    </div>

                    <div class="invoice-note">
                        📎 <strong>Cabin Upgrade Invoice Attached</strong><br>
                        A separate invoice for this cabin upgrade is attached to this email. This is independent of your original booking invoice.
                    </div>

                    <p style="text-align: center; margin-top: 25px;">
                        <a href="{cabin_data.get('booking_url', '#')}" style="background: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Your Booking</a>
                    </p>
                </div>
                <div class="footer">
                    <p>Thank you for choosing Maritime Reservations!</p>
                    <p style="font-size: 11px; color: #94a3b8;">This email confirms your cabin upgrade payment. Your original booking details remain unchanged.</p>
                </div>
            </div>
        </body>
        </html>
        """

        # Send email with cabin upgrade invoice attachment
        success = email_service.send_email_with_attachment(
            to_email=to_email,
            subject=f"🛏️ Cabin Upgrade Confirmed - Booking {booking_data.get('booking_reference')}",
            html_content=html_content,
            attachment_content=pdf_content,
            attachment_filename=f"cabin_upgrade_invoice_{booking_data.get('booking_reference')}.pdf",
            attachment_type="application/pdf"
        )

        if not success:
            raise Exception(f"Failed to send cabin upgrade confirmation email to {to_email}")

        logger.info(f"✅ Cabin upgrade confirmation email sent successfully to {to_email}")
        return {"status": "success", "email": to_email, "booking_ref": booking_data.get("booking_reference")}

    except Exception as e:
        logger.error(f"❌ Failed to send cabin upgrade confirmation email to {to_email}: {str(e)}")
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

        success = email_service.send_cancellation_confirmation(
            booking_data=booking_data,
            to_email=to_email
        )

        if not success:
            raise Exception(f"Failed to send cancellation email to {to_email}")

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
        success = email_service.send_email(
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

        if not success:
            raise Exception(f"Failed to send payment failed email to {to_email}")

        logger.info(f"✅ Payment failed email sent successfully to {to_email}")
        return {"status": "success", "email": to_email}

    except Exception as e:
        logger.error(f"❌ Failed to send payment failed email to {to_email}: {str(e)}")
        raise


@celery_app.task(
    base=EmailTask,
    name="app.tasks.email_tasks.send_email_verification",
    bind=True
)
def send_email_verification_task(
    self,
    email_data: Dict[str, Any],
    to_email: str
):
    """
    Send email verification link asynchronously.

    Args:
        email_data: Dict containing first_name, verification_link, base_url
        to_email: Recipient email address
    """
    try:
        logger.info(f"Sending email verification to {to_email}")

        success = email_service.send_email_verification(
            email_data=email_data,
            to_email=to_email
        )

        if not success:
            raise Exception(f"Failed to send verification email to {to_email}")

        logger.info(f"✅ Email verification sent successfully to {to_email}")
        return {"status": "success", "email": to_email}

    except Exception as e:
        logger.error(f"❌ Failed to send verification email to {to_email}: {str(e)}")
        raise



# =============================================================================
# Dead-Letter Queue Management Functions
# =============================================================================

def get_dead_letter_queue_stats() -> Dict[str, Any]:
    """
    Get statistics about the dead-letter queue.

    Returns:
        Dict with queue statistics
    """
    try:
        redis_client = _get_redis_client()
        if redis_client is None:
            return {"queue_length": 0, "recent_failures": [], "note": "Redis not available (test mode)"}
        queue_length = redis_client.llen(DEAD_LETTER_QUEUE_KEY)

        # Get sample of recent failures
        recent_failures = []
        if queue_length > 0:
            items = redis_client.lrange(DEAD_LETTER_QUEUE_KEY, 0, 9)  # Last 10
            for item in items:
                try:
                    data = json.loads(item)
                    recent_failures.append({
                        "task_name": data.get("task_name"),
                        "error": data.get("error", "")[:100],  # Truncate error
                        "failed_at": data.get("failed_at"),
                        "to_email": data.get("kwargs", {}).get("to_email")
                    })
                except json.JSONDecodeError:
                    pass

        return {
            "queue_length": queue_length,
            "recent_failures": recent_failures
        }
    except Exception as e:
        logger.error(f"Failed to get dead-letter queue stats: {e}")
        return {"queue_length": 0, "recent_failures": [], "error": str(e)}


def get_failed_emails(limit: int = 50) -> list:
    """
    Get all failed emails from the dead-letter queue.

    Args:
        limit: Maximum number of items to return

    Returns:
        List of failed email data
    """
    try:
        redis_client = _get_redis_client()
        if redis_client is None:
            return []
        items = redis_client.lrange(DEAD_LETTER_QUEUE_KEY, 0, limit - 1)
        failed_emails = []

        for idx, item in enumerate(items):
            try:
                data = json.loads(item)
                data["queue_index"] = idx
                failed_emails.append(data)
            except json.JSONDecodeError:
                pass

        return failed_emails
    except Exception as e:
        logger.error(f"Failed to get failed emails: {e}")
        return []


def retry_failed_email(queue_index: int) -> Dict[str, Any]:
    """
    Retry a specific failed email from the dead-letter queue.

    Args:
        queue_index: Index of the email in the queue (0 = most recent)

    Returns:
        Dict with retry result
    """
    try:
        redis_client = _get_redis_client()
        if redis_client is None:
            return {"status": "error", "message": "Redis not available (test mode)"}

        # Get the item at index
        item = redis_client.lindex(DEAD_LETTER_QUEUE_KEY, queue_index)
        if not item:
            return {"status": "error", "message": f"No item found at index {queue_index}"}

        data = json.loads(item)
        task_name = data.get("task_name")
        kwargs = data.get("kwargs", {})

        # Map task names to functions
        task_map = {
            "app.tasks.email_tasks.send_booking_confirmation": send_booking_confirmation_email_task,
            "app.tasks.email_tasks.send_payment_success": send_payment_success_email_task,
            "app.tasks.email_tasks.send_refund_confirmation": send_refund_confirmation_email_task,
            "app.tasks.email_tasks.send_cabin_upgrade_confirmation": send_cabin_upgrade_confirmation_email_task,
            "app.tasks.email_tasks.send_cancellation": send_cancellation_email_task,
            "app.tasks.email_tasks.send_payment_failed": send_payment_failed_email_task,
        }

        task_func = task_map.get(task_name)
        if not task_func:
            return {"status": "error", "message": f"Unknown task: {task_name}"}

        # Re-queue the task
        result = task_func.delay(**kwargs)

        # Remove from dead-letter queue (mark as retried by setting to empty)
        # Note: Redis doesn't support delete by index, so we mark and clean later
        redis_client.lset(DEAD_LETTER_QUEUE_KEY, queue_index, "__RETRIED__")
        redis_client.lrem(DEAD_LETTER_QUEUE_KEY, 1, "__RETRIED__")

        logger.info(f"📤 Retried failed email task {task_name}, new task ID: {result.id}")

        return {
            "status": "success",
            "message": f"Email task re-queued",
            "task_id": result.id,
            "task_name": task_name
        }

    except Exception as e:
        logger.error(f"Failed to retry email: {e}")
        return {"status": "error", "message": str(e)}


def retry_all_failed_emails() -> Dict[str, Any]:
    """
    Retry all failed emails in the dead-letter queue.

    Returns:
        Dict with retry results
    """
    try:
        redis_client = _get_redis_client()
        if redis_client is None:
            return {"status": "error", "message": "Redis not available (test mode)"}
        queue_length = redis_client.llen(DEAD_LETTER_QUEUE_KEY)
        if queue_length == 0:
            return {"status": "success", "message": "No failed emails to retry", "retried": 0}

        retried = 0
        errors = []

        # Process all items (from end to start to maintain indices)
        while True:
            item = redis_client.rpop(DEAD_LETTER_QUEUE_KEY)
            if not item:
                break

            try:
                data = json.loads(item)
                task_name = data.get("task_name")
                kwargs = data.get("kwargs", {})

                task_map = {
                    "app.tasks.email_tasks.send_booking_confirmation": send_booking_confirmation_email_task,
                    "app.tasks.email_tasks.send_payment_success": send_payment_success_email_task,
                    "app.tasks.email_tasks.send_refund_confirmation": send_refund_confirmation_email_task,
                    "app.tasks.email_tasks.send_cabin_upgrade_confirmation": send_cabin_upgrade_confirmation_email_task,
                    "app.tasks.email_tasks.send_cancellation": send_cancellation_email_task,
                    "app.tasks.email_tasks.send_payment_failed": send_payment_failed_email_task,
                }

                task_func = task_map.get(task_name)
                if task_func:
                    task_func.delay(**kwargs)
                    retried += 1
                else:
                    errors.append(f"Unknown task: {task_name}")

            except Exception as e:
                errors.append(str(e))

        logger.info(f"📤 Retried {retried} failed emails from dead-letter queue")

        return {
            "status": "success",
            "retried": retried,
            "errors": errors if errors else None
        }

    except Exception as e:
        logger.error(f"Failed to retry all emails: {e}")
        return {"status": "error", "message": str(e)}


def clear_dead_letter_queue() -> Dict[str, Any]:
    """
    Clear all items from the dead-letter queue.

    Returns:
        Dict with clear result
    """
    try:
        redis_client = _get_redis_client()
        if redis_client is None:
            return {"status": "error", "message": "Redis not available (test mode)"}
        count = redis_client.llen(DEAD_LETTER_QUEUE_KEY)
        redis_client.delete(DEAD_LETTER_QUEUE_KEY)

        logger.info(f"🗑️ Cleared {count} items from email dead-letter queue")

        return {"status": "success", "cleared": count}

    except Exception as e:
        logger.error(f"Failed to clear dead-letter queue: {e}")
        return {"status": "error", "message": str(e)}
