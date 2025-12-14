"""
Celery tasks for tracking ferry prices and recording historical data.
Generates mock data with realistic patterns for price predictions and insights.
"""
import logging
import random
import math
from datetime import datetime, timezone, timedelta, date
from typing import List, Dict, Any, Optional
from celery import shared_task
from sqlalchemy import and_

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
    """
    db = SessionLocal()
    try:
        logger.info("📈 Updating route statistics...")

        now = datetime.now(timezone.utc)
        today = now.date()
        routes_updated = 0

        # Pre-fetch all route statistics in ONE query (fixes N+1)
        route_ids = [r["route_id"] for r in TRACKED_ROUTES]
        existing_stats = db.query(RouteStatistics).filter(
            RouteStatistics.route_id.in_(route_ids)
        ).all()
        stats_by_route = {s.route_id: s for s in existing_stats}

        for route in TRACKED_ROUTES:
            route_id = route["route_id"]
            departure_port = route["departure_port"]
            arrival_port = route["arrival_port"]

            try:
                # Get or create route statistics (using pre-fetched data)
                stats = stats_by_route.get(route_id)

                if not stats:
                    stats = RouteStatistics(
                        route_id=route_id,
                        departure_port=departure_port,
                        arrival_port=arrival_port,
                    )
                    db.add(stats)

                # Calculate 30-day statistics
                thirty_days_ago = today - timedelta(days=30)
                prices_30d = db.query(PriceHistory.lowest_price).filter(
                    and_(
                        PriceHistory.route_id == route_id,
                        PriceHistory.recorded_at >= thirty_days_ago
                    )
                ).all()

                if prices_30d:
                    prices = [p[0] for p in prices_30d if p[0]]
                    if prices:
                        stats.avg_price_30d = round(sum(prices) / len(prices), 2)
                        stats.min_price_30d = min(prices)
                        stats.max_price_30d = max(prices)
                        # Standard deviation for volatility
                        mean = stats.avg_price_30d
                        variance = sum((p - mean) ** 2 for p in prices) / len(prices)
                        stats.price_volatility_30d = round(math.sqrt(variance), 2)

                # Calculate 90-day statistics
                ninety_days_ago = today - timedelta(days=90)
                prices_90d = db.query(PriceHistory.lowest_price).filter(
                    and_(
                        PriceHistory.route_id == route_id,
                        PriceHistory.recorded_at >= ninety_days_ago
                    )
                ).all()

                if prices_90d:
                    prices = [p[0] for p in prices_90d if p[0]]
                    if prices:
                        stats.avg_price_90d = round(sum(prices) / len(prices), 2)
                        stats.min_price_90d = min(prices)
                        stats.max_price_90d = max(prices)

                # All-time low/high
                all_time = db.query(
                    PriceHistory.lowest_price,
                    PriceHistory.departure_date
                ).filter(
                    PriceHistory.route_id == route_id
                ).order_by(PriceHistory.lowest_price.asc()).first()

                if all_time:
                    stats.all_time_low = all_time[0]
                    stats.all_time_low_date = all_time[1]

                all_time_high = db.query(
                    PriceHistory.highest_price,
                    PriceHistory.departure_date
                ).filter(
                    PriceHistory.route_id == route_id
                ).order_by(PriceHistory.highest_price.desc()).first()

                if all_time_high:
                    stats.all_time_high = all_time_high[0]
                    stats.all_time_high_date = all_time_high[1]

                # Day of week averages
                weekday_prices = db.query(PriceHistory.lowest_price).filter(
                    and_(
                        PriceHistory.route_id == route_id,
                        PriceHistory.is_weekend == False
                    )
                ).all()

                weekend_prices = db.query(PriceHistory.lowest_price).filter(
                    and_(
                        PriceHistory.route_id == route_id,
                        PriceHistory.is_weekend == True
                    )
                ).all()

                if weekday_prices:
                    prices = [p[0] for p in weekday_prices if p[0]]
                    if prices:
                        stats.weekday_avg_price = round(sum(prices) / len(prices), 2)

                if weekend_prices:
                    prices = [p[0] for p in weekend_prices if p[0]]
                    if prices:
                        stats.weekend_avg_price = round(sum(prices) / len(prices), 2)

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
    bind=True
)
def cleanup_old_price_data_task(self):
    """
    Cleanup old price history data to manage database size.

    Keeps last 180 days of data for analysis.
    """
    db = SessionLocal()
    try:
        logger.info("🧹 Cleaning up old price data...")

        cleanup_date = datetime.now(timezone.utc) - timedelta(days=180)

        # Delete old price history
        deleted_history = db.query(PriceHistory).filter(
            PriceHistory.recorded_at < cleanup_date
        ).delete()

        # Delete old predictions
        deleted_predictions = db.query(PricePrediction).filter(
            PricePrediction.prediction_date < cleanup_date.date()
        ).delete()

        # Delete expired cache entries
        deleted_cache = db.query(FareCalendarCache).filter(
            FareCalendarCache.expires_at < datetime.now(timezone.utc)
        ).delete()

        db.commit()

        logger.info(f"✅ Cleanup complete: {deleted_history} history, {deleted_predictions} predictions, {deleted_cache} cache entries")

        return {
            "status": "success",
            "deleted_history": deleted_history,
            "deleted_predictions": deleted_predictions,
            "deleted_cache": deleted_cache
        }

    except Exception as e:
        logger.error(f"Error cleaning up price data: {str(e)}", exc_info=True)
        db.rollback()
        raise
    finally:
        db.close()


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
