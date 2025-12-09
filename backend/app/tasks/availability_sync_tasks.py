"""
Celery tasks for syncing availability with external ferry operator APIs.

Real-time updates happen in TWO ways:

1. INSTANT: When a booking is made on OUR platform
   - Booking service calls `publish_availability_now()`
   - Update is broadcast to all WebSocket clients immediately

2. FALLBACK: Periodic sync with external APIs (every 2 min)
   - Catches changes made outside our platform
   - Syncs with CTN, GNV, Corsica Linea APIs
"""

import logging
from datetime import datetime, timezone
import json
import random

from app.celery_app import celery_app

logger = logging.getLogger(__name__)

# Cache keys
AVAILABILITY_CACHE_KEY = "availability:cache:{route}:{ferry_id}"
LAST_SYNC_KEY = "availability:last_sync:{route}"


def get_redis_client():
    """Get Redis client for caching."""
    import redis
    import os
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6399/0")
    return redis.from_url(redis_url, decode_responses=True)


def publish_availability_now(
    route: str,
    ferry_id: str,
    departure_time: str,
    availability: dict
):
    """
    Publish availability update IMMEDIATELY via Redis pub/sub.

    Call this from booking service when a booking is created/cancelled
    for instant real-time updates.

    Args:
        route: Route identifier (e.g., "TUNIS-MARSEILLE")
        ferry_id: Ferry identifier
        departure_time: Departure datetime ISO string
        availability: Dict with seats, cabins, vehicles availability
    """
    import redis
    import os

    try:
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6399/2")
        r = redis.from_url(redis_url, decode_responses=True)

        channel = f"availability:{route.upper()}"
        payload = {
            "ferry_id": ferry_id,
            "route": route,
            "departure_time": departure_time,
            "availability": availability,
            "source": "internal",  # Change made on our platform
            "updated_at": datetime.now(timezone.utc).isoformat()
        }

        r.publish(channel, json.dumps(payload))
        logger.info(f"📢 INSTANT availability update published for {route}: {ferry_id}")

        return True
    except Exception as e:
        logger.error(f"Failed to publish instant availability update: {e}")
        return False


def get_current_availability(_route: str, _ferry_id: str, _db=None) -> dict:
    """
    Get current availability from our database.

    In production, this queries the booking counts for a specific ferry.
    """
    # TODO: Implement actual database query using _route, _ferry_id, _db
    # For now, return simulated data
    return {
        "seats": {
            "total": 500,
            "available": random.randint(50, 400),
            "sold": random.randint(100, 450)
        },
        "cabins": {
            "inside": {"total": 50, "available": random.randint(5, 30)},
            "outside": {"total": 30, "available": random.randint(2, 20)},
            "suite": {"total": 10, "available": random.randint(0, 5)}
        },
        "vehicles": {
            "car": {"total": 200, "available": random.randint(20, 150)},
            "motorcycle": {"total": 50, "available": random.randint(10, 40)},
            "camper": {"total": 20, "available": random.randint(0, 15)}
        }
    }


@celery_app.task(
    bind=True,
    name="app.tasks.availability_sync_tasks.sync_external_availability",
    max_retries=3,
    default_retry_delay=60
)
def sync_external_availability(self, routes: list = None):
    """
    Sync availability with external ferry operator APIs.

    This is the FALLBACK mechanism for changes made outside our platform.
    Runs every 2 minutes to catch bookings made on operator websites.
    """
    redis_client = get_redis_client()

    try:
        logger.info("🔄 Starting external availability sync...")

        # Get routes to sync
        if routes is None:
            routes = get_active_routes()

        synced_count = 0
        changed_count = 0

        for route in routes:
            try:
                # Fetch availability from external API
                availability_data = fetch_external_availability(route)

                if availability_data:
                    for ferry in availability_data:
                        ferry_id = ferry.get("ferry_id")
                        departure_time = ferry.get("departure_time")
                        availability = ferry.get("availability", {})

                        # Check if availability changed from cached state
                        cache_key = AVAILABILITY_CACHE_KEY.format(
                            route=route,
                            ferry_id=ferry_id
                        )
                        cached = redis_client.get(cache_key)
                        current_state = json.dumps(availability, sort_keys=True)

                        if cached != current_state:
                            # Availability changed! Publish update
                            publish_external_change(
                                route=route,
                                ferry_id=ferry_id,
                                departure_time=departure_time,
                                availability=availability
                            )

                            # Update cache
                            redis_client.setex(cache_key, 3600, current_state)
                            changed_count += 1

                            logger.info(
                                f"📢 External change detected: {route} - {ferry_id}"
                            )

                        synced_count += 1

                # Update last sync time
                redis_client.set(
                    LAST_SYNC_KEY.format(route=route),
                    datetime.now(timezone.utc).isoformat()
                )

            except Exception as e:
                logger.error(f"Failed to sync route {route}: {e}")
                continue

        logger.info(
            f"✅ External sync complete: {synced_count} ferries, "
            f"{changed_count} changes detected"
        )

        return {
            "status": "success",
            "synced": synced_count,
            "changed": changed_count
        }

    except Exception as e:
        logger.error(f"External availability sync failed: {e}")
        raise self.retry(exc=e)


