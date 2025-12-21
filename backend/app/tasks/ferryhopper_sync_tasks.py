"""
FerryHopper Data Sync Tasks

Background tasks for syncing data from FerryHopper API:
- Port synchronization
- Price history recording
- Route statistics aggregation
- Fare calendar pre-computation
"""

import logging
from datetime import datetime, timezone, timedelta, date
from typing import List, Dict, Optional, Set
import statistics

from celery import shared_task

from app.database import SessionLocal
from app.models.ferry import Port, Cabin, CabinTypeEnum, BedTypeEnum
from app.models.price_history import (
    PriceHistory,
    RouteStatistics,
    FareCalendarCache,
    PriceTrendEnum
)
from app.config import settings

logger = logging.getLogger(__name__)


# =============================================================================
# Port Synchronization Task
# =============================================================================

@shared_task(
    name="app.tasks.ferryhopper_sync_tasks.sync_ports_from_ferryhopper",
    bind=True,
    max_retries=3,
    default_retry_delay=300
)
def sync_ports_from_ferryhopper_task(self, language: str = "en"):
    """
    Sync ports from FerryHopper API to local database.

    Runs daily to keep port data fresh.
    Creates new ports, updates existing ones.
    """
    import asyncio

    logger.info("📍 Starting port sync from FerryHopper...")

    async def _sync_ports():
        from app.services.ferry_integrations.ferryhopper import FerryHopperIntegration

        integration = FerryHopperIntegration(
            api_key=settings.FERRYHOPPER_API_KEY,
            base_url=settings.FERRYHOPPER_BASE_URL
        )

        async with integration:
            # Fetch all ports from FerryHopper
            ferryhopper_ports = await integration.get_ports(language=language)
            logger.info(f"📍 Fetched {len(ferryhopper_ports)} ports from FerryHopper")
            return ferryhopper_ports

    try:
        # Run async fetch
        ferryhopper_ports = asyncio.get_event_loop().run_until_complete(_sync_ports())
    except RuntimeError:
        # If no event loop, create one
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            ferryhopper_ports = loop.run_until_complete(_sync_ports())
        finally:
            loop.close()

    if not ferryhopper_ports:
        logger.warning("No ports returned from FerryHopper API")
        return {"status": "error", "message": "No ports returned"}

    db = SessionLocal()
    created_count = 0
    updated_count = 0

    try:
        for fh_port in ferryhopper_ports:
            port_code = fh_port.get("code", "")
            if not port_code:
                continue

            # Extract coordinates
            coords = fh_port.get("coordinates", {})
            lat = None
            lon = None
            if coords:
                try:
                    lat = float(coords.get("lat", 0)) if coords.get("lat") else None
                    lon = float(coords.get("lon", 0)) if coords.get("lon") else None
                except (ValueError, TypeError):
                    pass

            # Check if port exists
            existing_port = db.query(Port).filter(Port.code == port_code).first()

            port_data = {
                "ferryhopper_code": port_code,
                "name": fh_port.get("name", port_code),
                "country": fh_port.get("countryName", "Unknown"),
                "country_code": fh_port.get("countryCode", "XX"),
                "region": fh_port.get("region"),
                "latitude": lat,
                "longitude": lon,
                "connected_ports": fh_port.get("directlyConnectedPortCodes", []),
                "supports_search_quotes": fh_port.get("supportsSearchQuotes", False),
                "gates": fh_port.get("gates", []),
                "last_synced_at": datetime.now(timezone.utc),
                "sync_source": "ferryhopper"
            }

            if existing_port:
                # Update existing port
                for key, value in port_data.items():
                    if value is not None:
                        setattr(existing_port, key, value)
                updated_count += 1
            else:
                # Create new port
                new_port = Port(
                    code=port_code,
                    is_active=True,
                    **port_data
                )
                db.add(new_port)
                created_count += 1

        db.commit()
        logger.info(f"✅ Port sync complete: {created_count} created, {updated_count} updated")

        return {
            "status": "success",
            "created": created_count,
            "updated": updated_count,
            "total": len(ferryhopper_ports)
        }

    except Exception as e:
        logger.error(f"Error syncing ports: {e}", exc_info=True)
        db.rollback()
        raise self.retry(exc=e)
    finally:
        db.close()


# =============================================================================
# Accommodation Synchronization Task
# =============================================================================

