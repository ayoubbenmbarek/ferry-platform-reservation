"""
Celery tasks for tracking ferry prices and recording historical data.
Generates mock data with realistic patterns for price predictions and insights.
"""
import logging
import random
from datetime import datetime, timezone, timedelta, date
from typing import List, Dict, Any, Optional
from celery import shared_task
from sqlalchemy import and_, func

from app.database import SessionLocal
from app.models.price_history import (
    PriceHistory,
    PricePrediction,
    RouteStatistics,
    FareCalendarCache,
    PriceTrendEnum,
    BookingRecommendationEnum,
)
from app.services.price_prediction_service import PricePredictionService

logger = logging.getLogger(__name__)

# Mediterranean ferry routes for tracking
TRACKED_ROUTES = [
    {"route_id": "marseille_tunis", "departure_port": "marseille", "arrival_port": "tunis"},
    {"route_id": "genoa_tunis", "departure_port": "genoa", "arrival_port": "tunis"},
    {"route_id": "civitavecchia_tunis", "departure_port": "civitavecchia", "arrival_port": "tunis"},
    {"route_id": "salerno_tunis", "departure_port": "salerno", "arrival_port": "tunis"},
    {"route_id": "palermo_tunis", "departure_port": "palermo", "arrival_port": "tunis"},
    {"route_id": "marseille_la_goulette", "departure_port": "marseille", "arrival_port": "la_goulette"},
    {"route_id": "genoa_la_goulette", "departure_port": "genoa", "arrival_port": "la_goulette"},
]

# Base prices for routes (in EUR)
BASE_PRICES = {
    "marseille_tunis": 85,
    "genoa_tunis": 95,
    "civitavecchia_tunis": 105,
    "salerno_tunis": 90,
    "palermo_tunis": 75,
    "marseille_la_goulette": 88,
    "genoa_la_goulette": 98,
}

# Operators for each route
ROUTE_OPERATORS = {
    "marseille_tunis": ["Corsica Linea", "La Méridionale"],
    "genoa_tunis": ["GNV", "Grimaldi Lines"],
    "civitavecchia_tunis": ["Grimaldi Lines"],
    "salerno_tunis": ["Grimaldi Lines"],
    "palermo_tunis": ["GNV", "Grimaldi Lines"],
    "marseille_la_goulette": ["CTN", "Corsica Linea"],
    "genoa_la_goulette": ["CTN", "GNV"],
}


def _generate_mock_price(
    base_price: float,
    departure_date: date,
    days_until_departure: int,
    day_of_week: int,
    add_random: bool = True
) -> float:
    """
    Generate a realistic mock price based on various factors.

    Factors that affect pricing:
    - Seasonality (summer = more expensive)
    - Days until departure (closer = more expensive usually)
    - Day of week (weekends = more expensive)
    - Random variation for realism
    """
    price = base_price

    # 1. Seasonality factor
    month = departure_date.month
    seasonality_factors = {
        1: 0.85,   # January - low
        2: 0.82,   # February - lowest
        3: 0.88,   # March - low
        4: 0.95,   # April - rising
        5: 1.05,   # May - moderate
        6: 1.25,   # June - high
        7: 1.45,   # July - peak
        8: 1.50,   # August - highest
        9: 1.20,   # September - moderate high
        10: 0.95,  # October - falling
        11: 0.85,  # November - low
        12: 1.10,  # December - holiday bump
    }
    price *= seasonality_factors.get(month, 1.0)

    # 2. Days until departure factor
    if days_until_departure <= 3:
        # Last minute - expensive
        price *= 1.40
    elif days_until_departure <= 7:
        # Within a week
        price *= 1.25
    elif days_until_departure <= 14:
        # 1-2 weeks out
        price *= 1.10
    elif days_until_departure <= 30:
        # Sweet spot - best prices
        price *= 0.95
    elif days_until_departure <= 60:
        # Good advance pricing
        price *= 0.92
    else:
        # Far in advance - moderate
        price *= 1.0

    # 3. Day of week factor (0=Monday, 6=Sunday)
    day_factors = {
        0: 0.95,   # Monday - low
        1: 0.93,   # Tuesday - lowest
        2: 0.95,   # Wednesday - low
        3: 0.97,   # Thursday - moderate
        4: 1.10,   # Friday - high
        5: 1.15,   # Saturday - highest
        6: 1.05,   # Sunday - moderate
    }
    price *= day_factors.get(day_of_week, 1.0)

    # 4. Random variation for realism (±5%)
    if add_random:
        price *= random.uniform(0.95, 1.05)

    return round(price, 2)


