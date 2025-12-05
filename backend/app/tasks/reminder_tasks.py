"""
Celery tasks for sending departure reminder emails.

These tasks check for upcoming departures and send reminder emails
24 hours and 2 hours before departure with E-Ticket attachments.
"""
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from celery import Task
from sqlalchemy import and_, or_
from sqlalchemy.orm import joinedload
from app.celery_app import celery_app
from app.database import SessionLocal
from app.models import Booking, BookingReminder, ReminderTypeEnum
from app.models.booking import BookingStatusEnum
from app.services.email_service import email_service
from app.services.eticket_service import eticket_service

logger = logging.getLogger(__name__)


class ReminderTask(Task):
    """Base task for reminder processing with retry logic."""
    autoretry_for = (Exception,)
    retry_kwargs = {"max_retries": 3}
    retry_backoff = True
    retry_backoff_max = 600  # 10 minutes
    retry_jitter = True


def datetime_to_str(dt) -> Optional[str]:
    """Convert datetime to ISO string."""
    if dt is None:
        return None
    if isinstance(dt, datetime):
        return dt.isoformat()
    return str(dt)


def booking_to_dict(booking: Booking) -> Dict[str, Any]:
    """Convert booking model to dictionary for email template."""
    return {
        'id': booking.id,
        'booking_reference': booking.booking_reference,
        'operator': booking.operator,
        'departure_port': booking.departure_port,
        'arrival_port': booking.arrival_port,
        'departure_time': datetime_to_str(booking.departure_time),
        'arrival_time': datetime_to_str(booking.arrival_time),
        'vessel_name': booking.vessel_name,
        'is_round_trip': booking.is_round_trip,
        'return_operator': booking.return_operator,
        'return_departure_port': booking.return_departure_port,
        'return_arrival_port': booking.return_arrival_port,
        'return_departure_time': datetime_to_str(booking.return_departure_time),
        'return_arrival_time': datetime_to_str(booking.return_arrival_time),
        'return_vessel_name': booking.return_vessel_name,
        'contact_email': booking.contact_email,
        'contact_first_name': booking.contact_first_name,
        'contact_last_name': booking.contact_last_name,
        'contact_phone': booking.contact_phone,
        'total_passengers': booking.total_passengers,
        'total_vehicles': booking.total_vehicles,
        'status': booking.status.value if booking.status else 'CONFIRMED',
    }


def passengers_to_list(passengers) -> List[Dict[str, Any]]:
    """Convert passengers to list of dictionaries."""
    return [
        {
            'first_name': p.first_name,
            'last_name': p.last_name,
            'passenger_type': p.passenger_type.value if hasattr(p.passenger_type, 'value') else str(p.passenger_type),
            'date_of_birth': str(p.date_of_birth) if p.date_of_birth else None,
            'nationality': p.nationality,
        }
        for p in passengers
    ]


def vehicles_to_list(vehicles) -> List[Dict[str, Any]]:
    """Convert vehicles to list of dictionaries."""
    return [
        {
            'vehicle_type': v.vehicle_type.value if v.vehicle_type else 'car',
            'make': v.make,
            'model': v.model,
            'license_plate': v.license_plate,
        }
        for v in vehicles
    ]


def was_reminder_sent(
    db,
    booking_id: int,
    reminder_type: ReminderTypeEnum,
    journey_type: str = "outbound"
) -> bool:
    """Check if a reminder was already sent for this booking/journey."""
    existing = db.query(BookingReminder).filter(
        and_(
            BookingReminder.booking_id == booking_id,
            BookingReminder.reminder_type == reminder_type,
            BookingReminder.journey_type == journey_type,
            BookingReminder.success == True
        )
    ).first()
    return existing is not None


def record_reminder(
    db,
    booking_id: int,
    reminder_type: ReminderTypeEnum,
    journey_type: str,
    email: str,
    success: bool,
    eticket_attached: bool = False,
    error_message: str = None
):
    """Record that a reminder was sent."""
    reminder = BookingReminder(
        booking_id=booking_id,
        reminder_type=reminder_type,
        journey_type=journey_type,
        sent_to_email=email,
        success=success,
        eticket_attached=eticket_attached,
        error_message=error_message
    )
    db.add(reminder)
    db.commit()