@shared_task(
    name="app.tasks.ferryhopper_sync_tasks.sync_accommodations_from_ferryhopper",
    bind=True,
    max_retries=3,
    default_retry_delay=300
)
def sync_accommodations_from_ferryhopper_task(self, language: str = "en"):
    """
    Sync accommodation types from FerryHopper API to local database.

    Runs daily to keep accommodation catalog fresh.
    Creates cabin records for each FerryHopper accommodation type.
    """
    import asyncio
    from app.services.ferry_integrations.ferryhopper_mappings import map_ferryhopper_cabin_type

    logger.info("🛏️ Starting accommodation sync from FerryHopper...")

    async def _fetch_accommodations():
        from app.services.ferry_integrations.ferryhopper import FerryHopperIntegration

        integration = FerryHopperIntegration(
            api_key=settings.FERRYHOPPER_API_KEY,
            base_url=settings.FERRYHOPPER_BASE_URL
        )

        async with integration:
            accommodations = await integration.get_accommodations()
            logger.info(f"🛏️ Fetched {len(accommodations)} accommodations from FerryHopper")
            return accommodations

    try:
        # Run async fetch
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        try:
            ferryhopper_accommodations = loop.run_until_complete(_fetch_accommodations())
        finally:
            if loop.is_running():
                pass  # Don't close if running
            else:
                pass  # Keep loop for potential reuse
    except Exception as e:
        logger.error(f"Failed to fetch accommodations: {e}")
        raise self.retry(exc=e)

    if not ferryhopper_accommodations:
        logger.warning("No accommodations returned from FerryHopper API")
        return {"status": "warning", "message": "No accommodations returned"}

    db = SessionLocal()
    created_count = 0
    updated_count = 0

    try:
        for fh_acc in ferryhopper_accommodations:
            acc_code = fh_acc.get("code", "")
            if not acc_code:
                continue

            # Map to VoilaFerry cabin type
            vf_type = map_ferryhopper_cabin_type(acc_code)
            cabin_type_enum = CabinTypeEnum(vf_type)

            # Determine amenities based on accommodation type
            has_window = "WINDOW" in acc_code or "OUTSIDE" in acc_code or "EXTERIOR" in acc_code or "SEA_VIEW" in acc_code
            has_balcony = "BALCONY" in acc_code
            allows_pets = "PET" in acc_code
            has_bathroom = "CABIN" in acc_code or "SUITE" in acc_code

            # Determine bed type and occupancy based on accommodation type
            bed_type = BedTypeEnum.SINGLE
            max_occupancy = 1

            if "2_BED" in acc_code:
                bed_type = BedTypeEnum.TWIN
                max_occupancy = 2
            elif "4_BED" in acc_code:
                bed_type = BedTypeEnum.BUNK
                max_occupancy = 4
            elif "6_BED" in acc_code:
                bed_type = BedTypeEnum.BUNK
                max_occupancy = 6
            elif "DORM" in acc_code:
                bed_type = BedTypeEnum.BUNK
                max_occupancy = 6
            elif "CABIN" in acc_code or "SUITE" in acc_code:
                bed_type = BedTypeEnum.TWIN
                max_occupancy = 2
            elif "SEAT" in acc_code or "DECK" in acc_code:
                bed_type = BedTypeEnum.SINGLE
                max_occupancy = 1

            # Check if accommodation exists
            existing_cabin = db.query(Cabin).filter(
                Cabin.ferryhopper_code == acc_code
            ).first()

            cabin_data = {
                "ferryhopper_code": acc_code,
                "ferryhopper_name": fh_acc.get("name", acc_code),
                "ferryhopper_category": fh_acc.get("category"),
                "name": fh_acc.get("name", acc_code),
                "description": fh_acc.get("description"),
                "cabin_type": cabin_type_enum,
                "bed_type": bed_type,
                "max_occupancy": max_occupancy,
                "has_window": has_window,
                "has_balcony": has_balcony,
                "has_private_bathroom": has_bathroom,
                "allows_pets": allows_pets,
                "is_active": True,
                "is_available": True,
                "last_synced_at": datetime.now(timezone.utc),
                "sync_source": "ferryhopper",
            }

            if existing_cabin:
                # Update existing cabin
                for key, value in cabin_data.items():
                    if value is not None:
                        setattr(existing_cabin, key, value)
                updated_count += 1
            else:
                # Create new cabin
                new_cabin = Cabin(
                    operator="ferryhopper",
                    **cabin_data
                )
                db.add(new_cabin)
                created_count += 1

        db.commit()
        logger.info(f"✅ Accommodation sync complete: {created_count} created, {updated_count} updated")

        return {
            "status": "success",
            "created": created_count,
            "updated": updated_count,
            "total": len(ferryhopper_accommodations)
        }

    except Exception as e:
        logger.error(f"Error syncing accommodations: {e}", exc_info=True)
        db.rollback()
        raise self.retry(exc=e)
    finally:
        db.close()


