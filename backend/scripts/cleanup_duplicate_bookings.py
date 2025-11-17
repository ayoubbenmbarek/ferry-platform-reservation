#!/usr/bin/env python3
"""
Script to clean up duplicate guest bookings with the same email.
Keeps the most recent booking for each email and removes older duplicates.
"""

import sys
from pathlib import Path

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal
from app.models.booking import Booking
from sqlalchemy import func
from datetime import datetime

def cleanup_duplicate_bookings():
    db = SessionLocal()

    try:
        print("Finding duplicate guest bookings...")

        # Find all guest bookings (no user_id) grouped by email
        guest_bookings = db.query(Booking).filter(
            Booking.user_id == None
        ).order_by(Booking.contact_email, Booking.created_at.desc()).all()

        # Group by email
        bookings_by_email = {}
        for booking in guest_bookings:
            email = booking.contact_email.lower()
            if email not in bookings_by_email:
                bookings_by_email[email] = []
            bookings_by_email[email].append(booking)

        # Find emails with duplicates
        duplicates_found = False
        for email, bookings in bookings_by_email.items():
            if len(bookings) > 1:
                duplicates_found = True
                print(f"\nEmail: {email} has {len(bookings)} bookings:")
                for i, booking in enumerate(bookings):
                    print(f"  {i+1}. ID: {booking.id}, Ref: {booking.booking_reference}, "
                          f"Created: {booking.created_at}, Status: {booking.status.value}")

                # Keep the most recent one (first in sorted list)
                keep_booking = bookings[0]
                print(f"  → Keeping: {keep_booking.booking_reference} (most recent)")

                # Mark older ones for deletion
                to_delete = bookings[1:]
                print(f"  → Will delete {len(to_delete)} older booking(s)")

                # Ask for confirmation
                response = input(f"  Delete these {len(to_delete)} older booking(s) for {email}? (yes/no): ")
                if response.lower() == 'yes':
                    for booking in to_delete:
                        print(f"    Deleting booking {booking.booking_reference}...")
                        db.delete(booking)
                    db.commit()
                    print(f"    ✓ Deleted {len(to_delete)} duplicate booking(s)")
                else:
                    print("    Skipped")

        if not duplicates_found:
            print("\n✓ No duplicate guest bookings found!")
        else:
            print("\n✓ Cleanup complete!")

    except Exception as e:
        print(f"\n✗ Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("=== Guest Booking Duplicate Cleanup ===\n")
    cleanup_duplicate_bookings()
