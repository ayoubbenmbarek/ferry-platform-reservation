"""
Cabin schemas for API requests/responses.
"""

from pydantic import BaseModel, Field, field_serializer
from typing import Optional
from datetime import datetime
from enum import Enum


class CabinBase(BaseModel):
    """Base cabin schema."""
    name: str
    description: Optional[str] = None
    cabin_type: str  # SEAT, INSIDE, OUTSIDE, BALCONY, SUITE
    bed_type: str  # SINGLE, DOUBLE, TWIN, BUNK, PULLMAN
    max_occupancy: int = 2
    has_private_bathroom: bool = True
    has_tv: bool = False
    has_minibar: bool = False
    has_air_conditioning: bool = True
    has_wifi: bool = False
    is_accessible: bool = False
    base_price: float
    currency: str = "EUR"


class CabinCreate(CabinBase):
    """Schema for creating a cabin."""
    cabin_number: Optional[str] = None
    operator: Optional[str] = None
    vessel_id: Optional[int] = None


class CabinUpdate(BaseModel):
    """Schema for updating a cabin."""
    name: Optional[str] = None
    description: Optional[str] = None
    base_price: Optional[float] = None
    is_available: Optional[bool] = None
    max_occupancy: Optional[int] = None


class CabinResponse(BaseModel):
    """Schema for cabin responses."""
    id: int
    name: str
    description: Optional[str] = None
    cabin_type: str
    bed_type: str
    max_occupancy: int
    has_private_bathroom: bool
    has_tv: bool
    has_minibar: bool
    has_air_conditioning: bool
    has_wifi: bool
    is_accessible: bool
    base_price: float
    currency: str
    cabin_number: Optional[str] = None
    is_available: bool
    operator: Optional[str] = None
    created_at: datetime

    @classmethod
    def model_validate(cls, obj):
        """Custom validation to handle enum conversion."""
        if hasattr(obj, '__dict__'):
            data = {}
            for field_name in cls.model_fields.keys():
                value = getattr(obj, field_name, None)
                if isinstance(value, Enum):
                    data[field_name] = value.value
                else:
                    data[field_name] = value
            return cls(**data)
        return super().model_validate(obj)

    class Config:
        from_attributes = True


class CabinSelection(BaseModel):
    """Schema for selecting a cabin in a booking."""
    cabin_id: int
    quantity: int = 1  # Number of cabins to book