# =============================================================================
# Price History Recording Task
# =============================================================================

# Popular routes to track (Tunisia-focused)
TRACKED_ROUTES = [
    # Tunisia from France
    ("MRS", "TUN", "Marseille → Tunis"),
    ("MRS", "TNZRZ", "Marseille → Zarzis"),
    # Tunisia from Italy
    ("GOA", "TUN", "Genoa → Tunis"),
    ("CIV", "TUN", "Civitavecchia → Tunis"),
    ("PLE", "TUN", "Palermo → Tunis"),
    ("SAL", "TUN", "Salerno → Tunis"),
    # Reverse routes
    ("TUN", "MRS", "Tunis → Marseille"),
    ("TUN", "GOA", "Tunis → Genoa"),
    ("TUN", "CIV", "Tunis → Civitavecchia"),
    ("TUN", "PLE", "Tunis → Palermo"),
]


@shared_task(
    name="app.tasks.ferryhopper_sync_tasks.record_price_history",
    bind=True,
    max_retries=3,
    default_retry_delay=600,
    soft_time_limit=540,  # 9 minutes soft limit
    time_limit=600  # 10 minutes hard limit
)
def record_price_history_task(self, days_ahead: int = 90):
    """
    Record price history for tracked routes.

    Runs daily to capture price snapshots for trend analysis.
    Records prices for the next X days for each tracked route.
    """
    import asyncio
    import time as time_module
    from datetime import date as date_type, datetime as datetime_type, timezone as tz, timedelta as td
    from app.services.ferry_service import FerryService
    from celery.exceptions import SoftTimeLimitExceeded

    start_time = time_module.time()
    max_runtime = 480  # Stop after 8 minutes to leave buffer

    logger.info(f"📊 Recording price history for {len(TRACKED_ROUTES)} routes...")

    db = SessionLocal()
    recorded_count = 0
    error_count = 0
    stopped_early = False

    async def run_all_searches():
        """Run all searches in a single async context to keep httpx session alive."""
        nonlocal recorded_count, error_count, stopped_early

        ferry_service = FerryService()
        today = date_type.today()
        # Search every 14 days instead of 7 to reduce API calls
        search_dates = [today + td(days=d) for d in range(7, days_ahead, 14)]

        for dep_code, arr_code, route_name in TRACKED_ROUTES:
            # Check if we're running out of time
            elapsed = time_module.time() - start_time
            if elapsed > max_runtime:
                logger.info(f"⏰ Stopping early after {elapsed:.0f}s to avoid timeout")
                stopped_early = True
                return

            route_id = f"{dep_code}_{arr_code}".lower()
            logger.debug(f"Recording prices for {route_name}")

            for search_date in search_dates:
                # Check time again for inner loop
                if time_module.time() - start_time > max_runtime:
                    stopped_early = True
                    return

                try:
                    # Add per-search timeout
                    results = await asyncio.wait_for(
                        ferry_service.search_ferries(
                            departure_port=dep_code,
                            arrival_port=arr_code,
                            departure_date=search_date,
                            adults=1,
                            children=0,
                            infants=0
                        ),
                        timeout=15.0
                    )

                    if not results:
                        continue

                    # Calculate price statistics
                    adult_prices = [r.prices.get("adult", 0) for r in results if r.prices.get("adult", 0) > 0]

                    if not adult_prices:
                        continue

                    lowest_price = min(adult_prices)
                    highest_price = max(adult_prices)
                    average_price = sum(adult_prices) / len(adult_prices)

                    # Get child/infant prices from first result
                    first_result = results[0]
                    child_price = first_result.prices.get("child")
                    infant_price = first_result.prices.get("infant")
                    vehicle_price = first_result.prices.get("vehicle")

                    # Total availability
                    total_passengers = sum(
                        r.available_spaces.get("passengers", 0) for r in results
                    )
                    total_vehicles = sum(
                        r.available_spaces.get("vehicles", 0) for r in results
                    )

                    # Day context
                    is_weekend = search_date.weekday() >= 5
                    days_until = (search_date - today).days

                    # Create price history record
                    price_record = PriceHistory(
                        route_id=route_id,
                        departure_port=dep_code,
                        arrival_port=arr_code,
                        operator=None,  # Aggregate across operators
                        recorded_at=datetime_type.now(tz.utc),
                        departure_date=search_date,
                        days_until_departure=days_until,
                        price_adult=lowest_price,  # Use lowest as reference
                        price_child=child_price,
                        price_infant=infant_price,
                        price_vehicle=vehicle_price,
                        lowest_price=lowest_price,
                        highest_price=highest_price,
                        average_price=average_price,
                        available_passengers=total_passengers,
                        available_vehicles=total_vehicles,
                        num_ferries=len(results),
                        is_weekend=is_weekend,
                        is_holiday=False,  # TODO: Holiday calendar integration
                        day_of_week=search_date.weekday()
                    )

                    db.add(price_record)
                    recorded_count += 1

                except asyncio.TimeoutError:
                    logger.warning(f"Timeout recording price for {route_name} on {search_date}")
                    error_count += 1
                    continue
                except Exception as e:
                    logger.warning(f"Error recording price for {route_name} on {search_date}: {e}")
                    error_count += 1
                    continue

            # Commit per route to avoid losing all data on error
            db.commit()

    try:
        # Run all searches in a single async context
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        loop.run_until_complete(run_all_searches())

        elapsed = time_module.time() - start_time
        status = "partial" if stopped_early else "success"
        logger.info(f"✅ Price history recorded: {recorded_count} records, {error_count} errors in {elapsed:.0f}s")

        return {
            "status": status,
            "recorded": recorded_count,
            "errors": error_count,
            "routes": len(TRACKED_ROUTES),
            "stopped_early": stopped_early,
            "elapsed_seconds": round(elapsed, 1)
        }

    except Exception as e:
        logger.error(f"Error recording price history: {e}", exc_info=True)
        db.rollback()
        raise self.retry(exc=e)
    finally:
        db.close()


