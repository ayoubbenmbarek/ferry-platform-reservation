"""
Failed Task model for dead-letter queue database storage.
Stores failed Celery tasks for analysis and retry.
"""
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, Enum as SQLEnum, Index
from sqlalchemy.dialects.postgresql import JSONB
import enum

from app.database import Base


class TaskCategoryEnum(enum.Enum):
    """Categories of tasks for filtering."""
    EMAIL = "email"
    PAYMENT = "payment"
    BOOKING = "booking"
    PRICE_ALERT = "price_alert"
    AVAILABILITY = "availability"
    SYNC = "sync"
    OTHER = "other"


class FailedTaskStatusEnum(enum.Enum):
    """Status of failed tasks."""
    PENDING = "pending"      # Waiting for review/retry
    RETRIED = "retried"      # Has been retried
    RESOLVED = "resolved"    # Manually resolved
    IGNORED = "ignored"      # Marked as ignorable


class FailedTask(Base):
    """
    Model for storing failed Celery tasks in the database.

    Provides long-term storage for failed tasks that can be:
    - Analyzed for patterns
    - Retried manually
    - Used for debugging
    """
    __tablename__ = "failed_tasks"

    id = Column(Integer, primary_key=True, index=True)

    # Task identification
    task_id = Column(String(255), nullable=False, index=True)
    task_name = Column(String(255), nullable=False, index=True)
    category = Column(
        SQLEnum(TaskCategoryEnum),
        default=TaskCategoryEnum.OTHER,
        nullable=False,
        index=True
    )

    # Task arguments
    args = Column(JSONB, default=list)
    kwargs = Column(JSONB, default=dict)

    # Error information
    error_type = Column(String(255), nullable=True)
    error_message = Column(Text, nullable=True)
    traceback = Column(Text, nullable=True)

    # Retry information
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)

    # Status tracking
    status = Column(
        SQLEnum(FailedTaskStatusEnum),
        default=FailedTaskStatusEnum.PENDING,
        nullable=False,
        index=True
    )

    # Timestamps
    failed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    retried_at = Column(DateTime(timezone=True), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Additional context
    worker_name = Column(String(255), nullable=True)
    queue_name = Column(String(100), nullable=True)

    # Related entity (e.g., booking_id, user_id for context)
    related_entity_type = Column(String(50), nullable=True)  # e.g., "booking", "user", "payment"
    related_entity_id = Column(String(100), nullable=True)   # e.g., booking reference or ID

    # Notes for manual resolution
    resolution_notes = Column(Text, nullable=True)
    resolved_by = Column(String(255), nullable=True)  # Admin who resolved

    # Indexes for common queries
    __table_args__ = (
        Index('ix_failed_tasks_category_status', 'category', 'status'),
        Index('ix_failed_tasks_failed_at', 'failed_at'),
        Index('ix_failed_tasks_related_entity', 'related_entity_type', 'related_entity_id'),
    )

    def __repr__(self):
        return f"<FailedTask {self.task_id} ({self.task_name}) - {self.status.value}>"

    def to_dict(self):
        """Convert to dictionary for API responses."""
        return {
            "id": self.id,
            "task_id": self.task_id,
            "task_name": self.task_name,
            "category": self.category.value,
            "args": self.args,
            "kwargs": self.kwargs,
            "error_type": self.error_type,
            "error_message": self.error_message,
            "traceback": self.traceback,
            "retry_count": self.retry_count,
            "max_retries": self.max_retries,
            "status": self.status.value,
            "failed_at": self.failed_at.isoformat() if self.failed_at else None,
            "retried_at": self.retried_at.isoformat() if self.retried_at else None,
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
            "worker_name": self.worker_name,
            "queue_name": self.queue_name,
            "related_entity_type": self.related_entity_type,
            "related_entity_id": self.related_entity_id,
            "resolution_notes": self.resolution_notes,
            "resolved_by": self.resolved_by,
        }
