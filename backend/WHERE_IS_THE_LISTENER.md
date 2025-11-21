# Where is the Listener? 🔍

## The "Listener" = Celery Worker Process

The listener is **NOT a single file** - it's a **running background process** that watches the queue.

---

## 📂 Code Components:

### 1. **Celery App Configuration** (The Setup)
**File:** `app/celery_app.py`

```python
celery_app = Celery(
    "maritime_booking",
    broker=REDIS_URL,          # ← Connects to Redis (the message queue)
    backend=REDIS_URL,
    include=[
        "app.tasks.email_tasks",   # ← Task definitions
        "app.tasks.payment_tasks",
        "app.tasks.booking_tasks",
    ]
)
```

**What it does:**
- Configures connection to Redis
- Defines which task modules to load
- Sets retry policies, timeouts, etc.

---

### 2. **Task Definitions** (What the Listener Executes)
**File:** `app/tasks/email_tasks.py`

```python
@celery_app.task(
    name="app.tasks.email_tasks.send_cancellation",
    bind=True
)
def send_cancellation_email_task(self, booking_data, to_email):
    """
    This function is executed by the listener when a task is queued.
    """
    email_service.send_cancellation_confirmation(
        booking_data=booking_data,
        to_email=to_email
    )
```

**What it does:**
- Defines the actual work to be done
- Registered with Celery via `@celery_app.task` decorator
- Executed by the worker when task is picked up

---

### 3. **Task Queuing** (Putting Tasks in the Queue)
**File:** `app/api/v1/bookings.py` (or any endpoint)

```python
# In your cancellation endpoint:
@router.post("/{booking_id}/cancel")
async def cancel_booking(...):
    # 1. Update database
    booking.status = BookingStatusEnum.CANCELLED
    db.commit()

    # 2. Queue the email task (THIS ADDS TO QUEUE)
    send_cancellation_email_task.delay(
        booking_data=booking_dict,
        to_email=booking.contact_email
    )

    # 3. Return immediately (don't wait for email)
    return {"message": "Booking cancelled"}
```

**What `.delay()` does:**
- Serializes task data to JSON
- Pushes task to Redis queue: `emails`
- Returns immediately (non-blocking)

---

### 4. **The Listener Process** (The Worker)
**Command:**

```bash
celery -A app.celery_app worker -Q emails -l info
```

**What this command does:**
```
celery           ← Celery CLI tool
-A app.celery_app ← Load this Celery app configuration
worker           ← Start a worker process
-Q emails        ← Listen to the "emails" queue
-l info          ← Log level: info
```

**This process:**
- ✅ Runs in the background (separate from FastAPI)
- ✅ Connects to Redis and watches the `emails` queue
- ✅ When a task appears → picks it up and executes
- ✅ Automatically retries on failure
- ✅ Logs everything

---

## 🔄 Complete Flow with File Locations:

```
┌─────────────────────────────────────────────────────────────┐
│ USER CANCELS BOOKING                                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ FILE: app/api/v1/bookings.py                                │
│                                                              │
│ @router.post("/{booking_id}/cancel")                        │
│ async def cancel_booking(...):                              │
│     booking.status = CANCELLED                              │
│     db.commit()                                             │
│                                                              │
│     # Queue email task                                      │
│     send_cancellation_email_task.delay(...)  ←────┐         │
│                                                    │         │
│     return {"message": "Cancelled"} # Immediate   │         │
└────────────────────────────────────────────────────┼─────────┘
                                                     │
                     │                               │
                     ▼                               │
┌─────────────────────────────────────────────────────────────┐
│ REDIS (Message Broker)                           │         │
│                                                   │         │
│ Queue: "emails"                                   │         │
│ ┌──────────────────────────────────┐             │         │
│ │ Task: send_cancellation_email    │ ◄───────────┘         │
│ │ Data: {booking_data, email}      │                       │
│ └──────────────────────────────────┘                       │
│                                                             │
│ (Task waits here until worker picks it up)                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Worker polls queue every 1 second
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ CELERY WORKER PROCESS (THE LISTENER!)                       │
│                                                              │
│ Terminal Command:                                           │
│ celery -A app.celery_app worker -Q emails -l info          │
│                                                              │
│ Process started by: You/Docker/Supervisor                   │
│ Configured by: app/celery_app.py                           │
│ Executes tasks from: app/tasks/email_tasks.py              │
│                                                              │
│ Worker loop:                                                │
│ while True:                                                 │
│     task = redis.get_next_task_from_queue("emails")        │
│     if task:                                                │
│         execute_task(task)  # ← Calls send_cancellation... │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ FILE: app/tasks/email_tasks.py                              │
│                                                              │
│ @celery_app.task(...)                                       │
│ def send_cancellation_email_task(self, booking_data, ...): │
│     # This function is executed by the worker               │
│     email_service.send_cancellation_confirmation(...)       │
│     logger.info("Email sent successfully")                  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ FILE: app/services/email_service.py                         │
│                                                              │
│ def send_cancellation_confirmation(...):                    │
│     # Send actual email via SMTP                            │
│     smtp.send_email(...)                                    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ ✅ EMAIL DELIVERED TO USER                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 How to Start the Listener:

### Method 1: Manual (for development)

```bash
# Terminal 1: Start email worker (the listener)
cd backend
celery -A app.celery_app worker -Q emails -l info -n email_worker@%h

