"""
Cabin API endpoints for ferry accommodations.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.models.ferry import Cabin, CabinTypeEnum, BedTypeEnum
from app.schemas.cabin import CabinCreate, CabinUpdate, CabinResponse
from app.api.deps import get_admin_user
from app.models.user import User

router = APIRouter()


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
