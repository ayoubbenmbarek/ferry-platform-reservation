"""
Booking modification API endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional

from app.database import get_db
from app.api.deps import get_current_active_user, get_optional_current_user, validate_booking_access
from app.models.user import User
from app.models.booking import Booking, BookingPassenger, BookingVehicle
from app.schemas.modification import (
    ModificationEligibilityResponse,
    QuickUpdateRequest,
    QuickUpdateResponse,
    ModificationRequest,
    ModificationQuoteResponse,
    ConfirmModificationResponse,
    ModificationHistoryResponse,
)
from app.services.modification_rules import ModificationRules

router = APIRouter()


@router.get("/{booking_id}/can-modify", response_model=ModificationEligibilityResponse)
async def check_modification_eligibility(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """
    Check if a booking can be modified and what type of modifications are allowed.

    Returns:
        - can_modify: Boolean indicating if booking can be modified
        - modification_type_allowed: "none", "quick", or "full"
        - restrictions: List of restriction messages
        - message: Human-readable status message
    """
    try:
        # Get booking
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

        # Check modification eligibility
        can_modify, modification_type, message = ModificationRules.can_modify(booking)

        # Get restrictions
        restrictions = ModificationRules.get_restrictions(booking)

        return ModificationEligibilityResponse(
            can_modify=can_modify,
            modification_type_allowed=modification_type,
            restrictions=restrictions,
            message=message
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check modification eligibility: {str(e)}"
        )


@router.patch("/{booking_id}/quick-update", response_model=QuickUpdateResponse)
async def quick_update_booking(
    booking_id: int,
    update_request: QuickUpdateRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """
    Quick update for passenger names and vehicle registration.

    This endpoint allows simple changes without price recalculation or fees.
    Ideal for fixing typos or updating registration numbers.
    """
    try:
        # Get booking
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

        # Check if booking can be modified
        can_modify, modification_type, message = ModificationRules.can_modify(booking)

        if not can_modify:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=message
            )

        # Process passenger updates
        if update_request.passenger_updates:
            for passenger_update in update_request.passenger_updates:
                passenger = db.query(BookingPassenger).filter(
                    BookingPassenger.id == passenger_update.passenger_id,
                    BookingPassenger.booking_id == booking_id
                ).first()

                if not passenger:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Passenger {passenger_update.passenger_id} not found in this booking"
                    )

                # Update allowed fields
                if passenger_update.first_name is not None:
                    passenger.first_name = passenger_update.first_name
                if passenger_update.last_name is not None:
                    passenger.last_name = passenger_update.last_name
                if passenger_update.date_of_birth is not None:
                    passenger.date_of_birth = passenger_update.date_of_birth
                if passenger_update.nationality is not None:
                    passenger.nationality = passenger_update.nationality
                if passenger_update.passport_number is not None:
                    passenger.passport_number = passenger_update.passport_number

        # Process vehicle updates
        if update_request.vehicle_updates:
            for vehicle_update in update_request.vehicle_updates:
                vehicle = db.query(BookingVehicle).filter(
                    BookingVehicle.id == vehicle_update.vehicle_id,
                    BookingVehicle.booking_id == booking_id
                ).first()

                if not vehicle:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Vehicle {vehicle_update.vehicle_id} not found in this booking"
                    )

                # Update allowed fields
                if vehicle_update.registration is not None:
                    vehicle.license_plate = vehicle_update.registration
                if vehicle_update.make is not None:
                    vehicle.make = vehicle_update.make
                if vehicle_update.model is not None:
                    vehicle.model = vehicle_update.model

        # Update booking metadata
        booking.updated_at = datetime.utcnow()

        # Commit changes
        db.commit()
        db.refresh(booking)

        return QuickUpdateResponse(
            success=True,
            booking_reference=booking.booking_reference,
            message="Booking updated successfully. No additional charges apply.",
            updated_at=booking.updated_at
        )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update booking: {str(e)}"
        )


@router.get("/{booking_id}/modifications", response_model=ModificationHistoryResponse)
async def get_modification_history(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """
    Get modification history for a booking.

    Returns all modifications made to this booking, including:
    - What was changed
    - When it was changed
    - Financial impact
    - Who made the change
    """
    try:
        # Get booking
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

        # Get modifications from booking relationship
        modifications = booking.modifications if hasattr(booking, 'modifications') else []

        # Format modifications for response
        modification_items = []
        for mod in modifications:
            import json
            modification_items.append({
                "id": mod.id,
                "created_at": mod.created_at,
                "status": mod.status,
                "changes": json.loads(mod.changes) if isinstance(mod.changes, str) else mod.changes,
                "total_charged": mod.total_charged,
                "modified_by": "admin" if mod.modified_by_admin else "customer"
            })

        # Calculate remaining modifications
        remaining = ModificationRules.MAX_MODIFICATIONS - booking.modification_count

        return ModificationHistoryResponse(
            modifications=modification_items,
            total_modifications=booking.modification_count,
            remaining_modifications=max(0, remaining)
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get modification history: {str(e)}"
        )


@router.post("/{booking_id}/modifications/quote", response_model=ModificationQuoteResponse)
async def request_modification_quote(
    booking_id: int,
    modification_request: ModificationRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """
    Request a modification quote.

    This endpoint:
    1. Validates the booking can be modified
    2. Checks availability with ferry operator APIs
    3. Calculates new pricing
    4. Returns a quote that expires in 1 hour

    The quote must be confirmed via the confirm endpoint before it expires.
    """
    try:
        # Get booking
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

        # Create modification service
        from app.services.booking_modification_service import BookingModificationService
        modification_service = BookingModificationService()

        # Create quote
        quote = await modification_service.create_modification_quote(
            booking_id,
            modification_request,
            db
        )

        # Parse breakdown
        import json
        breakdown_data = json.loads(quote.price_breakdown) if isinstance(quote.price_breakdown, str) else quote.price_breakdown

        from app.schemas.modification import PriceBreakdown
        breakdown = PriceBreakdown(
            passengers=breakdown_data.get("passengers", 0),
            vehicles=breakdown_data.get("vehicles", 0),
            cabins=breakdown_data.get("cabins", 0),
            meals=breakdown_data.get("meals", 0)
        )

        return ModificationQuoteResponse(
            quote_id=quote.id,
            expires_at=quote.expires_at,
            original_total=quote.original_total,
            new_subtotal=quote.new_total,
            modification_fee=quote.modification_fee,
            price_difference=quote.price_difference,
            total_to_pay=quote.total_to_pay,
            currency="EUR",
            breakdown=breakdown,
            availability_confirmed=quote.availability_confirmed,
            message="Modification quote created successfully. Please confirm within 1 hour."
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create modification quote: {str(e)}"
        )


@router.post("/{booking_id}/modifications/{quote_id}/confirm", response_model=ConfirmModificationResponse)
async def confirm_modification_quote(
    booking_id: int,
    quote_id: int,
    payment_method_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """
    Confirm a modification quote and apply changes.

    This endpoint:
    1. Validates the quote is still valid (not expired)
    2. Processes payment if price increased
    3. Processes refund if price decreased
    4. Updates the operator booking
    5. Applies modifications to the booking
    6. Sends confirmation email

    If payment is required and payment_method_id is provided,
    payment will be processed automatically.
    """
    try:
        # Get booking
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

        # Create modification service
        from app.services.booking_modification_service import BookingModificationService
        modification_service = BookingModificationService()

        # Confirm modification
        modification = await modification_service.confirm_modification(
            booking_id,
            quote_id,
            payment_method_id,
            db,
            current_user_id=current_user.id if current_user else None,
            is_admin=current_user.is_admin if current_user else False
        )

        # Check if payment is required
        payment_required = float(modification.total_charged) > 0 and modification.payment_status in ["pending", "pending_payment"]

        # Build response
        response = ConfirmModificationResponse(
            success=True,
            modification_id=modification.id,
            booking_reference=booking.booking_reference,
            payment_required=payment_required,
            message="Modification confirmed successfully" if not payment_required else "Payment required to complete modification"
        )

        # Add payment intent if payment needed
        if payment_required and modification.payment_intent_id:
            from app.schemas.modification import ModificationPaymentIntent
            response.payment_intent = ModificationPaymentIntent(
                id=modification.payment_intent_id,
                client_secret=f"{modification.payment_intent_id}_secret",  # TODO: Get real secret from Stripe
                amount=int(float(modification.total_charged) * 100),  # Convert to cents
                currency="eur"
            )

        return response

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to confirm modification: {str(e)}"
        )
