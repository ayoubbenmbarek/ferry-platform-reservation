"""
Celery tasks for booking operations and availability checking.

These tasks handle ferry availability verification and operator booking confirmation.
Failed tasks are stored in dead-letter queue (Redis + PostgreSQL) for recovery.
"""
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timezone, timedelta
from celery import shared_task
from app.celery_app import celery_app
from app.tasks.base_task import BookingTask

logger = logging.getLogger(__name__)


@celery_app.task(
    base=BookingTask,
    name="app.tasks.booking_tasks.check_ferry_availability",
    bind=True
)
def check_ferry_availability_task(
    self,
    operator: str,
    sailing_id: str,
    departure_port: str,
    arrival_port: str,
    departure_time: str,
    passenger_count: int,
    vehicle_count: int = 0
) -> Dict[str, Any]:
    """
    Check real-time ferry availability with operator before payment.

    This task is called right before payment initialization to ensure:
    1. Ferry still has available capacity
    2. Price hasn't changed
    3. Sailing still exists

    Args:
        operator: Ferry operator code
        sailing_id: Sailing/schedule ID
        departure_port: Departure port code
        arrival_port: Arrival port code
        departure_time: Departure datetime (ISO format)
        passenger_count: Number of passengers
        vehicle_count: Number of vehicles

    Returns:
        Dict with availability status and details
    """
    try:
        logger.info(f"Checking availability: {operator} - {sailing_id}")

        # For now, use mock data (will be replaced with real API integration)
        # Mock logic: 90% availability success rate
        import random
        is_available = random.random() > 0.1

        if not is_available:
            logger.warning(f"⚠️ Ferry not available: {sailing_id}")
            return {
                "status": "unavailable",
                "sailing_id": sailing_id,
                "operator": operator,
                "message": "Sorry, this ferry is no longer available. Please search again.",
                "reason": "capacity_full"
            }

        # Mock: Check capacity
        available_capacity = random.randint(50, 200)
        if passenger_count > available_capacity:
            logger.warning(f"⚠️ Insufficient passenger capacity: {passenger_count} > {available_capacity}")
            return {
                "status": "insufficient_capacity",
                "sailing_id": sailing_id,
                "available_capacity": available_capacity,
                "requested_capacity": passenger_count,
                "message": f"Only {available_capacity} seats available. Please reduce passenger count."
            }

        # Mock: Vehicle capacity check
        available_vehicle_capacity = random.randint(20, 80)
        if vehicle_count > available_vehicle_capacity:
            logger.warning(f"⚠️ Insufficient vehicle capacity: {vehicle_count} > {available_vehicle_capacity}")
            return {
                "status": "insufficient_vehicle_capacity",
                "sailing_id": sailing_id,
                "available_vehicle_capacity": available_vehicle_capacity,
                "requested_vehicle_capacity": vehicle_count,
                "message": f"Only {available_vehicle_capacity} vehicle spaces available."
            }

        # Availability confirmed
        logger.info(f"✅ Ferry available: {sailing_id}")
        return {
            "status": "available",
            "sailing_id": sailing_id,
            "operator": operator,
            "available_passenger_capacity": available_capacity,
            "available_vehicle_capacity": available_vehicle_capacity,
            "confirmed_at": "2025-11-21T21:00:00Z",
            "message": "Ferry is available for booking"
        }

    except Exception as e:
        logger.error(f"❌ Error checking availability: {str(e)}")
        # On error, assume unavailable to be safe
        return {
            "status": "error",
            "sailing_id": sailing_id,
            "message": "Unable to verify availability. Please try again.",
            "error": str(e)
        }


