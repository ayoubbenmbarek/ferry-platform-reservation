"""
Price API Endpoints

Provides fare calendar, price history, predictions, and flexible search functionality.
"""

from datetime import date, datetime, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from pydantic import BaseModel, Field
import calendar

from app.api.deps import get_db
from app.models.price_history import (
    PriceHistory,
    PricePrediction,
    RouteStatistics,
    FareCalendarCache,
    PriceTrendEnum,
    BookingRecommendationEnum,
)
from app.services.price_prediction_service import (
    PricePredictionService,
    PredictionResult,
    PriceInsight,
)

router = APIRouter()


# ============== Pydantic Schemas ==============

class DayPrice(BaseModel):
    """Price data for a single day."""
    date: str
    day: int
    price: Optional[float] = None
    lowest_price: Optional[float] = None
    highest_price: Optional[float] = None
    available: bool = True
    num_ferries: int = 0
    trend: Optional[str] = None
    is_cheapest: bool = False
    is_weekend: bool = False
    price_level: str = "normal"  # "cheap", "normal", "expensive"


class FareCalendarResponse(BaseModel):
    """Fare calendar for a month."""
    route_id: str
    departure_port: str
    arrival_port: str
    year: int
    month: int
    month_name: str
    passengers: int
    days: List[DayPrice]
    summary: dict = Field(default_factory=dict)


class PriceHistoryPoint(BaseModel):
    """Single point in price history."""
    date: str
    price: float
    lowest: Optional[float] = None
    highest: Optional[float] = None
    available: Optional[int] = None


class PriceHistoryResponse(BaseModel):
    """Price history for a route/date."""
    route_id: str
    departure_date: str
    days_of_data: int
    history: List[PriceHistoryPoint]
    trend: str
    average_price: float
    min_price: float
    max_price: float


class PricePredictionResponse(BaseModel):
    """AI price prediction."""
    route_id: str
    departure_date: str
    current_price: Optional[float] = None
    predicted_price: float
    predicted_low: float
    predicted_high: float
    confidence_score: float
    confidence_label: str
    price_trend: str
    trend_strength: float
    booking_recommendation: str
    recommendation_label: str
    potential_savings: float
    recommendation_reason: str
    factors: dict


class FlexibleSearchResult(BaseModel):
    """Single result from flexible search."""
    date: str
    day_name: str
    price: float
    savings_vs_selected: float
    is_cheapest: bool
    is_selected: bool
    available: bool
    num_ferries: int


class FlexibleSearchResponse(BaseModel):
    """Flexible dates search results."""
    route_id: str
    base_date: str
    flexibility_days: int
    passengers: int
    results: List[FlexibleSearchResult]
    cheapest_date: str
    cheapest_price: float
    selected_price: Optional[float] = None


class PriceInsightsResponse(BaseModel):
    """Route price insights."""
    route_id: str
    current_price: float
    avg_price_30d: float
    min_price_30d: float
    max_price_30d: float
    price_percentile: float
    percentile_label: str
    trend: str
    trend_description: str
    best_booking_window: str
    seasonal_insight: str
    savings_opportunity: Optional[float] = None


# ============== Helper Functions ==============

def get_route_id(departure_port: str, arrival_port: str) -> str:
    """Generate consistent route ID."""
    return f"{departure_port.lower()}_{arrival_port.lower()}"


def generate_mock_price(
    base_price: float,
    departure_date: date,
    days_ahead: int
) -> float:
    """Generate realistic mock prices for development."""
    import random
    import math

    # Base variation
    price = base_price

    # Seasonal factor (summer more expensive)
    month = departure_date.month
    seasonal_factors = {
        1: 0.85, 2: 0.85, 3: 0.90, 4: 0.95, 5: 1.00, 6: 1.15,
        7: 1.30, 8: 1.35, 9: 1.10, 10: 0.95, 11: 0.85, 12: 0.90
    }
    price *= seasonal_factors.get(month, 1.0)

    # Day of week factor
    dow = departure_date.weekday()
    if dow >= 4:  # Fri, Sat, Sun
        price *= 1.08

    # Days ahead factor (last minute more expensive)
    if days_ahead <= 3:
        price *= 1.20
    elif days_ahead <= 7:
        price *= 1.10
    elif days_ahead <= 14:
        price *= 1.05
    elif days_ahead > 60:
        price *= 0.95

    # Add some randomness
    price *= (1 + random.uniform(-0.08, 0.08))

    # Add wave pattern for realism
    day_of_year = departure_date.timetuple().tm_yday
    price *= (1 + 0.05 * math.sin(day_of_year / 30))

    return round(price, 2)