@shared_task(
    name="app.tasks.price_tracking_tasks.record_price_snapshot",
    bind=True,
    max_retries=3,
    default_retry_delay=300
)
def record_price_snapshot_task(self):
    """
    Periodic task to record current prices for all tracked routes.

    This task:
    1. Iterates through all tracked routes
    2. Records price snapshots for the next 90 days
    3. Stores data for historical analysis and predictions

    Runs every 4-6 hours to capture price changes.
    """
    db = SessionLocal()
    try:
        logger.info("📊 Starting price snapshot recording...")

        now = datetime.now(timezone.utc)
        today = now.date()
        records_created = 0

        # Record prices for each route
        for route in TRACKED_ROUTES:
            route_id = route["route_id"]
            departure_port = route["departure_port"]
            arrival_port = route["arrival_port"]
            base_price = BASE_PRICES.get(route_id, 100)
            operators = ROUTE_OPERATORS.get(route_id, ["Unknown"])

            # Record prices for the next 90 days
            for day_offset in range(0, 90):
                departure_date = today + timedelta(days=day_offset)
                days_until_departure = day_offset
                day_of_week = departure_date.weekday()
                is_weekend = day_of_week >= 5

                # Check if we already have a recent record for this route/date
                existing = db.query(PriceHistory).filter(
                    and_(
                        PriceHistory.route_id == route_id,
                        PriceHistory.departure_date == departure_date,
                        PriceHistory.recorded_at >= now - timedelta(hours=4)
                    )
                ).first()

                if existing:
                    continue  # Skip if recently recorded

                # Generate prices for each operator
                prices = []
                for operator in operators:
                    # Each operator has slightly different pricing
                    operator_adjustment = random.uniform(0.95, 1.10)
                    price = _generate_mock_price(
                        base_price * operator_adjustment,
                        departure_date,
                        days_until_departure,
                        day_of_week
                    )
                    prices.append(price)

                # Calculate aggregate values
                lowest_price = min(prices)
                highest_price = max(prices)
                average_price = sum(prices) / len(prices)

                # Create price history record
                price_record = PriceHistory(
                    route_id=route_id,
                    departure_port=departure_port,
                    arrival_port=arrival_port,
                    recorded_at=now,
                    departure_date=departure_date,
                    days_until_departure=days_until_departure,
                    price_adult=lowest_price,  # Use lowest as main adult price
                    price_child=round(lowest_price * 0.5, 2),
                    price_infant=0,
                    price_vehicle=round(lowest_price * 1.5, 2),
                    lowest_price=lowest_price,
                    highest_price=highest_price,
                    average_price=round(average_price, 2),
                    available_passengers=random.randint(50, 200),
                    available_vehicles=random.randint(10, 40),
                    num_ferries=len(operators),
                    is_weekend=is_weekend,
                    is_holiday=_is_holiday(departure_date),
                    day_of_week=day_of_week,
                )

                db.add(price_record)
                records_created += 1

        db.commit()
        logger.info(f"✅ Price snapshot complete: {records_created} records created")

        return {"status": "success", "records_created": records_created}

    except Exception as e:
        logger.error(f"Error recording price snapshot: {str(e)}", exc_info=True)
        db.rollback()
        raise
    finally:
        db.close()


