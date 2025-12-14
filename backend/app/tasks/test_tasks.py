"""
Test tasks for DLQ testing.
These tasks always fail to test dead-letter queue functionality.
"""
import logging
from app.celery_app import celery_app
from app.tasks.base_task import DLQTask

logger = logging.getLogger(__name__)


class TestTask(DLQTask):
    """Test task that always fails (for DLQ testing)."""
    dlq_category = "other"
    autoretry_for = (Exception,)
    retry_backoff = True
    retry_backoff_max = 10  # Fast retries for testing
    retry_jitter = False
    max_retries = 3


@celery_app.task(
    base=TestTask,
    name="app.tasks.test_tasks.test_failing_task",
    bind=True
)
def test_failing_task(self, category: str = "other", test_id: str = "test"):
    """
    A task that always fails (for testing DLQ).

    Args:
        category: Category to use for DLQ storage
        test_id: Unique test identifier
    """
    # Update the category dynamically
    self.dlq_category = category

    logger.warning(
        f"Test task {test_id} executing (attempt {self.request.retries + 1}/{self.max_retries + 1})"
    )

    # Always fail
    raise Exception(f"Intentional test failure for DLQ testing (test_id={test_id})")
