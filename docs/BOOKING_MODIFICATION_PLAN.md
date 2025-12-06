# Booking Modification Feature - Implementation Plan

## 📋 Overview

Based on AFerry's booking modification system, this document outlines the implementation plan for allowing customers to modify their ferry reservations after booking.

## 🎯 Objectives

Allow customers to modify their bookings with:
1. **Simple changes**: Names and vehicle registration
2. **Complex changes**: Dates, routes, passengers, cabins, meals, etc.
3. **Automatic price recalculation**
4. **Payment of price difference**
5. **New confirmation email**

## 📊 Current State Analysis

### What Exists ✅
- Basic booking system with create/read/cancel operations
- Update endpoint (`PUT /api/v1/bookings/{booking_id}`) - LIMITED
  - Only handles: contact_phone, special_requests, cabin_selection (partial)
- Booking models with all necessary relationships:
  - Passengers (BookingPassenger)
  - Vehicles (BookingVehicle)
  - Meals (BookingMeal)
  - Pricing fields
- Payment system integrated with Stripe
- Email notification system via Celery
- User authentication (login + guest booking by reference)

### What's Missing ❌
- Comprehensive modification logic
- Modification rules engine (what can/cannot be modified)
- Price recalculation on modification
- Modification fees handling
- Fare type restrictions
- UI for modification flows
- Modification history tracking

---

## 🏗️ Architecture Design

### 1. Two Modification Pathways

#### Option A: Quick Changes (Simple)
**Route**: `PATCH /api/v1/bookings/{booking_id}/quick-update`

**What can be modified:**
- Passenger names (firstName, lastName)
- Vehicle registration number

**Business rules:**
- No price recalculation
- No modification fees (or minimal flat fee)
- Immediate confirmation
- Available until check-in opens

**Use case:** Typos, name corrections, registration updates

---

#### Option B: Full Modification (Complex)
**Route**: `POST /api/v1/bookings/{booking_id}/modifications`

**What can be modified:**
```
1. Passengers & Pets
   - Add/remove passengers
   - Change passenger details (DOB, age category, passport)
   - Add/remove pets

2. Travel Details
   - Change date
   - Change time/sailing
   - Change departure/arrival ports
   - Add/remove return journey

3. Route/Itinerary
   - Change route (same operator only)

4. Vehicles
   - Update dimensions
   - Change type
   - Add/remove trailer, caravan, roof box, bike rack

5. Accommodation
   - Add/remove cabins
   - Change cabin types
   - Add/remove reserved seats
   - Add/remove lounge access
   - Add/remove pet accommodation

6. Meals
   - Add/remove breakfast, lunch, dinner
   - Add/remove meal plans

7. Services
   - Priority boarding/disembarkation
   - Other add-ons
```

**Business rules:**
- Full price recalculation required
- Modification fees apply
- Must check availability with operator API
- Customer pays difference if price increases
- Refund difference if price decreases (or credit)
- New confirmation email sent

---

### 2. Modification Rules Engine

```python
class ModificationRules:
    @staticmethod
    def can_modify(booking: Booking) -> tuple[bool, str]:
        """Check if booking can be modified."""

        # Rule 1: Booking must be confirmed or pending
        if booking.status not in ['confirmed', 'pending']:
            return False, "Only confirmed or pending bookings can be modified"

        # Rule 2: Cannot modify if check-in is open
        checkin_opens_at = booking.departure_date - timedelta(hours=3)
        if datetime.utcnow() >= checkin_opens_at:
            return False, "Check-in is already open. Contact support for assistance"

        # Rule 3: Cannot modify past departures
        if datetime.utcnow() >= booking.departure_date:
            return False, "Cannot modify past bookings"

        # Rule 4: Cannot modify if already traveled outbound (for return modifications)
        # This would need journey tracking

        # Rule 5: Check fare type restrictions
        if hasattr(booking, 'fare_type') and booking.fare_type == 'non-modifiable':
            return False, "Your fare type does not allow modifications"

        # Rule 6: Check modification limit
        if hasattr(booking, 'modification_count'):
            max_modifications = 3  # configurable
            if booking.modification_count >= max_modifications:
                return False, f"Maximum {max_modifications} modifications reached"

        return True, "Modification allowed"
```

