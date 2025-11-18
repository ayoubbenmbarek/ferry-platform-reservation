"""
Admin schemas for dashboard and management endpoints.
"""

from typing import Optional, List, Any
from datetime import datetime
from pydantic import BaseModel, EmailStr, field_validator


# Dashboard Statistics
class DashboardStatsToday(BaseModel):
    """Today's statistics."""
    bookings: int
    revenue: float
    new_users: int
    active_users: int


class DashboardStatsTotal(BaseModel):
    """Total statistics."""
    bookings: int
    users: int
    revenue: float


class DashboardStatsPending(BaseModel):
    """Pending items."""
    refunds: int
    bookings: int


class DashboardStats(BaseModel):
    """Complete dashboard statistics."""
    today: DashboardStatsToday
    total: DashboardStatsTotal
    pending: DashboardStatsPending


# User Management
class UserBase(BaseModel):
    """Base user schema."""
    email: EmailStr
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None


class UserResponse(UserBase):
    """User response schema."""
    id: int
    is_active: bool
    is_admin: bool
    is_verified: bool
    created_at: datetime
    last_login: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserListResponse(BaseModel):
    """Paginated user list response."""
    users: List[UserResponse]
    total: int
    skip: int
    limit: int


class UserUpdate(BaseModel):
    """User update schema."""
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None
    is_admin: Optional[bool] = None
    is_verified: Optional[bool] = None


class UserStats(BaseModel):
    """User statistics."""
    total_bookings: int
    total_spent: float
    member_since: datetime


class UserDetailResponse(UserResponse):
    """Detailed user response with stats."""
    stats: UserStats


# Booking Management
class BookingBase(BaseModel):
    """Base booking schema."""
    booking_reference: str
    operator: Optional[str] = None
    departure_port: Optional[str] = None
    arrival_port: Optional[str] = None
    departure_time: Optional[datetime] = None
    status: str
    total_amount: float
    currency: str


class BookingResponse(BookingBase):
    """Booking response schema."""
    id: int
    user_id: Optional[int] = None
    contact_email: str
    contact_first_name: str
    contact_last_name: str
    total_passengers: int
    total_vehicles: int
    created_at: datetime
    refund_amount: Optional[float] = None
    refund_processed: Optional[bool] = False

    @field_validator('status', mode='before')
    @classmethod
    def convert_status_enum(cls, v: Any) -> str:
        if hasattr(v, 'value'):
            return v.value
        return str(v)

    class Config:
        from_attributes = True


class BookingListResponse(BaseModel):
    """Paginated booking list response."""
    bookings: List[BookingResponse]
    total: int
    skip: int
    limit: int


class BookingUpdate(BaseModel):
    """Booking update schema."""
    status: Optional[str] = None
    cancellation_reason: Optional[str] = None


# Analytics
class DailyRevenue(BaseModel):
    """Daily revenue data."""
    date: str
    revenue: float


class OperatorRevenue(BaseModel):
    """Revenue by operator."""
    operator: str
    revenue: float
    bookings: int


class AnalyticsResponse(BaseModel):
    """Analytics data response."""
    period_days: int
    daily_revenue: List[DailyRevenue]
    by_operator: List[OperatorRevenue]


# Refund Processing
class RefundRequest(BaseModel):
    """Refund request schema."""
    amount: float
    reason: str


class RefundResponse(BaseModel):
    """Refund response schema."""
    message: str
    amount: float
    booking_id: int


# Cancellation
class CancelBookingRequest(BaseModel):
    """Booking cancellation request."""
    reason: str


class CancelBookingResponse(BaseModel):
    """Booking cancellation response."""
    message: str
    booking_reference: str
    cancelled_at: datetime
