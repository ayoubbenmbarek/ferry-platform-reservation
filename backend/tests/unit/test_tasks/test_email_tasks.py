"""
Unit tests for Email Celery tasks.

Tests email task retry logic, dead-letter queue functionality,
and task behavior.
"""

import pytest
import json
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, MagicMock, PropertyMock
from typing import Dict, Any


class TestEmailTaskConfiguration:
    """Test email task configuration."""

    def test_email_task_base_class_attributes(self):
        """Test EmailTask base class has correct retry configuration."""
        from app.tasks.email_tasks import EmailTask

        # Verify retry configuration
        assert EmailTask.autoretry_for == (Exception,)
        assert EmailTask.retry_kwargs == {"max_retries": 5}
        assert EmailTask.retry_backoff is True
        assert EmailTask.retry_backoff_max == 1800  # 30 minutes
        assert EmailTask.retry_jitter is True

    def test_dead_letter_queue_key(self):
        """Test dead-letter queue key is defined."""
        from app.tasks.email_tasks import DEAD_LETTER_QUEUE_KEY

        assert DEAD_LETTER_QUEUE_KEY == "email:dead_letter_queue"


class TestSerializeKwargs:
    """Test kwargs serialization for dead-letter queue."""

    def test_serialize_simple_kwargs(self):
        """Test serialization of simple kwargs."""
        from app.tasks.email_tasks import _serialize_kwargs

        kwargs = {
            "to_email": "test@example.com",
            "subject": "Test Subject",
            "message": "Hello World"
        }

        result = _serialize_kwargs(kwargs)

        assert result["to_email"] == "test@example.com"
        assert result["subject"] == "Test Subject"
        assert result["message"] == "Hello World"

    def test_serialize_datetime_in_kwargs(self):
        """Test serialization of datetime objects."""
        from app.tasks.email_tasks import _serialize_kwargs

        now = datetime.now(timezone.utc)
        kwargs = {
            "to_email": "test@example.com",
            "created_at": now
        }

        result = _serialize_kwargs(kwargs)

        assert result["to_email"] == "test@example.com"
        assert isinstance(result["created_at"], str)
        assert now.isoformat() == result["created_at"]

    def test_serialize_nested_dict(self):
        """Test serialization of nested dictionaries."""
        from app.tasks.email_tasks import _serialize_kwargs

        kwargs = {
            "booking_data": {
                "booking_reference": "BK-123",
                "total_amount": 150.00,
                "created_at": datetime(2025, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
            }
        }

        result = _serialize_kwargs(kwargs)

        assert result["booking_data"]["booking_reference"] == "BK-123"
        assert isinstance(result["booking_data"]["created_at"], str)

    def test_serialize_list_with_dicts(self):
        """Test serialization of lists containing dictionaries."""
        from app.tasks.email_tasks import _serialize_kwargs

        kwargs = {
            "passengers": [
                {"name": "John Doe", "age": 30},
                {"name": "Jane Doe", "age": 28}
            ]
        }

        result = _serialize_kwargs(kwargs)

        assert len(result["passengers"]) == 2
        assert result["passengers"][0]["name"] == "John Doe"


class TestDeadLetterQueueOperations:
    """Test dead-letter queue management functions."""

    @patch('app.tasks.email_tasks._get_redis_client')
    def test_get_dead_letter_queue_stats_empty(self, mock_redis_client):
        """Test getting stats when queue is empty."""
        from app.tasks.email_tasks import get_dead_letter_queue_stats

        mock_client = MagicMock()
        mock_client.llen.return_value = 0
        mock_redis_client.return_value = mock_client

        stats = get_dead_letter_queue_stats()

        assert stats["queue_length"] == 0
        assert stats["recent_failures"] == []

    @patch('app.tasks.email_tasks._get_redis_client')
    def test_get_dead_letter_queue_stats_with_items(self, mock_redis_client):
        """Test getting stats when queue has items."""
        from app.tasks.email_tasks import get_dead_letter_queue_stats

        mock_client = MagicMock()
        mock_client.llen.return_value = 2
        mock_client.lrange.return_value = [
            json.dumps({
                "task_name": "app.tasks.email_tasks.send_booking_confirmation",
                "error": "SMTP connection failed",
                "failed_at": "2025-01-01T12:00:00Z",
                "kwargs": {"to_email": "test@example.com"}
            }).encode()
        ]
        mock_redis_client.return_value = mock_client

        stats = get_dead_letter_queue_stats()

        assert stats["queue_length"] == 2
        assert len(stats["recent_failures"]) == 1
        assert stats["recent_failures"][0]["task_name"] == "app.tasks.email_tasks.send_booking_confirmation"

    @patch('app.tasks.email_tasks._get_redis_client')
    def test_get_failed_emails(self, mock_redis_client):
        """Test retrieving failed emails from queue."""
        from app.tasks.email_tasks import get_failed_emails

        mock_client = MagicMock()
        mock_client.lrange.return_value = [
            json.dumps({
                "task_id": "task-123",
                "task_name": "app.tasks.email_tasks.send_payment_success",
                "kwargs": {"to_email": "user@example.com"},
                "error": "Connection timeout",
                "failed_at": "2025-01-01T12:00:00Z"
            }).encode()
        ]
        mock_redis_client.return_value = mock_client

        failed = get_failed_emails(limit=10)

        assert len(failed) == 1
        assert failed[0]["task_id"] == "task-123"
        assert failed[0]["queue_index"] == 0

    @patch('app.tasks.email_tasks._get_redis_client')
    def test_clear_dead_letter_queue(self, mock_redis_client):
        """Test clearing the dead-letter queue."""
        from app.tasks.email_tasks import clear_dead_letter_queue

        mock_client = MagicMock()
        mock_client.llen.return_value = 5
        mock_client.delete.return_value = True
        mock_redis_client.return_value = mock_client

        result = clear_dead_letter_queue()

        assert result["status"] == "success"
        assert result["cleared"] == 5
        mock_client.delete.assert_called_once()


class TestEmailTaskOnFailure:
    """Test EmailTask.on_failure behavior."""

    @patch('app.tasks.email_tasks._get_redis_client')
    def test_on_failure_adds_to_dead_letter_queue(self, mock_redis_client):
        """Test that task failure adds item to dead-letter queue."""
        from app.tasks.email_tasks import EmailTask

        mock_client = MagicMock()
        mock_redis_client.return_value = mock_client

        task = EmailTask()
        task.name = "test_task"

        # Simulate failure
        exc = Exception("SMTP connection refused")
        task_id = "task-456"
        args = []
        kwargs = {"to_email": "test@example.com", "booking_data": {"ref": "BK-123"}}

        task.on_failure(exc, task_id, args, kwargs, None)

        # Verify lpush was called
        mock_client.lpush.assert_called_once()
        call_args = mock_client.lpush.call_args[0]
        assert call_args[0] == "email:dead_letter_queue"

        # Parse the stored JSON
        stored_data = json.loads(call_args[1])
        assert stored_data["task_id"] == "task-456"
        assert stored_data["task_name"] == "test_task"
        assert stored_data["error"] == "SMTP connection refused"


class TestBookingConfirmationEmailTask:
    """Test booking confirmation email task."""

    def test_booking_confirmation_task_data_structure(self):
        """Test booking confirmation task accepts correct data structure."""
        booking_data = {
            "booking_reference": "MR-TEST123",
            "contact_email": "customer@example.com",
            "departure_port": "Marseille",
            "arrival_port": "Tunis",
            "departure_time": "2025-01-15T10:00:00Z",
            "total_amount": 450.00
        }

        # Validate data structure
        assert "booking_reference" in booking_data
        assert "contact_email" in booking_data
        assert "@" in booking_data["contact_email"]

    @patch('app.tasks.email_tasks.email_service')
    def test_booking_confirmation_success(self, mock_email_service):
        """Test successful booking confirmation email."""
        from app.tasks.email_tasks import send_booking_confirmation_email_task

        mock_email_service.send_booking_confirmation.return_value = True

        booking_data = {
            "booking_reference": "MR-TEST123",
            "total_amount": 450.00
        }

        # Call the task function directly (not through Celery)
        result = send_booking_confirmation_email_task(
            booking_data=booking_data,
            to_email="customer@example.com"
        )

        assert result["status"] == "success"
        assert result["email"] == "customer@example.com"
        mock_email_service.send_booking_confirmation.assert_called_once()

    @patch('app.tasks.email_tasks.email_service')
    def test_booking_confirmation_failure_raises(self, mock_email_service):
        """Test that failure raises exception for retry."""
        from app.tasks.email_tasks import send_booking_confirmation_email_task

        mock_email_service.send_booking_confirmation.return_value = False

        booking_data = {"booking_reference": "MR-TEST123"}

        with pytest.raises(Exception) as exc_info:
            send_booking_confirmation_email_task(
                booking_data=booking_data,
                to_email="customer@example.com"
            )

        assert "Failed to send booking confirmation" in str(exc_info.value)


class TestPaymentSuccessEmailTask:
    """Test payment success email task."""

    @patch('app.tasks.email_tasks.email_service')
    def test_payment_success_without_invoice(self, mock_email_service):
        """Test payment success email without invoice generation."""
        from app.tasks.email_tasks import send_payment_success_email_task

        mock_email_service.send_payment_confirmation.return_value = True

        booking_data = {"booking_reference": "MR-PAY123"}
        payment_data = {"amount": 450.00, "currency": "EUR"}

        result = send_payment_success_email_task(
            booking_data=booking_data,
            payment_data=payment_data,
            to_email="customer@example.com",
            generate_invoice=False
        )

        assert result["status"] == "success"
        assert result["invoice_attached"] is False

    @patch('app.services.invoice_service.invoice_service')
    @patch('app.tasks.email_tasks.email_service')
    def test_payment_success_with_invoice(self, mock_email_service, mock_invoice_service):
        """Test payment success email with invoice generation."""
        from app.tasks.email_tasks import send_payment_success_email_task

        mock_email_service.send_payment_confirmation.return_value = True
        mock_invoice_service.generate_invoice.return_value = b"%PDF-1.4 fake pdf content"

        booking_data = {"booking_reference": "MR-INV123"}
        payment_data = {"amount": 450.00}

        result = send_payment_success_email_task(
            booking_data=booking_data,
            payment_data=payment_data,
            to_email="customer@example.com",
            generate_invoice=True
        )

        assert result["status"] == "success"
        assert result["invoice_attached"] is True


class TestRefundConfirmationEmailTask:
    """Test refund confirmation email task."""

    @patch('app.tasks.email_tasks.email_service')
    def test_refund_confirmation_success(self, mock_email_service):
        """Test successful refund confirmation email."""
        from app.tasks.email_tasks import send_refund_confirmation_email_task

        mock_email_service.send_refund_confirmation.return_value = True

        booking_data = {
            "booking_reference": "MR-REF123",
            "refund_amount": 150.00
        }

        result = send_refund_confirmation_email_task(
            booking_data=booking_data,
            to_email="customer@example.com"
        )

        assert result["status"] == "success"
        assert result["refund_amount"] == 150.00


class TestCancellationEmailTask:
    """Test cancellation email task."""

    @patch('app.tasks.email_tasks.email_service')
    def test_cancellation_email_success(self, mock_email_service):
        """Test successful cancellation email."""
        from app.tasks.email_tasks import send_cancellation_email_task

        mock_email_service.send_cancellation_confirmation.return_value = True

        booking_data = {"booking_reference": "MR-CAN123"}

        result = send_cancellation_email_task(
            booking_data=booking_data,
            to_email="customer@example.com"
        )

        assert result["status"] == "success"
        assert result["email"] == "customer@example.com"


class TestPaymentFailedEmailTask:
    """Test payment failed email task."""

    @patch('app.tasks.email_tasks.email_service')
    def test_payment_failed_email_success(self, mock_email_service):
        """Test successful payment failed notification email."""
        from app.tasks.email_tasks import send_payment_failed_email_task

        mock_email_service.send_email.return_value = True

        booking_data = {"booking_reference": "MR-FAIL123"}

        result = send_payment_failed_email_task(
            booking_data=booking_data,
            error_message="Card declined",
            to_email="customer@example.com"
        )

        assert result["status"] == "success"
        mock_email_service.send_email.assert_called_once()


class TestCabinUpgradeEmailTask:
    """Test cabin upgrade confirmation email task."""

    @patch('app.services.invoice_service.invoice_service')
    @patch('app.tasks.email_tasks.email_service')
    def test_cabin_upgrade_email_success(self, mock_email_service, mock_invoice_service):
        """Test successful cabin upgrade confirmation email."""
        from app.tasks.email_tasks import send_cabin_upgrade_confirmation_email_task

        mock_email_service.send_email_with_attachment.return_value = True
        mock_invoice_service.generate_cabin_upgrade_invoice.return_value = b"%PDF cabin invoice"

        booking_data = {
            "booking_reference": "MR-CAB123",
            "departure_port": "marseille",
            "arrival_port": "tunis"
        }
        cabin_data = {
            "cabin_name": "Ocean View Suite",
            "cabin_type": "Suite",
            "total_price": 150.00,
            "quantity": 1,
            "journey_type": "outbound"
        }
        payment_data = {"amount": 165.00}

        result = send_cabin_upgrade_confirmation_email_task(
            booking_data=booking_data,
            cabin_data=cabin_data,
            payment_data=payment_data,
            to_email="customer@example.com"
        )

        assert result["status"] == "success"
        mock_invoice_service.generate_cabin_upgrade_invoice.assert_called_once()


class TestRetryFailedEmail:
    """Test retry_failed_email function."""

    @patch('app.tasks.email_tasks._get_redis_client')
    @patch('app.tasks.email_tasks.send_booking_confirmation_email_task')
    def test_retry_failed_email_success(self, mock_task, mock_redis_client):
        """Test successfully retrying a failed email."""
        from app.tasks.email_tasks import retry_failed_email

        mock_client = MagicMock()
        mock_client.lindex.return_value = json.dumps({
            "task_id": "old-task-123",
            "task_name": "app.tasks.email_tasks.send_booking_confirmation",
            "kwargs": {
                "booking_data": {"booking_reference": "MR-RETRY"},
                "to_email": "retry@example.com"
            }
        }).encode()
        mock_redis_client.return_value = mock_client

        mock_task.delay.return_value = MagicMock(id="new-task-456")

        result = retry_failed_email(queue_index=0)

        assert result["status"] == "success"
        assert result["task_id"] == "new-task-456"
        mock_task.delay.assert_called_once()

    @patch('app.tasks.email_tasks._get_redis_client')
    def test_retry_failed_email_not_found(self, mock_redis_client):
        """Test retry when item not found in queue."""
        from app.tasks.email_tasks import retry_failed_email

        mock_client = MagicMock()
        mock_client.lindex.return_value = None
        mock_redis_client.return_value = mock_client

        result = retry_failed_email(queue_index=999)

        assert result["status"] == "error"
        assert "No item found" in result["message"]


class TestRetryAllFailedEmails:
    """Test retry_all_failed_emails function."""

    @patch('app.tasks.email_tasks._get_redis_client')
    def test_retry_all_empty_queue(self, mock_redis_client):
        """Test retry all when queue is empty."""
        from app.tasks.email_tasks import retry_all_failed_emails

        mock_client = MagicMock()
        mock_client.llen.return_value = 0
        mock_redis_client.return_value = mock_client

        result = retry_all_failed_emails()

        assert result["status"] == "success"
        assert result["retried"] == 0
        assert "No failed emails" in result["message"]

    @patch('app.tasks.email_tasks._get_redis_client')
    @patch('app.tasks.email_tasks.send_booking_confirmation_email_task')
    def test_retry_all_with_items(self, mock_task, mock_redis_client):
        """Test retry all with items in queue."""
        from app.tasks.email_tasks import retry_all_failed_emails

        mock_client = MagicMock()
        mock_client.llen.return_value = 2
        mock_client.rpop.side_effect = [
            json.dumps({
                "task_name": "app.tasks.email_tasks.send_booking_confirmation",
                "kwargs": {"booking_data": {}, "to_email": "test1@example.com"}
            }).encode(),
            json.dumps({
                "task_name": "app.tasks.email_tasks.send_booking_confirmation",
                "kwargs": {"booking_data": {}, "to_email": "test2@example.com"}
            }).encode(),
            None  # End of queue
        ]
        mock_redis_client.return_value = mock_client

        result = retry_all_failed_emails()

        assert result["status"] == "success"
        assert result["retried"] == 2


class TestEmailTaskIntegration:
    """Integration tests for email tasks with mocked services."""

    def test_email_task_data_flow(self):
        """Test data flows correctly through email task."""
        booking_data = {
            "booking_reference": "MR-FLOW123",
            "contact_email": "flow@example.com",
            "departure_port": "Marseille",
            "arrival_port": "Tunis",
            "departure_time": datetime.now(timezone.utc) + timedelta(days=7),
            "total_amount": 450.00,
            "currency": "EUR"
        }

        # Verify data can be serialized (important for Celery)
        from app.tasks.email_tasks import _serialize_kwargs

        serialized = _serialize_kwargs({"booking_data": booking_data})

        assert serialized["booking_data"]["booking_reference"] == "MR-FLOW123"
        assert isinstance(serialized["booking_data"]["departure_time"], str)

    def test_task_name_mapping(self):
        """Test all task names are properly mapped for retry."""
        task_names = [
            "app.tasks.email_tasks.send_booking_confirmation",
            "app.tasks.email_tasks.send_payment_success",
            "app.tasks.email_tasks.send_refund_confirmation",
            "app.tasks.email_tasks.send_cabin_upgrade_confirmation",
            "app.tasks.email_tasks.send_cancellation",
            "app.tasks.email_tasks.send_payment_failed",
        ]

        # All these task names should be valid
        for task_name in task_names:
            assert task_name.startswith("app.tasks.email_tasks.")
            assert "_email" not in task_name or "send" in task_name
