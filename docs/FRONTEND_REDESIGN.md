# Frontend Redesign Documentation

## Overview

The Maritime Reservation Platform frontend has been completely redesigned with a modern, user-friendly interface that provides comprehensive vehicle and passenger management capabilities.

## What's New

### ✨ Modern UI/UX Design
- **Clean, gradient-based design** inspired by leading booking platforms (Booking.com, Airbnb)
- **Step-by-step booking flow** for better user experience
- **Responsive design** that works perfectly on mobile, tablet, and desktop
- **Smooth animations** and transitions throughout
- **Visual icons and emojis** for better user engagement

### 🚗 Comprehensive Vehicle Support

The new frontend supports **7 vehicle types** with customizable dimensions:

1. **🚗 Car** - Standard passenger vehicle (4.5m × 1.8m × 1.5m)
2. **🚙 SUV/4x4** - Larger passenger vehicle (5.0m × 2.0m × 1.8m)
3. **🚐 Van/Minibus** - Commercial or passenger van (5.5m × 2.0m × 2.2m)
4. **🏍️ Motorcycle** - Two-wheeled vehicle (2.2m × 0.8m × 1.2m)
5. **🚚 Camper/Motorhome** - Recreational vehicle (7.0m × 2.3m × 3.0m)
6. **🚐 Caravan/Trailer** - Towed trailer (6.5m × 2.3m × 2.5m)
7. **🚛 Truck/Lorry** - Large commercial vehicle (8.0m × 2.5m × 3.5m)

Each vehicle can be customized with:
- Exact dimensions (length, width, height)
- Registration number
- Make and model
- Weight
- Add/edit/remove functionality

### 👥 Advanced Passenger Management

**Three passenger types** with age validation:
- **👤 Adults** (13+ years)
- **🧒 Children** (3-12 years)
- **👶 Infants** (0-2 years)

Passenger details include:
- Personal information (name, date of birth, nationality)
- Travel documents (passport number, expiry date)
- Special needs (wheelchair access, dietary requirements, etc.)
- Individual add/edit/remove for each passenger

### 📋 Step-by-Step Booking Flow

#### **Step 1: Route & Date Selection**
- Modern port selection with country grouping
- Date picker with validation
- Dynamic passenger counter (adults, children, infants)
- Vehicle toggle option

#### **Step 2: Passenger Details**
- Add detailed information for each passenger
- Collapsible passenger cards for easy editing
- Optional vehicle addition with full specifications
- Progress indicator showing completion

#### **Step 3: Ferry Selection**
- Compare results from all operators (CTN, GNV, Corsica Lines, Danel)
- View departure/arrival times with duration
- See pricing for each option
- Filter and sort capabilities

#### **Step 4: Review & Payment**
- Summary of all selections
- Review passengers and vehicles
- Final price breakdown
- Secure payment processing

## Technical Architecture

### New Files Created

```
frontend/src/
├── types/
│   └── ferry.ts                    # TypeScript types and enums
├── components/
│   ├── VehicleCard.tsx             # Vehicle add/edit component
│   └── PassengerForm.tsx           # Passenger add/edit component
├── pages/
│   ├── NewHomePage.tsx             # Modern homepage with search
│   └── NewSearchPage.tsx           # Multi-step booking flow
└── store/slices/
    └── ferrySlice.ts               # Redux state management
```

### Type Definitions (ferry.ts)

**Key Types:**
```typescript
VehicleType: CAR | SUV | VAN | MOTORCYCLE | CAMPER | CARAVAN | TRUCK
PassengerType: ADULT | CHILD | INFANT
CabinType: INTERIOR | EXTERIOR | SUITE | DECK

VehicleInfo: {
  id, type, length, width, height, weight, registration, make, model
}

PassengerInfo: {
  id, type, firstName, lastName, dateOfBirth, nationality,
  passportNumber, documentExpiry, specialNeeds
}

SearchParams: {
  departurePort, arrivalPort, departureDate, returnDate,
  passengers: { adults, children, infants },
  vehicles: VehicleInfo[]
}
```

**Predefined Data:**
- `VEHICLE_PRESETS`: Default dimensions and labels for each vehicle type
- `PORTS`: Complete list of available ports (Italy, France, Tunisia)
- `PASSENGER_AGE_LIMITS`: Age validation rules

### Redux State Management (ferrySlice.ts)

**State Structure:**
```typescript
{
  searchParams: SearchParams,
  searchResults: FerryResult[],
  isSearching: boolean,
  searchError: string | null,
  currentStep: number,
  selectedFerry: FerryResult | null,
  passengers: PassengerInfo[],
  vehicles: VehicleInfo[],
}
```

