"""
Price Alert model for notifying users when ferry prices change.
Users can save routes and get notified of price drops or increases.
"""
from sqlalchemy import Column, Integer, String, Boolean, Date, DateTime, Float, ForeignKey, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum


class PriceAlertStatusEnum(enum.Enum):
    """Status of price alerts."""
    ACTIVE = "active"
    TRIGGERED = "triggered"  # Price threshold was met, notification sent
    PAUSED = "paused"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class PriceAlert(Base):
    """Model for ferry price alerts (saved routes)."""

    __tablename__ = "price_alerts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    email = Column(String(255), nullable=False, index=True)

    # Route information
    departure_port = Column(String(100), nullable=False, index=True)
    arrival_port = Column(String(100), nullable=False, index=True)

    # Optional date range for monitoring (null = any date)
    date_from = Column(Date, nullable=True)
    date_to = Column(Date, nullable=True)

    # Price tracking
    initial_price = Column(Float, nullable=True)  # Price when alert was created
    current_price = Column(Float, nullable=True)  # Last checked price
    lowest_price = Column(Float, nullable=True)   # Lowest price seen
    highest_price = Column(Float, nullable=True)  # Highest price seen
    target_price = Column(Float, nullable=True)   # Target price for notification (null = any change)
    best_price_date = Column(Date, nullable=True)  # Date with the lowest price in the range

    # Notification preferences
    notify_on_drop = Column(Boolean, default=True)      # Notify when price drops
    notify_on_increase = Column(Boolean, default=False) # Notify when price increases
    notify_any_change = Column(Boolean, default=False)  # Notify on any price change
    price_threshold_percent = Column(Float, default=5.0)  # Minimum % change to trigger notification

    # Alert status
    status = Column(String(50), nullable=False, default="active")
    last_checked_at = Column(DateTime(timezone=True), nullable=True)
    last_notified_at = Column(DateTime(timezone=True), nullable=True)
    notification_count = Column(Integer, default=0)

    # Expiration (null = never expires)
    expires_at = Column(DateTime(timezone=True), nullable=True)

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="price_alerts")

    # Indexes for efficient querying
    __table_args__ = (
        Index('idx_price_alerts_status', 'status'),
        Index('idx_price_alerts_route', 'departure_port', 'arrival_port'),
        Index('idx_price_alerts_user_status', 'user_id', 'status'),
    )

    def __repr__(self):
        return f"<PriceAlert(id={self.id}, {self.departure_port}→{self.arrival_port}, status={self.status})>"

    def calculate_price_change(self, new_price: float) -> dict:
        """Calculate price change statistics."""
        if self.current_price is None or self.current_price == 0:
            return {
                "change_amount": 0,
                "change_percent": 0,
                "is_drop": False,
                "is_increase": False,
            }

        change_amount = new_price - self.current_price
        change_percent = (change_amount / self.current_price) * 100

        return {
            "change_amount": round(change_amount, 2),
            "change_percent": round(change_percent, 2),
            "is_drop": change_amount < 0,
            "is_increase": change_amount > 0,
        }

    def should_notify(self, new_price: float) -> bool:
        """Check if notification should be sent based on price change."""
        if self.status != PriceAlertStatusEnum.ACTIVE.value:
            return False

        change = self.calculate_price_change(new_price)

        # Check if target price is met
        if self.target_price is not None:
            if new_price <= self.target_price:
                return True

        # Check threshold
        if abs(change["change_percent"]) < self.price_threshold_percent:
            return False

        # Check notification preferences
        if self.notify_any_change:
            return True
        if self.notify_on_drop and change["is_drop"]:
            return True
        if self.notify_on_increase and change["is_increase"]:
            return True

        return False
