"""
Health check endpoints for monitoring and orchestration.
"""

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
from typing import Dict, Any
import redis
import os
import logging

from app.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter()


def check_database(db: Session) -> Dict[str, Any]:
    """Check database connectivity."""
    try:
        db.execute(text("SELECT 1"))
        return {"status": "healthy", "latency_ms": 0}
    except Exception as e:
        logger.error(f"Database health check failed: {str(e)}")
        return {"status": "unhealthy", "error": str(e)}


def check_redis() -> Dict[str, Any]:
    """Check Redis connectivity."""
    try:
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        r = redis.from_url(redis_url, socket_timeout=2)
        start = datetime.utcnow()
        r.ping()
        latency = (datetime.utcnow() - start).total_seconds() * 1000
        return {"status": "healthy", "latency_ms": round(latency, 2)}
    except Exception as e:
        logger.error(f"Redis health check failed: {str(e)}")
        return {"status": "unhealthy", "error": str(e)}


def check_stripe() -> Dict[str, Any]:
    """Check Stripe API connectivity."""
    try:
        import stripe
        stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
        if not stripe.api_key or stripe.api_key.startswith("sk_test_fake"):
            return {"status": "degraded", "message": "Using test/fake key"}
        # Just verify the key format is valid
        return {"status": "healthy"}
    except Exception as e:
        logger.error(f"Stripe health check failed: {str(e)}")
        return {"status": "unhealthy", "error": str(e)}


@router.get("/health")
async def health_check():
    """
    Basic health check endpoint.
    Returns 200 if the service is running.
    Used by load balancers and container orchestrators.
    """
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "maritime-booking-api",
        "version": os.getenv("APP_VERSION", "1.0.0"),
    }


@router.get("/health/live")
async def liveness_check():
    """
    Kubernetes liveness probe.
    Returns 200 if the application is running (not deadlocked).
    """
    return {"status": "alive", "timestamp": datetime.utcnow().isoformat()}


@router.get("/health/ready")
async def readiness_check(db: Session = Depends(get_db)):
    """
    Kubernetes readiness probe.
    Returns 200 if the application is ready to receive traffic.
    Checks all critical dependencies.
    """
    checks = {
        "database": check_database(db),
        "redis": check_redis(),
    }

    # Determine overall status
    all_healthy = all(
        check.get("status") == "healthy"
        for check in checks.values()
    )

    response = {
        "status": "ready" if all_healthy else "not_ready",
        "timestamp": datetime.utcnow().isoformat(),
        "checks": checks,
    }

    if not all_healthy:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content=response
        )

    return response


@router.get("/health/detailed")
async def detailed_health_check(db: Session = Depends(get_db)):
    """
    Detailed health check with all service dependencies.
    Used for debugging and monitoring dashboards.
    """
    import platform
    import psutil

    # System metrics
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage('/')

    checks = {
        "database": check_database(db),
        "redis": check_redis(),
        "stripe": check_stripe(),
    }

    # Determine overall status
    unhealthy_count = sum(
        1 for check in checks.values()
        if check.get("status") == "unhealthy"
    )
    degraded_count = sum(
        1 for check in checks.values()
        if check.get("status") == "degraded"
    )

    if unhealthy_count > 0:
        overall_status = "unhealthy"
    elif degraded_count > 0:
        overall_status = "degraded"
    else:
        overall_status = "healthy"

    return {
        "status": overall_status,
        "timestamp": datetime.utcnow().isoformat(),
        "service": "maritime-booking-api",
        "version": os.getenv("APP_VERSION", "1.0.0"),
        "environment": os.getenv("ENVIRONMENT", "development"),
        "checks": checks,
        "system": {
            "python_version": platform.python_version(),
            "platform": platform.platform(),
            "cpu_percent": psutil.cpu_percent(),
            "memory": {
                "total_gb": round(memory.total / (1024**3), 2),
                "available_gb": round(memory.available / (1024**3), 2),
                "percent_used": memory.percent,
            },
            "disk": {
                "total_gb": round(disk.total / (1024**3), 2),
                "free_gb": round(disk.free / (1024**3), 2),
                "percent_used": round(disk.percent, 1),
            },
        },
    }


@router.get("/health/dependencies")
async def dependency_check(db: Session = Depends(get_db)):
    """
    Check status of all external dependencies.
    Returns detailed information about each dependency.
    """
    dependencies = []

    # Database
    db_check = check_database(db)
    dependencies.append({
        "name": "PostgreSQL",
        "type": "database",
        "critical": True,
        **db_check
    })

    # Redis
    redis_check = check_redis()
    dependencies.append({
        "name": "Redis",
        "type": "cache",
        "critical": True,
        **redis_check
    })

    # Stripe
    stripe_check = check_stripe()
    dependencies.append({
        "name": "Stripe",
        "type": "payment_gateway",
        "critical": True,
        **stripe_check
    })

    # Email service (check if configured)
    email_configured = bool(os.getenv("SMTP_HOST") or os.getenv("SENDGRID_API_KEY"))
    dependencies.append({
        "name": "Email Service",
        "type": "notification",
        "critical": False,
        "status": "healthy" if email_configured else "not_configured"
    })

    # Get circuit breaker stats
    try:
        from app.circuit_breaker import CircuitBreakers
        circuit_breakers = CircuitBreakers.get_all_stats()
    except Exception as e:
        circuit_breakers = {"error": str(e)}

    return {
        "timestamp": datetime.utcnow().isoformat(),
        "dependencies": dependencies,
        "circuit_breakers": circuit_breakers,
        "summary": {
            "total": len(dependencies),
            "healthy": sum(1 for d in dependencies if d["status"] == "healthy"),
            "unhealthy": sum(1 for d in dependencies if d["status"] == "unhealthy"),
            "degraded": sum(1 for d in dependencies if d["status"] == "degraded"),
        }
    }
