"""
Base task classes with dead-letter queue support.
Provides Redis + Database storage for failed tasks.
"""
import os
import json
import logging
import traceback
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from celery import Task

logger = logging.getLogger(__name__)

# Redis keys for dead-letter queues by category
DLQ_REDIS_KEYS = {
    "email": "dlq:email",
    "payment": "dlq:payment",
    "booking": "dlq:booking",
    "price_alert": "dlq:price_alert",
    "availability": "dlq:availability",
    "sync": "dlq:sync",
    "other": "dlq:other",
}


def _get_redis_client():
    """Get Redis client for dead-letter queue operations."""
    import redis
    redis_url = os.getenv("CELERY_RESULT_BACKEND") or os.getenv("REDIS_URL") or "redis://redis:6379/1"

    if redis_url.startswith("memory://"):
        logger.warning("Memory URL detected - DLQ Redis operations will be skipped in test mode")
        return None

    try:
        return redis.from_url(redis_url, decode_responses=True)
    except Exception as e:
        logger.error(f"Failed to connect to Redis for DLQ: {e}")
        return None


def _get_db_session():
    """Get database session for DLQ storage."""
    try:
        from app.database import SessionLocal
        return SessionLocal()
    except Exception as e:
        logger.error(f"Failed to get DB session for DLQ: {e}")
        return None


def _serialize_value(value: Any) -> Any:
    """Serialize a value for JSON storage."""
    if isinstance(value, datetime):
        return value.isoformat()
    elif isinstance(value, bytes):
        return value.decode('utf-8', errors='replace')
    elif hasattr(value, '__dict__'):
        return str(value)
    return value


def _serialize_kwargs(kwargs: Dict) -> Dict:
    """Serialize kwargs for JSON storage."""
    return {k: _serialize_value(v) for k, v in kwargs.items()}


def _serialize_args(args: tuple) -> list:
    """Serialize args for JSON storage."""
    return [_serialize_value(a) for a in args]


class DLQTask(Task):
    """
    Base Celery task with dead-letter queue support.

    On failure after all retries:
    1. Stores task in Redis for quick access
    2. Stores task in PostgreSQL for long-term analysis

    Usage:
        @celery_app.task(base=DLQTask, bind=True, dlq_category="payment")
        def my_payment_task(self, ...):
            ...
    """
    # Default category - override in task definition
    dlq_category = "other"

    # Maximum entries to keep in Redis per category
    dlq_redis_max_entries = 1000

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """Handle task failure - store in both Redis and Database."""
        try:
            category = getattr(self, 'dlq_category', 'other')
            self._store_in_redis(exc, task_id, args, kwargs, einfo, category)
            self._store_in_database(exc, task_id, args, kwargs, einfo, category)
        except Exception as dlq_error:
            logger.error(f"Failed to store task in DLQ: {dlq_error}")

        super().on_failure(exc, task_id, args, kwargs, einfo)

    def _store_in_redis(self, exc, task_id, args, kwargs, einfo, category: str):
        """Store failed task in Redis for quick access."""
        redis_client = _get_redis_client()
        if not redis_client:
            return

        try:
            redis_key = DLQ_REDIS_KEYS.get(category, DLQ_REDIS_KEYS["other"])

            failed_task = {
                "task_id": task_id,
                "task_name": self.name,
                "category": category,
                "args": _serialize_args(args) if args else [],
                "kwargs": _serialize_kwargs(kwargs) if kwargs else {},
                "error_type": type(exc).__name__,
                "error_message": str(exc),
                "traceback": str(einfo) if einfo else None,
                "failed_at": datetime.now(timezone.utc).isoformat(),
                "retry_count": self.request.retries if self.request else 0,
                "max_retries": self.max_retries if hasattr(self, 'max_retries') else 3,
                "worker_name": self.request.hostname if self.request else None,
                "queue_name": self.request.delivery_info.get('routing_key') if self.request and self.request.delivery_info else None,
            }

            # Extract related entity from kwargs if present
            for entity_key in ['booking_id', 'booking_reference', 'payment_id', 'user_id', 'alert_id']:
                if entity_key in kwargs:
                    failed_task['related_entity_type'] = entity_key.replace('_id', '').replace('_reference', '')
                    failed_task['related_entity_id'] = str(kwargs[entity_key])
                    break

            # Add to Redis list (newest first)
            redis_client.lpush(redis_key, json.dumps(failed_task, default=str))

            # Trim to max entries
            redis_client.ltrim(redis_key, 0, self.dlq_redis_max_entries - 1)

            logger.warning(
                f"📭 Task {self.name} failed permanently. "
                f"Added to DLQ (Redis). Task ID: {task_id}, Category: {category}"
            )

        except Exception as e:
            logger.error(f"Failed to store task in Redis DLQ: {e}")

    def _store_in_database(self, exc, task_id, args, kwargs, einfo, category: str):
        """Store failed task in PostgreSQL for long-term analysis."""
        db = _get_db_session()
        if not db:
            return

        try:
            from app.models.failed_task import FailedTask, TaskCategoryEnum, FailedTaskStatusEnum

            # Map category string to enum
            category_enum = TaskCategoryEnum.OTHER
            for cat in TaskCategoryEnum:
                if cat.value == category:
                    category_enum = cat
                    break

            # Extract related entity
            related_type = None
            related_id = None
            for entity_key in ['booking_id', 'booking_reference', 'payment_id', 'user_id', 'alert_id']:
                if entity_key in kwargs:
                    related_type = entity_key.replace('_id', '').replace('_reference', '')
                    related_id = str(kwargs[entity_key])
                    break

            failed_task = FailedTask(
                task_id=task_id,
                task_name=self.name,
                category=category_enum,
                args=_serialize_args(args) if args else [],
                kwargs=_serialize_kwargs(kwargs) if kwargs else {},
                error_type=type(exc).__name__,
                error_message=str(exc)[:2000],  # Limit length
                traceback=str(einfo)[:10000] if einfo else None,  # Limit length
                retry_count=self.request.retries if self.request else 0,
                max_retries=self.max_retries if hasattr(self, 'max_retries') else 3,
                status=FailedTaskStatusEnum.PENDING,
                worker_name=self.request.hostname if self.request else None,
                queue_name=self.request.delivery_info.get('routing_key') if self.request and self.request.delivery_info else None,
                related_entity_type=related_type,
                related_entity_id=related_id,
            )

            db.add(failed_task)
            db.commit()

            logger.warning(
                f"📭 Task {self.name} failed permanently. "
                f"Added to DLQ (Database). Task ID: {task_id}, DB ID: {failed_task.id}"
            )

        except Exception as e:
            logger.error(f"Failed to store task in Database DLQ: {e}")
            db.rollback()
        finally:
            db.close()