@shared_task(
    name="app.tasks.price_tracking_tasks.generate_predictions",
    bind=True,
    max_retries=3,
    default_retry_delay=300
)
def generate_predictions_task(self):
    """
    Generate AI-powered price predictions for all routes.

    Uses historical data to predict future prices and provide
    booking recommendations.
    """
    db = SessionLocal()
    try:
        logger.info("🤖 Starting prediction generation...")

        prediction_service = PricePredictionService(db)
        today = datetime.now().date()
        predictions_created = 0

        for route in TRACKED_ROUTES:
            route_id = route["route_id"]
            departure_port = route["departure_port"]
            arrival_port = route["arrival_port"]

            # Generate predictions for the next 60 days
            for day_offset in range(0, 60):
                prediction_date = today + timedelta(days=day_offset)

                try:
                    # Check for existing prediction
                    existing = db.query(PricePrediction).filter(
                        and_(
                            PricePrediction.route_id == route_id,
                            PricePrediction.prediction_date == prediction_date
                        )
                    ).first()

                    # Get prediction from service
                    prediction_result = prediction_service.predict_price(
                        route_id=route_id,
                        departure_date=prediction_date
                    )
                    # Convert PredictionResult to dict for compatibility
                    prediction_data = {
                        "predicted_price": prediction_result.predicted_price,
                        "predicted_low": prediction_result.predicted_low,
                        "predicted_high": prediction_result.predicted_high,
                        "confidence": prediction_result.confidence_score,
                        "trend": prediction_result.price_trend.value if hasattr(prediction_result.price_trend, 'value') else prediction_result.price_trend,
                        "recommendation": prediction_result.booking_recommendation.value if hasattr(prediction_result.booking_recommendation, 'value') else prediction_result.booking_recommendation,
                        "recommendation_reason": prediction_result.recommendation_reason,
                        "potential_savings": prediction_result.potential_savings,
                        "factors": prediction_result.factors,
                    }

                    if existing:
                        # Update existing prediction
                        existing.predicted_price = prediction_data.get("predicted_price", 0)
                        existing.predicted_low = prediction_data.get("predicted_low")
                        existing.predicted_high = prediction_data.get("predicted_high")
                        existing.current_price = prediction_data.get("current_price")
                        existing.confidence_score = prediction_data.get("confidence", 0.7)
                        existing.price_trend = prediction_data.get("trend", PriceTrendEnum.STABLE.value)
                        existing.booking_recommendation = prediction_data.get("recommendation", BookingRecommendationEnum.NEUTRAL.value)
                        existing.recommendation_reason = prediction_data.get("recommendation_reason")
                        existing.potential_savings = prediction_data.get("potential_savings")
                        existing.prediction_factors = prediction_data.get("factors")
                    else:
                        # Create new prediction
                        prediction = PricePrediction(
                            route_id=route_id,
                            departure_port=departure_port,
                            arrival_port=arrival_port,
                            prediction_date=prediction_date,
                            predicted_price=prediction_data.get("predicted_price", 0),
                            predicted_low=prediction_data.get("predicted_low"),
                            predicted_high=prediction_data.get("predicted_high"),
                            current_price=prediction_data.get("current_price"),
                            confidence_score=prediction_data.get("confidence", 0.7),
                            price_trend=prediction_data.get("trend", PriceTrendEnum.STABLE.value),
                            booking_recommendation=prediction_data.get("recommendation", BookingRecommendationEnum.NEUTRAL.value),
                            recommendation_reason=prediction_data.get("recommendation_reason"),
                            potential_savings=prediction_data.get("potential_savings"),
                            prediction_factors=prediction_data.get("factors"),
                        )
                        db.add(prediction)
                        predictions_created += 1

                except Exception as e:
                    logger.error(f"Error generating prediction for {route_id} on {prediction_date}: {e}")
                    continue

        db.commit()
        logger.info(f"✅ Prediction generation complete: {predictions_created} new predictions")

        return {"status": "success", "predictions_created": predictions_created}

    except Exception as e:
        logger.error(f"Error generating predictions: {str(e)}", exc_info=True)
        db.rollback()
        raise
    finally:
        db.close()


