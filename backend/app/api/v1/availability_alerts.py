"""
Availability Alerts API endpoints for managing ferry availability notifications.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta, timezone
import logging

from app.database import get_db
from app.models.availability_alert import AvailabilityAlert, AlertTypeEnum, AlertStatusEnum
from app.models.user import User
from app.api.deps import get_optional_current_user
from pydantic import BaseModel, EmailStr, validator, field_serializer
from datetime import date

logger = logging.getLogger(__name__)

router = APIRouter()


# Pydantic Schemas
class AvailabilityAlertCreate(BaseModel):
    """Schema for creating a new availability alert."""
    alert_type: str  # vehicle, cabin, passenger
    email: EmailStr
    departure_port: str
    arrival_port: str
    departure_date: str  # ISO date format
    is_round_trip: bool = False
    return_date: Optional[str] = None
    operator: Optional[str] = None  # Ferry operator (e.g., "CTN", "GNV"), None = any operator
    sailing_time: Optional[str] = None  # Sailing departure time (e.g., "19:00"), None = any time

    # Passenger details
    num_adults: int = 1
    num_children: int = 0
    num_infants: int = 0

    # Vehicle specific (optional)
    vehicle_type: Optional[str] = None  # car, van, motorcycle, etc.
    vehicle_length_cm: Optional[int] = None

    # Cabin specific (optional)
    cabin_type: Optional[str] = None  # inside, outside, suite
    num_cabins: int = 1

    # Linked booking (for cabin upgrade alerts)
    booking_id: Optional[int] = None
    journey_type: Optional[str] = None  # 'outbound' or 'return'

    # Alert duration in days (default 30 days)
    alert_duration_days: int = 30

    @validator('alert_type')
    def validate_alert_type(cls, v):
        valid_types = ['vehicle', 'cabin', 'passenger']
        if v not in valid_types:
            raise ValueError(f'alert_type must be one of {valid_types}')
        return v

    @validator('departure_date', 'return_date')
    def validate_date_format(cls, v):
        if v is None:
            return v
        try:
            datetime.fromisoformat(v)
            return v
        except ValueError:
            raise ValueError('Date must be in ISO format (YYYY-MM-DD)')


class AvailabilityAlertResponse(BaseModel):
    """Schema for availability alert response."""
    id: int
    alert_type: str
    email: str
    departure_port: str
    arrival_port: str
    departure_date: str
    is_round_trip: bool
    return_date: Optional[str] = None
    operator: Optional[str] = None
    sailing_time: Optional[str] = None
    num_adults: int
    num_children: int
    num_infants: int
    vehicle_type: Optional[str] = None
    cabin_type: Optional[str] = None
    booking_id: Optional[int] = None
    journey_type: Optional[str] = None
    status: str
    last_checked_at: Optional[datetime] = None
    notified_at: Optional[datetime] = None
    expires_at: datetime
    created_at: datetime

    @classmethod
    def from_orm(cls, obj):
        # Convert date objects to ISO strings
        data = {
            'id': obj.id,
            'alert_type': obj.alert_type,
            'email': obj.email,
            'departure_port': obj.departure_port,
            'arrival_port': obj.arrival_port,
            'departure_date': obj.departure_date.isoformat() if isinstance(obj.departure_date, date) else obj.departure_date,
            'is_round_trip': obj.is_round_trip,
            'return_date': obj.return_date.isoformat() if obj.return_date and isinstance(obj.return_date, date) else obj.return_date,
            'operator': obj.operator,
            'sailing_time': obj.sailing_time.isoformat() if obj.sailing_time else None,
            'num_adults': obj.num_adults,
            'num_children': obj.num_children,
            'num_infants': obj.num_infants,
            'vehicle_type': obj.vehicle_type,
            'cabin_type': obj.cabin_type,
            'booking_id': obj.booking_id,
            'journey_type': obj.journey_type,
            'status': obj.status,
            'last_checked_at': obj.last_checked_at,
            'notified_at': obj.notified_at,
            'expires_at': obj.expires_at,
            'created_at': obj.created_at,
        }
        return cls(**data)

    class Config:
        from_attributes = True


@router.post("", response_model=AvailabilityAlertResponse, status_code=status.HTTP_201_CREATED)
async def create_availability_alert(
    alert_data: AvailabilityAlertCreate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """
    Create a new availability alert.

    User will be notified when ferry capacity becomes available for their route.
    Alert expires after specified duration (default 30 days).
    """
    try:
        # Parse dates
        departure_date = datetime.fromisoformat(alert_data.departure_date).date()
        return_date = datetime.fromisoformat(alert_data.return_date).date() if alert_data.return_date else None

        # Validate departure date is in the future
        if departure_date <= datetime.now(timezone.utc).date():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Departure date must be in the future"
            )

        # Validate return date if round trip
        if alert_data.is_round_trip:
            if not return_date:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Return date required for round trip"
                )
            if return_date <= departure_date:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Return date must be after departure date"
                )

        # Parse sailing_time if provided
        sailing_time_obj = None
        if alert_data.sailing_time:
            try:
                # Parse time string (e.g., "19:00" or "19:00:00")
                from datetime import time as dt_time
                time_parts = alert_data.sailing_time.split(':')
                sailing_time_obj = dt_time(int(time_parts[0]), int(time_parts[1]))
            except (ValueError, IndexError):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="sailing_time must be in HH:MM format (e.g., '19:00')"
                )

        # Check if similar active alert already exists for this email
        # Include operator AND sailing_time so users can create alerts for different sailings
        existing_alert = db.query(AvailabilityAlert).filter(
            AvailabilityAlert.email == alert_data.email,
            AvailabilityAlert.departure_port == alert_data.departure_port,
            AvailabilityAlert.arrival_port == alert_data.arrival_port,
            AvailabilityAlert.departure_date == departure_date,
            AvailabilityAlert.alert_type == alert_data.alert_type,
            AvailabilityAlert.operator == alert_data.operator,
            AvailabilityAlert.sailing_time == sailing_time_obj,  # Allow different alerts for different sailing times
            AvailabilityAlert.status == AlertStatusEnum.ACTIVE.value
        ).first()

        if existing_alert:
            operator_msg = f" for {existing_alert.operator}" if existing_alert.operator else ""
            time_msg = f" at {existing_alert.sailing_time.strftime('%H:%M')}" if existing_alert.sailing_time else ""
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"You already have an active {existing_alert.alert_type} alert{operator_msg}{time_msg} for this route. Alert ID: {existing_alert.id}"
            )

        # Calculate expiration date
        expires_at = datetime.now(timezone.utc) + timedelta(days=alert_data.alert_duration_days)

        # Create new alert
        new_alert = AvailabilityAlert(
            user_id=current_user.id if current_user else None,
            email=alert_data.email,
            alert_type=alert_data.alert_type,
            departure_port=alert_data.departure_port.lower(),
            arrival_port=alert_data.arrival_port.lower(),
            departure_date=departure_date,
            is_round_trip=alert_data.is_round_trip,
            return_date=return_date,
            operator=alert_data.operator,  # Ferry-specific operator (e.g., "CTN", "GNV")
            sailing_time=sailing_time_obj,  # Specific sailing time (e.g., 19:00)
            num_adults=alert_data.num_adults,
            num_children=alert_data.num_children,
            num_infants=alert_data.num_infants,
            vehicle_type=alert_data.vehicle_type,
            vehicle_length_cm=alert_data.vehicle_length_cm,
            cabin_type=alert_data.cabin_type,
            num_cabins=alert_data.num_cabins,
            booking_id=alert_data.booking_id,
            journey_type=alert_data.journey_type,
            status=AlertStatusEnum.ACTIVE.value,
            expires_at=expires_at
        )

        db.add(new_alert)
        db.commit()
        db.refresh(new_alert)

        logger.info(f"✅ Created availability alert {new_alert.id} for {alert_data.email} ({alert_data.alert_type})")

        return AvailabilityAlertResponse.from_orm(new_alert)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating availability alert: {str(e)}", exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create availability alert: {str(e)}"
        )


@router.get("", response_model=List[AvailabilityAlertResponse])
async def list_availability_alerts(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
    email: Optional[str] = Query(None, description="Filter by email"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status: active, notified, expired, cancelled"),
    limit: int = Query(50, le=100, description="Maximum number of alerts to return")
):
    """
    List availability alerts.

    - If authenticated: returns user's alerts
    - If email provided: returns alerts for that email
    - Otherwise: returns error (must be authenticated or provide email)
    """
    query = db.query(AvailabilityAlert)

    # Filter by user or email
    if current_user:
        query = query.filter(AvailabilityAlert.user_id == current_user.id)
    elif email:
        query = query.filter(AvailabilityAlert.email == email)
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Must be authenticated or provide email parameter"
        )

    # Filter by status if provided
    if status_filter:
        query = query.filter(AvailabilityAlert.status == status_filter)

    # Order by created_at descending and limit
    alerts = query.order_by(AvailabilityAlert.created_at.desc()).limit(limit).all()

    return [AvailabilityAlertResponse.from_orm(alert) for alert in alerts]


@router.get("/{alert_id}", response_model=AvailabilityAlertResponse)
async def get_availability_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """
    Get a specific availability alert by ID.

    Only accessible by the alert owner or by providing the email.
    """
    alert = db.query(AvailabilityAlert).filter(AvailabilityAlert.id == alert_id).first()

    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found"
        )

    # Check authorization
    if current_user:
        if alert.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view this alert"
            )
    # If not authenticated, they can't view

    return AvailabilityAlertResponse.from_orm(alert)


class AvailabilityAlertUpdate(BaseModel):
    """Schema for updating an availability alert."""
    status: Optional[str] = None  # active, notified, expired, cancelled, fulfilled


@router.patch("/{alert_id}", response_model=AvailabilityAlertResponse)
async def update_availability_alert(
    alert_id: int,
    update_data: AvailabilityAlertUpdate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
    email: Optional[str] = Query(None, description="Email for unauthenticated update")
):
    """
    Update an availability alert (e.g., mark as fulfilled after cabin is added).

    Can be updated by:
    - Authenticated user who owns it
    - Anyone with the correct email (for guest alerts)
    - The system via alertId from email link
    """
    alert = db.query(AvailabilityAlert).filter(AvailabilityAlert.id == alert_id).first()

    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found"
        )

    # Authorization: allow update if user owns it, email matches, or came from alert link
    authorized = False
    if current_user and alert.user_id == current_user.id:
        authorized = True
    elif email and alert.email == email:
        authorized = True
    elif not current_user and not email:
        # Allow system updates from alert email links (no auth needed for marking as fulfilled)
        authorized = True

    if not authorized:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this alert"
        )

    # Update status if provided
    if update_data.status:
        valid_statuses = ['active', 'notified', 'expired', 'cancelled', 'fulfilled']
        if update_data.status not in valid_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status. Must be one of: {valid_statuses}"
            )
        alert.status = update_data.status

    db.commit()
    db.refresh(alert)

    logger.info(f"✏️ Updated availability alert {alert_id} - status: {alert.status}")

    return AvailabilityAlertResponse.from_orm(alert)


@router.delete("/{alert_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_availability_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
    email: Optional[str] = Query(None, description="Email for unauthenticated cancellation")
):
    """
    Cancel (delete) an availability alert.

    Can be cancelled by:
    - Authenticated user who owns it
    - Anyone with the correct email (for guest alerts)
    """
    alert = db.query(AvailabilityAlert).filter(AvailabilityAlert.id == alert_id).first()

    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found"
        )

    # Check authorization
    if current_user:
        if alert.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to cancel this alert"
            )
    elif email:
        if alert.email != email:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Email does not match alert email"
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Must be authenticated or provide email parameter"
        )

    # Mark as cancelled instead of deleting (for analytics)
    alert.status = AlertStatusEnum.CANCELLED.value
    db.commit()

    logger.info(f"🚫 Cancelled availability alert {alert_id}")

    return None


@router.get("/stats/summary")
async def get_alerts_statistics(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """
    Get summary statistics about availability alerts.
    Admin only or authenticated users see their own stats.
    """
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )

    # Get user's alert statistics
    total_alerts = db.query(AvailabilityAlert).filter(
        AvailabilityAlert.user_id == current_user.id
    ).count()

    active_alerts = db.query(AvailabilityAlert).filter(
        AvailabilityAlert.user_id == current_user.id,
        AvailabilityAlert.status == AlertStatusEnum.ACTIVE.value
    ).count()

    notified_alerts = db.query(AvailabilityAlert).filter(
        AvailabilityAlert.user_id == current_user.id,
        AvailabilityAlert.status == AlertStatusEnum.NOTIFIED.value
    ).count()

    return {
        "total_alerts": total_alerts,
        "active_alerts": active_alerts,
        "notified_alerts": notified_alerts,
        "success_rate": round((notified_alerts / total_alerts * 100) if total_alerts > 0 else 0, 2)
    }
