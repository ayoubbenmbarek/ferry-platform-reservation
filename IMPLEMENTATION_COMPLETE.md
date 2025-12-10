# Maritime Reservation Website - Implementation Status

---

## ✅ COMPLETED FEATURES

### Core Booking System

#### Backend Implementation ✅
- **Database Models** - All 7 vehicle types supported (car, suv, van, motorcycle, camper, caravan, truck)
- **Booking Model** - `sailing_id`, `operator`, optional `schedule_id`, `special_needs` fields
- **Database Migration** - Applied `20251113_2156-b860474eee5e`
- **API Router** - Fixed circular imports, all endpoints functional
- **API Endpoints**:
  - POST /api/v1/bookings/ - Create booking
  - GET /api/v1/bookings/ - List bookings
  - GET /api/v1/bookings/{booking_id} - Get booking
  - PUT /api/v1/bookings/{booking_id} - Update booking
  - POST /api/v1/bookings/{booking_id}/cancel - Cancel booking
  - GET /api/v1/bookings/{booking_id}/status - Get status
  - GET /api/v1/bookings/reference/{booking_reference} - Get by reference

#### Frontend Implementation ✅
- **Booking Service** - Complete API client with TypeScript type safety
- **Redux Integration** - `contactInfo`, `currentBooking`, `isCreatingBooking`, `bookingError` states
- **State Persistence** - Works correctly

---

### Authentication & Payment (2024-11-24) ✅

#### Google OAuth Login ✅
- Backend: `/api/v1/auth/google` endpoint with server-side token verification
- Auto-creates accounts for new users
- Auto-links guest bookings on login
- Frontend: Official Google Sign-In button on login page
- Database: `google_user_id` column added

#### Apple Pay Integration ✅
- Backend: Configured with `automatic_payment_methods`
- Frontend: Payment Request API implementation
- Shows Apple Pay on Safari/iOS, Google Pay on Chrome/Android
- Falls back to card input if not available

---

### Performance & Async Operations (2024-11-24) ✅

#### Async Invoice Generation ✅
- PDF generation moved to Celery workers
- Webhook responses < 100ms (previously up to 500ms)
- Better throughput and scalability
- Reduced timeout risk for Stripe webhooks

#### Guest Booking Cancellation Fix ✅
- Changed cancel endpoint to allow optional authentication
- Guest users can now cancel bookings without 401 errors

---

### Booking Modification System ✅

#### Phase 1 - Backend Foundation (2024-11-27) ✅
- `booking_modifications` table for tracking modification history
- `modification_quotes` table with 1-hour expiry
- Business rules engine with 8 validation rules
- API endpoints: `can-modify`, `quick-update`, `modifications`

#### Phase 2 - Price Recalculation (2024-11-27) ✅
- `ModificationPriceCalculator` service
- Passenger, vehicle, cabin, meal pricing
- Quote generation and confirmation APIs
- Round-trip pricing support

#### Phase 4 - Simplified UI (2024-11-27) ✅
- ModifyBookingPage component for quick updates
- Edit passenger names and vehicle details
- No fees for quick updates
- Route: `/modify-booking/:bookingId`

---

### Pricing & UI Improvements ✅

#### Differentiated Pricing (2024-11-27) ✅
- Separate pricing for adults, children, infants
- Detailed breakdown: "2 Adults × €85.00 = €170.00"
- Separate sections for outbound/return journeys

#### Cabin Selection Cleanup (2024-11-27) ✅
- Removed from search forms
- Only available during booking flow
- Per-cabin quantity selection (1-3 cabins)
- Separate selection for outbound/return

---

### Other Completed Features ✅

| Feature | Status |
|---------|--------|
| Promo code support | ✅ Done |
| Dishes/meals with invoice | ✅ Done |
| Room/cabin choices (suite, single bed, etc.) | ✅ Done |
| Invoice generation & email | ✅ Done |
| Email confirmation on register | ✅ Done |
| Meals for aller/retour display | ✅ Done |
| Deactivate return date in search | ✅ Done |
| Dockerfile.cron | ✅ Done |
| Search state persistence on return | ✅ Done |
| Complete payment redirect fix | ✅ Done |
| Guest booking email linking | ✅ Done |
| Mandatory field validation before payment | ✅ Done |
| Booking expiration display | ✅ Done |
| Email before booking cancellation | ✅ Done |
| Redis & Celery for async emails | ✅ Done |
| Cron job automation | ✅ Done |
| Manual cancellation email | ✅ Done |
| Different return route support | ✅ Done |
| Pet support on passenger | ✅ Done |
| Multilanguage support | ✅ Done |
| Calendar price cache | ✅ Done |
| Whisper voice search | ✅ Done |
| Progress bar for booking steps | ✅ Done |
| Multi-cabin selection (1-3) | ✅ Done |
| Vehicle model/make/license plate | ✅ Done |
| Vehicle price in summary | ✅ Done |
| Search page duplicate removal | ✅ Done |
| Vehicle availability check | ✅ Done |
| Async confirmation email | ✅ Done |
| Vehicle makes API fix | ✅ Done |
| Notification task scheduling | ✅ Done |
| Availability emoji indicators | ✅ Done |
| Email logo (ferry instead of plane) | ✅ Done |
| Alert conflict message improvement | ✅ Done |
| Cabin/vehicle standalone alerts | ✅ Done |
| Logged-in user email auto-fill for alerts | ✅ Done |
| Availability badge translations | ✅ Done |
| Limited cabin display fix | ✅ Done |
| Search URL parameter auto-fill | ✅ Done |
| Celery alert check fix | ✅ Done |
| Reclining seat dropdown fix | ✅ Done |
| Alert expiration (day of trip) | ✅ Done |
| Reload redirect to homepage | ✅ Done |
| Duplicate booking prevention | ✅ Done |
| Payment already processed message | ✅ Done |
| Cabin upgrade from notification email | ✅ Done |
| Real-time WebSocket availability | ✅ Done |

---

### Real-Time Availability System (WebSocket) ✅

