"""
Celery tasks for checking price changes on saved routes and sending alerts.
Runs periodically to check if prices have changed on watched routes.
Failed tasks are stored in dead-letter queue (Redis + PostgreSQL) for recovery.
"""
import os
import logging
import asyncio
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy import and_, or_

from app.database import SessionLocal
from app.models.price_alert import PriceAlert, PriceAlertStatusEnum
from app.models.user import User
from app.services.ferry_service import FerryService
from app.services.email_service import email_service
from app.services.push_notification_service import push_notification_service
from app.celery_app import celery_app
from app.tasks.base_task import PriceAlertTask

logger = logging.getLogger(__name__)


@celery_app.task(
    base=PriceAlertTask,
    name="app.tasks.price_alert_tasks.check_price_alerts",
    bind=True
)
def check_price_alerts_task(self):
    """
    Periodic task to check all active price alerts for price changes.

    This task:
    1. Finds all active price alerts that haven't been checked recently
    2. Queries ferry APIs to get current prices
    3. Compares with stored prices and calculates changes
    4. Sends notifications when price thresholds are exceeded
    5. Updates price history (current, lowest, highest)

    Runs every 2-4 hours (configured in celery beat schedule)
    """
    db = SessionLocal()
    try:
        logger.info("💰 Starting price alerts check...")

        now = datetime.now(timezone.utc)

        # 1. Expire old alerts (older than expires_at)
        expired_count = db.query(PriceAlert).filter(
            and_(
                PriceAlert.status == PriceAlertStatusEnum.ACTIVE.value,
                PriceAlert.expires_at.isnot(None),
                PriceAlert.expires_at < now
            )
        ).update({"status": PriceAlertStatusEnum.EXPIRED.value})

        if expired_count > 0:
            logger.info(f"⏰ Expired {expired_count} old price alerts")

        db.commit()

        # 2. Get active alerts that need checking
        # Cooldown period to avoid excessive API calls (check every 2 hours max)
        cooldown_period = now - timedelta(hours=2)

        alerts = db.query(PriceAlert).filter(
            and_(
                PriceAlert.status == PriceAlertStatusEnum.ACTIVE.value,
                or_(
                    PriceAlert.last_checked_at.is_(None),
                    PriceAlert.last_checked_at < cooldown_period
                )
            )
        ).limit(50).all()  # Process max 50 alerts per run (to avoid API rate limits)

        if not alerts:
            logger.info("✅ No active price alerts to check")
            return {"status": "success", "checked": 0, "notified": 0}

        logger.info(f"📋 Found {len(alerts)} active price alerts to check")

        # 3. Group alerts by route to minimize API calls
        route_alerts: Dict[str, List[PriceAlert]] = {}
        for alert in alerts:
            route_key = f"{alert.departure_port}_{alert.arrival_port}"
            if route_key not in route_alerts:
                route_alerts[route_key] = []
            route_alerts[route_key].append(alert)

        logger.info(f"🗺️ Grouped into {len(route_alerts)} unique routes")

        # 4. Check each alert individually (since each may have different date ranges)
        ferry_service = FerryService()
        notified_count = 0
        checked_count = 0

        for alert in alerts:
            try:
                # Determine date range to search
                today = datetime.now().date()

                if alert.date_from and alert.date_to:
                    # User specified a date range - search across all dates in range
                    # Skip if date range is in the past
                    if alert.date_to < today:
                        logger.debug(f"Alert {alert.id}: date range is in the past, skipping")
                        alert.last_checked_at = now
                        continue

                    # Adjust start date if it's in the past
                    start_date = max(alert.date_from, today)
                    end_date = alert.date_to

                    # Search each day in the range and find the best price
                    best_price = 999999
                    best_date = None

                    current_date = start_date
                    while current_date <= end_date:
                        search_params = {
                            "departure_port": alert.departure_port,
                            "arrival_port": alert.arrival_port,
                            "departure_date": current_date,
                            "adults": 1,
                            "children": 0,
                            "infants": 0,
                        }

                        results = asyncio.run(ferry_service.search_ferries(**search_params))

                        for result in results:
                            if hasattr(result, 'prices') and result.prices:
                                adult_price = result.prices.get('adult', 0)
                                if adult_price and adult_price > 0 and adult_price < best_price:
                                    best_price = adult_price
                                    best_date = current_date

                        current_date += timedelta(days=1)

                    current_price = best_price
                    price_date = best_date

                elif alert.date_from:
                    # Single date specified
                    search_date = alert.date_from if alert.date_from >= today else today + timedelta(days=7)

                    search_params = {
                        "departure_port": alert.departure_port,
                        "arrival_port": alert.arrival_port,
                        "departure_date": search_date,
                        "adults": 1,
                        "children": 0,
                        "infants": 0,
                    }

                    results = asyncio.run(ferry_service.search_ferries(**search_params))

                    current_price = 999999
                    for result in results:
                        if hasattr(result, 'prices') and result.prices:
                            adult_price = result.prices.get('adult', 0)
                            if adult_price and adult_price > 0 and adult_price < current_price:
                                current_price = adult_price

                    price_date = search_date

                else:
                    # No date specified - track general route price (next 7 days sample)
                    search_date = today + timedelta(days=7)

                    search_params = {
                        "departure_port": alert.departure_port,
                        "arrival_port": alert.arrival_port,
                        "departure_date": search_date,
                        "adults": 1,
                        "children": 0,
                        "infants": 0,
                    }

                    results = asyncio.run(ferry_service.search_ferries(**search_params))

                    current_price = 999999
                    for result in results:
                        if hasattr(result, 'prices') and result.prices:
                            adult_price = result.prices.get('adult', 0)
                            if adult_price and adult_price > 0 and adult_price < current_price:
                                current_price = adult_price

                    price_date = search_date

                if current_price == 999999:
                    logger.debug(f"Could not determine price for alert {alert.id}")
                    alert.last_checked_at = now
                    continue

                route_key = f"{alert.departure_port}_{alert.arrival_port}"
                logger.debug(f"Alert {alert.id} ({route_key}): best price = {current_price} on {price_date}")

                # Process this alert
                checked_count += 1
                alert.last_checked_at = now

                # Update best price date if we have one
                if price_date:
                    alert.best_price_date = price_date

                # Skip if this is the first price check (no comparison possible)
                if alert.initial_price is None:
                    alert.initial_price = current_price
                    alert.current_price = current_price
                    alert.lowest_price = current_price
                    alert.highest_price = current_price
                    logger.info(f"📝 Initial price set for alert {alert.id}: {current_price}")
                    continue

                # Calculate price change from initial price
                old_price = alert.current_price or alert.initial_price
                price_change = current_price - alert.initial_price
                price_change_percent = (price_change / alert.initial_price) * 100 if alert.initial_price > 0 else 0

                # Check if this is a new lowest or highest price
                is_new_low = alert.lowest_price is None or current_price < alert.lowest_price
                is_new_high = alert.highest_price is None or current_price > alert.highest_price

                # Update price history
                alert.current_price = current_price
                if is_new_low:
                    alert.lowest_price = current_price
                if is_new_high:
                    alert.highest_price = current_price

                # Check if notification should be sent
                should_notify = False
                notification_reason = ""

                # Check target price
                if alert.target_price and current_price <= alert.target_price:
                    should_notify = True
                    notification_reason = f"Price dropped to your target price of €{alert.target_price}"

                # Check price drop threshold - only notify on NEW LOW prices
                elif alert.notify_on_drop and is_new_low and price_change_percent <= -alert.price_threshold_percent:
                    should_notify = True
                    notification_reason = f"New low! Price dropped {abs(price_change_percent):.0f}% from €{alert.initial_price:.0f}"

                # Check price increase threshold - only notify on NEW HIGH prices
                elif alert.notify_on_increase and is_new_high and price_change_percent >= alert.price_threshold_percent:
                    should_notify = True
                    notification_reason = f"Price increased {price_change_percent:.0f}% from €{alert.initial_price:.0f}"

                # Check any change (still use threshold to avoid spam)
                elif alert.notify_any_change and abs(price_change_percent) >= alert.price_threshold_percent:
                    if is_new_low:
                        should_notify = True
                        notification_reason = f"New low! Price dropped {abs(price_change_percent):.0f}%"
                    elif is_new_high:
                        should_notify = True
                        notification_reason = f"Price increased {price_change_percent:.0f}%"

                # Minimum 1 hour between notifications to prevent spam
                if should_notify and alert.last_notified_at:
                    minutes_since_notification = (now - alert.last_notified_at).total_seconds() / 60
                    if minutes_since_notification < 60:  # 1 hour minimum
                        logger.debug(f"Skipping notification for alert {alert.id} (notified {minutes_since_notification:.1f}m ago)")
                        should_notify = False

                if should_notify:
                    logger.info(f"💸 {notification_reason} for alert {alert.id}: €{old_price} → €{current_price}")

                    # Send notification
                    _send_price_alert_notification(
                        alert=alert,
                        old_price=old_price,
                        new_price=current_price,
                        price_change_percent=price_change_percent,
                        notification_reason=notification_reason,
                        best_date=price_date,
                        db=db
                    )

                    # Update notification tracking
                    alert.last_notified_at = now
                    alert.notification_count += 1
                    notified_count += 1

                    # Mark as triggered if target price reached
                    if alert.target_price and current_price <= alert.target_price:
                        alert.status = PriceAlertStatusEnum.TRIGGERED.value

            except Exception as e:
                logger.error(f"Error checking alert {alert.id}: {str(e)}", exc_info=True)
                continue

        # Commit all updates
        db.commit()

        logger.info(f"🎉 Price check complete: checked {checked_count}, notified {notified_count}")

        return {
            "status": "success",
            "checked": checked_count,
            "notified": notified_count,
            "expired": expired_count
        }

    except Exception as e:
        logger.error(f"Error in price alerts check task: {str(e)}", exc_info=True)
        db.rollback()
        raise
    finally:
        db.close()


