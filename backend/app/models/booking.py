"""
Booking models for ferry reservations.
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Numeric, ForeignKey, Enum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base
import enum


class BookingStatusEnum(enum.Enum):
    """Booking status enum."""
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    CANCELLED = "CANCELLED"
    COMPLETED = "COMPLETED"
    REFUNDED = "REFUNDED"


class PassengerTypeEnum(enum.Enum):
    """Passenger type enum."""
    ADULT = "ADULT"
    CHILD = "CHILD"
    INFANT = "INFANT"


class VehicleTypeEnum(enum.Enum):
    """Vehicle type enum."""
    CAR = "CAR"
    SUV = "SUV"
    VAN = "VAN"
    MOTORCYCLE = "MOTORCYCLE"
    CAMPER = "CAMPER"
    CARAVAN = "CARAVAN"
    TRUCK = "TRUCK"


class Booking(Base):
    """Main booking model."""
    
    __tablename__ = "bookings"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Nullable for guest bookings
    schedule_id = Column(Integer, ForeignKey("schedules.id"), nullable=True)  # Optional - we use sailing_id for operator bookings

    # Operator booking details
    sailing_id = Column(String(100), nullable=True)  # Operator's sailing identifier
    operator = Column(String(50), nullable=True)  # Ferry operator name (CTN, GNV, etc.)

    # Ferry schedule details
    departure_port = Column(String(100), nullable=True)
    arrival_port = Column(String(100), nullable=True)
    departure_time = Column(DateTime(timezone=True), nullable=True)
    arrival_time = Column(DateTime(timezone=True), nullable=True)
    vessel_name = Column(String(100), nullable=True)

    # Booking reference
    booking_reference = Column(String(20), unique=True, nullable=False, index=True)
    operator_booking_reference = Column(String(100), nullable=True)  # Operator's booking ref
    
    # Contact information (for guest bookings)
    contact_email = Column(String(255), nullable=False)
    contact_phone = Column(String(20), nullable=True)
    contact_first_name = Column(String(100), nullable=False)
    contact_last_name = Column(String(100), nullable=False)
    
    # Booking details
    total_passengers = Column(Integer, nullable=False)
    total_vehicles = Column(Integer, default=0)
    
    # Pricing
    subtotal = Column(Numeric(10, 2), nullable=False)
    tax_amount = Column(Numeric(10, 2), default=0.00)
    total_amount = Column(Numeric(10, 2), nullable=False)
    currency = Column(String(3), default="EUR")
    
    # Status
    status = Column(Enum(BookingStatusEnum), default=BookingStatusEnum.PENDING)
    
    # Special requirements
    special_requests = Column(Text, nullable=True)
    accessibility_requirements = Column(Text, nullable=True)
    
    # Cabin selection
    cabin_id = Column(Integer, ForeignKey("cabins.id"), nullable=True)
    cabin_supplement = Column(Numeric(10, 2), default=0.00)
    
    # Cancellation
    cancellation_reason = Column(Text, nullable=True)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    refund_amount = Column(Numeric(10, 2), nullable=True)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="bookings")
    schedule = relationship("Schedule", back_populates="bookings")
    cabin = relationship("Cabin")
    passengers = relationship("BookingPassenger", back_populates="booking", cascade="all, delete-orphan")
    vehicles = relationship("BookingVehicle", back_populates="booking", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="booking")
    
    def __repr__(self):
        return f"<Booking(id={self.id}, ref='{self.booking_reference}', status='{self.status.value}')>"
    
    @property
    def is_paid(self):
        """Check if booking is fully paid."""
        paid_amount = sum(p.amount for p in self.payments if p.status == "completed")
        return paid_amount >= self.total_amount


class BookingPassenger(Base):
    """Passenger details for a booking."""
    
    __tablename__ = "booking_passengers"
    
    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=False)
    
    # Passenger details
    passenger_type = Column(Enum(PassengerTypeEnum), nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    date_of_birth = Column(DateTime, nullable=True)
    nationality = Column(String(3), nullable=True)  # ISO country code
    passport_number = Column(String(50), nullable=True)
    passport_expiry = Column(DateTime, nullable=True)
    
    # Pricing
    base_price = Column(Numeric(10, 2), nullable=False)
    discounts = Column(Numeric(10, 2), default=0.00)
    final_price = Column(Numeric(10, 2), nullable=False)
    
    # Special requirements
    dietary_requirements = Column(Text, nullable=True)
    mobility_assistance = Column(Boolean, default=False)
    special_needs = Column(Text, nullable=True)  # General special needs/requirements
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    booking = relationship("Booking", back_populates="passengers")
    
    def __repr__(self):
        return f"<BookingPassenger(id={self.id}, name='{self.first_name} {self.last_name}')>"


class BookingVehicle(Base):
    """Vehicle details for a booking."""
    
    __tablename__ = "booking_vehicles"
    
    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=False)
    
    # Vehicle details
    vehicle_type = Column(Enum(VehicleTypeEnum), nullable=False)
    make = Column(String(50), nullable=True)
    model = Column(String(50), nullable=True)
    license_plate = Column(String(20), nullable=False)
    
    # Dimensions
    length_cm = Column(Integer, nullable=False)
    width_cm = Column(Integer, nullable=False)
    height_cm = Column(Integer, nullable=False)
    weight_kg = Column(Integer, nullable=True)
    
    # Pricing
    base_price = Column(Numeric(10, 2), nullable=False)
    size_supplement = Column(Numeric(10, 2), default=0.00)
    final_price = Column(Numeric(10, 2), nullable=False)
    
    # Special requirements
    contains_hazardous_materials = Column(Boolean, default=False)
    requires_special_handling = Column(Boolean, default=False)
    special_instructions = Column(Text, nullable=True)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    booking = relationship("Booking", back_populates="vehicles")
    
    def __repr__(self):
        return f"<BookingVehicle(id={self.id}, type='{self.vehicle_type.value}', plate='{self.license_plate}')>" 