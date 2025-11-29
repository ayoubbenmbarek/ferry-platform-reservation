"""
Modification rules engine for booking modifications.
"""

from datetime import datetime, timedelta
from typing import Tuple
from app.models.booking import Booking, BookingStatusEnum


class ModificationRules:
    """Business rules for booking modifications."""

    # Configuration
    MAX_MODIFICATIONS = 3  # Maximum number of modifications allowed per booking
    CHECK_IN_HOURS_BEFORE = 3  # Check-in opens X hours before departure
    MODIFICATION_FEE_EUR = 25.00  # Flat modification fee
    MODIFICATION_FEE_PERCENTAGE = 0.05  # Or 5% of original booking

    @staticmethod
    def can_modify(booking: Booking) -> Tuple[bool, str, str]:
        """
        Check if booking can be modified.

        Returns:
            Tuple of (can_modify, modification_type, message)
            modification_type: "none", "quick", "full"
        """

        # Rule 1: Booking must be confirmed or pending
        if booking.status not in [BookingStatusEnum.CONFIRMED, BookingStatusEnum.PENDING]:
            return False, "none", f"Only confirmed or pending bookings can be modified. Current status: {booking.status.value}"

        # Rule 2: Cannot modify cancelled bookings
        if booking.status == BookingStatusEnum.CANCELLED:
            return False, "none", "Cannot modify cancelled bookings"

        # Rule 3: Cannot modify completed/past bookings
        if booking.status == BookingStatusEnum.COMPLETED:
            return False, "none", "Cannot modify completed bookings"

        # Rule 4: Cannot modify if departure has passed
        if booking.departure_time and datetime.now(booking.departure_time.tzinfo) >= booking.departure_time:
            return False, "none", "Cannot modify bookings after departure time has passed"

        # Rule 5: Cannot modify if check-in is open
        if booking.departure_time:
            checkin_opens_at = booking.departure_time - timedelta(hours=ModificationRules.CHECK_IN_HOURS_BEFORE)
            current_time = datetime.now(booking.departure_time.tzinfo)

            if current_time >= checkin_opens_at:
                return False, "none", f"Check-in is already open. Modifications must be made at least {ModificationRules.CHECK_IN_HOURS_BEFORE} hours before departure"

        # Rule 6: Check fare type restrictions
        if hasattr(booking, 'fare_type'):
            if booking.fare_type == 'non-modifiable':
                return False, "none", "Your fare type does not allow modifications. Please contact support for assistance"

            if booking.fare_type == 'semi-flexible':
                # Semi-flexible: only quick changes allowed (names, registration)
                return True, "quick", "Your fare type allows name and registration changes only"

        # Rule 7: Check modification limit
        if booking.modification_count >= ModificationRules.MAX_MODIFICATIONS:
            return False, "none", f"Maximum {ModificationRules.MAX_MODIFICATIONS} modifications reached for this booking"

        # Rule 8: Check if booking is expired (pending bookings)
        if booking.status == BookingStatusEnum.PENDING and booking.expires_at:
            if datetime.now(booking.expires_at.tzinfo) >= booking.expires_at:
                return False, "none", "Booking has expired. Please create a new booking"

        # All checks passed - full modification allowed
        return True, "full", "This booking can be fully modified"

    @staticmethod
    def calculate_modification_fee(booking: Booking, modification_type: str) -> float:
        """
        Calculate modification fee based on booking value and modification type.

        Args:
            booking: The booking being modified
            modification_type: "quick" or "full"

        Returns:
            Modification fee in EUR
        """

        # Quick changes (names, registration) are free or minimal
        if modification_type == "quick":
            return 0.00

        # Full modifications incur a fee
        # Use the greater of: flat fee or percentage of booking value
        flat_fee = ModificationRules.MODIFICATION_FEE_EUR
        percentage_fee = float(booking.total_amount) * ModificationRules.MODIFICATION_FEE_PERCENTAGE

        return max(flat_fee, percentage_fee)

    @staticmethod
    def get_restrictions(booking: Booking) -> list[str]:
        """
        Get list of restrictions that apply to this booking.

        Returns:
            List of restriction messages
        """
        restrictions = []

        # Check-in timing
        if booking.departure_time:
            checkin_opens_at = booking.departure_time - timedelta(hours=ModificationRules.CHECK_IN_HOURS_BEFORE)
            hours_until_checkin = (checkin_opens_at - datetime.now(booking.departure_time.tzinfo)).total_seconds() / 3600

            if hours_until_checkin < 24:
                restrictions.append(f"Less than 24 hours until check-in opens")

        # Modification count
        remaining_modifications = ModificationRules.MAX_MODIFICATIONS - booking.modification_count
        if remaining_modifications <= 1:
            restrictions.append(f"Only {remaining_modifications} modification(s) remaining")

        # Fare type
        if hasattr(booking, 'fare_type'):
            if booking.fare_type == 'semi-flexible':
                restrictions.append("Only name and registration changes allowed (semi-flexible fare)")
            elif booking.fare_type == 'non-modifiable':
                restrictions.append("Modifications not permitted (non-modifiable fare)")

        # Pending payment
        if booking.status == BookingStatusEnum.PENDING:
            restrictions.append("Booking payment pending - complete payment first for full modification access")

        return restrictions

    @staticmethod
    def can_modify_field(booking: Booking, field_name: str) -> bool:
        """
        Check if a specific field can be modified.

        Args:
            booking: The booking
            field_name: Name of the field to check (e.g., "departure_date", "passengers")

        Returns:
            True if field can be modified, False otherwise
        """

        # Semi-flexible fares can only modify names and registration
        if hasattr(booking, 'fare_type') and booking.fare_type == 'semi-flexible':
            allowed_fields = ['passenger_name', 'vehicle_registration']
            return field_name in allowed_fields

        # Flexible fares can modify most fields
        # Some fields might still be restricted (e.g., operator in some cases)
        restricted_fields = []

        # Can't change operator if already confirmed by operator
        if booking.operator_booking_reference:
            restricted_fields.append('operator')

        return field_name not in restricted_fields