**Actions:**
- `searchFerries` - Async thunk for API search
- `setSearchParams` - Update search criteria
- `updatePassengerCount` - Adjust passenger counts
- `addPassenger/updatePassenger/removePassenger` - Passenger management
- `addVehicle/updateVehicle/removeVehicle` - Vehicle management
- `nextStep/previousStep` - Navigation control
- `selectFerry/selectCabin` - Selection actions

### Component Architecture

#### VehicleCard Component

**Features:**
- Visual vehicle type selection with icons
- Preset dimensions with customization
- Optional details (registration, make, model, weight)
- Edit/remove functionality
- Collapsible view when saved

**Usage:**
```tsx
<VehicleCard
  vehicle={vehicleData}
  onSave={(vehicle) => handleSave(vehicle)}
  onRemove={(id) => handleRemove(id)}
/>
```

#### PassengerForm Component

**Features:**
- Visual passenger type selection
- Age validation based on type
- Personal information fields
- Optional travel documents
- Special needs textarea
- Collapsible view when saved

**Usage:**
```tsx
<PassengerForm
  passenger={passengerData}
  passengerNumber={1}
  onSave={(passenger) => handleSave(passenger)}
  onRemove={(id) => handleRemove(id)}
  isExpanded={true}
/>
```

## API Integration

### Search Endpoint

**Frontend Request:**
```typescript
{
  departure_port: "genoa",
  arrival_port: "tunis",
  departure_date: "2024-06-15",
  return_date: "2024-06-30",
  adults: 2,
  children: 1,
  infants: 0,
  vehicles: [{
    type: "car",
    length: 4.5,
    width: 1.8,
    height: 1.5
  }]
}
```

**Backend Endpoint:**
```
POST /api/v1/ferries/search
```

**Response:**
```typescript
{
  results: FerryResult[],
  totalResults: number,
  searchParams: SearchParams,
  operatorsSearched: string[]
}
```

### Data Transformation

The frontend automatically transforms between:
- **CamelCase** (frontend/TypeScript convention)
- **Snake_case** (backend/Python convention)

Example:
```typescript
// Frontend
departurePort → departure_port
returnDate → return_date

// Backend response
departure_time → departureTime
sailing_id → sailingId
```

## Styling and Design

### Color Scheme

**Primary Colors:**
- Blue: `#2563EB` (primary-600)
- Cyan: `#0891B2` (cyan-600)
- Gray: Neutral tones for text and backgrounds

**Gradients:**
```css
from-blue-600 via-blue-700 to-cyan-600
from-blue-50 via-white to-cyan-50
```

### Component Styles

**Cards:**
- Rounded corners: `rounded-lg` / `rounded-xl`
- Shadows: `shadow-md` → `shadow-lg` → `shadow-xl`
- Hover effects: `hover:shadow-lg transition-shadow`

**Buttons:**
- Primary: Blue gradient with white text
- Secondary: White with blue border
- Disabled: Opacity 50% with cursor-not-allowed

**Forms:**
- Consistent padding: `px-4 py-3`
- Border radius: `rounded-lg`
- Focus ring: `focus:ring-2 focus:ring-blue-500`
- Error state: Red border + error message below

### Responsive Breakpoints

```css
sm: 640px   /* Mobile landscape */
md: 768px   /* Tablet */
lg: 1024px  /* Desktop */
xl: 1280px  /* Large desktop */
```

**Grid Layouts:**
```tsx
// Mobile: 1 column, Desktop: 3 columns
className="grid grid-cols-1 md:grid-cols-3 gap-4"

// Mobile: 1 column, Tablet: 2 columns, Desktop: 4 columns
className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
```

## Form Validation

### Client-Side Validation

**Route & Date:**
- Departure port required
- Arrival port required and different from departure
- Departure date required and not in the past
- Return date must be after departure date

**Passengers:**
- At least 1 adult required
- All passenger counts must be non-negative
- Personal information required (first name, last name)
- Age validation based on passenger type

**Vehicles:**
- Dimensions must be positive numbers
- Length, width, height required
- Optional fields: registration, weight, make, model

### Error Messages

All validation errors display:
- **Red border** on invalid field
- **Error message** below field in red text
- **Descriptive text** explaining the issue

Examples:
```
"At least one adult passenger is required"
"Return date must be after departure date"
"Adults must be 13+ years old"
```

## State Management Flow

### Search Flow

1. User enters search criteria on HomePage
2. `setSearchParams` updates Redux state
3. Navigate to SearchPage (Step 1)
4. `searchFerries` async thunk calls API
5. Results populate `searchResults` array
6. User proceeds through steps 1→2→3

