"""
Email service for sending booking confirmations and notifications.
"""
import os
import smtplib
from datetime import datetime
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


def format_datetime(value, fmt='%B %d, %Y at %H:%M'):
    """Jinja2 filter to format datetime - handles both datetime objects and ISO strings."""
    if value is None:
        return 'N/A'
    if isinstance(value, str):
        try:
            # Parse ISO format string
            value = datetime.fromisoformat(value.replace('Z', '+00:00'))
        except (ValueError, AttributeError):
            return value
    if isinstance(value, datetime):
        return value.strftime(fmt)
    return str(value)

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
        # Add custom filter for datetime formatting (handles both datetime objects and ISO strings)
        self.jinja_env.filters['format_datetime'] = format_datetime

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
        to_email: str,
        reminder_type: str = "24h",
        journey_type: str = "outbound",
        passengers: List[Dict[str, Any]] = None,
        eticket_pdf: bytes = None,
    ) -> bool:
        """
        Send departure reminder email with optional E-Ticket attachment.

        Args:
            booking_data: Dictionary containing booking information
            to_email: Recipient email address
            reminder_type: "24h" or "2h" reminder
            journey_type: "outbound" or "return" journey
            passengers: List of passenger dictionaries
            eticket_pdf: E-Ticket PDF bytes to attach

        Returns:
            bool: True if email sent successfully
        """
        try:
            from datetime import datetime
            template = self.jinja_env.get_template('departure_reminder.html')

            # Prepare template context
            context = {
                'booking': booking_data,
                'reminder_type': reminder_type,
                'journey_type': journey_type,
                'passengers': passengers or [],
                'has_eticket': eticket_pdf is not None,
                'base_url': booking_data.get('base_url', self.base_url),
                'eticket_url': f"{self.base_url}/bookings/{booking_data.get('booking_reference')}/eticket",
                'current_year': datetime.now().year,
            }

            html_content = template.render(**context)

            # Determine subject based on reminder type
            if reminder_type == "24h":
                subject = f"Departure Tomorrow - {booking_data['booking_reference']}"
            else:
                subject = f"Departing in 2 Hours - {booking_data['booking_reference']}"

            # Prepare attachments if E-Ticket provided
            attachments = None
            if eticket_pdf:
                attachments = [{
                    'content': eticket_pdf,
                    'filename': f"eticket-{booking_data['booking_reference']}.pdf",
                    'content_type': 'application/pdf'
                }]

            return self.send_email(
                to_email=to_email,
                subject=subject,
                html_content=html_content,
                attachments=attachments
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

    def send_cabin_upgrade_confirmation(
        self,
        booking_data: Dict[str, Any],
        cabin_data: Dict[str, Any],
        to_email: str,
        invoice_pdf: Optional[bytes] = None
    ) -> bool:
        """
        Send cabin upgrade confirmation email with invoice.

        Args:
            booking_data: Original booking information
            cabin_data: Cabin upgrade details (cabin_name, quantity, price, journey_type)
            to_email: Recipient email address
            invoice_pdf: Optional PDF invoice bytes

        Returns:
            bool: True if email sent successfully
        """
        try:
            booking_ref = booking_data.get('booking_reference', 'N/A')
            cabin_name = cabin_data.get('cabin_name', 'Cabin')
            quantity = cabin_data.get('quantity', 1)
            journey_type = cabin_data.get('journey_type', 'outbound')
            total_price = cabin_data.get('total_price', 0)

            # Build HTML content
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                    .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                    .header {{ background: linear-gradient(135deg, #7c3aed, #a855f7); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
                    .content {{ background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }}
                    .cabin-box {{ background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #7c3aed; }}
                    .price {{ font-size: 24px; font-weight: bold; color: #7c3aed; }}
                    .journey-badge {{ display: inline-block; background: #e9d5ff; color: #7c3aed; padding: 4px 12px; border-radius: 20px; font-size: 12px; }}
                    .footer {{ text-align: center; color: #666; font-size: 12px; margin-top: 20px; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🛏️ Cabin Added Successfully!</h1>
                        <p>Your cabin upgrade has been confirmed</p>
                    </div>
                    <div class="content">
                        <p>Dear {booking_data.get('contact_first_name', 'Customer')},</p>
                        <p>Great news! Your cabin upgrade for booking <strong>#{booking_ref}</strong> has been successfully processed.</p>

                        <div class="cabin-box">
                            <span class="journey-badge">{'Return' if journey_type == 'return' else 'Outbound'} Journey</span>
                            <h3 style="margin: 10px 0 5px 0;">{cabin_name}</h3>
                            <p style="margin: 0; color: #666;">Quantity: {quantity}</p>
                            <p class="price" style="margin: 15px 0 0 0;">€{total_price:.2f}</p>
                        </div>

                        <h3>Journey Details</h3>
                        <p>
                            <strong>Route:</strong> {booking_data.get('departure_port', '')} → {booking_data.get('arrival_port', '')}<br>
                            <strong>Departure:</strong> {booking_data.get('departure_time', 'N/A')}<br>
                            <strong>Vessel:</strong> {booking_data.get('vessel_name', 'N/A')}
                        </p>

                        <p>Your cabin upgrade invoice is attached to this email.</p>

                        <p>Thank you for choosing our ferry service!</p>
                    </div>
                    <div class="footer">
                        <p>Maritime Booking System | support@maritime-booking.com</p>
                    </div>
                </div>
            </body>
            </html>
            """

            subject = f"🛏️ Cabin Added to Booking #{booking_ref}"

            if invoice_pdf:
                return self.send_email_with_attachment(
                    to_email=to_email,
                    subject=subject,
                    html_content=html_content,
                    attachment_content=invoice_pdf,
                    attachment_filename=f"cabin_upgrade_invoice_{booking_ref}.pdf",
                    attachment_type="application/pdf"
                )
            else:
                return self.send_email(
                    to_email=to_email,
                    subject=subject,
                    html_content=html_content
                )
        except Exception as e:
            logger.error(f"Failed to send cabin upgrade confirmation: {str(e)}")
            return False

    def send_price_alert(
        self,
        alert_data: Dict[str, Any],
        to_email: str
    ) -> bool:
        """
        Send price change alert notification email.

        Args:
            alert_data: Alert information including route, prices, change details
            to_email: Recipient email address

        Returns:
            bool: True if email sent successfully
        """
        try:
            is_drop = alert_data.get("is_price_drop", True)
            old_price = alert_data.get("old_price", 0)
            new_price = alert_data.get("new_price", 0)
            price_change_percent = alert_data.get("price_change_percent", 0)
            departure_port = alert_data.get("departure_port", "")
            arrival_port = alert_data.get("arrival_port", "")
            search_url = alert_data.get("search_url", "")
            notification_reason = alert_data.get("notification_reason", "")
            lowest_price = alert_data.get("lowest_price")
            target_price = alert_data.get("target_price")
            best_date = alert_data.get("best_date")  # Date with the best price
            date_from = alert_data.get("date_from")
            date_to = alert_data.get("date_to")

            # Format best date for display
            best_date_display = ""
            if best_date:
                from datetime import datetime
                try:
                    best_date_obj = datetime.fromisoformat(best_date) if isinstance(best_date, str) else best_date
                    best_date_display = best_date_obj.strftime("%A, %B %d, %Y")  # e.g., "Friday, December 7, 2025"
                except:
                    best_date_display = str(best_date)

            # Format date range for display
            date_range_display = ""
            if date_from and date_to:
                try:
                    from_obj = datetime.fromisoformat(date_from) if isinstance(date_from, str) else date_from
                    to_obj = datetime.fromisoformat(date_to) if isinstance(date_to, str) else date_to
                    date_range_display = f"{from_obj.strftime('%b %d')} - {to_obj.strftime('%b %d, %Y')}"
                except:
                    date_range_display = f"{date_from} - {date_to}"

            if is_drop:
                emoji = "📉"
                color = "#22c55e"  # Green
                change_text = f"dropped by {price_change_percent:.1f}%"
                action_text = "Book now to lock in this great price!"
            else:
                emoji = "📈"
                color = "#ef4444"  # Red
                change_text = f"increased by {price_change_percent:.1f}%"
                action_text = "Consider booking soon if prices continue to rise."

            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                    .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                    .header {{ background: linear-gradient(135deg, #0369a1 0%, #0284c7 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }}
                    .content {{ background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px; }}
                    .price-box {{ background: white; padding: 25px; border-radius: 12px; margin: 20px 0; border: 2px solid {color}; text-align: center; }}
                    .route {{ font-size: 20px; font-weight: bold; color: #1e293b; margin-bottom: 15px; }}
                    .price-change {{ display: flex; justify-content: center; align-items: center; gap: 20px; margin: 20px 0; }}
                    .old-price {{ font-size: 24px; color: #94a3b8; text-decoration: line-through; }}
                    .new-price {{ font-size: 32px; font-weight: bold; color: {color}; }}
                    .arrow {{ font-size: 24px; color: {color}; }}
                    .change-badge {{ display: inline-block; background: {color}; color: white; padding: 8px 16px; border-radius: 20px; font-weight: bold; font-size: 14px; }}
                    .cta-button {{ display: inline-block; background: {color}; color: white; padding: 15px 30px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 20px 0; }}
                    .stats {{ display: flex; justify-content: space-around; margin: 20px 0; padding: 15px; background: #f1f5f9; border-radius: 8px; }}
                    .stat {{ text-align: center; }}
                    .stat-value {{ font-size: 18px; font-weight: bold; color: #0369a1; }}
                    .stat-label {{ font-size: 12px; color: #64748b; }}
                    .footer {{ text-align: center; color: #94a3b8; font-size: 12px; margin-top: 30px; }}
                    .footer a {{ color: #0369a1; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>{emoji} Price Alert</h1>
                        <p>Price has {change_text}</p>
                    </div>
                    <div class="content">
                        <div class="price-box">
                            <div class="route">{departure_port} → {arrival_port}</div>
                            {f'<div style="color: #64748b; font-size: 14px; margin-bottom: 10px;">📅 Tracking: {date_range_display}</div>' if date_range_display else ''}
                            <div class="price-change">
                                <span class="old-price">€{old_price:.0f}</span>
                                <span class="arrow">→</span>
                                <span class="new-price">€{new_price:.0f}</span>
                            </div>
                            <div class="change-badge">{emoji} {change_text.upper()}</div>
                            {f'<div style="margin-top: 15px; padding: 12px; background: #ecfdf5; border-radius: 8px; border: 1px solid #86efac;"><span style="font-size: 14px; color: #166534;">🎯 <strong>Best price on:</strong> {best_date_display}</span></div>' if best_date_display else ''}
                        </div>

                        <p style="text-align: center; font-size: 16px;">{action_text}</p>

                        <div style="text-align: center;">
                            <a href="{search_url}" class="cta-button">Search Ferries Now</a>
                        </div>

                        {"<div class='stats'>" + f"<div class='stat'><div class='stat-value'>€{lowest_price:.0f}</div><div class='stat-label'>Lowest Price</div></div>" if lowest_price else ""}
                        {"<div class='stat'><div class='stat-value'>€" + f"{target_price:.0f}</div><div class='stat-label'>Your Target</div></div></div>" if target_price else ("</div>" if lowest_price else "")}

                        <p style="margin-top: 30px; color: #64748b; font-size: 14px;">
                            {notification_reason}
                        </p>
                    </div>
                    <div class="footer">
                        <p>You're receiving this because you saved this route for price alerts.</p>
                        <p><a href="{search_url.split('?')[0].replace('/search', '/saved-routes')}">Manage your saved routes</a></p>
                        <p>Maritime Booking System | support@maritime-booking.com</p>
                    </div>
                </div>
            </body>
            </html>
            """

            if is_drop:
                if best_date_display:
                    # Include the best date in subject for clarity
                    short_date = best_date_display.split(",")[0] + "," + best_date_display.split(",")[1][:7]  # e.g., "Friday, Dec 7"
                    subject = f"{emoji} Price Drop! {departure_port} → {arrival_port} €{new_price:.0f} on {short_date}"
                else:
                    subject = f"{emoji} Price Drop! {departure_port} → {arrival_port} now €{new_price:.0f}"
            else:
                subject = f"{emoji} Price Alert: {departure_port} → {arrival_port} now €{new_price:.0f}"

            return self.send_email(
                to_email=to_email,
                subject=subject,
                html_content=html_content
            )
        except Exception as e:
            logger.error(f"Failed to send price alert: {str(e)}")
            return False


# Singleton instance
email_service = EmailService()