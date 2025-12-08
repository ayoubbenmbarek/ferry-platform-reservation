# Smart Pricing & Fare Calendar Feature

## Overview

This feature transforms the booking experience by giving users powerful price insights, helping them find the best deals and make informed booking decisions.

## Feature Components

### 1. Interactive Fare Calendar
A visual monthly calendar showing prices for each day, with:
- **Color-coded pricing**: Green (cheap), Yellow (average), Red (expensive)
- **Price labels**: Show lowest price per day
- **Availability indicators**: Show if ferries are available
- **Multi-month navigation**: Browse 3+ months ahead
- **Weekend/holiday highlighting**: Visual distinction for peak periods

### 2. Price Evolution Graph
Interactive chart showing price trends:
- **Historical prices**: Last 30/60/90 days of price data
- **Price trend line**: Moving average to show direction
- **Min/Max markers**: Highlight best and worst prices seen
- **Interactive tooltips**: Hover for detailed price info
- **Comparison view**: Compare multiple dates or routes

### 3. AI-Powered Price Prediction
Smart recommendations based on data analysis:
- **Best time to book**: "Book now" vs "Wait for better price"
- **Price forecast**: Predicted prices for next 7-30 days
- **Confidence score**: How reliable the prediction is
- **Savings potential**: "You could save €XX by booking on [date]"
- **Trend alerts**: "Prices typically rise 2 weeks before departure"

### 4. Flexible Dates Search
Enhanced search options:
- **± 3 days flexibility**: Show cheapest in date range
- **Cheapest in month**: Find best price in entire month
- **Weekend finder**: Best weekend deals
- **Specific day preference**: "Cheapest Friday departure"

### 5. Price Insights Dashboard
Aggregated pricing intelligence:
- **Route statistics**: Average price, typical range, best booking window
- **Seasonal patterns**: "Summer prices are 30% higher"
- **Operator comparison**: Price differences between ferry companies
- **Historical low alert**: "Current price is near the lowest we've seen"

---

## Technical Architecture

### Backend Components

#### 1. Price History Model
```python
class PriceHistory(Base):
    id: int
    route_id: str  # "marseille_tunis"
    operator: str
    recorded_at: datetime
    departure_date: date

    # Prices
    price_adult: float
    price_child: float
    price_infant: float
    price_vehicle: float

    # Availability snapshot
    available_passengers: int
    available_vehicles: int
    num_ferries: int

    # Aggregates
    lowest_price: float
    highest_price: float
    average_price: float
```

#### 2. Price Prediction Model
```python
class PricePrediction(Base):
    id: int
    route_id: str
    prediction_date: date  # Date we're predicting for
    created_at: datetime

    # Predictions
    predicted_price: float
    confidence_score: float  # 0-1
    price_trend: str  # "rising", "falling", "stable"

    # Recommendation
    booking_recommendation: str  # "book_now", "wait", "neutral"
    potential_savings: float
    recommendation_reason: str
```

#### 3. New API Endpoints
```
GET /api/v1/prices/calendar
    ?route=marseille_tunis
    &month=2025-01
    &passengers=2
    → Returns: daily prices for entire month

GET /api/v1/prices/history
    ?route=marseille_tunis
    &departure_date=2025-01-15
    &days=30
    → Returns: price history for specific departure date

GET /api/v1/prices/prediction
    ?route=marseille_tunis
    &departure_date=2025-01-15
    → Returns: AI prediction with recommendation

GET /api/v1/prices/flexible-search
    ?route=marseille_tunis
    &date=2025-01-15
    &flexibility=3  # ±3 days
    &passengers=2
    → Returns: prices for date range, sorted by price

GET /api/v1/prices/insights
    ?route=marseille_tunis
    → Returns: route statistics, patterns, recommendations
```

#### 4. Price Tracking Celery Task
```python
@celery.task
def track_prices():
    """Run every 4 hours to record price snapshots"""
    for route in active_routes:
        for date in next_90_days:
            prices = fetch_current_prices(route, date)
            save_price_history(route, date, prices)

    # Update predictions after new data
    update_predictions()
```

