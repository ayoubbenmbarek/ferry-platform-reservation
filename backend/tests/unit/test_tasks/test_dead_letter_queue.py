"""
Unit tests for Dead Letter Queue (DLQ) functionality.
Tests the base task classes and DLQ helper functions.
"""
import pytest
import json
from unittest.mock import Mock, patch, MagicMock, PropertyMock
from datetime import datetime, timezone

from app.tasks.base_task import (
    DLQTask,
    EmailTask,
    PaymentTask,
    BookingTask,
    PriceAlertTask,
    AvailabilityTask,
    SyncTask,
    DLQ_REDIS_KEYS,
    _serialize_value,
    _serialize_kwargs,
    _serialize_args,
    get_dlq_stats,
    get_failed_tasks_from_redis,
    get_failed_tasks_from_db,
    retry_failed_task_from_redis,
    clear_redis_dlq,
    update_db_task_status,
)
from app.models.failed_task import FailedTask, TaskCategoryEnum, FailedTaskStatusEnum


class TestDLQRedisKeys:
    """Test DLQ Redis key configuration."""

    def test_all_categories_have_keys(self):
        """All task categories should have Redis keys defined."""
        expected_categories = ["email", "payment", "booking", "price_alert", "availability", "sync", "other"]
        for category in expected_categories:
            assert category in DLQ_REDIS_KEYS
            assert DLQ_REDIS_KEYS[category].startswith("dlq:")

    def test_redis_keys_are_unique(self):
        """Each category should have a unique Redis key."""
        keys = list(DLQ_REDIS_KEYS.values())
        assert len(keys) == len(set(keys)), "Redis keys should be unique"


class TestSerializationHelpers:
    """Test serialization helper functions."""

    def test_serialize_value_datetime(self):
        """Datetime values should be converted to ISO format."""
        dt = datetime(2024, 12, 14, 10, 30, 0, tzinfo=timezone.utc)
        result = _serialize_value(dt)
        assert result == "2024-12-14T10:30:00+00:00"

    def test_serialize_value_bytes(self):
        """Bytes should be decoded to string."""
        result = _serialize_value(b"test data")
        assert result == "test data"

    def test_serialize_value_string(self):
        """Strings should be returned as-is."""
        result = _serialize_value("hello")
        assert result == "hello"

    def test_serialize_value_int(self):
        """Integers should be returned as-is."""
        result = _serialize_value(42)
        assert result == 42

    def test_serialize_kwargs_nested(self):
        """Nested kwargs should be serialized correctly."""
        kwargs = {
            "booking_data": {
                "id": 1,
                "created_at": datetime(2024, 12, 14, tzinfo=timezone.utc),
            },
            "to_email": "test@example.com",
        }
        result = _serialize_kwargs(kwargs)
        assert result["to_email"] == "test@example.com"
        assert result["booking_data"]["id"] == 1
        assert "2024-12-14" in result["booking_data"]["created_at"]

    def test_serialize_args(self):
        """Args tuple should be converted to list."""
        args = ("arg1", 2, datetime(2024, 12, 14, tzinfo=timezone.utc))
        result = _serialize_args(args)
        assert isinstance(result, list)
        assert result[0] == "arg1"
        assert result[1] == 2
        assert "2024-12-14" in result[2]


class TestDLQTaskCategories:
    """Test that specialized task classes have correct categories."""

    def test_email_task_category(self):
        """EmailTask should have 'email' category."""
        assert EmailTask.dlq_category == "email"

    def test_payment_task_category(self):
        """PaymentTask should have 'payment' category."""
        assert PaymentTask.dlq_category == "payment"

    def test_booking_task_category(self):
        """BookingTask should have 'booking' category."""
        assert BookingTask.dlq_category == "booking"

    def test_price_alert_task_category(self):
        """PriceAlertTask should have 'price_alert' category."""
        assert PriceAlertTask.dlq_category == "price_alert"

    def test_availability_task_category(self):
        """AvailabilityTask should have 'availability' category."""
        assert AvailabilityTask.dlq_category == "availability"

    def test_sync_task_category(self):
        """SyncTask should have 'sync' category."""
        assert SyncTask.dlq_category == "sync"

    def test_base_dlq_task_category(self):
        """Base DLQTask should have 'other' category."""
        assert DLQTask.dlq_category == "other"


