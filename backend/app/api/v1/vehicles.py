"""
Vehicle API endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import logging

from app.database import get_db
from app.models.vehicle import VehicleMake, VehicleModel
from app.schemas.vehicle import (
    VehicleMakeResponse,
    VehicleModelResponse,
    LicensePlateInfo
)

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/makes", response_model=List[VehicleMakeResponse])
async def get_vehicle_makes(
    db: Session = Depends(get_db),
    active_only: bool = True
):
    """
    Get list of vehicle makes.
    """
    try:
        query = db.query(VehicleMake)
        if active_only:
            query = query.filter(VehicleMake.is_active == True)

        makes = query.order_by(VehicleMake.name).all()
        return makes

    except Exception as e:
        logger.error(f"Error fetching vehicle makes: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch vehicle makes"
        )


@router.get("/makes/{make_id}/models", response_model=List[VehicleModelResponse])
async def get_vehicle_models(
    make_id: int,
    db: Session = Depends(get_db),
    active_only: bool = True
):
    """
    Get list of vehicle models for a specific make.
    """
    try:
        query = db.query(VehicleModel).filter(VehicleModel.make_id == make_id)
        if active_only:
            query = query.filter(VehicleModel.is_active == True)

        models = query.order_by(VehicleModel.name).all()

        # Add make name to each model
        result = []
        for model in models:
            model_dict = {
                "id": model.id,
                "make_id": model.make_id,
                "name": model.name,
                "year_start": model.year_start,
                "year_end": model.year_end,
                "body_type": model.body_type,
                "is_active": model.is_active,
                "avg_length_cm": model.avg_length_cm,
                "avg_width_cm": model.avg_width_cm,
                "avg_height_cm": model.avg_height_cm,
                "make_name": model.make.name if model.make else None
            }
            result.append(model_dict)

        return result

    except Exception as e:
        logger.error(f"Error fetching vehicle models: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch vehicle models"
        )


@router.get("/models/search", response_model=List[VehicleModelResponse])
async def search_vehicle_models(
    q: str = Query(..., min_length=2, description="Search query"),
    db: Session = Depends(get_db),
    limit: int = Query(20, le=100)
):
    """
    Search vehicle models by name.
    """
    try:
        models = db.query(VehicleModel).join(VehicleMake).filter(
            VehicleModel.name.ilike(f"%{q}%"),
            VehicleModel.is_active == True
        ).limit(limit).all()

        # Add make name to each model
        result = []
        for model in models:
            model_dict = {
                "id": model.id,
                "make_id": model.make_id,
                "name": model.name,
                "year_start": model.year_start,
                "year_end": model.year_end,
                "body_type": model.body_type,
                "is_active": model.is_active,
                "avg_length_cm": model.avg_length_cm,
                "avg_width_cm": model.avg_width_cm,
                "avg_height_cm": model.avg_height_cm,
                "make_name": model.make.name if model.make else None
            }
            result.append(model_dict)

        return result

    except Exception as e:
        logger.error(f"Error searching vehicle models: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to search vehicle models"
        )


@router.get("/lookup/{license_plate}", response_model=LicensePlateInfo)
async def lookup_license_plate(
    license_plate: str,
    db: Session = Depends(get_db)
):
    """
    Look up vehicle information by license plate.

    This is a placeholder that returns mock data.
    In production, integrate with a real license plate API service.
    """
    try:
        # TODO: Integrate with actual license plate lookup API
        # Examples:
        # - UK: DVLA API
        # - France: SIV API
        # - Germany: KBA
        # - EU: EuroPlate API

        # For now, return a mock response
        # In production, call the actual API here

        # Try to find similar vehicle in our database to suggest dimensions
        suggested_dims = None

        # Mock response - replace with actual API call
        logger.info(f"License plate lookup requested for: {license_plate}")

        return LicensePlateInfo(
            registration=license_plate.upper(),
            make=None,
            model=None,
            year=None,
            color=None,
            vehicle_type="car",
            suggested_length_cm=None,
            suggested_width_cm=None,
            suggested_height_cm=None
        )

    except Exception as e:
        logger.error(f"Error looking up license plate: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to lookup license plate"
        )
