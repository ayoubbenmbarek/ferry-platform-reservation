"""
Ferry schemas for API request/response validation.
"""

from typing import List, Dict, Optional, Any
from datetime import datetime, date
try:
    from pydantic import BaseModel, field_validator
    from pydantic import ValidationError
except ImportError:
    # Fallback for development
    class BaseModel:
        pass
    def field_validator(*args, **kwargs):
        def decorator(func):
            return func
        return decorator
    class ValidationError(Exception):
        pass

from enum import Enum


class VehicleType(str, Enum):
    """Vehicle type enumeration."""
    CAR = "car"
    SUV = "suv"
    VAN = "van"
    MOTORCYCLE = "motorcycle"
    CAMPER = "camper"
    CARAVAN = "caravan"
    TRUCK = "truck"


class PassengerType(str, Enum):
    """Passenger type enumeration."""
    ADULT = "adult"
    CHILD = "child"
    INFANT = "infant"


class PetType(str, Enum):
    """Pet type enumeration."""
    CAT = "CAT"
    SMALL_ANIMAL = "SMALL_ANIMAL"
    DOG = "DOG"


class CabinType(str, Enum):
    """Cabin type enumeration."""
    INTERIOR = "interior"
    EXTERIOR = "exterior"
    BALCONY = "balcony"
    SUITE = "suite"
    DECK = "deck"


class VehicleInfo(BaseModel):
    """Vehicle information schema."""
    type: VehicleType
    length: float = 4.5  # meters
    width: float = 1.8   # meters
    height: float = 1.8  # meters
    weight: Optional[float] = None  # kg
    registration: Optional[str] = None
    make: Optional[str] = None
    model: Optional[str] = None
    owner: Optional[str] = None
    has_trailer: bool = False
    has_caravan: bool = False
    has_roof_box: bool = False
    has_bike_rack: bool = False


class PassengerInfo(BaseModel):
    """Passenger information schema."""
    type: PassengerType
    first_name: str
    last_name: str
    date_of_birth: Optional[date] = None
    nationality: Optional[str] = None
    passport_number: Optional[str] = None
    document_expiry: Optional[date] = None
    special_needs: Optional[str] = None

    # Pet information
    has_pet: Optional[bool] = False
    pet_type: Optional[PetType] = None
    pet_name: Optional[str] = None
    pet_weight_kg: Optional[float] = None
    pet_carrier_provided: Optional[bool] = False


class CabinInfo(BaseModel):
    """Cabin information schema."""
    type: CabinType
    name: str
    price: float
    available: int
    capacity: Optional[int] = None
    amenities: Optional[List[str]] = None


class FerrySearch(BaseModel):
    """Ferry search request schema."""
    departure_port: str
    arrival_port: str
    departure_date: date
    return_date: Optional[date] = None
    # Different return route support (can return from different port)
    return_departure_port: Optional[str] = None
    return_arrival_port: Optional[str] = None
    adults: int = 1
    children: int = 0
    infants: int = 0
    vehicles: Optional[List[VehicleInfo]] = None
    cabins: int = 0  # Number of cabins requested (0 = deck passage, 1-3 = cabin quantity)
    operators: Optional[List[str]] = None
    
    @field_validator('adults')
    @classmethod
    def validate_adults(cls, v):
        if v < 1:
            raise ValueError('At least one adult passenger is required')
        if v > 20:
            raise ValueError('Maximum 20 adult passengers allowed')
        return v
    
    @field_validator('children')
    @classmethod
    def validate_children(cls, v):
        if v < 0:
            raise ValueError('Number of children cannot be negative')
        if v > 20:
            raise ValueError('Maximum 20 child passengers allowed')
        return v
    
    @field_validator('infants')
    @classmethod
    def validate_infants(cls, v):
        if v < 0:
            raise ValueError('Number of infants cannot be negative')
        if v > 10:
            raise ValueError('Maximum 10 infant passengers allowed')
        return v

    @field_validator('cabins')
    @classmethod
    def validate_cabins(cls, v):
        if v < 0:
            raise ValueError('Number of cabins cannot be negative')
        if v > 3:
            raise ValueError('Maximum 3 cabins allowed')
        return v

    @field_validator('departure_date')
    @classmethod
    def validate_departure_date(cls, v):
        if v < date.today():
            raise ValueError('Departure date cannot be in the past')
        return v
    
    @field_validator('return_date')
    @classmethod
    def validate_return_date(cls, v, info):
        if v and info.data.get('departure_date') and v <= info.data['departure_date']:
            raise ValueError('Return date must be after departure date')
        return v


class FerryResult(BaseModel):
    """Ferry search result schema."""
    sailing_id: str
    operator: str
    departure_port: str
    arrival_port: str
    departure_time: datetime
    arrival_time: datetime
    vessel_name: str
    duration: Optional[str] = None
    prices: Dict[str, float]
    cabin_types: Optional[List[CabinInfo]] = None
    available_spaces: Optional[Dict[str, int]] = None
    route_info: Optional[Dict[str, Any]] = None


class RouteInfo(BaseModel):
    """Route information schema."""
    departure_port: str
    arrival_port: str
    distance_nautical_miles: Optional[float] = None
    estimated_duration_hours: float
    operator: str
    seasonal: bool = False


class RouteResponse(BaseModel):
    """Route response schema."""
    routes: List[RouteInfo]


class ScheduleInfo(BaseModel):
    """Schedule information schema."""
    sailing_id: str
    departure_time: datetime
    arrival_time: datetime
    vessel_name: str
    available_passengers: int
    available_vehicles: int
    prices: Dict[str, float]


class ScheduleResponse(BaseModel):
    """Schedule response schema."""
    schedules: List[ScheduleInfo]
    route: RouteInfo


class FerrySearchResponse(BaseModel):
    """Ferry search response schema."""
    results: List[FerryResult]
    total_results: int
    search_params: FerrySearch
    operators_searched: List[str]
    search_time_ms: Optional[float] = None
    cached: Optional[bool] = False
    cache_age_ms: Optional[float] = None


class PriceComparison(BaseModel):
    """Price comparison schema."""
    route: str
    departure_date: date
    cheapest_option: Optional[FerryResult] = None
    operator_results: Dict[str, List[FerryResult]]
    price_range: Optional[Dict[str, float]] = None


class OperatorStatus(BaseModel):
    """Operator status schema."""
    operator: str
    available: bool
    last_checked: datetime
    error_message: Optional[str] = None


class HealthCheckResponse(BaseModel):
    """Health check response schema."""
    status: str
    operators: List[OperatorStatus]
    total_operators: int
    healthy_operators: int


class VesselInfo(BaseModel):
    """Vessel information schema."""
    name: str
    operator: str
    capacity_passengers: int
    capacity_vehicles: int
    amenities: Optional[List[str]] = None
    deck_plans: Optional[List[str]] = None


class PortInfo(BaseModel):
    """Port information schema."""
    code: str
    name: str
    city: str
    country: str
    facilities: Optional[List[str]] = None
    contact_info: Optional[Dict[str, str]] = None


class FerryOperatorInfo(BaseModel):
    """Ferry operator information schema."""
    name: str
    code: str
    website: Optional[str] = None
    contact_info: Optional[Dict[str, str]] = None
    supported_routes: List[RouteInfo]
    vessels: Optional[List[VesselInfo]] = None 