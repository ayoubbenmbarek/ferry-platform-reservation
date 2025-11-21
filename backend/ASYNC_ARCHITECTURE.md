# Async Architecture Documentation

## Overview

This document describes the asynchronous architecture for the Maritime Reservation System, including Redis caching, Celery task queues, and decoupled email processing.

## Architecture Components

### 1. Redis Cache Layer
- **Purpose**: Cache ferry search results to reduce API calls and improve response times
- **TTL**: 5 minutes for search results, 1 minute for availability data
- **Location**: `app/services/cache_service.py`

### 2. Celery Task Queues
- **Email Queue**: Handles all email sending asynchronously
- **Payment Queue**: Processes payment webhooks and verification
- **Booking Queue**: Handles ferry availability checks and operator confirmations

### 3. Async Workers
- **Worker 1 (Emails)**: Sends booking confirmations, payment success, refunds
- **Worker 2 (Payments)**: Processes Stripe webhooks, updates payment status
- **Worker 3 (Bookings)**: Checks availability, confirms with operators

## Setup Instructions

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Configure Environment Variables

Add to your `.env` file:

```bash
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0

# Celery Configuration
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0
```

### 3. Start Redis (if not already running)

```bash
# Using Docker
docker-compose -f docker-compose.dev.yml up redis

# Or standalone
redis-server
```

### 4. Start Celery Workers

**Terminal 1 - Email Worker:**
```bash
cd backend
celery -A app.celery_app worker -Q emails -l info -n email_worker@%h
```

**Terminal 2 - Payment Worker:**
```bash
cd backend
celery -A app.celery_app worker -Q payments -l info -n payment_worker@%h
```

**Terminal 3 - Booking Worker:**
```bash
cd backend
celery -A app.celery_app worker -Q bookings -l info -n booking_worker@%h
```

**Or start all workers together:**
```bash
celery -A app.celery_app worker -Q emails,payments,bookings -l info -c 4
```

### 5. Monitor Celery with Flower (Optional)

```bash
pip install flower
celery -A app.celery_app flower --port=5555
```

Visit http://localhost:5555 to see task monitoring dashboard.

## Usage Examples

### Ferry Search with Caching

```python
from app.services.cache_service import cache_service
from app.services.ferry_service import ferry_service

# Try to get from cache first
cached_results = cache_service.get_ferry_search(search_params)

if cached_results:
    return cached_results

# Cache miss - fetch from API
results = await ferry_service.search(search_params)

# Cache for 5 minutes
cache_service.set_ferry_search(search_params, results, ttl=300)

return results
```

### Sending Emails Asynchronously

```python
from app.tasks.email_tasks import send_booking_confirmation_email_task

# Queue email task (returns immediately)
task = send_booking_confirmation_email_task.delay(
    booking_data=booking_dict,
    to_email="customer@example.com"
)

# Task ID for tracking
print(f"Email task queued: {task.id}")

# Check task status (optional)
result = task.get(timeout=10)  # Wait up to 10 seconds
```

### Processing Payment Webhooks

```python
from app.tasks.payment_tasks import process_payment_webhook_task

# In your Stripe webhook endpoint
@app.post("/webhooks/stripe")
async def stripe_webhook(request: Request):
    event = stripe.Webhook.construct_event(...)

    # Queue payment processing task
    process_payment_webhook_task.delay(
        event_type=event["type"],
        payment_intent_id=event["data"]["object"]["id"],
        event_data=event["data"]["object"]
    )

    return {"status": "received"}
```

### Checking Ferry Availability Before Payment

```python
from app.tasks.booking_tasks import check_ferry_availability_task

# Check availability before initializing payment
availability = check_ferry_availability_task.apply_async(
    kwargs={
        "operator": "CTN",
        "sailing_id": "SAIL123",
        "departure_port": "tunis",
        "arrival_port": "marseille",
        "departure_time": "2025-12-01T10:00:00Z",
        "passenger_count": 2,
        "vehicle_count": 1
    }
).get(timeout=10)  # Wait for result

if availability["status"] != "available":
    raise HTTPException(400, detail=availability["message"])

# Proceed with payment
```