@celery_app.task(
    base=ReminderTask,
    name="app.tasks.reminder_tasks.check_departure_reminders",
    bind=True
)
def check_departure_reminders(self):
    """
    Periodic task to check for upcoming departures and send reminder emails.

    Runs periodically (configured in beat schedule) to find:
    - Bookings with departures 24 hours away (send 24h reminder)
    - Bookings with departures 2 hours away (send 2h reminder)

    Also handles return journeys for round-trip bookings.
    """
    db = SessionLocal()
    try:
        now = datetime.utcnow()

        # Time windows for reminders (with some buffer)
        window_24h_start = now + timedelta(hours=23, minutes=30)
        window_24h_end = now + timedelta(hours=24, minutes=30)

        window_2h_start = now + timedelta(hours=1, minutes=45)
        window_2h_end = now + timedelta(hours=2, minutes=15)

        logger.info(f"Checking for departure reminders at {now}")
        logger.info(f"24h window: {window_24h_start} - {window_24h_end}")
        logger.info(f"2h window: {window_2h_start} - {window_2h_end}")

        # Get confirmed bookings with upcoming outbound departures (24h)
        outbound_24h = db.query(Booking).options(
            joinedload(Booking.passengers),
            joinedload(Booking.vehicles)
        ).filter(
            and_(
                Booking.status == BookingStatusEnum.CONFIRMED,
                Booking.departure_time >= window_24h_start,
                Booking.departure_time <= window_24h_end
            )
        ).all()

        logger.info(f"Found {len(outbound_24h)} bookings for 24h outbound reminder")

        for booking in outbound_24h:
            if not was_reminder_sent(db, booking.id, ReminderTypeEnum.REMINDER_24H, "outbound"):
                send_departure_reminder_email.delay(
                    booking_id=booking.id,
                    reminder_type="24h",
                    journey_type="outbound"
                )

        # Get confirmed bookings with upcoming outbound departures (2h)
        outbound_2h = db.query(Booking).filter(
            and_(
                Booking.status == BookingStatusEnum.CONFIRMED,
                Booking.departure_time >= window_2h_start,
                Booking.departure_time <= window_2h_end
            )
        ).all()

        logger.info(f"Found {len(outbound_2h)} bookings for 2h outbound reminder")

        for booking in outbound_2h:
            if not was_reminder_sent(db, booking.id, ReminderTypeEnum.REMINDER_2H, "outbound"):
                send_departure_reminder_email.delay(
                    booking_id=booking.id,
                    reminder_type="2h",
                    journey_type="outbound"
                )

        # Get confirmed round-trip bookings with upcoming return departures (24h)
        return_24h = db.query(Booking).filter(
            and_(
                Booking.status == BookingStatusEnum.CONFIRMED,
                Booking.is_round_trip == True,
                Booking.return_departure_time >= window_24h_start,
                Booking.return_departure_time <= window_24h_end
            )
        ).all()

        logger.info(f"Found {len(return_24h)} bookings for 24h return reminder")

        for booking in return_24h:
            if not was_reminder_sent(db, booking.id, ReminderTypeEnum.REMINDER_24H, "return"):
                send_departure_reminder_email.delay(
                    booking_id=booking.id,
                    reminder_type="24h",
                    journey_type="return"
                )

        # Get confirmed round-trip bookings with upcoming return departures (2h)
        return_2h = db.query(Booking).filter(
            and_(
                Booking.status == BookingStatusEnum.CONFIRMED,
                Booking.is_round_trip == True,
                Booking.return_departure_time >= window_2h_start,
                Booking.return_departure_time <= window_2h_end
            )
        ).all()

        logger.info(f"Found {len(return_2h)} bookings for 2h return reminder")

        for booking in return_2h:
            if not was_reminder_sent(db, booking.id, ReminderTypeEnum.REMINDER_2H, "return"):
                send_departure_reminder_email.delay(
                    booking_id=booking.id,
                    reminder_type="2h",
                    journey_type="return"
                )

        total_reminders = len(outbound_24h) + len(outbound_2h) + len(return_24h) + len(return_2h)
        logger.info(f"Reminder check complete. Queued {total_reminders} potential reminders")

        return {
            "status": "success",
            "checked_at": now.isoformat(),
            "outbound_24h": len(outbound_24h),
            "outbound_2h": len(outbound_2h),
            "return_24h": len(return_24h),
            "return_2h": len(return_2h),
        }

    except Exception as e:
        logger.error(f"Error checking departure reminders: {str(e)}")
        raise
    finally:
        db.close()


