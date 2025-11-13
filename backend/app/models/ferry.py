"""
Ferry, route, schedule and cabin models.
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Numeric, ForeignKey, Enum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base
import enum


class OperatorEnum(enum.Enum):
    """Ferry operators enum."""
    CTN = "ctn"
    GNV = "gnv"
    CORSICA = "corsica"
    DANEL = "danel"


class CabinTypeEnum(enum.Enum):
    """Cabin types enum."""
    INTERIOR = "interior"
    EXTERIOR = "exterior"
    SUITE = "suite"
    DECK = "deck"


class VehicleTypeEnum(enum.Enum):
    """Vehicle types enum."""
    CAR = "car"
    MOTORCYCLE = "motorcycle"
    CAMPER = "camper"
    TRUCK = "truck"


class Ferry(Base):
    """Ferry vessel model."""
    
    __tablename__ = "ferries"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    operator = Column(Enum(OperatorEnum), nullable=False)
    operator_vessel_id = Column(String(50), nullable=False)  # Operator's internal ID
    
    # Vessel specifications
    capacity_passengers = Column(Integer, nullable=False)
    capacity_vehicles = Column(Integer, nullable=False)
    length_meters = Column(Numeric(8, 2), nullable=True)
    
    # Status
    is_active = Column(Boolean, default=True)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    schedules = relationship("Schedule", back_populates="ferry")
    cabins = relationship("Cabin", back_populates="ferry")
    
    def __repr__(self):
        return f"<Ferry(id={self.id}, name='{self.name}', operator='{self.operator.value}')>"


class Route(Base):
    """Ferry route model."""
    
    __tablename__ = "routes"
    
    id = Column(Integer, primary_key=True, index=True)
    departure_port = Column(String(50), nullable=False)
    arrival_port = Column(String(50), nullable=False)
    operator = Column(Enum(OperatorEnum), nullable=False)
    
    # Route details
    distance_nautical_miles = Column(Numeric(8, 2), nullable=True)
    estimated_duration_hours = Column(Numeric(4, 2), nullable=False)
    
    # Pricing
    base_price_adult = Column(Numeric(10, 2), nullable=False)
    base_price_child = Column(Numeric(10, 2), nullable=False)
    base_price_infant = Column(Numeric(10, 2), default=0.00)
    base_price_vehicle = Column(Numeric(10, 2), nullable=False)
    
    # Status
    is_active = Column(Boolean, default=True)
    seasonal_route = Column(Boolean, default=False)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    schedules = relationship("Schedule", back_populates="route")
    
    def __repr__(self):
        return f"<Route(id={self.id}, {self.departure_port}->{self.arrival_port})>"


class Schedule(Base):
    """Ferry schedule model."""
    
    __tablename__ = "schedules"
    
    id = Column(Integer, primary_key=True, index=True)
    ferry_id = Column(Integer, ForeignKey("ferries.id"), nullable=False)
    route_id = Column(Integer, ForeignKey("routes.id"), nullable=False)
    
    # Schedule details
    departure_time = Column(DateTime(timezone=True), nullable=False)
    arrival_time = Column(DateTime(timezone=True), nullable=False)
    
    # Availability
    available_passengers = Column(Integer, nullable=False)
    available_vehicles = Column(Integer, nullable=False)
    
    # Pricing (can override route base prices)
    price_adult = Column(Numeric(10, 2), nullable=True)
    price_child = Column(Numeric(10, 2), nullable=True)
    price_infant = Column(Numeric(10, 2), nullable=True)
    price_vehicle = Column(Numeric(10, 2), nullable=True)
    
    # Status
    is_active = Column(Boolean, default=True)
    is_cancelled = Column(Boolean, default=False)
    cancellation_reason = Column(Text, nullable=True)
    
    # External reference
    operator_schedule_id = Column(String(100), nullable=False)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    ferry = relationship("Ferry", back_populates="schedules")
    route = relationship("Route", back_populates="schedules")
    bookings = relationship("Booking", back_populates="schedule")
    
    def __repr__(self):
        return f"<Schedule(id={self.id}, ferry={self.ferry_id}, departure={self.departure_time})>"


class Cabin(Base):
    """Cabin model for ferry accommodations."""
    
    __tablename__ = "cabins"
    
    id = Column(Integer, primary_key=True, index=True)
    ferry_id = Column(Integer, ForeignKey("ferries.id"), nullable=False)
    
    # Cabin details
    cabin_type = Column(Enum(CabinTypeEnum), nullable=False)
    cabin_number = Column(String(20), nullable=True)
    deck_level = Column(Integer, nullable=True)
    capacity = Column(Integer, nullable=False, default=2)
    
    # Amenities
    has_bathroom = Column(Boolean, default=False)
    has_window = Column(Boolean, default=False)
    has_balcony = Column(Boolean, default=False)
    has_air_conditioning = Column(Boolean, default=True)
    
    # Pricing
    price_supplement = Column(Numeric(10, 2), nullable=False, default=0.00)
    
    # Status
    is_active = Column(Boolean, default=True)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    ferry = relationship("Ferry", back_populates="cabins")
    
    def __repr__(self):
        return f"<Cabin(id={self.id}, type={self.cabin_type.value}, ferry={self.ferry_id})>" 