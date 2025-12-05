# Stripe Webhook Setup Guide

## Why Webhooks?

Webhooks are **essential** for production but **optional** for development. They provide:

1. **Reliability**: Ensures payment status is updated even if user closes browser
2. **Security**: Server-side verification of payment events
3. **Real-time updates**: Instant notification of payment events (success, failure, refunds)
4. **Reconciliation**: Helps track all payment events for accounting

## Current Status

✅ **For Development**: Webhooks are optional. The payment flow works without them because we confirm payments directly in the frontend.

⚠️ **For Production**: Webhooks are **mandatory** for a reliable payment system.

## Setup Instructions

### Option 1: Local Development with Stripe CLI (Recommended)

This allows you to test webhooks locally without exposing your server to the internet.

#### Step 1: Install Stripe CLI

```bash
# macOS
brew install stripe/stripe-cli/stripe

# Or download from: https://stripe.com/docs/stripe-cli
```

#### Step 2: Authenticate with Stripe

```bash
stripe login
```

This will open your browser to authorize the CLI with your Stripe account.

#### Step 3: Forward Webhooks to Local Server

```bash
stripe listen --forward-to localhost:8010/api/v1/payments/webhook
```

#### Step 4: Copy the Webhook Secret

The CLI will display something like:
```
> Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxx
```

Copy this secret and update your `.env` or `docker-compose.dev.yml`:

```env
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

#### Step 5: Test with Stripe CLI

In another terminal, trigger a test event:

```bash
stripe trigger payment_intent.succeeded
```

### Option 2: Production Webhook Setup

For production deployment (when your backend is publicly accessible):

#### Step 1: Go to Stripe Dashboard

1. Visit: https://dashboard.stripe.com/webhooks
2. Switch to **Live mode** (or **Test mode** for staging)

#### Step 2: Add Endpoint

1. Click **"Add endpoint"**
2. Enter your endpoint URL:
   ```
   https://yourdomain.com/api/v1/payments/webhook
   ```

#### Step 3: Select Events

Select these events (minimum required):
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `payment_intent.canceled`
- `charge.refunded`

Or select **"Select all events"** for comprehensive coverage.

#### Step 4: Get Signing Secret

1. Click on the created endpoint
2. Click **"Reveal"** next to **"Signing secret"**
3. Copy the secret (starts with `whsec_`)
4. Add it to your environment variables:

```env
STRIPE_WEBHOOK_SECRET=whsec_your_production_webhook_secret
```

## Webhook Endpoint

The webhook endpoint is: `POST /api/v1/payments/webhook`

### Handled Events

Currently, the following events are processed:

1. **payment_intent.succeeded** - Updates payment and booking status to COMPLETED/CONFIRMED
2. **payment_intent.payment_failed** - Marks payment as FAILED with error message
3. **charge.refunded** - Updates payment status to REFUNDED

### Testing Webhooks

#### Test with Stripe CLI

```bash
# Success event
stripe trigger payment_intent.succeeded

# Failed payment
stripe trigger payment_intent.payment_failed

# Refund
stripe trigger charge.refunded
```

#### Test with Dashboard

1. Go to https://dashboard.stripe.com/test/payments
2. Make a test payment using your application
3. Go to https://dashboard.stripe.com/test/webhooks
4. View the webhook delivery attempts
5. Click "Send test webhook" to retry events

### Verifying Webhook Signature (Production)

For production, webhook signature verification should be enabled to prevent unauthorized requests.

The current implementation includes webhook secret configuration but needs full signature verification for production use.

## Environment Variables Summary

```env
# Required for webhooks
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Also required
STRIPE_SECRET_KEY=sk_test_or_live_your_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_or_live_your_publishable_key
```

## Troubleshooting

### Webhook not receiving events

1. **Check endpoint URL**: Ensure it's publicly accessible (or using Stripe CLI for local)
2. **Verify secret**: Make sure `STRIPE_WEBHOOK_SECRET` is set correctly
3. **Check logs**: Look at backend logs for any errors
4. **Test mode**: Ensure dashboard is in Test mode when using test keys

### Signature verification errors

1. Ensure webhook secret matches the endpoint
2. Check that you're not modifying the raw request body
3. Verify the secret starts with `whsec_`

### Events not being processed

1. Check database logs
2. Verify the payment exists with matching `stripe_payment_intent_id`
3. Ensure database connection is stable

## Benefits of Using Webhooks

✅ **Reliability**: Payment status updates even if user's browser crashes
✅ **Asynchronous**: Handles long-running payment processes
✅ **Dispute handling**: Get notified of chargebacks and disputes
✅ **Refund tracking**: Automatic updates when refunds are processed
✅ **Audit trail**: Complete history of all payment events

## Current Implementation Status

- ✅ Webhook endpoint created at `/api/v1/payments/webhook`
- ✅ Handles payment success, failure, and refund events
- ✅ Updates payment and booking status automatically
- ⚠️ Signature verification configured but can be enhanced
- ⚠️ Additional events can be added (disputes, subscription events, etc.)

## Next Steps for Production

1. Set up webhook endpoint in Stripe Dashboard
2. Configure production webhook secret
3. Enable full signature verification
4. Add monitoring and alerting for failed webhooks
5. Implement webhook retry logic
6. Add webhook event logging for compliance