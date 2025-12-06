"""
Cabin API endpoints for ferry accommodations.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
import logging

from app.database import get_db
from app.models.ferry import Cabin, CabinTypeEnum, BedTypeEnum
from app.models.booking import Booking, BookingCabin, JourneyTypeEnum
from app.models.availability_alert import AvailabilityAlert
from app.schemas.cabin import CabinCreate, CabinUpdate, CabinResponse
from app.api.deps import get_admin_user, get_optional_current_user
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter()


class AddCabinRequest(BaseModel):
    """Request to add cabin to booking."""
    cabin_id: int
    quantity: int = 1
    journey_type: str = "outbound"  # "outbound" or "return"
    alert_id: Optional[int] = None


class AddCabinResponse(BaseModel):
    """Response after adding cabin to booking."""
    success: bool
    message: str
    booking_cabin_id: Optional[int] = None
    total_price: float = 0


@router.get("", response_model=List[CabinResponse])
async def list_cabins(
    db: Session = Depends(get_db),
    cabin_type: Optional[str] = Query(None, description="Filter by cabin type"),
    operator: Optional[str] = Query(None, description="Filter by operator"),
    min_occupancy: Optional[int] = Query(None, description="Minimum occupancy"),
    max_price: Optional[float] = Query(None, description="Maximum price"),
    is_available: Optional[bool] = Query(True, description="Show only available cabins"),
):
    """
    List all available cabins with optional filters.
    """
    query = db.query(Cabin)

    if is_available is not None:
        query = query.filter(Cabin.is_available == is_available)

    if cabin_type:
        try:
            cabin_type_enum = CabinTypeEnum[cabin_type.upper()]
            query = query.filter(Cabin.cabin_type == cabin_type_enum)
        except KeyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid cabin type. Valid types: {[e.value for e in CabinTypeEnum]}"
            )

    if operator:
        query = query.filter(Cabin.operator == operator)

    if min_occupancy:
        query = query.filter(Cabin.max_occupancy >= min_occupancy)

    if max_price:
        query = query.filter(Cabin.base_price <= max_price)

    cabins = query.order_by(Cabin.base_price).all()

    # Convert enum values to strings
    result = []
    for cabin in cabins:
        cabin_dict = {
            "id": cabin.id,
            "name": cabin.name,
            "description": cabin.description,
            "cabin_type": cabin.cabin_type.value if hasattr(cabin.cabin_type, 'value') else str(cabin.cabin_type),
            "bed_type": cabin.bed_type.value if hasattr(cabin.bed_type, 'value') else str(cabin.bed_type),
            "max_occupancy": cabin.max_occupancy,
            "has_private_bathroom": cabin.has_private_bathroom,
            "has_tv": cabin.has_tv,
            "has_minibar": cabin.has_minibar,
            "has_air_conditioning": cabin.has_air_conditioning,
            "has_wifi": cabin.has_wifi,
            "is_accessible": cabin.is_accessible,
            "base_price": float(cabin.base_price),
            "currency": cabin.currency,
            "cabin_number": cabin.cabin_number,
            "is_available": cabin.is_available,
            "operator": cabin.operator,
            "created_at": cabin.created_at,
        }
        result.append(cabin_dict)

    return result


@router.get("/{cabin_id}", response_model=CabinResponse)
async def get_cabin(
    cabin_id: int,
    db: Session = Depends(get_db),
):
    """
    Get cabin details by ID.
    """
    cabin = db.query(Cabin).filter(Cabin.id == cabin_id).first()
    if not cabin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cabin not found"
        )

    return {
        "id": cabin.id,
        "name": cabin.name,
        "description": cabin.description,
        "cabin_type": cabin.cabin_type.value if hasattr(cabin.cabin_type, 'value') else str(cabin.cabin_type),
        "bed_type": cabin.bed_type.value if hasattr(cabin.bed_type, 'value') else str(cabin.bed_type),
        "max_occupancy": cabin.max_occupancy,
        "has_private_bathroom": cabin.has_private_bathroom,
        "has_tv": cabin.has_tv,
        "has_minibar": cabin.has_minibar,
        "has_air_conditioning": cabin.has_air_conditioning,
        "has_wifi": cabin.has_wifi,
        "is_accessible": cabin.is_accessible,
        "base_price": float(cabin.base_price),
        "currency": cabin.currency,
        "cabin_number": cabin.cabin_number,
        "is_available": cabin.is_available,
        "operator": cabin.operator,
        "created_at": cabin.created_at,
    }


@router.post("", response_model=CabinResponse, status_code=status.HTTP_201_CREATED)
async def create_cabin(
    cabin_data: CabinCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """
    Create a new cabin (admin only).
    """
    try:
        cabin_type_enum = CabinTypeEnum[cabin_data.cabin_type.upper()]
        bed_type_enum = BedTypeEnum[cabin_data.bed_type.upper()]
    except KeyError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid enum value: {str(e)}"
        )

    cabin = Cabin(
        name=cabin_data.name,
        description=cabin_data.description,
        cabin_number=cabin_data.cabin_number,
        cabin_type=cabin_type_enum,
        bed_type=bed_type_enum,
        max_occupancy=cabin_data.max_occupancy,
        has_private_bathroom=cabin_data.has_private_bathroom,
        has_tv=cabin_data.has_tv,
        has_minibar=cabin_data.has_minibar,
        has_air_conditioning=cabin_data.has_air_conditioning,
        has_wifi=cabin_data.has_wifi,
        is_accessible=cabin_data.is_accessible,
        base_price=cabin_data.base_price,
        currency=cabin_data.currency,
        operator=cabin_data.operator,
        vessel_id=cabin_data.vessel_id,
    )

    db.add(cabin)
    db.commit()
    db.refresh(cabin)

    return cabin


@router.patch("/{cabin_id}", response_model=CabinResponse)
async def update_cabin(
    cabin_id: int,
    cabin_data: CabinUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """
    Update cabin details (admin only).
    """
    cabin = db.query(Cabin).filter(Cabin.id == cabin_id).first()
    if not cabin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cabin not found"
        )

    update_data = cabin_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(cabin, field, value)

    db.commit()
    db.refresh(cabin)

    return cabin


@router.delete("/{cabin_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_cabin(
    cabin_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """
    Delete a cabin (admin only).
    """
    cabin = db.query(Cabin).filter(Cabin.id == cabin_id).first()
    if not cabin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cabin not found"
        )

    db.delete(cabin)
    db.commit()

    return None


@router.post("/booking/{booking_id}/add", response_model=AddCabinResponse)
async def add_cabin_to_booking(
    booking_id: int,
    request: AddCabinRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """
    Add a cabin to an existing booking and marks alert as fulfilled.
    Email confirmation is handled by the existing bookings endpoint.
    """
    # Get booking
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found"
        )

    # Check if the ferry has already departed
    journey_type = request.journey_type
    if journey_type == "return" and booking.return_departure_time:
        departure_time = booking.return_departure_time
    else:
        departure_time = booking.departure_time

    if departure_time:
        # Make both datetimes timezone-naive for consistent comparison
        now = datetime.utcnow()
        if hasattr(departure_time, 'tzinfo') and departure_time.tzinfo is not None:
            departure_time_naive = departure_time.replace(tzinfo=None)
        else:
            departure_time_naive = departure_time

        if departure_time_naive < now:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot add cabin to a booking for a ferry that has already departed"
            )

    # Get cabin
    cabin = db.query(Cabin).filter(Cabin.id == request.cabin_id).first()
    if not cabin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cabin not found"
        )

    # Determine journey type
    journey_type_enum = JourneyTypeEnum.RETURN if request.journey_type == "return" else JourneyTypeEnum.OUTBOUND

    # Calculate price
    unit_price = float(cabin.base_price)
    total_price = unit_price * request.quantity

    # Create booking cabin record
    booking_cabin = BookingCabin(
        booking_id=booking_id,
        cabin_id=request.cabin_id,
        journey_type=journey_type_enum,
        quantity=request.quantity,
        unit_price=unit_price,
        total_price=total_price,
        is_paid=True,  # Assume paid since this comes after payment
        created_at=datetime.utcnow()
    )
    db.add(booking_cabin)

    # Update booking total
    booking.total_amount = float(booking.total_amount or 0) + total_price

    # Mark alert as fulfilled if provided
    if request.alert_id:
        alert = db.query(AvailabilityAlert).filter(AvailabilityAlert.id == request.alert_id).first()
        if alert:
            alert.status = "fulfilled"
            alert.notified_at = datetime.utcnow()
            logger.info(f"Marked alert {request.alert_id} as fulfilled")

    db.commit()
    db.refresh(booking_cabin)

    logger.info(f"Added cabin {request.cabin_id} to booking {booking_id} (alert: {request.alert_id})")

    return AddCabinResponse(
        success=True,
        message="Cabin added to booking successfully",
        booking_cabin_id=booking_cabin.id,
        total_price=total_price
    )
