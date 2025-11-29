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


class PetTypeEnum(enum.Enum):
    """Pet type enum."""
    CAT = "CAT"
    SMALL_ANIMAL = "SMALL_ANIMAL"
    DOG = "DOG"


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

    # Ferry schedule details (outbound journey)
    departure_port = Column(String(100), nullable=True)
    arrival_port = Column(String(100), nullable=True)
    departure_time = Column(DateTime(timezone=True), nullable=True)
    arrival_time = Column(DateTime(timezone=True), nullable=True)
    vessel_name = Column(String(100), nullable=True)

    # Return journey details (for round trips - can be different from outbound)
    is_round_trip = Column(Boolean, default=False)
    return_sailing_id = Column(String(100), nullable=True)
    return_operator = Column(String(50), nullable=True)  # Can be different operator for return
    return_departure_port = Column(String(100), nullable=True)  # Can be different route
    return_arrival_port = Column(String(100), nullable=True)
    return_departure_time = Column(DateTime(timezone=True), nullable=True)
    return_arrival_time = Column(DateTime(timezone=True), nullable=True)
    return_vessel_name = Column(String(100), nullable=True)

    # Booking reference
    booking_reference = Column(String(20), unique=True, nullable=False, index=True)
    operator_booking_reference = Column(String(100), nullable=True)  # Operator's booking ref
    return_operator_booking_reference = Column(String(100), nullable=True)  # Return operator's booking ref
    
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
    discount_amount = Column(Numeric(10, 2), default=0.00)  # Promo code discount
    tax_amount = Column(Numeric(10, 2), default=0.00)
    total_amount = Column(Numeric(10, 2), nullable=False)
    currency = Column(String(3), default="EUR")

    # Promo code
    promo_code = Column(String(50), nullable=True)  # Applied promo code
    
    # Status
    status = Column(Enum(BookingStatusEnum), default=BookingStatusEnum.PENDING)
    
    # Special requirements
    special_requests = Column(Text, nullable=True)
    accessibility_requirements = Column(Text, nullable=True)
    
    # Cabin selection (for outbound journey)
    cabin_id = Column(Integer, ForeignKey("cabins.id"), nullable=True)
    cabin_supplement = Column(Numeric(10, 2), default=0.00)

    # Return cabin selection (for return journey in round trips)
    return_cabin_id = Column(Integer, ForeignKey("cabins.id"), nullable=True)
    return_cabin_supplement = Column(Numeric(10, 2), default=0.00)
    
    # Cancellation
    cancellation_reason = Column(Text, nullable=True)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    refund_amount = Column(Numeric(10, 2), nullable=True)
    refund_processed = Column(Boolean, default=False)

    # Modification tracking
    modification_count = Column(Integer, default=0)
    fare_type = Column(String(50), default="flexible")  # flexible, semi-flexible, non-modifiable
    last_modified_at = Column(DateTime(timezone=True), nullable=True)

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=True)  # When pending booking expires

    # Relationships
    user = relationship("User", back_populates="bookings")
    schedule = relationship("Schedule", back_populates="bookings")
    cabin = relationship("Cabin", foreign_keys=[cabin_id])
    return_cabin = relationship("Cabin", foreign_keys=[return_cabin_id])
    passengers = relationship("BookingPassenger", back_populates="booking", cascade="all, delete-orphan")
    vehicles = relationship("BookingVehicle", back_populates="booking", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="booking")
    meals = relationship("BookingMeal", back_populates="booking", cascade="all, delete-orphan")
    modifications = relationship("BookingModification", back_populates="booking", cascade="all, delete-orphan")
    booking_cabins = relationship("BookingCabin", back_populates="booking", cascade="all, delete-orphan")
    
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

    # Pet information (cats, small animals, dogs)
    has_pet = Column(Boolean, default=False)
    pet_type = Column(Enum(PetTypeEnum), nullable=True)
    pet_name = Column(String(100), nullable=True)
    pet_weight_kg = Column(Numeric(5, 2), nullable=True)  # For pricing/regulations
    pet_carrier_provided = Column(Boolean, default=False)  # Does passenger have own carrier

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
    owner = Column(String(100), nullable=True)
    license_plate = Column(String(20), nullable=False)

    # Dimensions
    length_cm = Column(Integer, nullable=False)
    width_cm = Column(Integer, nullable=False)
    height_cm = Column(Integer, nullable=False)
    weight_kg = Column(Integer, nullable=True)

    # Accessories
    has_trailer = Column(Boolean, default=False)
    has_caravan = Column(Boolean, default=False)
    has_roof_box = Column(Boolean, default=False)
    has_bike_rack = Column(Boolean, default=False)
    
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

