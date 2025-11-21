# Email & Cache FAQ

## Question 1: When are confirmation emails sent?

### **Answer: Emails are sent ASYNCHRONOUSLY by dedicated workers**

### Booking Confirmation Email Flow:

```
User completes booking → Returns response immediately
                      ↓
              Queue email task (< 100ms)
                      ↓
          Email worker picks up task (1-3 seconds)
                      ↓
            Send email via SMTP (2-5 seconds)
                      ↓
        User receives email (5-15 seconds total)
```

### Cancellation Email Flow (Asynchronous with Listener):

**✅ YES - Cancellation emails work asynchronously with listeners!**

```
User/Admin cancels booking
        ↓
API updates database (status = CANCELLED, refund created)
        ↓
API returns 200 OK immediately (< 2 seconds)
        ↓
Queue cancellation email task → Goes to "emails" queue
        ↓
EMAIL WORKER (Listener) picks up task
        ↓
Sends cancellation email with refund details
        ↓
User receives email (5-15 seconds after cancellation)
```

**Key Point**: The API doesn't wait for the email. The email worker acts as a "listener" that processes queued tasks independently.

### Payment Success Email Flow (Webhook + Worker):

```
Stripe Payment Success
        ↓
Stripe sends webhook to /webhooks/stripe
        ↓
Webhook endpoint queues payment task → Returns 200 immediately
        ↓
PAYMENT WORKER processes webhook (2-5 seconds)
        ↓
Updates payment.status = COMPLETED
Updates booking.status = CONFIRMED
        ↓
Queues email task → Goes to "emails" queue
        ↓
EMAIL WORKER sends payment confirmation
        ↓
User receives email (10-20 seconds after payment)
```

### Refund Confirmation Email:

```
Admin/User refunds booking
        ↓
Stripe refund created
        ↓
API returns response immediately
        ↓
Queue refund email task
        ↓
EMAIL WORKER sends refund confirmation
        ↓
User receives email (5-15 seconds)
```

### Timeline Summary:

| Event | API Response Time | Email Delivery Time | Total Time |
|-------|-------------------|---------------------|------------|
| Booking Created | < 1 second | 5-15 seconds | 5-15 seconds |
| Payment Success | < 1 second (webhook) | 10-20 seconds | 10-20 seconds |
| Cancellation | < 2 seconds | 5-15 seconds | 7-17 seconds |
| Refund | < 2 seconds | 5-15 seconds | 7-17 seconds |