### Passenger Management Flow

1. User clicks "Add Passenger"
2. PassengerForm renders in expanded mode
3. User fills out information
4. Validation runs on save
5. `addPassenger` adds to state
6. Form collapses to summary view
7. User can edit/remove any passenger

### Vehicle Management Flow

1. User checks "traveling with vehicle" or clicks "Add Vehicle"
2. VehicleCard renders in edit mode
3. User selects vehicle type (preset dimensions load)
4. User can customize dimensions and add optional details
5. `addVehicle` adds to state and searchParams
6. Card collapses to summary view
7. User can add more vehicles, edit, or remove

## User Experience Enhancements

### Visual Feedback

**Loading States:**
- Spinning icon during API calls
- "Searching..." text
- Disabled buttons during loading

**Success States:**
- Green checkmarks for completed steps
- Progress bar showing current step
- Collapsed cards showing saved data

**Error States:**
- Red borders and text
- Descriptive error messages
- Option to retry or modify

### Progressive Disclosure

**Information is revealed gradually:**
1. Simple search on homepage
2. Detailed passenger info on Step 1
3. Vehicle details if needed
4. Ferry comparison on Step 2
5. Final review on Step 3

### Accessibility

**Keyboard Navigation:**
- All interactive elements focusable
- Tab order follows logical flow
- Enter key submits forms

**Screen Readers:**
- Semantic HTML elements
- ARIA labels where needed
- Descriptive button text

**Visual Indicators:**
- High contrast text
- Large touch targets (min 44×44px)
- Clear focus states

## Testing

### Manual Testing Checklist

**Search Flow:**
- [ ] Select departure port
- [ ] Select arrival port (different from departure)
- [ ] Set departure date (future)
- [ ] Set return date (after departure)
- [ ] Adjust passenger counts
- [ ] Toggle vehicle option
- [ ] Submit search
- [ ] Verify redirect to search page
- [ ] Verify API call with correct params

**Passenger Management:**
- [ ] Add adult passenger
- [ ] Add child passenger
- [ ] Add infant passenger
- [ ] Edit existing passenger
- [ ] Remove passenger (not first)
- [ ] Validate age restrictions
- [ ] Collapse/expand passenger cards
- [ ] Progress to next step

**Vehicle Management:**
- [ ] Add car
- [ ] Add SUV
- [ ] Add van
- [ ] Add motorcycle
- [ ] Add camper
- [ ] Add caravan
- [ ] Add truck
- [ ] Customize dimensions
- [ ] Add optional details
- [ ] Edit vehicle
- [ ] Remove vehicle
- [ ] Add multiple vehicles

**Validation:**
- [ ] Try submitting without required fields
- [ ] Try setting past departure date
- [ ] Try setting return before departure
- [ ] Try setting same departure/arrival
- [ ] Try invalid passenger age for type
- [ ] Verify error messages display

### Browser Testing

