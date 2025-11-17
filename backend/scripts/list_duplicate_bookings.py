#!/usr/bin/env python3
"""
Script to list duplicate guest bookings with the same email.
"""

import sys
from pathlib import Path

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal
from sqlalchemy import text

def list_duplicate_bookings():
    db = SessionLocal()

    try:
        print("Finding duplicate guest bookings...\n")

        # Use raw SQL to query bookings
        query = text("""
            SELECT
                id,
                booking_reference,
                contact_email,
                user_id,
                status,
                total_amount,
                created_at
            FROM bookings
            WHERE user_id IS NULL
            ORDER BY contact_email, created_at DESC
        """)

        result = db.execute(query)
        bookings = result.fetchall()

        # Group by email
        bookings_by_email = {}
        for row in bookings:
            email = row[2].lower()  # contact_email
            if email not in bookings_by_email:
                bookings_by_email[email] = []
            bookings_by_email[email].append({
                'id': row[0],
                'reference': row[1],
                'email': row[2],
                'user_id': row[3],
                'status': row[4],
                'total_amount': row[5],
                'created_at': row[6]
            })

        # Find emails with duplicates
        print("=== GUEST BOOKINGS ===\n")
        duplicates_found = False

        for email, bookings in sorted(bookings_by_email.items()):
            if len(bookings) > 1:
                duplicates_found = True
                print(f"⚠️  Email: {email} has {len(bookings)} bookings:")
                for i, booking in enumerate(bookings):
                    print(f"   {i+1}. Ref: {booking['reference']:12s} | "
                          f"ID: {booking['id']:4d} | "
                          f"Total: €{float(booking['total_amount']):7.2f} | "
                          f"Status: {booking['status']:10s} | "
                          f"Created: {booking['created_at']}")
                print()
            else:
                print(f"✓  Email: {email} - 1 booking (Ref: {bookings[0]['reference']})")

        if duplicates_found:
            print("\n⚠️  Duplicate guest bookings found!")
            print("   These were likely created due to React StrictMode double-mounting.")
            print("   The PaymentPage has now been fixed to prevent future duplicates.")
        else:
            print("\n✓  No duplicate guest bookings found!")

    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    print("=== Guest Booking Duplicate Check ===\n")
    list_duplicate_bookings()
