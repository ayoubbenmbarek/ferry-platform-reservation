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
auth = users = ferries = bookings = payments = cabins = meals = admin = promo_codes = None

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

# Configure logging
from app.logging_config import setup_logging, get_logger, RequestIDMiddleware
setup_logging()
logger = get_logger(__name__)

# Create FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    description="A comprehensive ferry booking platform for Italy/France to Tunisia routes",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

# Add request ID middleware (must be first)
app.add_middleware(RequestIDMiddleware)

# Add CORS middleware
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


# Request timing middleware
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    """Add processing time to response headers."""
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
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
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_level="info"
    ) 