@shared_task(
    name="app.tasks.price_tracking_tasks.update_route_statistics",
    bind=True,
    max_retries=3,
    default_retry_delay=300
)
def update_route_statistics_task(self):
    """
    Update aggregated route statistics for dashboard insights.

    Computes 30-day, 90-day, and all-time statistics for each route.
    Uses batched queries to avoid N+1 query issues.
    """
    db = SessionLocal()
    try:
        logger.info("📈 Updating route statistics...")

        now = datetime.now(timezone.utc)
        today = now.date()
        routes_updated = 0

        route_ids = [r["route_id"] for r in TRACKED_ROUTES]
        route_info = {r["route_id"]: r for r in TRACKED_ROUTES}

        # Pre-fetch all route statistics in ONE query
        existing_stats = db.query(RouteStatistics).filter(
            RouteStatistics.route_id.in_(route_ids)
        ).all()
        stats_by_route = {s.route_id: s for s in existing_stats}

        # Batch query: 30-day statistics for all routes
        thirty_days_ago = today - timedelta(days=30)
        stats_30d_query = db.query(
            PriceHistory.route_id,
            func.avg(PriceHistory.lowest_price).label('avg_price'),
            func.min(PriceHistory.lowest_price).label('min_price'),
            func.max(PriceHistory.lowest_price).label('max_price'),
            func.stddev(PriceHistory.lowest_price).label('stddev_price')
        ).filter(
            and_(
                PriceHistory.route_id.in_(route_ids),
                PriceHistory.recorded_at >= thirty_days_ago
            )
        ).group_by(PriceHistory.route_id).all()
        stats_30d = {r.route_id: r for r in stats_30d_query}

        # Batch query: 90-day statistics for all routes
        ninety_days_ago = today - timedelta(days=90)
        stats_90d_query = db.query(
            PriceHistory.route_id,
            func.avg(PriceHistory.lowest_price).label('avg_price'),
            func.min(PriceHistory.lowest_price).label('min_price'),
            func.max(PriceHistory.lowest_price).label('max_price')
        ).filter(
            and_(
                PriceHistory.route_id.in_(route_ids),
                PriceHistory.recorded_at >= ninety_days_ago
            )
        ).group_by(PriceHistory.route_id).all()
        stats_90d = {r.route_id: r for r in stats_90d_query}

        # Batch query: All-time low for all routes (using subquery for min price per route)
        all_time_low_subq = db.query(
            PriceHistory.route_id,
            func.min(PriceHistory.lowest_price).label('min_price')
        ).filter(
            PriceHistory.route_id.in_(route_ids)
        ).group_by(PriceHistory.route_id).subquery()

        all_time_low_query = db.query(
            PriceHistory.route_id,
            PriceHistory.lowest_price,
            PriceHistory.departure_date
        ).join(
            all_time_low_subq,
            and_(
                PriceHistory.route_id == all_time_low_subq.c.route_id,
                PriceHistory.lowest_price == all_time_low_subq.c.min_price
            )
        ).all()
        all_time_low = {r.route_id: (r.lowest_price, r.departure_date) for r in all_time_low_query}

        # Batch query: All-time high for all routes
        all_time_high_subq = db.query(
            PriceHistory.route_id,
            func.max(PriceHistory.highest_price).label('max_price')
        ).filter(
            PriceHistory.route_id.in_(route_ids)
        ).group_by(PriceHistory.route_id).subquery()

        all_time_high_query = db.query(
            PriceHistory.route_id,
            PriceHistory.highest_price,
            PriceHistory.departure_date
        ).join(
            all_time_high_subq,
            and_(
                PriceHistory.route_id == all_time_high_subq.c.route_id,
                PriceHistory.highest_price == all_time_high_subq.c.max_price
            )
        ).all()
        all_time_high = {r.route_id: (r.highest_price, r.departure_date) for r in all_time_high_query}

        # Batch query: Weekday averages for all routes
        weekday_avg_query = db.query(
            PriceHistory.route_id,
            func.avg(PriceHistory.lowest_price).label('avg_price')
        ).filter(
            and_(
                PriceHistory.route_id.in_(route_ids),
                PriceHistory.is_weekend == False
            )
        ).group_by(PriceHistory.route_id).all()
        weekday_avg = {r.route_id: r.avg_price for r in weekday_avg_query}

        # Batch query: Weekend averages for all routes
        weekend_avg_query = db.query(
            PriceHistory.route_id,
            func.avg(PriceHistory.lowest_price).label('avg_price')
        ).filter(
            and_(
                PriceHistory.route_id.in_(route_ids),
                PriceHistory.is_weekend == True
            )
        ).group_by(PriceHistory.route_id).all()
        weekend_avg = {r.route_id: r.avg_price for r in weekend_avg_query}

        # Now update all route statistics using pre-fetched data
        for route_id in route_ids:
            route = route_info[route_id]
            departure_port = route["departure_port"]
            arrival_port = route["arrival_port"]

            try:
                # Get or create route statistics
                stats = stats_by_route.get(route_id)
                if not stats:
                    stats = RouteStatistics(
                        route_id=route_id,
                        departure_port=departure_port,
                        arrival_port=arrival_port,
                    )
                    db.add(stats)
                    stats_by_route[route_id] = stats

                # Apply 30-day statistics
                if route_id in stats_30d:
                    s = stats_30d[route_id]
                    stats.avg_price_30d = round(s.avg_price, 2) if s.avg_price else None
                    stats.min_price_30d = s.min_price
                    stats.max_price_30d = s.max_price
                    stats.price_volatility_30d = round(s.stddev_price, 2) if s.stddev_price else None

                # Apply 90-day statistics
                if route_id in stats_90d:
                    s = stats_90d[route_id]
                    stats.avg_price_90d = round(s.avg_price, 2) if s.avg_price else None
                    stats.min_price_90d = s.min_price
                    stats.max_price_90d = s.max_price

                # Apply all-time low/high
                if route_id in all_time_low:
                    stats.all_time_low = all_time_low[route_id][0]
                    stats.all_time_low_date = all_time_low[route_id][1]

                if route_id in all_time_high:
                    stats.all_time_high = all_time_high[route_id][0]
                    stats.all_time_high_date = all_time_high[route_id][1]

                # Apply day of week averages
                if route_id in weekday_avg:
                    stats.weekday_avg_price = round(weekday_avg[route_id], 2) if weekday_avg[route_id] else None

                if route_id in weekend_avg:
                    stats.weekend_avg_price = round(weekend_avg[route_id], 2) if weekend_avg[route_id] else None

                # Best booking window (mock data for now)
                stats.best_booking_window_start = 21
                stats.best_booking_window_end = 14
                stats.typical_advance_days = 18

                # Cheapest day of week (Tuesday typically)
                stats.cheapest_day_of_week = 1  # Tuesday
                stats.most_expensive_day = 5    # Saturday

                routes_updated += 1

            except Exception as e:
                logger.error(f"Error updating stats for {route_id}: {e}")
                continue

        db.commit()
        logger.info(f"✅ Route statistics updated: {routes_updated} routes")

        return {"status": "success", "routes_updated": routes_updated}

    except Exception as e:
        logger.error(f"Error updating route statistics: {str(e)}", exc_info=True)
        db.rollback()
        raise
    finally:
        db.close()


