"""
Price History and Prediction Models

Models for tracking historical ferry prices and AI-powered price predictions.
"""

from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List
import enum

from sqlalchemy import (
    Column, Integer, String, Float, DateTime, Date,
    Boolean, ForeignKey, Text, Enum, Index, UniqueConstraint,
    JSON
)
from sqlalchemy.orm import relationship

from app.database import Base


class PriceTrendEnum(str, enum.Enum):
    """Price trend direction."""
    RISING = "rising"
    FALLING = "falling"
    STABLE = "stable"


class BookingRecommendationEnum(str, enum.Enum):
    """Booking recommendation types."""
    BOOK_NOW = "book_now"
    WAIT = "wait"
    NEUTRAL = "neutral"
    GREAT_DEAL = "great_deal"


class PriceHistory(Base):
    """
    Stores historical price snapshots for routes.

    Records prices at regular intervals to enable:
    - Price trend analysis
    - Historical comparisons
    - ML model training
    - User price insights
    """
    __tablename__ = "price_history"

    id = Column(Integer, primary_key=True, index=True)

    # Route identification
    route_id = Column(String(100), nullable=False, index=True)  # e.g., "marseille_tunis"
    departure_port = Column(String(50), nullable=False)
    arrival_port = Column(String(50), nullable=False)
    operator = Column(String(50), nullable=True)  # Specific operator or null for aggregate

    # Time context
    recorded_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    departure_date = Column(Date, nullable=False, index=True)
    days_until_departure = Column(Integer, nullable=True)  # Calculated field

    # Price data (per person/vehicle)
    price_adult = Column(Float, nullable=False)
    price_child = Column(Float, nullable=True)
    price_infant = Column(Float, nullable=True)
    price_vehicle = Column(Float, nullable=True)

    # Aggregate prices for the day
    lowest_price = Column(Float, nullable=False)  # Lowest adult price across all ferries
    highest_price = Column(Float, nullable=True)
    average_price = Column(Float, nullable=True)

    # Availability snapshot
    available_passengers = Column(Integer, nullable=True)
    available_vehicles = Column(Integer, nullable=True)
    num_ferries = Column(Integer, nullable=True)  # Number of ferries on this date

    # Day context
    is_weekend = Column(Boolean, default=False)
    is_holiday = Column(Boolean, default=False)
    day_of_week = Column(Integer, nullable=True)  # 0=Monday, 6=Sunday

    # Indexes for efficient queries
    __table_args__ = (
        Index('idx_price_history_route_date', 'route_id', 'departure_date'),
        Index('idx_price_history_recorded', 'recorded_at'),
        Index('idx_price_history_route_recorded', 'route_id', 'recorded_at'),
    )

    def __repr__(self):
        return f"<PriceHistory {self.route_id} {self.departure_date} €{self.lowest_price}>"


class PricePrediction(Base):
    """
    AI-generated price predictions for future dates.

    Stores predictions with confidence scores and recommendations
    to help users decide when to book.
    """
    __tablename__ = "price_predictions"

    id = Column(Integer, primary_key=True, index=True)

    # Route and date
    route_id = Column(String(100), nullable=False, index=True)
    departure_port = Column(String(50), nullable=False)
    arrival_port = Column(String(50), nullable=False)
    prediction_date = Column(Date, nullable=False, index=True)  # Date we're predicting for

    # Prediction metadata
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    model_version = Column(String(20), default="v1.0", nullable=False)

    # Price predictions
    predicted_price = Column(Float, nullable=False)
    predicted_low = Column(Float, nullable=True)  # Predicted range low
    predicted_high = Column(Float, nullable=True)  # Predicted range high
    current_price = Column(Float, nullable=True)  # Price at prediction time

    # Confidence and trend
    confidence_score = Column(Float, nullable=False)  # 0.0 to 1.0
    price_trend = Column(String(20), default=PriceTrendEnum.STABLE.value)
    trend_strength = Column(Float, nullable=True)  # How strong the trend is

    # Recommendation
    booking_recommendation = Column(String(20), default=BookingRecommendationEnum.NEUTRAL.value)
    potential_savings = Column(Float, nullable=True)  # Estimated savings if following recommendation
    recommendation_reason = Column(Text, nullable=True)

    # Factors that influenced prediction
    prediction_factors = Column(JSON, nullable=True)
    # Example: {"seasonality": 0.3, "days_to_departure": 0.4, "trend": 0.2, "demand": 0.1}

    # Unique constraint - one prediction per route/date
    __table_args__ = (
        UniqueConstraint('route_id', 'prediction_date', name='uq_prediction_route_date'),
        Index('idx_prediction_route_date', 'route_id', 'prediction_date'),
    )

    def __repr__(self):
        return f"<PricePrediction {self.route_id} {self.prediction_date} €{self.predicted_price}>"


