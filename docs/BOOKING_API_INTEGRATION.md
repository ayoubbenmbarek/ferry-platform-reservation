# Booking API Integration Guide

## ✅ Backend Updates Completed

### 1. Model Updates (backend/app/models/booking.py)

**Changes Made:**

1. **Extended VehicleTypeEnum** - Now supports all 7 vehicle types:
   - car
   - suv (NEW)
   - van (NEW)
   - motorcycle
   - camper
   - caravan (NEW)
   - truck

2. **Updated Booking Model Fields:**
   - `schedule_id` - Now OPTIONAL (nullable=True)
   - `sailing_id` - NEW: Operator's sailing identifier
   - `operator` - NEW: Ferry operator name (CTN, GNV, etc.)

3. **Updated BookingPassenger Model:**
   - `special_needs` - NEW: General special needs/requirements field

### 2. Schema Updates (backend/app/schemas/ferry.py)

**Changes Made:**
- Updated `VehicleType` enum to include all 7 types (suv, van, caravan added)

### 3. Database Migration ✅

**Migration Created:** `20251113_2156-b860474eee5e_add_vehicle_types_and_booking_operator_.py`

**Migration Applied:** ✅ Database schema updated successfully

**Changes:**
- Added `bookings.sailing_id` column
- Added `bookings.operator` column
- Made `bookings.schedule_id` nullable
- Added `booking_passengers.special_needs` column
- Updated vehicle type enum values

## 📍 Current Booking API Endpoint

The booking API is ready at: `POST /api/v1/bookings/`

**Location:** `backend/app/api/v1/bookings.py` (lines 131-272)

### API Endpoint Features:

✅ Accepts guest bookings (no authentication required)
✅ Accepts authenticated user bookings
✅ Creates booking with unique reference (format: MR[8-char-hex])
✅ Saves all passengers with pricing
✅ Saves all vehicles with pricing
✅ Calculates subtotal, tax, and total
✅ Attempts to create booking with ferry operator
✅ Returns comprehensive booking confirmation

### Request Body Structure:

```typescript
{
  sailing_id: string;           // Operator's sailing ID
  operator: string;             // "CTN", "GNV", etc.
  contact_info: {
    email: string;
    phone?: string;
    first_name: string;
    last_name: string;
  };
  passengers: [
    {
      type: "adult" | "child" | "infant";
      first_name: string;
      last_name: string;
      date_of_birth?: string;
      nationality?: string;
      passport_number?: string;
      special_needs?: string;
    }
  ];
  vehicles?: [
    {
      type: "car" | "suv" | "van" | "motorcycle" | "camper" | "caravan" | "truck";
      length: number;    // meters
      width: number;     // meters
      height: number;    // meters
      weight?: number;   // kg
      registration?: string;
      make?: string;
      model?: string;
    }
  ];
  cabin_selection?: {
    type: string;
    supplement_price?: number;
  };
  special_requests?: string;
}
```

### Response Structure:

```typescript
{
  id: number;
  booking_reference: string;           // "MR[8-CHAR]"
  operator_booking_reference?: string; // Operator's reference
  status: "pending" | "confirmed" | "cancelled" | "completed" | "refunded";
  contact_email: string;
  contact_first_name: string;
  contact_last_name: string;
  sailing_id: string;
  operator: string;
  total_passengers: number;
  total_vehicles: number;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  currency: "EUR";
  passengers: [...];
  vehicles: [...];
  created_at: string;
  updated_at: string;
}
```

## 🚀 Frontend Integration Steps

### Step 1: Create Booking Service

**Create:** `frontend/src/services/bookingService.ts`

```typescript
import axios from 'axios';
import { FerryResult, PassengerInfo, VehicleInfo } from '../types/ferry';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8010';

export interface CreateBookingRequest {
  sailing_id: string;
  operator: string;
  contact_info: {
    email: string;
    phone?: string;
    first_name: string;
    last_name: string;
  };
  passengers: {
    type: string;
    first_name: string;
    last_name: string;
    date_of_birth?: string;
    nationality?: string;
    passport_number?: string;
    special_needs?: string;
  }[];
  vehicles?: {
    type: string;
    length: number;
    width: number;
    height: number;
    weight?: number;
    registration?: string;
    make?: string;
    model?: string;
  }[];
  cabin_selection?: {
    type: string;
    supplement_price?: number;
  };
  special_requests?: string;
}

export interface BookingResponse {
  id: number;
  booking_reference: string;
  status: string;
  total_amount: number;
  currency: string;
  // ... other fields
}

export const bookingService = {
  async createBooking(bookingData: CreateBookingRequest): Promise<BookingResponse> {
    const response = await axios.post(
      `${API_BASE_URL}/api/v1/bookings/`,
      bookingData
    );
    return response.data;
  },

  async getBooking(bookingId: number): Promise<BookingResponse> {
    const response = await axios.get(
      `${API_BASE_URL}/api/v1/bookings/${bookingId}`
    );
    return response.data;
  },

  async getBookingByReference(
    bookingReference: string,
    email: string
  ): Promise<BookingResponse> {
    const response = await axios.get(
      `${API_BASE_URL}/api/v1/bookings/reference/${bookingReference}`,
      { params: { email } }
    );
    return response.data;
  },
};
```

### Step 2: Create Booking Redux Action

**Update:** `frontend/src/store/slices/ferrySlice.ts`

