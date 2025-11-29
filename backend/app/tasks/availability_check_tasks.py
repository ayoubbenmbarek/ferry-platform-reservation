"""
Celery tasks for checking ferry availability and sending alerts.
Runs periodically to check if previously unavailable routes now have space.
"""
import os
import logging
import asyncio
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
        # Cooldown to avoid excessive API calls (5 minutes for real-time notifications)
        # Increase to hours=1 or hours=2 if hitting rate limits
        cooldown_period = now - timedelta(minutes=5)

        alerts = db.query(AvailabilityAlert).filter(
            and_(
                AvailabilityAlert.status == AlertStatusEnum.ACTIVE.value,
                AvailabilityAlert.departure_date >= now.date(),
                or_(
                    AvailabilityAlert.last_checked_at.is_(None),
                    AvailabilityAlert.last_checked_at < cooldown_period
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
                    "departure_date": alert.departure_date,  # Pass as date object, not ISO string
                    "adults": alert.num_adults,
                    "children": alert.num_children,
                    "infants": alert.num_infants,
                }

                if alert.is_round_trip and alert.return_date:
                    search_params["return_date"] = alert.return_date  # Pass as date object

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

                    # Call async ferry search (run in sync context)
                    results = asyncio.run(ferry_service.search_ferries(**search_params))

                    # Check if any sailing has vehicle space
                    # Results are FerryResult objects with available_spaces attribute
                    for result in results:
                        # Check operator match (if alert is for specific operator)
                        if alert.operator and result.operator != alert.operator:
                            continue  # Skip, different operator

                        # Check sailing time match (if alert is for specific sailing time)
                        if alert.sailing_time:
                            result_time = datetime.fromisoformat(str(result.departure_time)).time()
                            if result_time != alert.sailing_time:
                                continue  # Skip, different sailing time

                        available_spaces = getattr(result, "available_spaces", {})
                        vehicles_available = available_spaces.get("vehicles", 0) if isinstance(available_spaces, dict) else 0
                        if vehicles_available > 0:
                            availability_found = True
                            logger.info(f"🚗 Found vehicle space: {vehicles_available} spaces available on {result.operator}")
                            break

                elif alert.alert_type == "cabin":
                    # Check if route has cabin availability
                    # Note: cabin_required and cabin_type are not parameters of search_ferries()
                    # We'll search normally and filter results by cabin availability

                    # Call async ferry search (run in sync context)
                    results = asyncio.run(ferry_service.search_ferries(**search_params))

                    # Check if any sailing has cabin space
                    for result in results:
                        # Check operator match (if alert is for specific operator)
                        if alert.operator and result.operator != alert.operator:
                            continue  # Skip, different operator

                        # Check sailing time match (if alert is for specific sailing time)
                        if alert.sailing_time:
                            result_time = datetime.fromisoformat(str(result.departure_time)).time()
                            if result_time != alert.sailing_time:
                                continue  # Skip, different sailing time

                        # Check cabin availability
                        cabin_types = getattr(result, "cabin_types", [])

                        # If alert has specific cabin type preference, check that type
                        if alert.cabin_type:
                            # Map alert cabin types to ferry API types
                            cabin_type_map = {
                                "inside": "interior",
                                "interior": "interior",
                                "outside": "exterior",
                                "exterior": "exterior",
                                "balcony": "balcony",
                                "suite": "suite"
                            }
                            ferry_cabin_type = cabin_type_map.get(alert.cabin_type.lower(), alert.cabin_type.lower())
                            available_cabins = [c for c in cabin_types if c.get("type") == ferry_cabin_type and c.get("available", 0) >= (alert.num_cabins or 1)] if cabin_types else []
                        else:
                            # Any cabin type is acceptable
                            available_cabins = [c for c in cabin_types if c.get("available", 0) >= (alert.num_cabins or 1)] if cabin_types else []

                        if available_cabins:
                            availability_found = True
                            cabin_type_str = f" ({ferry_cabin_type})" if alert.cabin_type else ""
                            logger.info(f"🛏️ Found cabin availability{cabin_type_str}: {len(available_cabins)} cabin types available on {result.operator}")
                            break

                elif alert.alert_type == "passenger":
                    # Check if route has passenger capacity
                    # Call async ferry search (run in sync context)
                    results = asyncio.run(ferry_service.search_ferries(**search_params))

                    # Check if any sailing has passenger space
                    total_passengers = alert.num_adults + alert.num_children + alert.num_infants
                    for result in results:
                        # Check operator match (if alert is for specific operator)
                        if alert.operator and result.operator != alert.operator:
                            continue  # Skip, different operator

                        # Check sailing time match (if alert is for specific sailing time)
                        if alert.sailing_time:
                            result_time = datetime.fromisoformat(str(result.departure_time)).time()
                            if result_time != alert.sailing_time:
                                continue  # Skip, different sailing time

                        available_spaces = getattr(result, "available_spaces", {})
                        passengers_available = available_spaces.get("passengers", 0) if isinstance(available_spaces, dict) else 0
                        if passengers_available >= total_passengers:
                            availability_found = True
                            logger.info(f"👥 Found passenger space: {passengers_available} seats available on {result.operator} at {result_time}")
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
        # Build complete search URL with all parameters
        # Use FRONTEND_URL env var, or BASE_URL, or default to localhost with HTTPS
        base_url = os.getenv('FRONTEND_URL', os.getenv('BASE_URL', 'https://localhost:3001'))

        # Ensure HTTPS scheme for all URLs
        if base_url.startswith('http://'):
            base_url = base_url.replace('http://', 'https://')

        # Build URL parameters
        url_params = [
            f"from={alert.departure_port}",
            f"to={alert.arrival_port}",
            f"date={alert.departure_date.isoformat()}",
            f"adults={alert.num_adults}",
            f"children={alert.num_children}",
            f"infants={alert.num_infants}"
        ]

        # Add round trip parameters if applicable
        if alert.is_round_trip and alert.return_date:
            url_params.append(f"returnDate={alert.return_date.isoformat()}")

        # Add vehicle parameters if applicable
        if alert.vehicle_type:
            url_params.append(f"vehicleType={alert.vehicle_type}")
            if alert.vehicle_length_cm:
                url_params.append(f"vehicleLength={alert.vehicle_length_cm}")

        # Add operator filter if specified
        if alert.operator:
            url_params.append(f"operator={alert.operator}")

        # Add sailing time filter if specified
        if alert.sailing_time:
            url_params.append(f"sailingTime={alert.sailing_time.strftime('%H:%M')}")

        # Combine into full search URL
        search_url = f"{base_url}/search?{'&'.join(url_params)}"

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
            "num_infants": alert.num_infants,
            "vehicle_type": alert.vehicle_type,
            "vehicle_length_cm": alert.vehicle_length_cm,
            "cabin_type": alert.cabin_type,
            "num_cabins": alert.num_cabins,
            "operator": alert.operator,
            "sailing_time": alert.sailing_time.strftime("%H:%M") if alert.sailing_time else None,
            "search_url": search_url
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
