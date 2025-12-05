# 🧪 Availability Alert Testing Guide

Complete guide for testing the ferry availability alert system.

## Overview

The availability alert system allows users to subscribe to notifications when ferry capacity becomes available for their desired route. The system checks every minute (in testing mode) and sends email notifications when space becomes available.

---

## Test Approach: Subscribe → Add Data → Get Notified

### Strategy
1. Create an availability alert for a non-existing route or date
2. Add ferry sailing data for that route
3. Wait for the background task to check (runs every 1 minute)
4. Receive email notification when availability is found

---

## Step 1: Create Availability Alerts

### A. Vehicle Alert (Car/Van)

**API Endpoint:** `POST /api/v1/availability-alerts`

```bash
curl -X POST http://localhost:8010/api/v1/availability-alerts \
  -H "Content-Type: application/json" \
  -d '{
    "alert_type": "vehicle",
    "email": "your-email@gmail.com",
    "departure_port": "tangier",
    "arrival_port": "algeciras",
    "departure_date": "2025-12-15",
    "is_round_trip": false,
    "num_adults": 2,
    "num_children": 0,
    "vehicle_type": "car",
    "vehicle_length_cm": 450,
    "alert_duration_days": 30
  }'
```

**Expected Response:**
```json
{
  "id": 1,
  "alert_type": "vehicle",
  "email": "your-email@gmail.com",
  "departure_port": "tangier",
  "arrival_port": "algeciras",
  "departure_date": "2025-12-15",
  "status": "active",
  "created_at": "2025-11-28T14:30:00Z",
  "expires_at": "2026-01-14T14:30:00Z"
}
```

---

### B. Cabin Alert

```bash
curl -X POST http://localhost:8010/api/v1/availability-alerts \
  -H "Content-Type: application/json" \
  -d '{
    "alert_type": "cabin",
    "email": "your-email@gmail.com",
    "departure_port": "barcelona",
    "arrival_port": "palma",
    "departure_date": "2025-12-20",
    "is_round_trip": true,
    "return_date": "2025-12-27",
    "num_adults": 2,
    "cabin_type": "outside",
    "num_cabins": 1,
    "alert_duration_days": 30
  }'
```

---

### C. Passenger Alert (No Vehicle)

```bash
curl -X POST http://localhost:8010/api/v1/availability-alerts \
  -H "Content-Type: application/json" \
  -d '{
    "alert_type": "passenger",
    "email": "your-email@gmail.com",
    "departure_port": "marseille",
    "arrival_port": "tunis",
    "departure_date": "2025-12-10",
    "num_adults": 4,
    "num_children": 2,
    "num_infants": 1,
    "alert_duration_days": 30
  }'
```

---

## Step 2: List Your Active Alerts

```bash
# Get all your alerts
curl http://localhost:8010/api/v1/availability-alerts

# Filter by status
curl "http://localhost:8010/api/v1/availability-alerts?status=active"
```

---

## Step 3: Add Ferry Sailing Data

Now add sailing data that matches your alert criteria. The system will detect it on the next check (every 1 minute).

### Using the Search API

The availability check uses `ferry_service.search_sailings()` which queries the `/api/v1/ferries/search` endpoint.

**Add a sailing for your alert:**

```bash
# Example: Add sailing that matches the vehicle alert
curl -X POST http://localhost:8010/api/v1/ferries/search \
  -H "Content-Type: application/json" \
  -d '{
    "departure_port": "tangier",
    "arrival_port": "algeciras",
    "departure_date": "2025-12-15",
    "adults": 2,
    "children": 0,
    "vehicles": [{
      "type": "car",
      "length": 450,
      "width": 180,
      "height": 150
    }]
  }'
```

**Key Fields for Availability Detection:**

**For Vehicle Alerts:**
- Sailing must have `"has_vehicle_space": true`

**For Cabin Alerts:**
- Sailing must have `"available_cabins"` array with enough cabins

**For Passenger Alerts:**
- Sailing must have `"available_seats" >= total_passengers`

---

## Step 4: Monitor Background Task

The Celery Beat task runs every **1 minute** (testing mode).

### Watch Celery Logs

```bash
# Watch Celery Beat scheduler
docker logs -f maritime-celery-beat-dev

# Watch Celery Worker execution
docker logs -f maritime-celery-dev | grep availability

# Watch for email notifications
docker logs -f maritime-celery-dev | grep "Sending availability alert"
```

**Expected Log Output:**

```
[14:31:00] 🔍 Starting availability alerts check...
[14:31:00] 📋 Found 1 active alerts to check
[14:31:01] 🎉 Availability found for alert #1: tangier → algeciras
[14:31:01] 📧 Sending availability alert email to your-email@gmail.com
[14:31:02] ✅ Availability alert sent successfully
[14:31:02] Alert #1 marked as notified
```

---

## Step 5: Check Your Email

You should receive an email with:

