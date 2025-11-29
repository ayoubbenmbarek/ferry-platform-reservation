"""
Email service for sending booking confirmations and notifications.
"""
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.image import MIMEImage
from email.mime.base import MIMEBase
from email import encoders
from typing import Dict, Any, Optional, List
from jinja2 import Environment, FileSystemLoader, select_autoescape
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

class EmailService:
    """Service for handling email notifications."""

    def __init__(self):
        self.smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_username = os.getenv("SMTP_USERNAME", "")
        self.smtp_password = os.getenv("SMTP_PASSWORD", "")
        self.from_email = os.getenv("FROM_EMAIL", "noreply@maritime-booking.com")
        self.from_name = os.getenv("FROM_NAME", "Maritime Booking System")
        # Base URL for links in emails (frontend URL)
        self.base_url = os.getenv("FRONTEND_URL", os.getenv("BASE_URL", "http://localhost:3001"))

        # Setup Jinja2 for email templates
        template_dir = Path(__file__).parent.parent / "templates" / "emails"
        template_dir.mkdir(parents=True, exist_ok=True)

        self.jinja_env = Environment(
            loader=FileSystemLoader(str(template_dir)),
            autoescape=select_autoescape(['html', 'xml'])
        )

    def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
        attachments: Optional[List[Dict[str, Any]]] = None
    ) -> bool:
        """
        Send an email.

        Args:
            to_email: Recipient email address
            subject: Email subject
            html_content: HTML email content
            text_content: Plain text email content (fallback)
            attachments: List of attachment dictionaries

        Returns:
            bool: True if email sent successfully, False otherwise
        """
        try:
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = f"{self.from_name} <{self.from_email}>"
            msg['To'] = to_email

            # Add text and HTML parts
            if text_content:
                part1 = MIMEText(text_content, 'plain')
                msg.attach(part1)

            part2 = MIMEText(html_content, 'html')
            msg.attach(part2)

            # Add attachments if any
            if attachments:
                for attachment in attachments:
                    self._add_attachment(msg, attachment)

            # Send email
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                if self.smtp_username and self.smtp_password:
                    server.login(self.smtp_username, self.smtp_password)
                server.send_message(msg)

            logger.info(f"Email sent successfully to {to_email}")
            return True

        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {str(e)}")
            return False

    def _add_attachment(self, msg: MIMEMultipart, attachment: Dict[str, Any]):
        """
        Add an attachment to the email message.

        Args:
            msg: The email message
            attachment: Dictionary with 'content' (bytes), 'filename', and 'content_type'
        """
        try:
            content = attachment.get('content')
            filename = attachment.get('filename', 'attachment')
            content_type = attachment.get('content_type', 'application/octet-stream')

            # Create attachment part
            main_type, sub_type = content_type.split('/', 1)

            part = MIMEBase(main_type, sub_type)
            part.set_payload(content)
            encoders.encode_base64(part)

            part.add_header(
                'Content-Disposition',
                f'attachment; filename="{filename}"'
            )

            msg.attach(part)

        except Exception as e:
            logger.error(f"Failed to add attachment: {str(e)}")

    def send_email_with_attachment(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        attachment_content: bytes,
        attachment_filename: str,
        attachment_type: str = "application/pdf",
        text_content: Optional[str] = None
    ) -> bool:
        """
        Convenience method to send an email with a single attachment.

        Args:
            to_email: Recipient email address
            subject: Email subject
            html_content: HTML email content
            attachment_content: Binary content of the attachment
            attachment_filename: Name for the attachment file
            attachment_type: MIME type of the attachment (default: application/pdf)
            text_content: Plain text email content (fallback)

        Returns:
            bool: True if email sent successfully, False otherwise
        """
        attachments = [{
            'content': attachment_content,
            'filename': attachment_filename,
            'content_type': attachment_type
        }]

        return self.send_email(
            to_email=to_email,
            subject=subject,
            html_content=html_content,
            text_content=text_content,
            attachments=attachments
        )

    def send_booking_confirmation(
        self,
        booking_data: Dict[str, Any],
        to_email: str
    ) -> bool:
        """
        Send booking confirmation email.

        Args:
            booking_data: Dictionary containing booking information
            to_email: Recipient email address

        Returns:
            bool: True if email sent successfully
        """
        try:
            template = self.jinja_env.get_template('booking_confirmation.html')
            # Use base_url from booking_data if provided, otherwise use service default
            base_url = booking_data.get('base_url', self.base_url)
            html_content = template.render(booking=booking_data, base_url=base_url)

            subject = f"Reservation Confirmed - {booking_data['booking_reference']}"

            return self.send_email(
                to_email=to_email,
                subject=subject,
                html_content=html_content
            )
        except Exception as e:
            logger.error(f"Failed to send booking confirmation: {str(e)}")
            return False

    def send_payment_confirmation(
        self,
        booking_data: Dict[str, Any],
        payment_data: Dict[str, Any],
        to_email: str,
        attachments: Optional[List[Dict[str, Any]]] = None
    ) -> bool:
        """
        Send payment confirmation email.

        Args:
            booking_data: Dictionary containing booking information
            payment_data: Dictionary containing payment information
            to_email: Recipient email address
            attachments: Optional list of attachments (e.g., invoice PDF)

        Returns:
            bool: True if email sent successfully
        """
        try:
            template = self.jinja_env.get_template('payment_confirmation.html')
            # Use base_url from booking_data if provided, otherwise use service default
            base_url = booking_data.get('base_url', self.base_url)
            html_content = template.render(
                booking=booking_data,
                payment=payment_data,
                base_url=base_url
            )

            subject = f"Payment Confirmation - {booking_data['booking_reference']}"

            return self.send_email(
                to_email=to_email,
                subject=subject,
                html_content=html_content,
                attachments=attachments
            )
        except Exception as e:
            logger.error(f"Failed to send payment confirmation: {str(e)}")
            return False

    def send_cancellation_confirmation(
        self,
        booking_data: Dict[str, Any],
        to_email: str
    ) -> bool:
        """
        Send booking cancellation confirmation email.

        Args:
            booking_data: Dictionary containing booking information
            to_email: Recipient email address

        Returns:
            bool: True if email sent successfully
        """
        try:
            template = self.jinja_env.get_template('cancellation_confirmation.html')
            # Use base_url from booking_data if provided, otherwise use service default
            base_url = booking_data.get('base_url', self.base_url)
            html_content = template.render(booking=booking_data, base_url=base_url)

            subject = f"Booking Cancellation - {booking_data['booking_reference']}"

            return self.send_email(
                to_email=to_email,
                subject=subject,
                html_content=html_content
            )
        except Exception as e:
            logger.error(f"Failed to send cancellation confirmation: {str(e)}")
            return False

    def send_departure_reminder(
        self,
        booking_data: Dict[str, Any],
        to_email: str
    ) -> bool:
        """
        Send departure reminder email (24 hours before departure).

        Args:
            booking_data: Dictionary containing booking information
            to_email: Recipient email address

        Returns:
            bool: True if email sent successfully
        """
        try:
            template = self.jinja_env.get_template('departure_reminder.html')
            html_content = template.render(booking=booking_data)

            subject = f"Departure Reminder - {booking_data['booking_reference']}"

            return self.send_email(
                to_email=to_email,
                subject=subject,
                html_content=html_content
            )
        except Exception as e:
            logger.error(f"Failed to send departure reminder: {str(e)}")
            return False

    def send_refund_confirmation(
        self,
        booking_data: Dict[str, Any],
        to_email: str
    ) -> bool:
        """
        Send refund confirmation email.

        Args:
            booking_data: Dictionary containing booking and refund information
            to_email: Recipient email address

        Returns:
            bool: True if email sent successfully
        """
        try:
            template = self.jinja_env.get_template('refund_confirmation.html')
            # Use base_url from booking_data if provided, otherwise use service default
            base_url = booking_data.get('base_url', self.base_url)
            html_content = template.render(booking=booking_data, base_url=base_url)

            subject = f"Refund Processed - {booking_data['booking_reference']}"

            return self.send_email(
                to_email=to_email,
                subject=subject,
                html_content=html_content
            )
        except Exception as e:
            logger.error(f"Failed to send refund confirmation: {str(e)}")
            return False

    def send_password_reset(
        self,
        email_data: Dict[str, Any],
        to_email: str
    ) -> bool:
        """
        Send password reset email.

        Args:
            email_data: Dictionary containing reset link and user info
            to_email: Recipient email address

        Returns:
            bool: True if email sent successfully
        """
        try:
            template = self.jinja_env.get_template('password_reset.html')
            html_content = template.render(data=email_data)

            subject = "Reset Your Password - Maritime Booking"

            return self.send_email(
                to_email=to_email,
                subject=subject,
                html_content=html_content
            )
        except Exception as e:
            logger.error(f"Failed to send password reset email: {str(e)}")
            return False

    def send_email_verification(
        self,
        email_data: Dict[str, Any],
        to_email: str
    ) -> bool:
        """
        Send email verification link.

        Args:
            email_data: Dictionary containing verification link and user info
            to_email: Recipient email address

        Returns:
            bool: True if email sent successfully
        """
        try:
            template = self.jinja_env.get_template('email_verification.html')
            html_content = template.render(data=email_data)

            subject = "Verify Your Email - Maritime Booking"

            return self.send_email(
                to_email=to_email,
                subject=subject,
                html_content=html_content
            )
        except Exception as e:
            logger.error(f"Failed to send email verification: {str(e)}")
            return False

    def send_availability_alert(
        self,
        alert_data: Dict[str, Any],
        to_email: str
    ) -> bool:
        """
        Send availability alert notification email.

        Args:
            alert_data: Alert information including route, dates, type
            to_email: Recipient email address

        Returns:
            bool: True if email sent successfully
        """
        try:
            # Render email template
            template = self.jinja_env.get_template("availability_alert.html")
            html_content = template.render(alert=alert_data)

            # Determine subject based on alert type
            alert_type_names = {
                "vehicle": "Vehicle Space",
                "cabin": "Cabin",
                "passenger": "Passenger Seats"
            }
            type_name = alert_type_names.get(alert_data.get("alert_type", ""), "Space")

            subject = f"🎉 {type_name} Now Available: {alert_data['departure_port']} → {alert_data['arrival_port']}"

            return self.send_email(
                to_email=to_email,
                subject=subject,
                html_content=html_content
            )
        except Exception as e:
            logger.error(f"Failed to send availability alert: {str(e)}")
            return False


# Singleton instance
email_service = EmailService()