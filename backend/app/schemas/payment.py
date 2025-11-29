"""
Payment Pydantic schemas for request/response validation.
"""

from typing import List, Dict, Optional, Any
from datetime import datetime
from decimal import Decimal
try:
    from pydantic import BaseModel, field_validator, ConfigDict
except ImportError:
    class BaseModel:
        pass
    def field_validator(*args, **kwargs):
        def decorator(func):
            return func
        return decorator
    class ConfigDict:
        def __init__(self, **kwargs):
            pass

from enum import Enum


class PaymentStatus(str, Enum):
    """Payment status enumeration."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"


class PaymentMethod(str, Enum):
    """Payment method enumeration."""
    CREDIT_CARD = "credit_card"
    DEBIT_CARD = "debit_card"
    PAYPAL = "paypal"
    BANK_TRANSFER = "bank_transfer"
    APPLE_PAY = "apple_pay"
    GOOGLE_PAY = "google_pay"


class Currency(str, Enum):
    """Supported currencies."""
    EUR = "EUR"
    USD = "USD"
    TND = "TND"
    GBP = "GBP"


class BillingAddress(BaseModel):
    """Billing address schema."""
    name: str
    address_line1: str
    address_line2: Optional[str] = None
    city: str
    state: Optional[str] = None
    postal_code: str
    country: str


class PaymentCreate(BaseModel):
    """Payment creation schema."""
    booking_id: int
    amount: float
    currency: Currency = Currency.EUR
    payment_method: PaymentMethod
    billing_address: Optional[BillingAddress] = None
    save_payment_method: bool = False
    metadata: Optional[Dict[str, Any]] = None  # For cabin upgrade info, etc.

    @field_validator('amount')
    @classmethod
    def validate_amount(cls, v):
        if v <= 0:
            raise ValueError('Amount must be positive')
        if v > 50000:  # Maximum payment amount
            raise ValueError('Amount exceeds maximum limit')
        return v


class PaymentMethodCreate(BaseModel):
    """Payment method creation schema."""
    method_type: PaymentMethod
    billing_address: BillingAddress
    is_default: bool = False
    
    # For card payments (tokenized)
    stripe_payment_method_id: Optional[str] = None


class PaymentResponse(BaseModel):
    """Payment response schema."""
    id: int
    booking_id: int
    amount: float
    currency: str
    status: PaymentStatus
    payment_method: PaymentMethod
    
    # External references
    stripe_payment_intent_id: Optional[str] = None
    external_transaction_id: Optional[str] = None
    
    # Card details (masked)
    card_last_four: Optional[str] = None
    card_brand: Optional[str] = None
    card_exp_month: Optional[int] = None
    card_exp_year: Optional[int] = None
    
    # Transaction details
    transaction_fee: float
    net_amount: float
    
    # Failure details
    failure_code: Optional[str] = None
    failure_message: Optional[str] = None
    
    # Timestamps
    created_at: datetime
    processed_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)


class PaymentMethodResponse(BaseModel):
    """Payment method response schema."""
    id: int
    method_type: PaymentMethod
    is_default: bool
    is_active: bool
    
    # Card details (masked)
    card_last_four: Optional[str] = None
    card_brand: Optional[str] = None
    card_exp_month: Optional[int] = None
    card_exp_year: Optional[int] = None
    
    # Billing address
    billing_name: Optional[str] = None
    billing_country: Optional[str] = None
    
    # Timestamps
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class PaymentIntent(BaseModel):
    """Payment intent schema for Stripe integration."""
    client_secret: str
    payment_intent_id: str
    amount: float
    currency: str
    status: str


class PaymentConfirmation(BaseModel):
    """Payment confirmation schema."""
    payment_id: int
    booking_reference: str
    amount: float
    currency: str
    status: PaymentStatus
    transaction_id: str
    receipt_url: Optional[str] = None
    confirmation_number: str


class RefundRequest(BaseModel):
    """Refund request schema."""
    payment_id: int
    amount: Optional[float] = None  # If None, full refund
    reason: str
    
    @field_validator('reason')
    @classmethod
    def validate_reason(cls, v):
        if not v or len(v.strip()) < 5:
            raise ValueError('Refund reason must be at least 5 characters')
        return v


class RefundResponse(BaseModel):
    """Refund response schema."""
    id: int
    payment_id: int
    amount: float
    currency: str
    status: str
    reason: str
    refund_id: str  # External refund ID
    processed_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)


class PaymentWebhook(BaseModel):
    """Payment webhook schema."""
    event_type: str
    payment_intent_id: str
    status: str
    amount: Optional[float] = None
    currency: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class PaymentStatistics(BaseModel):
    """Payment statistics schema."""
    total_payments: int
    successful_payments: int
    failed_payments: int
    total_amount: float
    total_fees: float
    average_payment_amount: float
    payments_by_method: Dict[str, int]
    payments_by_currency: Dict[str, float]
    refund_rate: float


class PaymentSearchParams(BaseModel):
    """Payment search parameters."""
    booking_id: Optional[int] = None
    user_id: Optional[int] = None
    status: Optional[PaymentStatus] = None
    payment_method: Optional[PaymentMethod] = None
    currency: Optional[Currency] = None
    amount_min: Optional[float] = None
    amount_max: Optional[float] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None


class PaymentListResponse(BaseModel):
    """Payment list response schema."""
    payments: List[PaymentResponse]
    total_count: int
    page: int
    page_size: int
    total_pages: int


class PaymentMethodUpdate(BaseModel):
    """Payment method update schema."""
    billing_address: Optional[BillingAddress] = None
    is_default: Optional[bool] = None


class PaymentRetry(BaseModel):
    """Payment retry schema."""
    payment_id: int
    new_payment_method_id: Optional[int] = None


class PaymentSummary(BaseModel):
    """Payment summary for booking."""
    booking_id: int
    total_amount: float
    paid_amount: float
    outstanding_amount: float
    currency: str
    payment_status: str
    payments: List[PaymentResponse]


class ExchangeRate(BaseModel):
    """Exchange rate schema."""
    from_currency: str
    to_currency: str
    rate: float
    last_updated: datetime


class CurrencyConversion(BaseModel):
    """Currency conversion schema."""
    original_amount: float
    original_currency: str
    converted_amount: float
    converted_currency: str
    exchange_rate: float
    conversion_date: datetime 