## Task Monitoring

### Check Task Status

```python
from celery.result import AsyncResult

task_id = "abc-123-def-456"
result = AsyncResult(task_id, app=celery_app)

print(f"Status: {result.status}")
print(f"Result: {result.result}")
```

### Retry Failed Tasks

Tasks automatically retry with exponential backoff:
- Email tasks: 3 retries, up to 10 minutes backoff
- Payment tasks: 5 retries, up to 5 minutes backoff
- Booking tasks: 3 retries, up to 3 minutes backoff

### Clear Redis Cache

```python
from app.services.cache_service import cache_service

# Clear all ferry search caches
deleted_count = cache_service.clear_all_ferry_searches()
print(f"Cleared {deleted_count} cache entries")
```

## Benefits

### 1. **Performance**
- Ferry searches are 10-100x faster with caching
- Payment confirmation emails don't block API responses
- Users get immediate feedback

### 2. **Reliability**
- Automatic retries on failures
- Email delivery guaranteed even if initial attempt fails
- Payment webhooks processed reliably

### 3. **Scalability**
- Workers can be scaled independently
- Cache reduces load on ferry operator APIs
- Queue-based architecture handles traffic spikes

### 4. **Decoupling**
- Email sending separate from business logic
- Payment processing independent of booking flow
- Easy to add new task types

## Troubleshooting

### Redis Connection Issues

```bash
# Check Redis is running
redis-cli ping
# Should return: PONG

# Check connection from Python
python -c "import redis; r=redis.Redis(); print(r.ping())"
```

### Celery Worker Not Processing Tasks

```bash
# Check worker status
celery -A app.celery_app inspect active

# Purge all pending tasks
celery -A app.celery_app purge

# Restart workers
pkill -f "celery worker"
celery -A app.celery_app worker -l info
```

### Monitor Queue Lengths

```bash
# In Redis CLI
redis-cli
> LLEN celery  # Default queue
> LLEN emails  # Email queue
> LLEN payments  # Payment queue
```

## Production Deployment

### Supervisor Configuration (Process Management)

Create `/etc/supervisor/conf.d/celery-workers.conf`:

```ini
[program:celery-email-worker]
command=/path/to/venv/bin/celery -A app.celery_app worker -Q emails -l info
directory=/path/to/backend
user=www-data
numprocs=1
autostart=true
autorestart=true
redirect_stderr=true

[program:celery-payment-worker]
command=/path/to/venv/bin/celery -A app.celery_app worker -Q payments -l info
directory=/path/to/backend
user=www-data
numprocs=1
autostart=true
autorestart=true
redirect_stderr=true
```

### Docker Compose

Already configured in `docker-compose.dev.yml`:

```yaml
celery-worker:
  build: ./backend
  command: celery -A app.celery_app worker -l info
  depends_on:
    - redis
    - postgres
```

## Security Considerations

1. **Redis Security**: Use password authentication in production
2. **Task Data**: Don't pass sensitive data in task arguments (use database IDs)
3. **Rate Limiting**: Implement rate limits on task enqueueing
4. **Monitoring**: Set up alerts for failed tasks and queue backlogs

## Performance Metrics

- **Cache Hit Rate**: Aim for >70% for ferry searches
- **Email Delivery**: <30 seconds average, 99% success rate
- **Payment Webhooks**: <5 seconds processing time
- **Availability Checks**: <2 seconds response time

## Next Steps

1. ✅ Implement Redis caching
2. ✅ Create async email workers
3. ✅ Add payment webhook processing
4. ✅ Implement availability checking
5. 🔄 Integrate with endpoints
6. 🔄 Add monitoring and alerting
7. 🔄 Load testing and optimization