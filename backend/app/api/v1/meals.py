"""
Meal API endpoints for onboard dining reservations.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.models.meal import Meal, MealTypeEnum
from app.schemas.meal import MealCreate, MealUpdate, MealResponse
from app.api.deps import get_admin_user
from app.models.user import User

router = APIRouter(tags=["meals"])


@router.get("", response_model=List[MealResponse])
async def list_meals(
    db: Session = Depends(get_db),
    meal_type: Optional[str] = Query(None, description="Filter by meal type"),
    operator: Optional[str] = Query(None, description="Filter by operator"),
    max_price: Optional[float] = Query(None, description="Maximum price"),
    is_available: Optional[bool] = Query(True, description="Show only available meals"),
):
    """
    List all available meals with optional filters.
    """
    query = db.query(Meal)

    if is_available is not None:
        query = query.filter(Meal.is_available == is_available)

    if meal_type:
        try:
            meal_type_enum = MealTypeEnum[meal_type.upper()]
            query = query.filter(Meal.meal_type == meal_type_enum)
        except KeyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid meal type. Valid types: {[e.value for e in MealTypeEnum]}"
            )

    if operator:
        query = query.filter(Meal.operator == operator)

    if max_price:
        query = query.filter(Meal.price <= max_price)

    meals = query.order_by(Meal.meal_type, Meal.price).all()

    # Remove duplicates based on name and meal_type (keep first occurrence)
    seen = set()
    unique_meals = []
    for meal in meals:
        key = (meal.name, meal.meal_type)
        if key not in seen:
            seen.add(key)
            unique_meals.append(meal)

    # Convert enum values to strings
    result = []
    for meal in unique_meals:
        meal_dict = {
            "id": meal.id,
            "name": meal.name,
            "description": meal.description,
            "meal_type": meal.meal_type.value if hasattr(meal.meal_type, 'value') else str(meal.meal_type),
            "price": float(meal.price),
            "currency": meal.currency,
            "is_available": meal.is_available,
            "dietary_types": meal.dietary_types,
            "operator": meal.operator,
            "created_at": meal.created_at,
        }
        result.append(meal_dict)

    return result


@router.get("/{meal_id}", response_model=MealResponse)
async def get_meal(
    meal_id: int,
    db: Session = Depends(get_db),
):
    """
    Get meal details by ID.
    """
    meal = db.query(Meal).filter(Meal.id == meal_id).first()
    if not meal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meal not found"
        )

    return {
        "id": meal.id,
        "name": meal.name,
        "description": meal.description,
        "meal_type": meal.meal_type.value if hasattr(meal.meal_type, 'value') else str(meal.meal_type),
        "price": float(meal.price),
        "currency": meal.currency,
        "is_available": meal.is_available,
        "dietary_types": meal.dietary_types,
        "operator": meal.operator,
        "created_at": meal.created_at,
    }


@router.post("", response_model=MealResponse, status_code=status.HTTP_201_CREATED)
async def create_meal(
    meal_data: MealCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """
    Create a new meal option (admin only).
    """
    try:
        meal_type_enum = MealTypeEnum[meal_data.meal_type.upper()]
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid meal type. Valid types: {[e.value for e in MealTypeEnum]}"
        )

    meal = Meal(
        name=meal_data.name,
        description=meal_data.description,
        meal_type=meal_type_enum,
        dietary_types=meal_data.dietary_types,
        price=meal_data.price,
        currency=meal_data.currency,
        operator=meal_data.operator,
        vessel_id=meal_data.vessel_id,
        available_per_day=meal_data.available_per_day,
    )

    db.add(meal)
    db.commit()
    db.refresh(meal)

    return meal


@router.patch("/{meal_id}", response_model=MealResponse)
async def update_meal(
    meal_id: int,
    meal_data: MealUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """
    Update meal details (admin only).
    """
    meal = db.query(Meal).filter(Meal.id == meal_id).first()
    if not meal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meal not found"
        )

    update_data = meal_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(meal, field, value)

    db.commit()
    db.refresh(meal)

    return meal


@router.delete("/{meal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_meal(
    meal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """
    Delete a meal option (admin only).
    """
    meal = db.query(Meal).filter(Meal.id == meal_id).first()
    if not meal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meal not found"
        )

    db.delete(meal)
    db.commit()

    return None