---

### 3. Price Recalculation Flow

```python
class ModificationPriceCalculator:
    """Calculate new price after modifications."""

    async def calculate_modification_price(
        self,
        original_booking: Booking,
        modification_request: ModificationRequest
    ) -> ModificationPriceQuote:
        """
        1. Fetch current prices from operator API for new journey
        2. Calculate original booking value
        3. Calculate new booking value
        4. Calculate modification fee
        5. Calculate price difference
        6. Return quote
        """

        # Original booking value
        original_total = original_booking.total_amount

        # Fetch new prices from ferry service
        new_ferry_price = await self._fetch_ferry_prices(
            modification_request.new_departure_date,
            modification_request.new_route,
            # ... passengers, vehicles, etc.
        )

        # Calculate new components
        passenger_cost = self._calculate_passenger_costs(
            modification_request.passengers,
            new_ferry_price
        )

        vehicle_cost = self._calculate_vehicle_costs(
            modification_request.vehicles,
            new_ferry_price
        )

        cabin_cost = self._calculate_cabin_costs(
            modification_request.cabins,
            new_ferry_price
        )

        meal_cost = self._calculate_meal_costs(
            modification_request.meals,
            new_ferry_price
        )

        # New total before fees
        new_subtotal = passenger_cost + vehicle_cost + cabin_cost + meal_cost

        # Modification fee (e.g., €25 or 5% of original booking)
        modification_fee = self._calculate_modification_fee(
            original_booking,
            modification_request
        )

        # Price difference
        price_difference = new_subtotal - original_total

        # Total to pay (can be negative for refunds)
        total_to_pay = price_difference + modification_fee

        return ModificationPriceQuote(
            original_total=original_total,
            new_subtotal=new_subtotal,
            modification_fee=modification_fee,
            price_difference=price_difference,
            total_to_pay=total_to_pay,
            breakdown={
                "passengers": passenger_cost,
                "vehicles": vehicle_cost,
                "cabins": cabin_cost,
                "meals": meal_cost
            }
        )
```

---

### 4. Database Schema Additions

#### New Table: `booking_modifications`
```python
class BookingModification(Base):
    __tablename__ = "booking_modifications"

    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=False)

    # Who made the modification
    modified_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    modified_by_admin = Column(Boolean, default=False)

    # When
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # What changed (JSON field with before/after)
    changes = Column(JSON, nullable=False)
    # Example:
    # {
    #   "departure_date": {"old": "2024-12-01", "new": "2024-12-05"},
    #   "passengers": {"old": 2, "new": 3},
    #   "added_passengers": [{"firstName": "John", ...}]
    # }

    # Financial impact
    original_total = Column(Numeric(10, 2), nullable=False)
    new_total = Column(Numeric(10, 2), nullable=False)
    modification_fee = Column(Numeric(10, 2), default=0.00)
    price_difference = Column(Numeric(10, 2), default=0.00)
    total_charged = Column(Numeric(10, 2), nullable=False)

    # Payment
    payment_status = Column(String(50))  # pending, paid, refunded
    payment_intent_id = Column(String(255), nullable=True)

    # Status
    status = Column(String(50))  # draft, pending_payment, completed, failed

    # Operator confirmation
    operator_confirmed = Column(Boolean, default=False)
    operator_reference = Column(String(100), nullable=True)

    # Relationships
    booking = relationship("Booking", back_populates="modifications")
```

