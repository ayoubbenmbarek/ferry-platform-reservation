"""
Payment API endpoints for handling Stripe payments.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
import stripe
import os
import logging
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

from app.database import get_db
from app.models.user import User
from app.models.booking import Booking, BookingStatusEnum
from app.models.payment import Payment, PaymentMethod as PaymentMethodModel, PaymentStatusEnum, PaymentMethodEnum
from app.schemas.payment import (
    PaymentCreate,
    PaymentResponse,
    PaymentIntent,
    PaymentConfirmation,
    PaymentMethodCreate,
    PaymentMethodResponse,
    PaymentMethodUpdate,
)
from app.api.v1.auth import get_current_active_user
from app.api.deps import get_optional_current_user
from app.services.email_service import email_service
from app.models.meal import BookingMeal

# Load environment variables (skip in testing mode)
if os.environ.get("ENVIRONMENT") != "testing":
    load_dotenv()

router = APIRouter()

# Configure Stripe
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")


@router.post("/create-intent", response_model=PaymentIntent)
async def create_payment_intent(
    payment_data: PaymentCreate,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    """
    Create a Stripe payment intent for a booking.
    """
    try:
        # Validate booking exists and belongs to user (or user is admin)
        booking = db.query(Booking).filter(Booking.id == payment_data.booking_id).first()
        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found"
            )

        # Check if this is a cabin upgrade payment
        is_cabin_upgrade = (
            payment_data.is_upgrade
            or (payment_data.metadata is not None and payment_data.metadata.get('type') == 'cabin_upgrade')
        )

        # For cabin upgrades, check if the ferry has already departed
        if is_cabin_upgrade:
            journey_type = payment_data.metadata.get('journey_type', 'outbound') if payment_data.metadata else 'outbound'
            if journey_type == "return" and booking.return_departure_time:
                departure_time = booking.return_departure_time
            else:
                departure_time = booking.departure_time

            if departure_time:
                # Make both datetimes timezone-aware for comparison
                now = datetime.utcnow()
                # Remove timezone info from departure_time if it has one, for consistent comparison
                if hasattr(departure_time, 'tzinfo') and departure_time.tzinfo is not None:
                    departure_time_naive = departure_time.replace(tzinfo=None)
                else:
                    departure_time_naive = departure_time

                if departure_time_naive < now:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Cannot add cabin to a booking for a ferry that has already departed"
                    )

        # Check if user has permission to pay for this booking
        # Allow if: 1) Guest booking (no user), 2) Booking belongs to logged-in user, 3) User is admin, 4) Booking is pending (allows sharing payment links), 5) Cabin upgrade
        if current_user:
            if booking.user_id and booking.user_id != current_user.id and not current_user.is_admin:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to process payment for this booking",
                )
        elif booking.user_id:
            # Guest trying to pay for a registered user's booking
            # Allow if booking is still pending (enables sharing payment links) OR it's a cabin upgrade
            if booking.status != BookingStatusEnum.PENDING and not is_cabin_upgrade:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="This booking requires authentication",
                )

        if not is_cabin_upgrade:
            existing_payment = (
                db.query(Payment)
                .filter(
                    Payment.booking_id == payment_data.booking_id,
                    Payment.status == PaymentStatusEnum.COMPLETED,
                )
                .first()
            )
            if existing_payment:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Booking is already paid",
                )

        # Handle zero amount (100% discount)
        if payment_data.amount <= 0:
            # Create a free payment record
            payment_method_enum = PaymentMethodEnum[payment_data.payment_method.name]
            payment = Payment(
                booking_id=payment_data.booking_id,
                user_id=current_user.id if current_user else None,
                amount=0,
                currency=payment_data.currency.value,
                status=PaymentStatusEnum.COMPLETED,
                payment_method=payment_method_enum,
                stripe_payment_intent_id=f"free_{booking.booking_reference}",
                net_amount=0,
            )
            db.add(payment)

            # Update booking status to confirmed
            booking.status = BookingStatusEnum.CONFIRMED
            db.commit()

            return PaymentIntent(
                client_secret="free_booking",
                payment_intent_id=f"free_{booking.booking_reference}",
                amount=0,
                currency=payment_data.currency.value,
                status="succeeded",
            )

        # Convert amount to cents for Stripe
        amount_cents = int(payment_data.amount * 100)

        # Build Stripe metadata
        stripe_metadata = {
            "booking_id": payment_data.booking_id,
            "user_id": current_user.id if current_user else "guest",
            "booking_reference": booking.booking_reference,
        }
        # Add custom metadata (e.g., cabin upgrade info)
        if payment_data.metadata:
            stripe_metadata.update({
                f"custom_{k}": str(v) for k, v in payment_data.metadata.items() if v is not None
            })

        # Create Stripe payment intent with all payment methods enabled
        intent = stripe.PaymentIntent.create(
            amount=amount_cents,
            currency=payment_data.currency.value.lower(),
            metadata=stripe_metadata,
            automatic_payment_methods={
                "enabled": True,
                "allow_redirects": "always"  # Allow redirects for wallets
            },
        )

        # Create payment record in database
        # Convert PaymentMethod (schema) to PaymentMethodEnum (model)
        payment_method_enum = PaymentMethodEnum[payment_data.payment_method.name]

        payment = Payment(
            booking_id=payment_data.booking_id,
            user_id=current_user.id if current_user else None,
            amount=payment_data.amount,
            currency=payment_data.currency.value,
            status=PaymentStatusEnum.PENDING,
            payment_method=payment_method_enum,
            stripe_payment_intent_id=intent.id,
            net_amount=payment_data.amount,  # Will be updated after fees
        )
        db.add(payment)
        db.commit()

        return PaymentIntent(
            client_secret=intent.client_secret,
            payment_intent_id=intent.id,
            amount=payment_data.amount,
            currency=payment_data.currency.value,
            status=intent.status,
        )

    except stripe.StripeError as e:
        import logging
        logging.error(f"Stripe error creating payment intent: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Stripe error: {str(e)}",
        )
    except Exception as e:
        import logging
        logging.error(f"Error creating payment intent: {str(e)}", exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Payment intent creation failed: {str(e)}",
        )


@router.post("/confirm/{payment_intent_id}", response_model=PaymentConfirmation)
async def confirm_payment(
    payment_intent_id: str,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    """
    Confirm a payment after successful Stripe payment intent.
    """
    try:
        # Retrieve the payment intent from Stripe with expanded charges
        intent = stripe.PaymentIntent.retrieve(
            payment_intent_id,
            expand=['latest_charge']
        )

        # Find the payment in our database
        payment = (
            db.query(Payment)
            .filter(Payment.stripe_payment_intent_id == payment_intent_id)
            .first()
        )

        if not payment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Payment not found",
            )

        # Verify user has permission
        # Allow if: 1) Guest payment (no user), 2) Payment belongs to logged-in user, 3) User is admin
        if current_user:
            if payment.user_id and payment.user_id != current_user.id and not current_user.is_admin:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to confirm this payment",
                )
        elif payment.user_id:
            # Guest trying to confirm a registered user's payment
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This payment requires authentication",
            )

        # Update payment based on Stripe status
        if intent.status == "succeeded":
            payment.status = PaymentStatusEnum.COMPLETED

            # Extract charge info if available
            latest_charge = getattr(intent, 'latest_charge', None)
            if latest_charge:
                # If latest_charge is a string ID, we need to expand it
                if isinstance(latest_charge, str):
                    charge = stripe.Charge.retrieve(latest_charge)
                else:
                    charge = latest_charge

                payment.stripe_charge_id = charge.id

                # Extract card details if present
                payment_method_details = getattr(charge, 'payment_method_details', None)
                if payment_method_details and hasattr(payment_method_details, 'card'):
                    card = payment_method_details.card
                    payment.card_last_four = getattr(card, 'last4', None)
                    payment.card_brand = getattr(card, 'brand', None)
                    payment.card_exp_month = getattr(card, 'exp_month', None)
                    payment.card_exp_year = getattr(card, 'exp_year', None)

            # Update booking status to CONFIRMED
            booking = db.query(Booking).filter(Booking.id == payment.booking_id).first()
            if booking:
                booking.status = "CONFIRMED"
                booking.payment_status = "PAID"

                # Record promo code usage now that payment is confirmed
                if booking.promo_code:
                    from app.services.promo_code_service import PromoCodeService
                    from app.schemas.promo_code import PromoCodeApplyRequest

                    promo_service = PromoCodeService(db)
                    try:
                        apply_request = PromoCodeApplyRequest(
                            code=booking.promo_code,
                            booking_id=booking.id,
                            original_amount=float(booking.subtotal),
                            email=booking.contact_email.lower(),
                            user_id=booking.user_id
                        )
                        promo_service.apply_promo_code(apply_request)
                        logger.info(f"Promo code {booking.promo_code} usage recorded for paid booking {booking.id}")
                    except Exception as promo_error:
                        logger.error(f"Failed to record promo code usage: {str(promo_error)}")

        elif intent.status == "processing":
            payment.status = PaymentStatusEnum.PROCESSING
        elif intent.status in ["canceled", "requires_payment_method"]:
            payment.status = PaymentStatusEnum.FAILED
            payment.failure_message = f"Payment {intent.status}"

        db.commit()
        db.refresh(payment)

        # Get the booking for response
        booking = db.query(Booking).filter(Booking.id == payment.booking_id).first()

        # Get receipt URL from latest charge
        receipt_url = None
        latest_charge = getattr(intent, 'latest_charge', None)
        if latest_charge:
            if isinstance(latest_charge, str):
                charge = stripe.Charge.retrieve(latest_charge)
            else:
                charge = latest_charge
            receipt_url = getattr(charge, 'receipt_url', None)

        # Send payment confirmation email with invoice if payment succeeded
        # But NOT for cabin upgrades - those are handled separately in add-cabin endpoint
        is_cabin_upgrade = intent.metadata.get('custom_type') == 'cabin_upgrade' if intent.metadata else False

        if is_cabin_upgrade:
            logger.info(f"Cabin upgrade payment confirmed for booking {booking.booking_reference if booking else 'unknown'} - skipping original invoice email")

        if intent.status == "succeeded" and booking and not is_cabin_upgrade:
            try:
                # Prepare booking data for email
                booking_dict = {
                    "id": booking.id,
                    "booking_reference": booking.booking_reference,
                    "operator": booking.operator,
                    "departure_port": booking.departure_port,
                    "arrival_port": booking.arrival_port,
                    "departure_time": booking.departure_time,
                    "arrival_time": booking.arrival_time,
                    "vessel_name": booking.vessel_name,
                    "is_round_trip": booking.is_round_trip,
                    # Return journey details
                    "return_sailing_id": booking.return_sailing_id,
                    "return_operator": booking.return_operator,
                    "return_departure_port": booking.return_departure_port,
                    "return_arrival_port": booking.return_arrival_port,
                    "return_departure_time": booking.return_departure_time,
                    "return_arrival_time": booking.return_arrival_time,
                    "return_vessel_name": booking.return_vessel_name,
                    "contact_email": booking.contact_email,
                    "contact_phone": booking.contact_phone,
                    "contact_first_name": booking.contact_first_name,
                    "contact_last_name": booking.contact_last_name,
                    "total_passengers": booking.total_passengers,
                    "total_vehicles": booking.total_vehicles,
                    "subtotal": float(booking.subtotal),
                    "tax_amount": float(booking.tax_amount) if booking.tax_amount else 0,
                    "total_amount": float(booking.total_amount),
                    "currency": booking.currency,
                    "cabin_supplement": float(booking.cabin_supplement) if booking.cabin_supplement else 0,
                    "return_cabin_supplement": float(booking.return_cabin_supplement) if booking.return_cabin_supplement else 0,
                }
                booking_dict["base_url"] = os.getenv("BASE_URL", "http://localhost:3001")

                payment_dict = {
                    "amount": float(payment.amount),
                    "payment_method": payment.payment_method.value if payment.payment_method else "Credit Card",
                    "transaction_id": payment.stripe_charge_id or payment_intent_id,
                    "created_at": payment.created_at,
                    "stripe_payment_intent_id": payment.stripe_payment_intent_id,
                    "stripe_charge_id": payment.stripe_charge_id,
                    "card_brand": payment.card_brand,
                    "card_last_four": payment.card_last_four,
                }

                # Prepare data for async invoice generation in Celery worker
                # Get passengers
                passengers = []
                for p in booking.passengers:
                    passengers.append({
                        'passenger_type': p.passenger_type.value if hasattr(p.passenger_type, 'value') else str(p.passenger_type),
                        'first_name': p.first_name,
                        'last_name': p.last_name,
                        'final_price': float(p.final_price)
                    })

                # Get vehicles
                vehicles = []
                for v in booking.vehicles:
                    vehicles.append({
                        'vehicle_type': v.vehicle_type.value if hasattr(v.vehicle_type, 'value') else str(v.vehicle_type),
                        'license_plate': v.license_plate,
                        'final_price': float(v.final_price)
                    })

                # Get meals
                meals = []
                for m in booking.meals:
                    meals.append({
                        'meal_name': m.meal.name if m.meal else 'Meal',
                        'quantity': m.quantity,
                        'unit_price': float(m.unit_price),
                        'total_price': float(m.total_price)
                    })

                # Queue async email task - PDF will be generated in Celery worker
                from app.tasks.email_tasks import send_payment_success_email_task
                send_payment_success_email_task.delay(
                    booking_data=booking_dict,
                    payment_data=payment_dict,
                    to_email=booking.contact_email,
                    passengers=passengers,
                    vehicles=vehicles,
                    meals=meals,
                    generate_invoice=True  # Generate PDF asynchronously in worker
                )
                logger.info(f"✅ Payment success email queued for {booking.contact_email} (invoice will be generated asynchronously)")

            except Exception as e:
                # Log email error but don't fail the payment confirmation
                logger.error(f"Failed to send payment confirmation email for booking {booking.booking_reference if booking else 'unknown'}: {str(e)}", exc_info=True)

        return PaymentConfirmation(
            payment_id=payment.id,
            booking_reference=booking.booking_reference if booking else "",
            amount=float(payment.amount),
            currency=payment.currency,
            status=payment.status.value.lower(),
            transaction_id=payment.stripe_charge_id or payment_intent_id,
            receipt_url=receipt_url,
            confirmation_number=booking.booking_reference if booking else "",
        )

    except stripe.StripeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Stripe error: {str(e)}",
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Payment confirmation failed: {str(e)}",
        )


@router.get("/booking/{booking_id}", response_model=Optional[PaymentResponse])
async def get_booking_payment(
    booking_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Get payment details for a specific booking.
    """
    # Verify booking exists and user has access
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found"
        )

    if booking.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this payment",
        )

    # Get the most recent payment for this booking
    payment = (
        db.query(Payment)
        .filter(Payment.booking_id == booking_id)
        .order_by(Payment.created_at.desc())
        .first()
    )

    if not payment:
        return None

    return PaymentResponse.model_validate(payment)