class TestDLQTaskRetryConfig:
    """Test that task classes have proper retry configuration."""

    def test_email_task_retry_config(self):
        """EmailTask should have autoretry configured."""
        assert EmailTask.autoretry_for == (Exception,)
        assert EmailTask.retry_backoff is True
        assert EmailTask.retry_jitter is True
        assert EmailTask.max_retries == 3

    def test_payment_task_retry_config(self):
        """PaymentTask should have autoretry configured."""
        assert PaymentTask.autoretry_for == (Exception,)
        assert PaymentTask.retry_backoff is True
        assert PaymentTask.max_retries == 3


class TestDLQOnFailure:
    """Test the on_failure method of DLQ tasks."""

    @patch('app.tasks.base_task._get_redis_client')
    @patch('app.tasks.base_task._get_db_session')
    def test_on_failure_stores_in_redis(self, mock_db_session, mock_redis_client):
        """Task failure should store task info in Redis."""
        # Setup mocks
        mock_redis = MagicMock()
        mock_redis_client.return_value = mock_redis
        mock_db_session.return_value = None  # Skip DB for this test

        # Create task instance
        task = EmailTask()
        task.name = "app.tasks.email_tasks.send_test"

        # Mock the request property at the class level
        mock_request = Mock()
        mock_request.retries = 2
        mock_request.hostname = "worker-1"
        mock_request.delivery_info = {"routing_key": "email.send"}

        # Simulate failure
        exc = Exception("Test error")
        task_id = "test-task-123"
        args = ()
        kwargs = {"to_email": "test@example.com"}
        einfo = None

        # Patch request property at class level
        with patch.object(EmailTask, 'request', new_callable=PropertyMock, return_value=mock_request):
            task._store_in_redis(exc, task_id, args, kwargs, einfo, "email")

        # Verify Redis lpush was called
        mock_redis.lpush.assert_called_once()
        call_args = mock_redis.lpush.call_args
        redis_key = call_args[0][0]
        stored_data = json.loads(call_args[0][1])

        assert redis_key == "dlq:email"
        assert stored_data["task_id"] == task_id
        assert stored_data["task_name"] == "app.tasks.email_tasks.send_test"
        assert stored_data["category"] == "email"
        assert stored_data["error_type"] == "Exception"
        assert stored_data["error_message"] == "Test error"
        assert stored_data["kwargs"]["to_email"] == "test@example.com"

    @patch('app.tasks.base_task._get_redis_client')
    @patch('app.tasks.base_task._get_db_session')
    def test_on_failure_stores_in_database(self, mock_db_session, mock_redis_client):
        """Task failure should store task info in Database."""
        # Setup mocks
        mock_redis_client.return_value = None  # Skip Redis for this test
        mock_db = MagicMock()
        mock_db_session.return_value = mock_db

        # Create task instance
        task = PaymentTask()
        task.name = "app.tasks.payment_tasks.process_payment"

        mock_request = Mock()
        mock_request.retries = 1
        mock_request.hostname = "worker-2"
        mock_request.delivery_info = {"routing_key": "payment.process"}

        # Simulate failure
        exc = ValueError("Payment failed")
        task_id = "payment-task-456"
        args = ()
        kwargs = {"payment_id": "pay_123", "booking_id": "book_456"}
        einfo = Mock()
        einfo.__str__ = Mock(return_value="Traceback...")

        # Patch request property at class level
        with patch.object(PaymentTask, 'request', new_callable=PropertyMock, return_value=mock_request):
            task._store_in_database(exc, task_id, args, kwargs, einfo, "payment")

        # Verify DB add was called
        mock_db.add.assert_called_once()
        added_task = mock_db.add.call_args[0][0]

        assert isinstance(added_task, FailedTask)
        assert added_task.task_id == task_id
        assert added_task.task_name == "app.tasks.payment_tasks.process_payment"
        assert added_task.category == TaskCategoryEnum.PAYMENT
        assert added_task.error_type == "ValueError"
        assert "Payment failed" in added_task.error_message
        assert added_task.related_entity_type == "booking"
        assert added_task.related_entity_id == "book_456"

        mock_db.commit.assert_called_once()

    @patch('app.tasks.base_task._get_redis_client')
    @patch('app.tasks.base_task._get_db_session')
    def test_on_failure_extracts_related_entities(self, mock_db_session, mock_redis_client):
        """on_failure should extract related entity info from kwargs."""
        mock_redis = MagicMock()
        mock_redis_client.return_value = mock_redis
        mock_db_session.return_value = None

        task = BookingTask()
        task.name = "test_task"

        mock_request = Mock()
        mock_request.retries = 0
        mock_request.hostname = "worker"
        mock_request.delivery_info = {}

        # Test with booking_reference
        kwargs = {"booking_reference": "VF-ABC123"}

        # Patch request property at class level
        with patch.object(BookingTask, 'request', new_callable=PropertyMock, return_value=mock_request):
            task._store_in_redis(Exception("test"), "task-1", (), kwargs, None, "booking")

        stored_data = json.loads(mock_redis.lpush.call_args[0][1])
        assert stored_data["related_entity_type"] == "booking"
        assert stored_data["related_entity_id"] == "VF-ABC123"