def publish_external_change(route: str, ferry_id: str, departure_time: str, availability: dict):
    """Publish availability change detected from external API."""
    import redis
    import os

    redis_url = os.getenv("REDIS_URL", "redis://localhost:6399/2")
    r = redis.from_url(redis_url, decode_responses=True)

    channel = f"availability:{route.upper()}"
    payload = {
        "ferry_id": ferry_id,
        "route": route,
        "departure_time": departure_time,
        "availability": availability,
        "source": "external",  # Change detected from external API
        "updated_at": datetime.now(timezone.utc).isoformat()
    }

    r.publish(channel, json.dumps(payload))


def get_active_routes() -> list:
    """Get list of active routes to monitor."""
    return [
        "TUNIS-MARSEILLE",
        "TUNIS-GENOA",
        "TUNIS-CIVITAVECCHIA",
        "TUNIS-PALERMO",
        "MARSEILLE-TUNIS",
        "GENOA-TUNIS",
        "CIVITAVECCHIA-TUNIS",
        "PALERMO-TUNIS",
    ]


def fetch_external_availability(route: str) -> list:
    """
    Fetch availability from external ferry operator API.

    In production, this calls actual operator APIs:
    - CTN API: https://api.ctn.com.tn/...
    - GNV API: https://api.gnv.it/...
    - Corsica Linea API: https://api.corsicalinea.com/...

    For now, returns simulated data that changes randomly
    to demonstrate the sync mechanism.
    """
    from datetime import timedelta

    parts = route.split("-")
    if len(parts) != 2:
        return []

    departure_port, arrival_port = parts
    now = datetime.now(timezone.utc)
    ferries = []

    # Generate 3 ferries for the next 3 days
    for day_offset in range(3):
        departure_time = now + timedelta(days=day_offset, hours=20)

        # Simulate changing availability (random each sync)
        total_seats = 500
        sold_seats = random.randint(100, 450)

        ferries.append({
            "ferry_id": f"{departure_port[:3]}-{arrival_port[:3]}-{day_offset + 1:03d}",
            "departure_time": departure_time.isoformat(),
            "arrival_time": (departure_time + timedelta(hours=21)).isoformat(),
            "availability": {
                "seats": {
                    "total": total_seats,
                    "available": total_seats - sold_seats,
                    "sold": sold_seats
                },
                "cabins": {
                    "inside": {"total": 50, "available": random.randint(5, 30)},
                    "outside": {"total": 30, "available": random.randint(2, 20)},
                    "suite": {"total": 10, "available": random.randint(0, 5)}
                },
                "vehicles": {
                    "car": {"total": 200, "available": random.randint(20, 150)},
                    "motorcycle": {"total": 50, "available": random.randint(10, 40)},
                    "camper": {"total": 20, "available": random.randint(0, 15)}
                }
            }
        })

    return ferries


@celery_app.task(
    bind=True,
    name="app.tasks.availability_sync_tasks.sync_single_ferry",
    max_retries=3,
    default_retry_delay=30
)
def sync_single_ferry(self, route: str, ferry_id: str):
    """
    Sync availability for a single ferry immediately.
    Called after a booking to ensure external API is also updated.
    """
    try:
        logger.info(f"🔄 Syncing single ferry: {route} - {ferry_id}")

        availability_data = fetch_external_availability(route)

        for ferry in availability_data:
            if ferry.get("ferry_id") == ferry_id:
                publish_external_change(
                    route=route,
                    ferry_id=ferry_id,
                    departure_time=ferry.get("departure_time"),
                    availability=ferry.get("availability", {})
                )
                return {"status": "success", "ferry_id": ferry_id}

        return {"status": "not_found", "ferry_id": ferry_id}

    except Exception as e:
        logger.error(f"Single ferry sync failed: {e}")
        raise self.retry(exc=e)