# =============================================================================
# Route Statistics Aggregation Task
# =============================================================================

@shared_task(
    name="app.tasks.ferryhopper_sync_tasks.aggregate_route_statistics",
    bind=True,
    max_retries=3,
    default_retry_delay=300
)
def aggregate_route_statistics_task(self):
    """
    Aggregate route statistics from price history.

    Runs weekly to compute 30/90-day stats, trends, and patterns.
    """
    logger.info("📈 Aggregating route statistics...")

    db = SessionLocal()
    updated_count = 0

    try:
        today = date.today()
        now = datetime.now(timezone.utc)

        # Get unique routes from price history
        routes = db.query(
            PriceHistory.route_id,
            PriceHistory.departure_port,
            PriceHistory.arrival_port
        ).distinct().all()

        for route_id, dep_port, arr_port in routes:
            try:
                # 30-day history
                thirty_days_ago = now - timedelta(days=30)
                history_30d = db.query(PriceHistory).filter(
                    PriceHistory.route_id == route_id,
                    PriceHistory.recorded_at >= thirty_days_ago
                ).all()

                # 90-day history
                ninety_days_ago = now - timedelta(days=90)
                history_90d = db.query(PriceHistory).filter(
                    PriceHistory.route_id == route_id,
                    PriceHistory.recorded_at >= ninety_days_ago
                ).all()

                if not history_30d:
                    continue

                # Calculate 30-day stats
                prices_30d = [h.lowest_price for h in history_30d if h.lowest_price]
                avg_30d = statistics.mean(prices_30d) if prices_30d else None
                min_30d = min(prices_30d) if prices_30d else None
                max_30d = max(prices_30d) if prices_30d else None
                volatility_30d = statistics.stdev(prices_30d) if len(prices_30d) > 1 else 0

                # Calculate 90-day stats
                prices_90d = [h.lowest_price for h in history_90d if h.lowest_price]
                avg_90d = statistics.mean(prices_90d) if prices_90d else None
                min_90d = min(prices_90d) if prices_90d else None
                max_90d = max(prices_90d) if prices_90d else None

                # All-time stats
                all_history = db.query(PriceHistory).filter(
                    PriceHistory.route_id == route_id
                ).all()
                all_prices = [(h.lowest_price, h.departure_date) for h in all_history if h.lowest_price]

                all_time_low = None
                all_time_high = None
                all_time_low_date = None
                all_time_high_date = None

                if all_prices:
                    min_record = min(all_prices, key=lambda x: x[0])
                    max_record = max(all_prices, key=lambda x: x[0])
                    all_time_low = min_record[0]
                    all_time_low_date = min_record[1]
                    all_time_high = max_record[0]
                    all_time_high_date = max_record[1]

                # Day-of-week patterns
                weekday_prices = [h.lowest_price for h in history_30d if h.day_of_week is not None and h.day_of_week < 5 and h.lowest_price]
                weekend_prices = [h.lowest_price for h in history_30d if h.day_of_week is not None and h.day_of_week >= 5 and h.lowest_price]

                weekday_avg = statistics.mean(weekday_prices) if weekday_prices else None
                weekend_avg = statistics.mean(weekend_prices) if weekend_prices else None

                # Find cheapest day of week
                day_prices = {}
                for h in history_30d:
                    if h.day_of_week is not None and h.lowest_price:
                        if h.day_of_week not in day_prices:
                            day_prices[h.day_of_week] = []
                        day_prices[h.day_of_week].append(h.lowest_price)

                cheapest_day = None
                most_expensive_day = None
                if day_prices:
                    day_avgs = {d: statistics.mean(p) for d, p in day_prices.items()}
                    cheapest_day = min(day_avgs, key=day_avgs.get)
                    most_expensive_day = max(day_avgs, key=day_avgs.get)

                # 7-day trend
                seven_days_ago = now - timedelta(days=7)
                recent_history = [h for h in history_30d if h.recorded_at >= seven_days_ago]
                price_trend_7d = PriceTrendEnum.STABLE.value

                if len(recent_history) >= 2:
                    recent_prices = sorted(recent_history, key=lambda x: x.recorded_at)
                    first_price = recent_prices[0].lowest_price
                    last_price = recent_prices[-1].lowest_price
                    if last_price > first_price * 1.05:
                        price_trend_7d = PriceTrendEnum.RISING.value
                    elif last_price < first_price * 0.95:
                        price_trend_7d = PriceTrendEnum.FALLING.value

                # Current price percentile
                current_percentile = None
                if avg_30d and min_30d and max_30d and max_30d > min_30d:
                    # Get most recent price
                    latest = db.query(PriceHistory).filter(
                        PriceHistory.route_id == route_id
                    ).order_by(PriceHistory.recorded_at.desc()).first()

                    if latest and latest.lowest_price:
                        current_percentile = (latest.lowest_price - min_30d) / (max_30d - min_30d) * 100

                # Upsert route statistics
                stats = db.query(RouteStatistics).filter(
                    RouteStatistics.route_id == route_id
                ).first()

                if not stats:
                    stats = RouteStatistics(
                        route_id=route_id,
                        departure_port=dep_port,
                        arrival_port=arr_port
                    )
                    db.add(stats)

                stats.avg_price_30d = avg_30d
                stats.min_price_30d = min_30d
                stats.max_price_30d = max_30d
                stats.price_volatility_30d = volatility_30d
                stats.avg_price_90d = avg_90d
                stats.min_price_90d = min_90d
                stats.max_price_90d = max_90d
                stats.all_time_low = all_time_low
                stats.all_time_high = all_time_high
                stats.all_time_low_date = all_time_low_date
                stats.all_time_high_date = all_time_high_date
                stats.weekday_avg_price = weekday_avg
                stats.weekend_avg_price = weekend_avg
                stats.cheapest_day_of_week = cheapest_day
                stats.most_expensive_day = most_expensive_day
                stats.price_trend_7d = price_trend_7d
                stats.current_price_percentile = current_percentile
                stats.updated_at = now

                updated_count += 1

            except Exception as e:
                logger.warning(f"Error aggregating stats for {route_id}: {e}")
                continue

        db.commit()
        logger.info(f"✅ Route statistics aggregated: {updated_count} routes")

        return {
            "status": "success",
            "routes_updated": updated_count
        }

    except Exception as e:
        logger.error(f"Error aggregating route statistics: {e}", exc_info=True)
        db.rollback()
        raise self.retry(exc=e)
    finally:
        db.close()