**Test on:**
- ✅ Chrome (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Edge (latest)
- ✅ Mobile Safari (iOS)
- ✅ Chrome Mobile (Android)

## Performance Optimizations

**Code Splitting:**
- Lazy loading with React.lazy()
- Suspense boundaries with loading states

**State Management:**
- Redux for global state
- Local state for UI-only state
- Memoization for expensive calculations

**Network:**
- API calls only when needed
- Debouncing for search inputs
- Error retry logic

## Future Enhancements

### Planned Features

1. **Date Picker Component**
   - Visual calendar with available dates
   - Price calendar showing cheapest dates
   - Date range selection for round trips

2. **Cabin Selection**
   - Visual cabin layouts
   - Amenity comparisons
   - Interior vs exterior selection
   - Suite upgrades

3. **Advanced Filters**
   - Departure time ranges
   - Operator preferences
   - Price range slider
   - Duration filter
   - Direct vs indirect routes

4. **Multi-Language Support**
   - Complete i18n integration
   - Language switcher in header
   - RTL support for Arabic
   - Translated content for EN/FR/AR/IT

5. **Saved Searches**
   - Save favorite routes
   - Price alerts
   - Frequent passenger profiles
   - Saved vehicles

6. **Social Features**
   - Share booking with friends
   - Group bookings
   - Split payments
   - Booking on behalf of others

7. **Mobile App**
   - React Native version
   - Offline mode
   - Push notifications
   - Mobile wallet integration

## Troubleshooting

### Common Issues

**1. Search button doesn't work**

**Symptoms:** Clicking search does nothing

**Causes:**
- Validation errors not visible
- API endpoint incorrect
- Redux not configured

**Solutions:**
```typescript
// Check validation errors in state
console.log(errors);

// Check API URL
console.log(process.env.REACT_APP_API_URL);

// Verify Redux store configured
import { store } from './store';
console.log(store.getState());
```

**2. Passengers not saving**

**Symptoms:** Passenger form doesn't save

**Causes:**
- Validation failing
- Redux action not dispatched
- State not updating

**Solutions:**
```typescript
// Check validation
const validate = () => {
  console.log('Validation errors:', errors);
  return Object.keys(errors).length === 0;
};

// Verify dispatch
dispatch(addPassenger(passenger));
console.log('Passengers:', passengers);
```

**3. Vehicles not displaying**

**Symptoms:** Added vehicles don't show

**Causes:**
- State not syncing with searchParams
- Component not re-rendering
- Vehicle data incomplete

**Solutions:**
```typescript
// Check vehicle state
console.log('Vehicles:', vehicles);
console.log('Search params vehicles:', searchParams.vehicles);

// Verify vehicle data
console.log('Vehicle valid?', vehicle.id && vehicle.type && vehicle.length);
```

**4. Styling issues**

**Symptoms:** Layout broken or styles missing

**Causes:**
- Tailwind not configured
- CSS classes misspelled
- Browser compatibility

**Solutions:**
```bash
# Rebuild Tailwind
npm run build:css

# Clear cache
rm -rf node_modules/.cache

# Check Tailwind config
npx tailwindcss --help
```

## Development Workflow

### Running Locally

```bash
# Start backend (from project root)
./scripts/dev-start.sh

# Start frontend (in new terminal)
cd frontend
npm install
npm start

# Open browser
open http://localhost:3000
```

### Making Changes

**1. Update Types:**
```typescript
// frontend/src/types/ferry.ts
export interface NewType {
  // Add new fields
}
```

**2. Update Redux State:**
```typescript
// frontend/src/store/slices/ferrySlice.ts
const ferrySlice = createSlice({
  reducers: {
    newAction: (state, action) => {
      // Update state
    }
  }
});
```

**3. Update Components:**
```tsx
// frontend/src/components/NewComponent.tsx
const NewComponent = () => {
  // Component logic
  return <div>...</div>;
};
```

**4. Update Pages:**
```tsx
// frontend/src/pages/NewPage.tsx
const NewPage = () => {
  // Use components
  return <NewComponent />;
};
```

**5. Test Changes:**
```bash
# Run tests
npm test

# Build for production
npm run build
```

## Deployment

### Production Build

```bash
cd frontend
npm run build
```

Optimized build output in `frontend/build/`:
- Minified JavaScript
- Optimized images
- Generated service worker
- Static assets

### Environment Variables

**Development (.env.development):**
```
REACT_APP_API_URL=http://localhost:8010
```

**Production (.env.production):**
```
REACT_APP_API_URL=https://api.yourdomain.com
```

## Summary

### What We've Built

✅ **Modern, clean UI** with gradient design
✅ **7 vehicle types** with full customization
✅ **3 passenger types** with detailed information
✅ **Step-by-step booking flow** for better UX
✅ **Comprehensive validation** with helpful errors
✅ **Responsive design** for all devices
✅ **Redux state management** for complex state
✅ **TypeScript types** for type safety
✅ **API integration** with backend
✅ **Reusable components** for scalability

### Key Improvements

| Feature | Old | New |
|---------|-----|-----|
| Vehicle types | 1 (basic) | 7 (detailed) |
| Passenger management | Simple count | Full details + validation |
| Search interface | Single form | Step-by-step wizard |
| Validation | Minimal | Comprehensive |
| Design | Basic | Modern gradients |
| Mobile support | Limited | Fully responsive |
| State management | Basic | Redux with TypeScript |
| User experience | Functional | Intuitive and delightful |

### Next Steps

1. **Start the application**
   ```bash
   ./scripts/dev-start.sh
   cd frontend && npm start
   ```

2. **Test the new interface**
   - Try searching for ferries
   - Add multiple passengers
   - Add different vehicle types
   - Complete a booking flow

3. **Customize as needed**
   - Adjust colors in Tailwind config
   - Modify vehicle types
   - Add new passenger fields
   - Implement cabin selection

4. **Deploy to production**
   - Build optimized bundle
   - Configure production API
   - Deploy to hosting service
   - Monitor performance

---

**Happy Sailing! ⚓️**

For questions or issues, check:
- Backend API docs: http://localhost:8010/docs
- Frontend dev server: http://localhost:3000
- Redux DevTools: Browser extension for state debugging