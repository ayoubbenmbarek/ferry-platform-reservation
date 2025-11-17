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
        for booking in expired_bookings:
            print(f"Expiring booking {booking.booking_reference}")
            booking.status = BookingStatusEnum.CANCELLED
            booking.cancellation_reason = "Booking expired - payment not received within 3 days"
            booking.cancelled_at = datetime.utcnow()
            expired_count += 1

        db.commit()

        print(f"✓ Expired {expired_count} pending booking(s)")
        return expired_count

    except Exception as e:
        db.rollback()
        print(f"✗ Error expiring bookings: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    expire_old_bookings()
