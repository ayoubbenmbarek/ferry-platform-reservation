# Sentry Monitoring Setup Guide

This guide covers setting up Sentry error tracking and performance monitoring for the Maritime Reservation Platform.

## Table of Contents
1. [Create Sentry Account & Projects](#1-create-sentry-account--projects)
2. [Backend Configuration](#2-backend-configuration)
3. [Frontend Configuration](#3-frontend-configuration)
4. [Alert Rules](#4-alert-rules)
5. [Dashboards](#5-dashboards)
6. [Source Maps](#6-source-maps)
7. [Release Tracking](#7-release-tracking)

---

## 1. Create Sentry Account & Projects

### Sign Up
1. Go to [sentry.io](https://sentry.io) and create an account
2. Create an organization (e.g., "Maritime Reservations")

### Create Projects
Create two separate projects:
1. **Backend** - Python/FastAPI project
2. **Frontend** - React project

For each project, note the DSN (Data Source Name):
```
https://YOUR_KEY@YOUR_ORG.ingest.sentry.io/PROJECT_ID
```
Fastapi DSN: https://1ffe915cbcdbeb35e9200004ebdeed60@o4510450561122309.ingest.de.sentry.io/4510450608111696
REACT DDN: https://17e031859e60f8f293222b3800da98ac@o4510450561122309.ingest.de.sentry.io/4510450614403152
---

## 2. Backend Configuration

### Environment Variables

Add to your `.env` file:

```bash
# Sentry Configuration
SENTRY_DSN=https://YOUR_BACKEND_KEY@YOUR_ORG.ingest.sentry.io/BACKEND_PROJECT_ID
SENTRY_ENVIRONMENT=production  # or staging, development
SENTRY_TRACES_SAMPLE_RATE=0.1  # 10% of transactions
SENTRY_PROFILES_SAMPLE_RATE=0.1  # 10% profiling
```

### Features Enabled (backend/app/monitoring.py)

- **FastAPI Integration** - Automatic request/response tracking
- **SQLAlchemy Integration** - Database query tracking
- **Redis Integration** - Cache operation tracking
- **Celery Integration** - Background task tracking
- **Logging Integration** - Captures ERROR level logs

### Sensitive Data Filtering

The backend automatically filters:
- Authorization headers
- Cookies
- API keys
- Stripe signatures

### Custom Context

```python
from app.monitoring import capture_exception, set_user_context, add_breadcrumb

# Set user context (automatically done on login)
set_user_context(user_id=123, email="user@example.com")

# Add breadcrumbs for debugging
add_breadcrumb("Processing payment", category="payment", data={"amount": 100})

# Capture exceptions with context
try:
    process_payment()
except Exception as e:
    capture_exception(e, booking_id=456, amount=100)
```

---

## 3. Frontend Configuration

### Environment Variables

Add to your `.env` or build args:

```bash
REACT_APP_SENTRY_DSN=https://YOUR_FRONTEND_KEY@YOUR_ORG.ingest.sentry.io/FRONTEND_PROJECT_ID
REACT_APP_ENVIRONMENT=production
REACT_APP_VERSION=1.0.0
```

### Features Enabled (frontend/src/sentry.ts)

- **Error Boundary** - Catches React component errors
- **Browser Tracing** - Page load and navigation tracking
- **Session Replay** - Record user sessions on errors (optional)
- **User Context** - Tracks logged-in users

### Using in Components

```typescript
import { captureException, addBreadcrumb, setTags } from '../sentry';

// Track user actions
const handleBooking = async () => {
  addBreadcrumb('Starting booking', 'booking', 'info', {
    routeId: route.id
  });

  try {
    await createBooking(data);
  } catch (error) {
    captureException(error, {
      bookingData: data,
      step: 'payment'
    });
  }
};

// Set custom tags for filtering
setTags({
  feature: 'booking',
  paymentMethod: 'stripe'
});
```

---

## 4. Alert Rules

### Recommended Alerts

Go to **Alerts** → **Create Alert** in Sentry and set up:

#### Critical Alerts (Immediate)

1. **Payment Failures**
   - When: `logger:app.api.v1.payments` AND `level:error`
   - Action: Email + Slack immediately

2. **High Error Rate**
   - When: Error count > 50 in 5 minutes
   - Action: Email + Slack immediately

3. **Backend Down**
   - When: No events for 10 minutes (use Uptime monitoring)
   - Action: PagerDuty/SMS

#### Warning Alerts (Within 1 hour)

4. **Database Errors**
   - When: `logger:sqlalchemy` AND `level:error`
   - Action: Email

5. **External API Failures**
   - When: Circuit breaker opened
   - Filter: `message:*circuit*breaker*`

6. **Slow Transactions**
   - When: P95 latency > 2 seconds
   - Action: Email

### Alert Configuration Example

```yaml
# Payment Failure Alert
Name: Payment Processing Failed
Conditions:
  - Event level is error
  - Event message contains "payment" OR "stripe"
Actions:
  - Send email to team@voilaferry.com
  - Send Slack notification to #alerts channel
Frequency: Every time
```

---

## 5. Dashboards

### Create Custom Dashboard

Go to **Dashboards** → **Create Dashboard**

#### Recommended Widgets

1. **Error Rate Over Time**
   - Type: Line chart
   - Query: `event.type:error`
   - Group by: Time (hourly)

2. **Top Errors**
   - Type: Table
   - Query: `event.type:error`
   - Columns: title, count, users

3. **Transaction Duration**
   - Type: Line chart
   - Query: `event.type:transaction`
   - Field: `transaction.duration`
   - Y-axis: P95

4. **Errors by Page**
   - Type: Bar chart
   - Query: `event.type:error`
   - Group by: `url`

5. **User Impact**
   - Type: Big Number
   - Query: `event.type:error`
   - Field: `count_unique(user)`

---

## 6. Source Maps

### Backend (Python)
Source maps not needed - Python stack traces are readable.

### Frontend (React)

#### Automatic Upload with Sentry CLI

Add to your build process:

```bash
# Install Sentry CLI
npm install -g @sentry/cli

# After build, upload source maps
sentry-cli releases new $VERSION
sentry-cli releases files $VERSION upload-sourcemaps ./build/static/js \
  --url-prefix '~/static/js'
sentry-cli releases finalize $VERSION
```

#### GitHub Actions Integration

Add to `.github/workflows/deploy-staging.yml`:

```yaml
- name: Upload source maps to Sentry
  env:
    SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
    SENTRY_ORG: your-org
    SENTRY_PROJECT: maritime-frontend
  run: |
    npm install -g @sentry/cli
    VERSION=$(git rev-parse --short HEAD)
    sentry-cli releases new $VERSION
    sentry-cli releases files $VERSION upload-sourcemaps ./frontend/build/static/js
    sentry-cli releases finalize $VERSION
```

---

## 7. Release Tracking

### Backend Releases

Releases are automatically tracked via `APP_VERSION` environment variable:

```python
release=f"maritime-booking@{release}"
```

### Frontend Releases

Set version in build:

```bash
REACT_APP_VERSION=$(git rev-parse --short HEAD) npm run build
```

### Associating Commits

```bash
# In CI/CD after deployment
sentry-cli releases set-commits $VERSION --auto
```

---

## Quick Reference

### Environment Variables Summary

| Variable | Backend | Frontend | Description |
|----------|---------|----------|-------------|
| `SENTRY_DSN` | ✅ | ❌ | Backend DSN |
| `REACT_APP_SENTRY_DSN` | ❌ | ✅ | Frontend DSN |
| `SENTRY_ENVIRONMENT` | ✅ | ❌ | Environment name |
| `REACT_APP_ENVIRONMENT` | ❌ | ✅ | Environment name |
| `SENTRY_TRACES_SAMPLE_RATE` | ✅ | ❌ | Transaction sampling |
| `SENTRY_PROFILES_SAMPLE_RATE` | ✅ | ❌ | Profiling sampling |

### Sample Rates by Environment

| Environment | Traces | Profiles | Replay |
|-------------|--------|----------|--------|
| Development | 0 | 0 | 0 |
| Staging | 0.5 | 0.5 | 0.1 |
| Production | 0.1 | 0.1 | 0.1 |

### Useful Sentry Queries

```
# All errors today
event.type:error timestamp:>now-24h

# Payment errors
logger:*payment* level:error

# Slow API endpoints
event.type:transaction transaction.duration:>2000

# Errors affecting specific user
user.email:customer@example.com

# Frontend errors only
project:maritime-frontend event.type:error
```

---

## Troubleshooting

### Events Not Appearing

1. Check DSN is correct
2. Verify environment isn't filtered out
3. Check browser console for Sentry errors
4. Ensure sample rate > 0

### Source Maps Not Working

1. Verify source maps uploaded correctly:
   ```bash
   sentry-cli releases files $VERSION list
   ```
2. Check URL prefix matches deployed path
3. Ensure release version matches

### Too Many Events

1. Increase sampling rate filters
2. Add more `ignoreErrors` patterns
3. Filter out development/testing events

---

## Contacts

- Sentry Support: support@sentry.io
- Documentation: https://docs.sentry.io/
