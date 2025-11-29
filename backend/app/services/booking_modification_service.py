"""
Booking modification service.

Handles the complete booking modification flow.
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from decimal import Decimal
import json

from sqlalchemy.orm import Session

from app.models.booking import Booking, BookingModification, ModificationQuote
from app.schemas.modification import ModificationRequest
from app.services.modification_rules import ModificationRules
from app.services.modification_price_calculator import ModificationPriceCalculator
from app.services.ferry_service import FerryService


class BookingModificationService:
    """Service for handling booking modifications."""

    def __init__(self):
        self.price_calculator = ModificationPriceCalculator()
        self.ferry_service = FerryService()

    async def create_modification_quote(
        self,
        booking_id: int,
        modification_request: ModificationRequest,
        db: Session
    ) -> ModificationQuote:
        """
        Create a modification quote.

        Args:
            booking_id: ID of the booking to modify
            modification_request: Requested modifications
            db: Database session

        Returns:
            ModificationQuote object

        Raises:
            ValueError: If booking cannot be modified or availability check fails
        """

        # 1. Get booking
        booking = db.query(Booking).filter(Booking.id == booking_id).first()
        if not booking:
            raise ValueError("Booking not found")

        # 2. Validate booking can be modified
        can_modify, modification_type, message = ModificationRules.can_modify(booking)
        if not can_modify:
            raise ValueError(message)

        if modification_type == "quick":
            raise ValueError("This booking only allows quick modifications. Use the quick-update endpoint instead.")

        # 3. Check availability with operator API (if date/route changed)
        availability_confirmed = False
        new_ferry_prices = None

        if self._requires_availability_check(modification_request):
            availability_params = self.price_calculator.get_availability_check_params(
                booking,
                modification_request
            )

            # Check with ferry operator
            try:
                availability_result = await self.ferry_service.search_ferries(
                    departure_port=availability_params["departure_port"],
                    arrival_port=availability_params["arrival_port"],
                    departure_date=availability_params["departure_date"],
                    adults=availability_params["adults"],
                    children=availability_params["children"],
                    infants=availability_params["infants"],
                    vehicles=None,  # Will be calculated
                    operators=[booking.operator] if booking.operator else None
                )

                if not availability_result or len(availability_result) == 0:
                    raise ValueError("No ferries available for the requested date/route")

                # Get the sailing that matches (or closest match)
                new_ferry = availability_result[0]
                new_ferry_prices = new_ferry.prices
                availability_confirmed = True

            except Exception as e:
                raise ValueError(f"Availability check failed: {str(e)}")
        else:
            # No date/route change, availability confirmed
            availability_confirmed = True

        # 4. Calculate new pricing
        price_quote = await self.price_calculator.calculate_modification_price(
            booking,
            modification_request,
            new_ferry_prices
        )

        # 5. Create quote record (expires in 1 hour)
        expires_at = datetime.utcnow() + timedelta(hours=1)

        quote = ModificationQuote(
            booking_id=booking_id,
            expires_at=expires_at,
            modifications=json.dumps(modification_request.dict()),
            price_breakdown=json.dumps({
                "passengers": str(price_quote["breakdown"]["passengers"]),
                "vehicles": str(price_quote["breakdown"]["vehicles"]),
                "cabins": str(price_quote["breakdown"]["cabins"]),
                "meals": str(price_quote["breakdown"]["meals"]),
            }),
            original_total=price_quote["original_total"],
            new_total=price_quote["new_subtotal"],
            modification_fee=price_quote["modification_fee"],
            price_difference=price_quote["price_difference"],
            total_to_pay=price_quote["total_to_pay"],
            availability_confirmed=availability_confirmed,
            status="pending"
        )

        db.add(quote)
        db.commit()
        db.refresh(quote)

        return quote

    async def confirm_modification(
        self,
        booking_id: int,
        quote_id: int,
        payment_method_id: Optional[str],
        db: Session,
        current_user_id: Optional[int] = None,
        is_admin: bool = False
    ) -> BookingModification:
        """
        Confirm and apply a modification.

        Args:
            booking_id: ID of the booking
            quote_id: ID of the quote to confirm
            payment_method_id: Stripe payment method ID (if payment required)
            db: Database session
            current_user_id: ID of user making modification
            is_admin: Whether modification is by admin

        Returns:
            BookingModification record

        Raises:
            ValueError: If quote not found, expired, or payment fails
        """

        # 1. Get quote
        quote = db.query(ModificationQuote).filter(
            ModificationQuote.id == quote_id,
            ModificationQuote.booking_id == booking_id
        ).first()

        if not quote:
            raise ValueError("Quote not found")

        if quote.status != "pending":
            raise ValueError(f"Quote is not pending (status: {quote.status})")

        if quote.expires_at < datetime.utcnow():
            quote.status = "expired"
            db.commit()
            raise ValueError("Quote has expired. Please request a new quote.")

        # 2. Get booking
        booking = db.query(Booking).filter(Booking.id == booking_id).first()
        if not booking:
            raise ValueError("Booking not found")

        # 3. Process payment if required
        payment_intent_id = None
        payment_status = "not_required"

        if float(quote.total_to_pay) > 0:
            # Payment required
            if not payment_method_id:
                raise ValueError("Payment method required for this modification")

            # TODO: Integrate with Stripe payment service
            # payment_result = await self._process_modification_payment(
            #     booking,
            #     quote,
            #     payment_method_id
            # )
            # payment_intent_id = payment_result["payment_intent_id"]
            # payment_status = payment_result["status"]

            # For now, simulate payment success
            payment_intent_id = f"pi_mock_{datetime.utcnow().timestamp()}"
            payment_status = "paid"

        elif float(quote.total_to_pay) < 0:
            # Refund required
            # TODO: Process refund through Stripe
            payment_status = "refund_pending"

        # 4. Apply modifications to booking
        modifications_applied = await self._apply_modifications(
            booking,
            json.loads(quote.modifications),
            db
        )

        # 5. Update operator booking (if operator reference exists)
        operator_confirmed = False
        operator_reference = None

        if booking.operator_booking_reference:
            # TODO: Update operator booking via API
            # operator_result = await self.ferry_service.update_operator_booking(
            #     booking.operator,
            #     booking.operator_booking_reference,
            #     modifications_applied
            # )
            # operator_confirmed = operator_result.get("confirmed", False)
            # operator_reference = operator_result.get("new_reference")

            # For now, simulate operator confirmation
            operator_confirmed = True
            operator_reference = booking.operator_booking_reference

        # 6. Create modification record
        modification = BookingModification(
            booking_id=booking_id,
            modified_by_user_id=current_user_id,
            modified_by_admin=is_admin,
            changes=quote.modifications,
            original_total=quote.original_total,
            new_total=quote.new_total,
            modification_fee=quote.modification_fee,
            price_difference=quote.price_difference,
            total_charged=quote.total_to_pay,
            payment_status=payment_status,
            payment_intent_id=payment_intent_id,
            status="completed" if payment_status in ["paid", "not_required"] else "pending_payment",
            operator_confirmed=operator_confirmed,
            operator_reference=operator_reference
        )

        db.add(modification)

        # 7. Update booking metadata
        booking.modification_count += 1
        booking.last_modified_at = datetime.utcnow()
        booking.updated_at = datetime.utcnow()
        booking.total_amount = quote.new_total

        # 8. Update quote status
        quote.status = "accepted"

        db.commit()
        db.refresh(modification)

        # 9. Send confirmation email (TODO)
        # await self._send_modification_confirmation_email(booking, modification)

        return modification

    async def _apply_modifications(
        self,
        booking: Booking,
        modifications: Dict[str, Any],
        db: Session
    ) -> Dict[str, Any]:
        """
        Apply modifications to the booking.

        Returns:
            Dictionary of changes made
        """

        changes_made = {}

        # Update travel details
        if "new_departure_date" in modifications and modifications["new_departure_date"]:
            old_date = booking.departure_time
            booking.departure_time = datetime.fromisoformat(modifications["new_departure_date"])
            changes_made["departure_date"] = {
                "old": old_date.isoformat() if old_date else None,
                "new": modifications["new_departure_date"]
            }

        if "new_departure_port" in modifications and modifications["new_departure_port"]:
            old_port = booking.departure_port
            booking.departure_port = modifications["new_departure_port"]
            changes_made["departure_port"] = {
                "old": old_port,
                "new": modifications["new_departure_port"]
            }

        if "new_arrival_port" in modifications and modifications["new_arrival_port"]:
            old_port = booking.arrival_port
            booking.arrival_port = modifications["new_arrival_port"]
            changes_made["arrival_port"] = {
                "old": old_port,
                "new": modifications["new_arrival_port"]
            }

        # TODO: Handle passenger additions/removals
        # TODO: Handle vehicle additions/removals
        # TODO: Handle cabin changes
        # TODO: Handle meal changes

        return changes_made

    def _requires_availability_check(self, modification_request: ModificationRequest) -> bool:
        """Check if modifications require availability verification."""

        return bool(
            modification_request.new_departure_date or
            modification_request.new_departure_port or
            modification_request.new_arrival_port or
            modification_request.new_sailing_id or
            modification_request.add_passengers or
            modification_request.add_vehicles
        )