# =============================================================================
# Fare Calendar Pre-computation Task
# =============================================================================

@shared_task(
    name="app.tasks.ferryhopper_sync_tasks.precompute_fare_calendar",
    bind=True,
    max_retries=3,
    default_retry_delay=600,
    soft_time_limit=540,  # 9 minutes soft limit
    time_limit=600  # 10 minutes hard limit
)
def precompute_fare_calendar_task(self, months_ahead: int = 2):
    """
    Pre-compute fare calendar data for popular routes.

    Runs daily to keep calendar fresh.
    Computes monthly calendar data with prices, availability, trends.
    Searches every 3rd day to reduce API calls.
    """
    import asyncio
    import time as time_module
    from datetime import date as date_type, datetime as datetime_type, timezone as tz, timedelta as td
    from app.services.ferry_service import FerryService

    start_time = time_module.time()
    max_runtime = 480  # Stop after 8 minutes to leave buffer

    logger.info(f"📅 Pre-computing fare calendars for {len(TRACKED_ROUTES)} routes, {months_ahead} months ahead...")

    db = SessionLocal()
    computed_count = 0
    stopped_early = False

    async def run_all_calendar_computations():
        """Run all calendar computations in a single async context."""
        nonlocal computed_count, stopped_early

        ferry_service = FerryService()
        today = date_type.today()
        now = datetime_type.now(tz.utc)

        async def fetch_date_price(dep: str, arr: str, target_date) -> Optional[Dict]:
            """Search a single date for price data with timeout."""
            try:
                results = await asyncio.wait_for(
                    ferry_service.search_ferries(
                        departure_port=dep,
                        arrival_port=arr,
                        departure_date=target_date,
                        adults=1,
                        children=0,
                        infants=0
                    ),
                    timeout=15.0
                )

                if not results:
                    return None

                adult_prices = [r.prices.get("adult", 0) for r in results if r.prices.get("adult", 0) > 0]
                if not adult_prices:
                    return None

                return {
                    "price": min(adult_prices),
                    "available": True,
                    "ferries": len(results),
                    "trend": "stable"
                }
            except asyncio.TimeoutError:
                return None
            except Exception:
                return None

        for dep_code, arr_code, route_name in TRACKED_ROUTES:
            # Check if we're running out of time
            if time_module.time() - start_time > max_runtime:
                logger.info(f"⏰ Stopping early to avoid timeout")
                stopped_early = True
                return

            route_id = f"{dep_code}_{arr_code}".lower()
            logger.debug(f"Computing calendar for {route_name}")

            # Generate months to compute
            for month_offset in range(months_ahead):
                # Check time again
                if time_module.time() - start_time > max_runtime:
                    stopped_early = True
                    return

                target_month = today.replace(day=1) + td(days=32 * month_offset)
                target_month = target_month.replace(day=1)
                year_month = target_month.strftime("%Y-%m")

                # Check if recent cache exists
                existing_cache = db.query(FareCalendarCache).filter(
                    FareCalendarCache.route_id == route_id,
                    FareCalendarCache.year_month == year_month,
                    FareCalendarCache.passengers == 1,
                    FareCalendarCache.expires_at > now
                ).first()

                if existing_cache:
                    logger.debug(f"Cache exists for {route_id} {year_month}, skipping")
                    continue

                # Get days in month
                if target_month.month == 12:
                    next_month = target_month.replace(year=target_month.year + 1, month=1)
                else:
                    next_month = target_month.replace(month=target_month.month + 1)
                days_in_month = (next_month - target_month).days

                # Search every 3rd day to reduce API calls (interpolate others)
                calendar_data = {}
                prices = []
                sampled_prices = {}

                # First pass: fetch every 3rd day
                for day in range(1, days_in_month + 1, 3):
                    if time_module.time() - start_time > max_runtime:
                        stopped_early = True
                        return

                    search_date = target_month.replace(day=day)

                    # Skip past dates
                    if search_date < today:
                        continue

                    result = await fetch_date_price(dep_code, arr_code, search_date)
                    if result:
                        sampled_prices[day] = result["price"]

                # Second pass: fill in all days (interpolate or use nearest)
                for day in range(1, days_in_month + 1):
                    search_date = target_month.replace(day=day)

                    if search_date < today:
                        calendar_data[str(day)] = {"price": None, "available": False, "ferries": 0, "trend": "stable"}
                        continue

                    if day in sampled_prices:
                        price = sampled_prices[day]
                        calendar_data[str(day)] = {"price": price, "available": True, "ferries": 1, "trend": "stable"}
                        prices.append(price)
                    else:
                        # Find nearest sampled price
                        nearest_price = None
                        for offset in range(1, 4):
                            if day - offset in sampled_prices:
                                nearest_price = sampled_prices[day - offset]
                                break
                            if day + offset in sampled_prices:
                                nearest_price = sampled_prices[day + offset]
                                break
                        if nearest_price:
                            calendar_data[str(day)] = {"price": nearest_price, "available": True, "ferries": 1, "trend": "stable"}
                            prices.append(nearest_price)
                        else:
                            calendar_data[str(day)] = {"price": None, "available": False, "ferries": 0, "trend": "stable"}

                # Calculate month summary
                month_lowest = min(prices) if prices else None
                month_highest = max(prices) if prices else None
                month_average = sum(prices) / len(prices) if prices else None
                cheapest_date = None

                if prices and month_lowest:
                    for day, data in calendar_data.items():
                        if data.get("price") == month_lowest:
                            cheapest_date = int(day)
                            break

                # Delete old cache for this route/month
                db.query(FareCalendarCache).filter(
                    FareCalendarCache.route_id == route_id,
                    FareCalendarCache.year_month == year_month,
                    FareCalendarCache.passengers == 1
                ).delete()

                # Create new cache entry
                cache_entry = FareCalendarCache(
                    route_id=route_id,
                    year_month=year_month,
                    passengers=1,
                    created_at=now,
                    expires_at=now + td(hours=24),  # 24 hour cache
                    calendar_data=calendar_data,
                    month_lowest=month_lowest,
                    month_highest=month_highest,
                    month_average=month_average,
                    cheapest_date=cheapest_date
                )
                db.add(cache_entry)
                computed_count += 1

            # Commit per route
            db.commit()

    try:
        # Run all computations in a single async context
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        loop.run_until_complete(run_all_calendar_computations())

        elapsed = round(time_module.time() - start_time, 1)
        status = "partial" if stopped_early else "success"
        logger.info(f"✅ Fare calendars pre-computed: {computed_count} calendars ({status}, {elapsed}s)")

        return {
            "status": status,
            "calendars_computed": computed_count,
            "routes": len(TRACKED_ROUTES),
            "stopped_early": stopped_early,
            "elapsed_seconds": elapsed
        }

    except Exception as e:
        logger.error(f"Error pre-computing fare calendars: {e}", exc_info=True)
        db.rollback()
        raise self.retry(exc=e)
    finally:
        db.close()


