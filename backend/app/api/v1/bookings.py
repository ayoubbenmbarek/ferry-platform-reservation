"""
Booking API endpoints for creating, managing, and retrieving ferry bookings.
"""

import uuid
import os
import logging
from typing import List, Optional
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel

logger = logging.getLogger(__name__)


def make_aware(dt: datetime) -> datetime:
    """Ensure datetime is timezone-aware (UTC). Handles both naive and aware datetimes."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def utc_now() -> datetime:
    """Get current UTC time as timezone-aware datetime."""
    return datetime.now(timezone.utc)


try:
    from fastapi import APIRouter, Depends, HTTPException, status, Query
    from fastapi.responses import StreamingResponse
    from sqlalchemy.orm import Session, selectinload
    from sqlalchemy import and_, or_
except ImportError:
    # Fallback for development
    class APIRouter:
        def __init__(self, *args, **kwargs):
            pass
        def post(self, *args, **kwargs):
            def decorator(func):
                return func
            return decorator
        def get(self, *args, **kwargs):
            def decorator(func):
                return func
            return decorator
        def put(self, *args, **kwargs):
            def decorator(func):
                return func
            return decorator
        def delete(self, *args, **kwargs):
            def decorator(func):
                return func
            return decorator
    
    class Depends:
        def __init__(self, dependency):
            pass
    
    class HTTPException(Exception):
        pass
    
    class status:
        HTTP_400_BAD_REQUEST = 400
        HTTP_404_NOT_FOUND = 404
        HTTP_403_FORBIDDEN = 403
    
    def Query(*args, **kwargs):
        return None
    
    class Session:
        pass
    
    def and_(*args):
        return None
    
    def or_(*args):
        return None

try:
    from app.api.deps import (
        get_db, get_current_active_user, get_optional_current_user,
        get_common_params, validate_booking_access
    )
    from app.models.user import User
    from app.models.booking import Booking, BookingPassenger, BookingVehicle, BookingStatusEnum, PassengerTypeEnum, VehicleTypeEnum, BookingCabin, JourneyTypeEnum
    from app.models.ferry import Schedule
    from app.schemas.booking import (
        BookingCreate, BookingResponse, BookingUpdate, BookingCancellation,
        BookingListResponse, BookingSearchParams, BookingStatistics,
        BookingModification, BookingConfirmation
    )
    from app.services.ferry_service import FerryService
    from app.services.ferry_integrations.base import FerryAPIError
    from app.services.ferry_integrations.ferryhopper_mappings import map_ferryhopper_cabin_type
    from app.services.invoice_service import invoice_service
    from app.models.meal import BookingMeal
    from app.models.payment import Payment, PaymentStatusEnum
except ImportError:
    # Fallback for development
    def get_db():
        pass
    def get_current_active_user():
        pass
    def get_optional_current_user():
        pass
    def get_common_params():
        pass
    def validate_booking_access(*args):
        return True
    
    class User:
        pass
    class Booking:
        pass
    class BookingPassenger:
        pass
    class BookingVehicle:
        pass
    class Schedule:
        pass
    class BookingCreate:
        pass
    class BookingResponse:
        pass
    class BookingUpdate:
        pass
    class BookingCancellation:
        pass
    class BookingListResponse:
        pass
    class BookingSearchParams:
        pass
    class BookingStatistics:
        pass
    class BookingModification:
        pass
    class BookingConfirmation:
        pass
    class FerryService:
        pass
    class FerryAPIError(Exception):
        pass

router = APIRouter()

# Initialize ferry service
ferry_service = FerryService()


def generate_booking_reference() -> str:
    """Generate a unique booking reference."""
    return f"MR{uuid.uuid4().hex[:8].upper()}"


def _get_booking_cabins(db_booking: Booking) -> list:
    """
    Get booking cabins from extra_data (FerryHopper API cabins).

    extra_data keys:
    - cabin_selections: Initial cabin selections during booking (outbound)
    - return_cabin_selections: Initial cabin selections during booking (return)
    - cabin_upgrades: Cabin upgrades added after booking (outbound)
    - return_cabin_upgrades: Cabin upgrades added after booking (return)
    """
    cabins = []

    if not db_booking.extra_data:
        return cabins

    # Initial cabin selections (from booking creation) - outbound
    for selection in db_booking.extra_data.get("cabin_selections", []) or []:
        if selection:
            cabin_code = str(selection.get("cabin_id", "") or selection.get("code", ""))
            cabin_type = selection.get("cabin_type") or _infer_cabin_type_from_code(cabin_code)
            cabins.append({
                "id": None,
                "booking_id": db_booking.id,
                "cabin_id": None,
                "cabin_code": cabin_code,
                "journey_type": "outbound",
                "quantity": selection.get("quantity", 1),
                "unit_price": selection.get("price", 0) / max(selection.get("quantity", 1), 1),
                "total_price": selection.get("price", 0),
                "is_paid": True,
                "created_at": db_booking.created_at,
                "cabin_name": selection.get("name") or _infer_cabin_name_from_code(cabin_code),
                "cabin_type": cabin_type,
                "cabin_capacity": selection.get("capacity", 3 if cabin_type == "suite" else 2),
                "cabin_amenities": selection.get("amenities") or _get_amenities_for_cabin_type(cabin_type),
                "source": "ferryhopper"
            })

    # Initial cabin selections (from booking creation) - return
    for selection in db_booking.extra_data.get("return_cabin_selections", []) or []:
        if selection:
            cabin_code = str(selection.get("cabin_id", "") or selection.get("code", ""))
            cabin_type = selection.get("cabin_type") or _infer_cabin_type_from_code(cabin_code)
            cabins.append({
                "id": None,
                "booking_id": db_booking.id,
                "cabin_id": None,
                "cabin_code": cabin_code,
                "journey_type": "return",
                "quantity": selection.get("quantity", 1),
                "unit_price": selection.get("price", 0) / max(selection.get("quantity", 1), 1),
                "total_price": selection.get("price", 0),
                "is_paid": True,
                "created_at": db_booking.created_at,
                "cabin_name": selection.get("name") or _infer_cabin_name_from_code(cabin_code),
                "cabin_type": cabin_type,
                "cabin_capacity": selection.get("capacity", 3 if cabin_type == "suite" else 2),
                "cabin_amenities": selection.get("amenities") or _get_amenities_for_cabin_type(cabin_type),
                "source": "ferryhopper"
            })

    # Cabin upgrades (added after booking) - outbound
    for upgrade in db_booking.extra_data.get("cabin_upgrades", []) or []:
        if upgrade:
            cabin_type = upgrade.get("cabin_type") or _infer_cabin_type_from_code(upgrade.get("code", ""))
            cabins.append({
                "id": None,
                "booking_id": db_booking.id,
                "cabin_id": None,
                "cabin_code": upgrade.get("code"),
                "journey_type": upgrade.get("journey_type", "outbound"),
                "quantity": upgrade.get("quantity", 1),
                "unit_price": upgrade.get("unit_price", 0),
                "total_price": upgrade.get("total_price", 0),
                "is_paid": True,
                "created_at": upgrade.get("added_at"),
                "cabin_name": upgrade.get("name"),
                "cabin_type": cabin_type,
                "cabin_capacity": upgrade.get("capacity", 3 if cabin_type == "suite" else 2),
                "cabin_amenities": upgrade.get("amenities") or _get_amenities_for_cabin_type(cabin_type),
                "source": "ferryhopper"
            })

    # Cabin upgrades (added after booking) - return
    for upgrade in db_booking.extra_data.get("return_cabin_upgrades", []) or []:
        if upgrade:
            cabin_type = upgrade.get("cabin_type") or _infer_cabin_type_from_code(upgrade.get("code", ""))
            cabins.append({
                "id": None,
                "booking_id": db_booking.id,
                "cabin_id": None,
                "cabin_code": upgrade.get("code"),
                "journey_type": upgrade.get("journey_type", "return"),
                "quantity": upgrade.get("quantity", 1),
                "unit_price": upgrade.get("unit_price", 0),
                "total_price": upgrade.get("total_price", 0),
                "is_paid": True,
                "created_at": upgrade.get("added_at"),
                "cabin_name": upgrade.get("name"),
                "cabin_type": cabin_type,
                "cabin_capacity": upgrade.get("capacity", 3 if cabin_type == "suite" else 2),
                "cabin_amenities": upgrade.get("amenities") or _get_amenities_for_cabin_type(cabin_type),
                "source": "ferryhopper"
            })

    return cabins


def _infer_cabin_name_from_code(code: str) -> str:
    """Generate a human-readable cabin name from FerryHopper accommodation code."""
    if not code:
        return "Cabin"
    # Replace underscores and dashes with spaces, title case
    name = code.replace("_", " ").replace("-", " ")
    # Handle common codes
    name = name.replace("CABIN", "Cabin")
    name = name.replace("INSIDE", "Inside")
    name = name.replace("OUTSIDE", "Outside")
    name = name.replace("SUITE", "Suite")
    name = name.replace("DECK", "Deck")
    return name.title() if name else "Cabin"


def _infer_cabin_type_from_code(code: str) -> str:
    """Infer cabin type from FerryHopper accommodation code."""
    code_lower = (code or "").lower()
    if "suite" in code_lower:
        return "suite"
    elif "balcony" in code_lower:
        return "balcony"
    elif "outside" in code_lower or "exterior" in code_lower or "window" in code_lower:
        return "exterior"
    elif "inside" in code_lower or "interior" in code_lower or "cabin" in code_lower:
        return "interior"
    elif "deck" in code_lower or "seat" in code_lower or "lounge" in code_lower:
        return "deck"
    else:
        return "interior"


def _get_amenities_for_cabin_type(cabin_type: str) -> list:
    """Get default amenities based on cabin type."""
    base_amenities = ["Private Bathroom", "Air Conditioning"]

    if cabin_type == "suite":
        return base_amenities + ["TV", "Minibar", "WiFi", "Room Service"]
    elif cabin_type == "balcony":
        return base_amenities + ["TV", "Minibar", "Balcony"]
    elif cabin_type == "exterior":
        return base_amenities + ["TV", "Window"]
    elif cabin_type == "interior":
        return base_amenities + ["TV", "WiFi"]
    elif cabin_type == "deck":
        return []  # Deck seats typically have no amenities
    else:
        return base_amenities + ["TV"]


def booking_to_response(db_booking: Booking) -> BookingResponse:
    """Convert a Booking model to BookingResponse, handling enum conversions."""
    return BookingResponse(
        id=db_booking.id,
        booking_reference=db_booking.booking_reference,
        operator_booking_reference=db_booking.operator_booking_reference,
        return_operator_booking_reference=db_booking.return_operator_booking_reference,
        status=db_booking.status.value if hasattr(db_booking.status, 'value') else db_booking.status,
        sailing_id=db_booking.sailing_id,
        operator=db_booking.operator,
        # Ferry schedule details (outbound)
        departure_port=db_booking.departure_port,
        arrival_port=db_booking.arrival_port,
        departure_time=db_booking.departure_time,
        arrival_time=db_booking.arrival_time,
        vessel_name=db_booking.vessel_name,
        # Round trip information (can be different route/operator)
        is_round_trip=db_booking.is_round_trip or False,
        return_sailing_id=db_booking.return_sailing_id,
        return_operator=db_booking.return_operator,
        return_departure_port=db_booking.return_departure_port,
        return_arrival_port=db_booking.return_arrival_port,
        return_departure_time=db_booking.return_departure_time,
        return_arrival_time=db_booking.return_arrival_time,
        return_vessel_name=db_booking.return_vessel_name,
        # Contact information
        contact_email=db_booking.contact_email,
        contact_phone=db_booking.contact_phone,
        contact_first_name=db_booking.contact_first_name,
        contact_last_name=db_booking.contact_last_name,
        total_passengers=db_booking.total_passengers,
        total_vehicles=db_booking.total_vehicles,
        subtotal=db_booking.subtotal,
        discount_amount=db_booking.discount_amount or 0.0,
        tax_amount=db_booking.tax_amount,
        total_amount=db_booking.total_amount,
        currency=db_booking.currency,
        promo_code=db_booking.promo_code,
        # Cabin information (original selection during booking)
        cabin_id=db_booking.cabin_id,
        cabin_supplement=db_booking.cabin_supplement or 0.0,
        cabin_name=db_booking.cabin.name if db_booking.cabin else None,
        cabin_type=db_booking.cabin.cabin_type.value if db_booking.cabin and hasattr(db_booking.cabin.cabin_type, 'value') else (str(db_booking.cabin.cabin_type) if db_booking.cabin else None),
        return_cabin_id=db_booking.return_cabin_id,
        return_cabin_supplement=db_booking.return_cabin_supplement or 0.0,
        return_cabin_name=db_booking.return_cabin.name if db_booking.return_cabin else None,
        return_cabin_type=db_booking.return_cabin.cabin_type.value if db_booking.return_cabin and hasattr(db_booking.return_cabin.cabin_type, 'value') else (str(db_booking.return_cabin.cabin_type) if db_booking.return_cabin else None),
        # Special requirements
        special_requests=db_booking.special_requests,
        # Timestamps
        created_at=db_booking.created_at,
        updated_at=db_booking.updated_at,
        expires_at=db_booking.expires_at,
        cancelled_at=db_booking.cancelled_at,
        cancellation_reason=db_booking.cancellation_reason,
        passengers=[
            {
                "id": p.id,
                "passenger_type": p.passenger_type.value if hasattr(p.passenger_type, 'value') else p.passenger_type,
                "first_name": p.first_name,
                "last_name": p.last_name,
                "date_of_birth": p.date_of_birth,
                "nationality": p.nationality,
                "passport_number": p.passport_number,
                "base_price": p.base_price,
                "final_price": p.final_price,
                "special_needs": p.special_needs,
                # Pet information
                "has_pet": p.has_pet or False,
                "pet_type": p.pet_type.value if hasattr(p.pet_type, 'value') and p.pet_type else None,
                "pet_name": p.pet_name,
                "pet_weight_kg": float(p.pet_weight_kg) if p.pet_weight_kg else None,
                "pet_carrier_provided": p.pet_carrier_provided or False
            }
            for p in db_booking.passengers
        ],
        vehicles=[
            {
                "id": v.id,
                "vehicle_type": v.vehicle_type.value if hasattr(v.vehicle_type, 'value') else v.vehicle_type,
                "make": v.make,
                "model": v.model,
                "owner": v.owner,
                "license_plate": v.license_plate,
                "length_cm": v.length_cm,
                "width_cm": v.width_cm,
                "height_cm": v.height_cm,
                "has_trailer": v.has_trailer or False,
                "has_caravan": v.has_caravan or False,
                "has_roof_box": v.has_roof_box or False,
                "has_bike_rack": v.has_bike_rack or False,
                "base_price": v.base_price,
                "final_price": v.final_price
            }
            for v in db_booking.vehicles
        ],
        meals=[
            {
                "id": m.id,
                "booking_id": m.booking_id,
                "meal_id": m.meal_id,
                "meal": {
                    "id": m.meal.id,
                    "name": m.meal.name,
                    "description": m.meal.description,
                    "meal_type": m.meal.meal_type.value if hasattr(m.meal.meal_type, 'value') else str(m.meal.meal_type),
                    "price": float(m.meal.price),
                    "currency": m.meal.currency,
                    "is_available": m.meal.is_available,
                    "dietary_types": m.meal.dietary_types,
                    "operator": m.meal.operator,
                    "created_at": m.meal.created_at
                } if m.meal else None,
                "quantity": m.quantity,
                "unit_price": float(m.unit_price),
                "total_price": float(m.total_price),
                "passenger_id": m.passenger_id,
                "meal_date": m.meal_date if hasattr(m, 'meal_date') else None,
                "dietary_type": m.dietary_type.value if m.dietary_type and hasattr(m.dietary_type, 'value') else (str(m.dietary_type) if m.dietary_type else None),
                "journey_type": m.journey_type.value if hasattr(m, 'journey_type') and m.journey_type and hasattr(m.journey_type, 'value') else (str(m.journey_type) if hasattr(m, 'journey_type') and m.journey_type else None),
                "special_requests": m.special_requests,
                "created_at": m.created_at
            }
            for m in db_booking.meals
        ] if hasattr(db_booking, 'meals') and db_booking.meals else [],
        booking_cabins=_get_booking_cabins(db_booking)
    )


@router.post("/", response_model=BookingResponse)
async def create_booking(
    booking_data: BookingCreate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """
    Create a new ferry booking.

    Creates a booking with the specified ferry operator and returns
    the booking confirmation details.
    """
    try:
        # Validate departure time is not in the past
        if booking_data.departure_time:
            now = utc_now()
            # Add 1 hour buffer before departure for check-in
            min_booking_time = now + timedelta(hours=1)
            # Ensure departure_time is timezone-aware for comparison
            departure = make_aware(booking_data.departure_time)

            if departure < now:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot book a ferry that has already departed"
                )
            elif departure < min_booking_time:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Bookings must be made at least 1 hour before departure"
                )

        # Validate return departure time if round trip
        if booking_data.is_round_trip and booking_data.return_departure_time:
            now = utc_now()
            min_booking_time = now + timedelta(hours=1)
            # Ensure return_departure_time is timezone-aware for comparison
            return_departure = make_aware(booking_data.return_departure_time)

            if return_departure < now:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot book a return ferry that has already departed"
                )
            elif return_departure < min_booking_time:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Return bookings must be made at least 1 hour before departure"
                )

        # Check for existing PENDING booking with same route/time/contact to prevent duplicates
        # This handles the case where user refreshes page and Redux state is lost
        contact_email = booking_data.contact_info.email.lower() if booking_data.contact_info else None
        if contact_email and booking_data.departure_time:
            existing_pending = db.query(Booking).filter(
                Booking.contact_email == contact_email,
                Booking.departure_port == booking_data.departure_port,
                Booking.arrival_port == booking_data.arrival_port,
                Booking.departure_time == booking_data.departure_time,
                Booking.status == BookingStatusEnum.PENDING.value,
                Booking.expires_at > utc_now()  # Not expired
            ).first()

            if existing_pending:
                logger.info(f"Found existing pending booking {existing_pending.booking_reference} for same route/time/contact, returning it instead of creating duplicate")
                # Return the existing pending booking instead of creating a duplicate
                return booking_to_response(existing_pending)

        # Generate unique booking reference
        booking_reference = generate_booking_reference()
        
        # Calculate pricing
        total_passengers = len(booking_data.passengers)
        total_vehicles = len(booking_data.vehicles) if booking_data.vehicles else 0

        # Get prices from booking request or use defaults
        # Prices should be provided by frontend from the selected ferry
        if booking_data.ferry_prices:
            base_adult_price = booking_data.ferry_prices.get("adult", 85.0)
            base_child_price = booking_data.ferry_prices.get("child", 42.5)
            base_infant_price = booking_data.ferry_prices.get("infant", 0.0)
            base_vehicle_price = booking_data.ferry_prices.get("vehicle", 120.0)
        else:
            # Fallback to default prices if not provided
            logger.warning("Ferry prices not provided in booking request, using defaults")
            base_adult_price = 85.0
            base_child_price = 42.5
            base_infant_price = 0.0
            base_vehicle_price = 120.0

        # Calculate outbound journey costs
        subtotal = 0.0
        for passenger in booking_data.passengers:
            if passenger.type == "adult":
                subtotal += base_adult_price
            elif passenger.type == "child":
                subtotal += base_child_price
            # infants are free

        if booking_data.vehicles:
            subtotal += base_vehicle_price * len(booking_data.vehicles)

        # Add return journey costs if round trip
        is_round_trip = getattr(booking_data, 'is_round_trip', False)
        if is_round_trip and hasattr(booking_data, 'return_ferry_prices') and booking_data.return_ferry_prices:
            return_adult_price = booking_data.return_ferry_prices.get("adult", 0.0)
            return_child_price = booking_data.return_ferry_prices.get("child", 0.0)
            return_vehicle_price = booking_data.return_ferry_prices.get("vehicle", 0.0)

            # Add return passenger prices
            for passenger in booking_data.passengers:
                if passenger.type == "adult":
                    subtotal += return_adult_price
                elif passenger.type == "child":
                    subtotal += return_child_price
                # infants are free

            # Add return vehicle prices
            if booking_data.vehicles:
                subtotal += return_vehicle_price * len(booking_data.vehicles)
        
        # Add cabin supplement if selected (outbound)
        # Priority: multi-cabin selections with pre-calculated prices > legacy single cabin
        # NOTE: cabin_id is no longer used as FK - we store cabin details in extra_data instead
        cabin_supplement = 0.0
        cabin_selections_data = []  # Store for extra_data

        if hasattr(booking_data, 'total_cabin_price') and booking_data.total_cabin_price and booking_data.total_cabin_price > 0:
            # Use pre-calculated multi-cabin total from frontend
            cabin_supplement = float(booking_data.total_cabin_price)
            subtotal += cabin_supplement
            # Store cabin selections for extra_data (FerryHopper cabin codes, not DB IDs)
            if hasattr(booking_data, 'cabin_selections') and booking_data.cabin_selections:
                cabin_selections_data = [
                    {"cabin_id": s.cabin_id, "quantity": s.quantity, "price": s.price}
                    for s in booking_data.cabin_selections
                ]
            logger.info(f"Using multi-cabin total price: €{cabin_supplement}")
        # Note: Legacy cabin_id lookup removed - all cabins now use FerryHopper API via cabin_selections

        # Add return cabin supplement if selected
        # Priority: multi-cabin selections with pre-calculated prices > legacy single cabin
        # NOTE: return_cabin_id is no longer used as FK - we store cabin details in extra_data instead
        return_cabin_supplement = 0.0
        return_cabin_selections_data = []  # Store for extra_data

        if hasattr(booking_data, 'total_return_cabin_price') and booking_data.total_return_cabin_price and booking_data.total_return_cabin_price > 0:
            # Use pre-calculated multi-cabin total from frontend
            return_cabin_supplement = float(booking_data.total_return_cabin_price)
            subtotal += return_cabin_supplement
            # Store return cabin selections for extra_data
            if hasattr(booking_data, 'return_cabin_selections') and booking_data.return_cabin_selections:
                return_cabin_selections_data = [
                    {"cabin_id": s.cabin_id, "quantity": s.quantity, "price": s.price}
                    for s in booking_data.return_cabin_selections
                ]
            logger.info(f"Using multi-cabin return total price: €{return_cabin_supplement}")
        # Note: Legacy return_cabin_id lookup removed - all cabins now use FerryHopper API via return_cabin_selections

        # Add meal costs if selected
        meals_total = 0.0
        if booking_data.meals:
            from app.models.meal import Meal
            for meal_selection in booking_data.meals:
                meal = db.query(Meal).filter(Meal.id == meal_selection.meal_id).first()
                if meal:
                    meals_total += float(meal.price) * meal_selection.quantity
            subtotal += meals_total

        # Apply promo code if provided
        discount_amount = 0.0
        promo_code_str = None
        if hasattr(booking_data, 'promo_code') and booking_data.promo_code:
            from app.services.promo_code_service import PromoCodeService, PromoCodeError
            from app.schemas.promo_code import PromoCodeValidateRequest

            promo_service = PromoCodeService(db)
            validate_request = PromoCodeValidateRequest(
                code=booking_data.promo_code.strip().upper(),
                booking_amount=subtotal,
                operator=booking_data.operator,
                email=booking_data.contact_info.email.lower(),
                user_id=current_user.id if current_user else None
            )

            validation = promo_service.validate_promo_code(validate_request)
            if validation.is_valid:
                discount_amount = validation.discount_amount
                promo_code_str = booking_data.promo_code.strip().upper()
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Promo code error: {validation.message}"
                )

        # Add cancellation protection if selected (€15)
        CANCELLATION_PROTECTION_PRICE = 15.00
        cancellation_protection_amount = CANCELLATION_PROTECTION_PRICE if getattr(booking_data, 'has_cancellation_protection', False) else 0.0
        subtotal += cancellation_protection_amount

        # Calculate tax on discounted subtotal (10% for example)
        discounted_subtotal = subtotal - discount_amount
        tax_amount = discounted_subtotal * 0.10
        total_amount = discounted_subtotal + tax_amount

        # Calculate expiration time (30 minutes from now for pending bookings)
        expires_at = utc_now() + timedelta(minutes=30)

        # Create booking record
        db_booking = Booking(
            user_id=current_user.id if current_user else None,
            booking_reference=booking_reference,
            contact_email=booking_data.contact_info.email,
            contact_phone=booking_data.contact_info.phone,
            contact_first_name=booking_data.contact_info.first_name,
            contact_last_name=booking_data.contact_info.last_name,
            sailing_id=booking_data.sailing_id,
            operator=booking_data.operator,
            # Ferry schedule details (outbound)
            departure_port=booking_data.departure_port,
            arrival_port=booking_data.arrival_port,
            departure_time=booking_data.departure_time,
            arrival_time=booking_data.arrival_time,
            vessel_name=booking_data.vessel_name,
            # Round trip information (can be different route/operator)
            is_round_trip=getattr(booking_data, 'is_round_trip', False),
            return_sailing_id=getattr(booking_data, 'return_sailing_id', None),
            return_operator=getattr(booking_data, 'return_operator', None),
            return_departure_port=getattr(booking_data, 'return_departure_port', None),
            return_arrival_port=getattr(booking_data, 'return_arrival_port', None),
            return_departure_time=getattr(booking_data, 'return_departure_time', None),
            return_arrival_time=getattr(booking_data, 'return_arrival_time', None),
            return_vessel_name=getattr(booking_data, 'return_vessel_name', None),
            total_passengers=total_passengers,
            total_vehicles=total_vehicles,
            subtotal=subtotal,
            discount_amount=discount_amount,
            tax_amount=tax_amount,
            total_amount=total_amount,
            currency="EUR",
            promo_code=promo_code_str,
            cabin_id=None,  # No longer using FK - cabin details stored in extra_data
            cabin_supplement=cabin_supplement,
            return_cabin_id=None,  # No longer using FK - cabin details stored in extra_data
            return_cabin_supplement=return_cabin_supplement,
            special_requests=booking_data.special_requests,
            status=BookingStatusEnum.PENDING,
            expires_at=expires_at,  # Expires 30 minutes from creation
            extra_data={
                "has_cancellation_protection": getattr(booking_data, 'has_cancellation_protection', False),
                "cabin_selections": cabin_selections_data if cabin_selections_data else None,
                "return_cabin_selections": return_cabin_selections_data if return_cabin_selections_data else None,
            }
        )
        
        db.add(db_booking)
        db.flush()  # Get the booking ID
        
        # Add passengers
        for passenger_data in booking_data.passengers:
            # Convert passenger type from API enum to database enum
            passenger_type_map = {
                "adult": PassengerTypeEnum.ADULT,
                "child": PassengerTypeEnum.CHILD,
                "infant": PassengerTypeEnum.INFANT
            }
            db_passenger_type = passenger_type_map.get(passenger_data.type, PassengerTypeEnum.ADULT)

            # Import PetTypeEnum for pet type conversion
            from app.models.booking import PetTypeEnum

            # Convert pet type if provided
            pet_type_db = None
            if hasattr(passenger_data, 'pet_type') and passenger_data.pet_type:
                pet_type_map = {
                    "CAT": PetTypeEnum.CAT,
                    "SMALL_ANIMAL": PetTypeEnum.SMALL_ANIMAL,
                    "DOG": PetTypeEnum.DOG
                }
                pet_type_db = pet_type_map.get(passenger_data.pet_type, None)

            # Calculate passenger price (include return journey if round trip)
            if passenger_data.type == "adult":
                passenger_base_price = base_adult_price
                passenger_final_price = base_adult_price
                if is_round_trip and hasattr(booking_data, 'return_ferry_prices') and booking_data.return_ferry_prices:
                    passenger_final_price += booking_data.return_ferry_prices.get("adult", 0.0)
            elif passenger_data.type == "child":
                passenger_base_price = base_child_price
                passenger_final_price = base_child_price
                if is_round_trip and hasattr(booking_data, 'return_ferry_prices') and booking_data.return_ferry_prices:
                    passenger_final_price += booking_data.return_ferry_prices.get("child", 0.0)
            else:
                passenger_base_price = 0.0
                passenger_final_price = 0.0

            db_passenger = BookingPassenger(
                booking_id=db_booking.id,
                passenger_type=db_passenger_type,
                first_name=passenger_data.first_name,
                last_name=passenger_data.last_name,
                date_of_birth=passenger_data.date_of_birth,
                nationality=passenger_data.nationality,
                passport_number=passenger_data.passport_number,
                base_price=passenger_base_price,
                final_price=passenger_final_price,
                special_needs=passenger_data.special_needs,
                # Pet information
                has_pet=getattr(passenger_data, 'has_pet', False) or False,
                pet_type=pet_type_db,
                pet_name=getattr(passenger_data, 'pet_name', None),
                pet_weight_kg=getattr(passenger_data, 'pet_weight_kg', None),
                pet_carrier_provided=getattr(passenger_data, 'pet_carrier_provided', False) or False
            )
            db.add(db_passenger)
        
        # Add vehicles if any
        if booking_data.vehicles:
            for vehicle_data in booking_data.vehicles:
                # Convert vehicle type from API enum to database enum
                vehicle_type_map = {
                    "car": VehicleTypeEnum.CAR,
                    "suv": VehicleTypeEnum.SUV,
                    "van": VehicleTypeEnum.VAN,
                    "motorcycle": VehicleTypeEnum.MOTORCYCLE,
                    "camper": VehicleTypeEnum.CAMPER,
                    "caravan": VehicleTypeEnum.CARAVAN,
                    "truck": VehicleTypeEnum.TRUCK
                }
                db_vehicle_type = vehicle_type_map.get(vehicle_data.type, VehicleTypeEnum.CAR)

                # Calculate vehicle price (include return journey if round trip)
                vehicle_final_price = base_vehicle_price
                if is_round_trip and hasattr(booking_data, 'return_ferry_prices') and booking_data.return_ferry_prices:
                    vehicle_final_price += booking_data.return_ferry_prices.get("vehicle", 0.0)

                db_vehicle = BookingVehicle(
                    booking_id=db_booking.id,
                    vehicle_type=db_vehicle_type,
                    make=vehicle_data.make,
                    model=vehicle_data.model,
                    owner=getattr(vehicle_data, 'owner', None),
                    license_plate=vehicle_data.registration or "TEMP",
                    length_cm=int(vehicle_data.length * 100),
                    width_cm=int(vehicle_data.width * 100),
                    height_cm=int(vehicle_data.height * 100),
                    has_trailer=getattr(vehicle_data, 'has_trailer', False),
                    has_caravan=getattr(vehicle_data, 'has_caravan', False),
                    has_roof_box=getattr(vehicle_data, 'has_roof_box', False),
                    has_bike_rack=getattr(vehicle_data, 'has_bike_rack', False),
                    base_price=base_vehicle_price,
                    final_price=vehicle_final_price
                )
                db.add(db_vehicle)

        # Cabin selections are stored in extra_data (FerryHopper API cabins)
        # No need to create BookingCabin records - all cabin data is in extra_data
        if hasattr(booking_data, 'cabin_selections') and booking_data.cabin_selections:
            logger.info(f"Cabin selections stored in extra_data: {len(booking_data.cabin_selections)} cabins")

        if hasattr(booking_data, 'return_cabin_selections') and booking_data.return_cabin_selections:
            logger.info(f"Return cabin selections stored in extra_data: {len(booking_data.return_cabin_selections)} cabins")

        # Add meals if any
        if booking_data.meals:
            from app.models.meal import Meal, BookingMeal, DietaryTypeEnum, JourneyTypeEnum
            for meal_selection in booking_data.meals:
                meal = db.query(Meal).filter(Meal.id == meal_selection.meal_id).first()
                if meal:
                    # Convert dietary type string to enum if provided
                    dietary_type_enum = None
                    if meal_selection.dietary_type:
                        try:
                            dietary_type_enum = DietaryTypeEnum[meal_selection.dietary_type.upper()]
                        except KeyError:
                            pass

                    # Convert journey type string to enum if provided
                    journey_type_enum = None
                    if hasattr(meal_selection, 'journey_type') and meal_selection.journey_type:
                        try:
                            journey_type_str = meal_selection.journey_type.upper() if isinstance(meal_selection.journey_type, str) else str(meal_selection.journey_type).split('.')[-1].upper()
                            journey_type_enum = JourneyTypeEnum[journey_type_str]
                        except (KeyError, AttributeError):
                            journey_type_enum = JourneyTypeEnum.OUTBOUND  # Default to outbound

                    db_booking_meal = BookingMeal(
                        booking_id=db_booking.id,
                        meal_id=meal.id,
                        passenger_id=meal_selection.passenger_id,
                        quantity=meal_selection.quantity,
                        unit_price=float(meal.price),
                        total_price=float(meal.price) * meal_selection.quantity,
                        dietary_type=dietary_type_enum,
                        special_requests=meal_selection.special_requests,
                        journey_type=journey_type_enum
                    )
                    db.add(db_booking_meal)

        db.commit()
        db.refresh(db_booking)

        # Note: Promo code usage is recorded after payment confirmation, not here
        # This prevents usage count from being consumed for unpaid bookings
        if promo_code_str:
            logger.info(f"Promo code {promo_code_str} applied to booking {db_booking.id} - usage will be recorded after payment")

        # Create booking with ferry operator
        try:
            # Prepare cabin data for operator from cabin_selections (FerryHopper API)
            cabin_data = None
            if hasattr(booking_data, 'cabin_selections') and booking_data.cabin_selections:
                # Use first cabin selection for operator booking
                first_cabin = booking_data.cabin_selections[0]
                cabin_data = {
                    "code": str(first_cabin.cabin_id),  # FerryHopper accommodation code
                    "quantity": first_cabin.quantity,
                    "price": first_cabin.price
                }

            operator_confirmation = await ferry_service.create_booking(
                operator=booking_data.operator,
                sailing_id=booking_data.sailing_id,
                passengers=[p.dict() for p in booking_data.passengers],
                vehicles=[v.dict() for v in booking_data.vehicles] if booking_data.vehicles else None,
                cabin_selection=cabin_data,
                contact_info=booking_data.contact_info.dict(),
                special_requests=booking_data.special_requests
            )

            # Update booking with operator reference
            db_booking.operator_booking_reference = operator_confirmation.operator_reference

            # Create booking with return operator if different return ferry selected
            if db_booking.return_sailing_id and db_booking.return_operator:
                try:
                    # Prepare return cabin data from return_cabin_selections (FerryHopper API)
                    return_cabin_data = None
                    if hasattr(booking_data, 'return_cabin_selections') and booking_data.return_cabin_selections:
                        first_return_cabin = booking_data.return_cabin_selections[0]
                        return_cabin_data = {
                            "code": str(first_return_cabin.cabin_id),
                            "quantity": first_return_cabin.quantity,
                            "price": first_return_cabin.price
                        }

                    return_confirmation = await ferry_service.create_booking(
                        operator=db_booking.return_operator,
                        sailing_id=db_booking.return_sailing_id,
                        passengers=[p.dict() for p in booking_data.passengers],
                        vehicles=[v.dict() for v in booking_data.vehicles] if booking_data.vehicles else None,
                        cabin_selection=return_cabin_data,
                        contact_info=booking_data.contact_info.dict(),
                        special_requests=booking_data.special_requests
                    )
                    db_booking.return_operator_booking_reference = return_confirmation.operator_reference
                except FerryAPIError as return_error:
                    # If return operator booking fails, log but continue
                    logger.warning(f"Failed to create return operator booking: {str(return_error)}")

            # Note: Status remains PENDING until payment is completed
            db.commit()

        except FerryAPIError as e:
            # If operator booking fails, do NOT send confirmation email
            # Keep status as PENDING for potential manual retry, but inform user of failure
            error_msg = str(e)
            logger.error(f"Operator booking failed: {error_msg}")
            db.commit()

            # Raise an error to inform the user the booking failed
            # This prevents the confirmation email from being sent
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Booking failed with ferry operator: {error_msg}"
            )

        # Convert to response model manually to handle enum conversions
        db.refresh(db_booking)

        # Publish instant availability update via WebSocket
        try:
            from app.tasks.availability_sync_tasks import publish_availability_now
            route = f"{db_booking.departure_port}-{db_booking.arrival_port}"

            # Calculate total cabins booked (from cabin_selections or single cabin)
            total_cabins_booked = 0
            if hasattr(booking_data, 'cabin_selections') and booking_data.cabin_selections:
                total_cabins_booked = sum(cs.quantity for cs in booking_data.cabin_selections)
            elif booking_data.cabin_id:
                total_cabins_booked = 1

            publish_availability_now(
                route=route,
                ferry_id=db_booking.sailing_id or f"{db_booking.operator}-{db_booking.booking_reference}",
                departure_time=db_booking.departure_time.isoformat() if db_booking.departure_time else "",
                availability={
                    "change_type": "booking_created",
                    "passengers_booked": db_booking.total_passengers,
                    "vehicles_booked": db_booking.total_vehicles,
                    "cabin_quantity": total_cabins_booked,
                    "booking_reference": db_booking.booking_reference
                }
            )
            logger.info(f"📢 Instant availability update published for booking on {route}")
        except Exception as e:
            logger.warning(f"Failed to publish availability update: {str(e)}")

        # Send booking confirmation email
        try:
            booking_dict = {
                "id": db_booking.id,
                "booking_reference": db_booking.booking_reference,
                "operator": db_booking.operator,
                "vessel_name": db_booking.vessel_name,
                "departure_port": db_booking.departure_port,
                "arrival_port": db_booking.arrival_port,
                "departure_time": db_booking.departure_time,
                "arrival_time": db_booking.arrival_time,
                # Return journey details
                "is_round_trip": db_booking.is_round_trip,
                "return_sailing_id": db_booking.return_sailing_id,
                "return_operator": db_booking.return_operator,
                "return_departure_port": db_booking.return_departure_port,
                "return_arrival_port": db_booking.return_arrival_port,
                "return_departure_time": db_booking.return_departure_time,
                "return_arrival_time": db_booking.return_arrival_time,
                "return_vessel_name": db_booking.return_vessel_name,
                # Contact and totals
                "contact_first_name": db_booking.contact_first_name,
                "contact_last_name": db_booking.contact_last_name,
                "contact_email": db_booking.contact_email,
                "total_passengers": db_booking.total_passengers,
                "total_vehicles": db_booking.total_vehicles,
                "subtotal": db_booking.subtotal,
                "tax_amount": db_booking.tax_amount,
                "total_amount": db_booking.total_amount,
                "payment_status": "PENDING",
                "status": db_booking.status.value,
                "operator_booking_reference": db_booking.operator_booking_reference,
            }
            booking_dict["base_url"] = os.getenv("BASE_URL", "http://localhost:3001")

            # Send booking confirmation email asynchronously using Celery
            try:
                from app.tasks.email_tasks import send_booking_confirmation_email_task
                send_booking_confirmation_email_task.delay(
                    booking_data=booking_dict,
                    to_email=db_booking.contact_email
                )
                logger.info(f"📧 Booking confirmation email task queued for {db_booking.contact_email}")
            except Exception as email_error:
                # Log email task error but don't fail the booking
                logger.error(f"Failed to queue booking confirmation email: {str(email_error)}")
        except Exception as e:
            # Log email error but don't fail the booking
            logger.error(f"Failed to prepare booking confirmation email: {str(e)}")

        # Publish real-time availability update via WebSocket
        try:
            from app.tasks.availability_sync_tasks import publish_availability_now
            route = f"{db_booking.departure_port}-{db_booking.arrival_port}"
            publish_availability_now(
                route=route,
                ferry_id=db_booking.sailing_id or f"{db_booking.operator}-{db_booking.booking_reference}",
                departure_time=db_booking.departure_time.isoformat() if db_booking.departure_time else "",
                availability={
                    "change_type": "booking_created",
                    "passengers_booked": db_booking.total_passengers,
                    "vehicles_booked": db_booking.total_vehicles,
                    "booking_reference": db_booking.booking_reference
                }
            )
            logger.info(f"📢 Real-time availability update published for {route}")
        except Exception as ws_error:
            # Log WebSocket error but don't fail the booking
            logger.warning(f"Failed to publish availability update: {str(ws_error)}")

        return booking_to_response(db_booking)
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        import traceback
        error_traceback = traceback.format_exc()
        error_message = str(e)

        logger.error(f"Booking creation error: {error_message}")
        logger.error(f"Traceback:\n{error_traceback}")

        # Provide user-friendly error messages based on error type
        user_friendly_message = "Unable to create booking. Please try again."

        # Check for common error patterns and provide helpful messages
        if "foreign key constraint" in error_message.lower():
            user_friendly_message = "Invalid sailing or cabin selection. Please go back and select a different option."
        elif "not null constraint" in error_message.lower() or "missing" in error_message.lower():
            user_friendly_message = "Missing required information. Please ensure all required fields are filled."
        elif "duplicate" in error_message.lower():
            user_friendly_message = "This booking already exists. Please check your bookings."
        elif "connection" in error_message.lower() or "timeout" in error_message.lower():
            user_friendly_message = "Connection error. Please check your internet connection and try again."
        elif "invalid" in error_message.lower():
            user_friendly_message = f"Invalid data provided. {error_message}"
        else:
            # Log the full error for debugging but show generic message to user
            user_friendly_message = f"Unable to create booking. {error_message if len(error_message) < 100 else 'Please try again or contact support.'}"

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=user_friendly_message
        )


@router.get("/", response_model=BookingListResponse)
async def list_bookings(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
    common_params = Depends(get_common_params),
    status_filter: Optional[str] = Query(None, description="Filter by booking status"),
    operator: Optional[str] = Query(None, description="Filter by operator"),
    departure_date_from: Optional[datetime] = Query(None, description="Filter by departure date from"),
    departure_date_to: Optional[datetime] = Query(None, description="Filter by departure date to")
):
    """
    List user's bookings.
    
    Returns a paginated list of bookings for the current user.
    Admin users can see all bookings.
    """
    try:
        # Use selectinload to eagerly load relationships and avoid N+1 queries
        query = db.query(Booking).options(
            selectinload(Booking.passengers),
            selectinload(Booking.vehicles),
            selectinload(Booking.meals),
            selectinload(Booking.booking_cabins).selectinload(BookingCabin.cabin),
            selectinload(Booking.cabin),
            selectinload(Booking.return_cabin),
        )

        # Guest users (not logged in) get empty list
        if not current_user:
            return BookingListResponse(
                bookings=[],
                total_count=0,
                page=1,
                page_size=common_params.page_size,
                total_pages=0
            )

        # Non-admin users can only see their own bookings
        if not current_user.is_admin:
            query = query.filter(Booking.user_id == current_user.id)
        
        # Apply filters
        if status_filter:
            # Convert string status to enum
            try:
                status_enum = BookingStatusEnum[status_filter.upper()]
                query = query.filter(Booking.status == status_enum)
            except KeyError:
                # Invalid status, ignore filter
                pass
        
        if operator:
            query = query.filter(Booking.operator == operator)
        
        if departure_date_from:
            query = query.filter(Booking.departure_time >= departure_date_from)
        
        if departure_date_to:
            query = query.filter(Booking.departure_time <= departure_date_to)
        
        # Get total count
        total_count = query.count()

        # Order by created_at descending (newest first)
        query = query.order_by(Booking.created_at.desc())

        # Apply pagination
        bookings = query.offset(common_params.offset).limit(common_params.page_size).all()
        
        # Calculate pagination info
        total_pages = (total_count + common_params.page_size - 1) // common_params.page_size
        
        return BookingListResponse(
            bookings=[booking_to_response(booking) for booking in bookings],
            total_count=total_count,
            page=common_params.page,
            page_size=common_params.page_size,
            total_pages=total_pages
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to list bookings: {str(e)}"
        )


@router.get("/lookup/{booking_reference}", response_model=BookingResponse)
async def lookup_booking(
    booking_reference: str,
    email: str = Query(..., description="Contact email for verification"),
    db: Session = Depends(get_db)
):
    """
    Guest booking lookup by booking reference and email.

    Allows guests to retrieve their booking details without authentication.
    Requires both booking reference and contact email for verification.
    """
    try:
        booking = db.query(Booking).filter(
            and_(
                Booking.booking_reference == booking_reference,
                Booking.contact_email == email.lower()
            )
        ).first()

        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found or email does not match"
            )

        return booking_to_response(booking)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to lookup booking: {str(e)}"
        )


@router.get("/{booking_id}", response_model=BookingResponse)
async def get_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """
    Get booking details.

    Returns detailed information about a specific booking.
    """
    try:
        # Use selectinload to eagerly load relationships and avoid N+1 queries
        booking = db.query(Booking).options(
            selectinload(Booking.passengers),
            selectinload(Booking.vehicles),
            selectinload(Booking.meals),
            selectinload(Booking.booking_cabins).selectinload(BookingCabin.cabin),
            selectinload(Booking.cabin),
            selectinload(Booking.return_cabin),
        ).filter(Booking.id == booking_id).first()
        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found"
            )

        # Check access permissions
        if not validate_booking_access(booking_id, current_user, db):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )

        return booking_to_response(booking)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to get booking: {str(e)}"
        )


@router.put("/{booking_id}", response_model=BookingResponse)
async def update_booking(
    booking_id: int,
    booking_update: BookingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Update booking details.
    
    Allows updating certain booking details like contact information
    and special requests.
    """
    try:
        booking = db.query(Booking).filter(Booking.id == booking_id).first()
        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found"
            )
        
        # Check access permissions
        if not validate_booking_access(booking_id, current_user, db):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        # Update allowed fields
        if booking_update.contact_phone is not None:
            booking.contact_phone = booking_update.contact_phone
        
        if booking_update.special_requests is not None:
            booking.special_requests = booking_update.special_requests
        
        # Handle cabin selection changes
        if booking_update.cabin_selection is not None:
            # This would require recalculating pricing
            # For now, just update the supplement
            booking.cabin_supplement = booking_update.cabin_selection.supplement_price or 0.0

        booking.updated_at = utc_now()

        # Reset expiration timer for pending bookings (give another 30 minutes)
        if booking.status == BookingStatusEnum.PENDING:
            booking.expires_at = utc_now() + timedelta(minutes=30)

        db.commit()
        db.refresh(booking)

        return booking_to_response(booking)
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to update booking: {str(e)}"
        )


