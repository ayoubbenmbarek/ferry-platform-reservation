"""
Prometheus Metrics Endpoint for Maritime Reservation Platform.
Exposes application metrics for Prometheus scraping.
"""

from fastapi import APIRouter, Response
from prometheus_client import (
    Counter,
    Histogram,
    Gauge,
    generate_latest,
    CONTENT_TYPE_LATEST,
    CollectorRegistry,
    multiprocess,
    REGISTRY,
)
import time
import os
import psutil

router = APIRouter()

# Custom metrics for the Maritime platform
# Request metrics
REQUEST_COUNT = Counter(
    'maritime_http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status']
)

REQUEST_LATENCY = Histogram(
    'maritime_http_request_duration_seconds',
    'HTTP request latency in seconds',
    ['method', 'endpoint'],
    buckets=[0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]
)

# Business metrics
BOOKINGS_CREATED = Counter(
    'maritime_bookings_created_total',
    'Total bookings created',
    ['status', 'route']
)

PAYMENTS_PROCESSED = Counter(
    'maritime_payments_processed_total',
    'Total payments processed',
    ['status', 'payment_method']
)

ACTIVE_WEBSOCKET_CONNECTIONS = Gauge(
    'maritime_websocket_connections_active',
    'Number of active WebSocket connections'
)

# System metrics
SYSTEM_CPU_USAGE = Gauge(
    'maritime_system_cpu_usage_percent',
    'System CPU usage percentage'
)

SYSTEM_MEMORY_USAGE = Gauge(
    'maritime_system_memory_usage_percent',
    'System memory usage percentage'
)

PROCESS_MEMORY_BYTES = Gauge(
    'maritime_process_memory_bytes',
    'Process memory usage in bytes'
)

# Database metrics
DB_CONNECTIONS_ACTIVE = Gauge(
    'maritime_db_connections_active',
    'Number of active database connections'
)

# Cache metrics
CACHE_HITS = Counter(
    'maritime_cache_hits_total',
    'Total cache hits',
    ['cache_type']
)

CACHE_MISSES = Counter(
    'maritime_cache_misses_total',
    'Total cache misses',
    ['cache_type']
)


def update_system_metrics():
    """Update system-level metrics."""
    try:
        # CPU usage
        cpu_percent = psutil.cpu_percent(interval=None)
        SYSTEM_CPU_USAGE.set(cpu_percent)

        # Memory usage
        memory = psutil.virtual_memory()
        SYSTEM_MEMORY_USAGE.set(memory.percent)

        # Process memory
        process = psutil.Process()
        PROCESS_MEMORY_BYTES.set(process.memory_info().rss)
    except Exception:
        pass  # Silently ignore metric collection errors


@router.get("/metrics", include_in_schema=False)
async def metrics():
    """
    Prometheus metrics endpoint.
    Returns metrics in Prometheus text format.
    """
    # Update system metrics before generating output
    update_system_metrics()

    # Check if running in multiprocess mode (e.g., gunicorn with multiple workers)
    prometheus_multiproc_dir = os.environ.get('prometheus_multiproc_dir')

    if prometheus_multiproc_dir:
        # Multiprocess mode - aggregate metrics from all workers
        registry = CollectorRegistry()
        multiprocess.MultiProcessCollector(registry)
        metrics_output = generate_latest(registry)
    else:
        # Single process mode
        metrics_output = generate_latest(REGISTRY)

    return Response(
        content=metrics_output,
        media_type=CONTENT_TYPE_LATEST
    )


# Helper functions to record metrics from other parts of the application
def record_request(method: str, endpoint: str, status: int, duration: float):
    """Record HTTP request metrics."""
    REQUEST_COUNT.labels(method=method, endpoint=endpoint, status=str(status)).inc()
    REQUEST_LATENCY.labels(method=method, endpoint=endpoint).observe(duration)


def record_booking(status: str, route: str = "unknown"):
    """Record booking creation."""
    BOOKINGS_CREATED.labels(status=status, route=route).inc()


def record_payment(status: str, payment_method: str = "card"):
    """Record payment processing."""
    PAYMENTS_PROCESSED.labels(status=status, payment_method=payment_method).inc()


def set_websocket_connections(count: int):
    """Set active WebSocket connection count."""
    ACTIVE_WEBSOCKET_CONNECTIONS.set(count)


def set_db_connections(count: int):
    """Set active database connection count."""
    DB_CONNECTIONS_ACTIVE.set(count)


def record_cache_hit(cache_type: str = "redis"):
    """Record cache hit."""
    CACHE_HITS.labels(cache_type=cache_type).inc()


def record_cache_miss(cache_type: str = "redis"):
    """Record cache miss."""
    CACHE_MISSES.labels(cache_type=cache_type).inc()
