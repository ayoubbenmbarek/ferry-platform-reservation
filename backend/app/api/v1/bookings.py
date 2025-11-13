"""
Booking API endpoints for creating, managing, and retrieving ferry bookings.
"""

import uuid
from typing import List, Optional
from datetime import datetime

try:
    from fastapi import APIRouter, Depends, HTTPException, status, Query
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
    from app.models.booking import Booking, BookingPassenger, BookingVehicle
    from app.models.ferry import Schedule
    from app.schemas.booking import (
        BookingCreate, BookingResponse, BookingUpdate, BookingCancellation,
        BookingListResponse, BookingSearchParams, BookingStatistics,
        BookingModification, BookingConfirmation
    )
    from app.services.ferry_service import FerryService
    from app.services.ferry_integrations.base import FerryAPIError
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
        
        # For now, use placeholder pricing - in real implementation,
        # this would be calculated based on ferry operator rates
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
        
        # Add cabin supplement if selected
        cabin_supplement = 0.0
        if booking_data.cabin_selection:
            cabin_supplement = booking_data.cabin_selection.supplement_price or 0.0
            subtotal += cabin_supplement
        
        # Calculate tax (10% for example)
        tax_amount = subtotal * 0.10
        total_amount = subtotal + tax_amount
        
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
            total_passengers=total_passengers,
            total_vehicles=total_vehicles,
            subtotal=subtotal,
            tax_amount=tax_amount,
            total_amount=total_amount,
            currency="EUR",
            cabin_supplement=cabin_supplement,
            special_requests=booking_data.special_requests,
            status="pending"
        )
        
        db.add(db_booking)
        db.flush()  # Get the booking ID
        
        # Add passengers
        for passenger_data in booking_data.passengers:
            db_passenger = BookingPassenger(
                booking_id=db_booking.id,
                passenger_type=passenger_data.type,
                first_name=passenger_data.first_name,
                last_name=passenger_data.last_name,
                date_of_birth=passenger_data.date_of_birth,
                nationality=passenger_data.nationality,
                passport_number=passenger_data.passport_number,
                base_price=base_adult_price if passenger_data.type == "adult" else 
                          (base_child_price if passenger_data.type == "child" else 0.0),
                final_price=base_adult_price if passenger_data.type == "adult" else 
                           (base_child_price if passenger_data.type == "child" else 0.0),
                special_needs=passenger_data.special_needs
            )
            db.add(db_passenger)
        
        # Add vehicles if any
        if booking_data.vehicles:
            for vehicle_data in booking_data.vehicles:
                db_vehicle = BookingVehicle(
                    booking_id=db_booking.id,
                    vehicle_type=vehicle_data.type,
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
        
        db.commit()
        db.refresh(db_booking)
        
        # Create booking with ferry operator
        try:
            operator_confirmation = await ferry_service.create_booking(
                operator=booking_data.operator,
                sailing_id=booking_data.sailing_id,
                passengers=[p.dict() for p in booking_data.passengers],
                vehicles=[v.dict() for v in booking_data.vehicles] if booking_data.vehicles else None,
                cabin_selection=booking_data.cabin_selection.dict() if booking_data.cabin_selection else None,
                contact_info=booking_data.contact_info.dict(),
                special_requests=booking_data.special_requests
            )
            
            # Update booking with operator reference
            db_booking.operator_booking_reference = operator_confirmation.operator_reference
            db_booking.status = "confirmed"
            db.commit()
            
        except FerryAPIError as e:
            # If operator booking fails, mark as pending for manual processing
            db_booking.status = "pending"
            db.commit()
        
        return BookingResponse.from_orm(db_booking)
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
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
            query = query.filter(Booking.status == status_filter)
        
        if operator:
            query = query.filter(Booking.operator == operator)
        
        if departure_date_from:
            query = query.filter(Booking.departure_time >= departure_date_from)
        
        if departure_date_to:
            query = query.filter(Booking.departure_time <= departure_date_to)
        
        # Get total count
        total_count = query.count()
        
        # Apply pagination
        bookings = query.offset(common_params.offset).limit(common_params.page_size).all()
        
        # Calculate pagination info
        total_pages = (total_count + common_params.page_size - 1) // common_params.page_size
        
        return BookingListResponse(
            bookings=[BookingResponse.from_orm(booking) for booking in bookings],
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
        
        return BookingResponse.from_orm(booking)
        
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
        
        return BookingResponse.from_orm(booking)
        
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
    
    Cancels the booking with the ferry operator and updates the status.
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
        
        # Update booking status
        booking.status = "cancelled"
        booking.cancellation_reason = cancellation_data.reason
        booking.cancelled_at = datetime.utcnow()
        booking.updated_at = datetime.utcnow()
        
        db.commit()
        
        return {"message": "Booking cancelled successfully", "booking_id": booking_id}
        
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
        
        return BookingResponse.from_orm(booking)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to get booking: {str(e)}"
        ) 