@router.patch("/{booking_id}/quick-update")
async def quick_update_booking(
    booking_id: int,
    update_data: dict,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """
    Quick update of passenger and vehicle details.

    Allows updating passenger names and vehicle details without additional fees.
    """
    try:
        booking = db.query(Booking).filter(Booking.id == booking_id).first()
        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found"
            )

        # Check access permissions
        if not validate_booking_access(booking_id, current_user, db):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )

        # Update passengers
        passenger_updates = update_data.get('passenger_updates', [])
        for passenger_update in passenger_updates:
            passenger_id = passenger_update.get('passenger_id')
            if passenger_id:
                passenger = db.query(BookingPassenger).filter(
                    BookingPassenger.id == passenger_id,
                    BookingPassenger.booking_id == booking_id
                ).first()

                if passenger:
                    if 'first_name' in passenger_update:
                        passenger.first_name = passenger_update['first_name']
                    if 'last_name' in passenger_update:
                        passenger.last_name = passenger_update['last_name']

        # Update vehicles
        vehicle_updates = update_data.get('vehicle_updates', [])
        for vehicle_update in vehicle_updates:
            vehicle_id = vehicle_update.get('vehicle_id')
            if vehicle_id:
                vehicle = db.query(BookingVehicle).filter(
                    BookingVehicle.id == vehicle_id,
                    BookingVehicle.booking_id == booking_id
                ).first()

                if vehicle:
                    if 'registration' in vehicle_update:
                        vehicle.license_plate = vehicle_update['registration']
                    if 'make' in vehicle_update:
                        vehicle.make = vehicle_update['make']
                    if 'model' in vehicle_update:
                        vehicle.model = vehicle_update['model']
                    if 'owner' in vehicle_update:
                        vehicle.owner = vehicle_update['owner']
                    if 'length' in vehicle_update:
                        vehicle.length_cm = vehicle_update['length']
                    if 'width' in vehicle_update:
                        vehicle.width_cm = vehicle_update['width']
                    if 'height' in vehicle_update:
                        vehicle.height_cm = vehicle_update['height']
                    if 'hasTrailer' in vehicle_update:
                        vehicle.has_trailer = vehicle_update['hasTrailer']
                    if 'hasCaravan' in vehicle_update:
                        vehicle.has_caravan = vehicle_update['hasCaravan']
                    if 'hasRoofBox' in vehicle_update:
                        vehicle.has_roof_box = vehicle_update['hasRoofBox']
                    if 'hasBikeRack' in vehicle_update:
                        vehicle.has_bike_rack = vehicle_update['hasBikeRack']

        booking.updated_at = utc_now()

        # Reset expiration timer for pending bookings (give another 30 minutes)
        if booking.status == BookingStatusEnum.PENDING:
            booking.expires_at = utc_now() + timedelta(minutes=30)

        db.commit()

        return {"success": True, "message": "Booking updated successfully"}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to quick update booking {booking_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to update booking: {str(e)}"
        )