def _send_price_alert_notification(
    alert: PriceAlert,
    old_price: float,
    new_price: float,
    price_change_percent: float,
    notification_reason: str,
    db,
    best_date=None
):
    """Send email and push notification for price change."""
    try:
        # Get user for push notification
        user = None
        if alert.user_id:
            user = db.query(User).filter(User.id == alert.user_id).first()

        # Send push notification if user has a push token
        if user and user.push_token:
            try:
                push_notification_service.send_price_alert(
                    push_token=user.push_token,
                    departure_port=alert.departure_port.title(),
                    arrival_port=alert.arrival_port.title(),
                    old_price=old_price,
                    new_price=new_price,
                    price_change_percent=price_change_percent,
                    alert_id=alert.id,
                    best_date=best_date.isoformat() if best_date else None,
                )
                logger.info(f"📱 Push notification sent for price alert {alert.id}")
            except Exception as e:
                logger.error(f"Failed to send push notification for price alert {alert.id}: {e}")

        # Build search URL
        base_url = os.getenv('FRONTEND_URL', os.getenv('BASE_URL', 'https://localhost:3001'))
        if base_url.startswith('http://'):
            base_url = base_url.replace('http://', 'https://')

        url_params = [
            f"from={alert.departure_port}",
            f"to={alert.arrival_port}",
        ]

        # Use best_date if available, otherwise fall back to date_from
        search_date = best_date or alert.date_from
        if search_date:
            url_params.append(f"date={search_date.isoformat()}")

        search_url = f"{base_url}/search?{'&'.join(url_params)}"

        # Prepare email data
        alert_data = {
            "alert_id": alert.id,
            "departure_port": alert.departure_port.title(),
            "arrival_port": alert.arrival_port.title(),
            "old_price": old_price,
            "new_price": new_price,
            "price_change": abs(new_price - old_price),
            "price_change_percent": abs(price_change_percent),
            "is_price_drop": new_price < old_price,
            "initial_price": alert.initial_price,
            "lowest_price": alert.lowest_price,
            "target_price": alert.target_price,
            "notification_reason": notification_reason,
            "search_url": search_url,
            "best_date": best_date.isoformat() if best_date else None,
            "date_from": alert.date_from.isoformat() if alert.date_from else None,
            "date_to": alert.date_to.isoformat() if alert.date_to else None,
        }

        # Send email
        email_service.send_price_alert(
            alert_data=alert_data,
            to_email=alert.email
        )

        logger.info(f"📧 Price alert notification sent to {alert.email}")

    except Exception as e:
        logger.error(f"Failed to send price alert notification: {str(e)}", exc_info=True)
        raise


