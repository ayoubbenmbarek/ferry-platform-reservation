# Email Dead-Letter Queue

When email sending fails after all retry attempts, failed emails are stored in a dead-letter queue for manual retry.

## Retry Configuration

| Setting | Value | Description |
|---------|-------|-------------|
| Max Retries | 5 | Number of automatic retry attempts |
| Backoff | Exponential | Time between retries increases exponentially |
| Max Backoff | 30 minutes | Maximum wait between retries |
| Jitter | Enabled | Random variation to avoid thundering herd |

### Approximate Retry Schedule

| Attempt | Approximate Delay |
|---------|------------------|
| 1st retry | ~2 seconds |
| 2nd retry | ~4 seconds |
| 3rd retry | ~8 seconds |
| 4th retry | ~16 seconds |
| 5th retry | ~32 seconds (max 30 min) |

After 5 failed attempts, the email is moved to the dead-letter queue.

## Dead-Letter Queue Storage

**Redis Key**: `email:dead_letter_queue`

**Stored Data**:
```json
{
  "task_id": "abc123-def456",
  "task_name": "app.tasks.email_tasks.send_payment_success",
  "kwargs": {
    "to_email": "user@example.com",
    "booking_data": { ... }
  },
  "error": "Network is unreachable",
  "failed_at": "2025-12-06T22:12:46Z",
  "retry_count": 0
}
```

## Admin API Endpoints

All endpoints require admin authentication.

### View Failed Emails

```bash
GET /api/v1/admin/emails/dead-letter-queue
```

**Response**:
```json
{
  "stats": {
    "queue_length": 3,
    "recent_failures": [
      {
        "task_name": "app.tasks.email_tasks.send_payment_success",
        "error": "Network is unreachable",
        "failed_at": "2025-12-06T22:12:46Z",
        "to_email": "user@example.com"
      }
    ]
  },
  "failed_emails": [
    {
      "task_id": "abc123",
      "task_name": "app.tasks.email_tasks.send_payment_success",
      "kwargs": { ... },
      "error": "Network is unreachable",
      "failed_at": "2025-12-06T22:12:46Z",
      "queue_index": 0
    }
  ]
}
```

### Retry Single Email

```bash
POST /api/v1/admin/emails/dead-letter-queue/retry/{queue_index}
```

- `queue_index`: Position in queue (0 = most recent failure)

**Response**:
```json
{
  "status": "success",
  "message": "Email task re-queued",
  "task_id": "new-task-id",
  "task_name": "app.tasks.email_tasks.send_payment_success"
}
```

### Retry All Failed Emails

```bash
POST /api/v1/admin/emails/dead-letter-queue/retry-all
```

**Response**:
```json
{
  "status": "success",
  "retried": 5,
  "errors": null
}
```

### Clear Queue

```bash
DELETE /api/v1/admin/emails/dead-letter-queue
```

**Warning**: This permanently deletes all failed emails without retrying them.

**Response**:
```json
{
  "status": "success",
  "cleared": 5
}
```

## Usage Examples

### Using curl

```bash
# Set your admin token
TOKEN="your-admin-jwt-token"
API_URL="http://localhost:8010/api/v1"

# 1. Check failed emails
curl -H "Authorization: Bearer $TOKEN" \
  "$API_URL/admin/emails/dead-letter-queue"

# 2. Retry a specific email (index 0 = most recent)
curl -X POST -H "Authorization: Bearer $TOKEN" \
  "$API_URL/admin/emails/dead-letter-queue/retry/0"

# 3. Retry ALL failed emails
curl -X POST -H "Authorization: Bearer $TOKEN" \
  "$API_URL/admin/emails/dead-letter-queue/retry-all"

# 4. Clear queue (delete without retrying)
curl -X DELETE -H "Authorization: Bearer $TOKEN" \
  "$API_URL/admin/emails/dead-letter-queue"
```

### Using Python

```python
import requests

API_URL = "http://localhost:8010/api/v1"
headers = {"Authorization": f"Bearer {admin_token}"}

# Check failed emails
response = requests.get(f"{API_URL}/admin/emails/dead-letter-queue", headers=headers)
data = response.json()
print(f"Failed emails: {data['stats']['queue_length']}")

# Retry all
response = requests.post(f"{API_URL}/admin/emails/dead-letter-queue/retry-all", headers=headers)
print(f"Retried: {response.json()['retried']} emails")
```

## Monitoring

### Check Queue Length via Redis CLI

```bash
docker exec -it maritime-redis-dev redis-cli LLEN email:dead_letter_queue
```

### View Queue Contents

```bash
docker exec -it maritime-redis-dev redis-cli LRANGE email:dead_letter_queue 0 -1
```

## Email Task Types

The following email tasks use the dead-letter queue:

| Task Name | Description |
|-----------|-------------|
| `send_booking_confirmation` | Booking confirmation email |
| `send_payment_success` | Payment success with invoice |
| `send_refund_confirmation` | Refund processed notification |
| `send_cabin_upgrade_confirmation` | Cabin upgrade confirmation |
| `send_cancellation` | Booking cancellation notification |
| `send_payment_failed` | Payment failure notification |

## Troubleshooting

### Emails Not Being Sent

1. Check SMTP configuration in `.env.development`:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USERNAME=your-email@gmail.com
   SMTP_PASSWORD=your-app-password
   ```

2. For Gmail, use an App Password (not regular password):
   - Go to Google Account > Security > 2-Step Verification > App passwords
   - Generate a new app password for "Mail"

### Network Errors

If you see `[Errno 101] Network is unreachable`:
- Check Docker network connectivity
- Verify DNS resolution in containers
- Check firewall rules for outbound SMTP (port 587)

### Celery Not Processing

```bash
# Check Celery worker status
docker logs maritime-celery-dev --tail 50

# Restart Celery
docker restart maritime-celery-dev maritime-celery-beat-dev
```