class RouteStatistics(Base):
    """
    Aggregated statistics for routes.

    Pre-computed metrics for fast display of route insights.
    Updated periodically by background tasks.
    """
    __tablename__ = "route_statistics"

    id = Column(Integer, primary_key=True, index=True)

    # Route identification
    route_id = Column(String(100), unique=True, nullable=False, index=True)
    departure_port = Column(String(50), nullable=False)
    arrival_port = Column(String(50), nullable=False)

    # Last update
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 30-day statistics
    avg_price_30d = Column(Float, nullable=True)
    min_price_30d = Column(Float, nullable=True)
    max_price_30d = Column(Float, nullable=True)
    price_volatility_30d = Column(Float, nullable=True)  # Standard deviation

    # 90-day statistics
    avg_price_90d = Column(Float, nullable=True)
    min_price_90d = Column(Float, nullable=True)
    max_price_90d = Column(Float, nullable=True)

    # All-time statistics
    all_time_low = Column(Float, nullable=True)
    all_time_high = Column(Float, nullable=True)
    all_time_low_date = Column(Date, nullable=True)
    all_time_high_date = Column(Date, nullable=True)

    # Booking patterns
    typical_advance_days = Column(Integer, nullable=True)  # Best days in advance to book
    best_booking_window_start = Column(Integer, nullable=True)  # e.g., 14 days before
    best_booking_window_end = Column(Integer, nullable=True)  # e.g., 7 days before

    # Day-of-week patterns
    weekday_avg_price = Column(Float, nullable=True)
    weekend_avg_price = Column(Float, nullable=True)
    cheapest_day_of_week = Column(Integer, nullable=True)  # 0=Monday
    most_expensive_day = Column(Integer, nullable=True)

    # Seasonal patterns (JSON for flexibility)
    seasonal_patterns = Column(JSON, nullable=True)
    # Example: {"jan": 75, "feb": 72, ..., "aug": 120}

    # Demand indicators
    avg_availability = Column(Float, nullable=True)  # Average seats available
    high_demand_dates = Column(JSON, nullable=True)  # Dates with low availability

    # Current status
    current_price_percentile = Column(Float, nullable=True)  # Where current price falls in range
    price_trend_7d = Column(String(20), nullable=True)  # Recent trend

    def __repr__(self):
        return f"<RouteStatistics {self.route_id}>"


class FareCalendarCache(Base):
    """
    Cached fare calendar data for quick retrieval.

    Stores pre-computed monthly calendar data to avoid
    expensive queries on every page load.
    """
    __tablename__ = "fare_calendar_cache"

    id = Column(Integer, primary_key=True, index=True)

    # Cache key
    route_id = Column(String(100), nullable=False, index=True)
    year_month = Column(String(7), nullable=False)  # e.g., "2025-01"
    passengers = Column(Integer, default=1)  # Passenger count for pricing

    # Cache metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)

    # Calendar data (JSON for flexibility)
    calendar_data = Column(JSON, nullable=False)
    # Example: {
    #   "1": {"price": 85, "available": true, "ferries": 3, "trend": "stable"},
    #   "2": {"price": 82, "available": true, "ferries": 2, "trend": "falling"},
    #   ...
    # }

    # Summary stats for the month
    month_lowest = Column(Float, nullable=True)
    month_highest = Column(Float, nullable=True)
    month_average = Column(Float, nullable=True)
    cheapest_date = Column(Integer, nullable=True)  # Day of month

    __table_args__ = (
        UniqueConstraint('route_id', 'year_month', 'passengers', name='uq_calendar_cache'),
        Index('idx_calendar_cache_route_month', 'route_id', 'year_month'),
    )

    def __repr__(self):
        return f"<FareCalendarCache {self.route_id} {self.year_month}>"