class AvailableCabinResponse(BaseModel):
    """Response schema for available cabins from FerryHopper."""
    code: str
    name: str
    cabin_type: str
    description: Optional[str] = None
    price: float
    max_occupancy: int = 2
    available: int = 0
    has_bathroom: bool = True
    has_tv: bool = False
    has_wifi: bool = False
    has_air_conditioning: bool = True
    is_accessible: bool = False


@router.get("/{booking_id}/available-cabins")
async def get_available_cabins(
    booking_id: int,
    journey_type: str = Query("outbound", description="Journey type: outbound or return"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """
    Get available cabins from FerryHopper for a booking.

    This fetches real-time cabin availability from the cached FerryHopper solution
    for the booking's sailing. If the cache has expired, it will search again.
    """
    try:
        from app.services.cache_service import cache_service
        from app.services.ferry_service import FerryService

        # Get the booking
        booking = db.query(Booking).filter(Booking.id == booking_id).first()
        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found"
            )

        # Determine which sailing_id to use
        sailing_id = booking.return_sailing_id if journey_type == "return" else booking.sailing_id

        if not sailing_id:
            logger.warning(f"No sailing_id for booking {booking_id}, journey_type={journey_type}")
            return {"cabins": [], "message": "No sailing information available"}

        # Try to get cached solution data
        solution_data = cache_service.get(f"fh_solution:{sailing_id}")

        cabins = []

        if solution_data:
            # Extract accommodations from cached solution
            segment = solution_data.get("segment", {})
            accommodations = solution_data.get("accommodations") or segment.get("accommodations", [])

            logger.info(f"Found {len(accommodations)} accommodations in cached solution for {sailing_id}")

            for idx, acc in enumerate(accommodations):
                acc_type = acc.get("type", "CABIN").upper()
                capacity = acc.get("capacity", 1)
                # Generate unique code including capacity to distinguish variants (1-bed, 2-bed, etc.)
                acc_code = acc.get("code") or ""
                if not acc_code:
                    acc_code = f"{acc_type}_{capacity}bed_{idx}"
                acc_name = acc.get("name") or acc.get("description", "")

                # Get price - Cabin prices are for the WHOLE CABIN (not per-person)
                # A cabin with capacity 1-4 has a fixed price regardless of occupancy
                expected_price = acc.get("expectedPrice", {})
                price_cents = expected_price.get("totalPriceInCents", 0)
                price = price_cents / 100  # Total cabin price

                # Skip free deck/lounge options for cabin upgrades
                if acc_type in ["DECK", "LOUNGE", "AIRPLANE_SEAT"] and price == 0:
                    continue

                # Map FerryHopper type to our cabin type using the proper mapping function
                cabin_type = map_ferryhopper_cabin_type(acc_type)
                logger.debug(f"Mapped cabin type: {acc_type} -> {cabin_type}")

                # Get availability
                available = acc.get("availability", 0)
                if available == 0:
                    available = acc.get("availableQuantity", 0)

                # Build description from amenities if available
                amenities = acc.get("amenities", [])
                description = acc.get("description", "")
                if amenities and not description:
                    description = ", ".join(amenities)

                # Check amenities for features
                amenities_lower = [a.lower() for a in amenities] if amenities else []
                # Private cabins (interior, exterior, balcony, suite, pet) have private bathrooms
                # Deck and shared cabins typically have shared/no private bathroom
                has_private_cabin = cabin_type in ("interior", "exterior", "balcony", "suite", "pet")
                has_bathroom = any("bathroom" in a or "shower" in a for a in amenities_lower) or has_private_cabin
                has_tv = any("tv" in a or "television" in a for a in amenities_lower)
                has_wifi = any("wifi" in a or "internet" in a for a in amenities_lower)
                is_accessible = any("accessible" in a or "disability" in a for a in amenities_lower)

                # Get max occupancy
                max_occupancy = acc.get("maxOccupancy", acc.get("capacity", 2))

                cabin = {
                    "code": acc_code,
                    "name": acc_name or f"{cabin_type.title()} Cabin",
                    "cabin_type": cabin_type,
                    "description": description,
                    "price": price,
                    "max_occupancy": max_occupancy,
                    "available": available if available > 0 else 1,  # Default to 1 if unknown
                    "has_bathroom": has_bathroom,
                    "has_tv": has_tv,
                    "has_wifi": has_wifi,
                    "has_air_conditioning": True,  # Most cabins have AC
                    "is_accessible": is_accessible,
                }
                cabins.append(cabin)

            # Sort by price (cheapest first)
            cabins.sort(key=lambda x: x["price"])

        else:
            # Solution expired - try to search again with timeout
            logger.info(f"Solution cache expired for {sailing_id}, searching again...")

            # Parse sailing_id to get route info
            # Format: FH_{hash}_{tripIdx}_{segIdx}_{vesselId}_{datetime}
            if sailing_id.startswith("FH_"):
                try:
                    import asyncio
                    ferry_service = FerryService()

                    # Use booking info to search
                    from datetime import date
                    departure_date = booking.return_departure_time.date() if journey_type == "return" else booking.departure_time.date()
                    departure_port = booking.return_departure_port if journey_type == "return" else booking.departure_port
                    arrival_port = booking.return_arrival_port if journey_type == "return" else booking.arrival_port

                    # Search with 15 second timeout to avoid hanging
                    try:
                        results = await asyncio.wait_for(
                            ferry_service.search_ferries(
                                departure_port=departure_port,
                                arrival_port=arrival_port,
                                departure_date=departure_date,
                                adults=1
                            ),
                            timeout=15.0
                        )
                    except asyncio.TimeoutError:
                        logger.warning(f"Search timeout for cabins on {departure_port}->{arrival_port}")
                        return {
                            "cabins": [],
                            "sailing_id": sailing_id,
                            "journey_type": journey_type,
                            "message": "Search timed out. Please try refreshing the page."
                        }

                    # Find matching sailing and extract cabins
                    for result in results:
                        if hasattr(result, 'cabin_types') and result.cabin_types:
                            for cabin in result.cabin_types:
                                if cabin.get("price", 0) > 0:  # Only paid cabins
                                    cabins.append({
                                        "code": cabin.get("code", cabin.get("type", "")),
                                        "name": cabin.get("name", "Cabin"),
                                        "cabin_type": cabin.get("type", "interior"),
                                        "description": cabin.get("description", ""),
                                        "price": cabin.get("price", 0),
                                        "max_occupancy": cabin.get("max_occupancy", 2),
                                        "available": cabin.get("available", 1),
                                        "has_bathroom": True,
                                        "has_tv": False,
                                        "has_wifi": False,
                                        "has_air_conditioning": True,
                                        "is_accessible": False,
                                    })
                            break  # Use first result with cabins

                except Exception as e:
                    logger.error(f"Error searching for cabins: {e}")

        logger.info(f"Returning {len(cabins)} available cabins for booking {booking_id}")
        return {"cabins": cabins, "sailing_id": sailing_id, "journey_type": journey_type}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching available cabins: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch available cabins: {str(e)}"
        )