**Benefits:**
- ✅ Fast API responses (don't wait for email)
- ✅ Automatic retries if email fails
- ✅ Can scale email workers independently
- ✅ User experience not affected by slow SMTP servers

---

## Question 2: When is cache updated/invalidated?

### **Answer: Cache is invalidated on specific events + auto-expires**

### Cache Strategy:

#### 1. **Ferry Search Results** (TTL: 5 minutes)

**When Cached:**
```python
# User searches for ferries
GET /api/v1/ferry/search?from=tunis&to=marseille&date=2025-12-25

# Check cache first
cached = cache_service.get_ferry_search(search_params)
if cached:
    return cached  # ⚡ Fast response (< 50ms)

# Cache miss - fetch from operators
results = await ferry_service.search(search_params)

# Cache for 5 minutes
cache_service.set_ferry_search(search_params, results, ttl=300)
```

**When Invalidated:**
- ⏱️ **Auto-expires after 5 minutes** (TTL)
- 🔄 **After booking confirmed** (capacity changed)
- ❌ **After booking cancelled** (capacity increased)
- 🛠️ **Admin updates prices/schedules** (manual clear)

**Example:**
```
10:00:00 - User searches Tunis→Marseille (cache MISS, stores result)
10:02:00 - Another user searches same route (cache HIT ✅, returns instantly)
10:03:00 - Someone books this ferry → Invalidate cache
10:03:01 - Next search (cache MISS, fetches fresh data with updated capacity)
10:05:00 - Cache auto-expires (TTL reached)
```

#### 2. **Availability Data** (TTL: 1 minute)

**When Cached:**
```python
# Before payment, check real-time availability
availability = cache_service.get_availability(sailing_id)

if not availability:
    # Cache miss - check with operator
    availability = await check_ferry_availability_task.apply_async(...).get()
    cache_service.set_availability(sailing_id, availability, ttl=60)
```

**When Invalidated:**
- ⏱️ **Auto-expires after 1 minute** (shorter TTL for real-time data)
- 📝 **After booking confirmed** → `invalidate_sailing_availability(sailing_id)`
- ❌ **After booking cancelled** → `invalidate_sailing_availability(sailing_id)`

#### 3. **Route-Specific Invalidation**

```python
# When admin updates ferry schedule or prices for a route
cache_service.invalidate_route_searches("tunis", "marseille")
# Clears all cached searches for Tunis → Marseille
```

### Cache Invalidation in Code:

#### After Booking Confirmed:

```python
# In payment webhook task (payment_tasks.py)
async def process_payment_webhook_task(...):
    # Update booking status
    booking.status = BookingStatusEnum.CONFIRMED
    db.commit()

    # Invalidate cache for this sailing
    cache_service.invalidate_sailing_availability(booking.sailing_id)

    # Also invalidate search results for this route
    cache_service.invalidate_route_searches(
        booking.departure_port,
        booking.arrival_port
    )
```

#### After Cancellation:

```python
# In cancellation endpoint (bookings.py)
@router.post("/{booking_id}/cancel")
async def cancel_booking(...):
    # Process cancellation
    booking.status = BookingStatusEnum.CANCELLED
    db.commit()

    # Invalidate availability cache (ferry now has more seats)
    cache_service.invalidate_sailing_availability(booking.sailing_id)

    # Optionally invalidate route searches
    cache_service.invalidate_route_searches(
        booking.departure_port,
        booking.arrival_port
    )

    # Queue cancellation email (async)
    send_cancellation_email_task.delay(...)
```

### Cache Hit Rate Expectations:

| Scenario | Expected Hit Rate | Benefit |
|----------|------------------|---------|
| Popular routes (Tunis↔Marseille) | 70-90% | Most searches return instantly |
| Same user searches twice | 100% (if < 5 min) | Instant results |
| After booking confirmed | 0% (cache invalidated) | Fresh data with updated capacity |
| Off-peak routes | 20-40% | Less traffic, fewer hits |
| Admin price update | 0% (cache cleared) | All users get new prices |

### Cache Performance Metrics:

```
Cache HIT:  🚀 Response time: 30-100ms
Cache MISS: 🐌 Response time: 500-2000ms (API calls)

Speed improvement: 10-50x faster!
```

### Visual Timeline:

```
User A searches → Cache MISS → Fetch from API (1500ms) → Cache result
      ↓ (0:00)
User B searches (same route) → Cache HIT → Return instantly (50ms) ✅
      ↓ (2:30)
User C books ferry → Payment success → Invalidate cache 🗑️
      ↓ (2:35)
User D searches → Cache MISS → Fetch fresh data (1200ms) → Cache result
      ↓ (5:00 - TTL expired)
User E searches → Cache MISS → Auto-refresh → Cache result
```

---

## Monitoring Cache Performance

### Check Cache Stats:

```bash
# Redis CLI
redis-cli

# Check cache keys
> KEYS ferry_search:*
> KEYS availability:*

# Check cache size
> DBSIZE

# Check memory usage
> INFO memory

# Monitor cache hits/misses
> INFO stats
```

### Python Code to Monitor:

```python
from app.services.cache_service import cache_service

# Check if Redis is available
if cache_service.is_available():
    print("✅ Redis connected")
else:
    print("❌ Redis offline - caching disabled")

# Clear all searches (maintenance)
deleted = cache_service.clear_all_ferry_searches()
print(f"Cleared {deleted} cache entries")
```

---

## Summary

### Email Delivery:
- ✅ **Asynchronous** - API returns immediately
- ✅ **Reliable** - Automatic retries on failure
- ✅ **Fast** - 5-20 seconds delivery time
- ✅ **Scalable** - Workers can be scaled independently

### Cache Updates:
- ⏱️ **Auto-expire**: 5 min (searches), 1 min (availability)
- 📝 **On booking**: Invalidate sailing availability + route searches
- ❌ **On cancel**: Invalidate sailing availability + route searches
- 🛠️ **Admin action**: Manual cache clear for price/schedule updates

### Benefits:
- 🚀 10-50x faster search responses (with cache hits)
- 📧 Non-blocking email delivery
- 🔄 Always fresh data when capacity changes
- 💪 Scalable architecture for high traffic
