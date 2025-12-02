"""
Price Alerts API endpoints for managing ferry price notifications (saved routes).
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import List, Optional
from datetime import datetime, timedelta, timezone
import logging

from app.database import get_db
from app.models.price_alert import PriceAlert, PriceAlertStatusEnum
from app.models.user import User
from app.api.deps import get_optional_current_user, get_current_user
from pydantic import BaseModel, EmailStr, field_validator
from datetime import date

logger = logging.getLogger(__name__)

router = APIRouter()


# Pydantic Schemas
class PriceAlertCreate(BaseModel):
    """Schema for creating a new price alert (save route)."""
    email: Optional[EmailStr] = None  # Optional if authenticated
    departure_port: str
    arrival_port: str

    # Optional date range
    date_from: Optional[str] = None  # ISO date format
    date_to: Optional[str] = None

    # Price preferences
    target_price: Optional[float] = None  # Target price for notification
    notify_on_drop: bool = True
    notify_on_increase: bool = False
    notify_any_change: bool = False
    price_threshold_percent: float = 5.0  # Minimum % change to notify

    # Initial price (from current search)
    initial_price: Optional[float] = None

    # Expiration in days (null = never expires)
    expiration_days: Optional[int] = None

    @field_validator('date_from', 'date_to')
    @classmethod
    def validate_date_format(cls, v):
        if v is None:
            return v
        try:
            datetime.fromisoformat(v)
            return v
        except ValueError:
            raise ValueError('Date must be in ISO format (YYYY-MM-DD)')

    @field_validator('price_threshold_percent')
    @classmethod
    def validate_threshold(cls, v):
        if v < 0 or v > 100:
            raise ValueError('price_threshold_percent must be between 0 and 100')
        return v


class PriceAlertUpdate(BaseModel):
    """Schema for updating a price alert."""
    notify_on_drop: Optional[bool] = None
    notify_on_increase: Optional[bool] = None
    notify_any_change: Optional[bool] = None
    price_threshold_percent: Optional[float] = None
    target_price: Optional[float] = None
    status: Optional[str] = None  # active, paused, cancelled


class PriceAlertResponse(BaseModel):
    """Schema for price alert response."""
    id: int
    email: str
    departure_port: str
    arrival_port: str
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    initial_price: Optional[float] = None
    current_price: Optional[float] = None
    lowest_price: Optional[float] = None
    highest_price: Optional[float] = None
    target_price: Optional[float] = None
    notify_on_drop: bool
    notify_on_increase: bool
    notify_any_change: bool
    price_threshold_percent: float
    status: str
    last_checked_at: Optional[datetime] = None
    last_notified_at: Optional[datetime] = None
    notification_count: int
    expires_at: Optional[datetime] = None
    created_at: datetime

    # Computed fields
    price_change_percent: Optional[float] = None
    price_change_amount: Optional[float] = None

    @classmethod
    def from_orm(cls, obj: PriceAlert):
        # Calculate price change if we have both initial and current price
        price_change_percent = None
        price_change_amount = None
        if obj.initial_price and obj.current_price:
            price_change_amount = obj.current_price - obj.initial_price
            if obj.initial_price > 0:
                price_change_percent = (price_change_amount / obj.initial_price) * 100

        return cls(
            id=obj.id,
            email=obj.email,
            departure_port=obj.departure_port,
            arrival_port=obj.arrival_port,
            date_from=obj.date_from.isoformat() if obj.date_from else None,
            date_to=obj.date_to.isoformat() if obj.date_to else None,
            initial_price=obj.initial_price,
            current_price=obj.current_price,
            lowest_price=obj.lowest_price,
            highest_price=obj.highest_price,
            target_price=obj.target_price,
            notify_on_drop=obj.notify_on_drop,
            notify_on_increase=obj.notify_on_increase,
            notify_any_change=obj.notify_any_change,
            price_threshold_percent=obj.price_threshold_percent,
            status=obj.status,
            last_checked_at=obj.last_checked_at,
            last_notified_at=obj.last_notified_at,
            notification_count=obj.notification_count,
            expires_at=obj.expires_at,
            created_at=obj.created_at,
            price_change_percent=round(price_change_percent, 2) if price_change_percent else None,
            price_change_amount=round(price_change_amount, 2) if price_change_amount else None,
        )

    class Config:
        from_attributes = True


class SavedRoutesResponse(BaseModel):
    """Response for listing saved routes with pagination."""
    routes: List[PriceAlertResponse]
    total: int
    page: int
    per_page: int
    has_more: bool


@router.post("", response_model=PriceAlertResponse, status_code=status.HTTP_201_CREATED)
async def create_price_alert(
    alert_data: PriceAlertCreate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """
    Create a new price alert (save a route for price monitoring).

    - Authenticated users don't need to provide email
    - Guest users must provide email
    - Optionally set target price or percentage threshold
    """
    try:
        # Determine email to use
        email = alert_data.email
        if current_user:
            email = current_user.email
        elif not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email is required for guest users"
            )

        # Parse dates
        date_from = None
        date_to = None
        if alert_data.date_from:
            date_from = datetime.fromisoformat(alert_data.date_from).date()
        if alert_data.date_to:
            date_to = datetime.fromisoformat(alert_data.date_to).date()

        # Validate date range
        if date_from and date_to and date_to < date_from:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="date_to must be after date_from"
            )

        # Check for duplicate active alerts
        existing = db.query(PriceAlert).filter(
            PriceAlert.email == email,
            PriceAlert.departure_port == alert_data.departure_port.lower(),
            PriceAlert.arrival_port == alert_data.arrival_port.lower(),
            PriceAlert.status == PriceAlertStatusEnum.ACTIVE.value,
            # Allow same route with different date ranges
            or_(
                and_(PriceAlert.date_from == date_from, PriceAlert.date_to == date_to),
                and_(PriceAlert.date_from.is_(None), date_from is None)
            )
        ).first()

        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"You already have an active price alert for this route. Alert ID: {existing.id}"
            )

        # Calculate expiration
        expires_at = None
        if alert_data.expiration_days:
            expires_at = datetime.now(timezone.utc) + timedelta(days=alert_data.expiration_days)

        # Create new price alert
        new_alert = PriceAlert(
            user_id=current_user.id if current_user else None,
            email=email,
            departure_port=alert_data.departure_port.lower(),
            arrival_port=alert_data.arrival_port.lower(),
            date_from=date_from,
            date_to=date_to,
            initial_price=alert_data.initial_price,
            current_price=alert_data.initial_price,
            lowest_price=alert_data.initial_price,
            highest_price=alert_data.initial_price,
            target_price=alert_data.target_price,
            notify_on_drop=alert_data.notify_on_drop,
            notify_on_increase=alert_data.notify_on_increase,
            notify_any_change=alert_data.notify_any_change,
            price_threshold_percent=alert_data.price_threshold_percent,
            status=PriceAlertStatusEnum.ACTIVE.value,
            expires_at=expires_at,
        )

        db.add(new_alert)
        db.commit()
        db.refresh(new_alert)

        logger.info(f"Created price alert {new_alert.id} for {email}: {alert_data.departure_port} -> {alert_data.arrival_port}")

        return PriceAlertResponse.from_orm(new_alert)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating price alert: {str(e)}", exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create price alert: {str(e)}"
        )


@router.get("", response_model=SavedRoutesResponse)
async def list_price_alerts(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
    email: Optional[str] = Query(None, description="Filter by email (guest users)"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status"),
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(20, ge=1, le=100, description="Items per page")
):
    """
    List saved routes (price alerts).

    - Authenticated users see their own alerts
    - Guest users must provide email
    """
    # Build query
    query = db.query(PriceAlert)

    if current_user:
        query = query.filter(PriceAlert.user_id == current_user.id)
    elif email:
        query = query.filter(PriceAlert.email == email)
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Must be authenticated or provide email parameter"
        )

    # Filter by status - exclude cancelled by default
    if status_filter:
        query = query.filter(PriceAlert.status == status_filter)
    else:
        # By default, exclude cancelled alerts
        query = query.filter(PriceAlert.status != PriceAlertStatusEnum.CANCELLED.value)

    # Get total count
    total = query.count()

    # Pagination
    offset = (page - 1) * per_page
    alerts = query.order_by(PriceAlert.created_at.desc()).offset(offset).limit(per_page).all()

    return SavedRoutesResponse(
        routes=[PriceAlertResponse.from_orm(alert) for alert in alerts],
        total=total,
        page=page,
        per_page=per_page,
        has_more=offset + len(alerts) < total
    )


@router.get("/my-routes", response_model=SavedRoutesResponse)
async def get_my_saved_routes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    status_filter: Optional[str] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100)
):
    """
    Get authenticated user's saved routes.
    Convenience endpoint that doesn't require email parameter.
    """
    query = db.query(PriceAlert).filter(PriceAlert.user_id == current_user.id)

    # Filter by status - exclude cancelled by default
    if status_filter:
        query = query.filter(PriceAlert.status == status_filter)
    else:
        # By default, exclude cancelled alerts
        query = query.filter(PriceAlert.status != PriceAlertStatusEnum.CANCELLED.value)

    total = query.count()
    offset = (page - 1) * per_page
    alerts = query.order_by(PriceAlert.created_at.desc()).offset(offset).limit(per_page).all()

    return SavedRoutesResponse(
        routes=[PriceAlertResponse.from_orm(alert) for alert in alerts],
        total=total,
        page=page,
        per_page=per_page,
        has_more=offset + len(alerts) < total
    )


@router.get("/{alert_id}", response_model=PriceAlertResponse)
async def get_price_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """Get a specific price alert by ID."""
    alert = db.query(PriceAlert).filter(PriceAlert.id == alert_id).first()

    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Price alert not found"
        )

    # Check authorization
    if current_user:
        if alert.user_id and alert.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view this alert"
            )

    return PriceAlertResponse.from_orm(alert)


@router.patch("/{alert_id}", response_model=PriceAlertResponse)
async def update_price_alert(
    alert_id: int,
    update_data: PriceAlertUpdate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
    email: Optional[str] = Query(None, description="Email for guest users")
):
    """Update a price alert's settings."""
    alert = db.query(PriceAlert).filter(PriceAlert.id == alert_id).first()

    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Price alert not found"
        )

    # Check authorization
    authorized = False
    if current_user and alert.user_id == current_user.id:
        authorized = True
    elif email and alert.email == email:
        authorized = True

    if not authorized:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this alert"
        )

    # Update fields
    if update_data.notify_on_drop is not None:
        alert.notify_on_drop = update_data.notify_on_drop
    if update_data.notify_on_increase is not None:
        alert.notify_on_increase = update_data.notify_on_increase
    if update_data.notify_any_change is not None:
        alert.notify_any_change = update_data.notify_any_change
    if update_data.price_threshold_percent is not None:
        alert.price_threshold_percent = update_data.price_threshold_percent
    if update_data.target_price is not None:
        alert.target_price = update_data.target_price
    if update_data.status is not None:
        valid_statuses = ['active', 'paused', 'cancelled']
        if update_data.status not in valid_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status. Must be one of: {valid_statuses}"
            )
        alert.status = update_data.status

    db.commit()
    db.refresh(alert)

    logger.info(f"Updated price alert {alert_id}")

    return PriceAlertResponse.from_orm(alert)