@shared_task(
    name="app.tasks.price_tracking_tasks.update_fare_calendar_cache",
    bind=True,
    max_retries=3,
    default_retry_delay=300
)
def update_fare_calendar_cache_task(self):
    """
    Update fare calendar cache for quick retrieval.

    Pre-computes monthly calendar data to avoid expensive queries.
    """
    db = SessionLocal()
    try:
        logger.info("📅 Updating fare calendar cache...")

        now = datetime.now(timezone.utc)
        today = now.date()
        caches_updated = 0

        # Generate cache for next 3 months
        for route in TRACKED_ROUTES:
            route_id = route["route_id"]
            base_price = BASE_PRICES.get(route_id, 100)

            for month_offset in range(0, 3):
                # Calculate year/month
                target_month = today.month + month_offset
                target_year = today.year
                if target_month > 12:
                    target_month -= 12
                    target_year += 1

                year_month = f"{target_year}-{target_month:02d}"

                try:
                    # Check for existing cache
                    cache = db.query(FareCalendarCache).filter(
                        and_(
                            FareCalendarCache.route_id == route_id,
                            FareCalendarCache.year_month == year_month,
                            FareCalendarCache.passengers == 1
                        )
                    ).first()

                    # Generate calendar data
                    calendar_data = {}
                    month_prices = []

                    # Days in month
                    if target_month == 12:
                        next_month = date(target_year + 1, 1, 1)
                    else:
                        next_month = date(target_year, target_month + 1, 1)
                    first_day = date(target_year, target_month, 1)
                    days_in_month = (next_month - first_day).days

                    for day in range(1, days_in_month + 1):
                        departure_date = date(target_year, target_month, day)

                        # Skip past dates
                        if departure_date < today:
                            continue

                        days_until = (departure_date - today).days
                        day_of_week = departure_date.weekday()

                        price = _generate_mock_price(
                            base_price,
                            departure_date,
                            days_until,
                            day_of_week,
                            add_random=False  # Consistent for cache
                        )

                        # Determine trend based on price level
                        avg_price = base_price * 1.1
                        if price < avg_price * 0.9:
                            trend = "falling"
                        elif price > avg_price * 1.1:
                            trend = "rising"
                        else:
                            trend = "stable"

                        calendar_data[str(day)] = {
                            "price": price,
                            "available": True,
                            "ferries": random.randint(2, 4),
                            "trend": trend,
                        }
                        month_prices.append(price)

                    if not month_prices:
                        continue

                    # Calculate monthly summary
                    month_lowest = min(month_prices)
                    month_highest = max(month_prices)
                    month_average = sum(month_prices) / len(month_prices)
                    cheapest_date = min(calendar_data.keys(), key=lambda d: calendar_data[d]["price"])

                    if cache:
                        # Update existing cache
                        cache.calendar_data = calendar_data
                        cache.month_lowest = month_lowest
                        cache.month_highest = month_highest
                        cache.month_average = round(month_average, 2)
                        cache.cheapest_date = int(cheapest_date)
                        cache.expires_at = now + timedelta(hours=4)
                    else:
                        # Create new cache
                        cache = FareCalendarCache(
                            route_id=route_id,
                            year_month=year_month,
                            passengers=1,
                            calendar_data=calendar_data,
                            month_lowest=month_lowest,
                            month_highest=month_highest,
                            month_average=round(month_average, 2),
                            cheapest_date=int(cheapest_date),
                            expires_at=now + timedelta(hours=4),
                        )
                        db.add(cache)

                    caches_updated += 1

                except Exception as e:
                    logger.error(f"Error caching {route_id} {year_month}: {e}")
                    continue

        db.commit()
        logger.info(f"✅ Fare calendar cache updated: {caches_updated} caches")

        return {"status": "success", "caches_updated": caches_updated}

    except Exception as e:
        logger.error(f"Error updating fare calendar cache: {str(e)}", exc_info=True)
        db.rollback()
        raise
    finally:
        db.close()


