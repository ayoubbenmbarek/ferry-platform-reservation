"""
Celery tasks for checking ferry availability and sending alerts.
Runs periodically to check if previously unavailable routes now have space.
"""
import os
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any
from celery import shared_task
from sqlalchemy import and_, or_

from app.database import SessionLocal
from app.models.availability_alert import AvailabilityAlert, AlertStatusEnum
from app.services.ferry_service import FerryService
from app.services.email_service import email_service

logger = logging.getLogger(__name__)


@shared_task(
    name="app.tasks.availability_check_tasks.check_availability_alerts",
    bind=True,
    max_retries=3,
    default_retry_delay=300  # 5 minutes
)
def check_availability_alerts_task(self):
    """
    Periodic task to check all active alerts for availability.

    This task:
    1. Finds all active alerts that haven't been checked recently
    2. Queries ferry APIs to check availability
    3. Sends email notifications when availability is found
    4. Expires old alerts

    Runs every 2-6 hours (configured in celery beat schedule)
    """
    db = SessionLocal()
    try:
        logger.info("🔍 Starting availability alerts check...")

        # Get current time
        now = datetime.now(timezone.utc)

        # 1. Expire old alerts (older than expires_at)
        expired_count = db.query(AvailabilityAlert).filter(
            and_(
                AvailabilityAlert.status == AlertStatusEnum.ACTIVE.value,
                AvailabilityAlert.expires_at < now
            )
        ).update({"status": AlertStatusEnum.EXPIRED.value})

        if expired_count > 0:
            logger.info(f"⏰ Expired {expired_count} old alerts")

        db.commit()

        # 2. Get active alerts that need checking
        # Only check alerts for future dates
        # Don't check if checked in last 2 hours (avoid rate limiting)
        two_hours_ago = now - timedelta(hours=2)

        alerts = db.query(AvailabilityAlert).filter(
            and_(
                AvailabilityAlert.status == AlertStatusEnum.ACTIVE.value,
                AvailabilityAlert.departure_date >= now.date(),
                or_(
                    AvailabilityAlert.last_checked_at.is_(None),
                    AvailabilityAlert.last_checked_at < two_hours_ago
                )
            )
        ).limit(100).all()  # Process max 100 alerts per run

        if not alerts:
            logger.info("✅ No active alerts to check")
            return {"status": "success", "checked": 0, "notified": 0}

        logger.info(f"📋 Found {len(alerts)} active alerts to check")

        # 3. Check each alert
        ferry_service = FerryService()
        notified_count = 0
        checked_count = 0

        for alert in alerts:
            try:
                # Update last_checked_at
                alert.last_checked_at = now
                checked_count += 1

                # Build search params based on alert type
                search_params = {
                    "departure_port": alert.departure_port,
                    "arrival_port": alert.arrival_port,
                    "departure_date": alert.departure_date.isoformat(),
                    "adults": alert.num_adults,
                    "children": alert.num_children,
                    "infants": alert.num_infants,
                }

                if alert.is_round_trip and alert.return_date:
                    search_params["return_date"] = alert.return_date.isoformat()

                # Check availability based on alert type
                availability_found = False

                if alert.alert_type == "vehicle":
                    # Check if route has vehicle capacity
                    search_params["vehicles"] = [{
                        "type": alert.vehicle_type or "car",
                        "length": alert.vehicle_length_cm or 450,
                        "width": 180,
                        "height": 150
                    }]

                    sailings = ferry_service.search_sailings(**search_params)

                    # Check if any sailing has vehicle space
                    for sailing in sailings:
                        if sailing.get("has_vehicle_space", False):
                            availability_found = True
                            break

                elif alert.alert_type == "cabin":
                    # Check if route has cabin availability
                    search_params["cabin_required"] = True
                    search_params["cabin_type"] = alert.cabin_type or "inside"

                    sailings = ferry_service.search_sailings(**search_params)

                    # Check if any sailing has cabin space
                    for sailing in sailings:
                        cabins = sailing.get("available_cabins", [])
                        if len(cabins) >= (alert.num_cabins or 1):
                            availability_found = True
                            break

                elif alert.alert_type == "passenger":
                    # Check if route has passenger capacity
                    sailings = ferry_service.search_sailings(**search_params)

                    # Check if any sailing has passenger space
                    total_passengers = alert.num_adults + alert.num_children + alert.num_infants
                    for sailing in sailings:
                        if sailing.get("available_seats", 0) >= total_passengers:
                            availability_found = True
                            break

                # 4. Send notification if availability found
                if availability_found:
                    logger.info(f"✅ Availability found for alert {alert.id} ({alert.alert_type})")

                    # Send email notification
                    _send_availability_notification(alert, db)

                    # Mark alert as notified
                    alert.status = AlertStatusEnum.NOTIFIED.value
                    alert.notified_at = now
                    notified_count += 1
                else:
                    logger.debug(f"❌ No availability yet for alert {alert.id}")

            except Exception as e:
                logger.error(f"Error checking alert {alert.id}: {str(e)}", exc_info=True)
                # Continue with next alert
                continue

        # Commit all updates
        db.commit()

        logger.info(f"🎉 Availability check complete: checked {checked_count}, notified {notified_count}")

        return {
            "status": "success",
            "checked": checked_count,
            "notified": notified_count,
            "expired": expired_count
        }

    except Exception as e:
        logger.error(f"Error in availability check task: {str(e)}", exc_info=True)
        db.rollback()
        raise
    finally:
        db.close()


