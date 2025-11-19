"""
Promo code models for discount management with fraud prevention.
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Numeric, ForeignKey, Enum, Index
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base
import enum


class PromoCodeTypeEnum(enum.Enum):
    """Promo code type enum."""
    PERCENTAGE = "PERCENTAGE"  # e.g., 10% off
    FIXED_AMOUNT = "FIXED_AMOUNT"  # e.g., €20 off


class PromoCode(Base):
    """Promo code model with security features."""

    __tablename__ = "promo_codes"

    id = Column(Integer, primary_key=True, index=True)

    # Code details
    code = Column(String(50), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)

    # Discount configuration
    discount_type = Column(Enum(PromoCodeTypeEnum), nullable=False)
    discount_value = Column(Numeric(10, 2), nullable=False)  # Percentage or fixed amount

    # Usage limits
    max_uses = Column(Integer, nullable=True)  # Total uses allowed (null = unlimited)
    max_uses_per_user = Column(Integer, default=1)  # Uses per user (default 1 for one-time use)
    current_uses = Column(Integer, default=0)  # Track total usage

    # Validity period
    valid_from = Column(DateTime(timezone=True), nullable=False)
    valid_until = Column(DateTime(timezone=True), nullable=True)  # Null = no expiration

    # Restrictions
    minimum_amount = Column(Numeric(10, 2), nullable=True)  # Minimum booking amount
    maximum_discount = Column(Numeric(10, 2), nullable=True)  # Cap for percentage discounts

    # Targeting (optional)
    applicable_operators = Column(Text, nullable=True)  # JSON array of operators (null = all)
    applicable_routes = Column(Text, nullable=True)  # JSON array of route IDs (null = all)
    first_booking_only = Column(Boolean, default=False)  # Only for users' first booking

    # Status
    is_active = Column(Boolean, default=True)

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)  # Admin who created

    # Relationships
    usages = relationship("PromoCodeUsage", back_populates="promo_code", cascade="all, delete-orphan")
    creator = relationship("User", foreign_keys=[created_by])

    def __repr__(self):
        return f"<PromoCode(id={self.id}, code='{self.code}', type='{self.discount_type.value}')>"


class PromoCodeUsage(Base):
    """Track promo code usage for fraud prevention."""

    __tablename__ = "promo_code_usages"

    id = Column(Integer, primary_key=True, index=True)

    # References
    promo_code_id = Column(Integer, ForeignKey("promo_codes.id"), nullable=False)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Null for guest bookings

    # Fraud prevention - track multiple identifiers
    email = Column(String(255), nullable=False, index=True)
    ip_address = Column(String(45), nullable=True)  # IPv6 support
    device_fingerprint = Column(String(255), nullable=True)  # Browser fingerprint

    # Usage details
    discount_amount = Column(Numeric(10, 2), nullable=False)
    original_amount = Column(Numeric(10, 2), nullable=False)
    final_amount = Column(Numeric(10, 2), nullable=False)

    # Status
    is_valid = Column(Boolean, default=True)  # Can be invalidated if fraud detected

    # Metadata
    used_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    promo_code = relationship("PromoCode", back_populates="usages")
    booking = relationship("Booking")
    user = relationship("User")

    # Indexes for fraud detection queries
    __table_args__ = (
        Index('ix_promo_usage_email_code', 'email', 'promo_code_id'),
        Index('ix_promo_usage_ip_code', 'ip_address', 'promo_code_id'),
        Index('ix_promo_usage_device_code', 'device_fingerprint', 'promo_code_id'),
        Index('ix_promo_usage_user_code', 'user_id', 'promo_code_id'),
    )

    def __repr__(self):
        return f"<PromoCodeUsage(id={self.id}, code_id={self.promo_code_id}, booking_id={self.booking_id})>"
