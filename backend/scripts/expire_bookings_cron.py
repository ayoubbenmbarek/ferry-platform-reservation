#!/usr/bin/env python3
"""
Cron script to expire old pending bookings.

This script should be run periodically (e.g., every hour) to automatically
cancel bookings that haven't been paid within 3 days.

Add to crontab:
0 * * * * cd /path/to/backend && python scripts/expire_bookings_cron.py

Or run manually:
python scripts/expire_bookings_cron.py
"""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from datetime import datetime
from app.database import SessionLocal
from app.models.booking import Booking, BookingStatusEnum
from app.services.email_service import email_service


def expire_old_bookings():
    """Expire pending bookings that have passed their expiration time."""
    db = SessionLocal()

    try:
        # Find all pending bookings that have expired
        expired_bookings = db.query(Booking).filter(
            Booking.status == BookingStatusEnum.PENDING,
            Booking.expires_at != None,
            Booking.expires_at < datetime.utcnow()
        ).all()

        expired_count = 0
        emails_sent = 0

        for booking in expired_bookings:
            print(f"Expiring booking {booking.booking_reference}")
            booking.status = BookingStatusEnum.CANCELLED
            booking.cancellation_reason = "Booking expired - payment not received within 30 minutes"
            booking.cancelled_at = datetime.utcnow()
            expired_count += 1

            # Send cancellation email
            try:
                booking_data = {
                    'booking_reference': booking.booking_reference,
                    'departure_port': booking.departure_port,
                    'arrival_port': booking.arrival_port,
                    'operator': booking.operator,
                    'vessel_name': booking.vessel_name,
                    'departure_time': booking.departure_time,
                    'arrival_time': booking.arrival_time,
                    'contact_first_name': booking.contact_first_name,
                    'contact_last_name': booking.contact_last_name,
                    'contact_email': booking.contact_email,
                    'total_passengers': booking.total_passengers,
                    'total_vehicles': booking.total_vehicles,
                    'total_amount': booking.total_amount,
                    'cancellation_reason': booking.cancellation_reason,
                    'cancelled_at': booking.cancelled_at,
                }

                if email_service.send_cancellation_confirmation(
                    booking_data=booking_data,
                    to_email=booking.contact_email
                ):
                    emails_sent += 1
                    print(f"  ✓ Sent cancellation email to {booking.contact_email}")
                else:
                    print(f"  ✗ Failed to send email to {booking.contact_email}")

            except Exception as email_error:
                print(f"  ✗ Email error for {booking.booking_reference}: {email_error}")

        db.commit()

        print(f"✓ Expired {expired_count} pending booking(s)")
        print(f"✓ Sent {emails_sent} cancellation email(s)")
        return expired_count

    except Exception as e:
        db.rollback()
        print(f"✗ Error expiring bookings: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    expire_old_bookings()