class AddCabinRequest(BaseModel):
    """Request schema for adding a FerryHopper cabin to an existing booking."""
    cabin_code: str  # FerryHopper accommodation code (required)
    cabin_name: Optional[str] = None  # Cabin name for display
    price: float  # Price per cabin (required)
    quantity: int = 1
    journey_type: Optional[str] = "outbound"  # 'outbound' or 'return'
    alert_id: Optional[int] = None  # Optional alert to mark as fulfilled


@router.post("/{booking_id}/add-cabin", response_model=BookingResponse)
async def add_cabin_to_booking(
    booking_id: int,
    cabin_request: AddCabinRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """
    Add a FerryHopper cabin to an existing booking.

    This allows users to upgrade their booking by adding a cabin after initial booking.
    Cabin details are stored in extra_data for display.
    """
    try:
        # Get the booking
        booking = db.query(Booking).filter(Booking.id == booking_id).first()
        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found"
            )

        # Verify booking status allows modifications
        allowed_statuses = [BookingStatusEnum.PENDING, BookingStatusEnum.CONFIRMED]
        if booking.status not in allowed_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot add cabin to booking with status '{booking.status.value if hasattr(booking.status, 'value') else booking.status}'"
            )

        # IMPORTANT: Check if alert is already fulfilled to prevent double cabin additions
        if cabin_request.alert_id:
            from app.models.availability_alert import AvailabilityAlert
            alert = db.query(AvailabilityAlert).filter(
                AvailabilityAlert.id == cabin_request.alert_id
            ).first()
            if alert and alert.status == 'fulfilled':
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This cabin upgrade has already been completed. Please check your booking details."
                )

        # Validate journey type for return cabins
        if cabin_request.journey_type == 'return' and not booking.is_round_trip:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot add return cabin to one-way booking"
            )

        from decimal import Decimal

        # Calculate prices
        unit_price = Decimal(str(cabin_request.price))
        total_price = unit_price * cabin_request.quantity

        logger.info(f"Adding FerryHopper cabin {cabin_request.cabin_code} at €{unit_price} x {cabin_request.quantity}")

        # Determine journey type
        is_return = cabin_request.journey_type == 'return'

        # Update cabin supplement
        if is_return:
            booking.return_cabin_supplement = Decimal(str(float(booking.return_cabin_supplement or 0) + float(total_price)))
        else:
            booking.cabin_supplement = Decimal(str(float(booking.cabin_supplement or 0) + float(total_price)))

        # Store cabin details in extra_data
        extra_data = booking.extra_data or {}
        cabin_upgrades_key = "return_cabin_upgrades" if is_return else "cabin_upgrades"
        cabin_upgrades = extra_data.get(cabin_upgrades_key, []) or []

        # Infer cabin type and amenities
        cabin_type = _infer_cabin_type_from_code(cabin_request.cabin_code)
        cabin_amenities = _get_amenities_for_cabin_type(cabin_type)

        cabin_upgrades.append({
            "code": cabin_request.cabin_code,
            "name": cabin_request.cabin_name or _infer_cabin_name_from_code(cabin_request.cabin_code),
            "cabin_type": cabin_type,
            "quantity": cabin_request.quantity,
            "unit_price": float(unit_price),
            "total_price": float(total_price),
            "journey_type": cabin_request.journey_type,
            "added_at": utc_now().isoformat(),
            "amenities": cabin_amenities,
            "capacity": 3 if cabin_type == "suite" else 2
        })
        extra_data[cabin_upgrades_key] = cabin_upgrades
        booking.extra_data = extra_data

        logger.info(f"Updated booking {booking_id} cabin_supplement: +€{total_price}")

        # Recalculate total amount
        subtotal = Decimal(str(booking.subtotal or 0))
        cabin_total = Decimal(str(booking.cabin_supplement or 0)) + Decimal(str(booking.return_cabin_supplement or 0))
        discount = Decimal(str(booking.discount_amount or 0))
        tax_rate = Decimal('0.10')
        taxable_amount = subtotal + cabin_total - discount
        tax_amount = taxable_amount * tax_rate
        total_amount_new = taxable_amount + tax_amount

        booking.tax_amount = tax_amount
        booking.total_amount = total_amount_new
        booking.updated_at = utc_now()

        # Mark alert as fulfilled if provided
        if cabin_request.alert_id:
            from app.models.availability_alert import AvailabilityAlert
            alert = db.query(AvailabilityAlert).filter(AvailabilityAlert.id == cabin_request.alert_id).first()
            if alert:
                alert.status = "fulfilled"
                alert.notified_at = utc_now()
                logger.info(f"Marked alert {cabin_request.alert_id} as fulfilled")

        db.commit()
        db.refresh(booking)

        logger.info(f"Added cabin {cabin_request.cabin_code} x{cabin_request.quantity} to booking {booking.booking_reference} ({cabin_request.journey_type})")

        # Send cabin upgrade confirmation email
        try:
            from app.tasks.email_tasks import send_cabin_upgrade_confirmation_email_task

            base_url = os.getenv('FRONTEND_URL', 'https://localhost:3001')

            booking_dict = {
                "booking_reference": booking.booking_reference,
                "operator": booking.operator,
                "departure_port": booking.departure_port,
                "arrival_port": booking.arrival_port,
                "departure_time": str(booking.departure_time) if booking.departure_time else None,
                "return_departure_port": booking.return_departure_port,
                "return_arrival_port": booking.return_arrival_port,
                "return_departure_time": str(booking.return_departure_time) if booking.return_departure_time else None,
                "contact_email": booking.contact_email,
                "contact_first_name": booking.contact_first_name,
                "contact_last_name": booking.contact_last_name,
                "currency": booking.currency,
            }

            cabin_data = {
                "cabin_name": cabin_request.cabin_name or _infer_cabin_name_from_code(cabin_request.cabin_code),
                "cabin_type": cabin_type,
                "quantity": cabin_request.quantity,
                "unit_price": float(unit_price),
                "total_price": float(total_price),
                "journey_type": cabin_request.journey_type,
                "booking_url": f"{base_url}/booking/{booking.id}",
            }

            payment_dict = {
                "amount": float(total_price),
                "payment_method": "Credit Card",
                "stripe_payment_intent_id": f"cabin_upgrade_{booking.booking_reference}_{cabin_request.cabin_code}",
            }

            send_cabin_upgrade_confirmation_email_task.delay(
                booking_data=booking_dict,
                cabin_data=cabin_data,
                payment_data=payment_dict,
                to_email=booking.contact_email
            )
            logger.info(f"Queued cabin upgrade confirmation email for {booking.contact_email}")
        except Exception as email_error:
            logger.warning(f"Failed to queue cabin upgrade email: {str(email_error)}")

        return booking_to_response(booking)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to add cabin to booking: {str(e)}", exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add cabin: {str(e)}"
        )