#### Update `bookings` table
```python
# Add to Booking model:
modification_count = Column(Integer, default=0)
fare_type = Column(String(50), default="flexible")  # flexible, semi-flexible, non-modifiable
last_modified_at = Column(DateTime(timezone=True), nullable=True)

# Relationship
modifications = relationship("BookingModification", back_populates="booking")
```

---

### 5. API Endpoints

#### 5.1 Check Modification Eligibility
```
GET /api/v1/bookings/{booking_id}/can-modify
```

**Response:**
```json
{
  "can_modify": true,
  "modification_type_allowed": "full",
  "restrictions": [],
  "message": "This booking can be fully modified"
}
```

---

#### 5.2 Quick Update (Names & Registration)
```
PATCH /api/v1/bookings/{booking_id}/quick-update
```

**Request:**
```json
{
  "passenger_updates": [
    {
      "passenger_id": 123,
      "first_name": "John",
      "last_name": "Smith"
    }
  ],
  "vehicle_updates": [
    {
      "vehicle_id": 456,
      "registration": "ABC123XY"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "booking_reference": "MRB0F66F9D",
  "message": "Booking updated successfully",
  "updated_at": "2024-11-27T10:30:00Z"
}
```

---

#### 5.3 Request Modification Quote
```
POST /api/v1/bookings/{booking_id}/modifications/quote
```

**Request:**
```json
{
  "modification_type": "change_date",
  "new_departure_date": "2024-12-05",
  "new_departure_time": "14:00",
  "new_passengers": [
    {
      "type": "adult",
      "first_name": "Jane",
      "last_name": "Doe"
    }
  ],
  "add_cabins": [
    {
      "type": "internal",
      "quantity": 1
    }
  ],
  "remove_meals": [123, 456]
}
```

**Response:**
```json
{
  "quote_id": "MOD-123456",
  "expires_at": "2024-11-27T18:00:00Z",
  "price_breakdown": {
    "original_total": 450.00,
    "new_subtotal": 520.00,
    "modification_fee": 25.00,
    "price_difference": 70.00,
    "total_to_pay": 95.00,
    "currency": "EUR"
  },
  "breakdown": {
    "passengers": {
      "old": 2,
      "new": 3,
      "cost": 85.00
    },
    "cabins": {
      "added": 1,
      "cost": 50.00
    },
    "meals": {
      "removed": 2,
      "savings": -15.00
    }
  },
  "availability_confirmed": true,
  "message": "Modification available. Please confirm to proceed."
}
```

---

#### 5.4 Confirm Modification
```
POST /api/v1/bookings/{booking_id}/modifications/{quote_id}/confirm
```

**Request:**
```json
{
  "accept_terms": true,
  "payment_method_id": "pm_123456"  // if payment required
}
```

**Response:**
```json
{
  "success": true,
  "modification_id": 789,
  "booking_reference": "MRB0F66F9D",
  "payment_required": true,
  "payment_intent": {
    "id": "pi_123456",
    "client_secret": "pi_123456_secret_xyz",
    "amount": 9500,
    "currency": "eur"
  },
  "message": "Please complete payment to confirm modification"
}
```

---

#### 5.5 Get Modification History
```
GET /api/v1/bookings/{booking_id}/modifications
```

**Response:**
```json
{
  "modifications": [
    {
      "id": 789,
      "created_at": "2024-11-27T10:00:00Z",
      "status": "completed",
      "changes": {
        "departure_date": {
          "old": "2024-12-01",
          "new": "2024-12-05"
        }
      },
      "total_charged": 95.00,
      "modified_by": "customer"
    }
  ],
  "total_modifications": 1,
  "remaining_modifications": 2
}
```

---

### 6. Frontend Components

#### 6.1 My Bookings Page Enhancements
```typescript
// frontend/src/pages/MyBookings.tsx

// Add "Modify Booking" button to each booking card
<button
  onClick={() => navigate(`/modify-booking/${booking.id}`)}
  disabled={!booking.can_modify}
  className="btn-secondary"
>
  Modify Booking
</button>
```

