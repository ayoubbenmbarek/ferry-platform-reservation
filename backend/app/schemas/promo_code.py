"""
Promo code Pydantic schemas for request/response validation.
"""

from typing import List, Optional
from datetime import datetime
from decimal import Decimal
try:
    from pydantic import BaseModel, field_validator, ConfigDict, model_validator
except ImportError:
    class BaseModel:
        pass
    def field_validator(*args, **kwargs):
        def decorator(func):
            return func
        return decorator
    def model_validator(*args, **kwargs):
        def decorator(func):
            return func
        return decorator
    class ConfigDict:
        def __init__(self, **kwargs):
            pass

from enum import Enum


class PromoCodeType(str, Enum):
    """Promo code type enumeration."""
    PERCENTAGE = "PERCENTAGE"
    FIXED_AMOUNT = "FIXED_AMOUNT"


class PromoCodeCreate(BaseModel):
    """Schema for creating a promo code (admin only)."""
    code: str
    description: Optional[str] = None
    discount_type: PromoCodeType
    discount_value: float

    # Usage limits
    max_uses: Optional[int] = None
    max_uses_per_user: int = 1

    # Validity period
    valid_from: datetime
    valid_until: Optional[datetime] = None

    # Restrictions
    minimum_amount: Optional[float] = None
    maximum_discount: Optional[float] = None

    # Targeting
    applicable_operators: Optional[List[str]] = None
    applicable_routes: Optional[List[int]] = None
    first_booking_only: bool = False

    @field_validator('code')
    @classmethod
    def validate_code(cls, v):
        # Normalize code to uppercase and strip whitespace
        code = v.strip().upper()
        if len(code) < 3:
            raise ValueError('Promo code must be at least 3 characters')
        if len(code) > 50:
            raise ValueError('Promo code cannot exceed 50 characters')
        if not code.isalnum():
            raise ValueError('Promo code must contain only letters and numbers')
        return code

    @field_validator('discount_value')
    @classmethod
    def validate_discount_value(cls, v):
        if v <= 0:
            raise ValueError('Discount value must be positive')
        return v

    @field_validator('max_uses_per_user')
    @classmethod
    def validate_max_uses_per_user(cls, v):
        if v < 1:
            raise ValueError('Max uses per user must be at least 1')
        return v

    @model_validator(mode='after')
    def validate_percentage_discount(self):
        """Ensure percentage discounts don't exceed 90%."""
        if self.discount_type == PromoCodeType.PERCENTAGE and self.discount_value > 90:
            raise ValueError('Percentage discount cannot exceed 90%')
        return self


class PromoCodeUpdate(BaseModel):
    """Schema for updating a promo code (admin only)."""
    description: Optional[str] = None
    max_uses: Optional[int] = None
    valid_until: Optional[datetime] = None
    minimum_amount: Optional[float] = None
    maximum_discount: Optional[float] = None
    is_active: Optional[bool] = None


class PromoCodeResponse(BaseModel):
    """Schema for promo code response."""
    id: int
    code: str
    description: Optional[str] = None
    discount_type: str
    discount_value: float

    # Usage
    max_uses: Optional[int] = None
    max_uses_per_user: int
    current_uses: int

    # Validity
    valid_from: datetime
    valid_until: Optional[datetime] = None

    # Restrictions
    minimum_amount: Optional[float] = None
    maximum_discount: Optional[float] = None
    first_booking_only: bool

    # Status
    is_active: bool
    effective_status: str  # Computed status: 'active', 'expired', 'used_up', 'not_started', 'inactive'
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PromoCodeValidateRequest(BaseModel):
    """Schema for validating a promo code."""
    code: str
    booking_amount: float
    operator: Optional[str] = None
    route_id: Optional[int] = None

    # Fraud prevention data
    email: str
    user_id: Optional[int] = None
    ip_address: Optional[str] = None
    device_fingerprint: Optional[str] = None

    @field_validator('code')
    @classmethod
    def normalize_code(cls, v):
        return v.strip().upper()


class PromoCodeValidateResponse(BaseModel):
    """Schema for promo code validation response."""
    is_valid: bool
    code: str
    message: str

    # If valid, include discount details
    discount_type: Optional[str] = None
    discount_value: Optional[float] = None
    discount_amount: Optional[float] = None
    final_amount: Optional[float] = None


class PromoCodeApplyRequest(BaseModel):
    """Schema for applying a promo code to a booking."""
    code: str
    booking_id: int
    original_amount: float

    # Fraud prevention data
    email: str
    user_id: Optional[int] = None
    ip_address: Optional[str] = None
    device_fingerprint: Optional[str] = None

    @field_validator('code')
    @classmethod
    def normalize_code(cls, v):
        return v.strip().upper()


class PromoCodeUsageResponse(BaseModel):
    """Schema for promo code usage record."""
    id: int
    promo_code_id: int
    booking_id: int
    user_id: Optional[int] = None
    email: str
    discount_amount: float
    original_amount: float
    final_amount: float
    used_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PromoCodeListResponse(BaseModel):
    """Schema for listing promo codes (admin)."""
    promo_codes: List[PromoCodeResponse]
    total_count: int
    page: int
    page_size: int


class PromoCodeStatsResponse(BaseModel):
    """Schema for promo code statistics (admin)."""
    code: str
    total_uses: int
    total_discount_given: float
    unique_users: int
    average_discount: float
    last_used: Optional[datetime] = None
