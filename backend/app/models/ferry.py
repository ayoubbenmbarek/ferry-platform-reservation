"""
Ferry, route, schedule, cabin, and port models.
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Numeric, ForeignKey, Enum, Float, JSON, Index
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base
import enum


class Port(Base):
    """
    Ferry port model.

    Stores port information synced from FerryHopper API.
    Cached locally for fast lookups and custom metadata.
    """

    __tablename__ = "ports"

    id = Column(Integer, primary_key=True, index=True)

    # Port identification
    code = Column(String(20), unique=True, nullable=False, index=True)  # Our internal code (e.g., "TUN", "MRS")
    ferryhopper_code = Column(String(20), nullable=True, index=True)  # FerryHopper API code
    name = Column(String(200), nullable=False)
    name_local = Column(String(200), nullable=True)  # Local language name

    # Location
    country = Column(String(100), nullable=False)
    country_code = Column(String(2), nullable=False, index=True)  # ISO 2-letter code (TN, FR, IT)
    region = Column(String(100), nullable=True)  # e.g., "Sicily", "Corsica"
    city = Column(String(100), nullable=True)

    # Coordinates
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    timezone = Column(String(50), nullable=True)  # e.g., "Europe/Paris"

    # Port details
    description = Column(Text, nullable=True)  # Marketing description
    facilities = Column(JSON, nullable=True)  # ["parking", "restaurant", "wifi", ...]
    address = Column(Text, nullable=True)
    phone = Column(String(50), nullable=True)
    website = Column(String(255), nullable=True)

    # Images
    image_url = Column(String(500), nullable=True)  # Main port image
    images = Column(JSON, nullable=True)  # Array of image URLs

    # Connections
    connected_ports = Column(JSON, nullable=True)  # Direct ferry connections ["GOA", "CIV", ...]
    operators = Column(JSON, nullable=True)  # Operators serving this port ["GNV", "CTN", ...]

    # FerryHopper specific
    supports_search_quotes = Column(Boolean, default=True)
    gates = Column(JSON, nullable=True)  # Gate information from FerryHopper

    # Status
    is_active = Column(Boolean, default=True)
    is_featured = Column(Boolean, default=False)  # Featured on homepage

    # Sync metadata
    last_synced_at = Column(DateTime(timezone=True), nullable=True)
    sync_source = Column(String(50), default="ferryhopper")  # Data source

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Indexes
    __table_args__ = (
        Index('idx_port_country', 'country_code'),
        Index('idx_port_active', 'is_active'),
        Index('idx_port_featured', 'is_featured'),
    )

    def __repr__(self):
        return f"<Port(code='{self.code}', name='{self.name}', country='{self.country}')>"

    def to_dict(self):
        """Convert to dictionary for API responses."""
        return {
            "code": self.code,
            "ferryhopper_code": self.ferryhopper_code,
            "name": self.name,
            "name_local": self.name_local,
            "country": self.country,
            "country_code": self.country_code,
            "region": self.region,
            "city": self.city,
            "coordinates": {
                "lat": self.latitude,
                "lng": self.longitude
            } if self.latitude and self.longitude else None,
            "timezone": self.timezone,
            "description": self.description,
            "facilities": self.facilities,
            "image_url": self.image_url,
            "connected_ports": self.connected_ports,
            "operators": self.operators,
            "is_active": self.is_active,
            "is_featured": self.is_featured
        }


class OperatorEnum(enum.Enum):
    """Ferry operators enum."""
    CTN = "ctn"
    GNV = "gnv"
    CORSICA = "corsica"
    DANEL = "danel"


class CabinTypeEnum(enum.Enum):
    """Cabin types enum."""
    SEAT = "SEAT"  # Reclining seat
    INSIDE = "INSIDE"  # Inside cabin (no window)
    OUTSIDE = "OUTSIDE"  # Outside cabin (with window)
    BALCONY = "BALCONY"  # Cabin with private balcony
    SUITE = "SUITE"  # Suite accommodation
    # Legacy values for backward compatibility
    INTERIOR = "INTERIOR"
    EXTERIOR = "EXTERIOR"
    DECK = "DECK"


class BedTypeEnum(enum.Enum):
    """Bed configuration types."""
    SINGLE = "SINGLE"  # Single bed
    DOUBLE = "DOUBLE"  # Double bed
    TWIN = "TWIN"  # Two single beds
    BUNK = "BUNK"  # Bunk beds
    PULLMAN = "PULLMAN"  # Pull-out bed


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
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    ferry_id = Column(Integer, ForeignKey("ferries.id"), nullable=True)  # Made nullable for generic cabins

    # Cabin identification
    name = Column(String(100), nullable=False, default="Standard Cabin")  # e.g., "Deluxe Suite"
    description = Column(Text, nullable=True)
    cabin_number = Column(String(20), nullable=True)
    cabin_type = Column(Enum(CabinTypeEnum), nullable=False)

    # Bed configuration
    bed_type = Column(Enum(BedTypeEnum), nullable=False, default=BedTypeEnum.TWIN)
    max_occupancy = Column(Integer, nullable=False, default=2)
    deck_level = Column(Integer, nullable=True)

    # Amenities (enhanced)
    has_private_bathroom = Column(Boolean, default=True)
    has_window = Column(Boolean, default=False)
    has_balcony = Column(Boolean, default=False)
    has_air_conditioning = Column(Boolean, default=True)
    has_tv = Column(Boolean, default=False)
    has_minibar = Column(Boolean, default=False)
    has_wifi = Column(Boolean, default=False)
    is_accessible = Column(Boolean, default=False)  # Wheelchair accessible

    # Pricing
    base_price = Column(Numeric(10, 2), nullable=False, default=0.00)  # Base price per crossing
    price_supplement = Column(Numeric(10, 2), nullable=False, default=0.00)  # Legacy field
    currency = Column(String(3), default="EUR")

    # Availability
    is_active = Column(Boolean, default=True)
    is_available = Column(Boolean, default=True)

    # Operator reference (for generic cabins not tied to specific ferry)
    operator = Column(String(50), nullable=True)

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    ferry = relationship("Ferry", back_populates="cabins")

    def __repr__(self):
        return f"<Cabin(id={self.id}, type={self.cabin_type.value}, name='{self.name}')>" 