@router.get("/methods")
async def get_payment_methods():
    """
    Get available payment methods.
    This is a simple endpoint that returns supported payment methods.
    """
    return [
        {
            "id": "card",
            "name": "Credit/Debit Card",
            "description": "Pay securely with your credit or debit card",
            "icon": "credit_card",
        },
        {
            "id": "paypal",
            "name": "PayPal",
            "description": "Pay with your PayPal account",
            "icon": "paypal",
            "coming_soon": True,
        },
    ]


@router.get("/config")
async def get_stripe_config():
    """
    Get Stripe publishable key for frontend.
    """
    return {
        "publishableKey": os.getenv("STRIPE_PUBLISHABLE_KEY"),
        "currency": "EUR",
    }


@router.post("/webhook")
async def stripe_webhook(
    request: dict,
    db: Session = Depends(get_db),
):
    """
    Handle Stripe webhook events.
    This endpoint receives notifications from Stripe about payment events.
    """
    from fastapi import Request as FastAPIRequest

    # In production, verify the webhook signature
    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")

    try:
        # Get the event type
        event_type = request.get("type")
        event_data = request.get("data", {}).get("object", {})

        if event_type == "payment_intent.succeeded":
            # Payment was successful
            payment_intent_id = event_data.get("id")

            # Find and update the payment in database
            payment = (
                db.query(Payment)
                .filter(Payment.stripe_payment_intent_id == payment_intent_id)
                .first()
            )

            if payment:
                payment.status = PaymentStatusEnum.COMPLETED

                # Update booking status
                booking = db.query(Booking).filter(Booking.id == payment.booking_id).first()
                if booking:
                    booking.status = "CONFIRMED"
                    booking.payment_status = "PAID"

                db.commit()

        elif event_type == "payment_intent.payment_failed":
            # Payment failed
            payment_intent_id = event_data.get("id")
            error_message = event_data.get("last_payment_error", {}).get("message")

            payment = (
                db.query(Payment)
                .filter(Payment.stripe_payment_intent_id == payment_intent_id)
                .first()
            )

            if payment:
                payment.status = PaymentStatusEnum.FAILED
                payment.failure_message = error_message
                db.commit()

        elif event_type == "charge.refunded":
            # Charge was refunded
            charge_id = event_data.get("id")
            refund_amount = event_data.get("amount_refunded", 0) / 100  # Convert from cents

            payment = (
                db.query(Payment)
                .filter(Payment.stripe_charge_id == charge_id)
                .first()
            )

            if payment:
                payment.status = PaymentStatusEnum.REFUNDED
                payment.refund_amount = refund_amount

                # Update booking refund status
                booking = db.query(Booking).filter(Booking.id == payment.booking_id).first()
                if booking:
                    booking.refund_processed = True
                    booking.refund_amount = refund_amount

                db.commit()

                # Send refund confirmation email
                if booking:
                    try:
                        from app.tasks.email_tasks import send_refund_confirmation_email_task

                        # Prepare booking data for email (include refund info)
                        # Note: Pass datetime objects for template .strftime() calls
                        booking_dict = {
                            'id': booking.id,
                            'booking_reference': booking.booking_reference,
                            'operator': booking.operator or 'Ferry Operator',
                            'departure_port': booking.departure_port,
                            'arrival_port': booking.arrival_port,
                            'departure_time': booking.departure_time,  # Keep as datetime object
                            'arrival_time': booking.arrival_time,  # Keep as datetime object
                            'contact_email': booking.contact_email,
                            'contact_first_name': booking.contact_first_name or '',
                            'contact_last_name': booking.contact_last_name or '',
                            'total_amount': float(booking.total_amount),
                            'currency': booking.currency,
                            # Refund information
                            'refund_amount': float(refund_amount),
                            'stripe_refund_id': charge_id,
                            'refunded_at': datetime.utcnow(),  # Keep as datetime object
                            'base_url': 'http://localhost:3001',
                        }

                        # Queue async email task
                        send_refund_confirmation_email_task.delay(
                            booking_data=booking_dict,
                            to_email=booking.contact_email
                        )
                        logger.info(f"✅ Refund confirmation email queued for {booking.contact_email}")
                    except Exception as email_error:
                        logger.error(f"Failed to send refund confirmation email: {str(email_error)}", exc_info=True)

        return {"status": "success"}

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Webhook error: {str(e)}",
        )


