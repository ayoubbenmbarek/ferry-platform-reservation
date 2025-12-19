"""
Production logging configuration.
"""

import logging
import sys
from typing import Any, Dict
import structlog
from app.config import settings


def setup_logging() -> None:
    """Configure structured logging for production."""

    # Configure standard logging
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    )

    # Reduce verbose logging from httpx and httpcore
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("httpcore.connection").setLevel(logging.WARNING)
    logging.getLogger("httpcore.http11").setLevel(logging.WARNING)
    logging.getLogger("hpack").setLevel(logging.WARNING)

    # Pre-chain processors
    shared_processors = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
    ]

    if settings.DEBUG:
        # Development: use console renderer for readability
        processors = shared_processors + [
            structlog.dev.ConsoleRenderer()
        ]
    else:
        # Production: use JSON renderer for log aggregation
        processors = shared_processors + [
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.processors.JSONRenderer()
        ]

    # Configure structlog
    structlog.configure(
        processors=processors,
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str) -> structlog.BoundLogger:
    """
    Get a configured logger instance.

    Args:
        name: Logger name (usually __name__)

    Returns:
        Configured structlog logger
    """
    return structlog.get_logger(name)


# Request ID middleware for FastAPI
class RequestIDMiddleware:
    """Add unique request ID to each request."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        """Process request with unique ID."""
        if scope["type"] == "http":
            import uuid
            request_id = str(uuid.uuid4())

            # Add to structlog context
            structlog.contextvars.clear_contextvars()
            structlog.contextvars.bind_contextvars(request_id=request_id)

            # Add request ID to response headers
            async def send_with_request_id(message):
                if message["type"] == "http.response.start":
                    headers = list(message.get("headers", []))
                    headers.append((b"x-request-id", request_id.encode()))
                    message["headers"] = headers
                await send(message)

            await self.app(scope, receive, send_with_request_id)
        else:
            await self.app(scope, receive, send)


# Logging utilities
def log_api_call(
    logger: structlog.BoundLogger,
    method: str,
    endpoint: str,
    status_code: int,
    duration_ms: float,
    user_id: str = None,
    **kwargs: Any
) -> None:
    """
    Log an API call.

    Args:
        logger: Logger instance
        method: HTTP method
        endpoint: API endpoint
        status_code: Response status code
        duration_ms: Request duration in milliseconds
        user_id: User ID if authenticated
        **kwargs: Additional context
    """
    logger.info(
        "api_call",
        method=method,
        endpoint=endpoint,
        status_code=status_code,
        duration_ms=round(duration_ms, 2),
        user_id=user_id,
        **kwargs
    )


def log_error(
    logger: structlog.BoundLogger,
    error: Exception,
    context: Dict[str, Any] = None,
    **kwargs: Any
) -> None:
    """
    Log an error with context.

    Args:
        logger: Logger instance
        error: Exception that occurred
        context: Additional context
        **kwargs: Additional fields
    """
    error_data = {
        "error_type": type(error).__name__,
        "error_message": str(error),
        **(context or {}),
        **kwargs
    }

    logger.error("error_occurred", **error_data, exc_info=True)


def log_ferry_api_call(
    logger: structlog.BoundLogger,
    operator: str,
    action: str,
    success: bool,
    duration_ms: float,
    error: str = None,
    **kwargs: Any
) -> None:
    """
    Log a ferry operator API call.

    Args:
        logger: Logger instance
        operator: Ferry operator name
        action: Action performed (search, book, etc.)
        success: Whether the call was successful
        duration_ms: Call duration in milliseconds
        error: Error message if failed
        **kwargs: Additional context
    """
    logger.info(
        "ferry_api_call",
        operator=operator,
        action=action,
        success=success,
        duration_ms=round(duration_ms, 2),
        error=error,
        **kwargs
    )


def log_booking_event(
    logger: structlog.BoundLogger,
    event_type: str,
    booking_id: str = None,
    booking_reference: str = None,
    user_id: str = None,
    **kwargs: Any
) -> None:
    """
    Log a booking-related event.

    Args:
        logger: Logger instance
        event_type: Type of event (created, confirmed, cancelled, etc.)
        booking_id: Internal booking ID
        booking_reference: External booking reference
        user_id: User ID
        **kwargs: Additional context
    """
    logger.info(
        "booking_event",
        event_type=event_type,
        booking_id=booking_id,
        booking_reference=booking_reference,
        user_id=user_id,
        **kwargs
    )


def log_payment_event(
    logger: structlog.BoundLogger,
    event_type: str,
    payment_id: str = None,
    amount: float = None,
    currency: str = None,
    status: str = None,
    **kwargs: Any
) -> None:
    """
    Log a payment-related event.

    Args:
        logger: Logger instance
        event_type: Type of event (initiated, completed, failed, etc.)
        payment_id: Payment ID
        amount: Payment amount
        currency: Currency code
        status: Payment status
        **kwargs: Additional context
    """
    logger.info(
        "payment_event",
        event_type=event_type,
        payment_id=payment_id,
        amount=amount,
        currency=currency,
        status=status,
        **kwargs
    )
