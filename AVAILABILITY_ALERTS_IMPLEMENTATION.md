# Ferry Availability Alert System - Implementation Guide

## Overview
Comprehensive alert system that notifies users when ferry capacity becomes available for:
- **Vehicles** (car, van, motorcycle, camper, etc.)
- **Cabins** (inside, outside, suite)
- **Passengers** (when route is fully booked)

## Architecture

```
┌─────────────┐
│   User      │
│  Request    │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│  Create Alert   │  ← API Endpoint
│  Save to DB     │
└──────┬──────────┘
       │
       ▼
┌──────────────────────────────────────┐
│    Celery Beat (Scheduler)           │
│                                      │
│  Every 2-6 hours:                    │
│   - check_availability_alerts_task   │
│                                      │
│  Daily:                              │
│   - cleanup_old_alerts_task          │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│  Celery Worker (Background)          │
│                                      │
│  1. Query active alerts from DB      │
│  2. Check ferry API availability     │
│  3. Send email if available          │
│  4. Mark alert as notified           │
└──────────────────────────────────────┘
```

## Database Schema

### Table: `availability_alerts`
- **id**: Primary key
- **user_id**: Foreign key to users (optional for guests)
- **email**: Notification email
- **alert_type**: vehicle | cabin | passenger
- **Search Criteria**:
  - departure_port, arrival_port
  - departure_date, return_date (optional)
  - num_adults, num_children, num_infants
- **Vehicle Specific**:
  - vehicle_type, vehicle_length_cm
- **Cabin Specific**:
  - cabin_type, num_cabins
- **Status Fields**:
  - status: active | notified | expired | cancelled
  - last_checked_at, notified_at, expires_at
  - created_at, updated_at

## Celery Beat Schedule

Add to `backend/app/celery_app.py`:

```python
from celery.schedules import crontab

app.conf.beat_schedule = {
    # Check availability every 4 hours
    'check-availability-alerts': {
        'task': 'app.tasks.availability_check_tasks.check_availability_alerts',
        'schedule': crontab(minute=0, hour='*/4'),  # Every 4 hours
    },
    # Cleanup old alerts daily at 2 AM
    'cleanup-old-alerts': {
        'task': 'app.tasks.availability_check_tasks.cleanup_old_alerts',
        'schedule': crontab(minute=0, hour=2),  # Daily at 2 AM
    },
}
```

## API Endpoints Needed

### 1. Create Alert
```
POST /api/v1/availability-alerts
Body: {
  "alert_type": "vehicle" | "cabin" | "passenger",
  "email": "user@example.com",
  "departure_port": "marseille",
  "arrival_port": "tunis",
  "departure_date": "2025-12-15",
  "is_round_trip": true,
  "return_date": "2025-12-22",
  "num_adults": 2,
  "num_children": 1,
  // Vehicle specific
  "vehicle_type": "car",
  "vehicle_length_cm": 450,
  // Cabin specific
  "cabin_type": "outside",
  "num_cabins": 1
}
```

### 2. List User Alerts
```
GET /api/v1/availability-alerts
```

### 3. Cancel Alert
```
DELETE /api/v1/availability-alerts/{alert_id}
```

### 4. Get Alert Status
```
GET /api/v1/availability-alerts/{alert_id}
```

## Email Template

### Subject
```
🎉 Availability Alert: [Route] is Now Available!
```

### Body (HTML)
```html
<h2>Good News! Your Ferry Route is Now Available</h2>

<p>Hi there,</p>

<p>We found availability for your requested ferry route:</p>

<div class="route-info">
  <strong>Route:</strong> Marseille → Tunis<br>
  <strong>Date:</strong> December 15, 2025<br>
  <strong>Type:</strong> Vehicle (Car)<br>
  <strong>Passengers:</strong> 2 Adults, 1 Child
</div>

<a href="[search_url]" class="cta-button">
  🔍 Search Now
</a>

<p><small>This alert was created on [created_date] and will expire on [expires_date].</small></p>
```

## Performance Considerations

### 1. Rate Limiting
- **Check Frequency**: Every 4 hours (6 times/day)
- **Batch Size**: Max 100 alerts per run
- **Cooldown**: Don't re-check same alert within 2 hours

### 2. Auto-Expiration
- Alerts expire after **30 days** by default
- Old expired/notified alerts cleaned up after **90 days**

### 3. Ferry API Optimization
- Cache search results for 15 minutes
- Use batch queries when possible
- Respect API rate limits (max 100 req/hour per operator)

## Frontend Implementation

