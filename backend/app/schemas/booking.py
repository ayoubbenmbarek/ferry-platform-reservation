"""
Booking Pydantic schemas for request/response validation.
"""

from typing import List, Dict, Optional, Any
from datetime import datetime, date
from decimal import Decimal
try:
    from pydantic import BaseModel, field_validator, ConfigDict
except ImportError:
    class BaseModel:
        pass
    def field_validator(*args, **kwargs):
        def decorator(func):
            return func
        return decorator
    class ConfigDict:
        def __init__(self, **kwargs):
            pass

from enum import Enum
from .ferry import PassengerInfo, VehicleInfo
from .meal import BookingMealResponse


class BookingStatus(str, Enum):
    """Booking status enumeration."""
    PENDING = "pending"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"
    COMPLETED = "completed"
    REFUNDED = "refunded"


class CabinSelection(BaseModel):
    """Cabin selection schema."""
    type: str
    deck: Optional[str] = None
    preferences: Optional[List[str]] = None
    supplement_price: Optional[float] = None


class ContactInfo(BaseModel):
    """Contact information schema."""
    email: str
    phone: Optional[str] = None
    first_name: str
    last_name: str
    address: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None


class JourneyType(str, Enum):
    """Journey type enumeration for round trips."""
    OUTBOUND = "outbound"  # Aller
    RETURN = "return"  # Retour


class MealSelection(BaseModel):
    """Meal selection schema for booking creation."""
    meal_id: int
    quantity: int = 1
    passenger_id: Optional[int] = None
    dietary_type: Optional[str] = None
    special_requests: Optional[str] = None
    journey_type: Optional[str] = "outbound"  # Default to outbound - use string instead of enum for flexibility


class CabinSelectionItem(BaseModel):
    """Single cabin selection with quantity and price."""
    cabin_id: int
    quantity: int
    price: float  # Total price for this cabin type


class BookingCreate(BaseModel):
    """Booking creation schema."""
    sailing_id: str
    operator: str
    passengers: List[PassengerInfo]
    vehicles: Optional[List[VehicleInfo]] = None
    cabin_id: Optional[int] = None  # Legacy: Outbound cabin (single)
    meals: Optional[List[MealSelection]] = None
    contact_info: ContactInfo
    special_requests: Optional[str] = None

    # Ferry schedule details (outbound)
    departure_port: Optional[str] = None
    arrival_port: Optional[str] = None
    departure_time: Optional[datetime] = None
    arrival_time: Optional[datetime] = None
    vessel_name: Optional[str] = None

    # Pricing from selected ferry (to avoid hardcoded prices)
    ferry_prices: Optional[Dict[str, float]] = None

    # Round trip support (all optional - can be different from outbound)
    is_round_trip: Optional[bool] = False
    return_sailing_id: Optional[str] = None
    return_operator: Optional[str] = None  # Can be different operator
    return_departure_port: Optional[str] = None  # Can be different route
    return_arrival_port: Optional[str] = None
    return_cabin_id: Optional[int] = None  # Legacy: Return cabin (single)
    return_departure_time: Optional[datetime] = None
    return_arrival_time: Optional[datetime] = None
    return_vessel_name: Optional[str] = None

    # Return ferry pricing (for accurate round trip total calculation)
    return_ferry_prices: Optional[Dict[str, float]] = None

    # Multi-cabin selection support (new)
    cabin_selections: Optional[List[CabinSelectionItem]] = None  # Outbound cabins with quantities
    return_cabin_selections: Optional[List[CabinSelectionItem]] = None  # Return cabins with quantities
    total_cabin_price: Optional[float] = 0  # Pre-calculated total for outbound cabins
    total_return_cabin_price: Optional[float] = 0  # Pre-calculated total for return cabins

    # Promo code
    promo_code: Optional[str] = None

    # Cancellation protection
    has_cancellation_protection: Optional[bool] = False

    @field_validator('passengers')
    @classmethod
    def validate_passengers(cls, v):
        if not v:
            raise ValueError('At least one passenger is required')
        if len(v) > 50:
            raise ValueError('Maximum 50 passengers allowed per booking')
        return v
    
    @field_validator('vehicles')
    @classmethod
    def validate_vehicles(cls, v):
        if v and len(v) > 10:
            raise ValueError('Maximum 10 vehicles allowed per booking')
        return v


class BookingPassengerResponse(BaseModel):
    """Booking passenger response schema."""
    id: int
    passenger_type: str
    first_name: str
    last_name: str
    date_of_birth: Optional[date] = None
    nationality: Optional[str] = None
    passport_number: Optional[str] = None
    base_price: float
    final_price: float
    special_needs: Optional[str] = None

    # Pet information
    has_pet: bool = False
    pet_type: Optional[str] = None
    pet_name: Optional[str] = None
    pet_weight_kg: Optional[float] = None
    pet_carrier_provided: bool = False

    model_config = ConfigDict(from_attributes=True)


class BookingVehicleResponse(BaseModel):
    """Booking vehicle response schema."""
    id: int
    vehicle_type: str
    make: Optional[str] = None
    model: Optional[str] = None
    owner: Optional[str] = None
    license_plate: str
    length_cm: int
    width_cm: int
    height_cm: int
    base_price: float
    final_price: float

    # Accessories
    has_trailer: bool = False
    has_caravan: bool = False
    has_roof_box: bool = False
    has_bike_rack: bool = False

    model_config = ConfigDict(from_attributes=True)


