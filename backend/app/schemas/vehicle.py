"""
Vehicle-related Pydantic schemas.
"""
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


class VehicleMakeBase(BaseModel):
    """Base vehicle make schema."""
    name: str
    logo_url: Optional[str] = None
    is_active: bool = True


class VehicleMakeCreate(VehicleMakeBase):
    """Vehicle make creation schema."""
    pass


class VehicleMakeResponse(VehicleMakeBase):
    """Vehicle make response schema."""
    id: int

    model_config = ConfigDict(from_attributes=True)


class VehicleModelBase(BaseModel):
    """Base vehicle model schema."""
    make_id: int
    name: str
    year_start: Optional[int] = None
    year_end: Optional[int] = None
    body_type: Optional[str] = None
    is_active: bool = True
    avg_length_cm: Optional[int] = None
    avg_width_cm: Optional[int] = None
    avg_height_cm: Optional[int] = None


class VehicleModelCreate(VehicleModelBase):
    """Vehicle model creation schema."""
    pass


class VehicleModelResponse(VehicleModelBase):
    """Vehicle model response schema."""
    id: int
    make_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class LicensePlateInfo(BaseModel):
    """License plate lookup response."""
    registration: str
    make: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    color: Optional[str] = None
    vehicle_type: Optional[str] = None
    # Suggested dimensions based on make/model
    suggested_length_cm: Optional[int] = None
    suggested_width_cm: Optional[int] = None
    suggested_height_cm: Optional[int] = None