@router.post("/{booking_id}/cancel")
async def cancel_booking(
    booking_id: int,
    cancellation_data: BookingCancellation,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """
    Cancel a booking.

    Cancels the booking with the ferry operator, refunds the payment via Stripe, and updates the status.
    Allows both authenticated users and guest users to cancel their bookings.
    """
    try:
        booking = db.query(Booking).filter(Booking.id == booking_id).first()
        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found"
            )

        # Check access permissions (allows guests for bookings without user_id)
        if not validate_booking_access(booking_id, current_user, db):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )

        # Check if booking can be cancelled
        if booking.status in [BookingStatusEnum.CANCELLED, BookingStatusEnum.COMPLETED]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Booking cannot be cancelled"
            )

        # Check if departure has already passed
        if booking.departure_time:
            from datetime import timezone as tz
            now_utc = datetime.now(tz.utc)
            departure = booking.departure_time
            if departure.tzinfo is None:
                departure = departure.replace(tzinfo=tz.utc)
            if departure < now_utc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot cancel a booking after departure. The ferry has already departed."
                )

        # Check 7-day cancellation restriction (unless booking has cancellation protection)
        # Cancellation protection is stored in booking extra_data field
        has_cancellation_protection = booking.extra_data.get("has_cancellation_protection", False) if booking.extra_data else False
        logger.info(f"Booking {booking_id} cancellation check: extra_data={booking.extra_data}, has_protection={has_cancellation_protection}")

        if not has_cancellation_protection and booking.departure_time:
            from datetime import timedelta, timezone
            # Make sure we compare timezone-aware datetimes
            now_utc = datetime.now(timezone.utc)
            departure = booking.departure_time
            if departure.tzinfo is None:
                departure = departure.replace(tzinfo=timezone.utc)
            days_until_departure = (departure - now_utc).days
            logger.info(f"Days until departure: {days_until_departure}, departure={departure}, now={now_utc}")

            if days_until_departure < 7:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cancellations are not allowed within 7 days of departure. Your trip departs in {days_until_departure} days. Consider purchasing cancellation protection for future bookings."
                )

        # Cancel with ferry operator
        try:
            if booking.operator_booking_reference:
                cancelled = await ferry_service.cancel_booking(
                    operator=booking.operator,
                    booking_reference=booking.operator_booking_reference,
                    reason=cancellation_data.reason
                )

                if not cancelled:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Failed to cancel with ferry operator"
                    )
        except FerryAPIError as e:
            # Log the error but continue with local cancellation
            pass

        # Process refunds for ALL completed payments (includes cabin upgrades paid separately)
        from app.models.payment import Payment, PaymentStatusEnum as PaymentStatus
        import stripe

        # Get ALL completed payments for this booking
        payments = (
            db.query(Payment)
            .filter(
                Payment.booking_id == booking_id,
                Payment.status == PaymentStatus.COMPLETED
            )
            .all()
        )

        total_refund_amount = 0.0
        refunds_processed = 0
        refund_errors = []

        for payment in payments:
            if payment.stripe_charge_id:
                try:
                    # Create refund in Stripe
                    refund = stripe.Refund.create(
                        charge=payment.stripe_charge_id,
                        reason="requested_by_customer",
                        metadata={
                            "booking_id": str(booking_id),
                            "booking_reference": booking.booking_reference,
                            "cancellation_reason": cancellation_data.reason or "Customer requested",
                            "payment_type": "booking"
                        }
                    )

                    # Update payment status
                    payment.status = PaymentStatus.REFUNDED
                    payment.refund_amount = float(refund.amount) / 100  # Convert from cents
                    payment.stripe_refund_id = refund.id
                    total_refund_amount += payment.refund_amount
                    refunds_processed += 1

                    logger.info(f"Refund created for booking {booking_id}, payment {payment.id}: {refund.id} (€{payment.refund_amount})")

                except stripe.StripeError as e:
                    error_msg = f"Payment {payment.id}: {str(e)}"
                    refund_errors.append(error_msg)
                    logger.error(f"Failed to create Stripe refund for booking {booking_id}, payment {payment.id}: {str(e)}")
                    # Continue with other refunds even if one fails

        if refund_errors:
            logger.warning(f"Some refunds failed for booking {booking_id}: {refund_errors}")

        # Update booking status
        booking.status = BookingStatusEnum.CANCELLED
        booking.cancellation_reason = cancellation_data.reason
        booking.cancelled_at = utc_now()
        booking.updated_at = utc_now()
        if total_refund_amount > 0:
            booking.refund_amount = total_refund_amount
            booking.refund_processed = refunds_processed > 0

        db.commit()
        db.refresh(booking)

        # Invalidate cache for this sailing (ferry now has more capacity)
        try:
            from app.services.cache_service import cache_service
            if booking.sailing_id:
                cache_service.invalidate_sailing_availability(booking.sailing_id)
                logger.info(f"Invalidated availability cache for sailing {booking.sailing_id}")
        except Exception as e:
            logger.warning(f"Failed to invalidate cache: {str(e)}")

        # Calculate total cabins being freed
        total_cabins_freed = 0

        # First check booking_cabins table (new way - has actual quantities)
        try:
            from app.models.booking import BookingCabin
            booking_cabins = db.query(BookingCabin).filter(BookingCabin.booking_id == booking.id).all()
            if booking_cabins:
                # Use booking_cabins as source of truth
                for cabin in booking_cabins:
                    total_cabins_freed += cabin.quantity
                logger.info(f"Cancellation freeing {total_cabins_freed} cabins from {len(booking_cabins)} booking_cabin records")
            else:
                # Fallback to legacy cabin_id fields (old bookings without booking_cabins)
                if booking.cabin_id:
                    total_cabins_freed += 1
                if booking.return_cabin_id:
                    total_cabins_freed += 1
                logger.info(f"Cancellation freeing {total_cabins_freed} cabins from legacy cabin_id fields")
        except Exception as e:
            logger.warning(f"Could not count cabins: {str(e)}")

        # Publish instant availability update via WebSocket (capacity freed up)
        try:
            from app.tasks.availability_sync_tasks import publish_availability_now
            route = f"{booking.departure_port}-{booking.arrival_port}"
            publish_availability_now(
                route=route,
                ferry_id=booking.sailing_id or f"{booking.operator}-{booking.booking_reference}",
                departure_time=booking.departure_time.isoformat() if booking.departure_time else "",
                availability={
                    "change_type": "booking_cancelled",
                    "passengers_freed": booking.total_passengers,
                    "vehicles_freed": booking.total_vehicles,
                    "cabins_freed": total_cabins_freed,
                    "booking_reference": booking.booking_reference
                }
            )
            logger.info(f"📢 Instant availability update published for cancelled booking {booking.booking_reference} (cabins_freed={total_cabins_freed})")
        except Exception as e:
            logger.warning(f"Failed to publish availability update: {str(e)}")

        # Queue cancellation email asynchronously (non-blocking)
        try:
            from app.tasks.email_tasks import send_cancellation_email_task

            booking_dict = {
                "id": booking.id,
                "booking_reference": booking.booking_reference,
                "operator": booking.operator,
                "departure_port": booking.departure_port,
                "arrival_port": booking.arrival_port,
                "departure_time": booking.departure_time.isoformat() if booking.departure_time else None,
                "arrival_time": booking.arrival_time.isoformat() if booking.arrival_time else None,
                "vessel_name": booking.vessel_name,
                "contact_email": booking.contact_email,
                "contact_first_name": booking.contact_first_name,
                "contact_last_name": booking.contact_last_name,
                "total_passengers": booking.total_passengers,
                "total_vehicles": booking.total_vehicles,
                "cancellation_reason": cancellation_data.reason,
                "cancelled_at": booking.cancelled_at.isoformat() if booking.cancelled_at else None,
                "refund_amount": total_refund_amount if total_refund_amount > 0 else None,
                "refunds_count": refunds_processed,
                "base_url": os.getenv("BASE_URL", "http://localhost:3001")
            }

            # Queue email task (returns immediately, email sent by worker)
            task = send_cancellation_email_task.delay(
                booking_data=booking_dict,
                to_email=booking.contact_email
            )
            logger.info(f"Cancellation email queued: task_id={task.id}")

        except Exception as e:
            # Log error but don't fail the cancellation
            logger.error(f"Failed to queue cancellation email: {str(e)}")

        return {
            "message": "Booking cancelled successfully",
            "booking_id": booking_id,
            "refunds_issued": refunds_processed,
            "total_refund_amount": total_refund_amount if total_refund_amount > 0 else None,
            "refund_errors": refund_errors if refund_errors else None
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to cancel booking: {str(e)}"
        )