#### Architecture Overview
Real-time ferry availability updates using WebSocket + Redis pub/sub:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        REAL-TIME AVAILABILITY FLOW                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   INSTANT (<100ms)                    FALLBACK (every 2 min)            │
│   ─────────────────                   ──────────────────────            │
│                                                                         │
│   User books/cancels                  Celery Beat schedules             │
│        ↓                                     ↓                          │
│   Booking API                         sync_external_availability()      │
│        ↓                                     ↓                          │
│   publish_availability_now()          Fetch from CTN/GNV/Corsica APIs   │
│        ↓                                     ↓                          │
│   Redis PUBLISH                       Compare with cache                │
│        ↓                                     ↓                          │
│   WebSocket Manager                   If changed → Redis PUBLISH        │
│        ↓                                     ↓                          │
│   Broadcast to all                    Broadcast to subscribed           │
│   subscribed clients                  clients                           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Backend Components

| File | Purpose |
|------|---------|
| `backend/app/websockets/manager.py` | WebSocket connection manager with Redis pub/sub |
| `backend/app/websockets/availability.py` | WebSocket endpoint `/ws/availability` |
| `backend/app/tasks/availability_sync_tasks.py` | Celery tasks for sync + instant publish |

#### Key Functions

**Instant Publish (Internal Changes)**
```python
from app.tasks.availability_sync_tasks import publish_availability_now

# Called automatically when booking is created/cancelled
publish_availability_now(
    route="TUNIS-MARSEILLE",
    ferry_id="sailing-123",
    departure_time="2024-12-20T20:00:00",
    availability={
        "change_type": "booking_created",  # or "booking_cancelled"
        "passengers_booked": 3,
        "vehicles_booked": 1,
    }
)
```

**External API Sync (Celery Beat)**
- Runs every 2 minutes
- Fetches from CTN, GNV, Corsica Linea APIs
- Compares with cache, publishes only if changed
- Catches bookings made outside our platform

#### External API Integration (Future)

When connecting to real ferry operator APIs:

```python
# backend/app/tasks/availability_sync_tasks.py

def fetch_external_availability(route: str) -> list:
    """
    Replace simulated data with real API calls.

    Production implementation:
    - CTN API: https://api.ctn.com.tn/availability
    - GNV API: https://api.gnv.it/v2/availability
    - Corsica Linea: https://api.corsicalinea.com/availability

    Each operator has different auth and response formats.
    Normalize responses to our standard format.
    """
    operator = get_operator_for_route(route)

    if operator == "CTN":
        response = requests.get(
            "https://api.ctn.com.tn/availability",
            headers={"Authorization": f"Bearer {CTN_API_KEY}"},
            params={"route": route}
        )
        return normalize_ctn_response(response.json())

    elif operator == "GNV":
        response = requests.get(
            "https://api.gnv.it/v2/availability",
            headers={"X-API-Key": GNV_API_KEY},
            params={"departure": route.split("-")[0], "arrival": route.split("-")[1]}
        )
        return normalize_gnv_response(response.json())

    # ... other operators
```

#### Frontend/Mobile Usage

```typescript
import { useAvailabilityWebSocket } from '../hooks';

function SearchResults() {
  const { isConnected, lastUpdate } = useAvailabilityWebSocket({
    routes: ['TUNIS-MARSEILLE', 'TUNIS-GENOA'],
    onUpdate: (update) => {
      if (update.type === 'availability_update') {
        // Refresh search results with new availability
        refetchSearchResults();
      }
    },
  });

  return (
    <div>
      {isConnected && <span className="live-badge">LIVE</span>}
      {/* search results */}
    </div>
  );
}
```

#### WebSocket Protocol

**Client → Server Messages:**
```json
{"action": "subscribe", "routes": ["TUNIS-MARSEILLE"]}
{"action": "unsubscribe", "routes": ["TUNIS-MARSEILLE"]}
{"action": "ping"}
```

**Server → Client Messages:**
```json
{"type": "connected", "client_id": "uuid", "message": "Connected"}
{"type": "subscribed", "routes": ["TUNIS-MARSEILLE"]}
{"type": "availability_update", "route": "TUNIS-MARSEILLE", "data": {...}}
{"type": "pong"}
```

---

## 📋 PENDING TODO LIST

### High Priority

| Task | Description |
|------|-------------|
| Voice search improvements | Detect number of passengers and ports, not just dates |
| Admin detection for Google login | `ayoubenmbarek@gmail.com` not detected as admin:done
| First booking confirmation speed | Takes too long on first confirmation |
| Cancellation refund email | Send refund email with cancelled invoice after refund confirmation |
| Invoice storage | Save generated invoices to storage (S3, local, etc.) |
| Other login methods | Evaluate additional OAuth providers |
| MCP for PostgreSQL | Add Model Context Protocol support |
| Unit tests & CI/CD | Tests for Celery tasks and all functions |
todo:Add unitest the the payment checkeout flow to cover payment failures scenarios
todo:subscribe and get notify if price drops
TODO:add notification for prices, for a given routes, weekly or something like that in increased or dropped
price watch:something like this on hooper
todo check existing alerts and try to add info for that alert to be activated and receive email
TODO:run tests in every commit,
TODO:create 3 environment
todo:deploy in self managed kube
todo:Todo add send email if cabin available for user they don’t have cabin
todo: add chatbot, that maybe connected to postgres with mcp to answer user question and connect to mcp ferryhopper too, and answer some support question.
todo:see this but nothing received in mobile phone 
todo:continue with sentry monitoring:done
todo correct view booking detail url http://booking/445 onemail
todo:Search filters by operator maybe too
todo:Mobile app         | 60%+ bookings are mobile 
todo: add cancellation policy, check screenshot for no refundable, no changes..for basic, add fee for cancellation garantee
todo: add Pre-departure reminder emails:done
todo:add sentry for mobile
todo:continue with k3s deployment, set it up locally and heberger en local
todo:when click popular routes should go to home search page with that route information in frontend and mobile
todo: mcp for postgres and chatbots:done
todo:the chatbot with work with apiand how to make chatbot efficient and help with useful informations
todo:chatbot should send relevant link to bokking page or any demand by user if possible, should aware about personal links or data for auth users etc and sending only personla data for the correspondant user:done
todo:i am connected as ayoubenmbarek@gmail.com and demand chatbot to give me booking of olfaserghini1@gmail.com it gave me its reference, that should not happen!
todo:delete booking try by chatbot: done, cant delete
todo:complete personla information in mobile like
  on frontend, and possibility to change
  password and activate language choice and
  currency in profile 