# Terminal 2: Start payment worker
celery -A app.celery_app worker -Q payments -l info -n payment_worker@%h

# Terminal 3: Start booking worker
celery -A app.celery_app worker -Q bookings -l info -n booking_worker@%h
```

### Method 2: All workers in one (simpler)

```bash
celery -A app.celery_app worker -Q emails,payments,bookings -l info
```

### Method 3: Docker Compose (production)

Already configured in `docker-compose.dev.yml`:

```yaml
celery-worker:
  build: ./backend
  command: celery -A app.celery_app worker -l info
  environment:
    - REDIS_HOST=redis
  depends_on:
    - redis
    - postgres
```

Start with:
```bash
docker-compose -f docker-compose.dev.yml up celery-worker
```

---

## 👀 How to See the Listener in Action:

### 1. Start the worker with verbose logging:

```bash
celery -A app.celery_app worker -Q emails -l debug
```

You'll see:
```
[2025-11-21 21:00:00,123: INFO/MainProcess] Connected to redis://localhost:6379/0
[2025-11-21 21:00:00,456: INFO/MainProcess] celery@email_worker ready.
[2025-11-21 21:00:00,789: INFO/MainProcess] Listening to queue: emails
```

### 2. Cancel a booking:

The worker will show:
```
[2025-11-21 21:00:15,123: INFO/MainProcess] Task app.tasks.email_tasks.send_cancellation[abc-123] received
[2025-11-21 21:00:15,456: INFO/ForkPoolWorker-1] Sending cancellation email to user@example.com
[2025-11-21 21:00:18,789: INFO/ForkPoolWorker-1] ✅ Email sent successfully
[2025-11-21 21:00:18,890: INFO/ForkPoolWorker-1] Task app.tasks.email_tasks.send_cancellation[abc-123] succeeded
```

### 3. Check task status in Python:

```python
from celery.result import AsyncResult
from app.celery_app import celery_app

task_id = "abc-123-def-456"
result = AsyncResult(task_id, app=celery_app)

print(f"Status: {result.status}")
print(f"Result: {result.result}")
```

---

## 📊 Monitor the Listener:

### Install Flower (Web UI):

```bash
pip install flower
celery -A app.celery_app flower --port=5555
```

Visit `http://localhost:5555` to see:
- ✅ Active workers
- ✅ Task queue lengths
- ✅ Task success/failure rates
- ✅ Worker resource usage

---

## 🔍 Summary:

| Component | Location | What it Does |
|-----------|----------|--------------|
| **Celery App** | `app/celery_app.py` | Configuration & setup |
| **Task Definitions** | `app/tasks/email_tasks.py` | Functions to execute |
| **Task Queuing** | `app/api/v1/bookings.py` | `.delay()` adds to queue |
| **Redis Queue** | Running Redis server | Stores queued tasks |
| **THE LISTENER** | `celery worker` command | **Picks up and executes tasks** |

**The listener is the `celery worker` process - it's not a file, it's a running background service!**

---

## ✅ Verification:

To verify the listener is working:

```bash
# 1. Check Redis queue
redis-cli
> LLEN emails  # Should show 0 if all processed
> LLEN celery  # Main queue

# 2. Check worker status
celery -A app.celery_app inspect active
celery -A app.celery_app inspect stats

# 3. Send a test task
python -c "
from app.tasks.email_tasks import send_cancellation_email_task
task = send_cancellation_email_task.delay({}, 'test@example.com')
print(f'Task queued: {task.id}')
"
```

If the worker is running, you'll see it pick up and execute the task!
