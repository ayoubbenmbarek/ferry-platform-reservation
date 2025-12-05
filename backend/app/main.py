"""
Main FastAPI application for the Maritime Reservation Platform.
"""

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import time
import logging

# Import configuration
try:
    from app.config import settings
except ImportError:
    # Fallback configuration for development
    class Settings:
        APP_NAME = "Maritime Reservation Platform"
        VERSION = "1.0.0"
        DEBUG = True
        ALLOWED_ORIGINS = ["http://localhost:3001"]
        ALLOWED_ORIGINS_LIST = ["http://localhost:3001"]
    settings = Settings()

# Import API routes using importlib to avoid __init__.py conflicts
import importlib
auth = users = ferries = bookings = payments = cabins = meals = admin = promo_codes = voice_search = webhooks = modifications = vehicles = availability_alerts = price_alerts = prices = None

try:
    auth = importlib.import_module('app.api.v1.auth')
except ImportError:
    pass

try:
    ferries = importlib.import_module('app.api.v1.ferries')
except ImportError:
    pass

try:
    bookings = importlib.import_module('app.api.v1.bookings')
except ImportError:
    pass

try:
    payments = importlib.import_module('app.api.v1.payments')
except ImportError as e:
    print(f"Failed to import payments module: {e}")
    import traceback
    traceback.print_exc()

try:
    cabins = importlib.import_module('app.api.v1.cabins')
except ImportError as e:
    print(f"Failed to import cabins module: {e}")

try:
    meals = importlib.import_module('app.api.v1.meals')
except ImportError as e:
    print(f"Failed to import meals module: {e}")

try:
    admin = importlib.import_module('app.api.v1.admin')
except ImportError as e:
    print(f"Failed to import admin module: {e}")

try:
    promo_codes = importlib.import_module('app.api.v1.promo_codes')
except ImportError as e:
    print(f"Failed to import promo_codes module: {e}")

try:
    voice_search = importlib.import_module('app.api.v1.voice_search')
except ImportError as e:
    print(f"Failed to import voice_search module: {e}")

try:
    webhooks = importlib.import_module('app.api.v1.webhooks')
except ImportError as e:
    print(f"Failed to import webhooks module: {e}")

try:
    modifications = importlib.import_module('app.api.v1.modifications')
except ImportError as e:
    print(f"Failed to import modifications module: {e}")

try:
    vehicles = importlib.import_module('app.api.v1.vehicles')
except ImportError as e:
    print(f"Failed to import vehicles module: {e}")

try:
    availability_alerts = importlib.import_module('app.api.v1.availability_alerts')
except ImportError as e:
    print(f"Failed to import availability_alerts module: {e}")

try:
    price_alerts = importlib.import_module('app.api.v1.price_alerts')
except ImportError as e:
    print(f"Failed to import price_alerts module: {e}")

try:
    prices = importlib.import_module('app.api.v1.prices')
except ImportError as e:
    print(f"Failed to import prices module: {e}")

try:
    health = importlib.import_module('app.api.v1.health')
except ImportError as e:
    health = None
    print(f"Failed to import health module: {e}")

# Configure logging
from app.logging_config import setup_logging, get_logger, RequestIDMiddleware
setup_logging()
logger = get_logger(__name__)

# Initialize Sentry (before app creation)
try:
    from app.monitoring import init_sentry
    sentry_enabled = init_sentry()
except ImportError:
    sentry_enabled = False
    logger.warning("Monitoring module not available")

# Create FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    description="A comprehensive ferry booking platform for Italy/France to Tunisia routes",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    redirect_slashes=False,  # Disable automatic trailing slash redirects to avoid CORS issues
)

# Add request ID middleware (must be first)
app.add_middleware(RequestIDMiddleware)

# Set up rate limiting
try:
    from app.rate_limiter import setup_rate_limiting
    setup_rate_limiting(app)
except ImportError:
    logger.warning("Rate limiting not available")

# Add CORS middleware
# In development, allow all origins for mobile app testing
if settings.DEBUG:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS_LIST,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

# Add trusted host middleware for production
if not settings.DEBUG:
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=["maritime-reservations.com", "*.maritime-reservations.com"]
    )


# Security headers and request timing middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """Add security headers and processing time to response."""
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time

    # Processing time header
    response.headers["X-Process-Time"] = str(process_time)

    # Security headers (OWASP recommendations)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"

    # HSTS header for production (forces HTTPS)
    if not settings.DEBUG:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"

    # Content Security Policy
    # Adjust as needed for your frontend requirements
    csp_directives = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' https://js.stripe.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: https:",
        "connect-src 'self' https://api.stripe.com https://*.sentry.io",
        "frame-src https://js.stripe.com https://hooks.stripe.com",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
    ]
    response.headers["Content-Security-Policy"] = "; ".join(csp_directives)

    return response


# Global exception handlers
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Handle HTTP exceptions."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": True,
            "message": exc.detail,
            "status_code": exc.status_code
        }
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors."""
    # Convert errors to JSON-serializable format
    import json
    errors = []
    for error in exc.errors():
        # Make a copy and convert any non-serializable values to strings
        error_dict = {}
        for key, value in error.items():
            if key == 'ctx' and isinstance(value, dict):
                # Convert context values to strings
                error_dict[key] = {k: str(v) for k, v in value.items()}
            else:
                try:
                    # Try to serialize, if it fails convert to string
                    json.dumps(value)
                    error_dict[key] = value
                except (TypeError, ValueError):
                    error_dict[key] = str(value)
        errors.append(error_dict)

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": True,
            "message": "Validation error",
            "details": errors
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle general exceptions."""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)

    # Send to Sentry
    try:
        from app.monitoring import capture_exception
        capture_exception(exc, path=str(request.url), method=request.method)
    except ImportError:
        pass

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": True,
            "message": "Internal server error" if not settings.DEBUG else str(exc)
        }
    )


# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "version": settings.VERSION,
        "timestamp": time.time()
    }


# Sentry test endpoint (only in debug mode)
if settings.DEBUG:
    @app.get("/api/v1/test-sentry")
    async def test_sentry():
        """Test Sentry error tracking."""
        import uuid
        error_id = str(uuid.uuid4())[:8]

        try:
            from app.monitoring import capture_message
            capture_message(f"Test message from backend [{error_id}]", level="info")
            raise ValueError(f"Test error for Sentry [{error_id}]")
        except ValueError as e:
            from app.monitoring import capture_exception
            capture_exception(e, test=True, source="test_endpoint", error_id=error_id)
            return {
                "status": "sent",
                "message": f"Test error [{error_id}] sent to Sentry. Check your dashboard.",
                "sentry_enabled": sentry_enabled
            }


# Test email endpoint
@app.get("/api/v1/test-email")
async def test_email():
    """Test email sending functionality."""
    try:
        from app.services.email_service import email_service

        # Send a test email
        success = email_service.send_email(
            to_email="ayoubenmbarek@gmail.com",
            subject="Test Email from Maritime Booking System",
            html_content="""
            <html>
                <body style="font-family: Arial, sans-serif; padding: 20px;">
                    <h1 style="color: #0ea5e9;">🚢 Test Email</h1>
                    <p>This is a test email from your Maritime Booking System.</p>
                    <p>If you're reading this, your email configuration is working correctly! ✅</p>
                    <hr>
                    <p style="color: #666; font-size: 12px;">Sent at: {}</p>
                </body>
            </html>
            """.format(time.strftime("%Y-%m-%d %H:%M:%S")),
            text_content="This is a test email from Maritime Booking System. If you're reading this, your email is working!"
        )

        if success:
            return {
                "status": "success",
                "message": "Test email sent successfully to ayoubenmbarek@gmail.com",
                "timestamp": time.time()
            }
        else:
            return {
                "status": "error",
                "message": "Failed to send test email. Check backend logs for details.",
                "timestamp": time.time()
            }
    except Exception as e:
        logger.error(f"Test email error: {str(e)}", exc_info=True)
        return {
            "status": "error",
            "message": f"Error sending test email: {str(e)}",
            "timestamp": time.time()
        }


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "message": f"Welcome to {settings.APP_NAME}",
        "version": settings.VERSION,
        "docs": "/docs" if settings.DEBUG else "Documentation not available in production",
        "health": "/health"
    }


# Include API routers when available
if auth:
    app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
if users:
    app.include_router(users.router, prefix="/api/v1/users", tags=["Users"])
if ferries:
    app.include_router(ferries.router, prefix="/api/v1/ferries", tags=["Ferries"])
if bookings:
    app.include_router(bookings.router, prefix="/api/v1/bookings", tags=["Bookings"])
if payments:
    app.include_router(payments.router, prefix="/api/v1/payments", tags=["Payments"])

if cabins:
    app.include_router(cabins.router, prefix="/api/v1/cabins", tags=["Cabins"])

if meals:
    app.include_router(meals.router, prefix="/api/v1/meals", tags=["Meals"])

if admin:
    app.include_router(admin.router, prefix="/api/v1/admin", tags=["Admin"])

if promo_codes:
    app.include_router(promo_codes.router, prefix="/api/v1", tags=["Promo Codes"])

if voice_search:
    app.include_router(voice_search.router, prefix="/api/v1/voice", tags=["Voice Search"])

if webhooks:
    app.include_router(webhooks.router, prefix="/api/v1/webhooks", tags=["Webhooks"])

if modifications:
    app.include_router(modifications.router, prefix="/api/v1/bookings", tags=["Modifications"])

if vehicles:
    app.include_router(vehicles.router, prefix="/api/v1/vehicles", tags=["Vehicles"])

if availability_alerts:
    app.include_router(availability_alerts.router, prefix="/api/v1/availability-alerts", tags=["Availability Alerts"])

if price_alerts:
    app.include_router(price_alerts.router, prefix="/api/v1/price-alerts", tags=["Price Alerts"])

if prices:
    app.include_router(prices.router, prefix="/api/v1/prices", tags=["Prices"])

if health:
    app.include_router(health.router, prefix="/api/v1", tags=["Health"])


# Startup event
@app.on_event("startup")
async def startup_event():
    """Application startup event."""
    logger.info(f"Starting {settings.APP_NAME} v{settings.VERSION}")
    
    # Initialize database tables (in production, use Alembic migrations)
    if settings.DEBUG:
        try:
            from app.database import create_tables
            create_tables()
            logger.info("Database tables created")
        except Exception as e:
            logger.warning(f"Could not create database tables: {e}")


# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    """Application shutdown event."""
    logger.info(f"Shutting down {settings.APP_NAME}")


if __name__ == "__main__":
    import uvicorn
    import os
    # Use HOST env var; default to 127.0.0.1 for security (use 0.0.0.0 in Docker)
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "8010"))
    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        reload=settings.DEBUG,
        log_level="info"
    ) 