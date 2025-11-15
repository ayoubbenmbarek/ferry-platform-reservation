#!/bin/bash

# Stripe Webhook Setup Helper Script
# This script helps you set up Stripe webhooks for local development

echo "=========================================="
echo "Stripe Webhook Setup for Local Development"
echo "=========================================="
echo ""

# Check if stripe CLI is installed
if ! command -v stripe &> /dev/null; then
    echo "❌ Stripe CLI is not installed."
    echo ""
    echo "Install it with:"
    echo "  brew install stripe/stripe-cli/stripe"
    echo ""
    exit 1
fi

echo "✅ Stripe CLI is installed"
echo ""

# Check if authenticated
if ! stripe config --list &> /dev/null; then
    echo "⚠️  Not authenticated with Stripe. Running login..."
    stripe login
fi

echo "✅ Authenticated with Stripe"
echo ""

# Instructions
echo "📝 Instructions:"
echo ""
echo "1. In this terminal, run:"
echo "   stripe listen --forward-to localhost:8010/api/v1/payments/webhook"
echo ""
echo "2. Copy the webhook signing secret (starts with whsec_)"
echo ""
echo "3. Update your docker-compose.dev.yml with the secret:"
echo "   STRIPE_WEBHOOK_SECRET: whsec_your_secret_here"
echo ""
echo "4. Recreate the backend container:"
echo "   docker-compose -f docker-compose.dev.yml up -d backend"
echo ""
echo "5. Keep the stripe listen command running while testing"
echo ""
echo "6. In another terminal, test the webhook:"
echo "   stripe trigger payment_intent.succeeded"
echo ""
echo "=========================================="
echo "Starting webhook listener..."
echo "=========================================="
echo ""

# Start listening
stripe listen --forward-to localhost:8010/api/v1/payments/webhook
