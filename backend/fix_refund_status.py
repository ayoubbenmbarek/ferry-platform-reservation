
#!/usr/bin/env python3
"""
Quick fix script to mark already-refunded bookings as processed.
Run this once to fix booking MR6038973E.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal
from app.models.booking import Booking
from app.models.payment import Payment, PaymentStatusEnum

def fix_refund_status():
    db = SessionLocal()
    try:
        # Find the booking
        booking = db.query(Booking).filter(
            Booking.booking_reference == 'MR6038973E'
        ).first()

        if not booking:
            print("❌ Booking MR6038973E not found")
            return

        print(f"Found booking: {booking.booking_reference}")
        print(f"  Status: {booking.status}")
        print(f"  Refund amount: €{booking.refund_amount}")
        print(f"  Refund processed: {booking.refund_processed}")

        # Check if payment has refund
        payment = db.query(Payment).filter(
            Payment.booking_id == booking.id,
            Payment.status == PaymentStatusEnum.REFUNDED
        ).first()

        if payment and payment.stripe_refund_id:
            print(f"  Stripe refund ID: {payment.stripe_refund_id}")
            print("\n✅ Refund found in Stripe - marking as processed...")

            booking.refund_processed = True
            db.commit()

            print("✅ Successfully updated booking.refund_processed = True")
            print("\n🎉 Booking MR6038973E will no longer show in Pending Refunds!")
        else:
            print("\n❌ No refunded payment found for this booking")
            if payment:
                print(f"   Payment status: {payment.status}")

    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_refund_status()