@celery_app.task(
    base=BookingTask,
    name="app.tasks.booking_tasks.confirm_booking_with_operator",
    bind=True
)
def confirm_booking_with_operator_task(
    self,
    booking_id: int,
    operator: str,
    booking_data: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Confirm booking with ferry operator after successful payment.

    This task creates the actual booking with the ferry operator's system.

    Args:
        booking_id: Internal booking ID
        operator: Ferry operator code
        booking_data: Complete booking information

    Returns:
        Dict with operator confirmation details
    """
    try:
        logger.info(f"Confirming booking {booking_id} with operator {operator}")

        # Mock operator booking confirmation
        # In real implementation, this would call the ferry operator's API
        import random
        import string

        # Generate mock operator booking reference
        operator_reference = ''.join(random.choices(string.ascii_uppercase + string.digits, k=10))

        logger.info(f"✅ Booking confirmed with operator: {operator_reference}")

        return {
            "status": "confirmed",
            "booking_id": booking_id,
            "operator": operator,
            "operator_booking_reference": operator_reference,
            "confirmed_at": "2025-11-21T21:00:00Z",
            "message": "Booking successfully confirmed with operator"
        }

    except Exception as e:
        logger.error(f"❌ Error confirming booking with operator: {str(e)}")
        raise


@celery_app.task(
    base=BookingTask,
    name="app.tasks.booking_tasks.cancel_booking_with_operator",
    bind=True,
    max_retries=3,
    default_retry_delay=60
)
def cancel_booking_with_operator_task(
    self,
    operator: str,
    operator_booking_reference: str,
    cancellation_reason: Optional[str] = None
) -> Dict[str, Any]:
    """
    Cancel booking with ferry operator asynchronously.

    Args:
        operator: Ferry operator code
        operator_booking_reference: Operator's booking reference
        cancellation_reason: Reason for cancellation

    Returns:
        Dict with cancellation confirmation
    """
    import asyncio
    from app.services.ferry_service import FerryService
    from app.services.ferry_integrations.base import FerryAPIError

    async def _cancel():
        ferry_service = FerryService()
        return await ferry_service.cancel_booking(
            operator=operator,
            booking_reference=operator_booking_reference,
            reason=cancellation_reason
        )

    try:
        logger.info(f"🚢 Canceling booking {operator_booking_reference} with operator {operator}")

        # Run async cancellation
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            success = loop.run_until_complete(_cancel())
        finally:
            loop.close()

        if success:
            logger.info(f"✅ Booking cancelled with operator: {operator_booking_reference}")
            return {
                "status": "cancelled",
                "operator_booking_reference": operator_booking_reference,
                "operator": operator,
                "cancelled_at": datetime.now(timezone.utc).isoformat(),
                "message": "Booking successfully cancelled with operator"
            }
        else:
            logger.warning(f"⚠️ Operator cancellation returned false for {operator_booking_reference}")
            return {
                "status": "failed",
                "operator_booking_reference": operator_booking_reference,
                "message": "Operator cancellation returned unsuccessful"
            }

    except FerryAPIError as e:
        error_msg = str(e.message).lower() if hasattr(e, 'message') and e.message else str(e).lower()
        # "Booking not found" is expected for bookings created with restricted API key
        if "not found" in error_msg or "does not exist" in error_msg:
            logger.info(f"ℹ️ Booking {operator_booking_reference} not found in operator system (likely never created)")
            return {
                "status": "not_found",
                "operator_booking_reference": operator_booking_reference,
                "operator": operator,
                "message": "Booking not found in operator system - may have never been created"
            }
        logger.error(f"❌ FerryAPIError canceling booking: {e}")
        raise self.retry(exc=e)

    except Exception as e:
        logger.error(f"❌ Error canceling booking with operator: {str(e)}")
        raise self.retry(exc=e)


@celery_app.task(
    base=BookingTask,
    name="app.tasks.booking_tasks.process_full_cancellation",
    bind=True,
    max_retries=3,
    default_retry_delay=60
)
def process_full_cancellation_task(
    self,
    booking_id: int,
    cancellation_reason: Optional[str] = None,
    initiated_by: Optional[str] = None
) -> Dict[str, Any]:
    """
    Process full booking cancellation asynchronously.

    This task handles the complete cancellation flow:
    1. Cancel with ferry operator (if applicable)
    2. Process Stripe refunds for all payments
    3. Update booking status
    4. Send cancellation confirmation email

    Args:
        booking_id: Internal booking ID
        cancellation_reason: Reason for cancellation
        initiated_by: User ID or "system" who initiated cancellation

    Returns:
        Dict with cancellation results
    """
    from app.database import SessionLocal
    from app.models.booking import Booking, BookingStatusEnum
    from app.models.payment import Payment, PaymentStatusEnum
    from app.services.ferry_service import FerryService
    from app.services.ferry_integrations.base import FerryAPIError
    from app.tasks.email_tasks import send_cancellation_email_task
    import stripe
    import os
    import asyncio

    stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

    db = SessionLocal()
    results = {
        "booking_id": booking_id,
        "status": "pending",
        "operator_cancellation": None,
        "refunds": [],
        "total_refunded": 0,
        "errors": []
    }

    try:
        logger.info(f"🚀 Starting full cancellation process for booking {booking_id}")

        # Get booking
        booking = db.query(Booking).filter(Booking.id == booking_id).first()
        if not booking:
            results["status"] = "failed"
            results["errors"].append("Booking not found")
            return results

        results["booking_reference"] = booking.booking_reference

        # Check if already cancelled
        if booking.status == BookingStatusEnum.CANCELLED:
            results["status"] = "already_cancelled"
            results["message"] = "Booking was already cancelled"
            return results

        # Step 1: Cancel with ferry operator
        operator_booking_pending = booking.extra_data.get("operator_booking_pending", False) if booking.extra_data else False

        if booking.operator_booking_reference and not operator_booking_pending:
            logger.info(f"📡 Step 1: Cancelling with operator {booking.operator}...")
            try:
                async def _cancel_operator():
                    ferry_service = FerryService()
                    return await ferry_service.cancel_booking(
                        operator=booking.operator,
                        booking_reference=booking.operator_booking_reference,
                        reason=cancellation_reason
                    )

                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                try:
                    operator_success = loop.run_until_complete(_cancel_operator())
                finally:
                    loop.close()

                results["operator_cancellation"] = {
                    "success": operator_success,
                    "operator": booking.operator,
                    "reference": booking.operator_booking_reference
                }
                logger.info(f"✅ Operator cancellation: {'success' if operator_success else 'failed'}")

            except FerryAPIError as e:
                error_msg = str(e.message).lower() if hasattr(e, 'message') and e.message else str(e).lower()
                if "not found" in error_msg:
                    results["operator_cancellation"] = {
                        "success": True,
                        "note": "Booking not found in operator system"
                    }
                    logger.info("ℹ️ Booking not found in operator - continuing with local cancellation")
                else:
                    results["operator_cancellation"] = {"success": False, "error": str(e)}
                    results["errors"].append(f"Operator cancellation failed: {e}")
                    logger.warning(f"⚠️ Operator cancellation error: {e}")
        else:
            results["operator_cancellation"] = {
                "skipped": True,
                "reason": "No operator booking reference" if not booking.operator_booking_reference else "Booking was never confirmed with operator"
            }
            logger.info("ℹ️ Skipping operator cancellation - booking not in operator system")

        # Step 2: Process Stripe refunds
        logger.info("💳 Step 2: Processing Stripe refunds...")
        payments = db.query(Payment).filter(
            Payment.booking_id == booking_id,
            Payment.status == PaymentStatusEnum.COMPLETED
        ).all()

        total_refunded = 0
        for payment in payments:
            if payment.stripe_charge_id:
                try:
                    refund = stripe.Refund.create(
                        charge=payment.stripe_charge_id,
                        reason="requested_by_customer",
                        metadata={
                            "booking_id": str(booking_id),
                            "booking_reference": booking.booking_reference,
                            "cancellation_reason": cancellation_reason or "Customer requested"
                        }
                    )
                    payment.status = PaymentStatusEnum.REFUNDED
                    payment.refund_id = refund.id
                    payment.refunded_at = datetime.now(timezone.utc)
                    payment.refund_amount = payment.amount

                    refund_amount = float(payment.amount) if payment.amount else 0
                    total_refunded += refund_amount

                    results["refunds"].append({
                        "payment_id": payment.id,
                        "refund_id": refund.id,
                        "amount": refund_amount,
                        "status": "success"
                    })
                    logger.info(f"✅ Refunded payment {payment.id}: €{refund_amount}")

                except stripe.error.StripeError as e:
                    results["refunds"].append({
                        "payment_id": payment.id,
                        "status": "failed",
                        "error": str(e)
                    })
                    results["errors"].append(f"Stripe refund failed for payment {payment.id}: {e}")
                    logger.error(f"❌ Stripe refund error for payment {payment.id}: {e}")

        results["total_refunded"] = total_refunded

        # Step 3: Update booking status
        logger.info("📝 Step 3: Updating booking status...")
        booking.status = BookingStatusEnum.CANCELLED
        booking.cancellation_reason = cancellation_reason
        booking.cancelled_at = datetime.now(timezone.utc)
        if booking.extra_data is None:
            booking.extra_data = {}
        booking.extra_data["cancellation_task_id"] = self.request.id
        booking.extra_data["cancelled_by"] = initiated_by

        db.commit()
        logger.info(f"✅ Booking status updated to CANCELLED")

        # Step 4: Queue cancellation email
        logger.info("📧 Step 4: Queuing cancellation email...")
        try:
            booking_dict = {
                "id": booking.id,
                "booking_reference": booking.booking_reference,
                "operator": booking.operator,
                "departure_port": booking.departure_port,
                "arrival_port": booking.arrival_port,
                "departure_time": booking.departure_time.isoformat() if booking.departure_time else None,
                "arrival_time": booking.arrival_time.isoformat() if booking.arrival_time else None,
                "vessel_name": booking.vessel_name,
                "contact_email": booking.contact_email,
                "contact_first_name": booking.contact_first_name,
                "contact_last_name": booking.contact_last_name,
                "total_passengers": booking.total_passengers,
                "total_vehicles": booking.total_vehicles,
                "cancellation_reason": cancellation_reason,
                "cancelled_at": booking.cancelled_at.isoformat() if booking.cancelled_at else None,
                "refund_amount": total_refunded if total_refunded > 0 else None,
                "refunds_count": len([r for r in results["refunds"] if r["status"] == "success"]),
                "base_url": os.getenv("BASE_URL", "http://localhost:3001")
            }

            email_task = send_cancellation_email_task.delay(
                booking_data=booking_dict,
                to_email=booking.contact_email
            )
            results["email_task_id"] = email_task.id
            logger.info(f"✅ Cancellation email queued: {email_task.id}")

        except Exception as e:
            results["errors"].append(f"Failed to queue email: {e}")
            logger.error(f"❌ Failed to queue cancellation email: {e}")

        # Final status
        results["status"] = "completed" if not results["errors"] else "completed_with_errors"
        results["completed_at"] = datetime.now(timezone.utc).isoformat()

        logger.info(f"🎉 Cancellation process completed for booking {booking_id}: {results['status']}")
        return results

    except Exception as e:
        db.rollback()
        logger.error(f"❌ Fatal error in cancellation task: {e}", exc_info=True)
        results["status"] = "failed"
        results["errors"].append(str(e))
        raise self.retry(exc=e)

    finally:
        db.close()


@shared_task(
    name="app.tasks.booking_tasks.expire_old_bookings",
    bind=True,
    max_retries=3,
    default_retry_delay=300  # 5 minutes
)
def expire_old_bookings_task(self):
    """
    Periodic task to expire pending bookings that haven't been paid.

    This task:
    1. Finds all PENDING bookings that have passed their expiration time
    2. Cancels FerryHopper PENDING bookings to release held inventory
    3. Updates their status to CANCELLED
    4. Sends cancellation notification emails

    Runs every minute to ensure timely expiration.
    Previously ran as a cron job, migrated to Celery Beat for better monitoring.
    """
    from app.database import SessionLocal
    from app.models.booking import Booking, BookingStatusEnum
    from app.tasks.email_tasks import send_cancellation_email_task

    db = SessionLocal()

    try:
        logger.info("🔍 Starting booking expiration check...")

        # Get current time
        now = datetime.now(timezone.utc)

        # Find all pending bookings that have expired
        expired_bookings = db.query(Booking).filter(
            Booking.status == BookingStatusEnum.PENDING,
            Booking.expires_at != None,
            Booking.expires_at < now
        ).all()

        if not expired_bookings:
            logger.info("✅ No expired bookings found")
            return {
                'status': 'success',
                'expired_count': 0,
                'emails_sent': 0,
                'fh_released': 0
            }

        expired_count = 0
        emails_sent = 0
        fh_released = 0

        for booking in expired_bookings:
            logger.info(f"⏰ Expiring booking {booking.booking_reference}")

            # Release FerryHopper inventory if booking was pending
            is_fh_pending = (
                booking.extra_data.get("operator_booking_pending", False)
                if booking.extra_data else False
            )

            if is_fh_pending and booking.operator_booking_reference:
                logger.info(f"🔓 Releasing FerryHopper inventory for {booking.booking_reference}")
                try:
                    import asyncio
                    from app.services.ferry_service import FerryService

                    async def _release_fh_booking():
                        ferry_service = FerryService()
                        # Release outbound booking
                        await ferry_service.cancel_pending_booking(
                            operator=booking.operator,
                            booking_code=booking.operator_booking_reference
                        )
                        # Release return booking if exists
                        if booking.return_operator_booking_reference:
                            await ferry_service.cancel_pending_booking(
                                operator=booking.return_operator or booking.operator,
                                booking_code=booking.return_operator_booking_reference
                            )

                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                    try:
                        loop.run_until_complete(_release_fh_booking())
                        fh_released += 1
                        logger.info(f"  🔓 FerryHopper inventory released for {booking.booking_reference}")
                    finally:
                        loop.close()

                except Exception as fh_error:
                    logger.warning(f"  ⚠️ Failed to release FerryHopper inventory: {fh_error}")
                    # Continue with local cancellation even if FH release fails
                    # FerryHopper will auto-expire the pending booking anyway

            # Update booking status
            booking.status = BookingStatusEnum.CANCELLED
            booking.cancellation_reason = "Booking expired - payment not received within 15 minutes"
            booking.cancelled_at = now
            # Update extra_data to mark as expired
            if booking.extra_data is None:
                booking.extra_data = {}
            booking.extra_data["expired_at"] = now.isoformat()
            booking.extra_data["operator_booking_pending"] = False
            expired_count += 1

            # Queue cancellation email asynchronously via Celery
            try:
                booking_data = {
                    'booking_reference': booking.booking_reference,
                    'departure_port': booking.departure_port,
                    'arrival_port': booking.arrival_port,
                    'operator': booking.operator,
                    'vessel_name': booking.vessel_name,
                    'departure_time': booking.departure_time.isoformat() if booking.departure_time else None,
                    'arrival_time': booking.arrival_time.isoformat() if booking.arrival_time else None,
                    'contact_first_name': booking.contact_first_name,
                    'contact_last_name': booking.contact_last_name,
                    'contact_email': booking.contact_email,
                    'total_passengers': booking.total_passengers,
                    'total_vehicles': booking.total_vehicles,
                    'total_amount': float(booking.total_amount),
                    'cancellation_reason': booking.cancellation_reason,
                    'cancelled_at': booking.cancelled_at.isoformat() if booking.cancelled_at else None,
                }

                # Queue email task asynchronously (non-blocking)
                email_task = send_cancellation_email_task.delay(
                    booking_data=booking_data,
                    to_email=booking.contact_email
                )
                emails_sent += 1
                logger.info(f"  📧 Queued cancellation email to {booking.contact_email} (task: {email_task.id})")

            except Exception as email_error:
                logger.error(f"  ❌ Email queue error for {booking.booking_reference}: {str(email_error)}")

        # Commit all changes
        db.commit()

        logger.info(f"✅ Expired {expired_count} pending booking(s), queued {emails_sent} email(s), released {fh_released} FerryHopper hold(s)")

        return {
            'status': 'success',
            'expired_count': expired_count,
            'emails_sent': emails_sent,
            'fh_released': fh_released,
            'checked_at': now.isoformat()
        }

    except Exception as e:
        db.rollback()
        logger.error(f"❌ Error expiring bookings: {str(e)}")
        # Retry the task
        raise self.retry(exc=e)

    finally:
        db.close()


@celery_app.task(
    name="app.tasks.booking_tasks.complete_past_bookings",
    bind=True,
    max_retries=3,
    default_retry_delay=300  # 5 minutes
)
def complete_past_bookings_task(self):
    """
    Periodic task to mark confirmed bookings as completed after departure.

    This task:
    1. Finds all CONFIRMED bookings where departure_time has passed
    2. Updates their status to COMPLETED
    3. Also handles round-trip bookings (waits for return journey to complete)

    Runs every hour to update booking statuses.
    """
    from app.database import SessionLocal
    from app.models.booking import Booking, BookingStatusEnum

    db = SessionLocal()

    try:
        logger.info("🔍 Starting past bookings completion check...")

        # Get current time with some buffer (2 hours after departure)
        now = datetime.now(timezone.utc)
        cutoff_time = now - timedelta(hours=2)

        # Find confirmed bookings where:
        # - For one-way: departure_time has passed
        # - For round-trip: return_departure_time has passed (or departure_time if no return)
        completed_count = 0

        # One-way bookings: departure has passed
        one_way_bookings = db.query(Booking).filter(
            Booking.status == BookingStatusEnum.CONFIRMED,
            Booking.is_round_trip == False,
            Booking.departure_time != None,
            Booking.departure_time < cutoff_time
        ).all()

        for booking in one_way_bookings:
            logger.info(f"✅ Completing one-way booking {booking.booking_reference}")
            booking.status = BookingStatusEnum.COMPLETED
            booking.updated_at = now
            completed_count += 1

        # Round-trip bookings: return departure has passed
        round_trip_bookings = db.query(Booking).filter(
            Booking.status == BookingStatusEnum.CONFIRMED,
            Booking.is_round_trip == True,
            Booking.return_departure_time != None,
            Booking.return_departure_time < cutoff_time
        ).all()

        for booking in round_trip_bookings:
            logger.info(f"✅ Completing round-trip booking {booking.booking_reference}")
            booking.status = BookingStatusEnum.COMPLETED
            booking.updated_at = now
            completed_count += 1

        # Round-trip bookings without return time: use outbound departure
        round_trip_no_return = db.query(Booking).filter(
            Booking.status == BookingStatusEnum.CONFIRMED,
            Booking.is_round_trip == True,
            Booking.return_departure_time == None,
            Booking.departure_time != None,
            Booking.departure_time < cutoff_time
        ).all()

        for booking in round_trip_no_return:
            logger.info(f"✅ Completing round-trip booking (no return time) {booking.booking_reference}")
            booking.status = BookingStatusEnum.COMPLETED
            booking.updated_at = now
            completed_count += 1

        db.commit()

        logger.info(f"✅ Completed {completed_count} past booking(s)")

        return {
            'status': 'success',
            'completed_count': completed_count,
            'checked_at': now.isoformat()
        }

    except Exception as e:
        db.rollback()
        logger.error(f"❌ Error completing past bookings: {str(e)}")
        raise self.retry(exc=e)

    finally:
        db.close()
