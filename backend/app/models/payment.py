"""
Payment models for handling transactions.
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Numeric, ForeignKey, Enum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base
import enum


class PaymentStatusEnum(enum.Enum):
    """Payment status enum."""
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"
    REFUNDED = "REFUNDED"


class PaymentMethodEnum(enum.Enum):
    """Payment method enum."""
    CREDIT_CARD = "credit_card"
    DEBIT_CARD = "debit_card"
    PAYPAL = "paypal"
    BANK_TRANSFER = "bank_transfer"
    APPLE_PAY = "apple_pay"
    GOOGLE_PAY = "google_pay"


class Payment(Base):
    """Payment transaction model."""
    
    __tablename__ = "payments"
    
    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Payment details
    amount = Column(Numeric(10, 2), nullable=False)
    currency = Column(String(3), default="EUR")
    status = Column(Enum(PaymentStatusEnum), default=PaymentStatusEnum.PENDING)
    
    # Payment method
    payment_method = Column(Enum(PaymentMethodEnum), nullable=False)
    
    # External references
    stripe_payment_intent_id = Column(String(100), nullable=True)
    stripe_charge_id = Column(String(100), nullable=True)
    stripe_refund_id = Column(String(100), nullable=True)
    external_transaction_id = Column(String(100), nullable=True)
    
    # Card details (last 4 digits only for security)
    card_last_four = Column(String(4), nullable=True)
    card_brand = Column(String(20), nullable=True)
    card_exp_month = Column(Integer, nullable=True)
    card_exp_year = Column(Integer, nullable=True)
    
    # Transaction details
    transaction_fee = Column(Numeric(10, 2), default=0.00)
    net_amount = Column(Numeric(10, 2), nullable=False)
    
    # Failure details
    failure_code = Column(String(50), nullable=True)
    failure_message = Column(Text, nullable=True)
    
    # Refund details
    refund_amount = Column(Numeric(10, 2), nullable=True)
    refund_reason = Column(Text, nullable=True)
    refunded_at = Column(DateTime(timezone=True), nullable=True)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    processed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    booking = relationship("Booking", back_populates="payments")
    user = relationship("User", back_populates="payments")
    
    def __repr__(self):
        return f"<Payment(id={self.id}, amount={self.amount}, status='{self.status.value}')>"
    
    @property
    def is_successful(self):
        """Check if payment was successful."""
        return self.status == PaymentStatusEnum.COMPLETED
    
    @property
    def can_be_refunded(self):
        """Check if payment can be refunded."""
        return (
            self.status == PaymentStatusEnum.COMPLETED and
            self.refund_amount is None
        )


class PaymentMethod(Base):
    """Saved payment methods for users."""
    
    __tablename__ = "payment_methods"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Payment method details
    method_type = Column(Enum(PaymentMethodEnum), nullable=False)
    is_default = Column(Boolean, default=False)
    
    # Card details (tokenized)
    stripe_payment_method_id = Column(String(100), nullable=True)
    card_last_four = Column(String(4), nullable=True)
    card_brand = Column(String(20), nullable=True)
    card_exp_month = Column(Integer, nullable=True)
    card_exp_year = Column(Integer, nullable=True)
    
    # Billing address
    billing_name = Column(String(200), nullable=True)
    billing_address_line1 = Column(String(255), nullable=True)
    billing_address_line2 = Column(String(255), nullable=True)
    billing_city = Column(String(100), nullable=True)
    billing_state = Column(String(100), nullable=True)
    billing_postal_code = Column(String(20), nullable=True)
    billing_country = Column(String(3), nullable=True)
    
    # Status
    is_active = Column(Boolean, default=True)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    user = relationship("User")
    
    def __repr__(self):
        return f"<PaymentMethod(id={self.id}, type='{self.method_type.value}', user={self.user_id})>"
    
    @property
    def display_name(self):
        """Get display name for payment method."""
        if self.method_type in [PaymentMethodEnum.CREDIT_CARD, PaymentMethodEnum.DEBIT_CARD]:
            return f"{self.card_brand} •••• {self.card_last_four}"
        return self.method_type.value.replace("_", " ").title() 