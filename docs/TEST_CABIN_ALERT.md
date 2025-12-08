# Cabin Alert Test Scenario

## Test Setup Complete ✅

### What Was Configured:

1. **Mock Route with No Cabins**: PALERMO → TUNIS
   - This is a short 11-hour crossing
   - All cabin types show `available: 0`
   - Only deck seats available (50-100 seats)
   - Realistic scenario for daytime ferry

2. **Frontend Detection**: AvailabilitySummaryPanel now detects:
   - No cabins available (0 across all types)
   - Limited cabins (≤2 total cabins)
   - Excludes deck seats from cabin count

3. **Alert Types Supported**:
   - ✅ Passenger alerts
   - ✅ Vehicle alerts
   - ✅ Cabin alerts (NEW!)

## How to Test:

### Step 1: Search for PALERMO → TUNIS

```
Frontend Search Form:
- From: Palermo, Italy
- To: Tunis, Tunisia
- Date: Any future date (e.g., 2025-12-10)
- Passengers: 1 adult
- Vehicles: 0 (optional)
```

### Step 2: Expected Results

You should see **2-3 ferry results** with:
- ✅ Passengers available (50-200 seats)
- ✅ Vehicles available (20-80 spaces)
- ❌ Cabins: All 0 (Interior: 0, Exterior: 0, Suite: 0)
- ✅ Deck Seats: 50-100 available

### Step 3: Availability Summary Panel Should Appear

```
┌─────────────────────────────────────────────────────┐
│ ℹ️  Not finding what you need?                      │
│                                                      │
│ 🔔 No cabins available          [Notify me]        │
│                                                      │
│ We'll check every few hours and email you when     │
│ availability opens up                               │
└─────────────────────────────────────────────────────┘
```

### Step 4: Create Cabin Alert

**Option A - Guest User:**
1. Click "Notify me" button
2. Email input appears inline
3. Enter: `your@email.com`
4. Click "Notify" button
5. Toast appears: "✅ We'll notify you when cabins become available!"

**Option B - Logged-in User:**
1. Click "Notify me" button
2. Alert created instantly (no email input)
3. Toast appears immediately

### Step 5: Verify Alert in Database

```bash
docker exec maritime-postgres-dev psql -U postgres -d maritime_reservations_dev -c "SELECT id, email, alert_type, departure_port, arrival_port, cabin_type, status FROM availability_alerts WHERE alert_type = 'cabin' ORDER BY id DESC LIMIT 5;"
```

Expected output:
```
 id |        email         | alert_type | departure_port | arrival_port | cabin_type | status
----+----------------------+------------+----------------+--------------+------------+--------
 XX | your@email.com       | cabin      | palermo        | tunis        | inside     | active
```

## API Test (Alternative)

You can also test via direct API call:

```bash
curl -X POST http://localhost:8010/api/v1/availability-alerts \
  -H "Content-Type: application/json" \
  -d '{
    "alert_type": "cabin",
    "email": "test@example.com",
    "departure_port": "palermo",
    "arrival_port": "tunis",
    "departure_date": "2025-12-10",
    "is_round_trip": false,
    "return_date": null,
    "num_adults": 1,
    "num_children": 0,
    "num_infants": 0,
    "cabin_type": "inside",
    "num_cabins": 1,
    "alert_duration_days": 30
  }'
```

Expected response (201 Created):
```json
{
  "id": XX,
  "alert_type": "cabin",
  "email": "test@example.com",
  "departure_port": "palermo",
  "arrival_port": "tunis",
  "departure_date": "2025-12-10",
  "cabin_type": "inside",
  "status": "active",
  ...
}
```

## Testing Cabin Availability Detection

To test when cabins become available later, you can:

### Option 1: Manually Update Mock Data

Edit `backend/app/services/ferry_integrations/mock.py` and change PALERMO → TUNIS cabins from `0` to a positive number.

### Option 2: Trigger Alert Check

Wait for the background task to run (every minute), or manually trigger:

```bash
# Check Celery worker logs
docker logs maritime-celery-dev --tail 50 | grep cabin
```

When cabins become available, you should receive an email notification!

## Other Routes to Test

### Routes WITH Cabins (for comparison):

1. **GENOA → TUNIS** (24 hours)
   - Interior: 3-15 cabins
   - Exterior: 2-10 cabins
   - Suite: 1-5 cabins

2. **MARSEILLE → TUNIS** (21 hours)
   - All cabin types available

3. **CIVITAVECCHIA → TUNIS** (22 hours)
   - All cabin types available

### Expected Behavior:
- Panel should NOT appear for these routes (cabins available)
- Unless you search when cabins are very limited (≤2 total)

## Cabin Alert Email Template

When cabins become available, users receive:

**Subject**: 🎉 Cabin Now Available: Palermo → Tunis

**Body**:
```
Good news! Cabins are now available for your route.

Route: Palermo → Tunis
Date: December 10, 2025
Passengers: 1 Adult
Cabin Type: Inside Cabin

[Search Ferries Now]

We'll keep checking until your departure date.
```

## Summary

✅ **PALERMO → TUNIS**: No cabins (test route)
✅ **All other routes**: Cabins available (normal routes)
✅ **Panel shows**: "🔔 No cabins available"
✅ **One-click alert**: Creates cabin availability alert
✅ **Background check**: Runs every minute
✅ **Email notification**: Sent when cabins become available

## Screenshots

### Before (No Cabins):
```
Ferry Results (PALERMO → TUNIS)
┌─────────────────────────────────────┐
│ CTN Ferry                           │
│ Interior Cabin: €25 (0 available)   │
│ Exterior Cabin: €45 (0 available)   │
│ Suite: €120 (0 available)           │
│ Deck Seat: FREE (87 available) ✅   │
└─────────────────────────────────────┘

[Availability Panel Appears]
🔔 No cabins available [Notify me]
```

### After Notification:
```
Email Alert Created:
- Type: cabin
- Route: palermo → tunis
- Cabin Type: inside
- Status: active
- Checked: Every 5 minutes
```

Ready to test! 🚀