---

#### 6.2 Modify Booking Page
```typescript
// frontend/src/pages/ModifyBookingPage.tsx

interface ModifyBookingPageProps {}

export const ModifyBookingPage: React.FC<ModifyBookingPageProps> = () => {
  const { bookingId } = useParams();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [modificationType, setModificationType] = useState<'quick' | 'full' | null>(null);
  const [quote, setQuote] = useState<ModificationQuote | null>(null);

  // Steps:
  // 1. Show booking details
  // 2. Choose modification type (Quick vs Full)
  // 3. Make changes
  // 4. Get quote
  // 5. Review and confirm
  // 6. Payment (if required)
  // 7. Confirmation

  return (
    <div className="modify-booking-container">
      <ModificationTypeSelector
        onSelect={setModificationType}
      />

      {modificationType === 'quick' && (
        <QuickUpdateForm booking={booking} />
      )}

      {modificationType === 'full' && (
        <FullModificationFlow booking={booking} />
      )}
    </div>
  );
};
```

---

#### 6.3 Modification Type Selector Component
```typescript
// frontend/src/components/ModificationTypeSelector.tsx

export const ModificationTypeSelector: React.FC = ({ onSelect }) => {
  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Quick Update Card */}
      <div className="modification-option-card">
        <h3>Quick Changes</h3>
        <p>Update passenger names or vehicle registration</p>
        <ul>
          <li>No additional fees</li>
          <li>Instant confirmation</li>
          <li>No price changes</li>
        </ul>
        <button onClick={() => onSelect('quick')}>
          Select
        </button>
      </div>

      {/* Full Modification Card */}
      <div className="modification-option-card">
        <h3>Modify Booking Details</h3>
        <p>Change dates, passengers, route, cabins, meals, etc.</p>
        <ul>
          <li>Modification fee applies</li>
          <li>Price recalculation</li>
          <li>Payment of difference</li>
        </ul>
        <button onClick={() => onSelect('full')}>
          Select
        </button>
      </div>
    </div>
  );
};
```

---

#### 6.4 Full Modification Flow Component
```typescript
// frontend/src/components/FullModificationFlow.tsx

export const FullModificationFlow: React.FC<{ booking: Booking }> = ({ booking }) => {
  const [step, setStep] = useState(1);
  const [modifications, setModifications] = useState({});
  const [quote, setQuote] = useState<ModificationQuote | null>(null);

  const steps = [
    { label: 'Select Changes', component: <SelectChanges /> },
    { label: 'Review Quote', component: <ReviewQuote /> },
    { label: 'Payment', component: <PaymentStep /> },
    { label: 'Confirmation', component: <ConfirmationStep /> },
  ];

  return (
    <div className="modification-flow">
      <StepIndicator currentStep={step} steps={steps} />

      {step === 1 && (
        <SelectChanges
          booking={booking}
          modifications={modifications}
          onUpdate={setModifications}
          onNext={async () => {
            const quoteData = await fetchModificationQuote(booking.id, modifications);
            setQuote(quoteData);
            setStep(2);
          }}
        />
      )}

      {step === 2 && quote && (
        <ReviewQuote
          quote={quote}
          onConfirm={() => {
            if (quote.total_to_pay > 0) {
              setStep(3); // Go to payment
            } else {
              confirmModification(); // No payment needed
              setStep(4);
            }
          }}
          onBack={() => setStep(1)}
        />
      )}

      {/* ... other steps */}
    </div>
  );
};
```

---

### 7. Business Logic Services