# Specialized base classes for different task categories
class EmailTask(DLQTask):
    """Base task for email-related tasks."""
    dlq_category = "email"
    autoretry_for = (Exception,)
    retry_backoff = True
    retry_backoff_max = 600
    retry_jitter = True
    max_retries = 3


class PaymentTask(DLQTask):
    """Base task for payment-related tasks."""
    dlq_category = "payment"
    autoretry_for = (Exception,)
    retry_backoff = True
    retry_backoff_max = 300
    retry_jitter = True
    max_retries = 3


class BookingTask(DLQTask):
    """Base task for booking-related tasks."""
    dlq_category = "booking"
    autoretry_for = (Exception,)
    retry_backoff = True
    retry_backoff_max = 300
    retry_jitter = True
    max_retries = 3


class PriceAlertTask(DLQTask):
    """Base task for price alert tasks."""
    dlq_category = "price_alert"
    autoretry_for = (Exception,)
    retry_backoff = True
    retry_backoff_max = 600
    retry_jitter = True
    max_retries = 3


class AvailabilityTask(DLQTask):
    """Base task for availability check tasks."""
    dlq_category = "availability"
    autoretry_for = (Exception,)
    retry_backoff = True
    retry_backoff_max = 600
    retry_jitter = True
    max_retries = 3


class SyncTask(DLQTask):
    """Base task for sync/integration tasks."""
    dlq_category = "sync"
    autoretry_for = (Exception,)
    retry_backoff = True
    retry_backoff_max = 300
    retry_jitter = True
    max_retries = 3


# =============================================================================
# DLQ Helper Functions (for admin endpoints)
# =============================================================================

def get_dlq_stats(category: Optional[str] = None) -> Dict[str, Any]:
    """
    Get dead-letter queue statistics.

    Args:
        category: Filter by category, or None for all categories

    Returns:
        Dict with queue statistics
    """
    redis_client = _get_redis_client()
    db = _get_db_session()

    stats = {
        "redis": {},
        "database": {},
        "total_pending": 0,
    }

    # Redis stats
    if redis_client:
        try:
            categories = [category] if category else list(DLQ_REDIS_KEYS.keys())
            for cat in categories:
                redis_key = DLQ_REDIS_KEYS.get(cat, DLQ_REDIS_KEYS["other"])
                count = redis_client.llen(redis_key)
                stats["redis"][cat] = count
                stats["total_pending"] += count
        except Exception as e:
            logger.error(f"Failed to get Redis DLQ stats: {e}")

    # Database stats
    if db:
        try:
            from app.models.failed_task import FailedTask, TaskCategoryEnum, FailedTaskStatusEnum

            query = db.query(FailedTask).filter(FailedTask.status == FailedTaskStatusEnum.PENDING)

            if category:
                for cat in TaskCategoryEnum:
                    if cat.value == category:
                        query = query.filter(FailedTask.category == cat)
                        break

            stats["database"]["pending"] = query.count()
            stats["database"]["total"] = db.query(FailedTask).count()

        except Exception as e:
            logger.error(f"Failed to get Database DLQ stats: {e}")
        finally:
            db.close()

    return stats


