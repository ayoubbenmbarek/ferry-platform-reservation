"""
Cabin models for ferry accommodations.
"""

from sqlalchemy import Column, Integer, String, Numeric, Boolean, DateTime, Text, ForeignKey, Enum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base
import enum


class CabinTypeEnum(enum.Enum):
    """Cabin type categories."""
    SEAT = "SEAT"  # Reclining seat
    INSIDE = "INSIDE"  # Inside cabin (no window)
    OUTSIDE = "OUTSIDE"  # Outside cabin (with window)
    BALCONY = "BALCONY"  # Cabin with private balcony
    SUITE = "SUITE"  # Suite accommodation


class BedTypeEnum(enum.Enum):
    """Bed configuration types."""
    SINGLE = "SINGLE"  # Single bed
    DOUBLE = "DOUBLE"  # Double bed
    TWIN = "TWIN"  # Two single beds
    BUNK = "BUNK"  # Bunk beds
    PULLMAN = "PULLMAN"  # Pull-out bed


class Cabin(Base):
    """Cabin model for ferry accommodations."""

    __tablename__ = "cabins"

    id = Column(Integer, primary_key=True, index=True)

    # Cabin identification
    cabin_number = Column(String(20), nullable=True)  # Physical cabin number (e.g., "A101")
    cabin_type = Column(Enum(CabinTypeEnum), nullable=False)

    # Cabin details
    name = Column(String(100), nullable=False)  # e.g., "Deluxe Suite", "Standard Inside Cabin"
    description = Column(Text, nullable=True)

    # Bed configuration
    bed_type = Column(Enum(BedTypeEnum), nullable=False)
    max_occupancy = Column(Integer, nullable=False, default=2)

    # Amenities
    has_private_bathroom = Column(Boolean, default=True)
    has_tv = Column(Boolean, default=False)
    has_minibar = Column(Boolean, default=False)
    has_air_conditioning = Column(Boolean, default=True)
    has_wifi = Column(Boolean, default=False)
    is_accessible = Column(Boolean, default=False)  # Wheelchair accessible

    # Pricing
    base_price = Column(Numeric(10, 2), nullable=False)  # Base price per night/crossing
    currency = Column(String(3), default="EUR")

    # Availability
    is_available = Column(Boolean, default=True)

    # Ferry/Operator reference (optional - for specific vessels)
    vessel_id = Column(Integer, nullable=True)  # Link to specific vessel if needed
    operator = Column(String(50), nullable=True)  # Ferry operator

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def __repr__(self):
        return f"<Cabin(id={self.id}, type='{self.cabin_type.value}', name='{self.name}')>"