todo:add alert cbain in booking page details in frontend like mobile not only when click modify booking:done
todo:be notified when celery pod or any pod has errors:done
todo:prevent chatbot to be excessive in request or ask something not related
todo:ask bot to subscibe to a route and send notification about it, or subscive for cabon vailability
todo:i cant see ongoing log for chatbot:done
todo:/contact page exists but empt y add it:done
todo:monitor redis and postgres via prometheus and grafana
todo:add marron small bear run when loading the pages:done
todo:add ticket to wallet
todo:add loading bear on mobile:done
todo:translare profile and settings page
todo add contact us in mobile and frontend also i think page /contact exist but empty:done
todo:update maritime support email address
todo how many crons we have:12:, include clear price alert and data after 180 days etc..:done
todo add faq and terms and conditions pages
todo:when change language in mobile nothing happens:done but only homepage translated for now
todo: translate contact page and hide arabic language on menu:done
todo  add ticket to wallet
todo:add ferry map live
todo:flexible dates could show routes in past! you can show prices but greyed maybe in the past:
todo when token expires, and i was logged in i click my booking it shows no booking while i have but i should reconnect, so maybe one token expired should redirect to login page automatically or say seesion expired or something instead of showing connected but in reality not
todo:for customer that have cancelled reservation, try to bring them back if they do not yet reserve or had a booking by promotional email mayb or alert, that they could subscribe we can send email to subscribe to a specific route etc quickly
todo how intergrate real live map
todo:why docker-compose.monitoring and not the same docker compose.dev that we have, and in production how it will be used, if i already prepared k3s deployment that will be k8s later
todo: create env staging on sentry maybe.?
todo:when signup should show message if signup success and tell to validate email that you will receive, and check if that email sent asynch
todo:search with voice don't work on staging get 405 not allowed
todo:How protect user sensitive data passeport etc for rgpd
todo:Postgres logical backups (pg_dump) + WAL archive to object storage (S3/Backblaze).
	•	Snapshot VPS daily (provider snapshot).
todo:Logs: fluent-bit -> Loki + Grafana for recherch
todo:check if thisis done: Redis distributed lock per ferry+date key (short TTL) pour serialiser réservations.
todo:cloudflare security and custom rules:done
todo:Generate sitemap.xml and robots.txt automatically at build.
	•	Use <Head> for meta tags + JSON-LD structured data (schema.org/Flight? Or TravelAgency/Offer).
	•	Set canonical URLs and hreflang if multi-lang (fr/it/en).
	•	Optimize images using Next Image and externalImageDomains or host images on CDN.
	•	Cache headers: for static assets long TTL, HTML pages controlled by CDN, use Cache-Control appropriately.

toddoUtiliser Helm charts officiels (Bitnami, ingress-nginx, cert-manager) pour robustesse.
todo:Tests charge (Locust, k6)
todo:Mentions légales claires
	•	CGV complètes
	•	Assurance annulation proposée (facultatif)

