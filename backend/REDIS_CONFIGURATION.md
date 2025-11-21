# Redis Configuration Explained

## Port Mapping

```yaml
# docker-compose.dev.yml
redis:
  ports:
    - "6399:6379"  # Host:Container
```

**What this means:**
- **6399**: Port on your **host machine** (localhost)
- **6379**: Port **inside Docker container**

### Access Points:

| Location | Redis URL | Port | Why? |
|----------|-----------|------|------|
| **Inside Docker containers** | `redis://redis:6379/0` | 6379 | Containers talk to each other |
| **From your laptop (localhost)** | `redis://localhost:6399/0` | 6399 | Port mapping to avoid conflicts |

---

## Database Separation (0-15)

Redis has **16 separate databases** (like namespaces):

```
Redis Server (port 6379 in container, 6399 on host)
├── Database 0: General Cache (ferry searches, availability)
│   └── REDIS_URL: redis://redis:6379/0
│
├── Database 1: Celery Tasks & Results
│   ├── CELERY_BROKER_URL: redis://redis:6379/1
│   └── CELERY_RESULT_BACKEND: redis://redis:6379/1
│
├── Database 2-15: Available for future use
```

---

## Why Separate Databases?

### Database 0: Cache Service
```python
# app/services/cache_service.py
REDIS_URL = redis://redis:6379/0  # (or localhost:6399/0)

# Stores:
ferry_search:a1b2c3d4e5 → {search results}
availability:SAIL12345  → {capacity info}
```

**Purpose:**
- ✅ Ferry search results (5 min TTL)
- ✅ Availability data (1 min TTL)
- ✅ Can flush cache without affecting Celery

### Database 1: Celery Queue
```python
# app/celery_app.py
CELERY_BROKER_URL = redis://redis:6379/1
CELERY_RESULT_BACKEND = redis://redis:6379/1

# Stores:
celery:task:abc-123     → {task data}
celery:result:abc-123   → {task result}
emails queue            → [pending email tasks]
payments queue          → [pending payment tasks]
```

**Purpose:**
- ✅ Task queue (pending tasks)
- ✅ Task results (completed tasks)
- ✅ Isolated from cache operations

---

## Configuration in Code

### Inside Docker Containers:

```yaml
# docker-compose.dev.yml
backend:
  environment:
    REDIS_URL: redis://redis:6379/0                    # Cache
    CELERY_BROKER_URL: redis://redis:6379/1            # Celery queue
    CELERY_RESULT_BACKEND: redis://redis:6379/1        # Celery results

celery-worker:
  environment:
    CELERY_BROKER_URL: redis://redis:6379/1
    CELERY_RESULT_BACKEND: redis://redis:6379/1
```

### From Host Machine (your laptop):

```bash
# Cache service (database 0)
redis-cli -p 6399 -n 0
> KEYS ferry_search:*

# Celery tasks (database 1)
redis-cli -p 6399 -n 1
> LLEN emails
> LLEN payments
```

---

## Current Implementation

### ✅ Fixed Code:

**app/celery_app.py:**
```python
# Uses environment variable (works in both Docker and local)
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6399/1")
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6399/1")
```

**app/services/cache_service.py:**
```python
# Parses REDIS_URL from environment
redis_url = os.getenv("REDIS_URL", "redis://localhost:6399/0")
# Automatically handles both:
# - Docker: redis://redis:6379/0
# - Local: redis://localhost:6399/0
```

---

## Testing Connections

### Test Cache Service (Database 0):

```bash
# From host machine
redis-cli -p 6399 -n 0 PING
# Should return: PONG

# From Docker container
docker exec maritime-backend-dev redis-cli -h redis -p 6379 -n 0 PING
# Should return: PONG
```

### Test Celery Queue (Database 1):

```bash
# From host machine
redis-cli -p 6399 -n 1 PING

# Check queue lengths
redis-cli -p 6399 -n 1
> LLEN emails
> LLEN payments
> LLEN bookings
```

### Test from Python:

```python
# Test cache service
from app.services.cache_service import cache_service

if cache_service.is_available():
    print("✅ Cache connected")
else:
    print("❌ Cache not available")

# Test Celery connection
from app.celery_app import celery_app

result = celery_app.control.inspect().ping()
print(f"Celery workers: {result}")
```

---

## Monitoring

### Check Database Sizes:

```bash
redis-cli -p 6399

# Switch to database 0 (cache)
SELECT 0
DBSIZE
INFO memory

# Switch to database 1 (celery)
SELECT 1
DBSIZE
LLEN emails
LLEN payments
```

### Monitor in Real-Time:

```bash
# Watch all Redis commands
redis-cli -p 6399 MONITOR

# You'll see:
# DB 0: Cache operations (GET ferry_search:*, SETEX, DEL)
# DB 1: Celery operations (LPUSH emails, BRPOP, etc.)
```

---

## Summary

| Component | Database | Port (Docker) | Port (Host) | Environment Variable |
|-----------|----------|---------------|-------------|---------------------|
| **Cache** | 0 | 6379 | 6399 | `REDIS_URL` |
| **Celery Queue** | 1 | 6379 | 6399 | `CELERY_BROKER_URL` |
| **Celery Results** | 1 | 6379 | 6399 | `CELERY_RESULT_BACKEND` |

**Key Points:**
- ✅ Containers use `redis:6379` (internal Docker network)
- ✅ Host uses `localhost:6399` (port mapping)
- ✅ Database 0 for cache (can flush without affecting tasks)
- ✅ Database 1 for Celery (isolated task queue)
- ✅ Environment variables handle both Docker and local development