@celery_app.task(
    base=ReminderTask,
    name="app.tasks.reminder_tasks.send_departure_reminder_email",
    bind=True
)
def send_departure_reminder_email(
    self,
    booking_id: int,
    reminder_type: str,  # "24h" or "2h"
    journey_type: str,  # "outbound" or "return"
):
    """
    Send departure reminder email for a specific booking.

    Args:
        booking_id: The booking ID
        reminder_type: "24h" or "2h"
        journey_type: "outbound" or "return"
    """
    db = SessionLocal()
    try:
        # Get booking with passengers and vehicles
        booking = db.query(Booking).options(
            joinedload(Booking.passengers),
            joinedload(Booking.vehicles)
        ).filter(Booking.id == booking_id).first()

        if not booking:
            logger.error(f"Booking {booking_id} not found for reminder")
            return {"status": "error", "message": "Booking not found"}

        # Check if already sent
        reminder_type_enum = (
            ReminderTypeEnum.REMINDER_24H if reminder_type == "24h"
            else ReminderTypeEnum.REMINDER_2H
        )

        if was_reminder_sent(db, booking_id, reminder_type_enum, journey_type):
            logger.info(f"Reminder already sent for booking {booking_id} ({reminder_type}, {journey_type})")
            return {"status": "skipped", "message": "Reminder already sent"}

        # Convert booking to dict
        booking_data = booking_to_dict(booking)
        passengers = passengers_to_list(booking.passengers)
        vehicles = vehicles_to_list(booking.vehicles)

        # Generate E-Ticket PDF (only for 24h reminder)
        eticket_pdf = None
        if reminder_type == "24h":
            try:
                logger.info(f"Generating E-Ticket for booking {booking.booking_reference}")
                eticket_pdf = eticket_service.generate_eticket(
                    booking=booking_data,
                    passengers=passengers,
                    vehicles=vehicles
                )
                logger.info(f"E-Ticket generated successfully ({len(eticket_pdf)} bytes)")
            except Exception as e:
                logger.error(f"Failed to generate E-Ticket: {str(e)}")
                # Continue without E-Ticket

        # Send email
        logger.info(
            f"Sending {reminder_type} {journey_type} reminder to {booking.contact_email} "
            f"for booking {booking.booking_reference}"
        )

        success = email_service.send_departure_reminder(
            booking_data=booking_data,
            to_email=booking.contact_email,
            reminder_type=reminder_type,
            journey_type=journey_type,
            passengers=passengers,
            eticket_pdf=eticket_pdf
        )

        # Record the reminder
        record_reminder(
            db=db,
            booking_id=booking_id,
            reminder_type=reminder_type_enum,
            journey_type=journey_type,
            email=booking.contact_email,
            success=success,
            eticket_attached=eticket_pdf is not None,
            error_message=None if success else "Email sending failed"
        )

        if success:
            logger.info(f"✅ {reminder_type} reminder sent for booking {booking.booking_reference}")
            return {
                "status": "success",
                "booking_reference": booking.booking_reference,
                "reminder_type": reminder_type,
                "journey_type": journey_type,
                "eticket_attached": eticket_pdf is not None
            }
        else:
            logger.error(f"❌ Failed to send {reminder_type} reminder for booking {booking.booking_reference}")
            raise Exception("Email sending failed")

    except Exception as e:
        logger.error(f"Error sending reminder for booking {booking_id}: {str(e)}")

        # Record failed attempt
        try:
            reminder_type_enum = (
                ReminderTypeEnum.REMINDER_24H if reminder_type == "24h"
                else ReminderTypeEnum.REMINDER_2H
            )
            record_reminder(
                db=db,
                booking_id=booking_id,
                reminder_type=reminder_type_enum,
                journey_type=journey_type,
                email="unknown",
                success=False,
                error_message=str(e)
            )
        except:
            pass

        raise
    finally:
        db.close()


@celery_app.task(
    name="app.tasks.reminder_tasks.send_manual_reminder",
    bind=True
)
def send_manual_reminder(self, booking_id: int, include_eticket: bool = True):
    """
    Manually trigger a reminder email for a booking.
    Useful for resending reminders or testing.

    Args:
        booking_id: The booking ID
        include_eticket: Whether to attach E-Ticket
    """
    db = SessionLocal()
    try:
        booking = db.query(Booking).options(
            joinedload(Booking.passengers),
            joinedload(Booking.vehicles)
        ).filter(Booking.id == booking_id).first()

        if not booking:
            return {"status": "error", "message": "Booking not found"}

        booking_data = booking_to_dict(booking)
        passengers = passengers_to_list(booking.passengers)
        vehicles = vehicles_to_list(booking.vehicles)

        # Generate E-Ticket
        eticket_pdf = None
        if include_eticket:
            try:
                eticket_pdf = eticket_service.generate_eticket(
                    booking=booking_data,
                    passengers=passengers,
                    vehicles=vehicles
                )
            except Exception as e:
                logger.error(f"Failed to generate E-Ticket: {str(e)}")

        success = email_service.send_departure_reminder(
            booking_data=booking_data,
            to_email=booking.contact_email,
            reminder_type="24h",
            journey_type="outbound",
            passengers=passengers,
            eticket_pdf=eticket_pdf
        )

        return {
            "status": "success" if success else "failed",
            "booking_reference": booking.booking_reference,
            "email": booking.contact_email,
            "eticket_attached": eticket_pdf is not None
        }

    finally:
        db.close()
