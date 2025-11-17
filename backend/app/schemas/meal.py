"""
Meal schemas for API requests/responses.
"""

from pydantic import BaseModel, Field, field_serializer
from typing import Optional, List
from datetime import datetime
from enum import Enum


class MealBase(BaseModel):
    """Base meal schema."""
    name: str
    description: Optional[str] = None
    meal_type: str  # BREAKFAST, LUNCH, DINNER, SNACK, BUFFET
    price: float
    currency: str = "EUR"


class MealCreate(MealBase):
    """Schema for creating a meal."""
    dietary_types: Optional[str] = None  # JSON string
    operator: Optional[str] = None
    vessel_id: Optional[int] = None
    available_per_day: bool = True


class MealUpdate(BaseModel):
    """Schema for updating a meal."""
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    is_available: Optional[bool] = None


class MealResponse(MealBase):
    """Schema for meal responses."""
    id: int
    is_available: bool
    dietary_types: Optional[str] = None
    operator: Optional[str] = None
    created_at: datetime

    @field_serializer('meal_type')
    def serialize_enum(self, value):
        """Convert enum to string value."""
        if isinstance(value, Enum):
            return value.value
        return value

    class Config:
        from_attributes = True


class BookingMealCreate(BaseModel):
    """Schema for adding a meal to a booking."""
    meal_id: int
    quantity: int = Field(ge=1, default=1)
    passenger_id: Optional[int] = None
    meal_date: Optional[datetime] = None
    dietary_type: Optional[str] = None  # REGULAR, VEGETARIAN, VEGAN, HALAL, etc.
    special_requests: Optional[str] = None
    journey_type: Optional[str] = "OUTBOUND"  # OUTBOUND or RETURN


class BookingMealResponse(BaseModel):
    """Schema for booking meal responses."""
    id: int
    booking_id: int
    meal_id: int
    meal: MealResponse
    quantity: int
    unit_price: float
    total_price: float
    passenger_id: Optional[int] = None
    meal_date: Optional[datetime] = None
    dietary_type: Optional[str] = None
    special_requests: Optional[str] = None
    journey_type: Optional[str] = None  # OUTBOUND or RETURN
    created_at: datetime

    class Config:
        from_attributes = True
