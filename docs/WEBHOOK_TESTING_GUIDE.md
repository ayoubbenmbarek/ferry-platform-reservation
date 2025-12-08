# Webhook Testing Guide

## Current Status

✅ **Stripe CLI Authenticated** - Connected to account `acct_1Q19DVL40zLTUQ47`
✅ **Webhook Secret Configured** - `whsec_da5a8e4aab85b88a18513757500c75245fb403e3319232602d0ae5e92d2160fd`
✅ **Backend Updated** - Using the webhook secret
✅ **Webhook Endpoint Ready** - `POST /api/v1/payments/webhook`

## How to Test Webhooks Locally

### Step 1: Start Webhook Listener

In a terminal, run:

```bash
stripe listen --forward-to localhost:8010/api/v1/payments/webhook
```

You should see:
```
> Ready! You are using Stripe API Version [2024-xx-xx]. Your webhook signing secret is whsec_... (^C to quit)
```

Keep this terminal open and running!

### Step 2: Test Payment Flow

Now you can test the complete payment flow:

1. Open the frontend: http://localhost:3010
2. Search for a ferry
3. Add passenger details
4. Click "Continue to Payment"
5. Use test card: `4242 4242 4242 4242`
   - Expiry: Any future date (e.g., 12/25)
   - CVV: Any 3 digits (e.g., 123)
6. Complete the payment

The webhook listener will show the received event in real-time!

### Step 3: Test Specific Events

In another terminal, you can trigger specific webhook events:

```bash
# Test successful payment
stripe trigger payment_intent.succeeded

# Test failed payment
stripe trigger payment_intent.payment_failed

# Test refund
stripe trigger charge.refunded
```

### Step 4: Monitor Backend Logs

Watch the backend logs to see webhook processing:

```bash
docker logs -f maritime-backend-dev
```

You should see logs when webhooks are received and processed.

## Webhook Events Currently Handled

| Event | What Happens |
|-------|-------------|
| `payment_intent.succeeded` | ✅ Updates payment status to COMPLETED<br>✅ Updates booking status to CONFIRMED<br>✅ Sets payment_status to PAID |
| `payment_intent.payment_failed` | ❌ Marks payment as FAILED<br>❌ Records error message |
| `charge.refunded` | 💰 Updates payment to REFUNDED<br>💰 Records refund amount |

## Testing Checklist

- [ ] Stripe CLI listener is running
- [ ] Backend container is running (`docker ps`)
- [ ] Frontend is accessible at http://localhost:3010
- [ ] Can create a booking
- [ ] Can complete payment with test card
- [ ] Webhook events appear in Stripe CLI terminal
- [ ] Backend logs show webhook processing
- [ ] Booking status updates to CONFIRMED after payment

## Test Cards

Stripe provides various test cards for different scenarios:

### Success
- **4242 4242 4242 4242** - Standard success

### Authentication Required (3D Secure)
- **4000 0025 0000 3155** - Requires authentication

### Declined Cards
- **4000 0000 0000 0002** - Generic decline
- **4000 0000 0000 9995** - Insufficient funds
- **4000 0000 0000 9987** - Lost card
- **4000 0000 0000 9979** - Stolen card

All test cards:
- Expiry: Any future date
- CVV: Any 3 digits
- ZIP: Any 5 digits

## Verifying Webhook Delivery

### In Stripe Dashboard

1. Go to: https://dashboard.stripe.com/test/webhooks
2. Click on your webhook endpoint
3. View recent deliveries
4. Check response codes (200 = success)

### In Backend Logs

Look for these log entries:
```
INFO: 192.168.65.1:xxxxx - "POST /api/v1/payments/webhook HTTP/1.1" 200 OK
```

### In Database

Check the `payments` table to see updated status:

```sql
SELECT id, stripe_payment_intent_id, status, created_at
FROM payments
ORDER BY created_at DESC
LIMIT 5;
```

## Troubleshooting

### Webhook not received

1. **Check Stripe CLI is running**: Look for "Ready!" message
2. **Verify endpoint URL**: Should be `localhost:8010/api/v1/payments/webhook`
3. **Check backend is running**: `docker ps | grep backend`
4. **Look for errors in backend logs**: `docker logs maritime-backend-dev`

### Event received but not processed

1. **Check backend logs for errors**
2. **Verify payment exists in database**
3. **Check `stripe_payment_intent_id` matches**
4. **Ensure database connection is stable**

### Authentication errors

If you see authentication errors, re-login:
```bash
stripe login
```

## Production Deployment Notes

When deploying to production:

1. **Create production webhook** in Stripe Dashboard (Live mode)
2. **Use production URL**: `https://yourdomain.com/api/v1/payments/webhook`
3. **Update webhook secret** with production secret
4. **Enable signature verification** (enhance webhook endpoint security)
5. **Monitor webhook failures** using Stripe Dashboard
6. **Set up alerts** for webhook delivery failures

## Webhook Endpoint Security

The current webhook endpoint includes basic event handling. For production:

- [ ] Add signature verification using `stripe.Webhook.constructEvent()`
- [ ] Add rate limiting
- [ ] Add request logging
- [ ] Add idempotency checks (prevent duplicate processing)
- [ ] Add monitoring/alerting for failures

## Next Steps

Once webhook testing is successful, you can:

1. ✅ Test the complete booking flow end-to-end
2. ✅ Verify all payment statuses update correctly
3. ✅ Test refund functionality
4. ✅ Add more webhook events as needed
5. 🚀 Deploy to staging/production with production webhooks

## Support

- Stripe CLI docs: https://stripe.com/docs/stripe-cli
- Webhook docs: https://stripe.com/docs/webhooks
- Test cards: https://stripe.com/docs/testing