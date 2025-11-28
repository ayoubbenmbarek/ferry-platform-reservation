"""
Celery tasks for booking operations and availability checking.

These tasks handle ferry availability verification and operator booking confirmation.
"""
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timezone
from celery import Task, shared_task
from app.celery_app import celery_app

logger = logging.getLogger(__name__)


class BookingTask(Task):
    """Base task for booking operations with retry logic."""
    autoretry_for = (Exception,)
    retry_kwargs = {"max_retries": 3}
    retry_backoff = True
    retry_backoff_max = 180  # 3 minutes
    retry_jitter = True


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
    bind=True
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
    try:
        logger.info(f"Canceling booking {operator_booking_reference} with operator {operator}")

        # Mock cancellation
        # In real implementation, this would call the operator's cancellation API
        import random
        success = random.random() > 0.1  # 90% success rate

        if not success:
            logger.warning(f"⚠️ Operator cancellation failed for {operator_booking_reference}")
            return {
                "status": "failed",
                "operator_booking_reference": operator_booking_reference,
                "message": "Operator cancellation failed. Manual intervention may be required."
            }

        logger.info(f"✅ Booking canceled with operator: {operator_booking_reference}")

        return {
            "status": "canceled",
            "operator_booking_reference": operator_booking_reference,
            "operator": operator,
            "canceled_at": "2025-11-21T21:00:00Z",
            "message": "Booking successfully canceled with operator"
        }

    except Exception as e:
        logger.error(f"❌ Error canceling booking with operator: {str(e)}")
        raise


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
    2. Updates their status to CANCELLED
    3. Sends cancellation notification emails

    Runs every minute to ensure timely expiration.
    Previously ran as a cron job, migrated to Celery Beat for better monitoring.
    """
    from app.database import SessionLocal
    from app.models.booking import Booking, BookingStatusEnum
    from app.services.email_service import email_service

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
                'emails_sent': 0
            }

        expired_count = 0
        emails_sent = 0

        for booking in expired_bookings:
            logger.info(f"⏰ Expiring booking {booking.booking_reference}")

            # Update booking status
            booking.status = BookingStatusEnum.CANCELLED
            booking.cancellation_reason = "Booking expired - payment not received within 30 minutes"
            booking.cancelled_at = now
            expired_count += 1

            # Send cancellation email asynchronously
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

                if email_service.send_cancellation_confirmation(
                    booking_data=booking_data,
                    to_email=booking.contact_email
                ):
                    emails_sent += 1
                    logger.info(f"  ✅ Sent cancellation email to {booking.contact_email}")
                else:
                    logger.warning(f"  ⚠️ Failed to send email to {booking.contact_email}")

            except Exception as email_error:
                logger.error(f"  ❌ Email error for {booking.booking_reference}: {str(email_error)}")

        # Commit all changes
        db.commit()

        logger.info(f"✅ Expired {expired_count} pending booking(s), sent {emails_sent} email(s)")

        return {
            'status': 'success',
            'expired_count': expired_count,
            'emails_sent': emails_sent,
            'checked_at': now.isoformat()
        }

    except Exception as e:
        db.rollback()
        logger.error(f"❌ Error expiring bookings: {str(e)}")
        # Retry the task
        raise self.retry(exc=e)

    finally:
        db.close()
