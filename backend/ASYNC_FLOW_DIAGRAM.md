# Async Flow Diagrams

## 1. Ferry Search with Caching

```
┌─────────────┐
│   User      │
│  searches   │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────┐
│  GET /api/v1/ferry/search   │
└──────┬──────────────────────┘
       │
       ▼
┌──────────────────┐
│ Check Redis Cache│ ──Yes──▶ Return cached results (< 50ms)
└──────┬───────────┘
       │ No (Cache miss)
       ▼
┌───────────────────────┐
│ Call Ferry Operators  │ (500-2000ms)
│  (CTN, GNV, etc.)    │
└──────┬────────────────┘
       │
       ▼
┌───────────────────────┐
│  Cache Results        │
│  TTL: 5 minutes       │
└──────┬────────────────┘
       │
       ▼
┌───────────────────────┐
│  Return Results       │
└───────────────────────┘
```

**Cache Invalidation:**
- Automatic: After 5 minutes (TTL expires)
- Manual: When booking confirmed/cancelled


## 2. Payment & Email Flow (Async)

```
┌──────────────────┐
│  User clicks     │
│ "Pay Now"        │
└────────┬─────────┘
         │
         ▼
┌────────────────────────────┐
│ 1. Check Availability      │ ─────────────┐
│    (Real-time via task)    │              │
└────────┬───────────────────┘              │
         │ Available ✓                      │
         ▼                                  │
┌────────────────────────────┐              │
│ 2. Create Stripe Payment   │              │
│    Intent                  │              │
└────────┬───────────────────┘              │
         │                                  │
         ▼                                  ▼
┌────────────────────────────┐     ┌──────────────────┐
│ 3. User enters card        │     │  REDIS QUEUE     │
│    details on frontend     │     │  (Celery Broker) │
└────────┬───────────────────┘     └──────────────────┘
         │
         ▼
┌────────────────────────────┐
│ 4. Stripe processes payment│
│    (client-side)           │
└────────┬───────────────────┘
         │
         ▼
┌────────────────────────────────────┐
│ 5. Stripe Webhook                  │
│    POST /webhooks/stripe           │
│    Event: payment_intent.succeeded │
└────────┬───────────────────────────┘
         │ Returns 200 immediately
         │
         ▼
┌─────────────────────────────────────┐
│ 6. Queue Payment Task               │
│    process_payment_webhook_task()   │
│    → Goes to "payments" queue       │
└────────┬────────────────────────────┘
         │
         │
    ╔════▼═══════════════════════╗
    ║  PAYMENT WORKER (Worker 2) ║
    ╚════╤═══════════════════════╝
         │
         ▼
┌──────────────────────────────────┐
│ 7. Update Payment Status         │
│    - payment.status = COMPLETED  │
│    - booking.status = CONFIRMED  │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ 8. Invalidate Availability Cache │
│    (ferry now has 1 less seat)   │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ 9. Queue Email Task              │
│    send_payment_success_email()  │
│    → Goes to "emails" queue      │
└────────┬─────────────────────────┘
         │
         │
    ╔════▼══════════════════╗
    ║  EMAIL WORKER (Worker 1) ║
    ╚════╤══════════════════╝
         │
         ▼
┌──────────────────────────────────┐
│ 10. Send Confirmation Email      │
│     - Booking details            │
│     - Payment receipt            │
│     - QR code (if applicable)    │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ ✅ User receives email           │
│    (5-15 seconds after payment)  │
└──────────────────────────────────┘
```