#### 7.1 Modification Service
```python
# backend/app/services/modification_service.py

class BookingModificationService:
    """Handle booking modifications."""

    def __init__(self):
        self.ferry_service = FerryService()
        self.price_calculator = ModificationPriceCalculator()
        self.payment_service = PaymentService()

    async def create_modification_quote(
        self,
        booking_id: int,
        modification_request: ModificationRequest,
        db: Session
    ) -> ModificationQuote:
        """Create a modification quote."""

        # 1. Validate booking can be modified
        booking = db.query(Booking).filter(Booking.id == booking_id).first()
        can_modify, message = ModificationRules.can_modify(booking)

        if not can_modify:
            raise ValueError(message)

        # 2. Check availability with operator API
        availability = await self.ferry_service.check_availability(
            modification_request.new_departure_date,
            modification_request.new_route,
            # ... other params
        )

        if not availability.available:
            raise ValueError("Selected sailing not available")

        # 3. Calculate new pricing
        price_quote = await self.price_calculator.calculate_modification_price(
            booking,
            modification_request
        )

        # 4. Create quote record (expires in 1 hour)
        quote = ModificationQuote(
            booking_id=booking_id,
            expires_at=datetime.utcnow() + timedelta(hours=1),
            price_breakdown=price_quote.dict(),
            modifications=modification_request.dict(),
            availability_confirmed=True
        )

        db.add(quote)
        db.commit()

        return quote

    async def confirm_modification(
        self,
        booking_id: int,
        quote_id: str,
        payment_method_id: str = None,
        db: Session
    ) -> BookingModification:
        """Confirm and apply modification."""

        # 1. Get quote
        quote = db.query(ModificationQuote).filter(
            ModificationQuote.id == quote_id,
            ModificationQuote.booking_id == booking_id
        ).first()

        if not quote:
            raise ValueError("Quote not found")

        if quote.expires_at < datetime.utcnow():
            raise ValueError("Quote expired. Please request a new quote")

        # 2. Process payment if required
        if quote.total_to_pay > 0:
            payment_intent = await self.payment_service.create_payment_intent(
                amount=quote.total_to_pay,
                currency="eur",
                booking_reference=booking.booking_reference,
                payment_method_id=payment_method_id
            )

            # Wait for payment confirmation
            # This might be async via webhook

        # 3. Apply modifications to booking
        booking = db.query(Booking).filter(Booking.id == booking_id).first()

        self._apply_modifications(booking, quote.modifications, db)

        # 4. Update operator booking
        operator_result = await self.ferry_service.update_operator_booking(
            booking.operator,
            booking.operator_reference,
            quote.modifications
        )

        # 5. Create modification record
        modification = BookingModification(
            booking_id=booking_id,
            changes=quote.modifications,
            original_total=quote.original_total,
            new_total=quote.new_total,
            modification_fee=quote.modification_fee,
            total_charged=quote.total_to_pay,
            status="completed",
            operator_confirmed=operator_result.confirmed,
            operator_reference=operator_result.new_reference
        )

        db.add(modification)

        booking.modification_count += 1
        booking.last_modified_at = datetime.utcnow()
        booking.updated_at = datetime.utcnow()

        db.commit()

        # 6. Send confirmation email
        await send_modification_confirmation_email(booking, modification)

        return modification
```

---

## 🚀 Implementation Phases

### Phase 1: Backend Foundation (Week 1)
**Priority: HIGH**

1. **Database Schema**
   - [ ] Create `booking_modifications` table migration
   - [ ] Add modification-related fields to `bookings` table
   - [ ] Create `ModificationQuote` model for temporary quotes

2. **Modification Rules Engine**
   - [ ] Implement `ModificationRules` class
   - [ ] Define business rules (check-in, departure, fare type, etc.)
   - [ ] Add configuration for modification fees

3. **API Endpoints - Basic**
   - [ ] `GET /api/v1/bookings/{id}/can-modify` - Check eligibility
   - [ ] `PATCH /api/v1/bookings/{id}/quick-update` - Quick updates

**Deliverable**: Basic modification eligibility checking and simple updates

---

### Phase 2: Price Recalculation (Week 2)
**Priority: HIGH**