def get_price_level(price: float, min_price: float, max_price: float) -> str:
    """Determine price level for color coding."""
    if max_price == min_price:
        return "normal"

    range_size = max_price - min_price
    position = (price - min_price) / range_size

    if position < 0.33:
        return "cheap"
    elif position > 0.66:
        return "expensive"
    return "normal"


def get_confidence_label(score: float) -> str:
    """Convert confidence score to human label."""
    if score >= 0.8:
        return "High"
    elif score >= 0.6:
        return "Moderate"
    elif score >= 0.4:
        return "Low"
    return "Very Low"


def get_recommendation_label(rec: str) -> str:
    """Get human-readable recommendation label."""
    labels = {
        "book_now": "Book Now",
        "wait": "Wait for Better Price",
        "neutral": "Book When Ready",
        "great_deal": "Great Deal!",
    }
    return labels.get(rec, "Book When Ready")


def get_percentile_label(percentile: float) -> str:
    """Get label for price percentile."""
    if percentile <= 20:
        return "Excellent price - near the lowest!"
    elif percentile <= 40:
        return "Good price - below average"
    elif percentile <= 60:
        return "Average price"
    elif percentile <= 80:
        return "Above average price"
    return "High price - consider waiting"


# ============== API Endpoints ==============

@router.get("/calendar", response_model=FareCalendarResponse)
async def get_fare_calendar(
    departure_port: str = Query(..., description="Departure port code"),
    arrival_port: str = Query(..., description="Arrival port code"),
    year: int = Query(..., ge=2024, le=2030, description="Year"),
    month: int = Query(..., ge=1, le=12, description="Month"),
    passengers: int = Query(1, ge=1, le=9, description="Number of passengers"),
    db: Session = Depends(get_db),
):
    """
    Get fare calendar for a specific month.

    Returns daily prices with availability and price level indicators.
    Uses cached data when available, otherwise generates from current prices.
    """
    route_id = get_route_id(departure_port, arrival_port)

    # Base prices for different routes (mock data)
    base_prices = {
        "marseille_tunis": 85,
        "genoa_tunis": 95,
        "civitavecchia_tunis": 90,
        "nice_tunis": 88,
        "barcelona_tunis": 110,
    }
    base_price = base_prices.get(route_id, 85)

    # Get number of days in month
    _, num_days = calendar.monthrange(year, month)
    month_name = calendar.month_name[month]

    today = date.today()
    days = []
    prices = []

    for day in range(1, num_days + 1):
        departure_date = date(year, month, day)
        days_ahead = (departure_date - today).days

        # Skip past dates
        if days_ahead < 0:
            days.append(DayPrice(
                date=departure_date.isoformat(),
                day=day,
                price=None,
                available=False,
                num_ferries=0,
                is_weekend=departure_date.weekday() >= 5,
            ))
            continue

        # Generate mock price
        price = generate_mock_price(base_price, departure_date, days_ahead)
        price_for_passengers = price * passengers
        prices.append(price_for_passengers)

        days.append(DayPrice(
            date=departure_date.isoformat(),
            day=day,
            price=price_for_passengers,
            lowest_price=price_for_passengers,
            highest_price=price_for_passengers * 1.3,
            available=True,
            num_ferries=3 if departure_date.weekday() < 5 else 2,
            is_weekend=departure_date.weekday() >= 5,
        ))

    # Calculate summary stats
    valid_prices = [p for p in prices if p is not None]
    if valid_prices:
        min_price = min(valid_prices)
        max_price = max(valid_prices)
        avg_price = sum(valid_prices) / len(valid_prices)

        # Mark cheapest and set price levels
        for day_price in days:
            if day_price.price is not None:
                day_price.is_cheapest = day_price.price == min_price
                day_price.price_level = get_price_level(
                    day_price.price, min_price, max_price
                )
    else:
        min_price = 0
        max_price = 0
        avg_price = 0

    # Find cheapest date
    cheapest_date = None
    for dp in days:
        if dp.is_cheapest:
            cheapest_date = dp.date
            break

    return FareCalendarResponse(
        route_id=route_id,
        departure_port=departure_port,
        arrival_port=arrival_port,
        year=year,
        month=month,
        month_name=month_name,
        passengers=passengers,
        days=days,
        summary={
            "min_price": round(min_price, 2) if min_price else None,
            "max_price": round(max_price, 2) if max_price else None,
            "avg_price": round(avg_price, 2) if avg_price else None,
            "cheapest_date": cheapest_date,
            "available_days": len(valid_prices),
        }
    )