**Total Time:**
- User payment → Database updated: **2-5 seconds**
- User payment → Email received: **5-15 seconds**
- API response time: **< 1 second** (doesn't wait for email)


## 3. Cancellation Flow (Async)

```
┌──────────────────┐
│  User/Admin      │
│  cancels booking │
└────────┬─────────┘
         │
         ▼
┌────────────────────────────┐
│ POST /bookings/{id}/cancel │
└────────┬───────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ 1. Update Booking Status        │
│    - status = CANCELLED         │
│    - set cancellation_reason    │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ 2. Create Stripe Refund         │
│    - refund via Stripe API      │
│    - update refund_processed    │
└────────┬────────────────────────┘
         │ Returns 200 immediately
         ▼
┌─────────────────────────────────┐
│ 3. Queue Cancellation Email     │
│    send_cancellation_email()    │
│    → Goes to "emails" queue     │
└────────┬────────────────────────┘
         │
         │
    ╔════▼══════════════════╗
    ║  EMAIL WORKER (Worker 1) ║
    ╚════╤══════════════════╝
         │
         ▼
┌─────────────────────────────────┐
│ 4. Send Cancellation Email      │
│    - Cancellation confirmation  │
│    - Refund details             │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ 5. Queue Operator Cancel Task   │
│    cancel_booking_with_operator()│
│    → Goes to "bookings" queue   │
└────────┬────────────────────────┘
         │
         │
    ╔════▼═════════════════════╗
    ║  BOOKING WORKER (Worker 3)║
    ╚════╤═════════════════════╝
         │
         ▼
┌─────────────────────────────────┐
│ 6. Cancel with Ferry Operator   │
│    (API call to CTN/GNV/etc.)   │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ 7. Invalidate Availability Cache│
│    (ferry now has 1 more seat)  │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ ✅ Cancellation Complete         │
│    - User notified via email    │
│    - Refund processed           │
│    - Operator notified          │
└─────────────────────────────────┘
```

**Timeline:**
- API response: **< 2 seconds**
- Email sent: **5-10 seconds** after cancellation
- Operator notified: **10-30 seconds** after cancellation
- Refund visible in bank: **5-10 business days** (Stripe/bank processing)


## 4. Cache Invalidation Strategy

### When to Invalidate Cache:

| Event | Cache Action | Reason |
|-------|--------------|--------|
| Booking confirmed | Invalidate specific sailing | Capacity reduced |
| Booking cancelled | Invalidate specific sailing | Capacity increased |
| Search expires (5 min) | Auto-expires (TTL) | Prices/availability may change |
| Admin price update | Clear all caches | Ensure fresh pricing |
| Ferry schedule change | Clear route caches | Timing changed |

### Cache Keys:

```python
# Search results
ferry_search:{hash_of_params}

# Availability
availability:{sailing_id}

# Example:
ferry_search:a1b2c3d4e5  → List of ferries for "Tunis → Marseille, Dec 25"
availability:SAIL12345    → Current capacity for specific sailing
```

### Cache Hit Rates (Target):

- **First search**: 0% hit (cache miss)
- **Same route within 5 min**: **100% hit** (cached)
- **Popular routes**: **70-90% hit** (many users search same routes)
- **Off-peak routes**: **20-40% hit** (less traffic)


## 5. Worker Responsibilities

### Worker 1: Email Queue
- ✉️ Booking confirmations
- ✉️ Payment receipts
- ✉️ Cancellation notices
- ✉️ Refund confirmations
- ✉️ Password resets
- ✉️ Promotional emails

**Retries**: 3 attempts, exponential backoff up to 10 minutes

### Worker 2: Payment Queue
- 💳 Stripe webhook processing
- 💳 Payment status verification
- 💳 Refund processing
- 💳 Payment reconciliation

**Retries**: 5 attempts, exponential backoff up to 5 minutes

### Worker 3: Booking Queue
- 🚢 Availability checks
- 🚢 Operator booking confirmation
- 🚢 Operator cancellation
- 🚢 Schedule synchronization
- 🚢 Price updates

**Retries**: 3 attempts, exponential backoff up to 3 minutes


## 6. Error Handling

### Email Fails to Send:
```
Attempt 1: Immediate
  ↓ Failed
Attempt 2: +1 minute
  ↓ Failed
Attempt 3: +3 minutes
  ↓ Failed
Attempt 4: +7 minutes (with jitter)
  ↓ Failed
→ Admin alert: "Email delivery failed after 4 attempts"
```

### Payment Webhook Processing:
```
Webhook received → Queue task → Worker processes
  ↓ If worker fails:
Retry 1: +1 minute
Retry 2: +2 minutes
Retry 3: +4 minutes
Retry 4: +8 minutes
Retry 5: +16 minutes
  ↓ If all fail:
→ Dead letter queue for manual review
```

## 7. Monitoring

### Key Metrics to Track:

1. **Cache Performance**
   - Hit rate %
   - Average response time (cached vs uncached)
   - Cache size / memory usage

2. **Queue Health**
   - Queue length (should be < 100)
   - Processing time per task
   - Failed task count

3. **Email Delivery**
   - Success rate (target: >99%)
   - Average delivery time
   - Bounce rate

4. **Worker Status**
   - Active workers count
   - Tasks processed per minute
   - Memory/CPU usage

### Alert Thresholds:

- Queue length > 500: Scale up workers
- Email success rate < 95%: Check SMTP
- Cache hit rate < 50%: Review TTL settings
- Worker offline > 5 minutes: Restart service
