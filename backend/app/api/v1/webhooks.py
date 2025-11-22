"""
Webhook endpoints for third-party integrations (Stripe, etc.)
"""

import logging
from typing import Dict, Any

try:
    from fastapi import APIRouter, Request, HTTPException, status, Header
    import stripe
except ImportError:
    # Fallback for development
    class APIRouter:
        def __init__(self, *args, **kwargs):
            pass
        def post(self, *args, **kwargs):
            def decorator(func):
                return func
            return decorator

    class Request:
        pass

    class HTTPException(Exception):
        pass

    class status:
        HTTP_400_BAD_REQUEST = 400
        HTTP_500_INTERNAL_SERVER_ERROR = 500

    def Header(*args, **kwargs):
        return None

    class stripe:
        class Webhook:
            @staticmethod
            def construct_event(payload, sig_header, secret):
                pass

try:
    from app.config import settings
except ImportError:
    from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/stripe")
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(None, alias="Stripe-Signature")
):
    """
    Stripe webhook endpoint for payment events.

    This endpoint receives webhook events from Stripe and processes them
    asynchronously using Celery workers. This ensures fast responses to Stripe
    and decouples payment processing from email notifications.

    Supported events:
    - payment_intent.succeeded: Payment completed successfully
    - payment_intent.payment_failed: Payment failed
    - charge.refunded: Refund processed
    """
    try:
        # Get raw body for signature verification
        payload = await request.body()

        # Verify webhook signature
        try:
            event = stripe.Webhook.construct_event(
                payload,
                stripe_signature,
                settings.STRIPE_WEBHOOK_SECRET
            )
        except ValueError as e:
            # Invalid payload
            logger.error(f"❌ Invalid Stripe webhook payload: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid payload"
            )
        except stripe.error.SignatureVerificationError as e:
            # Invalid signature
            logger.error(f"❌ Invalid Stripe webhook signature: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid signature"
            )

        event_type = event["type"]
        event_data = event["data"]["object"]

        logger.info(f"📨 Received Stripe webhook: {event_type}")

        # Queue the webhook processing task asynchronously
        from app.tasks.payment_tasks import process_payment_webhook_task

        # Extract payment intent ID
        payment_intent_id = None
        if event_type.startswith("payment_intent"):
            payment_intent_id = event_data.get("id")
        elif event_type == "charge.refunded":
            payment_intent_id = event_data.get("payment_intent")

        if payment_intent_id:
            # Queue task and return immediately to Stripe
            task = process_payment_webhook_task.delay(
                event_type=event_type,
                payment_intent_id=payment_intent_id,
                event_data=event_data
            )
            logger.info(f"✅ Webhook task queued: task_id={task.id}")
        else:
            logger.warning(f"⚠️ No payment_intent_id found in event: {event_type}")

        # Return 200 OK immediately to Stripe
        # Actual processing happens asynchronously in Celery worker
        return {
            "status": "success",
            "message": "Webhook received and queued for processing"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Stripe webhook error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Webhook processing failed: {str(e)}"
        )