class TestGetDLQStats:
    """Test get_dlq_stats function."""

    @patch('app.tasks.base_task._get_redis_client')
    @patch('app.tasks.base_task._get_db_session')
    def test_get_stats_all_categories(self, mock_db_session, mock_redis_client):
        """Should return stats for all categories when no filter."""
        mock_redis = MagicMock()
        mock_redis.llen.return_value = 5
        mock_redis_client.return_value = mock_redis
        mock_db_session.return_value = None

        stats = get_dlq_stats()

        assert "redis" in stats
        assert "database" in stats
        assert "total_pending" in stats

        # All categories should have counts
        for category in DLQ_REDIS_KEYS.keys():
            assert category in stats["redis"]

    @patch('app.tasks.base_task._get_redis_client')
    @patch('app.tasks.base_task._get_db_session')
    def test_get_stats_single_category(self, mock_db_session, mock_redis_client):
        """Should return stats for single category when filtered."""
        mock_redis = MagicMock()
        mock_redis.llen.return_value = 3
        mock_redis_client.return_value = mock_redis
        mock_db_session.return_value = None

        stats = get_dlq_stats("email")

        assert stats["redis"]["email"] == 3
        assert stats["total_pending"] == 3


class TestGetFailedTasksFromRedis:
    """Test get_failed_tasks_from_redis function."""

    @patch('app.tasks.base_task._get_redis_client')
    def test_get_failed_tasks_returns_list(self, mock_redis_client):
        """Should return list of failed tasks."""
        mock_redis = MagicMock()
        mock_redis.lrange.return_value = [
            json.dumps({"task_id": "task-1", "task_name": "test"}),
            json.dumps({"task_id": "task-2", "task_name": "test2"}),
        ]
        mock_redis_client.return_value = mock_redis

        result = get_failed_tasks_from_redis("email", limit=10)

        assert len(result) == 2
        assert result[0]["task_id"] == "task-1"
        assert result[0]["queue_index"] == 0
        assert result[1]["task_id"] == "task-2"
        assert result[1]["queue_index"] == 1

    @patch('app.tasks.base_task._get_redis_client')
    def test_get_failed_tasks_empty_queue(self, mock_redis_client):
        """Should return empty list for empty queue."""
        mock_redis = MagicMock()
        mock_redis.lrange.return_value = []
        mock_redis_client.return_value = mock_redis

        result = get_failed_tasks_from_redis("email")

        assert result == []

    @patch('app.tasks.base_task._get_redis_client')
    def test_get_failed_tasks_no_redis(self, mock_redis_client):
        """Should return empty list when Redis not available."""
        mock_redis_client.return_value = None

        result = get_failed_tasks_from_redis("email")

        assert result == []


