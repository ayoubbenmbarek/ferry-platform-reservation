"""
Meal and dining models for onboard reservations.
"""

from sqlalchemy import Column, Integer, String, Numeric, Boolean, DateTime, Text, ForeignKey, Enum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base
import enum


class MealTypeEnum(enum.Enum):
    """Meal service types."""
    BREAKFAST = "BREAKFAST"
    LUNCH = "LUNCH"
    DINNER = "DINNER"
    SNACK = "SNACK"
    BUFFET = "BUFFET"


class DietaryTypeEnum(enum.Enum):
    """Dietary requirement types."""
    REGULAR = "REGULAR"
    VEGETARIAN = "VEGETARIAN"
    VEGAN = "VEGAN"
    HALAL = "HALAL"
    KOSHER = "KOSHER"
    GLUTEN_FREE = "GLUTEN_FREE"
    DAIRY_FREE = "DAIRY_FREE"
    NUT_FREE = "NUT_FREE"


class Meal(Base):
    """Meal options available for booking."""

    __tablename__ = "meals"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)

    # Meal identification
    name = Column(String(100), nullable=False)  # e.g., "Deluxe Breakfast Buffet"
    description = Column(Text, nullable=True)
    meal_type = Column(Enum(MealTypeEnum), nullable=False)

    # Dietary options
    dietary_types = Column(String(255), nullable=True)  # JSON string of available dietary types

    # Pricing
    price = Column(Numeric(10, 2), nullable=False)
    currency = Column(String(3), default="EUR")

    # Availability
    is_available = Column(Boolean, default=True)
    available_per_day = Column(Boolean, default=True)  # If true, available daily; if false, one-time

    # Operator/Vessel reference
    operator = Column(String(50), nullable=True)
    vessel_id = Column(Integer, nullable=True)

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    booking_meals = relationship("BookingMeal", back_populates="meal")

    def __repr__(self):
        return f"<Meal(id={self.id}, name='{self.name}', type='{self.meal_type.value}')>"


class JourneyTypeEnum(enum.Enum):
    """Journey leg type for round trips."""
    OUTBOUND = "OUTBOUND"  # Aller
    RETURN = "RETURN"  # Retour


class BookingMeal(Base):
    """Meals reserved for a specific booking."""

    __tablename__ = "booking_meals"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=False)
    meal_id = Column(Integer, ForeignKey("meals.id"), nullable=False)

    # Reservation details
    passenger_id = Column(Integer, ForeignKey("booking_passengers.id"), nullable=True)  # Optional: specific passenger
    quantity = Column(Integer, nullable=False, default=1)
    meal_date = Column(DateTime(timezone=True), nullable=True)  # When the meal is scheduled
    journey_type = Column(Enum(JourneyTypeEnum), nullable=True)  # OUTBOUND or RETURN for round trips

    # Dietary requirements
    dietary_type = Column(Enum(DietaryTypeEnum), nullable=True)
    special_requests = Column(Text, nullable=True)

    # Pricing
    unit_price = Column(Numeric(10, 2), nullable=False)
    total_price = Column(Numeric(10, 2), nullable=False)  # unit_price * quantity

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    booking = relationship("Booking", back_populates="meals")
    meal = relationship("Meal", back_populates="booking_meals")
    passenger = relationship("BookingPassenger")

    def __repr__(self):
        return f"<BookingMeal(id={self.id}, booking_id={self.booking_id}, meal_id={self.meal_id})>"