**Subject:** `🎉 Vehicle Space Now Available: tangier → algeciras`

**Content:**
- Route details (Tangier → Algeciras)
- Departure date
- Passenger count
- Vehicle information
- "Search & Book Now" button

---

## Verification Steps

### 1. Check Alert Status Changed

```bash
# Get specific alert
curl http://localhost:8010/api/v1/availability-alerts/1
```

**Expected Response:**
```json
{
  "id": 1,
  "status": "notified",  // Changed from "active"
  "last_checked_at": "2025-11-28T14:31:00Z",
  "notified_at": "2025-11-28T14:31:02Z"
}
```

### 2. Check Database Directly

```bash
# Connect to database
docker exec -it maritime-postgres-dev psql -U postgres -d maritime_reservations_dev

# Query alerts
SELECT id, email, departure_port, arrival_port, status, notified_at
FROM availability_alerts
ORDER BY created_at DESC
LIMIT 5;
```

---

## Quick Test Script

Here's a complete test script you can run:

```bash
#!/bin/bash

echo "=== Step 1: Create Alert ==="
ALERT_ID=$(curl -s -X POST http://localhost:8010/api/v1/availability-alerts \
  -H "Content-Type: application/json" \
  -d '{
    "alert_type": "vehicle",
    "email": "test@example.com",
    "departure_port": "test_port_a",
    "arrival_port": "test_port_b",
    "departure_date": "2025-12-25",
    "num_adults": 2,
    "vehicle_type": "car",
    "vehicle_length_cm": 450
  }' | jq -r '.id')

echo "Created alert ID: $ALERT_ID"

echo ""
echo "=== Step 2: Wait 70 seconds for task to run ==="
sleep 70

echo ""
echo "=== Step 3: Check alert status ==="
curl -s http://localhost:8010/api/v1/availability-alerts/$ALERT_ID | jq

echo ""
echo "=== Step 4: Check Celery logs ==="
docker logs maritime-celery-dev --tail 30 | grep "availability"
```

---

## Troubleshooting

### Alert Not Triggering?

**Check 1: Alert is Active**
```bash
curl http://localhost:8010/api/v1/availability-alerts | jq '.[] | select(.status=="active")'
```

**Check 2: Departure Date is in Future**
- Alerts with past departure dates are automatically expired

**Check 3: Task is Running**
```bash
docker logs maritime-celery-beat-dev --tail 5
```
Should show: `Scheduler: Sending due task check-availability-alerts`

**Check 4: Ferry Service Returns Data**
```bash
curl -X POST http://localhost:8010/api/v1/ferries/search \
  -H "Content-Type: application/json" \
  -d '{
    "departure_port": "tangier",
    "arrival_port": "algeciras",
    "departure_date": "2025-12-15"
  }' | jq
```

### Email Not Received?

**Check 1: SMTP Configuration**
```bash
docker exec maritime-celery-dev printenv | grep SMTP
```

**Check 2: Email Service Logs**
```bash
docker logs maritime-celery-dev | grep "Email sent"
```

**Check 3: Email Template Exists**
```bash
ls backend/app/templates/emails/availability_alert.html
```

---

## Advanced: Mock Availability in Ferry Service

If you want to force availability without real data, you can temporarily modify the ferry service mock:

**Option 1: Modify Mock Data** (`backend/app/services/ferry_service.py`)

**Option 2: Add Test Endpoint** (create a debug endpoint that returns available sailings)

**Option 3: Database Direct Insert** (insert mock sailing data directly)

---

## Cleanup

### Delete Test Alerts

```bash
# Delete specific alert
curl -X DELETE http://localhost:8010/api/v1/availability-alerts/1

# Or delete all via database
docker exec -it maritime-postgres-dev psql -U postgres -d maritime_reservations_dev \
  -c "DELETE FROM availability_alerts WHERE email = 'test@example.com';"
```

---

## Production Checklist

Before deploying to production:

- [ ] Change check interval from 1 minute to 1-2 hours (`celery_app.py:89`)
- [ ] Set up proper SMTP credentials
- [ ] Add rate limiting to alert creation endpoint
- [ ] Set up monitoring/alerting for failed tasks
- [ ] Add Flower dashboard for task monitoring
- [ ] Test email deliverability (check spam folders)
- [ ] Add unsubscribe link to emails
- [ ] Limit alerts per user/email

---

## Current Configuration

**Check Frequency:** Every 1 minute (testing)
**Task Expiration:** 5 minutes
**Alert Duration:** 30 days (configurable)
**Cooldown Period:** 2 hours between checks (to avoid API rate limits)
**Max Alerts Per Run:** 100

**To change check frequency to hourly (production):**

Edit `backend/app/celery_app.py:89`:
```python
'schedule': 3600,  # 1 hour
```

Then restart:
```bash
docker-compose -f docker-compose.dev.yml restart celery-beat
```
