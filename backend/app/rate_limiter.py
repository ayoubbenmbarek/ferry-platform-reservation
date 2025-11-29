"""
Rate limiting configuration using SlowAPI.
Protects API endpoints from abuse and DDoS attacks.
"""

import os
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from fastapi import Request
from typing import Callable
import logging

logger = logging.getLogger(__name__)


def get_client_identifier(request: Request) -> str:
    """
    Get a unique identifier for the client.
    Uses user ID if authenticated, otherwise falls back to IP address.
    """
    # Try to get user ID from request state (set by auth middleware)
    user_id = getattr(request.state, "user_id", None)
    if user_id:
        return f"user:{user_id}"

    # Fall back to IP address
    return get_remote_address(request)


# Create limiter instance
limiter = Limiter(
    key_func=get_client_identifier,
    default_limits=["200/minute", "1000/hour"],
    storage_uri=os.getenv("REDIS_URL", "memory://"),
    strategy="fixed-window",
    headers_enabled=True,
)


# Rate limit configurations for different endpoints
class RateLimits:
    """Rate limit configurations for different endpoint types."""

    # Authentication endpoints (stricter limits)
    AUTH_LOGIN = "5/minute"
    AUTH_REGISTER = "3/minute"
    AUTH_PASSWORD_RESET = "3/minute"

    # Search endpoints (moderate limits)
    SEARCH = "30/minute"
    SEARCH_FERRIES = "60/minute"

    # Booking endpoints
    BOOKING_CREATE = "10/minute"
    BOOKING_READ = "60/minute"
    BOOKING_UPDATE = "20/minute"

    # Payment endpoints (strict limits)
    PAYMENT_CREATE = "5/minute"
    PAYMENT_CONFIRM = "10/minute"

    # Admin endpoints
    ADMIN = "100/minute"

    # Health check (high limits)
    HEALTH = "100/minute"

    # Default
    DEFAULT = "60/minute"


def setup_rate_limiting(app):
    """
    Set up rate limiting on the FastAPI application.
    """
    # Add rate limit exceeded handler
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)

    logger.info("Rate limiting configured")
    return limiter


# Decorator shortcuts for common rate limits
def limit_auth(func: Callable) -> Callable:
    """Rate limit decorator for authentication endpoints."""
    return limiter.limit(RateLimits.AUTH_LOGIN)(func)


def limit_search(func: Callable) -> Callable:
    """Rate limit decorator for search endpoints."""
    return limiter.limit(RateLimits.SEARCH)(func)


def limit_booking(func: Callable) -> Callable:
    """Rate limit decorator for booking endpoints."""
    return limiter.limit(RateLimits.BOOKING_CREATE)(func)


def limit_payment(func: Callable) -> Callable:
    """Rate limit decorator for payment endpoints."""
    return limiter.limit(RateLimits.PAYMENT_CREATE)(func)


# Custom rate limit response
def custom_rate_limit_response(request: Request, exc: RateLimitExceeded):
    """
    Custom response for rate limit exceeded.
    """
    return {
        "error": True,
        "message": "Rate limit exceeded. Please try again later.",
        "retry_after": exc.detail,
        "limit": str(exc.detail),
    }