@celery_app.task(
    base=PriceAlertTask,
    name="app.tasks.price_alert_tasks.cleanup_old_price_alerts",
    bind=True
)
def cleanup_old_price_alerts_task(self):
    """
    Cleanup task to delete very old cancelled/expired price alerts.
    Runs daily to keep database clean while preserving analytics data.
    """
    db = SessionLocal()
    try:
        # Delete alerts older than 180 days that are not active
        cleanup_date = datetime.now(timezone.utc) - timedelta(days=180)

        deleted_count = db.query(PriceAlert).filter(
            and_(
                PriceAlert.status.in_([
                    PriceAlertStatusEnum.CANCELLED.value,
                    PriceAlertStatusEnum.EXPIRED.value
                ]),
                PriceAlert.created_at < cleanup_date
            )
        ).delete()

        db.commit()

        if deleted_count > 0:
            logger.info(f"🧹 Cleaned up {deleted_count} old price alerts")

        return {"status": "success", "deleted": deleted_count}

    except Exception as e:
        logger.error(f"Error in price alert cleanup task: {str(e)}", exc_info=True)
        db.rollback()
        raise
    finally:
        db.close()


# Alias for celery beat schedule
check_price_alerts = check_price_alerts_task
cleanup_old_price_alerts = cleanup_old_price_alerts_task
