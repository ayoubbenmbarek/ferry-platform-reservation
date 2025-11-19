"""
Pydantic schemas for API request/response validation.
"""

from .user import UserCreate, UserUpdate, UserResponse, UserLogin
from .ferry import FerrySearch, FerryResult, RouteResponse, ScheduleResponse
from .booking import BookingCreate, BookingResponse, BookingUpdate
from .payment import PaymentCreate, PaymentResponse, PaymentMethodCreate
from .promo_code import (
    PromoCodeCreate, PromoCodeUpdate, PromoCodeResponse,
    PromoCodeValidateRequest, PromoCodeValidateResponse,
    PromoCodeApplyRequest, PromoCodeUsageResponse
)

__all__ = [
    "UserCreate",
    "UserUpdate",
    "UserResponse",
    "UserLogin",
    "FerrySearch",
    "FerryResult",
    "RouteResponse",
    "ScheduleResponse",
    "BookingCreate",
    "BookingResponse",
    "BookingUpdate",
    "PaymentCreate",
    "PaymentResponse",
    "PaymentMethodCreate",
    "PromoCodeCreate",
    "PromoCodeUpdate",
    "PromoCodeResponse",
    "PromoCodeValidateRequest",
    "PromoCodeValidateResponse",
    "PromoCodeApplyRequest",
    "PromoCodeUsageResponse",
] 