@shared_task(
    name="app.tasks.price_tracking_tasks.cleanup_old_price_data",
    bind=True,
    max_retries=3,
    default_retry_delay=60
)
def cleanup_old_price_data_task(self):
    """
    Cleanup old price history data to manage database size.

    Keeps last 180 days of data for analysis.

    Uses batched deletes with separate transactions per table to avoid deadlocks.
    Includes Redis lock to prevent concurrent execution.
    """
    # Acquire a Redis lock to prevent concurrent cleanup tasks
    from app.services.cache_service import cache_service

    lock_key = "cleanup_price_data_lock"
    lock_timeout = 3600  # 1 hour max lock duration

    # Try to acquire lock
    if not cache_service.acquire_lock(lock_key, timeout=lock_timeout):
        logger.info("🔒 Cleanup task already running, skipping...")
        return {"status": "skipped", "reason": "Another cleanup task is already running"}

    try:
        logger.info("🧹 Cleaning up old price data...")

        cleanup_date = datetime.now(timezone.utc) - timedelta(days=180)
        batch_size = 1000  # Delete in batches to avoid long-running transactions

        deleted_history = 0
        deleted_predictions = 0
        deleted_cache = 0

        # 1. Delete expired cache entries FIRST (most likely to cause deadlocks)
        # Use separate transaction with batched deletes
        db = SessionLocal()
        try:
            while True:
                # Select IDs to delete in a batch (avoids row-level locks during scan)
                expired_ids = db.query(FareCalendarCache.id).filter(
                    FareCalendarCache.expires_at < datetime.now(timezone.utc)
                ).limit(batch_size).all()

                if not expired_ids:
                    break

                ids_to_delete = [row.id for row in expired_ids]

                # Delete by ID (more predictable locking)
                batch_deleted = db.query(FareCalendarCache).filter(
                    FareCalendarCache.id.in_(ids_to_delete)
                ).delete(synchronize_session=False)

                db.commit()
                deleted_cache += batch_deleted

                if batch_deleted < batch_size:
                    break

            logger.debug(f"Deleted {deleted_cache} expired cache entries")

        except Exception as e:
            logger.warning(f"Error cleaning cache entries (will retry): {e}")
            db.rollback()
            # Continue with other cleanups, don't fail the whole task
        finally:
            db.close()

        # 2. Delete old price history (separate transaction)
        db = SessionLocal()
        try:
            while True:
                expired_ids = db.query(PriceHistory.id).filter(
                    PriceHistory.recorded_at < cleanup_date
                ).limit(batch_size).all()

                if not expired_ids:
                    break

                ids_to_delete = [row.id for row in expired_ids]

                batch_deleted = db.query(PriceHistory).filter(
                    PriceHistory.id.in_(ids_to_delete)
                ).delete(synchronize_session=False)

                db.commit()
                deleted_history += batch_deleted

                if batch_deleted < batch_size:
                    break

            logger.debug(f"Deleted {deleted_history} old price history records")

        except Exception as e:
            logger.warning(f"Error cleaning price history (will retry): {e}")
            db.rollback()
        finally:
            db.close()

        # 3. Delete old predictions (separate transaction)
        db = SessionLocal()
        try:
            while True:
                expired_ids = db.query(PricePrediction.id).filter(
                    PricePrediction.prediction_date < cleanup_date.date()
                ).limit(batch_size).all()

                if not expired_ids:
                    break

                ids_to_delete = [row.id for row in expired_ids]

                batch_deleted = db.query(PricePrediction).filter(
                    PricePrediction.id.in_(ids_to_delete)
                ).delete(synchronize_session=False)

                db.commit()
                deleted_predictions += batch_deleted

                if batch_deleted < batch_size:
                    break

            logger.debug(f"Deleted {deleted_predictions} old predictions")

        except Exception as e:
            logger.warning(f"Error cleaning predictions (will retry): {e}")
            db.rollback()
        finally:
            db.close()

        logger.info(
            f"✅ Cleanup complete: {deleted_history} history, "
            f"{deleted_predictions} predictions, {deleted_cache} cache entries"
        )

        return {
            "status": "success",
            "deleted_history": deleted_history,
            "deleted_predictions": deleted_predictions,
            "deleted_cache": deleted_cache
        }

    finally:
        # Always release the lock
        cache_service.release_lock(lock_key)


def _is_holiday(check_date: date) -> bool:
    """
    Check if a date is a holiday (simplified for mock data).

    Includes major European and Tunisian holidays.
    """
    # Fixed holidays (month, day)
    holidays = [
        (1, 1),    # New Year
        (3, 20),   # Tunisia Independence Day
        (4, 9),    # Martyrs' Day
        (5, 1),    # Labour Day
        (7, 25),   # Tunisia Republic Day
        (8, 13),   # Women's Day (Tunisia)
        (8, 15),   # Assumption (France/Italy)
        (10, 15),  # Evacuation Day (Tunisia)
        (11, 1),   # All Saints (France/Italy)
        (11, 11),  # Armistice Day
        (12, 25),  # Christmas
        (12, 26),  # Boxing Day
    ]

    return (check_date.month, check_date.day) in holidays


# Aliases for celery beat schedule
record_price_snapshot = record_price_snapshot_task
generate_predictions = generate_predictions_task
update_route_statistics = update_route_statistics_task
update_fare_calendar_cache = update_fare_calendar_cache_task
cleanup_old_price_data = cleanup_old_price_data_task