todo:SMS confirmation
todo:Rate limiting (FastAPI + Redis):done
Yes, rate limiting is implemented. Here's
  the summary:

  | Component      | Details
            |
  |----------------|-------------------------
  ----------|
  | Library        | SlowAPI (built on limits
   library) |
  | Storage        | Redis (REDIS_URL env
  var)         |
  | Strategy       | Fixed-window
            |
  | Default limits | 200/minute, 1000/hour
            |

  Endpoint-specific limits:

  | Endpoint Type   | Limit      |
  |-----------------|------------|
  | Login           | 5/minute   |
  | Register        | 3/minute   |
  | Password reset  | 3/minute   |
  | Ferry search    | 60/minute  |
  | Booking create  | 10/minute  |
  | Payment create  | 5/minute   |
  | Admin endpoints | 100/minute |

  Features:
  - Uses user ID if authenticated, falls back
   to IP address
  - Returns X-RateLimit-* headers
  - Custom rate limit exceeded response with
  retry info

  The rate limiter is initialized in
  backend/app/main.py:182-183 and uses Redis
  from REDIS_URL (configured in staging as
  redis://staging-redis-service:6379/0).

todo: RGPD : stockage dans l’UE
todo:whats is SEO optimisé for search rank in google
todo:Change maritime reservation with voila ferry and search for logo
todo:Chatbot connexion trouble on mobile frontend
todo:Website on mobile did not show ports:done
todo prevent abuse use of botchat and voice search
todo:high priority: after search on page meals and cabin, if cabin not exists add notify me button like on booking details, i also receied email cabin evailable but when i enter url i see aucune cabine disponible pour le moment, i know staging db where empty but why i receie email, check availabiity may look for local db?
todo:later check availaibility will check fomr external api

delete this and make them mandatory:Tip: Fill all fields you want before clicking "Save Passenger"

Requis : Prénom & Nom • Optionnel : Date de naissance, Nationalité, Passeport, Infos animal, etc.

added:
USE_MOCK_FERRIES: "true"  #
         +  Enable mock ferry data until 
         + we have real API keys

cat /etc/rancher/k3s/k3s.yaml | sed 's/127.0.0.1/77.42.37.227/g' | base64 -w 0

manage k3s from local machine:
export KUBECONFIG=/tmp/k3s-config.yaml &&
      kubectl -n maritime-reservations-staging
      get pods

Next steps on staging:
  - Create admin user
  - Setup mobile (Expo/Apple/Google accounts)

# Get pods
  kstaging get pods

  # View logs
  kstaging logs staging-backend-xxx

  # Follow logs
  kstaging-logs staging-backend-xxx

  # Quick pod status
  kstaging-pods

  # Any kubectl command
  kstaging describe pod staging-backend-xxx
  kstaging exec -it staging-backend-xxx --
  bash

  # If config expires, refresh it
  refresh-k3s-config
  kstaging         kstaging-events  kstaging-logs    kstaging-node    kstaging-pods    kstaging-top


kubectl -n maritime-reservations-staging logs staging-backend-9cc4cbb4c-hwbc5 --previous 2>/dev/null || kubectl -n maritime-reservations-staging logs staging-backend-9cc4cbb4c-hwbc5 -f
ubectl -nmaritime-reservations-staging logs staging-backend-9cc4cbb4c-hwbc5

kubectl -n maritime-reservations-staging rollout restart deployment/staging-backend

kubectl -n maritime-reservations-staging exec staging-backend-9cc4cbb4c-8jlpb -- env | grep DATABASE

kubectl -n maritime-reservations-staging get secret staging-postgres-secret -o jsonpath='{.data.password}' | base64 -d && echo

kubectl -n maritime-reservations-staging delete pod -l app=postgres

kubectl -n maritime-reservations-staging describe pod staging-postgres-8f7dcbcb7-mhxtv | grep -A10 "Events"

kubectl -n maritime-reservations-staging get pods -w
kubectl -n maritime-reservations-staging logs staging-backend-69f4587648-4cm4d -f

kubectl -n maritime-reservations-staging exec -it staging-postgres-8f7dcbcb7-mhxtv -- psql -U maritime -d maritime_reservations -c "SELECT 1;"

kubectl -n maritime-reservations-staging exec -it staging-backend-69f4587648-4cm4d -- sh -c 'python -c "import psycopg2;  import os; conn=psycopg2.connect(os.environ [\"DATABASE_URL\"]); print(\"OK\");  conn.close()"'

kubectl -n maritime-reservations-staging logs staging-backend-69f4587648-4cm4d 2>&1 | head -50

kubectl -n maritime-reservations-staging describe pod staging-backend-69f4587648-4cm4d | grep -A5 "Last State\|Reason\|Exit Code"

kubectl -n maritime-reservations-staging exec -it staging-backend-69f4587648-4cm4d -- python -c "from app.main import app;  print('App loaded OK')"

vps ip: inet 77.42.37.227
ssh root@77.42.37.227
or deploy@

kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.3/cert-manager.yaml
kubectl wait --for=condition=available --timeout=300s deployment/cert-manager -n cert-manager
kubectl wait --for=condition=available --timeout=300s deployment/cert-manager-webhook -n cert-manager

cat <<EOF | kubectl apply -f -
  apiVersion: cert-manager.io/v1
  kind: ClusterIssuer
  metadata:
    name: letsencrypt-staging
  spec:
    acme:
      server: https://acme-staging-v02.api.l
  etsencrypt.org/directory
      email: ayoubenmbarek@gmail.com
      privateKeySecretRef:
        name: letsencrypt-staging
      solvers:
        - http01:
            ingress:
              class: traefik
  ---
  apiVersion: cert-manager.io/v1
  kind: ClusterIssuer
  metadata:
    name: letsencrypt-prod
  spec:
    acme:
      server: https://acme-v02.api.letsencry
  pt.org/directory
      email: ayoubenmbarek@gmail.com
      privateKeySecretRef:
        name: letsencrypt-prod
      solvers:
        - http01:
            ingress:
              class: traefik
  EOF

generate secure passwords:
DB_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32)
SECRET_KEY=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 64)
JWT_SECRET=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 64)

To Start Monitoring:

docker-compose -f docker-compose.monitoring.yml up -d

It's running. Now you can access:
Grafana login:
  - Username: admin
  - Password: maritime_admin_2024
  - Grafana: http://localhost:3050 (admin / 
  maritime_admin_2024)
  - Prometheus: http://localhost:9090

  Check the status:

  docker ps | grep maritime

  To verify Prometheus is scraping targets,
  visit http://localhost:9090/targets

 To deploy to k3s:
  kubectl apply -k k8s/base/monitoring/

todo send notification is something shown down in infra or app
todo suggest what else to add to grafana promethus that could help monitor etc
todo:do i need one single vps to run kube?


todo search this route hsould go to that specific route, but i see the saved on home page search route instead:done

todo:saved on frontend dont work when want to remove it
todo missing message please login to save route in frontend
todo:mobile show cheapset date dec 1 and there is no price ther shown in calendar and we are on dec 5 on calendar and no color for prices in calendar and cant see price trends nor flexible date in mobile
todo:on price evolution graph i see lowest and highest inversed:done

todo:and add day when send notification to be more clear is better :done
todo add saved routes to frontend, add page on menu
todo:test insight in mobile
todo show insight in frontend
todo:i have tracking routes form genoa to tunis as user ayoubenmbarek@gmail.com but even if i am not logged in i still see tracking  price

todo test offline:
Web (PWA):
  1. Open the app in Chrome
  2. Open DevTools → Application → Service Workers to see
  registration
  3. Use DevTools → Network → Offline checkbox to simulate
  offline
  4. The offline indicator banner should appear
  5. On Chrome, you can install the app via the address bar
  install button

  Mobile:
  1. Open the Search screen
  2. Select departure and arrival ports
  3. The Smart Pricing Panel should appear with Calendar and
  AI Insights tabs
  4. Tap dates in the calendar to update departure date

todo:subscribe and get updates about price for your summer trip when launching, to user to follow prices

todo: add clear message to encourage people to save () ex save and get alerted for price alert ...done
todo:document the alert fonctionnalities and do some tests especially for backend:done
todo complete profile functionnalities mobile

todo:do we use it Code scanning: CodeQL Action v2 is now retired
todo: why this is blank page http://localhost:8010/docs
todo:in search page that shows ferries price shown per adult, try to show all prices for all passenger in search page take in consideration passenger type and may put total in frontend and mobile:done
 todo:passenger inforamtion collapse automatically without saving data
 todo:add modify booking in booking detail page
 todo:when choose two vehicule should could choose 2 same or different type::done

todo:from payment page i have amount of 529 to pay i go back to detail page and added cabins etc amount become 1036 example but
  when i go again to payment i see the old price 529 to pay, correct this please and verify all details:done
