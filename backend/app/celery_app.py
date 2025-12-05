"""
Celery application configuration for async task processing.
"""
import os
from celery import Celery
from kombu import Queue

# Redis configuration for Celery (uses database 1, separate from cache)
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6399/1")
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6399/1")

# Create Celery app
celery_app = Celery(
    "maritime_booking",
    broker=CELERY_BROKER_URL,
    backend=CELERY_RESULT_BACKEND,
    include=[
        "app.tasks.email_tasks",
        "app.tasks.payment_tasks",
        "app.tasks.booking_tasks",
        "app.tasks.availability_check_tasks",
        "app.tasks.reminder_tasks",
        "app.tasks.price_alert_tasks",
        "app.tasks.price_tracking_tasks",
    ]
)

# Celery configuration
celery_app.conf.update(
    # Task settings
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,

    # Task execution settings
    task_track_started=True,
    task_time_limit=300,  # 5 minutes hard limit
    task_soft_time_limit=240,  # 4 minutes soft limit
    task_acks_late=True,
    task_reject_on_worker_lost=True,

    # Retry settings
    task_default_retry_delay=60,  # 1 minute
    task_max_retries=3,

    # Result backend settings
    result_expires=3600,  # Results expire after 1 hour
    result_backend_transport_options={
        "master_name": "mymaster",
        "visibility_timeout": 3600,
    },

    # Worker settings
    worker_prefetch_multiplier=4,
    worker_max_tasks_per_child=1000,

    # Queue configuration
    task_default_queue="default",
    task_queues=(
        Queue("default", routing_key="task.#"),
        Queue("emails", routing_key="email.#"),
        Queue("payments", routing_key="payment.#"),
        Queue("bookings", routing_key="booking.#"),
    ),

    # Route tasks to specific queues
    task_routes={
        "app.tasks.email_tasks.*": {"queue": "emails", "routing_key": "email.send"},
        "app.tasks.payment_tasks.*": {"queue": "payments", "routing_key": "payment.process"},
        "app.tasks.booking_tasks.*": {"queue": "bookings", "routing_key": "booking.process"},
    },

    # Beat schedule (for periodic tasks)
    beat_schedule={
        # Expire old pending bookings (replaces cron job)
        # Runs every minute to ensure timely expiration of unpaid bookings
        'expire-old-bookings': {
            'task': 'app.tasks.booking_tasks.expire_old_bookings',
            'schedule': 60,  # Every minute (same as original cron)
            'options': {
                'expires': 300,  # Task expires after 5 minutes if not picked up
            }
        },
        # Check availability alerts
        # Testing: Every 1 minute for testing
        # Production: Change to 3600 (1 hour) or 7200 (2 hours)
        'check-availability-alerts': {
            'task': 'app.tasks.availability_check_tasks.check_availability_alerts',
            'schedule': 60,  # 60 seconds = 1 minute for testing
            # 'schedule': 3600,  # Uncomment for 1 hour in production
            # 'schedule': 7200,  # Uncomment for 2 hours in production
            'options': {
                'expires': 300,  # Task expires after 5 minutes if not picked up (shorter for frequent checks)
            }
        },
        # Cleanup old alerts daily
        'cleanup-old-alerts': {
            'task': 'app.tasks.availability_check_tasks.cleanup_old_alerts',
            'schedule': 86400,  # 24 hours in seconds
            'options': {
                'expires': 7200,  # Task expires after 2 hours if not picked up
            }
        },
        # Check for departure reminders (24h and 2h before departure)
        # Runs every 15 minutes to catch bookings in the reminder windows
        'check-departure-reminders': {
            'task': 'app.tasks.reminder_tasks.check_departure_reminders',
            'schedule': 900,  # 15 minutes in seconds
            'options': {
                'expires': 600,  # Task expires after 10 minutes if not picked up
            }
        },
        # Complete past bookings (mark CONFIRMED -> COMPLETED after departure)
        # Runs every hour to update booking statuses
        'complete-past-bookings': {
            'task': 'app.tasks.booking_tasks.complete_past_bookings',
            'schedule': 3600,  # 1 hour in seconds
            'options': {
                'expires': 1800,  # Task expires after 30 minutes if not picked up
            }
        },
        # Check price alerts for saved routes
        # Runs every 4 hours to check for price changes
        'check-price-alerts': {
            'task': 'app.tasks.price_alert_tasks.check_price_alerts',
            'schedule': 14400,  # 4 hours in seconds
            'options': {
                'expires': 3600,  # Task expires after 1 hour if not picked up
            }
        },
        # Cleanup old price alerts daily
        'cleanup-old-price-alerts': {
            'task': 'app.tasks.price_alert_tasks.cleanup_old_price_alerts',
            'schedule': 86400,  # 24 hours in seconds
            'options': {
                'expires': 7200,  # Task expires after 2 hours if not picked up
            }
        },
        # Price tracking: Record price snapshots every 6 hours
        'record-price-snapshot': {
            'task': 'app.tasks.price_tracking_tasks.record_price_snapshot',
            'schedule': 21600,  # 6 hours in seconds
            'options': {
                'expires': 3600,  # Task expires after 1 hour if not picked up
            }
        },
        # Price tracking: Generate predictions every 12 hours
        'generate-price-predictions': {
            'task': 'app.tasks.price_tracking_tasks.generate_predictions',
            'schedule': 43200,  # 12 hours in seconds
            'options': {
                'expires': 7200,  # Task expires after 2 hours if not picked up
            }
        },
        # Price tracking: Update route statistics every 12 hours
        'update-route-statistics': {
            'task': 'app.tasks.price_tracking_tasks.update_route_statistics',
            'schedule': 43200,  # 12 hours in seconds
            'options': {
                'expires': 3600,  # Task expires after 1 hour if not picked up
            }
        },
        # Price tracking: Update fare calendar cache every 4 hours
        'update-fare-calendar-cache': {
            'task': 'app.tasks.price_tracking_tasks.update_fare_calendar_cache',
            'schedule': 14400,  # 4 hours in seconds
            'options': {
                'expires': 1800,  # Task expires after 30 minutes if not picked up
            }
        },
        # Price tracking: Cleanup old price data daily
        'cleanup-old-price-data': {
            'task': 'app.tasks.price_tracking_tasks.cleanup_old_price_data',
            'schedule': 86400,  # 24 hours in seconds
            'options': {
                'expires': 7200,  # Task expires after 2 hours if not picked up
            }
        },
    },
)
