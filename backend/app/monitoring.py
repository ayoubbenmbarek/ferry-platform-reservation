"""
Monitoring and error tracking configuration.
Integrates Sentry for error tracking and performance monitoring.
"""

import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)


def init_sentry() -> bool:
    """
    Initialize Sentry error tracking.
    Returns True if Sentry was initialized, False otherwise.
    """
    sentry_dsn = os.getenv("SENTRY_DSN")

    if not sentry_dsn:
        logger.info("Sentry DSN not configured, error tracking disabled")
        return False

    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
        from sentry_sdk.integrations.redis import RedisIntegration
        from sentry_sdk.integrations.celery import CeleryIntegration
        from sentry_sdk.integrations.logging import LoggingIntegration

        environment = os.getenv("ENVIRONMENT", "development")
        release = os.getenv("APP_VERSION", "1.0.0")

        sentry_sdk.init(
            dsn=sentry_dsn,
            environment=environment,
            release=f"maritime-booking@{release}",

            # Performance monitoring
            traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.1")),
            profiles_sample_rate=float(os.getenv("SENTRY_PROFILES_SAMPLE_RATE", "0.1")),

            # Integrations
            integrations=[
                FastApiIntegration(transaction_style="endpoint"),
                SqlalchemyIntegration(),
                RedisIntegration(),
                CeleryIntegration(),
                LoggingIntegration(
                    level=logging.INFO,
                    event_level=logging.ERROR
                ),
            ],

            # Filter sensitive data
            send_default_pii=False,

            # Ignore certain errors
            ignore_errors=[
                KeyboardInterrupt,
            ],

            # Before send hook for filtering
            before_send=before_send_filter,

            # Before breadcrumb hook
            before_breadcrumb=before_breadcrumb_filter,
        )

        logger.info(f"Sentry initialized for environment: {environment}")
        return True

    except ImportError:
        logger.warning("sentry-sdk not installed, error tracking disabled")
        return False
    except Exception as e:
        logger.error(f"Failed to initialize Sentry: {str(e)}")
        return False


def before_send_filter(event: dict, hint: dict) -> Optional[dict]:
    """
    Filter events before sending to Sentry.
    Remove sensitive data and filter out non-critical errors.
    """
    # Remove sensitive headers
    if "request" in event:
        headers = event["request"].get("headers", {})
        sensitive_headers = ["authorization", "cookie", "x-api-key", "stripe-signature"]
        for header in sensitive_headers:
            if header in headers:
                headers[header] = "[FILTERED]"

    # Remove sensitive data from breadcrumbs
    if "breadcrumbs" in event:
        for breadcrumb in event.get("breadcrumbs", {}).get("values", []):
            if breadcrumb.get("category") == "http":
                data = breadcrumb.get("data", {})
                if "headers" in data:
                    for header in ["authorization", "cookie"]:
                        if header in data["headers"]:
                            data["headers"][header] = "[FILTERED]"

    # Filter out 404 errors (too noisy)
    if "exception" in event:
        for exception in event["exception"].get("values", []):
            if "HTTPException" in exception.get("type", ""):
                # Check if it's a 404
                if "404" in str(exception.get("value", "")):
                    return None

    return event


def before_breadcrumb_filter(breadcrumb: dict, hint: dict) -> Optional[dict]:
    """
    Filter breadcrumbs before adding to events.
    """
    # Filter out health check requests
    if breadcrumb.get("category") == "http":
        url = breadcrumb.get("data", {}).get("url", "")
        if "/health" in url:
            return None

    return breadcrumb


def capture_exception(exception: Exception, **extra):
    """
    Capture an exception to Sentry with additional context.
    """
    try:
        import sentry_sdk
        with sentry_sdk.push_scope() as scope:
            for key, value in extra.items():
                scope.set_extra(key, value)
            sentry_sdk.capture_exception(exception)
    except ImportError:
        logger.error(f"Exception (Sentry not available): {exception}", exc_info=True)


def capture_message(message: str, level: str = "info", **extra):
    """
    Capture a message to Sentry.
    """
    try:
        import sentry_sdk
        with sentry_sdk.push_scope() as scope:
            for key, value in extra.items():
                scope.set_extra(key, value)
            sentry_sdk.capture_message(message, level=level)
    except ImportError:
        log_method = getattr(logger, level, logger.info)
        log_method(f"{message} - {extra}")


def set_user_context(user_id: Optional[int] = None, email: Optional[str] = None):
    """
    Set user context for Sentry events.
    """
    try:
        import sentry_sdk
        sentry_sdk.set_user({
            "id": str(user_id) if user_id else None,
            "email": email,
        })
    except ImportError:
        pass


def add_breadcrumb(message: str, category: str = "custom", level: str = "info", **data):
    """
    Add a breadcrumb to Sentry for debugging.
    """
    try:
        import sentry_sdk
        sentry_sdk.add_breadcrumb(
            message=message,
            category=category,
            level=level,
            data=data,
        )
    except ImportError:
        pass