--------------------
TODO mobile:
-gmail login
-when select depart date and return date it appear both calendar in same time, i think after choosing, calendar should collapse:done
-add tests for mobile app
-add download invoice in mobile
-continue profile settings
-add cancel button in mobile
-payments method not work on profile settings
-search shown empty, and return get no retun available while in frontend available:done
-trip summary empty too:done
-proceed to paiment get validation error
-passenger add child, infant like in frontend:done
-date of birth change to calendar easiets selection
-todo add bar show in which step we are and possibility to return to any step if possibile to change passneger, meals or something else, because when i return back from payment to search, it show next the page to choose ferry then go directly to paiment page without changing price even if i changed it, and do not respect steps to show melas or cabin agin etc
todo:don't see vehicule information detail

-link sends in email should open applictation or url to browse on browser
-add page to choose cabin meals etc like frontend:done
-apple pay shown but do not work
-Cache MISS for ferry search - fetching from operators, just after few seconds from previous search, how much time the cache stay?
-security 2FA
-could we add cache in mobile too to ameliorer response time and performance?
-wifi and restaurant are not centralized in search page:done
-on trip summary show all details for all passenger and vehicule for their respoective price and melas and cabin etc and any details about price and booking summary before proceeed:done
-mention price shown in search per adult, and try to show all prices for all passenger in search page take in consideration passenger type:done
-add possibility return port different from departure port like frontend:done
-measl do not increase price
-price undefined on cabin
-i choose price on search then in trip summary i found other prices on outbound and return:done
-sign in for exclusive deals have button to the right not really well designed
- show best price highlited best may add:done
-add passeport number and details in mobile app
- should could save actual state, even if i go back, or save on pending then continue to pay, or save and send link via email to coud retrieve that again
-todo when choose two vehicule should could choose 2 same or different type
-todo add latest prices instead of popular routes,maybe in frontend too
-todo:precise price for each type of vehicule, velo, car, jetski etc
todo:complete with use stripe sdk we already implement this o frontend and backend with test keys:done
todo:add search with voice like frontend
todo:if user logged in contact information should be pre-rempli:done
-todo:add mobile notification for the watch alert and check vaialbibility
-todo:how deploy the mobile app, in kubernets, docker compose?
-integrate mobile tests in ci cd:done
todo:sometime when login get 401 unauthorized
todo:i activate facid but nothing appeared,
todo:after logout redirect to home page:done
todo:where to find qr code:done
todo:possibility to send emails for all passenger in specific routes for information updated from the company or any thing


new features:
Next Features (Priority Order)

  1. E-Ticket / QR Code
    - Generate QR code for
  confirmed bookings
    - Display downloadable e-ticket
    - display downloadable invoice
    - Add to Apple/Google Wallet
  2. Push Notifications
    - Booking confirmations
    - Departure reminders (24h, 2h
  before)
    - Price alerts for saved routes
  3. Biometric Authentication
    - Face ID / Touch ID login
    - Secure token storage with
  biometrics
  4. Offline Support
    - Cache bookings for offline
  viewing
    - Queue actions when offline
    - Sync when back online

  ---
  Which feature would you like to
  implement next?


----------what was implemented-----------

  1. ETicketScreen
  (src/screens/ETicketScreen.tsx)
    - QR code with booking
  verification data
    - Ticket-style design with
  route, passengers, and vessel
  info
    - Support for round-trip
  bookings
    - Check-in instructions
  2. Share & Download
    - Share ticket as image via
  device share
    - Save ticket to device storage
  3. Integration
    - Added "View E-Ticket" button
  on BookingDetailsScreen (for
  confirmed bookings)
    - Added ETicket route to
  navigation
  4. Tests - 10 new tests (151
  total)

  Dependencies added:

  - react-native-qrcode-svg - QR
  code generation
  - react-native-svg - SVG support
  - react-native-view-shot -
  Capture ticket as image
  - expo-sharing - Native share
  functionality
  - expo-file-system - File
  operations

---------------------------------

1. Configure Apple Sign-In
  capability in your Xcode project
  2. Register the app bundle ID in
  Apple Developer Console
  3. Update
  backend/.env.development with
  APPLE_BUNDLE_ID (default:
  com.maritime.ferries)


-------------------
Phase 1 (1-2 months):
  - Price watch alerts ⭐ tockeck
  - Loyalty program basics
  - PayPal integration

  Phase 2 (2-4 months):
  - Mobile app (React Native)
  - Ferryhopper MCP integration
  - Group booking
  - Carbon footprint tracker

  Phase 3 (4-6 months):
  - AI trip planner
  - Business portal
  - Live ship tracking
  - Full loyalty program with tiers

### Payment & Pricing

| Task | Description |
|------|-------------|
| Pay in 3 times | Stripe Payment Intents + installment logic |
| Insurance options | "Réserver tranquille" €12, vehicle damage coverage |
| 7-day cancellation restriction | Cannot cancel within 7 days of trip |
| Accessories pricing | Roof box, bike rack, etc. |
| Price comparison | Show prices for day before/after |
TODO:add paiment cabin supplement and email confirmation:done
TODO:check invoice and total summary with more details in booking page and invoice:done
TODO:alert cabin should be shown only if he dont have selected cabin:done
todo:cabin alert independant from initial invoice, add it  to midify page and user could select as many cabin as available:done
todo:and for cabin type alert add any cabin, then the user will see what are available and make his  choice:done
TODO: Add unit tests and correct ci cd:done
TODO:store al invoices somewhere
todo:should secure urls /booking/201 for example is clear so anyone could check others bookings??!!
todo:add agree condition checkbox on mobile beforem pyment
todo:add download e ticket on frontend:done
todo:view mybooking button in mobile after pay should redirect to my ookings not to home page:done
todo:i see cabin logo and vehicule are red and 0 in routes serach  on mobile, but i can select cabin later and i added vehicule, so it is not coherent
todo:where pdf are stored now?invoice and e tickets
 todo: click cabin avalaibilty alert get:done
 todo notify me in mobile get 68.65.1:25343 - "POST /api/v1/availability-alerts HTTP/1.1" 400 Bad Request, it works one time but the or notify me get 400 error:done
  
