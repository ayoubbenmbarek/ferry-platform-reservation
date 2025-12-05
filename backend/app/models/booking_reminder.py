"""
Booking reminder model for tracking sent email reminders.
"""
from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum, Boolean, Text
from sqlalchemy.orm import relationship
from app.database import Base


class ReminderTypeEnum(str, PyEnum):
    """Types of booking reminders."""
    REMINDER_24H = "reminder_24h"
    REMINDER_2H = "reminder_2h"
    ETICKET_SENT = "eticket_sent"


class BookingReminder(Base):
    """
    Model for tracking sent booking reminders.
    Prevents duplicate reminders from being sent.
    """
    __tablename__ = "booking_reminders"

    id = Column(Integer, primary_key=True, index=True)

    # Link to booking
    booking_id = Column(
        Integer,
        ForeignKey("bookings.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # Type of reminder
    reminder_type = Column(
        Enum(ReminderTypeEnum),
        nullable=False,
        index=True
    )

    # Journey type (for round trips)
    journey_type = Column(
        String(20),
        default="outbound",
        nullable=False
    )  # 'outbound' or 'return'

    # Email sent to
    sent_to_email = Column(String(255), nullable=False)

    # Status
    sent_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    success = Column(Boolean, default=True, nullable=False)

    # Error message if failed
    error_message = Column(Text, nullable=True)

    # E-Ticket attachment info
    eticket_attached = Column(Boolean, default=False, nullable=False)

    # Relationship
    booking = relationship("Booking", back_populates="reminders")

    def __repr__(self):
        return f"<BookingReminder(id={self.id}, booking_id={self.booking_id}, type={self.reminder_type})>"


# Add indexes for efficient querying
from sqlalchemy import Index

# Composite index for checking if reminder was already sent
Index(
    'idx_booking_reminder_unique',
    BookingReminder.booking_id,
    BookingReminder.reminder_type,
    BookingReminder.journey_type
)