#### 5. AI Prediction Service
```python
class PricePredictionService:
    def predict_price(self, route, date):
        # Get historical data
        history = get_price_history(route, date, days=60)

        # Factors to consider:
        # - Day of week patterns
        # - Seasonal trends
        # - Days until departure
        # - Recent price movements
        # - Holiday calendar
        # - Historical same-period data

        # Simple prediction model (can upgrade to ML later)
        prediction = self.calculate_prediction(history)
        confidence = self.calculate_confidence(history)
        recommendation = self.generate_recommendation(prediction, current_price)

        return PricePrediction(...)
```

---

### Frontend Components

#### 1. FareCalendar Component
```tsx
<FareCalendar
  route={{ from: "marseille", to: "tunis" }}
  selectedDate={date}
  onDateSelect={(date, price) => {}}
  passengers={{ adults: 2, children: 1 }}
  months={3}
/>
```

Features:
- Month grid with daily prices
- Color gradient based on price percentile
- Click to select date
- Swipe/arrow navigation for months
- Loading skeleton while fetching

#### 2. PriceEvolutionChart Component
```tsx
<PriceEvolutionChart
  route="marseille_tunis"
  departureDate="2025-01-15"
  days={30}
  showPrediction={true}
/>
```

Features:
- Line chart with historical prices
- Dashed line for predictions
- Min/max annotations
- Zoom and pan
- Tooltip with details

#### 3. PriceInsights Component
```tsx
<PriceInsights
  route="marseille_tunis"
  departureDate="2025-01-15"
  currentPrice={85}
/>
```

Displays:
- Booking recommendation badge
- Confidence meter
- Potential savings callout
- Price trend indicator
- Best booking window

#### 4. FlexibleDatesSelector Component
```tsx
<FlexibleDatesSelector
  baseDate="2025-01-15"
  flexibility={3}
  onSelect={(dates) => {}}
/>
```

Features:
- Slider for ±1 to ±7 days
- "Cheapest in month" toggle
- Weekend-only filter
- Results sorted by price

---

### Database Schema Changes

```sql
-- Price history table
CREATE TABLE price_history (
    id SERIAL PRIMARY KEY,
    route_id VARCHAR(100) NOT NULL,
    operator VARCHAR(50),
    recorded_at TIMESTAMP DEFAULT NOW(),
    departure_date DATE NOT NULL,

    price_adult DECIMAL(10,2),
    price_child DECIMAL(10,2),
    price_infant DECIMAL(10,2),
    price_vehicle DECIMAL(10,2),

    available_passengers INTEGER,
    available_vehicles INTEGER,
    num_ferries INTEGER,

    lowest_price DECIMAL(10,2),
    highest_price DECIMAL(10,2),
    average_price DECIMAL(10,2),

    INDEX idx_route_date (route_id, departure_date),
    INDEX idx_recorded (recorded_at)
);

-- Price predictions table
CREATE TABLE price_predictions (
    id SERIAL PRIMARY KEY,
    route_id VARCHAR(100) NOT NULL,
    prediction_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),

    predicted_price DECIMAL(10,2),
    confidence_score DECIMAL(3,2),
    price_trend VARCHAR(20),

    booking_recommendation VARCHAR(20),
    potential_savings DECIMAL(10,2),
    recommendation_reason TEXT,

    UNIQUE(route_id, prediction_date)
);

-- Route statistics (aggregated)
CREATE TABLE route_statistics (
    id SERIAL PRIMARY KEY,
    route_id VARCHAR(100) UNIQUE NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW(),

    avg_price_30d DECIMAL(10,2),
    min_price_30d DECIMAL(10,2),
    max_price_30d DECIMAL(10,2),

    avg_price_90d DECIMAL(10,2),
    min_price_90d DECIMAL(10,2),
    max_price_90d DECIMAL(10,2),

    typical_advance_booking INTEGER, -- days
    best_booking_window_start INTEGER,
    best_booking_window_end INTEGER,

    weekday_avg_price DECIMAL(10,2),
    weekend_avg_price DECIMAL(10,2),

    seasonal_pattern JSONB -- monthly patterns
);
```