@router.get("/{booking_id}/status")
async def get_booking_status(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """
    Get real-time booking status from ferry operator.
    
    Checks the current status of the booking with the ferry operator.
    """
    try:
        booking = db.query(Booking).filter(Booking.id == booking_id).first()
        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found"
            )
        
        # Check access permissions
        if not validate_booking_access(booking_id, current_user, db):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        # Get status from ferry operator
        operator_status = None
        if booking.operator_booking_reference:
            try:
                operator_status = await ferry_service.get_booking_status(
                    operator=booking.operator,
                    booking_reference=booking.operator_booking_reference
                )
            except FerryAPIError:
                # If operator API fails, return local status
                pass
        
        return {
            "booking_id": booking_id,
            "local_status": booking.status,
            "operator_status": operator_status,
            "last_updated": booking.updated_at,
            "operator_reference": booking.operator_booking_reference
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to get booking status: {str(e)}"
        )


@router.get("/reference/{booking_reference}", response_model=BookingResponse)
async def get_booking_by_reference(
    booking_reference: str,
    email: str = Query(..., description="Contact email for verification"),
    db: Session = Depends(get_db)
):
    """
    Get booking by reference number.

    Allows guests to retrieve booking information using booking reference
    and contact email for verification.
    """
    try:
        # Use selectinload to eagerly load relationships and avoid N+1 queries
        booking = db.query(Booking).options(
            selectinload(Booking.passengers),
            selectinload(Booking.vehicles),
            selectinload(Booking.meals),
            selectinload(Booking.booking_cabins).selectinload(BookingCabin.cabin),
            selectinload(Booking.cabin),
            selectinload(Booking.return_cabin),
        ).filter(
            and_(
                Booking.booking_reference == booking_reference,
                Booking.contact_email == email
            )
        ).first()

        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found or email doesn't match"
            )

        return booking_to_response(booking)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to get booking: {str(e)}"
        ) 