def get_failed_tasks_from_redis(category: str, limit: int = 50) -> list:
    """Get failed tasks from Redis DLQ."""
    redis_client = _get_redis_client()
    if not redis_client:
        return []

    try:
        redis_key = DLQ_REDIS_KEYS.get(category, DLQ_REDIS_KEYS["other"])
        items = redis_client.lrange(redis_key, 0, limit - 1)

        failed_tasks = []
        for idx, item in enumerate(items):
            try:
                data = json.loads(item)
                data["queue_index"] = idx
                failed_tasks.append(data)
            except json.JSONDecodeError:
                pass

        return failed_tasks
    except Exception as e:
        logger.error(f"Failed to get tasks from Redis DLQ: {e}")
        return []


def get_failed_tasks_from_db(
    category: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0
) -> Dict[str, Any]:
    """Get failed tasks from Database DLQ with pagination."""
    db = _get_db_session()
    if not db:
        return {"tasks": [], "total": 0}

    try:
        from app.models.failed_task import FailedTask, TaskCategoryEnum, FailedTaskStatusEnum

        query = db.query(FailedTask)

        if category:
            for cat in TaskCategoryEnum:
                if cat.value == category:
                    query = query.filter(FailedTask.category == cat)
                    break

        if status:
            for st in FailedTaskStatusEnum:
                if st.value == status:
                    query = query.filter(FailedTask.status == st)
                    break

        total = query.count()
        tasks = query.order_by(FailedTask.failed_at.desc()).offset(offset).limit(limit).all()

        return {
            "tasks": [t.to_dict() for t in tasks],
            "total": total,
        }

    except Exception as e:
        logger.error(f"Failed to get tasks from Database DLQ: {e}")
        return {"tasks": [], "total": 0}
    finally:
        db.close()


def retry_failed_task_from_redis(category: str, queue_index: int) -> Dict[str, Any]:
    """Retry a specific failed task from Redis DLQ."""
    redis_client = _get_redis_client()
    if not redis_client:
        return {"status": "error", "message": "Redis not available"}

    try:
        redis_key = DLQ_REDIS_KEYS.get(category, DLQ_REDIS_KEYS["other"])
        item = redis_client.lindex(redis_key, queue_index)

        if not item:
            return {"status": "error", "message": f"No item found at index {queue_index}"}

        data = json.loads(item)
        task_name = data.get("task_name")

        # Import celery app and get task
        from app.celery_app import celery_app
        task = celery_app.tasks.get(task_name)

        if not task:
            return {"status": "error", "message": f"Task {task_name} not found"}

        # Re-queue the task
        kwargs = data.get("kwargs", {})
        result = task.apply_async(kwargs=kwargs)

        # Remove from DLQ
        redis_client.lset(redis_key, queue_index, "__RETRIED__")
        redis_client.lrem(redis_key, 1, "__RETRIED__")

        logger.info(f"📤 Retried failed task {task_name}, new task ID: {result.id}")

        return {
            "status": "success",
            "message": "Task re-queued",
            "task_id": result.id,
            "task_name": task_name
        }

    except Exception as e:
        logger.error(f"Failed to retry task: {e}")
        return {"status": "error", "message": str(e)}


def clear_redis_dlq(category: str) -> Dict[str, Any]:
    """Clear all items from a Redis DLQ category."""
    redis_client = _get_redis_client()
    if not redis_client:
        return {"status": "error", "message": "Redis not available"}

    try:
        redis_key = DLQ_REDIS_KEYS.get(category, DLQ_REDIS_KEYS["other"])
        count = redis_client.llen(redis_key)
        redis_client.delete(redis_key)

        logger.info(f"🗑️ Cleared {count} items from {category} DLQ (Redis)")
        return {"status": "success", "cleared": count}

    except Exception as e:
        logger.error(f"Failed to clear Redis DLQ: {e}")
        return {"status": "error", "message": str(e)}


def update_db_task_status(
    task_id: int,
    status: str,
    resolution_notes: Optional[str] = None,
    resolved_by: Optional[str] = None
) -> Dict[str, Any]:
    """Update the status of a failed task in the database."""
    db = _get_db_session()
    if not db:
        return {"status": "error", "message": "Database not available"}

    try:
        from app.models.failed_task import FailedTask, FailedTaskStatusEnum

        task = db.query(FailedTask).filter(FailedTask.id == task_id).first()
        if not task:
            return {"status": "error", "message": f"Task {task_id} not found"}

        # Update status
        for st in FailedTaskStatusEnum:
            if st.value == status:
                task.status = st
                break

        if status == "resolved":
            task.resolved_at = datetime.now(timezone.utc)
            task.resolution_notes = resolution_notes
            task.resolved_by = resolved_by
        elif status == "retried":
            task.retried_at = datetime.now(timezone.utc)

        db.commit()

        return {"status": "success", "task": task.to_dict()}

    except Exception as e:
        logger.error(f"Failed to update task status: {e}")
        db.rollback()
        return {"status": "error", "message": str(e)}
    finally:
        db.close()