todo: faceid each time needs to be reactivated, but still not works with sign in
todo alert of cabin should be active untile departure because sometime passenger seek on cabin on the ferry:done
todo:add settings profile
todo:when click sign in with faceid it redirect to phone passcode not face check and not log in
todo:forget password get not found in mobile
todo:onsign up should push notification may an email has been sent pleease confirm etc, we already send email on signup backend 
todo:i try sign in with inexstant user or not yet confirmed i see 403 forbidden in backend log but no message shown in mobile, throw message please confirm account if it already sign up , and other message if dont exist
no message even if enter a non email address to login just show home page again and no warning
todo:i can choose today ferry if it is in the past but today, example i book 22h for a trip that is scheduled 19h the same day it could be not possible, may could book the same day but should not be in the past that day
todo when password in correct page reload to home page but no error shown just this in log  ERROR  AuthSlice login error: Incorrect password. Please try again.
todo: i receive email on cabin available or passenger or vehicule, any alert i have set but do not receive push notification on mobile, i receive push notification for example for trip reminder before 2h and 24hours, could you add push notif for that availaibility if not yet?:done for 2hours alert
todo:get notified when price drop or increase to for saved routes:how to save routes? and test it
todo:test offline search and then connect to see queeued search
todo: idont see cabin and vehicule logo(red,gree etc) in each search result, see only remaning passengers:done
todo:on add cabin payment page after click agree, it stil grayed the button pay:done
todo add cabin invoice to my booking and cabin availaibility alert made should be updated after booking the cabin? and add cabin to trip details
todo:add calendar price routes search, and arrow to go forward in days and backward, to see prices and availaibility etc
todo:add signup popup at the end if user book without registration, also add possibility to search its trip like on frontend by email and booking reference
todo:add cabin in booking details if exist by default, i can see only the upgraded cabin
todo:add notify me when route not found or passenger or cabin or vehicule in mobile if not yet, confirm if it exists on frontend?:done
  - Frontend: AvailabilityAlertButton.tsx exists (passenger/vehicle/cabin alerts)
  - Mobile: AvailabilityBadge shows notify button when unavailable/limited
  - Mobile: Added "Notify Me When Available" button to empty search results state
todo:when see cabin i see 10 available for all cabin types



const ws = new WebSocket('ws://localhost:8010/ws/availability?routes=TUNIS-MARSEILLE'); ws.onmessage = (e) => console.log('📢', JSON.parse(e.data)); ws.onopen = () => console.log('✅ Listening for updates...');

todo i get this but i received email then, what was the error  
todo:what is the diff to use sqlit db and docker db in tests?




Important note about cabin 
  alerts:
  For a notified cabin alert to
  navigate to the "Add Cabin"
  screen, it must have a booking_id
   associated with it. This means:
  - Cabin alerts created from the
  Booking Details page (linked to a
   specific booking) will navigate
  to AddCabin
  - General cabin alerts created
  from Search Results (not linked
  to a booking) will show an info
  dialog instead

  If your cabin alerts are not
  navigating, they might be general
   alerts without a booking_id. In
  that case, the app shows an alert
   dialog saying "Availability
  found! Search for this route to
  book now!"

API reference and examples are available in the filesystem docs: https://docs.expo.dev/versions/v54.0.0/sdk/filesystem/]

todo:click cabin avalaibilty alert get:404 not found:done
todo:sign out should redirect to home page, actually i logout but still in same page, and faceid activated but after logout it do not work:done
todo:i agree checkbox should appear when it is not selected, it is blank on blank when not selected actually:done

to test all:
All done! Here's the summary:

  Deployment Complete

  Dependencies Installed

  - qrcode - QR code generation for
   E-Tickets
  - pillow - Image processing
  (required by qrcode)

  Database Migration

  - booking_reminders table already
   exists
  - All migrations merged and
  stamped

  Containers Rebuilt & Restarted

  - maritime-backend-dev - API
  server
  - maritime-celery-dev - Celery
  worker
  - maritime-celery-beat-dev -
  Scheduled tasks

  E-Ticket Endpoint Testing

  # By booking ID
  curl http://localhost:8010/api/v1
  /bookings/3/eticket -o
  eticket.pdf
  # Result: PDF document, version 
  1.4, 2 pages ✓

  # By booking reference (with 
  email for guest bookings)
  curl "http://localhost:8010/api/v
  1/bookings/reference/MRD7EAB8D5/e
  ticket?email=test@example.com" -o
   eticket.pdf
  # Result: PDF document, version 
  1.4, 2 pages ✓

  Celery Beat Schedule

  The departure reminder task runs
  every 15 minutes checking for:
  - 24h before departure → sends
  reminder email with E-Ticket PDF
  attached
  - 2h before departure → sends
  final reminder email

---

### Price Alert System (Save Routes) ✅

#### Overview
Users can save ferry routes and receive notifications when prices change significantly. This helps travelers find the best deals for their summer holidays or any planned trips.

#### Features Implemented

**Save Route Button**
- Available on search results page (frontend and mobile)
- Heart icon to save/unsave routes
- Modal to select date range for tracking
- Encouraging message: "We'll notify you when the price drops or increases by 5% or more"

**Date Range Selection**
- Users can track prices for specific travel dates (e.g., Dec 4-18)
- Or track general route prices (any date)
- Date picker with 12-month range

**Notification Settings**
- Notify on price **drop** >= 5%
- Notify on price **increase** >= 5%
- Only notifies on **NEW LOW** or **NEW HIGH** prices (not every fluctuation)
- Minimum 1 hour between notifications (anti-spam)
- Compares against initial price when route was saved

**Saved Routes Management**
- Dedicated "Saved Routes" page showing all tracked routes
- View current price, initial price, and price change percentage
- "Search Ferries" button prefills search with saved route details
- Options to change tracking dates or remove route
- Visual indicators for price drops (green) and increases (red)

#### Backend Implementation