# =============================================================================
# Combined Daily Sync Task
# =============================================================================

@shared_task(
    name="app.tasks.ferryhopper_sync_tasks.daily_ferryhopper_sync",
    bind=True
)
def daily_ferryhopper_sync_task(self):
    """
    Combined daily sync task for FerryHopper data.

    Runs all sync tasks in sequence:
    1. Sync ports
    2. Sync accommodations
    3. Record price history
    4. Aggregate route statistics
    5. Pre-compute fare calendars
    """
    logger.info("🔄 Starting daily FerryHopper sync...")

    results = {}

    # 1. Sync ports
    try:
        results["ports"] = sync_ports_from_ferryhopper_task()
    except Exception as e:
        logger.error(f"Port sync failed: {e}")
        results["ports"] = {"status": "error", "message": str(e)}

    # 2. Sync accommodations
    try:
        results["accommodations"] = sync_accommodations_from_ferryhopper_task()
    except Exception as e:
        logger.error(f"Accommodation sync failed: {e}")
        results["accommodations"] = {"status": "error", "message": str(e)}

    # 3. Record price history
    try:
        results["price_history"] = record_price_history_task()
    except Exception as e:
        logger.error(f"Price history recording failed: {e}")
        results["price_history"] = {"status": "error", "message": str(e)}

    # 3. Aggregate route statistics
    try:
        results["route_stats"] = aggregate_route_statistics_task()
    except Exception as e:
        logger.error(f"Route stats aggregation failed: {e}")
        results["route_stats"] = {"status": "error", "message": str(e)}

    # 4. Pre-compute fare calendars
    try:
        results["fare_calendars"] = precompute_fare_calendar_task()
    except Exception as e:
        logger.error(f"Fare calendar pre-computation failed: {e}")
        results["fare_calendars"] = {"status": "error", "message": str(e)}

    logger.info(f"✅ Daily FerryHopper sync complete: {results}")
    return results


