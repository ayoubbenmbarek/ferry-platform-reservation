"""
Celery tasks for checking ferry availability and sending alerts.
Runs periodically to check if previously unavailable routes now have space.
Failed tasks are stored in dead-letter queue (Redis + PostgreSQL) for recovery.
"""
import os
import logging
import asyncio
import time
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any
from collections import defaultdict
from sqlalchemy import and_, or_

from app.database import SessionLocal
from app.models.availability_alert import AvailabilityAlert, AlertStatusEnum
from app.models.user import User
from app.services.ferry_service import FerryService
from app.services.email_service import email_service
from app.services.push_notification_service import push_notification_service
from app.celery_app import celery_app
from app.tasks.base_task import AvailabilityTask

logger = logging.getLogger(__name__)


@celery_app.task(
    base=AvailabilityTask,
    name="app.tasks.availability_check_tasks.check_availability_alerts",
    bind=True
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
            logger.info(f"⏰ Expired {expired_count} old alerts (past expires_at)")

        # 2. Also expire alerts for past departure dates (ferry already sailed)
        departed_count = db.query(AvailabilityAlert).filter(
            and_(
                AvailabilityAlert.status.in_([AlertStatusEnum.ACTIVE.value, AlertStatusEnum.NOTIFIED.value]),
                AvailabilityAlert.departure_date < now.date()
            )
        ).update({"status": AlertStatusEnum.EXPIRED.value})

        if departed_count > 0:
            logger.info(f"🚢 Expired {departed_count} alerts for departed ferries")

        db.commit()

        # 3. Get active alerts that need checking
        # Only check alerts for future dates
        # Cooldown: 30 minutes to avoid FerryHopper rate limits (429 errors)
        cooldown_period = now - timedelta(minutes=30)

        alerts = db.query(AvailabilityAlert).filter(
            and_(
                AvailabilityAlert.status == AlertStatusEnum.ACTIVE.value,
                AvailabilityAlert.departure_date >= now.date(),
                or_(
                    AvailabilityAlert.last_checked_at.is_(None),
                    AvailabilityAlert.last_checked_at < cooldown_period
                )
            )
        ).limit(50).all()  # Process max 50 alerts per run (reduced for rate limits)

        if not alerts:
            logger.info("✅ No active alerts to check")
            return {"status": "success", "checked": 0, "notified": 0}

        logger.info(f"📋 Found {len(alerts)} active alerts to check")

        # 3. Check each alert
        ferry_service = FerryService()
        notified_count = 0
        checked_count = 0

        # Pre-fetch cabin count ONCE outside the loop (fixes N+1 query)
        from app.models.ferry import Cabin
        available_cabins_count = db.query(Cabin).filter(Cabin.is_available == True).count()

        # Group alerts by route+date to minimize API calls
        route_cache = {}  # Cache search results by route key

        # Rate limiting: delay between API calls (3 seconds)
        API_CALL_DELAY = 3

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

                # Build route cache key (without vehicle info for basic searches)
                route_key = f"{alert.departure_port}:{alert.arrival_port}:{alert.departure_date}:{alert.num_adults}:{alert.num_children}:{alert.num_infants}"

                if alert.alert_type == "vehicle":
                    # Check if route has vehicle capacity
                    search_params["vehicles"] = [{
                        "type": alert.vehicle_type or "car",
                        "length": alert.vehicle_length_cm or 450,
                        "width": 180,
                        "height": 150
                    }]
                    # Vehicle searches have unique cache keys
                    route_key = f"{route_key}:vehicle:{alert.vehicle_type}"

                    # Check route cache first
                    if route_key in route_cache:
                        results = route_cache[route_key]
                        logger.debug(f"📦 Using cached results for {route_key}")
                    else:
                        # Rate limit: add delay before API call
                        time.sleep(API_CALL_DELAY)
                        # Call async ferry search (run in sync context)
                        results = asyncio.run(ferry_service.search_ferries(**search_params))
                        route_cache[route_key] = results

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

                    # IMPORTANT: Also check if cabins exist in database
                    # The frontend shows cabins from DB, not from ferry search results
                    # Using pre-fetched count from outside the loop (fixes N+1 query)
                    if available_cabins_count == 0:
                        logger.debug(f"🛏️ Alert {alert.id}: No cabins in database, skipping notification")
                        continue  # Skip this alert - no cabins to show user

                    # Check route cache first
                    if route_key in route_cache:
                        results = route_cache[route_key]
                        logger.debug(f"📦 Using cached results for {route_key}")
                    else:
                        # Rate limit: add delay before API call
                        time.sleep(API_CALL_DELAY)
                        # Call async ferry search (run in sync context)
                        results = asyncio.run(ferry_service.search_ferries(**search_params))
                        route_cache[route_key] = results

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

                        # Log cabin types for debugging
                        logger.debug(f"🔍 Alert {alert.id}: Checking cabins for {result.operator} at {getattr(result, 'departure_time', 'unknown')}")
                        logger.debug(f"   Cabin types available: {cabin_types}")

                        # Filter out deck/seat types - they are NOT real cabins
                        real_cabins = [c for c in cabin_types if c.get("type") not in ("deck", "seat", "reclining_seat")] if cabin_types else []

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
                            available_cabins = [c for c in real_cabins if c.get("type") == ferry_cabin_type and c.get("available", 0) >= (alert.num_cabins or 1)]
                        else:
                            # Any cabin type is acceptable (but NOT deck/seat)
                            available_cabins = [c for c in real_cabins if c.get("available", 0) >= (alert.num_cabins or 1)]

                        if available_cabins:
                            availability_found = True
                            cabin_type_str = f" ({alert.cabin_type})" if alert.cabin_type else " (any type)"
                            logger.info(f"🛏️ Found cabin availability{cabin_type_str}: {len(available_cabins)} cabin types available on {result.operator}")
                            break

                elif alert.alert_type == "passenger":
                    # Check if route has passenger capacity
                    # Check route cache first
                    if route_key in route_cache:
                        results = route_cache[route_key]
                        logger.debug(f"📦 Using cached results for {route_key}")
                    else:
                        # Rate limit: add delay before API call
                        time.sleep(API_CALL_DELAY)
                        # Call async ferry search (run in sync context)
                        results = asyncio.run(ferry_service.search_ferries(**search_params))
                        route_cache[route_key] = results

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
                            departure_time_str = datetime.fromisoformat(str(result.departure_time)).strftime("%H:%M")
                            logger.info(f"👥 Found passenger space: {passengers_available} seats available on {result.operator} at {departure_time_str}")
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

        api_calls_made = len(route_cache)
        logger.info(f"🎉 Availability check complete: checked {checked_count}, notified {notified_count}, API calls: {api_calls_made}")

        return {
            "status": "success",
            "checked": checked_count,
            "notified": notified_count,
            "expired": expired_count,
            "api_calls": api_calls_made
        }

    except Exception as e:
        logger.error(f"Error in availability check task: {str(e)}", exc_info=True)
        db.rollback()
        raise
    finally:
        db.close()


def _send_availability_notification(alert: AvailabilityAlert, db):
    """Send email and push notification when availability is found."""
    try:
        # Send push notification if user has a push token
        if alert.user_id:
            user = db.query(User).filter(User.id == alert.user_id).first()
            if user and user.push_token:
                try:
                    push_notification_service.send_availability_alert(
                        push_token=user.push_token,
                        alert_type=alert.alert_type,
                        departure_port=alert.departure_port.title(),
                        arrival_port=alert.arrival_port.title(),
                        departure_date=alert.departure_date.strftime("%B %d, %Y"),
                        alert_id=alert.id,
                        booking_id=alert.booking_id,
                    )
                    logger.info(f"📱 Push notification sent for alert {alert.id}")
                except Exception as e:
                    logger.error(f"Failed to send push notification for alert {alert.id}: {e}")
                    # Continue with email even if push fails
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

        # Build upgrade URL for alerts linked to existing bookings
        upgrade_url = None
        if alert.booking_id:
            journey_param = f"&journey={alert.journey_type}" if alert.journey_type else ""
            upgrade_url = f"{base_url}/booking/{alert.booking_id}/add-cabin?alertId={alert.id}{journey_param}"
            logger.info(f"📎 Alert {alert.id} has booking_id={alert.booking_id}, upgrade_url={upgrade_url}")
        else:
            logger.info(f"📎 Alert {alert.id} has no booking_id, using search_url")

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
            "search_url": search_url,
            "booking_id": alert.booking_id,
            "journey_type": alert.journey_type,
            "upgrade_url": upgrade_url
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


@celery_app.task(
    base=AvailabilityTask,
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
