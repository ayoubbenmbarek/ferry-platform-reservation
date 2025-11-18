"""
Booking API endpoints for creating, managing, and retrieving ferry bookings.
"""

import uuid
import os
import logging
from typing import List, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

try:
    from fastapi import APIRouter, Depends, HTTPException, status, Query
    from fastapi.responses import StreamingResponse
    from sqlalchemy.orm import Session
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
    from app.models.booking import Booking, BookingPassenger, BookingVehicle, BookingStatusEnum, PassengerTypeEnum, VehicleTypeEnum
    from app.models.ferry import Schedule
    from app.schemas.booking import (
        BookingCreate, BookingResponse, BookingUpdate, BookingCancellation,
        BookingListResponse, BookingSearchParams, BookingStatistics,
        BookingModification, BookingConfirmation
    )
    from app.services.ferry_service import FerryService
    from app.services.ferry_integrations.base import FerryAPIError
    from app.services.email_service import email_service
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


def booking_to_response(db_booking: Booking) -> BookingResponse:
    """Convert a Booking model to BookingResponse, handling enum conversions."""
    return BookingResponse(
        id=db_booking.id,
        booking_reference=db_booking.booking_reference,
        operator_booking_reference=db_booking.operator_booking_reference,
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
        tax_amount=db_booking.tax_amount,
        total_amount=db_booking.total_amount,
        currency=db_booking.currency,
        # Cabin information
        cabin_id=db_booking.cabin_id,
        cabin_supplement=db_booking.cabin_supplement or 0.0,
        return_cabin_id=db_booking.return_cabin_id,
        return_cabin_supplement=db_booking.return_cabin_supplement or 0.0,
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
                "license_plate": v.license_plate,
                "length_cm": v.length_cm,
                "width_cm": v.width_cm,
                "height_cm": v.height_cm,
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
        ] if hasattr(db_booking, 'meals') and db_booking.meals else []
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

        subtotal = 0.0
        for passenger in booking_data.passengers:
            if passenger.type == "adult":
                subtotal += base_adult_price
            elif passenger.type == "child":
                subtotal += base_child_price
            # infants are free

        if booking_data.vehicles:
            subtotal += base_vehicle_price * len(booking_data.vehicles)
        
        # Add cabin supplement if selected (outbound)
        cabin_supplement = 0.0
        selected_cabin_id = None
        if booking_data.cabin_id:
            from app.models.ferry import Cabin
            cabin = db.query(Cabin).filter(Cabin.id == booking_data.cabin_id).first()
            if cabin:
                cabin_supplement = float(cabin.base_price)
                subtotal += cabin_supplement
                selected_cabin_id = cabin.id

        # Add return cabin supplement if selected
        return_cabin_supplement = 0.0
        selected_return_cabin_id = None
        if hasattr(booking_data, 'return_cabin_id') and booking_data.return_cabin_id:
            from app.models.ferry import Cabin
            return_cabin = db.query(Cabin).filter(Cabin.id == booking_data.return_cabin_id).first()
            if return_cabin:
                return_cabin_supplement = float(return_cabin.base_price)
                subtotal += return_cabin_supplement
                selected_return_cabin_id = return_cabin.id

        # Add meal costs if selected
        meals_total = 0.0
        if booking_data.meals:
            from app.models.meal import Meal
            for meal_selection in booking_data.meals:
                meal = db.query(Meal).filter(Meal.id == meal_selection.meal_id).first()
                if meal:
                    meals_total += float(meal.price) * meal_selection.quantity
            subtotal += meals_total

        # Calculate tax (10% for example)
        tax_amount = subtotal * 0.10
        total_amount = subtotal + tax_amount

        # Calculate expiration time (30 minutes from now for pending bookings)
        from datetime import datetime, timedelta
        expires_at = datetime.utcnow() + timedelta(minutes=30)

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
            tax_amount=tax_amount,
            total_amount=total_amount,
            currency="EUR",
            cabin_id=selected_cabin_id,
            cabin_supplement=cabin_supplement,
            return_cabin_id=selected_return_cabin_id,
            return_cabin_supplement=return_cabin_supplement,
            special_requests=booking_data.special_requests,
            status=BookingStatusEnum.PENDING,
            expires_at=expires_at  # Expires 30 minutes from creation
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

            db_passenger = BookingPassenger(
                booking_id=db_booking.id,
                passenger_type=db_passenger_type,
                first_name=passenger_data.first_name,
                last_name=passenger_data.last_name,
                date_of_birth=passenger_data.date_of_birth,
                nationality=passenger_data.nationality,
                passport_number=passenger_data.passport_number,
                base_price=base_adult_price if passenger_data.type == "adult" else
                          (base_child_price if passenger_data.type == "child" else 0.0),
                final_price=base_adult_price if passenger_data.type == "adult" else
                           (base_child_price if passenger_data.type == "child" else 0.0),
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

                db_vehicle = BookingVehicle(
                    booking_id=db_booking.id,
                    vehicle_type=db_vehicle_type,
                    make=vehicle_data.make,
                    model=vehicle_data.model,
                    license_plate=vehicle_data.registration or "TEMP",
                    length_cm=int(vehicle_data.length * 100),
                    width_cm=int(vehicle_data.width * 100),
                    height_cm=int(vehicle_data.height * 100),
                    base_price=base_vehicle_price,
                    final_price=base_vehicle_price
                )
                db.add(db_vehicle)

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

        # Create booking with ferry operator
        try:
            # Prepare cabin data for operator if cabin_id is provided
            cabin_data = None
            if booking_data.cabin_id:
                from app.models.ferry import Cabin
                cabin = db.query(Cabin).filter(Cabin.id == booking_data.cabin_id).first()
                if cabin:
                    cabin_data = {
                        "type": cabin.cabin_type.value if hasattr(cabin.cabin_type, 'value') else str(cabin.cabin_type),
                        "supplement_price": float(cabin.base_price)
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
            # Note: Status remains PENDING until payment is completed
            db.commit()

        except FerryAPIError as e:
            # If operator booking fails, keep as pending for manual processing
            # Status is already PENDING, just commit
            db.commit()

        # Convert to response model manually to handle enum conversions
        db.refresh(db_booking)

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

            email_service.send_booking_confirmation(
                booking_data=booking_dict,
                to_email=db_booking.contact_email
            )
        except Exception as e:
            # Log email error but don't fail the booking
            print(f"Failed to send booking confirmation email: {str(e)}")

        return booking_to_response(db_booking)
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        import traceback
        error_traceback = traceback.format_exc()
        print(f"Booking creation error: {str(e)}")
        print(f"Traceback:\n{error_traceback}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Booking creation failed: {str(e)}"
        )


@router.get("/", response_model=BookingListResponse)
async def list_bookings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
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
        query = db.query(Booking)
        
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
        
        booking.updated_at = datetime.utcnow()
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


@router.post("/{booking_id}/cancel")
async def cancel_booking(
    booking_id: int,
    cancellation_data: BookingCancellation,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Cancel a booking.

    Cancels the booking with the ferry operator, refunds the payment via Stripe, and updates the status.
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

        # Check if booking can be cancelled
        if booking.status in ["cancelled", "completed"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Booking cannot be cancelled"
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

        # Process refund if payment was made
        from app.models.payment import Payment, PaymentStatusEnum as PaymentStatus
        import stripe

        payment = (
            db.query(Payment)
            .filter(
                Payment.booking_id == booking_id,
                Payment.status == PaymentStatus.COMPLETED
            )
            .first()
        )

        if payment and payment.stripe_charge_id:
            try:
                # Create refund in Stripe
                refund = stripe.Refund.create(
                    charge=payment.stripe_charge_id,
                    reason="requested_by_customer",
                    metadata={
                        "booking_id": booking_id,
                        "booking_reference": booking.booking_reference,
                        "cancellation_reason": cancellation_data.reason
                    }
                )

                # Update payment status
                payment.status = PaymentStatus.REFUNDED
                payment.refund_amount = float(refund.amount) / 100  # Convert from cents
                payment.stripe_refund_id = refund.id

                logger.info(f"Refund created for booking {booking_id}: {refund.id}")

            except stripe.StripeError as e:
                logger.error(f"Failed to create Stripe refund for booking {booking_id}: {str(e)}")
                # Continue with cancellation even if refund fails
                # Admin can manually process refund later

        # Update booking status
        booking.status = BookingStatusEnum.CANCELLED
        booking.cancellation_reason = cancellation_data.reason
        booking.cancelled_at = datetime.utcnow()
        booking.updated_at = datetime.utcnow()
        if payment:
            booking.refund_amount = payment.refund_amount

        db.commit()

        # Send cancellation confirmation email
        try:
            booking_dict = {
                "id": booking.id,
                "booking_reference": booking.booking_reference,
                "operator": booking.operator,
                "departure_port": booking.departure_port,
                "arrival_port": booking.arrival_port,
                "departure_time": booking.departure_time,
                "arrival_time": booking.arrival_time,
                "vessel_name": booking.vessel_name,
                "contact_email": booking.contact_email,
                "contact_first_name": booking.contact_first_name,
                "contact_last_name": booking.contact_last_name,
                "total_passengers": booking.total_passengers,
                "total_vehicles": booking.total_vehicles,
                "cancellation_reason": cancellation_data.reason,
                "cancelled_at": booking.cancelled_at,
                "refund_amount": payment.refund_amount if payment else None,
                "base_url": os.getenv("BASE_URL", "http://localhost:3001")
            }

            email_service.send_cancellation_confirmation(
                booking_data=booking_dict,
                to_email=booking.contact_email
            )
        except Exception as e:
            logger.error(f"Failed to send cancellation email: {str(e)}")

        return {
            "message": "Booking cancelled successfully",
            "booking_id": booking_id,
            "refund_issued": payment is not None,
            "refund_amount": payment.refund_amount if payment else None
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
        booking = db.query(Booking).filter(
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
            Booking.expires_at < datetime.utcnow()
        ).all()

        expired_count = 0
        for booking in expired_bookings:
            booking.status = BookingStatusEnum.CANCELLED
            booking.cancellation_reason = "Booking expired - payment not received within 3 days"
            booking.cancelled_at = datetime.utcnow()
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
            'return_departure_time': booking.return_departure_time,
            'contact_email': booking.contact_email,
            'contact_phone': booking.contact_phone,
            'contact_first_name': booking.contact_first_name,
            'contact_last_name': booking.contact_last_name,
            'total_passengers': booking.total_passengers,
            'total_vehicles': booking.total_vehicles,
            'subtotal': float(booking.subtotal),
            'tax_amount': float(booking.tax_amount) if booking.tax_amount else 0,
            'total_amount': float(booking.total_amount),
            'currency': booking.currency,
            'cabin_supplement': float(booking.cabin_supplement) if booking.cabin_supplement else 0,
            'return_cabin_supplement': float(booking.return_cabin_supplement) if booking.return_cabin_supplement else 0,
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