# ==================== Saved Payment Methods Endpoints ====================

@router.get("/saved-methods", response_model=List[PaymentMethodResponse])
async def get_saved_payment_methods(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Get all saved payment methods for the current user.
    """
    methods = (
        db.query(PaymentMethodModel)
        .filter(
            PaymentMethodModel.user_id == current_user.id,
            PaymentMethodModel.is_active == True,
        )
        .order_by(PaymentMethodModel.is_default.desc(), PaymentMethodModel.created_at.desc())
        .all()
    )
    return methods


@router.post("/saved-methods", response_model=PaymentMethodResponse)
async def add_saved_payment_method(
    method_data: PaymentMethodCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Add a new saved payment method (card) for the user.
    Requires a Stripe payment method ID from the frontend.
    """
    try:
        # Verify the Stripe payment method exists and get card details
        if method_data.stripe_payment_method_id:
            stripe_pm = stripe.PaymentMethod.retrieve(method_data.stripe_payment_method_id)

            # Attach the payment method to the customer (create customer if needed)
            # First check if user has a Stripe customer ID
            stripe_customer_id = getattr(current_user, 'stripe_customer_id', None)

            if not stripe_customer_id:
                # Create a new Stripe customer
                customer = stripe.Customer.create(
                    email=current_user.email,
                    name=f"{current_user.first_name} {current_user.last_name}",
                    metadata={"user_id": current_user.id},
                )
                stripe_customer_id = customer.id
                # Note: You may want to save this to the user model

            # Attach payment method to customer
            stripe.PaymentMethod.attach(
                method_data.stripe_payment_method_id,
                customer=stripe_customer_id,
            )

            card = stripe_pm.card
            card_last_four = card.last4 if card else None
            card_brand = card.brand if card else None
            card_exp_month = card.exp_month if card else None
            card_exp_year = card.exp_year if card else None
        else:
            card_last_four = None
            card_brand = None
            card_exp_month = None
            card_exp_year = None

        # If this is set as default, remove default from other methods
        if method_data.is_default:
            db.query(PaymentMethodModel).filter(
                PaymentMethodModel.user_id == current_user.id,
                PaymentMethodModel.is_default == True,
            ).update({"is_default": False})

        # Create the payment method record
        payment_method = PaymentMethodModel(
            user_id=current_user.id,
            method_type=PaymentMethodEnum[method_data.method_type.name],
            is_default=method_data.is_default,
            stripe_payment_method_id=method_data.stripe_payment_method_id,
            card_last_four=card_last_four,
            card_brand=card_brand,
            card_exp_month=card_exp_month,
            card_exp_year=card_exp_year,
            billing_name=method_data.billing_address.name if method_data.billing_address else None,
            billing_address_line1=method_data.billing_address.address_line1 if method_data.billing_address else None,
            billing_address_line2=method_data.billing_address.address_line2 if method_data.billing_address else None,
            billing_city=method_data.billing_address.city if method_data.billing_address else None,
            billing_state=method_data.billing_address.state if method_data.billing_address else None,
            billing_postal_code=method_data.billing_address.postal_code if method_data.billing_address else None,
            billing_country=method_data.billing_address.country if method_data.billing_address else None,
            is_active=True,
        )

        db.add(payment_method)
        db.commit()
        db.refresh(payment_method)

        return payment_method

    except stripe.StripeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Stripe error: {str(e)}",
        )
    except Exception as e:
        db.rollback()
        logger.error(f"Error adding payment method: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add payment method: {str(e)}",
        )


