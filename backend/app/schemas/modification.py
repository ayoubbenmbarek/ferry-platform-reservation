"""
Booking modification schemas.
"""

from pydantic import BaseModel, ConfigDict
from typing import Optional, Dict, Any, List
from datetime import datetime
from decimal import Decimal


# ========== Modification Requests ==========

class PassengerUpdate(BaseModel):
    """Schema for updating a passenger."""
    passenger_id: int
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    nationality: Optional[str] = None
    passport_number: Optional[str] = None


class VehicleUpdate(BaseModel):
    """Schema for updating a vehicle."""
    vehicle_id: int
    registration: Optional[str] = None
    make: Optional[str] = None
    model: Optional[str] = None


class QuickUpdateRequest(BaseModel):
    """Schema for quick updates (names and registration)."""
    passenger_updates: Optional[List[PassengerUpdate]] = []
    vehicle_updates: Optional[List[VehicleUpdate]] = []


class ModificationRequest(BaseModel):
    """Schema for requesting a full modification quote."""

    # Travel details
    new_departure_date: Optional[datetime] = None
    new_departure_port: Optional[str] = None
    new_arrival_port: Optional[str] = None
    new_sailing_id: Optional[str] = None

    # Return journey
    new_return_date: Optional[datetime] = None
    new_return_sailing_id: Optional[str] = None
    add_return: Optional[bool] = None
    remove_return: Optional[bool] = None

    # Passengers
    add_passengers: Optional[List[Dict[str, Any]]] = []
    remove_passengers: Optional[List[int]] = []  # passenger IDs
    update_passengers: Optional[List[PassengerUpdate]] = []

    # Vehicles
    add_vehicles: Optional[List[Dict[str, Any]]] = []
    remove_vehicles: Optional[List[int]] = []  # vehicle IDs
    update_vehicles: Optional[List[VehicleUpdate]] = []

    # Cabins
    new_cabin_id: Optional[int] = None
    new_return_cabin_id: Optional[int] = None
    remove_cabin: Optional[bool] = None
    remove_return_cabin: Optional[bool] = None

    # Meals
    add_meals: Optional[List[Dict[str, Any]]] = []
    remove_meals: Optional[List[int]] = []  # meal IDs


# ========== Modification Responses ==========

class ModificationEligibilityResponse(BaseModel):
    """Response for modification eligibility check."""
    can_modify: bool
    modification_type_allowed: str  # "none", "quick", "full"
    restrictions: List[str] = []
    message: str


class PriceBreakdown(BaseModel):
    """Detailed price breakdown."""
    passengers: Optional[Decimal] = Decimal("0.00")
    vehicles: Optional[Decimal] = Decimal("0.00")
    cabins: Optional[Decimal] = Decimal("0.00")
    meals: Optional[Decimal] = Decimal("0.00")


class ModificationQuoteResponse(BaseModel):
    """Response for modification quote."""
    quote_id: int
    expires_at: datetime

    # Pricing
    original_total: Decimal
    new_subtotal: Decimal
    modification_fee: Decimal
    price_difference: Decimal
    total_to_pay: Decimal
    currency: str = "EUR"

    # Breakdown
    breakdown: PriceBreakdown

    # Availability
    availability_confirmed: bool
    message: str

    model_config = ConfigDict(from_attributes=True)


class ModificationPaymentIntent(BaseModel):
    """Payment intent for modification."""
    id: str
    client_secret: str
    amount: int  # in cents
    currency: str


class ConfirmModificationResponse(BaseModel):
    """Response after confirming modification."""
    success: bool
    modification_id: Optional[int] = None
    booking_reference: str
    payment_required: bool
    payment_intent: Optional[ModificationPaymentIntent] = None
    message: str


class ModificationHistoryItem(BaseModel):
    """Single modification history item."""
    id: int
    created_at: datetime
    status: str
    changes: Dict[str, Any]
    total_charged: Decimal
    modified_by: str  # "customer" or "admin"

    model_config = ConfigDict(from_attributes=True)


class ModificationHistoryResponse(BaseModel):
    """Response for modification history."""
    modifications: List[ModificationHistoryItem]
    total_modifications: int
    remaining_modifications: int


# ========== Quick Update Response ==========

class QuickUpdateResponse(BaseModel):
    """Response for quick updates."""
    success: bool
    booking_reference: str
    message: str
    updated_at: datetime
