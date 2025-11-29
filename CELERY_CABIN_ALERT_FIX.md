# Celery Cabin Alert Fix

## Error Reported
```
TypeError: FerryService.search_ferries() got an unexpected keyword argument 'cabin_required'
```

## Root Cause

**File**: `/backend/app/tasks/availability_check_tasks.py`
**Lines**: 143-144 (before fix)

The Celery task was trying to pass `cabin_required` and `cabin_type` as parameters to `FerryService.search_ferries()`, but those parameters don't exist in the method signature.

```python
# BEFORE (INCORRECT):
elif alert.alert_type == "cabin":
    search_params["cabin_required"] = True  # ❌ Not a valid parameter
    search_params["cabin_type"] = alert.cabin_type or "inside"  # ❌ Not a valid parameter
    results = asyncio.run(ferry_service.search_ferries(**search_params))
```

### FerryService.search_ferries() Signature
```python
async def search_ferries(
    self,
    departure_port: str,
    arrival_port: str,
    departure_date: date,
    return_date: Optional[date] = None,
    return_departure_port: Optional[str] = None,
    return_arrival_port: Optional[str] = None,
    adults: int = 1,
    children: int = 0,
    infants: int = 0,
    vehicles: Optional[List[Dict]] = None,
    operators: Optional[List[str]] = None
) -> List[FerryResult]:
```

**Notice**: No `cabin_required` or `cabin_type` parameters!

## Solution

The `search_ferries()` method **already returns cabin availability** in the results via the `cabin_types` attribute. We don't need to filter during the search - we can filter the results afterward.

### Fixed Code

```python
elif alert.alert_type == "cabin":
    # Check if route has cabin availability
    # Note: cabin_required and cabin_type are not parameters of search_ferries()
    # We'll search normally and filter results by cabin availability

    # Call async ferry search (run in sync context)
    results = asyncio.run(ferry_service.search_ferries(**search_params))

    # Check if any sailing has cabin space
    for result in results:
        # Check operator match (if alert is for specific operator)
        if alert.operator and result.operator != alert.operator:
            continue

        # Check sailing time match (if alert is for specific sailing time)
        if alert.sailing_time:
            result_time = datetime.fromisoformat(str(result.departure_time)).time()
            if result_time != alert.sailing_time:
                continue

        # Check cabin availability
        cabin_types = getattr(result, "cabin_types", [])

        # If alert has specific cabin type preference, check that type
        if alert.cabin_type:
            # Map alert cabin types to ferry API types
            cabin_type_map = {
                "inside": "interior",
                "interior": "interior",
                "outside": "exterior",
                "exterior": "exterior",
                "balcony": "balcony",
                "suite": "suite"
            }
            ferry_cabin_type = cabin_type_map.get(alert.cabin_type.lower(), alert.cabin_type.lower())
            available_cabins = [c for c in cabin_types if c.get("type") == ferry_cabin_type and c.get("available", 0) >= (alert.num_cabins or 1)] if cabin_types else []
        else:
            # Any cabin type is acceptable
            available_cabins = [c for c in cabin_types if c.get("available", 0) >= (alert.num_cabins or 1)] if cabin_types else []

        if available_cabins:
            availability_found = True
            cabin_type_str = f" ({ferry_cabin_type})" if alert.cabin_type else ""
            logger.info(f"🛏️ Found cabin availability{cabin_type_str}: {len(available_cabins)} cabin types available on {result.operator}")
            break
```

## Key Improvements

1. **Removed Invalid Parameters**: No longer trying to pass `cabin_required` and `cabin_type` to `search_ferries()`

2. **Added Cabin Type Mapping**: Properly maps user-facing cabin types to ferry API types:
   - "inside" / "interior" → "interior"
   - "outside" / "exterior" → "exterior"
   - "balcony" → "balcony"
   - "suite" → "suite"

3. **Specific Cabin Type Filtering**: If user wants a specific cabin type (e.g., "balcony"), only check for that type's availability

4. **Any Cabin Type Option**: If no specific cabin type preference, accept any available cabin

5. **Better Logging**: Shows which cabin type was found (e.g., "Found cabin availability (balcony)")

## How It Works Now

### Example 1: User Wants Balcony Cabin Alert
1. User creates alert for balcony cabin on TUNIS → MARSEILLE
2. Celery task searches ferries normally (no cabin filters in search)
3. For each ferry result:
   - Check if operator matches (if specified)
   - Check if sailing time matches (if specified)
   - Look in `result.cabin_types` for type="balcony"
   - Check if `available >= num_cabins` requested
4. If found → Send email notification

### Example 2: User Wants Any Cabin Alert
1. User creates alert for "cabin" (no specific type) on TUNIS → GENOA
2. Celery task searches ferries normally
3. For each ferry result:
   - Check if operator matches
   - Check if sailing time matches
   - Look in `result.cabin_types` for ANY cabin with `available >= num_cabins`
4. If found → Send email notification

## Testing

### Test Cabin Alerts:
1. ✅ Create alert for specific cabin type (e.g., "balcony")
2. ✅ Create alert for any cabin type
3. ✅ Verify Celery worker no longer throws TypeError
4. ✅ Verify cabin availability notifications are sent correctly
5. ✅ Check logs show correct cabin type in message

### Expected Celery Logs (Success):
```
🔍 Starting availability alerts check...
📋 Found 4 active alerts to check
🛏️ Found cabin availability (balcony): 1 cabin types available on CTN
✅ Availability found for alert 19 (cabin)
📧 Availability notification sent to user@example.com
🎉 Availability check complete: checked 4, notified 1
```

## Files Modified

1. **backend/app/tasks/availability_check_tasks.py**
   - Removed invalid `cabin_required` and `cabin_type` parameters
   - Added cabin type mapping logic
   - Improved cabin availability filtering
   - Better logging with cabin type information

## Deployment

The Celery worker has been restarted to apply the fix:
```bash
docker-compose -f docker-compose.dev.yml restart celery-worker
```

## Status

✅ **FIXED** - Celery worker will no longer throw TypeError for cabin alerts
✅ **TESTED** - Logic properly filters cabin availability from search results
✅ **DEPLOYED** - Worker restarted with new code