class BookingModification(Base):
    """Booking modification history."""
    
    __tablename__ = "booking_modifications"
    
    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False)
    
    # Who made the modification
    modified_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    modified_by_admin = Column(Boolean, default=False)
    
    # When
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # What changed (JSON field with before/after)
    changes = Column(Text, nullable=False)  # Will store JSON
    
    # Financial impact
    original_total = Column(Numeric(10, 2), nullable=False)
    new_total = Column(Numeric(10, 2), nullable=False)
    modification_fee = Column(Numeric(10, 2), default=0.00)
    price_difference = Column(Numeric(10, 2), default=0.00)
    total_charged = Column(Numeric(10, 2), nullable=False)
    
    # Payment
    payment_status = Column(String(50), nullable=True)  # pending, paid, refunded
    payment_intent_id = Column(String(255), nullable=True)
    
    # Status
    status = Column(String(50), default="draft")  # draft, pending_payment, completed, failed
    
    # Operator confirmation
    operator_confirmed = Column(Boolean, default=False)
    operator_reference = Column(String(100), nullable=True)
    
    # Relationships
    booking = relationship("Booking", back_populates="modifications")
    modified_by = relationship("User", foreign_keys=[modified_by_user_id])
    
    def __repr__(self):
        return f"<BookingModification(id={self.id}, booking_id={self.booking_id}, status='{self.status}')>"


class JourneyTypeEnum(enum.Enum):
    """Journey type enum for round trips."""
    OUTBOUND = "OUTBOUND"
    RETURN = "RETURN"


class BookingCabin(Base):
    """Cabin selections for a booking - supports multiple cabins per journey."""

    __tablename__ = "booking_cabins"

    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False)
    cabin_id = Column(Integer, ForeignKey("cabins.id"), nullable=False)

    # Journey type (outbound or return)
    journey_type = Column(Enum(JourneyTypeEnum), default=JourneyTypeEnum.OUTBOUND)

    # Quantity and pricing
    quantity = Column(Integer, default=1)
    unit_price = Column(Numeric(10, 2), nullable=False)
    total_price = Column(Numeric(10, 2), nullable=False)

    # Payment tracking
    payment_id = Column(Integer, ForeignKey("payments.id"), nullable=True)  # Link to payment if paid separately
    is_paid = Column(Boolean, default=False)

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    booking = relationship("Booking", back_populates="booking_cabins")
    cabin = relationship("Cabin")
    payment = relationship("Payment")

    def __repr__(self):
        return f"<BookingCabin(id={self.id}, booking_id={self.booking_id}, cabin_id={self.cabin_id}, qty={self.quantity})>"


class ModificationQuote(Base):
    """Temporary modification quotes that expire."""

    __tablename__ = "modification_quotes"
    
    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False)
    
    # Timing
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
    
    # Quote details
    modifications = Column(Text, nullable=False)  # JSON of requested modifications
    price_breakdown = Column(Text, nullable=False)  # JSON of price breakdown
    
    # Pricing
    original_total = Column(Numeric(10, 2), nullable=False)
    new_total = Column(Numeric(10, 2), nullable=False)
    modification_fee = Column(Numeric(10, 2), default=0.00)
    price_difference = Column(Numeric(10, 2), default=0.00)
    total_to_pay = Column(Numeric(10, 2), nullable=False)
    
    # Availability
    availability_confirmed = Column(Boolean, default=False)
    
    # Status
    status = Column(String(50), default="pending")  # pending, accepted, expired, rejected
    
    # Relationship
    booking = relationship("Booking")
    
    def __repr__(self):
        return f"<ModificationQuote(id={self.id}, booking_id={self.booking_id}, total_to_pay={self.total_to_pay})>"