@router.post("/expire-pending", status_code=200)
async def expire_pending_bookings(
    db: Session = Depends(get_db)
):
    """
    Expire pending bookings that have passed their expiration time.

    This endpoint should be called periodically (e.g., via a cron job)
    to automatically cancel bookings that haven't been paid within 3 days.
    """
    try:
        from datetime import datetime

        # Find all pending bookings that have expired
        expired_bookings = db.query(Booking).filter(
            Booking.status == BookingStatusEnum.PENDING,
            Booking.expires_at != None,
            Booking.expires_at < utc_now()
        ).all()

        expired_count = 0
        for booking in expired_bookings:
            booking.status = BookingStatusEnum.CANCELLED
            booking.cancellation_reason = "Booking expired - payment not received within 3 days"
            booking.cancelled_at = utc_now()
            expired_count += 1

        db.commit()

        return {
            "message": f"Expired {expired_count} pending booking(s)",
            "expired_count": expired_count
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to expire bookings: {str(e)}"
        )


@router.get("/{booking_id}/invoice")
async def get_booking_invoice(
    booking_id: int,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate and download PDF invoice for a booking.

    Only available for paid bookings. User must own the booking or be admin.
    """
    try:
        import io

        # Get booking
        booking = db.query(Booking).filter(Booking.id == booking_id).first()
        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found"
            )

        # Check user permission
        if current_user:
            if booking.user_id and booking.user_id != current_user.id and not current_user.is_admin:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to access this booking"
                )
        elif booking.user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Authentication required"
            )

        # Get payment - must be completed to generate invoice
        payment = db.query(Payment).filter(
            Payment.booking_id == booking_id,
            Payment.status == PaymentStatusEnum.COMPLETED
        ).first()

        if not payment:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invoice only available for paid bookings"
            )

        # Get passengers
        passengers = []
        for p in booking.passengers:
            passengers.append({
                'passenger_type': p.passenger_type.value if hasattr(p.passenger_type, 'value') else str(p.passenger_type),
                'first_name': p.first_name,
                'last_name': p.last_name,
                'final_price': float(p.final_price)
            })

        # Get vehicles
        vehicles = []
        for v in booking.vehicles:
            vehicles.append({
                'vehicle_type': v.vehicle_type.value if hasattr(v.vehicle_type, 'value') else str(v.vehicle_type),
                'license_plate': v.license_plate,
                'final_price': float(v.final_price)
            })

        # Get meals
        meals = []
        for m in booking.meals:
            meals.append({
                'meal_name': m.meal.name if m.meal else 'Meal',
                'quantity': m.quantity,
                'unit_price': float(m.unit_price),
                'total_price': float(m.total_price)
            })

        # Calculate original cabin costs (excluding upgrades from bookingCabins)
        # bookingCabins contains cabin upgrades added AFTER the initial booking
        # Sum up all cabin upgrades
        outbound_upgrades = sum(
            float(bc.total_price) for bc in booking.booking_cabins
            if bc.journey_type == JourneyTypeEnum.OUTBOUND
        )
        return_upgrades = sum(
            float(bc.total_price) for bc in booking.booking_cabins
            if bc.journey_type == JourneyTypeEnum.RETURN
        )

        # Original cabin = total supplement - upgrades
        original_cabin_supplement = max(0, float(booking.cabin_supplement or 0) - outbound_upgrades)
        original_return_cabin_supplement = max(0, float(booking.return_cabin_supplement or 0) - return_upgrades)

        # Calculate original total and tax (without upgrades)
        total_upgrades = outbound_upgrades + return_upgrades
        original_total = float(booking.total_amount or 0) - (total_upgrades * 1.10)  # Remove upgrades + their tax
        original_tax = float(booking.tax_amount or 0) - (total_upgrades * 0.10)  # Remove upgrade tax

        # Prepare booking data with ORIGINAL values (excluding cabin upgrades)
        booking_data = {
            'id': booking.id,
            'booking_reference': booking.booking_reference,
            'operator': booking.operator,
            'departure_port': booking.departure_port,
            'arrival_port': booking.arrival_port,
            'departure_time': booking.departure_time,
            'arrival_time': booking.arrival_time,
            'vessel_name': booking.vessel_name,
            'is_round_trip': booking.is_round_trip,
            'return_departure_time': booking.return_departure_time,
            'contact_email': booking.contact_email,
            'contact_phone': booking.contact_phone,
            'contact_first_name': booking.contact_first_name,
            'contact_last_name': booking.contact_last_name,
            'total_passengers': booking.total_passengers,
            'total_vehicles': booking.total_vehicles,
            'subtotal': float(booking.subtotal),
            'tax_amount': original_tax,
            'total_amount': original_total,
            'currency': booking.currency,
            # Use original cabin costs (excluding upgrades)
            'cabin_supplement': original_cabin_supplement,
            'return_cabin_supplement': original_return_cabin_supplement,
            # Include extra_data for cancellation protection
            'extra_data': booking.extra_data,
        }

        # Prepare payment data
        payment_data = {
            'payment_method': payment.payment_method.value if hasattr(payment.payment_method, 'value') else str(payment.payment_method),
            'stripe_payment_intent_id': payment.stripe_payment_intent_id,
            'stripe_charge_id': payment.stripe_charge_id,
            'card_brand': payment.card_brand,
            'card_last_four': payment.card_last_four,
        }

        # Generate PDF
        pdf_content = invoice_service.generate_invoice(
            booking=booking_data,
            payment=payment_data,
            passengers=passengers,
            vehicles=vehicles,
            meals=meals
        )

        # Return as downloadable file
        filename = f"invoice_{booking.booking_reference}.pdf"

        return StreamingResponse(
            io.BytesIO(pdf_content),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to generate invoice: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate invoice: {str(e)}"
        )


@router.get("/{booking_id}/cabin-upgrade-invoice")
async def get_cabin_upgrade_invoice(
    booking_id: int,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate and download PDF invoice for all cabin upgrades.

    Includes all cabins from the booking_cabins table for this booking.
    User must own the booking or be admin.
    """
    try:
        import io

        # Get booking
        booking = db.query(Booking).filter(Booking.id == booking_id).first()
        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found"
            )

        # Check user permission
        if current_user:
            if booking.user_id and booking.user_id != current_user.id and not current_user.is_admin:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to access this booking"
                )
        elif booking.user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Authentication required"
            )

        # Get all cabin upgrades from booking_cabins table
        booking_cabins = db.query(BookingCabin).filter(
            BookingCabin.booking_id == booking_id
        ).all()

        # Also check legacy cabin supplements
        cabin_supplement = float(booking.cabin_supplement or 0)
        return_cabin_supplement = float(booking.return_cabin_supplement or 0)

        if not booking_cabins and cabin_supplement == 0 and return_cabin_supplement == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No cabin upgrade found for this booking"
            )

        # Get payment - must be completed to generate invoice
        payment = db.query(Payment).filter(
            Payment.booking_id == booking_id,
            Payment.status == PaymentStatusEnum.COMPLETED
        ).first()

        if not payment:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invoice only available for paid bookings"
            )

        # Prepare booking data
        booking_data = {
            'id': booking.id,
            'booking_reference': booking.booking_reference,
            'operator': booking.operator,
            'departure_port': booking.departure_port,
            'arrival_port': booking.arrival_port,
            'departure_time': booking.departure_time,
            'arrival_time': booking.arrival_time,
            'vessel_name': booking.vessel_name,
            'is_round_trip': booking.is_round_trip,
            'return_departure_port': booking.return_departure_port,
            'return_arrival_port': booking.return_arrival_port,
            'return_departure_time': booking.return_departure_time,
            'contact_email': booking.contact_email,
            'contact_phone': booking.contact_phone,
            'contact_first_name': booking.contact_first_name,
            'contact_last_name': booking.contact_last_name,
            'currency': booking.currency,
        }

        # Build list of all cabins with details
        cabins_list = []
        total_cabin_price = 0.0

        for bc in booking_cabins:
            cabin_info = {
                'cabin_name': bc.cabin.name if bc.cabin else 'Cabin',
                'cabin_type': bc.cabin.cabin_type.value if bc.cabin and hasattr(bc.cabin.cabin_type, 'value') else 'Standard',
                'quantity': bc.quantity,
                'unit_price': float(bc.unit_price),
                'total_price': float(bc.total_price),
                'journey_type': bc.journey_type.value if hasattr(bc.journey_type, 'value') else str(bc.journey_type),
            }
            cabins_list.append(cabin_info)
            total_cabin_price += float(bc.total_price)

        # If no booking_cabins but has legacy supplements, create legacy entry
        if not cabins_list and (cabin_supplement > 0 or return_cabin_supplement > 0):
            # Use default cabin info - no longer querying Cabin table
            cabin_name = "Cabin"
            cabin_type = "Standard"

            total_cabin_price = cabin_supplement + return_cabin_supplement
            journey_type = 'outbound'
            if cabin_supplement > 0 and return_cabin_supplement > 0:
                journey_type = 'both'
            elif return_cabin_supplement > 0:
                journey_type = 'return'

            cabins_list.append({
                'cabin_name': cabin_name,
                'cabin_type': cabin_type,
                'quantity': 1,
                'unit_price': total_cabin_price,
                'total_price': total_cabin_price,
                'journey_type': journey_type,
            })

        # cabin_data now includes all cabins
        cabin_data = {
            'cabins': cabins_list,
            'total_price': total_cabin_price,
            # Keep backward compatibility - use first cabin's info for single cabin display
            'cabin_name': cabins_list[0]['cabin_name'] if cabins_list else 'Cabin',
            'cabin_type': cabins_list[0]['cabin_type'] if cabins_list else 'Standard',
            'quantity': sum(c['quantity'] for c in cabins_list),
            'unit_price': cabins_list[0]['unit_price'] if len(cabins_list) == 1 else total_cabin_price,
            'journey_type': 'both' if any(c['journey_type'] == 'RETURN' for c in cabins_list) and any(c['journey_type'] == 'OUTBOUND' for c in cabins_list) else (cabins_list[0]['journey_type'] if cabins_list else 'outbound'),
        }

        # Prepare payment data
        payment_data = {
            'payment_method': payment.payment_method.value if hasattr(payment.payment_method, 'value') else str(payment.payment_method),
            'stripe_payment_intent_id': payment.stripe_payment_intent_id,
            'stripe_charge_id': payment.stripe_charge_id,
            'card_brand': payment.card_brand,
            'card_last_four': payment.card_last_four,
        }

        # Generate PDF using cabin upgrade invoice generator
        pdf_content = invoice_service.generate_cabin_upgrade_invoice(
            booking=booking_data,
            cabin_data=cabin_data,
            payment=payment_data
        )

        # Return as downloadable file
        filename = f"cabin_upgrade_invoice_{booking.booking_reference}.pdf"

        return StreamingResponse(
            io.BytesIO(pdf_content),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to generate cabin upgrade invoice: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate cabin upgrade invoice: {str(e)}"
        )


