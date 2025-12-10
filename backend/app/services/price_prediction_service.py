"""
AI-Powered Price Prediction Service

Uses machine learning and statistical analysis to predict ferry prices
and provide booking recommendations to users.
"""

import numpy as np
from datetime import datetime, date, timedelta
from typing import Optional, List, Dict, Tuple, Any
from dataclasses import dataclass
from enum import Enum
import logging
import json

from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from app.models.price_history import (
    PriceHistory,
    PricePrediction,
    RouteStatistics,
    PriceTrendEnum,
    BookingRecommendationEnum,
)

logger = logging.getLogger(__name__)


@dataclass
class PredictionResult:
    """Result of a price prediction."""
    predicted_price: float
    predicted_low: float
    predicted_high: float
    confidence_score: float
    price_trend: PriceTrendEnum
    trend_strength: float
    booking_recommendation: BookingRecommendationEnum
    potential_savings: float
    recommendation_reason: str
    factors: Dict[str, float]


@dataclass
class PriceInsight:
    """Aggregated price insights for a route."""
    current_price: float
    avg_price_30d: float
    min_price_30d: float
    max_price_30d: float
    price_percentile: float  # Where current price falls (0-100)
    trend: PriceTrendEnum
    trend_description: str
    best_booking_window: str
    seasonal_insight: str
    savings_opportunity: Optional[float]