@router.patch("/saved-methods/{method_id}", response_model=PaymentMethodResponse)
async def update_saved_payment_method(
    method_id: int,
    update_data: PaymentMethodUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Update a saved payment method (set as default, update billing address).
    """
    # Find the payment method
    payment_method = (
        db.query(PaymentMethodModel)
        .filter(
            PaymentMethodModel.id == method_id,
            PaymentMethodModel.user_id == current_user.id,
            PaymentMethodModel.is_active == True,
        )
        .first()
    )

    if not payment_method:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment method not found",
        )

    # Update default status
    if update_data.is_default is True:
        # Remove default from other methods first
        db.query(PaymentMethodModel).filter(
            PaymentMethodModel.user_id == current_user.id,
            PaymentMethodModel.is_default == True,
            PaymentMethodModel.id != method_id,
        ).update({"is_default": False})
        payment_method.is_default = True
    elif update_data.is_default is False:
        payment_method.is_default = False

    # Update billing address if provided
    if update_data.billing_address:
        payment_method.billing_name = update_data.billing_address.name
        payment_method.billing_address_line1 = update_data.billing_address.address_line1
        payment_method.billing_address_line2 = update_data.billing_address.address_line2
        payment_method.billing_city = update_data.billing_address.city
        payment_method.billing_state = update_data.billing_address.state
        payment_method.billing_postal_code = update_data.billing_address.postal_code
        payment_method.billing_country = update_data.billing_address.country

    db.commit()
    db.refresh(payment_method)

    return payment_method


@router.delete("/saved-methods/{method_id}")
async def delete_saved_payment_method(
    method_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Delete (deactivate) a saved payment method.
    """
    # Find the payment method
    payment_method = (
        db.query(PaymentMethodModel)
        .filter(
            PaymentMethodModel.id == method_id,
            PaymentMethodModel.user_id == current_user.id,
            PaymentMethodModel.is_active == True,
        )
        .first()
    )

    if not payment_method:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment method not found",
        )

    try:
        # Detach from Stripe if it has a Stripe payment method ID
        if payment_method.stripe_payment_method_id:
            try:
                stripe.PaymentMethod.detach(payment_method.stripe_payment_method_id)
            except stripe.StripeError as e:
                # Log but don't fail - the method may already be detached
                logger.warning(f"Could not detach Stripe payment method: {str(e)}")

        # Soft delete (deactivate)
        payment_method.is_active = False
        payment_method.is_default = False

        db.commit()

        return {"message": "Payment method deleted successfully"}

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete payment method: {str(e)}",
        )


@router.post("/saved-methods/{method_id}/set-default", response_model=PaymentMethodResponse)
async def set_default_payment_method(
    method_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Set a payment method as the default.
    """
    # Find the payment method
    payment_method = (
        db.query(PaymentMethodModel)
        .filter(
            PaymentMethodModel.id == method_id,
            PaymentMethodModel.user_id == current_user.id,
            PaymentMethodModel.is_active == True,
        )
        .first()
    )

    if not payment_method:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment method not found",
        )

    # Remove default from all other methods
    db.query(PaymentMethodModel).filter(
        PaymentMethodModel.user_id == current_user.id,
        PaymentMethodModel.is_default == True,
    ).update({"is_default": False})

    # Set this one as default
    payment_method.is_default = True

    db.commit()
    db.refresh(payment_method)

    return payment_method