@router.delete("/{alert_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_price_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
    email: Optional[str] = Query(None, description="Email for guest users")
):
    """Delete (cancel) a price alert."""
    alert = db.query(PriceAlert).filter(PriceAlert.id == alert_id).first()

    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Price alert not found"
        )

    # Check authorization
    authorized = False
    if current_user and alert.user_id == current_user.id:
        authorized = True
    elif email and alert.email == email:
        authorized = True

    if not authorized:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this alert"
        )

    # Mark as cancelled (soft delete for analytics)
    alert.status = PriceAlertStatusEnum.CANCELLED.value
    db.commit()

    logger.info(f"Cancelled price alert {alert_id}")

    return None


@router.post("/{alert_id}/pause", response_model=PriceAlertResponse)
async def pause_price_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Pause a price alert (stop notifications temporarily)."""
    alert = db.query(PriceAlert).filter(
        PriceAlert.id == alert_id,
        PriceAlert.user_id == current_user.id
    ).first()

    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Price alert not found"
        )

    alert.status = PriceAlertStatusEnum.PAUSED.value
    db.commit()
    db.refresh(alert)

    return PriceAlertResponse.from_orm(alert)


@router.post("/{alert_id}/resume", response_model=PriceAlertResponse)
async def resume_price_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Resume a paused price alert."""
    alert = db.query(PriceAlert).filter(
        PriceAlert.id == alert_id,
        PriceAlert.user_id == current_user.id
    ).first()

    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Price alert not found"
        )

    if alert.status != PriceAlertStatusEnum.PAUSED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only paused alerts can be resumed"
        )

    alert.status = PriceAlertStatusEnum.ACTIVE.value
    db.commit()
    db.refresh(alert)

    return PriceAlertResponse.from_orm(alert)


