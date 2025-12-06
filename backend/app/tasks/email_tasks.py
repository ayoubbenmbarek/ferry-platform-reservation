"""
Celery tasks for sending emails asynchronously.

These tasks are decoupled from payment/booking logic and run in separate workers.
"""
import logging
from typing import Dict, Any, Optional
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
        email_service.send_payment_confirmation(
            booking_data=booking_data,
            payment_data=payment_data,
            to_email=to_email,
            attachments=attachments
        )

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
        email_service.send_email_with_attachment(
            to_email=to_email,
            subject=f"🛏️ Cabin Upgrade Confirmed - Booking {booking_data.get('booking_reference')}",
            html_content=html_content,
            attachment_content=pdf_content,
            attachment_filename=f"cabin_upgrade_invoice_{booking_data.get('booking_reference')}.pdf",
            attachment_type="application/pdf"
        )

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