def _send_availability_notification(alert: AvailabilityAlert, db):
    """Send email notification when availability is found."""
    try:
        # Prepare email data
        alert_data = {
            "alert_id": alert.id,
            "alert_type": alert.alert_type,
            "departure_port": alert.departure_port.title(),
            "arrival_port": alert.arrival_port.title(),
            "departure_date": alert.departure_date.strftime("%B %d, %Y"),
            "is_round_trip": alert.is_round_trip,
            "return_date": alert.return_date.strftime("%B %d, %Y") if alert.return_date else None,
            "num_adults": alert.num_adults,
            "num_children": alert.num_children,
            "vehicle_type": alert.vehicle_type,
            "cabin_type": alert.cabin_type,
            "search_url": f"{os.getenv('BASE_URL', 'http://localhost:3001')}/search?"
                         f"from={alert.departure_port}&to={alert.arrival_port}"
                         f"&date={alert.departure_date.isoformat()}"
                         f"&adults={alert.num_adults}&children={alert.num_children}"
        }

        # Send email using email service
        email_service.send_availability_alert(
            alert_data=alert_data,
            to_email=alert.email
        )

        logger.info(f"📧 Availability notification sent to {alert.email}")

    except Exception as e:
        logger.error(f"Failed to send availability notification: {str(e)}", exc_info=True)
        raise


@shared_task(
    name="app.tasks.availability_check_tasks.cleanup_old_alerts",
    bind=True
)
def cleanup_old_alerts_task(self):
    """
    Cleanup task to delete very old notified/expired/cancelled alerts.
    Runs daily to keep database clean.
    """
    db = SessionLocal()
    try:
        # Delete alerts older than 90 days that are not active
        ninety_days_ago = datetime.now(timezone.utc) - timedelta(days=90)

        deleted_count = db.query(AvailabilityAlert).filter(
            and_(
                AvailabilityAlert.status != AlertStatusEnum.ACTIVE.value,
                AvailabilityAlert.created_at < ninety_days_ago
            )
        ).delete()

        db.commit()

        if deleted_count > 0:
            logger.info(f"🧹 Cleaned up {deleted_count} old alerts")

        return {"status": "success", "deleted": deleted_count}

    except Exception as e:
        logger.error(f"Error in cleanup task: {str(e)}", exc_info=True)
        db.rollback()
        raise
    finally:
        db.close()
