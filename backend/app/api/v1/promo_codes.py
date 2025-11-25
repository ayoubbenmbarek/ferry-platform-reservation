"""
Promo code API endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import Optional

from app.api.deps import get_db, get_admin_user, get_optional_current_user
from app.models.user import User
from app.schemas.promo_code import (
    PromoCodeCreate, PromoCodeUpdate, PromoCodeResponse,
    PromoCodeValidateRequest, PromoCodeValidateResponse,
    PromoCodeListResponse, PromoCodeStatsResponse
)
from app.services.promo_code_service import PromoCodeService, PromoCodeError

router = APIRouter(prefix="/promo-codes", tags=["promo-codes"])


# User endpoints
@router.post("/validate", response_model=PromoCodeValidateResponse)
async def validate_promo_code(
    code: str,
    booking_amount: float,
    email: str,
    operator: Optional[str] = None,
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """
    Validate a promo code before applying it.
    Returns discount details if valid.
    """
    service = PromoCodeService(db)

    # Get IP address from request
    ip_address = None
    if request:
        ip_address = request.headers.get("X-Forwarded-For", request.client.host)
        if ip_address and "," in ip_address:
            ip_address = ip_address.split(",")[0].strip()

    # Get device fingerprint from header (set by frontend)
    device_fingerprint = None
    if request:
        device_fingerprint = request.headers.get("X-Device-Fingerprint")

    validate_request = PromoCodeValidateRequest(
        code=code,
        booking_amount=booking_amount,
        operator=operator,
        email=email,
        user_id=current_user.id if current_user else None,
        ip_address=ip_address,
        device_fingerprint=device_fingerprint
    )

    return service.validate_promo_code(validate_request)


# Admin endpoints
@router.post("", response_model=PromoCodeResponse, status_code=status.HTTP_201_CREATED)
async def create_promo_code(
    promo_data: PromoCodeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """
    Create a new promo code (admin only).
    """
    service = PromoCodeService(db)

    try:
        promo = service.create_promo_code(promo_data, created_by=current_user.id)
        return PromoCodeResponse(
            id=promo.id,
            code=promo.code,
            description=promo.description,
            discount_type=promo.discount_type.value,
            discount_value=float(promo.discount_value),
            max_uses=promo.max_uses,
            max_uses_per_user=promo.max_uses_per_user,
            current_uses=promo.current_uses,
            valid_from=promo.valid_from,
            valid_until=promo.valid_until,
            minimum_amount=float(promo.minimum_amount) if promo.minimum_amount else None,
            maximum_discount=float(promo.maximum_discount) if promo.maximum_discount else None,
            first_booking_only=promo.first_booking_only,
            is_active=promo.is_active,
            effective_status=promo.effective_status,
            created_at=promo.created_at
        )
    except PromoCodeError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("", response_model=PromoCodeListResponse)
async def list_promo_codes(
    page: int = 1,
    page_size: int = 20,
    active_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """
    List all promo codes (admin only).
    """
    service = PromoCodeService(db)
    promos, total = service.list_promo_codes(page, page_size, active_only)

    return PromoCodeListResponse(
        promo_codes=[
            PromoCodeResponse(
                id=p.id,
                code=p.code,
                description=p.description,
                discount_type=p.discount_type.value,
                discount_value=float(p.discount_value),
                max_uses=p.max_uses,
                max_uses_per_user=p.max_uses_per_user,
                current_uses=p.current_uses,
                valid_from=p.valid_from,
                valid_until=p.valid_until,
                minimum_amount=float(p.minimum_amount) if p.minimum_amount else None,
                maximum_discount=float(p.maximum_discount) if p.maximum_discount else None,
                first_booking_only=p.first_booking_only,
                is_active=p.is_active,
                effective_status=p.effective_status,  # Computed status
                created_at=p.created_at
            ) for p in promos
        ],
        total_count=total,
        page=page,
        page_size=page_size
    )


@router.get("/{promo_id}", response_model=PromoCodeResponse)
async def get_promo_code(
    promo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """
    Get promo code details (admin only).
    """
    from app.models.promo_code import PromoCode
    promo = db.query(PromoCode).filter(PromoCode.id == promo_id).first()

    if not promo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Promo code not found")

    return PromoCodeResponse(
        id=promo.id,
        code=promo.code,
        description=promo.description,
        discount_type=promo.discount_type.value,
        discount_value=float(promo.discount_value),
        max_uses=promo.max_uses,
        max_uses_per_user=promo.max_uses_per_user,
        current_uses=promo.current_uses,
        valid_from=promo.valid_from,
        valid_until=promo.valid_until,
        minimum_amount=float(promo.minimum_amount) if promo.minimum_amount else None,
        maximum_discount=float(promo.maximum_discount) if promo.maximum_discount else None,
        first_booking_only=promo.first_booking_only,
        is_active=promo.is_active,
        effective_status=promo.effective_status,  # Computed status
        created_at=promo.created_at
    )


@router.put("/{promo_id}", response_model=PromoCodeResponse)
async def update_promo_code(
    promo_id: int,
    update_data: PromoCodeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """
    Update a promo code (admin only).
    """
    service = PromoCodeService(db)

    try:
        promo = service.update_promo_code(promo_id, update_data)
        return PromoCodeResponse(
            id=promo.id,
            code=promo.code,
            description=promo.description,
            discount_type=promo.discount_type.value,
            discount_value=float(promo.discount_value),
            max_uses=promo.max_uses,
            max_uses_per_user=promo.max_uses_per_user,
            current_uses=promo.current_uses,
            valid_from=promo.valid_from,
            valid_until=promo.valid_until,
            minimum_amount=float(promo.minimum_amount) if promo.minimum_amount else None,
            maximum_discount=float(promo.maximum_discount) if promo.maximum_discount else None,
            first_booking_only=promo.first_booking_only,
            is_active=promo.is_active,
            effective_status=promo.effective_status,
            created_at=promo.created_at
        )
    except PromoCodeError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/{promo_id}")
async def deactivate_promo_code(
    promo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """
    Deactivate a promo code (admin only).
    Does not delete to preserve usage history.
    """
    service = PromoCodeService(db)

    try:
        service.deactivate_promo_code(promo_id)
        return {"message": "Promo code deactivated successfully"}
    except PromoCodeError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/{promo_id}/stats", response_model=PromoCodeStatsResponse)
async def get_promo_code_stats(
    promo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """
    Get usage statistics for a promo code (admin only).
    """
    service = PromoCodeService(db)

    try:
        stats = service.get_promo_stats(promo_id)
        return PromoCodeStatsResponse(**stats)
    except PromoCodeError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/{promo_id}/suspicious-activity")
async def check_suspicious_activity(
    promo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """
    Check for suspicious usage patterns (admin only).
    Returns potential fraud indicators.
    """
    service = PromoCodeService(db)

    try:
        suspicious = service.check_suspicious_activity(promo_id)
        return {
            "promo_id": promo_id,
            "suspicious_patterns": suspicious,
            "total_alerts": len(suspicious)
        }
    except PromoCodeError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