### Search Results Page
```tsx
// When no availability found
{!hasAvailability && (
  <div className="no-availability-banner">
    <p>No availability found for your search.</p>
    <button onClick={() => setShowAlertModal(true)}>
      🔔 Notify me when available
    </button>
  </div>
)}
```

### Alert Modal
```tsx
<Modal>
  <h3>Get Notified When Available</h3>
  <p>We'll check every few hours and email you when space becomes available.</p>

  <select name="alert_type">
    <option value="passenger">Any passenger seats</option>
    <option value="vehicle">Vehicle space (car)</option>
    <option value="cabin">Cabin availability</option>
  </select>

  <input type="email" placeholder="your@email.com" />

  <p className="expiry-note">
    Alert active for 30 days from {departure_date}
  </p>

  <button onClick={createAlert}>Create Alert</button>
</Modal>
```

### User Dashboard - Manage Alerts
```tsx
<div className="my-alerts">
  <h2>My Availability Alerts</h2>

  {alerts.map(alert => (
    <AlertCard key={alert.id}>
      <div className="alert-route">
        {alert.departure_port} → {alert.arrival_port}
      </div>
      <div className="alert-date">{alert.departure_date}</div>
      <div className="alert-type">
        {alert.alert_type === 'vehicle' && '🚗 Vehicle'}
        {alert.alert_type === 'cabin' && '🛏️ Cabin'}
        {alert.alert_type === 'passenger' && '👤 Passenger'}
      </div>
      <div className="alert-status">
        {alert.status === 'active' && '🟢 Active'}
        {alert.status === 'notified' && '✅ Notified'}
        {alert.status === 'expired' && '⏰ Expired'}
      </div>
      <button onClick={() => cancelAlert(alert.id)}>Cancel</button>
    </AlertCard>
  ))}
</div>
```

## Migration Steps

1. **Run migration**:
   ```bash
   docker exec maritime-backend-dev alembic upgrade head
   ```

2. **Start Celery Beat** (scheduler):
   ```bash
   docker-compose up -d celery-beat
   ```

   Update `docker-compose.yml`:
   ```yaml
   celery-beat:
     build: ./backend
     command: celery -A app.celery_app beat --loglevel=info
     volumes:
       - ./backend:/app
     environment:
       - DATABASE_URL=${DATABASE_URL}
       - REDIS_URL=${REDIS_URL}
     depends_on:
       - redis
       - postgres
   ```

3. **Verify tasks registered**:
   ```bash
   docker exec maritime-celery-dev celery -A app.celery_app inspect registered
   ```

4. **Monitor task execution**:
   ```bash
   docker logs -f maritime-celery-beat
   docker logs -f maritime-celery-dev
   ```

## Testing

### Manual Test - Trigger Task
```python
from app.tasks.availability_check_tasks import check_availability_alerts_task

# Run immediately
result = check_availability_alerts_task.delay()
print(result.get())
```

### Create Test Alert
```bash
curl -X POST http://localhost:8010/api/v1/availability-alerts \
  -H "Content-Type: application/json" \
  -d '{
    "alert_type": "vehicle",
    "email": "test@example.com",
    "departure_port": "marseille",
    "arrival_port": "tunis",
    "departure_date": "2025-12-15",
    "vehicle_type": "car",
    "num_adults": 2
  }'
```

## Benefits

1. **Non-blocking**: Runs in background, doesn't slow down API
2. **Scalable**: Celery workers can scale horizontally
3. **Reliable**: Auto-retry on failure, persistent queue
4. **Smart**: Only checks when needed, respects API limits
5. **User-friendly**: Automatic notifications, no manual checking

## Monitoring

### Celery Flower (Web UI)
```bash
celery -A app.celery_app flower --port=5555
# Access at http://localhost:5555
```

### Logs
- Check success: `grep "Availability found" celery.log`
- Check errors: `grep "ERROR" celery.log`
- Count notifications: `grep "notification sent" celery.log | wc -l`

## Cost Estimation

- **Ferry API calls**: ~100 alerts × 6 checks/day = 600 API calls/day
- **Email sends**: ~5-10 notifications/day (varies by availability)
- **Database**: Minimal storage (~1KB per alert)

## Next Steps

1. ✅ Database schema created
2. ✅ Models created
3. ✅ Celery tasks created
4. ⏳ Add email template for availability alerts
5. ⏳ Create API endpoints
6. ⏳ Build frontend components
7. ⏳ Configure Celery Beat schedule
8. ⏳ Add monitoring and logging
9. ⏳ Test with real ferry APIs
10. ⏳ Deploy and monitor
