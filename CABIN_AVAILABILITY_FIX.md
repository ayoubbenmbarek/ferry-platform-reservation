# Cabin Availability Fix

## Issue Reported
User found **Balcony Cabin available** on PALERMO → TUNIS route, when it should show as unavailable.

## Root Cause Analysis

### Problem 1: Incorrect Default Behavior
**File**: `/frontend/src/components/CabinSelector.tsx`
**Line**: 116 (before fix)

```typescript
// BEFORE (INCORRECT):
const cabinInfo = availabilityData.find((c: any) => c.type === ferryType);
if (!cabinInfo) return { available: true, count: 999 }; // ❌ Wrong! Assumes available
```

**Issue**: If a cabin type wasn't found in the ferry's availability data, the component defaulted to treating it as **available with 999 count**. This meant:
- If ferry has no "balcony" in its cabin_types array → component assumes balcony IS available
- User could select cabins that don't exist on that specific ferry

### Problem 2: Missing Cabin Type in Mock Data
**File**: `/backend/app/services/ferry_integrations/mock.py`

The mock data didn't include "balcony" cabin type in the ferry responses, only:
- interior
- exterior
- suite
- deck

This meant when the frontend looked for "balcony" availability, it didn't find it and fell back to the incorrect default (available: true).

## Solution Implemented

### Fix 1: Correct Default Behavior in CabinSelector.tsx

```typescript
// AFTER (CORRECT):
const cabinInfo = availabilityData.find((c: any) => c.type === ferryType);
if (!cabinInfo) return { available: false, count: 0 }; // ✅ Correct! Treats as unavailable
```

**New Logic**:
1. If no availability data provided → assume all available (backward compatibility)
2. If cabin type not in ferry's availability data → **treat as unavailable** (0 count)
3. If cabin type found → use actual availability from ferry

**Example**:
- Ferry has: `[{type: "interior", available: 5}, {type: "deck", available: 100}]`
- User's cabin database has: Interior, Exterior, Balcony, Suite, Deck
- Result:
  - ✅ Interior: Available (5 count) - found in ferry data
  - ❌ Exterior: **Unavailable** (0 count) - NOT in ferry data
  - ❌ Balcony: **Unavailable** (0 count) - NOT in ferry data
  - ❌ Suite: **Unavailable** (0 count) - NOT in ferry data
  - ✅ Deck: Available (100 count) - found in ferry data

### Fix 2: Added Balcony Cabin Type to Mock Data

**PALERMO → TUNIS** (no cabins available):
```python
cabin_types = [
    {"type": "interior", "available": 0},
    {"type": "exterior", "available": 0},
    {"type": "balcony", "available": 0},  # ← Added
    {"type": "suite", "available": 0},
    {"type": "deck", "available": random.randint(50, 100)}
]
```

**Other Routes** (cabins available):
```python
cabin_types = [
    {"type": "interior", "available": random.randint(3, 15)},
    {"type": "exterior", "available": random.randint(2, 10)},
    {"type": "balcony", "available": random.randint(1, 8)},  # ← Added
    {"type": "suite", "available": random.randint(1, 5)},
    {"type": "deck", "available": random.randint(20, 50)}
]
```

## Expected Behavior After Fix

### For PALERMO → TUNIS:
- ❌ Interior Cabin: **Unavailable** (grayed out, disabled)
- ❌ Exterior Cabin: **Unavailable** (grayed out, disabled)
- ❌ Balcony Cabin: **Unavailable** (grayed out, disabled) ← **Fixed!**
- ❌ Suite: **Unavailable** (grayed out, disabled)
- ✅ Deck Seat: **Available** (can select)

### For Other Routes (e.g., TUNIS → MARSEILLE):
- ✅ Interior Cabin: **Available** (3-15 cabins)
- ✅ Exterior Cabin: **Available** (2-10 cabins)
- ✅ Balcony Cabin: **Available** (1-8 cabins) ← **Now included!**
- ✅ Suite: **Available** (1-5 cabins)
- ✅ Deck Seat: **Available** (20-50 seats)

## Files Modified

1. **frontend/src/components/CabinSelector.tsx**
   - Fixed `getCabinAvailability()` function
   - Changed default from `{ available: true, count: 999 }` to `{ available: false, count: 0 }`
   - Added safety check for empty availability data

2. **backend/app/services/ferry_integrations/mock.py**
   - Added "balcony" cabin type to PALERMO → TUNIS route (available: 0)
   - Added "balcony" cabin type to all other routes (available: 1-8)

## Testing Checklist

### Test PALERMO → TUNIS Route:
- [ ] Select ferry from search results
- [ ] Go to booking page
- [ ] Check cabin selector
- [ ] ✅ All cabin types (Interior, Exterior, Balcony, Suite) should be **grayed out and disabled**
- [ ] ✅ Show "❌ Not Available on this Ferry" message
- [ ] ✅ Only "No Cabin" (Deck Seat) should be selectable

### Test Other Routes (e.g., TUNIS → MARSEILLE):
- [ ] Select ferry from search results
- [ ] Go to booking page
- [ ] Check cabin selector
- [ ] ✅ Interior, Exterior, Balcony, Suite cabins should be **available and selectable**
- [ ] ✅ Show actual availability counts (e.g., "5 cabins available")
- [ ] ✅ Can select and proceed with booking

### Edge Cases:
- [ ] Ferry with partial cabin availability (some types available, some not)
- [ ] Ferry with no availability data (should default to all available)
- [ ] Round-trip booking with different cabin availability on outbound vs return

## Answer to Your Question

> "on palermo tunis i found only Balcony Cabin available is that voulu in advance?"

**Non, ce n'était pas voulu (No, this was not intentional)!**

It was a **bug** caused by:
1. Missing "balcony" type in the mock ferry data
2. Incorrect default behavior (treating unknown cabin types as available)

The fix ensures that:
- ✅ PALERMO → TUNIS shows **ALL cabins as unavailable** (Interior, Exterior, Balcony, Suite)
- ✅ Only Deck Seat is available (as intended for short crossings)
- ✅ Other routes show Balcony cabins properly with availability counts