@router.get("/{booking_id}/eticket")
async def get_booking_eticket(
    booking_id: int,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate and download E-Ticket PDF with QR code for a booking.

    Available for confirmed bookings. User must own the booking or be admin.
    The E-Ticket includes a QR code for check-in at the port.
    """
    try:
        import io
        from app.services.eticket_service import eticket_service

        # Get booking
        booking = db.query(Booking).filter(Booking.id == booking_id).first()
        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found"
            )

        # Check user permission
        if current_user:
            if booking.user_id and booking.user_id != current_user.id and not current_user.is_admin:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to access this booking"
                )
        elif booking.user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Authentication required"
            )

        # Check booking status - must be confirmed
        if booking.status != BookingStatusEnum.CONFIRMED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="E-Ticket only available for confirmed bookings"
            )

        # Prepare booking data
        booking_data = {
            'id': booking.id,
            'booking_reference': booking.booking_reference,
            'operator': booking.operator,
            'departure_port': booking.departure_port,
            'arrival_port': booking.arrival_port,
            'departure_time': booking.departure_time.isoformat() if booking.departure_time else None,
            'arrival_time': booking.arrival_time.isoformat() if booking.arrival_time else None,
            'vessel_name': booking.vessel_name,
            'is_round_trip': booking.is_round_trip,
            'return_operator': booking.return_operator,
            'return_departure_port': booking.return_departure_port,
            'return_arrival_port': booking.return_arrival_port,
            'return_departure_time': booking.return_departure_time.isoformat() if booking.return_departure_time else None,
            'return_arrival_time': booking.return_arrival_time.isoformat() if booking.return_arrival_time else None,
            'return_vessel_name': booking.return_vessel_name,
            'contact_email': booking.contact_email,
            'contact_phone': booking.contact_phone,
            'contact_first_name': booking.contact_first_name,
            'contact_last_name': booking.contact_last_name,
            'total_passengers': booking.total_passengers,
            'total_vehicles': booking.total_vehicles,
            'status': booking.status.value if booking.status else 'CONFIRMED',
        }

        # Get passengers
        passengers = []
        for p in booking.passengers:
            passengers.append({
                'first_name': p.first_name,
                'last_name': p.last_name,
                'passenger_type': p.passenger_type.value if hasattr(p.passenger_type, 'value') else str(p.passenger_type),
                'date_of_birth': str(p.date_of_birth) if p.date_of_birth else None,
                'nationality': p.nationality,
            })

        # Get vehicles
        vehicles = []
        for v in booking.vehicles:
            vehicles.append({
                'vehicle_type': v.vehicle_type.value if hasattr(v.vehicle_type, 'value') else str(v.vehicle_type),
                'make': v.make,
                'model': v.model,
                'license_plate': v.license_plate,
            })

        # Generate E-Ticket PDF
        pdf_content = eticket_service.generate_eticket(
            booking=booking_data,
            passengers=passengers,
            vehicles=vehicles
        )

        # Return as downloadable file
        filename = f"eticket_{booking.booking_reference}.pdf"

        return StreamingResponse(
            io.BytesIO(pdf_content),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to generate E-Ticket: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate E-Ticket: {str(e)}"
        )


@router.get("/reference/{booking_reference}/eticket")
async def get_booking_eticket_by_reference(
    booking_reference: str,
    email: Optional[str] = Query(None, description="Contact email for verification"),
    db: Session = Depends(get_db)
):
    """
    Generate and download E-Ticket PDF by booking reference.

    For guest bookings, email verification is required.
    """
    try:
        import io
        from app.services.eticket_service import eticket_service

        # Find booking by reference
        booking = db.query(Booking).filter(
            Booking.booking_reference == booking_reference.upper()
        ).first()

        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found"
            )

        # For guest bookings, verify email
        if not booking.user_id:
            if not email:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email verification required for guest bookings"
                )
            if email.lower() != booking.contact_email.lower():
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Email does not match booking"
                )

        # Check booking status
        if booking.status != BookingStatusEnum.CONFIRMED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="E-Ticket only available for confirmed bookings"
            )

        # Prepare booking data
        booking_data = {
            'id': booking.id,
            'booking_reference': booking.booking_reference,
            'operator': booking.operator,
            'departure_port': booking.departure_port,
            'arrival_port': booking.arrival_port,
            'departure_time': booking.departure_time.isoformat() if booking.departure_time else None,
            'arrival_time': booking.arrival_time.isoformat() if booking.arrival_time else None,
            'vessel_name': booking.vessel_name,
            'is_round_trip': booking.is_round_trip,
            'return_operator': booking.return_operator,
            'return_departure_port': booking.return_departure_port,
            'return_arrival_port': booking.return_arrival_port,
            'return_departure_time': booking.return_departure_time.isoformat() if booking.return_departure_time else None,
            'return_arrival_time': booking.return_arrival_time.isoformat() if booking.return_arrival_time else None,
            'return_vessel_name': booking.return_vessel_name,
            'contact_email': booking.contact_email,
            'contact_phone': booking.contact_phone,
            'contact_first_name': booking.contact_first_name,
            'contact_last_name': booking.contact_last_name,
            'total_passengers': booking.total_passengers,
            'total_vehicles': booking.total_vehicles,
            'status': booking.status.value if booking.status else 'CONFIRMED',
        }

        # Get passengers
        passengers = []
        for p in booking.passengers:
            passengers.append({
                'first_name': p.first_name,
                'last_name': p.last_name,
                'passenger_type': p.passenger_type.value if hasattr(p.passenger_type, 'value') else str(p.passenger_type),
                'date_of_birth': str(p.date_of_birth) if p.date_of_birth else None,
                'nationality': p.nationality,
            })

        # Get vehicles
        vehicles = []
        for v in booking.vehicles:
            vehicles.append({
                'vehicle_type': v.vehicle_type.value if hasattr(v.vehicle_type, 'value') else str(v.vehicle_type),
                'make': v.make,
                'model': v.model,
                'license_plate': v.license_plate,
            })

        # Generate E-Ticket PDF
        pdf_content = eticket_service.generate_eticket(
            booking=booking_data,
            passengers=passengers,
            vehicles=vehicles
        )

        # Return as downloadable file
        filename = f"eticket_{booking.booking_reference}.pdf"

        return StreamingResponse(
            io.BytesIO(pdf_content),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to generate E-Ticket: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate E-Ticket: {str(e)}"
        )