# =============================================================================
# Cache Pre-Warming Task
# =============================================================================

@shared_task(
    name="app.tasks.ferryhopper_sync_tasks.prewarm_search_cache",
    bind=True,
    max_retries=1,
    default_retry_delay=60,
    soft_time_limit=240,  # 4 minutes soft limit
    time_limit=300  # 5 minutes hard limit
)
def prewarm_search_cache_task(self, days_ahead: int = 7):
    """
    Pre-warm the ferry search cache for popular routes.

    Runs every 10 minutes to keep cache warm for popular routes.
    Searches the next 7 days for each popular route to ensure fast response times.
    Limited to avoid timeout - processes only uncached routes.
    """
    import asyncio
    import time
    from datetime import date as date_type, timedelta as td
    from app.services.ferry_service import FerryService
    from celery.exceptions import SoftTimeLimitExceeded

    start_time = time.time()
    max_runtime = 180  # Stop after 3 minutes to leave buffer

    logger.info(f"🔥 Pre-warming search cache for {len(TRACKED_ROUTES)} routes, {days_ahead} days ahead...")

    warmed_count = 0
    skipped_count = 0
    error_count = 0
    stopped_early = False

    async def warm_all_routes():
        """Run all cache warming in a single async context."""
        nonlocal warmed_count, skipped_count, error_count, stopped_early

        # Create FerryService inside async context to keep httpx session alive
        ferry_service = FerryService()

        async def warm_route_date(dep: str, arr: str, search_date) -> bool:
            """Warm cache for a single route/date with timeout."""
            try:
                results = await asyncio.wait_for(
                    ferry_service.search_ferries(
                        departure_port=dep,
                        arrival_port=arr,
                        departure_date=search_date,
                        adults=1,
                        children=0,
                        infants=0
                    ),
                    timeout=20.0  # 20 second timeout per search
                )
                return True
            except asyncio.TimeoutError:
                logger.debug(f"Cache warm timeout for {dep}->{arr} {search_date}")
                return False
            except Exception as e:
                logger.debug(f"Cache warm failed for {dep}->{arr} {search_date}: {e}")
                return False

        today = date_type.today()
        tomorrow = today + td(days=1)  # Start from tomorrow to avoid "past date" errors
        from app.services.cache_service import cache_service

        for dep_code, arr_code, route_name in TRACKED_ROUTES:
            # Check if we're running out of time
            elapsed = time.time() - start_time
            if elapsed > max_runtime:
                logger.info(f"⏰ Stopping early after {elapsed:.0f}s to avoid timeout")
                stopped_early = True
                return

            # Check every 2 days for the next week (starting from tomorrow)
            for day_offset in range(1, days_ahead + 1, 2):
                search_date = today + td(days=day_offset)

                # Check FerryHopper-specific cache
                cached = cache_service.get_ferryhopper_search(
                    departure_port=dep_code,
                    arrival_port=arr_code,
                    departure_date=search_date.isoformat(),
                    passengers=1
                )

                if cached:
                    skipped_count += 1
                    continue

                # Warm the cache
                success = await warm_route_date(dep_code, arr_code, search_date)
                if success:
                    warmed_count += 1
                else:
                    error_count += 1

                # Small delay to avoid rate limiting
                await asyncio.sleep(0.3)

    try:
        # Run async warming
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        loop.run_until_complete(warm_all_routes())

        elapsed = time.time() - start_time
        status_msg = "partial" if stopped_early else "success"
        logger.info(f"✅ Cache pre-warm {status_msg}: {warmed_count} warmed, {skipped_count} skipped (cached), {error_count} errors in {elapsed:.0f}s")

        return {
            "status": status_msg,
            "warmed": warmed_count,
            "skipped": skipped_count,
            "errors": error_count,
            "routes": len(TRACKED_ROUTES),
            "stopped_early": stopped_early,
            "elapsed_seconds": round(elapsed, 1)
        }

    except SoftTimeLimitExceeded:
        elapsed = time.time() - start_time
        logger.warning(f"⏰ Cache pre-warm soft time limit exceeded after {elapsed:.0f}s")
        return {
            "status": "timeout",
            "warmed": warmed_count,
            "skipped": skipped_count,
            "errors": error_count,
            "routes": len(TRACKED_ROUTES),
            "stopped_early": True,
            "elapsed_seconds": round(elapsed, 1)
        }

    except Exception as e:
        logger.error(f"Error pre-warming cache: {e}", exc_info=True)
        return {
            "status": "error",
            "error": str(e),
            "warmed": warmed_count,
            "skipped": skipped_count,
            "errors": error_count
        }