**Database Model** (`backend/app/models/price_alert.py`)
```python
class PriceAlert:
    id: int
    email: str
    departure_port: str
    arrival_port: str
    date_from: Optional[date]      # Start of tracking period
    date_to: Optional[date]        # End of tracking period
    initial_price: Optional[float] # Price when saved
    current_price: Optional[float] # Latest checked price
    lowest_price: Optional[float]  # Lowest price seen
    highest_price: Optional[float] # Highest price seen
    best_price_date: Optional[date]# Date with best price in range
    notify_on_drop: bool           # Default: True
    notify_on_increase: bool       # Default: True
    price_threshold_percent: float # Default: 5.0
    status: Enum                   # active, triggered, paused, expired, cancelled
    last_checked_at: datetime
    last_notified_at: datetime
    notification_count: int
```

**API Endpoints** (`backend/app/api/v1/price_alerts.py`)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/price-alerts` | POST | Create new price alert |
| `/price-alerts` | GET | List all alerts (with pagination) |
| `/price-alerts/my-routes` | GET | Get authenticated user's saved routes |
| `/price-alerts/{id}` | GET | Get specific alert |
| `/price-alerts/{id}` | PATCH | Update alert settings |
| `/price-alerts/{id}` | DELETE | Cancel/remove alert |
| `/price-alerts/{id}/pause` | POST | Pause notifications |
| `/price-alerts/{id}/resume` | POST | Resume notifications |
| `/price-alerts/check/{from}/{to}` | GET | Check if route is saved |
| `/price-alerts/stats/summary` | GET | Get alert statistics |

**Celery Tasks** (`backend/app/tasks/price_alert_tasks.py`)
- `check_price_alerts`: Runs every **4 hours**
  - Fetches current prices from ferry API
  - Compares against saved prices
  - Sends notifications for significant changes
  - Only notifies on NEW LOW or NEW HIGH prices
- `cleanup_old_price_alerts`: Runs daily
  - Expires alerts past their tracking date range

**Notification Logic**
```python
# Only notify when:
# 1. Price is a NEW LOW (lower than any previous price)
# 2. AND change is >= threshold (5%) from initial price
if is_new_low and price_change_percent <= -threshold:
    send_notification()

# Or when:
# 1. Price is a NEW HIGH (higher than any previous price)
# 2. AND change is >= threshold (5%) from initial price
if is_new_high and price_change_percent >= threshold:
    send_notification()
```

#### Email Notifications

**Subject Line**: "📉 Price Drop! Marseille → Tunis €64 on Wed, Dec 17"

**Email Content Includes**:
- Route information (departure → arrival)
- Date range being tracked
- Old price vs new price with percentage change
- Best price date highlighted
- Direct link to search for the route

#### Push Notifications (Mobile)

**Title**: "Price Drop Alert! 📉"
**Body**: "Marseille → Tunis: €64 on Wed, Dec 17 (47% off). Book now!"

**Data payload** for navigation:
```json
{
  "type": "price_alert",
  "alert_id": 123,
  "departure_port": "marseille",
  "arrival_port": "tunis",
  "best_date": "2025-12-17"
}
```

#### Frontend Components

**SaveRouteButton** (`frontend/src/components/SaveRouteButton.tsx`)
- Three variants: `button`, `icon`, `compact`
- Shows loading state while checking if route is saved
- Modal for date selection with "Track specific dates" toggle
- Options dropdown for saved routes: "Change Dates" or "Remove"

**SavedRoutesPage** (`frontend/src/pages/SavedRoutesPage.tsx`)
- Lists all saved routes with price tracking info
- Stats summary (total routes, with price drops)
- Search button navigates to prefilled search

#### Mobile Components

**SaveRouteButton** (`mobile/src/components/SaveRouteButton.tsx`)
- Floating action button variant for search results
- iOS-optimized date picker (compact display)
- Android button-triggered date pickers
- Alert dialog for saved route options

**SavedRoutesScreen** (`mobile/src/screens/SavedRoutesScreen.tsx`)
- Pull-to-refresh route list
- Price change indicators
- Navigate to search with prefilled params

#### Configuration

**Celery Beat Schedule** (`backend/app/celery_app.py`)
```python
'check-price-alerts': {
    'task': 'app.tasks.price_alert_tasks.check_price_alerts',
    'schedule': 14400,  # 4 hours in seconds
}
```

**Default Alert Settings**
- `notify_on_drop`: True
- `notify_on_increase`: True
- `price_threshold_percent`: 5.0
- Alert expires when `date_to` passes

---

### Booking Flow

| Task | Description |
|------|-------------|
| Quote by email | Send quote with trip details for pending bookings |
| Booking modification fees | Fees for post-confirmation changes |
| Passenger info mandatory fields | All fields, passport, birthplace, phone (adults), title |
| Real-time availability | Check with ferry API before payment confirmation |

### Notifications & Emails

| Task | Description |
|------|-------------|
| Trip day email | Send reminder on day of trip |
| Route change notification | Email if route information changes |
| Operator updates webhook | Listen to ferry operator endpoints for updates |

### UI/UX Improvements

| Task | Description |
|------|-------------|
| Dynamic homepage | Add promotions and ads |
| Dynamic sign-in pages | More info and ads |
| Search filters | Filter by price, company, date, time |
| Booking page translations | Passenger details, summary, cabin, meals text |
| Copyright update | Change "2024" to current year |
| Remove Arabic | Remove from language selection |

### Technical Improvements

| Task | Description |
|------|-------------|
| Whisper model update | Update to newer version |
| Background cache refresh | Celery task for cache warming |
| License plate lookup API | Integrate actual API in `lookup_license_plate` |
| Infrastructure monitoring agent | Monitor, react, correct, redeploy, notify |
| Real operator API integration | CTN, Corsica Linea, GNV, etc. |
| Route ID for notifications | Use route ID instead of date for production |
| Cabin type availability check | Check specific cabin types in production |

### Integrations

| Task | Description |
|------|-------------|
| Ferryhopper MCP | Integrate ferry routes/schedules MCP |
| Lyko API | CTN and Corsica Linea APIs |

### Contacts & Partnerships

- Lyko: https://lyko.tech/en/portfolio/ctn-ferries-api/
- Ferryhopper MCP: https://partners.ferryhopper.com/mcp
- Corsica Linea: commercial@corsicalinea.com
- Ferry Gateway: sune.haggblom@ferrygateway.org

---

## 📝 Notes

### Calendar vs Ferry List Price Sync
- **Known Behavior**: Calendar may show different price than ferry list
- **Causes**: Cache timing, operator availability, dynamic pricing
- **Current TTL**: 5 minutes for both caches
- **Action**: Monitor when integrating real APIs, consider price-lock mechanism

### Admin Commands

```bash
# Make user admin
docker exec maritime-postgres-dev psql -U postgres -d maritime_reservations_dev -c \
  "UPDATE users SET is_admin = true WHERE email = 'user@example.com';"