@router.get("/history", response_model=PriceHistoryResponse)
async def get_price_history(
    departure_port: str = Query(...),
    arrival_port: str = Query(...),
    departure_date: str = Query(..., description="Departure date (YYYY-MM-DD)"),
    days: int = Query(30, ge=7, le=90, description="Days of history"),
    db: Session = Depends(get_db),
):
    """
    Get price history for a specific route and departure date.

    Returns historical price data points for trend visualization.
    """
    route_id = get_route_id(departure_port, arrival_port)
    target_date = date.fromisoformat(departure_date)

    # Base price for route
    base_prices = {
        "marseille_tunis": 85,
        "genoa_tunis": 95,
        "civitavecchia_tunis": 90,
    }
    base_price = base_prices.get(route_id, 85)

    # Generate mock historical data
    history = []
    today = date.today()
    import random

    # Create a trend
    trend_direction = random.choice([-1, 0, 1])
    trend_strength = random.uniform(0.001, 0.005)

    prices = []
    for i in range(days, 0, -1):
        record_date = today - timedelta(days=i)
        days_until = (target_date - record_date).days

        if days_until < 0:
            continue

        # Base price with trend
        price = base_price * (1 + trend_direction * trend_strength * (days - i))

        # Add seasonal variation
        price *= 1 + 0.1 * (target_date.month - 6) / 6

        # Add noise
        price *= 1 + random.uniform(-0.05, 0.05)

        price = round(price, 2)
        prices.append(price)

        history.append(PriceHistoryPoint(
            date=record_date.isoformat(),
            price=price,
            lowest=price * 0.95,
            highest=price * 1.15,
            available=random.randint(20, 150),
        ))

    # Calculate stats
    if prices:
        avg_price = sum(prices) / len(prices)
        min_price = min(prices)
        max_price = max(prices)

        # Determine trend
        if len(prices) >= 5:
            first_avg = sum(prices[:5]) / 5
            last_avg = sum(prices[-5:]) / 5
            if last_avg > first_avg * 1.03:
                trend = "rising"
            elif last_avg < first_avg * 0.97:
                trend = "falling"
            else:
                trend = "stable"
        else:
            trend = "stable"
    else:
        avg_price = base_price
        min_price = base_price
        max_price = base_price
        trend = "stable"

    return PriceHistoryResponse(
        route_id=route_id,
        departure_date=departure_date,
        days_of_data=len(history),
        history=history,
        trend=trend,
        average_price=round(avg_price, 2),
        min_price=round(min_price, 2),
        max_price=round(max_price, 2),
    )


@router.get("/prediction", response_model=PricePredictionResponse)
async def get_price_prediction(
    departure_port: str = Query(...),
    arrival_port: str = Query(...),
    departure_date: str = Query(..., description="Departure date (YYYY-MM-DD)"),
    current_price: Optional[float] = Query(None, description="Current known price"),
    db: Session = Depends(get_db),
):
    """
    Get AI-powered price prediction for a specific route and date.

    Returns prediction with confidence score and booking recommendation.
    """
    route_id = get_route_id(departure_port, arrival_port)
    target_date = date.fromisoformat(departure_date)

    # Use prediction service
    service = PricePredictionService(db)
    prediction = service.predict_price(route_id, target_date, current_price)

    return PricePredictionResponse(
        route_id=route_id,
        departure_date=departure_date,
        current_price=current_price,
        predicted_price=prediction.predicted_price,
        predicted_low=prediction.predicted_low,
        predicted_high=prediction.predicted_high,
        confidence_score=prediction.confidence_score,
        confidence_label=get_confidence_label(prediction.confidence_score),
        price_trend=prediction.price_trend.value,
        trend_strength=prediction.trend_strength,
        booking_recommendation=prediction.booking_recommendation.value,
        recommendation_label=get_recommendation_label(
            prediction.booking_recommendation.value
        ),
        potential_savings=prediction.potential_savings,
        recommendation_reason=prediction.recommendation_reason,
        factors=prediction.factors,
    )


