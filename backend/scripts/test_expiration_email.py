#!/usr/bin/env python3
"""
Test script to create a booking that expires immediately and test email sending.
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from datetime import datetime, timedelta
from app.database import SessionLocal
from app.models.booking import Booking, BookingStatusEnum
from scripts.expire_bookings_cron import expire_old_bookings


def create_test_booking():
    """Create a test booking that expires immediately."""
    db = SessionLocal()

    try:
        # Create a test booking
        test_booking = Booking(
            user_id=1,
            schedule_id=1,
            sailing_id=1,
            operator="Test Operator",
            departure_port="Test Port A",
            arrival_port="Test Port B",
            departure_time=datetime.utcnow() + timedelta(days=7),
            arrival_time=datetime.utcnow() + timedelta(days=7, hours=2),
            vessel_name="Test Vessel",
            booking_reference=f"TEST{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
            contact_email="ayoubenmbarek@gmail.com",  # Replace with your email
            contact_phone="+1234567890",
            contact_first_name="Test",
            contact_last_name="User",
            total_passengers=1,
            total_vehicles=0,
            subtotal=50.00,
            tax_amount=10.00,
            total_amount=60.00,
            currency="EUR",
            status=BookingStatusEnum.PENDING,
            expires_at=datetime.utcnow() - timedelta(minutes=1),  # Expired 1 minute ago
        )

        db.add(test_booking)
        db.commit()
        db.refresh(test_booking)

        print(f"✓ Created test booking: {test_booking.booking_reference}")
        print(f"  Email: {test_booking.contact_email}")
        print(f"  Expires at: {test_booking.expires_at}")
        print(f"  Status: {test_booking.status}")

        return test_booking.id

    except Exception as e:
        db.rollback()
        print(f"✗ Error creating test booking: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    print("Creating test booking that expires immediately...")
    booking_id = create_test_booking()

    print("\nRunning expiration cron job...")
    expire_old_bookings()

    print("\n✓ Test complete! Check your email for the cancellation notification.")