---

## UI/UX Design

### Search Page Integration

```
┌─────────────────────────────────────────────────────────────┐
│  Search: Marseille → Tunis                                  │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  📅 January 2025          < >     February  March       ││
│  │  ┌───┬───┬───┬───┬───┬───┬───┐                         ││
│  │  │Mon│Tue│Wed│Thu│Fri│Sat│Sun│                         ││
│  │  ├───┼───┼───┼───┼───┼───┼───┤                         ││
│  │  │   │   │ 1 │ 2 │ 3 │ 4 │ 5 │                         ││
│  │  │   │   │€79│€82│€85│€95│€98│  ← Color coded          ││
│  │  ├───┼───┼───┼───┼───┼───┼───┤                         ││
│  │  │ 6 │ 7 │ 8 │ 9 │10 │11 │12 │                         ││
│  │  │€75│€72│€69│€71│€78│€89│€92│  ← Green = cheap        ││
│  │  └───┴───┴───┴───┴───┴───┴───┘                         ││
│  │                                                         ││
│  │  💡 Best price: €69 on Wed, Jan 8                       ││
│  │  📈 Prices rising - book soon!                          ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─ Price Insights ─────────────────────────────────────────┐│
│  │  Current: €85  │  Avg: €82  │  Low: €65  │  High: €120  ││
│  │  ────────────────────────────────────────────────────── ││
│  │  📊 [Price Evolution Chart - 30 days]                   ││
│  │       ╭──╮                                              ││
│  │      ╱    ╲    ╭──╮                                     ││
│  │  ───╱      ╲──╱    ╲───  Current                        ││
│  │                         ╲....... Predicted              ││
│  │  ────────────────────────────────────────────────────── ││
│  │  🤖 AI Recommendation: BOOK NOW                         ││
│  │     Confidence: 78%                                      ││
│  │     "Prices typically rise 15% in the next 2 weeks"     ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─ Flexible Dates ─────────────────────────────────────────┐│
│  │  ○ Exact date  ● Flexible ±3 days  ○ Cheapest in month  ││
│  │                                                          ││
│  │  Jan 6  €75  ✓ Cheapest                                 ││
│  │  Jan 7  €72  ★ Best value                               ││
│  │  Jan 8  €69  ★ Lowest price                             ││
│  │  Jan 9  €71                                             ││
│  │  Jan 10 €78                                             ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Foundation (Backend)
1. Create PriceHistory model and migration
2. Create price tracking Celery task
3. Build basic API endpoints for calendar and history
4. Start collecting price data

### Phase 2: Core UI (Frontend)
1. Build FareCalendar component
2. Build PriceEvolutionChart component
3. Integrate into search page
4. Add flexible dates selector

### Phase 3: Intelligence (AI)
1. Build prediction service
2. Create recommendation engine
3. Add PriceInsights component
4. Display predictions in UI

### Phase 4: Mobile
1. Port FareCalendar to React Native
2. Add price insights to mobile search
3. Push notifications for price predictions

### Phase 5: Polish
1. Performance optimization
2. Caching strategy
3. Tests
4. Documentation

---

## Success Metrics

- **User engagement**: Time spent on fare calendar
- **Conversion rate**: Bookings from price insights users
- **Savings delivered**: Actual savings from recommendations
- **Prediction accuracy**: % of predictions within 10% of actual
- **Feature adoption**: % of users using flexible dates

---

## Dependencies

- **Chart library**: Recharts (already available in many React projects)
- **Date handling**: date-fns (already installed)
- **Celery**: For background price tracking
- **Redis**: For caching price data

---

## Estimated Timeline

- Phase 1: 2-3 days
- Phase 2: 3-4 days
- Phase 3: 2-3 days
- Phase 4: 2-3 days
- Phase 5: 1-2 days

**Total: ~10-15 days**