1. **Modification Price Calculator**
   - [ ] Implement price recalculation logic
   - [ ] Calculate modification fees
   - [ ] Handle price increases/decreases
   - [ ] Create detailed breakdown

2. **Quote Management**
   - [ ] `POST /api/v1/bookings/{id}/modifications/quote` - Request quote
   - [ ] Quote expiration logic (1 hour TTL)
   - [ ] Quote validation

**Deliverable**: Working price recalculation with quotes

---

### Phase 3: Full Modification Flow (Week 3)
**Priority: HIGH**

1. **Modification Service**
   - [ ] Implement `BookingModificationService`
   - [ ] Apply modifications to booking
   - [ ] Update operator bookings via API
   - [ ] Handle payment for price differences

2. **Payment Integration**
   - [ ] Stripe payment for modifications
   - [ ] Handle refunds for price decreases
   - [ ] Modification payment webhooks

3. **API Endpoints - Advanced**
   - [ ] `POST /api/v1/bookings/{id}/modifications/{quote_id}/confirm`
   - [ ] `GET /api/v1/bookings/{id}/modifications` - History

**Deliverable**: Complete backend modification system

---

### Phase 4: Frontend Implementation (Week 4)
**Priority: MEDIUM**

1. **UI Components**
   - [ ] Modify Booking button in My Bookings
   - [ ] Modification Type Selector
   - [ ] Quick Update Form
   - [ ] Full Modification Flow (multi-step)
   - [ ] Modification Quote Review
   - [ ] Payment Form for modifications

2. **Pages**
   - [ ] ModifyBookingPage
   - [ ] Modification Confirmation Page

3. **State Management**
   - [ ] Redux slice for modifications
   - [ ] Modification API client

**Deliverable**: Complete frontend modification UI

---

### Phase 5: Email Notifications (Week 5)
**Priority: MEDIUM**

1. **Email Templates**
   - [ ] Modification quote email
   - [ ] Modification confirmation email
   - [ ] Price difference payment receipt

2. **Celery Tasks**
   - [ ] Async email sending for modifications

**Deliverable**: Email notifications for all modification events

---

### Phase 6: Testing & Polish (Week 6)
**Priority: LOW**

1. **Testing**
   - [ ] Unit tests for modification logic
   - [ ] Integration tests for modification flow
   - [ ] E2E tests for UI

2. **Edge Cases**
   - [ ] Handle sold-out sailings
   - [ ] Handle invalid modifications
   - [ ] Handle payment failures

3. **Documentation**
   - [ ] API documentation
   - [ ] User guide for modifications

**Deliverable**: Production-ready modification system

---

## 💡 Key Features Summary

### ✅ What Users Can Do

1. **Simple Changes (No fee)**
   - Fix typos in passenger names
   - Update vehicle registration

2. **Complex Changes (Modification fee applies)**
   - Change travel dates
   - Change sailing times
   - Add/remove passengers
   - Add/remove vehicles
   - Upgrade/downgrade cabins
   - Add/remove meals
   - Change route (same operator)

3. **Automatic Handling**
   - Price recalculation
   - Availability checking
   - Payment of difference
   - New confirmation email

### 🚫 Restrictions

- Cannot modify after check-in opens (3 hours before departure)
- Cannot modify past bookings
- Cannot modify non-modifiable fares
- Maximum 3 modifications per booking (configurable)
- Route changes only within same operator

---

## 📝 Next Steps

1. **Review this plan** - Confirm approach and priorities
2. **Estimate effort** - Time allocation per phase
3. **Begin Phase 1** - Database schema and basic endpoints
4. **Iterate** - Adjust based on feedback and real-world testing

---

## 🔗 References

- AFerry Modification Documentation: `/modifier-reservation.md`
- Current Booking API: `backend/app/api/v1/bookings.py`
- Current Schemas: `backend/app/schemas/booking.py`
- Payment System: `backend/app/api/v1/payments.py`