@router.get("/flexible-search", response_model=FlexibleSearchResponse)
async def flexible_dates_search(
    departure_port: str = Query(...),
    arrival_port: str = Query(...),
    base_date: str = Query(..., description="Base date (YYYY-MM-DD)"),
    flexibility: int = Query(3, ge=1, le=7, description="Days flexibility (+/-)"),
    passengers: int = Query(1, ge=1, le=9),
    db: Session = Depends(get_db),
):
    """
    Search for prices across a flexible date range.

    Returns prices for dates around the selected date, sorted by price.
    """
    route_id = get_route_id(departure_port, arrival_port)
    selected_date = date.fromisoformat(base_date)
    today = date.today()

    # Base price
    base_prices = {
        "marseille_tunis": 85,
        "genoa_tunis": 95,
        "civitavecchia_tunis": 90,
    }
    base_price = base_prices.get(route_id, 85)

    results = []
    selected_price = None

    for offset in range(-flexibility, flexibility + 1):
        check_date = selected_date + timedelta(days=offset)
        days_ahead = (check_date - today).days

        if days_ahead < 0:
            continue

        # Generate price
        price = generate_mock_price(base_price, check_date, days_ahead)
        total_price = price * passengers

        is_selected = offset == 0
        if is_selected:
            selected_price = total_price

        results.append({
            "date": check_date,
            "day_name": check_date.strftime("%A"),
            "price": total_price,
            "is_selected": is_selected,
            "available": True,
            "num_ferries": 3 if check_date.weekday() < 5 else 2,
        })

    # Sort by price and find cheapest
    results.sort(key=lambda x: x["price"])
    cheapest_date = results[0]["date"].isoformat()
    cheapest_price = results[0]["price"]

    # Calculate savings
    formatted_results = []
    for r in results:
        savings = (selected_price - r["price"]) if selected_price else 0
        formatted_results.append(FlexibleSearchResult(
            date=r["date"].isoformat(),
            day_name=r["day_name"],
            price=round(r["price"], 2),
            savings_vs_selected=round(savings, 2),
            is_cheapest=r["date"].isoformat() == cheapest_date,
            is_selected=r["is_selected"],
            available=r["available"],
            num_ferries=r["num_ferries"],
        ))

    return FlexibleSearchResponse(
        route_id=route_id,
        base_date=base_date,
        flexibility_days=flexibility,
        passengers=passengers,
        results=formatted_results,
        cheapest_date=cheapest_date,
        cheapest_price=round(cheapest_price, 2),
        selected_price=round(selected_price, 2) if selected_price else None,
    )


@router.get("/insights", response_model=PriceInsightsResponse)
async def get_price_insights(
    departure_port: str = Query(...),
    arrival_port: str = Query(...),
    current_price: Optional[float] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Get comprehensive price insights for a route.

    Returns statistics, trends, and recommendations.
    """
    route_id = get_route_id(departure_port, arrival_port)

    # Use prediction service for insights
    service = PricePredictionService(db)
    insights = service.get_price_insights(route_id, current_price)

    return PriceInsightsResponse(
        route_id=route_id,
        current_price=insights.current_price,
        avg_price_30d=insights.avg_price_30d,
        min_price_30d=insights.min_price_30d,
        max_price_30d=insights.max_price_30d,
        price_percentile=insights.price_percentile,
        percentile_label=get_percentile_label(insights.price_percentile),
        trend=insights.trend.value,
        trend_description=insights.trend_description,
        best_booking_window=insights.best_booking_window,
        seasonal_insight=insights.seasonal_insight,
        savings_opportunity=insights.savings_opportunity,
    )


@router.get("/cheapest-in-month")
async def get_cheapest_in_month(
    departure_port: str = Query(...),
    arrival_port: str = Query(...),
    year: int = Query(...),
    month: int = Query(...),
    passengers: int = Query(1),
    db: Session = Depends(get_db),
):
    """
    Find the cheapest date in a month.

    Quick endpoint for "cheapest in month" feature.
    """
    # Get full calendar
    calendar_data = await get_fare_calendar(
        departure_port=departure_port,
        arrival_port=arrival_port,
        year=year,
        month=month,
        passengers=passengers,
        db=db,
    )

    # Find cheapest
    cheapest_day = None
    for day in calendar_data.days:
        if day.is_cheapest and day.price:
            cheapest_day = day
            break

    if not cheapest_day:
        raise HTTPException(status_code=404, detail="No available dates in this month")

    return {
        "route_id": calendar_data.route_id,
        "year": year,
        "month": month,
        "cheapest_date": cheapest_day.date,
        "price": cheapest_day.price,
        "day_of_week": date.fromisoformat(cheapest_day.date).strftime("%A"),
        "num_ferries": cheapest_day.num_ferries,
    }