class PricePredictionService:
    """
    Service for predicting ferry prices using ML/statistical methods.

    The prediction model uses multiple factors:
    1. Historical price patterns for the route
    2. Seasonality (monthly, day-of-week)
    3. Days until departure (prices typically rise closer to date)
    4. Recent price trend (momentum)
    5. Demand indicators (availability)
    6. Holiday/event calendar
    """

    # Model weights (can be tuned or learned)
    FACTOR_WEIGHTS = {
        'seasonality': 0.25,
        'days_to_departure': 0.30,
        'trend_momentum': 0.20,
        'day_of_week': 0.10,
        'demand': 0.15,
    }

    # Days-to-departure price multipliers (based on typical patterns)
    DAYS_TO_DEPARTURE_FACTORS = {
        (0, 3): 1.25,      # Last minute: 25% premium
        (4, 7): 1.15,      # One week: 15% premium
        (8, 14): 1.05,     # Two weeks: 5% premium
        (15, 30): 1.00,    # Sweet spot: base price
        (31, 60): 0.98,    # Early booking: slight discount
        (61, 90): 0.95,    # Very early: better discount
        (91, 365): 0.92,   # Far out: best discount
    }

    # Monthly seasonality factors (Mediterranean routes)
    MONTHLY_SEASONALITY = {
        1: 0.85,   # January: low season
        2: 0.85,   # February: low season
        3: 0.90,   # March: shoulder
        4: 0.95,   # April: Easter
        5: 1.00,   # May: growing
        6: 1.15,   # June: high season starts
        7: 1.30,   # July: peak
        8: 1.35,   # August: peak
        9: 1.10,   # September: shoulder
        10: 0.95,  # October: shoulder
        11: 0.85,  # November: low
        12: 0.90,  # December: holidays
    }

    # Day of week factors (0=Monday)
    DAY_OF_WEEK_FACTORS = {
        0: 0.95,   # Monday: cheaper
        1: 0.95,   # Tuesday: cheaper
        2: 0.97,   # Wednesday: average
        3: 0.98,   # Thursday: average
        4: 1.05,   # Friday: weekend starts
        5: 1.10,   # Saturday: expensive
        6: 1.05,   # Sunday: moderate
    }

    def __init__(self, db: Session):
        self.db = db

    def predict_price(
        self,
        route_id: str,
        departure_date: date,
        current_price: Optional[float] = None
    ) -> PredictionResult:
        """
        Predict the price for a specific route and date.

        Args:
            route_id: Route identifier (e.g., "marseille_tunis")
            departure_date: The departure date to predict for
            current_price: Current known price (if available)

        Returns:
            PredictionResult with prediction and recommendation
        """
        # Get historical data
        history = self._get_price_history(route_id, departure_date)
        stats = self._get_route_statistics(route_id)

        # Calculate base price
        base_price = self._calculate_base_price(history, stats, current_price)

        # Calculate factors
        factors = self._calculate_prediction_factors(
            departure_date=departure_date,
            history=history,
            stats=stats,
            current_price=current_price,
        )

        # Apply factors to get predicted price
        predicted_price = self._apply_factors(base_price, factors)

        # Calculate confidence based on data quality
        confidence = self._calculate_confidence(history, stats)

        # Determine trend
        trend, trend_strength = self._analyze_trend(history)

        # Calculate prediction range
        volatility = stats.price_volatility_30d if stats else base_price * 0.1
        predicted_low = predicted_price - volatility
        predicted_high = predicted_price + volatility

        # Generate recommendation
        recommendation, savings, reason = self._generate_recommendation(
            current_price=current_price or predicted_price,
            predicted_price=predicted_price,
            trend=trend,
            confidence=confidence,
            departure_date=departure_date,
            stats=stats,
        )

        return PredictionResult(
            predicted_price=round(predicted_price, 2),
            predicted_low=round(max(0, predicted_low), 2),
            predicted_high=round(predicted_high, 2),
            confidence_score=round(confidence, 2),
            price_trend=trend,
            trend_strength=round(trend_strength, 2),
            booking_recommendation=recommendation,
            potential_savings=round(savings, 2) if savings else 0,
            recommendation_reason=reason,
            factors={k: round(v, 3) for k, v in factors.items()},
        )

    def _get_price_history(
        self,
        route_id: str,
        departure_date: date,
        days_back: int = 60
    ) -> List[PriceHistory]:
        """Get historical prices for the route."""
        cutoff = datetime.utcnow() - timedelta(days=days_back)

        return self.db.query(PriceHistory).filter(
            and_(
                PriceHistory.route_id == route_id,
                PriceHistory.recorded_at >= cutoff,
            )
        ).order_by(PriceHistory.recorded_at.desc()).all()

    def _get_route_statistics(self, route_id: str) -> Optional[RouteStatistics]:
        """Get pre-computed route statistics."""
        return self.db.query(RouteStatistics).filter(
            RouteStatistics.route_id == route_id
        ).first()

    def _calculate_base_price(
        self,
        history: List[PriceHistory],
        stats: Optional[RouteStatistics],
        current_price: Optional[float]
    ) -> float:
        """Calculate the base price for prediction."""
        if current_price:
            return current_price

        if stats and stats.avg_price_30d:
            return stats.avg_price_30d

        if history:
            prices = [h.lowest_price for h in history if h.lowest_price]
            if prices:
                return float(np.mean(prices))

        # Default fallback
        return 85.0

    def _calculate_prediction_factors(
        self,
        departure_date: date,
        history: List[PriceHistory],
        stats: Optional[RouteStatistics],
        current_price: Optional[float],
    ) -> Dict[str, float]:
        """Calculate all prediction factors."""
        factors = {}

        # Days to departure factor
        days_until = (departure_date - date.today()).days
        factors['days_to_departure'] = self._get_days_to_departure_factor(days_until)

        # Seasonality factor (month)
        factors['seasonality'] = self.MONTHLY_SEASONALITY.get(
            departure_date.month, 1.0
        )

        # Day of week factor
        factors['day_of_week'] = self.DAY_OF_WEEK_FACTORS.get(
            departure_date.weekday(), 1.0
        )

        # Trend momentum factor
        factors['trend_momentum'] = self._calculate_trend_momentum(history)

        # Demand factor (based on availability trends)
        factors['demand'] = self._calculate_demand_factor(history)

        return factors

    def _get_days_to_departure_factor(self, days: int) -> float:
        """Get price factor based on days until departure."""
        for (min_days, max_days), factor in self.DAYS_TO_DEPARTURE_FACTORS.items():
            if min_days <= days <= max_days:
                return factor
        return 1.0

    def _calculate_trend_momentum(self, history: List[PriceHistory]) -> float:
        """Calculate price trend momentum from recent history."""
        if len(history) < 3:
            return 1.0

        # Get prices from last 7 days
        recent = sorted(history[:7], key=lambda h: h.recorded_at)
        if len(recent) < 2:
            return 1.0

        prices = [h.lowest_price for h in recent if h.lowest_price]
        if len(prices) < 2:
            return 1.0

        # Calculate percentage change
        first_price = prices[0]
        last_price = prices[-1]

        if first_price > 0:
            pct_change = (last_price - first_price) / first_price
            # Convert to factor (cap at ±10%)
            return 1.0 + max(-0.10, min(0.10, pct_change))

        return 1.0

    def _calculate_demand_factor(self, history: List[PriceHistory]) -> float:
        """Calculate demand factor based on availability trends."""
        if not history:
            return 1.0

        # Average availability from recent records
        availabilities = [
            h.available_passengers for h in history[:10]
            if h.available_passengers is not None
        ]

        if not availabilities:
            return 1.0

        avg_availability = float(np.mean(availabilities))

        # Low availability = high demand = higher prices
        if avg_availability < 20:
            return 1.15  # High demand
        elif avg_availability < 50:
            return 1.05  # Moderate demand
        elif avg_availability > 150:
            return 0.95  # Low demand

        return 1.0

    def _apply_factors(self, base_price: float, factors: Dict[str, float]) -> float:
        """Apply weighted factors to base price."""
        # Weighted combination of factors
        combined_factor = 0.0
        total_weight = 0.0

        for factor_name, factor_value in factors.items():
            weight = self.FACTOR_WEIGHTS.get(factor_name, 0.1)
            combined_factor += (factor_value - 1.0) * weight
            total_weight += weight

        if total_weight > 0:
            combined_factor = combined_factor / total_weight

        # Apply combined factor to base price
        return base_price * (1.0 + combined_factor)

    def _calculate_confidence(
        self,
        history: List[PriceHistory],
        stats: Optional[RouteStatistics]
    ) -> float:
        """Calculate prediction confidence based on data quality."""
        confidence = 0.5  # Base confidence

        # More history = more confidence
        history_count = len(history)
        if history_count >= 100:
            confidence += 0.3
        elif history_count >= 50:
            confidence += 0.2
        elif history_count >= 20:
            confidence += 0.1

        # Has route statistics
        if stats:
            confidence += 0.1

        # Recent data available
        if history and history[0].recorded_at > datetime.utcnow() - timedelta(hours=24):
            confidence += 0.1

        return min(0.95, confidence)

    def _analyze_trend(
        self,
        history: List[PriceHistory]
    ) -> Tuple[PriceTrendEnum, float]:
        """Analyze price trend from history."""
        if len(history) < 5:
            return PriceTrendEnum.STABLE, 0.0

        # Get prices over last 14 days
        recent = sorted(history[:14], key=lambda h: h.recorded_at)
        prices = [h.lowest_price for h in recent if h.lowest_price]

        if len(prices) < 3:
            return PriceTrendEnum.STABLE, 0.0

        # Simple linear regression
        x = np.arange(len(prices))
        slope, _ = np.polyfit(x, prices, 1)
        slope = float(slope)  # Convert numpy type to Python float

        # Calculate trend strength (normalized slope)
        avg_price = float(np.mean(prices))
        trend_strength = abs(slope / avg_price) if avg_price > 0 else 0.0

        # Determine trend direction
        if slope > avg_price * 0.01:  # More than 1% increase per period
            return PriceTrendEnum.RISING, trend_strength
        elif slope < -avg_price * 0.01:  # More than 1% decrease per period
            return PriceTrendEnum.FALLING, trend_strength

        return PriceTrendEnum.STABLE, trend_strength

    def _generate_recommendation(
        self,
        current_price: float,
        predicted_price: float,
        trend: PriceTrendEnum,
        confidence: float,
        departure_date: date,
        stats: Optional[RouteStatistics],
    ) -> Tuple[BookingRecommendationEnum, float, str]:
        """Generate booking recommendation."""
        days_until = (departure_date - date.today()).days
        price_diff = predicted_price - current_price
        pct_diff = (price_diff / current_price * 100) if current_price > 0 else 0

        # Check if current price is a great deal
        if stats and stats.min_price_30d:
            if current_price <= stats.min_price_30d * 1.05:
                return (
                    BookingRecommendationEnum.GREAT_DEAL,
                    0,
                    f"Current price is near the 30-day low of €{stats.min_price_30d:.0f}!"
                )

        # Prices rising + booking soon = book now
        if trend == PriceTrendEnum.RISING and confidence > 0.6:
            potential_savings = max(0, price_diff)
            return (
                BookingRecommendationEnum.BOOK_NOW,
                potential_savings,
                f"Prices are rising. Book now to save up to €{potential_savings:.0f}."
            )

        # Prices falling + time available = wait
        if trend == PriceTrendEnum.FALLING and days_until > 14 and confidence > 0.6:
            potential_savings = max(0, current_price - predicted_price)
            return (
                BookingRecommendationEnum.WAIT,
                potential_savings,
                f"Prices are falling. You could save €{potential_savings:.0f} by waiting."
            )

        # Last minute booking
        if days_until <= 7:
            return (
                BookingRecommendationEnum.BOOK_NOW,
                0,
                "Departure is soon. Book now to secure your spot."
            )

        # In optimal booking window
        if 14 <= days_until <= 30:
            return (
                BookingRecommendationEnum.BOOK_NOW,
                0,
                "You're in the optimal booking window. Good time to book."
            )

        # Default neutral
        return (
            BookingRecommendationEnum.NEUTRAL,
            0,
            "Price is stable. Book when convenient for you."
        )

    def get_price_insights(
        self,
        route_id: str,
        current_price: Optional[float] = None
    ) -> PriceInsight:
        """Get comprehensive price insights for a route."""
        stats = self._get_route_statistics(route_id)
        history = self._get_price_history(route_id, date.today())

        # Calculate current metrics
        if current_price is None:
            if history:
                current_price = history[0].lowest_price
            elif stats:
                current_price = stats.avg_price_30d
            else:
                current_price = 85.0

        # Get stats values
        avg_30d = stats.avg_price_30d if stats else current_price
        min_30d = stats.min_price_30d if stats else current_price * 0.85
        max_30d = stats.max_price_30d if stats else current_price * 1.15

        # Calculate percentile
        price_range = max_30d - min_30d
        if price_range > 0:
            percentile = ((current_price - min_30d) / price_range) * 100
        else:
            percentile = 50.0

        # Get trend
        trend, _ = self._analyze_trend(history)

        # Generate descriptions
        trend_desc = {
            PriceTrendEnum.RISING: "Prices have been increasing recently",
            PriceTrendEnum.FALLING: "Prices have been decreasing recently",
            PriceTrendEnum.STABLE: "Prices have been stable",
        }[trend]

        # Booking window advice
        if stats and stats.best_booking_window_start:
            booking_window = (
                f"Book {stats.best_booking_window_start}-{stats.best_booking_window_end} "
                "days in advance for best prices"
            )
        else:
            booking_window = "Book 2-4 weeks in advance for best prices"

        # Seasonal insight
        month = date.today().month
        seasonality = self.MONTHLY_SEASONALITY.get(month, 1.0)
        if seasonality > 1.1:
            seasonal = "High season - expect higher prices"
        elif seasonality < 0.9:
            seasonal = "Low season - good deals available"
        else:
            seasonal = "Moderate season - average prices"

        # Savings opportunity
        savings = None
        if current_price and min_30d and current_price > min_30d * 1.1:
            savings = current_price - min_30d

        return PriceInsight(
            current_price=round(current_price, 2),
            avg_price_30d=round(avg_30d, 2),
            min_price_30d=round(min_30d, 2),
            max_price_30d=round(max_30d, 2),
            price_percentile=round(min(100, max(0, percentile)), 1),
            trend=trend,
            trend_description=trend_desc,
            best_booking_window=booking_window,
            seasonal_insight=seasonal,
            savings_opportunity=round(savings, 2) if savings else None,
        )

    def save_prediction(
        self,
        route_id: str,
        departure_port: str,
        arrival_port: str,
        departure_date: date,
        prediction: PredictionResult,
        current_price: Optional[float] = None,
    ) -> PricePrediction:
        """Save a prediction to the database."""
        # Check for existing prediction
        existing = self.db.query(PricePrediction).filter(
            and_(
                PricePrediction.route_id == route_id,
                PricePrediction.prediction_date == departure_date,
            )
        ).first()

        if existing:
            # Update existing
            existing.predicted_price = prediction.predicted_price
            existing.predicted_low = prediction.predicted_low
            existing.predicted_high = prediction.predicted_high
            existing.confidence_score = prediction.confidence_score
            existing.price_trend = prediction.price_trend.value
            existing.trend_strength = prediction.trend_strength
            existing.booking_recommendation = prediction.booking_recommendation.value
            existing.potential_savings = prediction.potential_savings
            existing.recommendation_reason = prediction.recommendation_reason
            existing.prediction_factors = prediction.factors
            existing.current_price = current_price
            existing.created_at = datetime.utcnow()

            self.db.commit()
            return existing

        # Create new
        db_prediction = PricePrediction(
            route_id=route_id,
            departure_port=departure_port,
            arrival_port=arrival_port,
            prediction_date=departure_date,
            predicted_price=prediction.predicted_price,
            predicted_low=prediction.predicted_low,
            predicted_high=prediction.predicted_high,
            current_price=current_price,
            confidence_score=prediction.confidence_score,
            price_trend=prediction.price_trend.value,
            trend_strength=prediction.trend_strength,
            booking_recommendation=prediction.booking_recommendation.value,
            potential_savings=prediction.potential_savings,
            recommendation_reason=prediction.recommendation_reason,
            prediction_factors=prediction.factors,
        )

        self.db.add(db_prediction)
        self.db.commit()
        self.db.refresh(db_prediction)

        return db_prediction
