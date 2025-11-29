"""
Availability Alert model for notifying users when ferry capacity becomes available.
"""
from sqlalchemy import Column, Integer, String, Boolean, Date, DateTime, Time, ForeignKey, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum


class AlertTypeEnum(enum.Enum):
    """Types of availability alerts."""
    VEHICLE = "vehicle"
    CABIN = "cabin"
    PASSENGER = "passenger"


class AlertStatusEnum(enum.Enum):
    """Status of availability alerts."""
    ACTIVE = "active"
    NOTIFIED = "notified"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class AvailabilityAlert(Base):
    """Model for ferry availability alerts."""

    __tablename__ = "availability_alerts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    email = Column(String(255), nullable=False, index=True)
    alert_type = Column(String(50), nullable=False)  # vehicle, cabin, passenger

    # Search criteria
    departure_port = Column(String(100), nullable=False)
    arrival_port = Column(String(100), nullable=False)
    departure_date = Column(Date, nullable=False, index=True)
    is_round_trip = Column(Boolean, default=False)
    return_date = Column(Date, nullable=True)
    operator = Column(String(100), nullable=True, index=True)  # Ferry operator (e.g., "CTN", "GNV"), NULL = any operator
    sailing_time = Column(Time, nullable=True)  # Specific sailing time (e.g., "19:00"), NULL = any time

    # Passenger details
    num_adults = Column(Integer, default=1)
    num_children = Column(Integer, default=0)
    num_infants = Column(Integer, default=0)

    # Vehicle details (if alert_type = 'vehicle')
    vehicle_type = Column(String(50), nullable=True)
    vehicle_length_cm = Column(Integer, nullable=True)

    # Cabin details (if alert_type = 'cabin')
    cabin_type = Column(String(50), nullable=True)
    num_cabins = Column(Integer, default=1)

    # Alert status
    status = Column(String(50), nullable=False, default="active")
    last_checked_at = Column(DateTime(timezone=True), nullable=True)
    notified_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="availability_alerts")

    # Indexes
    __table_args__ = (
        Index('idx_alerts_status_expires', 'status', 'expires_at'),
    )

    def __repr__(self):
        return f"<AvailabilityAlert(id={self.id}, type={self.alert_type}, {self.departure_port}→{self.arrival_port}, status={self.status})>"