class TestRetryFailedTaskFromRedis:
    """Test retry_failed_task_from_redis function."""

    @patch('app.celery_app.celery_app')
    @patch('app.tasks.base_task._get_redis_client')
    def test_retry_task_success(self, mock_redis_client, mock_celery):
        """Should successfully retry a task."""
        mock_redis = MagicMock()
        mock_redis.lindex.return_value = json.dumps({
            "task_id": "old-task-id",
            "task_name": "app.tasks.email_tasks.send_test",
            "kwargs": {"to_email": "test@example.com"},
        })
        mock_redis_client.return_value = mock_redis

        mock_task = MagicMock()
        mock_task.apply_async.return_value = Mock(id="new-task-id")
        mock_celery.tasks.get.return_value = mock_task

        result = retry_failed_task_from_redis("email", 0)

        assert result["status"] == "success"
        assert result["task_id"] == "new-task-id"
        mock_task.apply_async.assert_called_once()

    @patch('app.tasks.base_task._get_redis_client')
    def test_retry_task_not_found(self, mock_redis_client):
        """Should return error when task not found at index."""
        mock_redis = MagicMock()
        mock_redis.lindex.return_value = None
        mock_redis_client.return_value = mock_redis

        result = retry_failed_task_from_redis("email", 999)

        assert result["status"] == "error"
        assert "no item found" in result["message"].lower()


class TestClearRedisDLQ:
    """Test clear_redis_dlq function."""

    @patch('app.tasks.base_task._get_redis_client')
    def test_clear_dlq_success(self, mock_redis_client):
        """Should clear DLQ and return count."""
        mock_redis = MagicMock()
        mock_redis.llen.return_value = 10
        mock_redis_client.return_value = mock_redis

        result = clear_redis_dlq("email")

        assert result["status"] == "success"
        assert result["cleared"] == 10
        mock_redis.delete.assert_called_once_with("dlq:email")

    @patch('app.tasks.base_task._get_redis_client')
    def test_clear_dlq_no_redis(self, mock_redis_client):
        """Should return error when Redis not available."""
        mock_redis_client.return_value = None

        result = clear_redis_dlq("email")

        assert result["status"] == "error"


class TestUpdateDbTaskStatus:
    """Test update_db_task_status function."""

    @patch('app.tasks.base_task._get_db_session')
    def test_update_status_to_resolved(self, mock_db_session):
        """Should update task status to resolved."""
        mock_db = MagicMock()
        mock_task = MagicMock(spec=FailedTask)
        mock_task.to_dict.return_value = {"id": 1, "status": "resolved"}
        mock_db.query.return_value.filter.return_value.first.return_value = mock_task
        mock_db_session.return_value = mock_db

        result = update_db_task_status(
            task_id=1,
            status="resolved",
            resolution_notes="Fixed manually",
            resolved_by="admin@example.com"
        )

        assert result["status"] == "success"
        assert mock_task.status == FailedTaskStatusEnum.RESOLVED
        assert mock_task.resolution_notes == "Fixed manually"
        assert mock_task.resolved_by == "admin@example.com"
        mock_db.commit.assert_called_once()

    @patch('app.tasks.base_task._get_db_session')
    def test_update_status_task_not_found(self, mock_db_session):
        """Should return error when task not found."""
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = None
        mock_db_session.return_value = mock_db

        result = update_db_task_status(task_id=999, status="resolved")

        assert result["status"] == "error"
        assert "not found" in result["message"].lower()


class TestFailedTaskModel:
    """Test FailedTask model."""

    def test_to_dict(self):
        """to_dict should return proper dictionary."""
        task = FailedTask(
            id=1,
            task_id="test-task-123",
            task_name="app.tasks.email_tasks.send_test",
            category=TaskCategoryEnum.EMAIL,
            args=[],
            kwargs={"to_email": "test@example.com"},
            error_type="Exception",
            error_message="Test error",
            status=FailedTaskStatusEnum.PENDING,
            failed_at=datetime(2024, 12, 14, tzinfo=timezone.utc),
            created_at=datetime(2024, 12, 14, tzinfo=timezone.utc),
        )

        result = task.to_dict()

        assert result["id"] == 1
        assert result["task_id"] == "test-task-123"
        assert result["category"] == "email"
        assert result["status"] == "pending"
        assert result["kwargs"]["to_email"] == "test@example.com"

    def test_repr(self):
        """__repr__ should return readable string."""
        task = FailedTask(
            task_id="test-123",
            task_name="test_task",
            status=FailedTaskStatusEnum.PENDING,
        )

        repr_str = repr(task)

        assert "test-123" in repr_str
        assert "test_task" in repr_str
        assert "pending" in repr_str