```typescript
// Add to async thunks
export const createBooking = createAsyncThunk(
  'ferry/createBooking',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState() as RootState;
      const { selectedFerry, passengers, vehicles, selectedCabin } = state.ferry;

      if (!selectedFerry) {
        throw new Error('No ferry selected');
      }

      // Transform frontend data to API format
      const bookingData = {
        sailing_id: selectedFerry.sailingId,
        operator: selectedFerry.operator,
        contact_info: {
          email: passengers[0]?.email || '', // Get from first passenger or form
          phone: passengers[0]?.phone,
          first_name: passengers[0]?.firstName || '',
          last_name: passengers[0]?.lastName || '',
        },
        passengers: passengers.map(p => ({
          type: p.type,
          first_name: p.firstName,
          last_name: p.lastName,
          date_of_birth: p.dateOfBirth,
          nationality: p.nationality,
          passport_number: p.passportNumber,
          special_needs: p.specialNeeds,
        })),
        vehicles: vehicles.map(v => ({
          type: v.type,
          length: v.length,
          width: v.width,
          height: v.height,
          weight: v.weight,
          registration: v.registration,
          make: v.make,
          model: v.model,
        })),
        cabin_selection: selectedCabin ? {
          type: selectedCabin,
          supplement_price: 0, // Calculate based on cabin type
        } : undefined,
      };

      const response = await axios.post(
        `${API_BASE_URL}/api/v1/bookings/`,
        bookingData
      );

      return response.data;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.detail || 'Failed to create booking'
      );
    }
  }
);

// Add to slice reducers
const ferrySlice = createSlice({
  // ... existing code ...
  extraReducers: (builder) => {
    builder
      // ... existing search reducers ...
      // Add booking reducers
      .addCase(createBooking.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createBooking.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentBooking = action.payload;
        state.currentStep = 5; // Move to confirmation step
      })
      .addCase(createBooking.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});
```

### Step 3: Add Contact Info Form

**Create:** `frontend/src/components/ContactInfoForm.tsx`

```typescript
import React, { useState } from 'react';

interface ContactInfo {
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
}

interface ContactInfoFormProps {
  onSubmit: (contactInfo: ContactInfo) => void;
}

const ContactInfoForm: React.FC<ContactInfoFormProps> = ({ onSubmit }) => {
  const [form, setForm] = useState<ContactInfo>({
    email: '',
    phone: '',
    firstName: '',
    lastName: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-xl font-semibold mb-4">Contact Information</h3>

      <div>
        <label className="block text-sm font-medium mb-1">
          Email *
        </label>
        <input
          type="email"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="w-full px-4 py-2 border rounded-lg"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Phone
        </label>
        <input
          type="tel"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className="w-full px-4 py-2 border rounded-lg"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            First Name *
          </label>
          <input
            type="text"
            required
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            className="w-full px-4 py-2 border rounded-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Last Name *
          </label>
          <input
            type="text"
            required
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            className="w-full px-4 py-2 border rounded-lg"
          />
        </div>
      </div>

      <button
        type="submit"
        className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700"
      >
        Continue to Payment
      </button>
    </form>
  );
};

export default ContactInfoForm;
```

### Step 4: Update Booking Flow

**Update:** `frontend/src/pages/NewSearchPage.tsx` (or wherever Step 4 is)

Add contact info step before payment:

```typescript
// Add to booking flow
if (currentStep === 4) {
  return (
    <ContactInfoForm
      onSubmit={(contactInfo) => {
        // Store contact info in Redux
        dispatch(setContactInfo(contactInfo));
        // Proceed to payment
        dispatch(nextStep());
      }}
    />
  );
}

// On payment confirmation
const handlePaymentSuccess = async () => {
  try {
    // Create booking
    await dispatch(createBooking()).unwrap();
    // Booking created successfully!
    // Navigate to confirmation page
  } catch (error) {
    console.error('Booking failed:', error);
  }
};
```

## 🎯 Next Steps Summary

1. ✅ Backend models updated with all vehicle types
2. ✅ Database migration created and applied
3. ✅ Booking API ready and functional
4. 🔄 **TO DO:** Create frontend booking service
5. 🔄 **TO DO:** Add contact info form
6. 🔄 **TO DO:** Integrate booking creation in payment flow
7. 🔄 **TO DO:** Add booking confirmation page
8. 🔄 **TO DO:** Test complete end-to-end booking flow

## 🧪 Testing the API

You can test the API now using the Swagger docs at:
**http://localhost:8010/docs**

Or using curl:

```bash
curl -X POST "http://localhost:8010/api/v1/bookings/" \
  -H "Content-Type: application/json" \
  -d '{
    "sailing_id": "CTN-GEN-TUN-2025-001",
    "operator": "CTN",
    "contact_info": {
      "email": "test@example.com",
      "first_name": "John",
      "last_name": "Doe"
    },
    "passengers": [
      {
        "type": "adult",
        "first_name": "John",
        "last_name": "Doe"
      }
    ],
    "vehicles": [
      {
        "type": "suv",
        "length": 5.0,
        "width": 2.0,
        "height": 1.8
      }
    ]
  }'
```

## 📊 View Database in pgAdmin

Access pgAdmin at: **http://localhost:5050**
- Email: admin@maritime.com
- Password: admin

Connect to database:
- Host: postgres
- Port: 5432
- Database: maritime_reservations_dev
- Username: postgres
- Password: postgres

View the updated tables:
- `bookings` - Now has sailing_id and operator fields
- `booking_passengers` - Now has special_needs field
- `booking_vehicles` - Supports all 7 vehicle types

---

**Status:** Backend is ready! Frontend integration is the next step.