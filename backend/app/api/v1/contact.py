"""
Contact form API endpoint.
"""

from fastapi import APIRouter, HTTPException, status, BackgroundTasks
from pydantic import BaseModel, EmailStr
from typing import Optional
import logging
import os

logger = logging.getLogger(__name__)

router = APIRouter()


class ContactFormData(BaseModel):
    """Contact form submission data."""
    name: str
    email: EmailStr
    subject: str
    category: str
    message: str
    bookingReference: Optional[str] = None


@router.post("")
async def submit_contact_form(
    form_data: ContactFormData,
    background_tasks: BackgroundTasks,
):
    """
    Submit a contact form message.

    This endpoint receives contact form submissions and sends
    an email notification to the support team.
    """
    try:
        # Log the contact form submission
        logger.info(
            f"Contact form submission: "
            f"name={form_data.name}, "
            f"email={form_data.email}, "
            f"category={form_data.category}, "
            f"subject={form_data.subject}"
        )

        # Send notification email to support team
        background_tasks.add_task(
            send_contact_notification,
            form_data
        )

        return {
            "message": "Your message has been sent successfully. We'll get back to you within 24 hours.",
            "success": True
        }

    except Exception as e:
        logger.error(f"Error processing contact form: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send your message. Please try again later."
        )


async def send_contact_notification(form_data: ContactFormData):
    """
    Send email notification for contact form submission.
    """
    try:
        from app.services.email_service import email_service

        support_email = os.getenv("SUPPORT_EMAIL", "support@ferryreservation.com")

        # Build email content
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">
                    New Contact Form Submission
                </h2>

                <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>Category:</strong> {form_data.category.replace('_', ' ').title()}</p>
                    <p><strong>From:</strong> {form_data.name}</p>
                    <p><strong>Email:</strong> <a href="mailto:{form_data.email}">{form_data.email}</a></p>
                    {f'<p><strong>Booking Reference:</strong> {form_data.bookingReference}</p>' if form_data.bookingReference else ''}
                </div>

                <h3 style="color: #1e40af;">Subject</h3>
                <p style="background-color: #fff; padding: 15px; border-left: 4px solid #2563eb; margin: 10px 0;">
                    {form_data.subject}
                </p>

                <h3 style="color: #1e40af;">Message</h3>
                <div style="background-color: #fff; padding: 15px; border: 1px solid #e5e7eb; border-radius: 8px; white-space: pre-wrap;">
                    {form_data.message}
                </div>

                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280;">
                    <p>This message was sent via the Ferry Reservation contact form.</p>
                    <p>Reply directly to this email to respond to the customer.</p>
                </div>
            </div>
        </body>
        </html>
        """

        # Send email
        email_service.send_email(
            to_email=support_email,
            subject=f"[Contact Form] {form_data.category.title()}: {form_data.subject}",
            html_content=html_content,
            reply_to=form_data.email
        )

        # Also send auto-reply to customer
        auto_reply_html = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #2563eb;">Thank You for Contacting Us</h2>

                <p>Dear {form_data.name},</p>

                <p>Thank you for reaching out to Ferry Reservation. We have received your message and will get back to you within 24 hours.</p>

                <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #1e40af; margin-top: 0;">Your Message Summary</h3>
                    <p><strong>Subject:</strong> {form_data.subject}</p>
                    <p><strong>Category:</strong> {form_data.category.replace('_', ' ').title()}</p>
                    {f'<p><strong>Booking Reference:</strong> {form_data.bookingReference}</p>' if form_data.bookingReference else ''}
                </div>

                <p>In the meantime, you can:</p>
                <ul>
                    <li>Check our <a href="https://ferryreservation.com/faq" style="color: #2563eb;">FAQ section</a> for common questions</li>
                    <li>Use our 24/7 AI chatbot for instant assistance</li>
                    <li>Call us at +216 71 123 456 (Mon-Fri, 8am-6pm CET)</li>
                </ul>

                <p>Best regards,<br>The Ferry Reservation Team</p>

                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280;">
                    <p>This is an automated response. Please do not reply to this email.</p>
                </div>
            </div>
        </body>
        </html>
        """

        email_service.send_email(
            to_email=form_data.email,
            subject="We've Received Your Message - Ferry Reservation",
            html_content=auto_reply_html
        )

        logger.info(f"Contact form emails sent successfully for {form_data.email}")

    except Exception as e:
        logger.error(f"Failed to send contact notification email: {str(e)}", exc_info=True)
