# Booking Expiration Cron Job Setup

This document explains how to use the automated booking expiration system that runs in a separate Docker container.

## Overview

The system automatically cancels pending bookings that haven't been paid within 3 days. This is handled by a dedicated cron job container that runs every hour.

## Architecture

- **Cron Container**: Separate Docker container running cron jobs
- **Schedule**: Runs every hour (can be customized)
- **Action**: Finds and cancels expired pending bookings
- **Logging**: Outputs to `/var/log/cron.log`

## Files

### 1. `backend/Dockerfile.cron`
Dockerfile for the cron job container with cron installed and configured.

### 2. `backend/scripts/expire_bookings_cron.py`
Python script that expires old bookings. Can be run:
- Inside Docker (via cron)
- Manually from command line
- Via API endpoint

### 3. `docker-compose.yml` / `docker-compose.dev.yml`
Includes the `cron-expire-bookings` service.

## Usage

### Start with Docker Compose

**Development:**
```bash
cd /Users/ayoubmbarek/Projects/maritime-reservation-website
docker-compose -f docker-compose.dev.yml up -d cron-expire-bookings
```

**Production:**
```bash
docker-compose up -d cron-expire-bookings
```

### View Logs

**Development:**
```bash
docker logs -f maritime-cron-dev
```

**Production:**
```bash
docker logs -f maritime-cron-expire-bookings
```

### Check Cron Job Status

```bash
# View cron log
docker exec maritime-cron-dev tail -f /var/log/cron.log

# Or for production
docker exec maritime-cron-expire-bookings tail -f /var/log/cron.log
```

### Manual Execution

Run the script manually to test:

```bash
# Development
docker exec maritime-cron-dev python scripts/expire_bookings_cron.py

# Production
docker exec maritime-cron-expire-bookings python scripts/expire_bookings_cron.py
```

## Customizing the Schedule

The default schedule is every hour (`0 * * * *`). To change this:

1. Edit `backend/Dockerfile.cron`
2. Modify line 15:
   ```dockerfile
   RUN echo "0 * * * * cd /app && python scripts/expire_bookings_cron.py >> /var/log/cron.log 2>&1" > /etc/cron.d/expire-bookings
   ```

### Example Schedules

```bash
# Every 30 minutes
*/30 * * * *

# Every 6 hours
0 */6 * * *

# Daily at 2 AM
0 2 * * *

# Every 15 minutes
*/15 * * * *
```

3. Rebuild the container:
   ```bash
   docker-compose -f docker-compose.dev.yml up -d --build cron-expire-bookings
   ```

## How It Works

1. **Booking Creation**
   - When a booking is created with status `PENDING`
   - `expires_at` is set to `now() + 3 days`

2. **Cron Job Runs**
   - Every hour (by default)
   - Finds all bookings where:
     - `status = PENDING`
     - `expires_at < now()`
   - Updates these bookings:
     - `status = CANCELLED`
     - `cancellation_reason = "Booking expired - payment not received within 3 days"`
     - `cancelled_at = now()`

3. **Frontend Display**
   - Pending bookings show expiration date
   - Orange "Complete Payment" button
   - After expiration, booking status becomes "Cancelled"

## Monitoring

### Check Last Run Time

```bash
docker exec maritime-cron-dev grep "Expired" /var/log/cron.log | tail -5
```

### View All Cron Activity

```bash
docker exec maritime-cron-dev cat /var/log/cron.log
```

### Check Container Health

```bash
docker ps | grep cron
```

## Troubleshooting

### Container Not Starting

```bash
# Check logs
docker logs maritime-cron-dev

# Rebuild
docker-compose -f docker-compose.dev.yml up -d --build cron-expire-bookings
```

### Cron Not Running

```bash
# Verify cron is running inside container
docker exec maritime-cron-dev ps aux | grep cron

# Check cron configuration
docker exec maritime-cron-dev cat /etc/cron.d/expire-bookings

# Verify crontab
docker exec maritime-cron-dev crontab -l
```

### Database Connection Issues

```bash
# Check environment variables
docker exec maritime-cron-dev env | grep DATABASE

# Test database connection
docker exec maritime-cron-dev python -c "from app.database import SessionLocal; db = SessionLocal(); print('✓ Connected'); db.close()"
```

### Script Errors

```bash
# Run script manually with debug output
docker exec maritime-cron-dev python scripts/expire_bookings_cron.py
```

## Alternative: API Endpoint

You can also expire bookings via API endpoint:

```bash
# Call the endpoint
curl -X POST http://localhost:8010/api/v1/bookings/expire-pending

# Response
{
  "message": "Expired 2 pending booking(s)",
  "expired_count": 2
}
```

This is useful for:
- Manual triggering
- Integration with external cron systems
- Webhook-based execution

## Complete Stack

To start all services including the cron job:

**Development:**
```bash
docker-compose -f docker-compose.dev.yml up -d
```

**Production:**
```bash
docker-compose up -d
```

## Stopping the Cron Container

**Development:**
```bash
docker-compose -f docker-compose.dev.yml stop cron-expire-bookings
```

**Production:**
```bash
docker-compose stop cron-expire-bookings
```

## Removing the Cron Container

```bash
docker-compose -f docker-compose.dev.yml down cron-expire-bookings
```

---

## Summary

The booking expiration system is now fully automated and runs in its own container:

✅ Automatic expiration every hour
✅ Separate container for isolation
✅ Persistent logging
✅ Easy monitoring and debugging
✅ Works in both development and production

No manual intervention required - bookings will automatically expire after 3 days!