@router.get("/check/{departure_port}/{arrival_port}")
async def check_route_saved(
    departure_port: str,
    arrival_port: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
    email: Optional[str] = Query(None)
):
    """
    Check if a route is already saved (has an active price alert).
    Useful for UI to show "saved" state on search results.
    """
    if not current_user and not email:
        return {"is_saved": False, "alert_id": None}

    query = db.query(PriceAlert).filter(
        PriceAlert.departure_port == departure_port.lower(),
        PriceAlert.arrival_port == arrival_port.lower(),
        PriceAlert.status.in_([
            PriceAlertStatusEnum.ACTIVE.value,
            PriceAlertStatusEnum.PAUSED.value
        ])
    )

    if current_user:
        query = query.filter(PriceAlert.user_id == current_user.id)
    else:
        query = query.filter(PriceAlert.email == email)

    alert = query.first()

    return {
        "is_saved": alert is not None,
        "alert_id": alert.id if alert else None,
        "status": alert.status if alert else None
    }


@router.get("/stats/summary")
async def get_price_alert_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get summary statistics for user's price alerts."""
    base_query = db.query(PriceAlert).filter(PriceAlert.user_id == current_user.id)

    total = base_query.count()
    active = base_query.filter(PriceAlert.status == PriceAlertStatusEnum.ACTIVE.value).count()
    paused = base_query.filter(PriceAlert.status == PriceAlertStatusEnum.PAUSED.value).count()
    triggered = base_query.filter(PriceAlert.status == PriceAlertStatusEnum.TRIGGERED.value).count()

    # Get routes with price drops
    drops = base_query.filter(
        PriceAlert.current_price < PriceAlert.initial_price
    ).count()

    return {
        "total_alerts": total,
        "active_alerts": active,
        "paused_alerts": paused,
        "triggered_alerts": triggered,
        "routes_with_price_drops": drops,
    }