class BookingCabinResponse(BaseModel):
    """Booking cabin response schema for tracking multiple cabins."""
    id: int
    booking_id: int
    cabin_id: int
    journey_type: str  # 'OUTBOUND' or 'RETURN'
    quantity: int
    unit_price: float
    total_price: float
    is_paid: bool = False
    created_at: datetime

    # Cabin details (populated from relationship)
    cabin_name: Optional[str] = None
    cabin_type: Optional[str] = None
    cabin_capacity: Optional[int] = None
    cabin_amenities: Optional[List[str]] = None

    model_config = ConfigDict(from_attributes=True)


class BookingResponse(BaseModel):
    """Booking response schema."""
    id: int
    booking_reference: str
    operator_booking_reference: Optional[str] = None
    return_operator_booking_reference: Optional[str] = None
    status: str

    # Ferry details (outbound)
    sailing_id: str
    operator: str
    departure_port: Optional[str] = None
    arrival_port: Optional[str] = None
    departure_time: Optional[datetime] = None
    arrival_time: Optional[datetime] = None
    vessel_name: Optional[str] = None

    # Round trip information (can be different route/operator)
    is_round_trip: bool = False
    return_sailing_id: Optional[str] = None
    return_operator: Optional[str] = None
    return_departure_port: Optional[str] = None
    return_arrival_port: Optional[str] = None
    return_departure_time: Optional[datetime] = None
    return_arrival_time: Optional[datetime] = None
    return_vessel_name: Optional[str] = None

    # Contact information
    contact_email: str
    contact_phone: Optional[str] = None
    contact_first_name: str
    contact_last_name: str

    # Booking details
    total_passengers: int
    total_vehicles: int

    # Pricing
    subtotal: float
    discount_amount: float = 0.00
    tax_amount: float
    total_amount: float
    currency: str

    # Promo code
    promo_code: Optional[str] = None

    # Cabin information (original selection during booking)
    cabin_id: Optional[int] = None
    cabin_supplement: float
    cabin_name: Optional[str] = None
    cabin_type: Optional[str] = None
    return_cabin_id: Optional[int] = None
    return_cabin_supplement: float = 0.00
    return_cabin_name: Optional[str] = None
    return_cabin_type: Optional[str] = None

    # Special requirements
    special_requests: Optional[str] = None

    # Timestamps
    created_at: datetime
    updated_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    cancellation_reason: Optional[str] = None
    expires_at: Optional[datetime] = None  # When pending booking expires

    # Related data
    passengers: List[BookingPassengerResponse]
    vehicles: List[BookingVehicleResponse]
    meals: Optional[List[BookingMealResponse]] = []
    booking_cabins: Optional[List[BookingCabinResponse]] = []  # All cabin selections

    model_config = ConfigDict(from_attributes=True)


class BookingUpdate(BaseModel):
    """Booking update schema."""
    contact_phone: Optional[str] = None
    special_requests: Optional[str] = None
    cabin_selection: Optional[CabinSelection] = None


class BookingCancellation(BaseModel):
    """Booking cancellation schema."""
    reason: Optional[str] = None
    refund_requested: bool = True


class BookingConfirmation(BaseModel):
    """Booking confirmation schema."""
    booking_reference: str
    operator_reference: str
    status: str
    total_amount: float
    currency: str
    confirmation_details: Optional[Dict[str, Any]] = None
    
    # Booking instructions
    check_in_time: Optional[str] = None
    boarding_time: Optional[str] = None
    terminal_info: Optional[str] = None
    documents_required: Optional[List[str]] = None


class BookingSearchParams(BaseModel):
    """Booking search parameters."""
    user_id: Optional[int] = None
    status: Optional[BookingStatus] = None
    operator: Optional[str] = None
    departure_date_from: Optional[date] = None
    departure_date_to: Optional[date] = None
    booking_reference: Optional[str] = None
    contact_email: Optional[str] = None


class BookingListResponse(BaseModel):
    """Booking list response schema."""
    bookings: List[BookingResponse]
    total_count: int
    page: int
    page_size: int
    total_pages: int


class BookingStatistics(BaseModel):
    """Booking statistics schema."""
    total_bookings: int
    confirmed_bookings: int
    cancelled_bookings: int
    pending_bookings: int
    total_revenue: float
    average_booking_value: float
    top_routes: List[Dict[str, Any]]
    bookings_by_operator: Dict[str, int]


class BookingModification(BaseModel):
    """Booking modification schema."""
    new_sailing_id: Optional[str] = None
    passenger_changes: Optional[List[Dict[str, Any]]] = None
    vehicle_changes: Optional[List[Dict[str, Any]]] = None
    cabin_changes: Optional[CabinSelection] = None
    modification_reason: str
    
    @field_validator('modification_reason')
    @classmethod
    def validate_modification_reason(cls, v):
        if not v or len(v.strip()) < 5:
            raise ValueError('Modification reason must be at least 5 characters')
        return v


class BookingPaymentInfo(BaseModel):
    """Booking payment information schema."""
    booking_id: int
    total_amount: float
    paid_amount: float
    outstanding_amount: float
    currency: str
    payment_status: str
    payment_methods: List[str]
    last_payment_date: Optional[datetime] = None


class BookingDocument(BaseModel):
    """Booking document schema."""
    document_type: str  # ticket, invoice, boarding_pass
    document_url: str
    generated_at: datetime
    expires_at: Optional[datetime] = None


class BookingDocumentsResponse(BaseModel):
    """Booking documents response schema."""
    booking_reference: str
    documents: List[BookingDocument] 