# Monitor cron
docker exec maritime-cron-dev tail -f /var/log/cron.log
```

---

## 🚀 DEPLOYMENT & INFRASTRUCTURE

### CI/CD Pipeline ✅
- **GitHub Actions CI** - Tests on every push (backend + frontend)
- **GitHub Actions Deploy** - Auto-deploy to staging on develop branch
- **Docker Images** - Multi-stage builds for backend and frontend
- **Container Registry** - GitHub Container Registry (ghcr.io)

### Kubernetes Setup ✅
```
k8s/
├── base/                    # Common configuration
│   ├── namespace.yaml
│   ├── configmap.yaml
│   ├── secrets.yaml
│   ├── backend-deployment.yaml
│   ├── frontend-deployment.yaml
│   ├── celery-worker-deployment.yaml
│   ├── celery-beat-deployment.yaml
│   ├── redis-deployment.yaml
│   ├── ingress.yaml
│   ├── hpa.yaml             # Horizontal Pod Autoscaler
│   └── pdb.yaml             # Pod Disruption Budget
├── overlays/
│   ├── staging/             # 1 replica, debug enabled
│   └── production/          # 3 replicas, production config
└── README.md
```

### Security Features ✅
- **Security Headers**: X-Frame-Options, X-Content-Type-Options, CSP, HSTS
- **Rate Limiting**: SlowAPI with Redis backend
- **Circuit Breaker**: Fault tolerance for Stripe, Email, Ferry APIs
- **Health Checks**: `/health/live`, `/health/ready`, `/health/detailed`
- **Sentry Monitoring**: Error tracking with performance monitoring

### Environment Configuration ✅
| File | Purpose |
|------|---------|
| `.env.development` | Local Docker development |
| `.env.staging.example` | Staging template |
| `.env.production.example` | Production template |
| `k8s/base/secrets.yaml` | K8s secrets template |
| `k8s/base/configmap.yaml` | K8s non-sensitive config |

### Deployment Commands

**Docker Compose (Development)**
```bash
docker-compose -f docker-compose.dev.yml up -d
```

**Docker Compose (Staging)**
```bash
docker-compose -f docker-compose.staging.yml up -d
```

**Kubernetes (Staging)**
```bash
# Create secrets first
kubectl create secret generic maritime-secrets -n maritime-reservations-staging \
  --from-literal=DATABASE_URL="postgresql://..." \
  --from-literal=SECRET_KEY="..." \
  # ... other secrets

# Deploy
kubectl apply -k k8s/overlays/staging
```

**Kubernetes (Production)**
```bash
kubectl apply -k k8s/overlays/production
```

### Self-Managed K8s Options
See `k8s/SELF-MANAGED-K8S.md` for detailed setup with:
- **k3s** - Best for VPS/single server
- **kubeadm** - Multi-node production
- **microk8s** - Ubuntu/development

---

### Real-Time WebSocket Availability (2024-12-07) ✅

#### Backend WebSocket System ✅
- **WebSocketManager** (`app/websockets/manager.py`) - Connection management with Redis pub/sub
- **Availability Router** (`app/websockets/availability.py`) - WebSocket endpoint `/ws/availability`
- **Route Subscriptions** - Clients subscribe to specific routes (e.g., "TUNIS-MARSEILLE")
- **Real-time Broadcasting** - Availability updates broadcast to all subscribed clients
- **Multi-instance Support** - Redis pub/sub enables horizontal scaling

#### Frontend WebSocket Integration ✅
- **useAvailabilityWebSocket Hook** - Custom hook for WebSocket connection
- **Redux Integration** - `updateFerryAvailability` action updates search results
- **Auto-reconnection** - Handles connection drops gracefully
- **Route-based Subscriptions** - Subscribes to currently viewed routes

#### Mobile Redux Support ✅
- **searchSlice** - `updateFerryAvailability` reducer handles:
  - `passengers_booked` / `passengers_freed`
  - `vehicles_booked` / `vehicles_freed`
  - `cabin_quantity` (booking decreases cabins)
  - `cabins_freed` (cancellation increases cabins)
- ❌ **Missing**: `useAvailabilityWebSocket` hook for mobile (TODO)

#### Availability Update Flow ✅
1. User books/cancels on any platform
2. Backend broadcasts via Redis pub/sub
3. All connected clients receive update
4. Redux state updates in real-time
5. UI reflects new availability instantly

---

### Backend Integration Tests Fixed (2024-12-07) ✅

#### Session Sharing Fix
- **Problem**: Test fixtures and API used different database sessions
- **Root Cause**: Two `get_db` functions (`app.database` and `app.api.deps`)
- **Solution**: Override BOTH `get_db` functions in test fixtures

#### Config Loading Fix
- **Problem**: Tests loaded `.env` file with production DATABASE_URL
- **Solution**: Skip `.env` loading when `ENVIRONMENT=testing`

#### Test Counts
| Component | Tests | Status |
|-----------|-------|--------|
| Backend | 380 | ✅ All pass |
| Frontend | 288 | ✅ All pass |
| Mobile | 706 | ✅ All pass |

---

## 🔄 NEXT STEPS (TODO)

### High Priority
1. **Payment Flow Tests** - End-to-end payment with availability updates
2. **Mobile WebSocket Hook** - Create `useAvailabilityWebSocket` for mobile app

### Medium Priority
3. **Push Notifications** - Booking confirmations, price alerts
4. **Offline Support** - Cache results, queue bookings offline

### Lower Priority
5. **Admin Dashboard** - Booking/user management, analytics
6. **Performance Optimization** - Redis caching, query optimization

---

*Last Updated: 2024-12-07*
