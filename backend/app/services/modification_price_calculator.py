"""
Modification price calculator service.

Calculates new prices when modifying bookings.
"""

from decimal import Decimal
from typing import Dict, Any, Optional
from datetime import datetime

from app.models.booking import Booking
from app.schemas.modification import ModificationRequest, PriceBreakdown
from app.services.modification_rules import ModificationRules


class ModificationPriceCalculator:
    """Calculate prices for booking modifications."""

    async def calculate_modification_price(
        self,
        booking: Booking,
        modification_request: ModificationRequest,
        new_ferry_prices: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Calculate the new price after applying modifications.

        Args:
            booking: Original booking
            modification_request: Requested modifications
            new_ferry_prices: New ferry prices from operator API (if date/route changed)

        Returns:
            Dictionary with price breakdown and totals
        """

        # Start with original booking value
        original_total = float(booking.total_amount)

        # Initialize components
        passenger_cost = Decimal("0.00")
        vehicle_cost = Decimal("0.00")
        cabin_cost = Decimal("0.00")
        meal_cost = Decimal("0.00")

        # ========== PASSENGER CALCULATIONS ==========
        passenger_cost = await self._calculate_passenger_costs(
            booking,
            modification_request,
            new_ferry_prices
        )

        # ========== VEHICLE CALCULATIONS ==========
        vehicle_cost = await self._calculate_vehicle_costs(
            booking,
            modification_request,
            new_ferry_prices
        )

        # ========== CABIN CALCULATIONS ==========
        cabin_cost = await self._calculate_cabin_costs(
            booking,
            modification_request,
            new_ferry_prices
        )

        # ========== MEAL CALCULATIONS ==========
        meal_cost = await self._calculate_meal_costs(
            booking,
            modification_request,
            new_ferry_prices
        )

        # Calculate new subtotal
        new_subtotal = float(passenger_cost + vehicle_cost + cabin_cost + meal_cost)

        # Calculate modification fee
        modification_fee = ModificationRules.calculate_modification_fee(booking, "full")

        # Price difference (can be negative for refunds)
        price_difference = new_subtotal - original_total

        # Total to pay (or refund if negative)
        total_to_pay = price_difference + modification_fee

        return {
            "original_total": Decimal(str(original_total)),
            "new_subtotal": Decimal(str(new_subtotal)),
            "modification_fee": Decimal(str(modification_fee)),
            "price_difference": Decimal(str(price_difference)),
            "total_to_pay": Decimal(str(total_to_pay)),
            "breakdown": {
                "passengers": passenger_cost,
                "vehicles": vehicle_cost,
                "cabins": cabin_cost,
                "meals": meal_cost
            }
        }

    async def _calculate_passenger_costs(
        self,
        booking: Booking,
        modification_request: ModificationRequest,
        new_ferry_prices: Optional[Dict[str, Any]] = None
    ) -> Decimal:
        """Calculate new passenger costs."""

        # Get current passenger count by type
        current_adults = sum(1 for p in booking.passengers if p.type.value == "ADULT")
        current_children = sum(1 for p in booking.passengers if p.type.value == "CHILD")
        current_infants = sum(1 for p in booking.passengers if p.type.value == "INFANT")

        # Calculate new passenger count
        new_adults = current_adults
        new_children = current_children
        new_infants = current_infants

        # Apply passenger modifications
        if modification_request.add_passengers:
            for passenger in modification_request.add_passengers:
                p_type = passenger.get("type", "adult").upper()
                if p_type == "ADULT":
                    new_adults += 1
                elif p_type == "CHILD":
                    new_children += 1
                elif p_type == "INFANT":
                    new_infants += 1

        if modification_request.remove_passengers:
            # Would need to check types of removed passengers
            # For simplicity, assuming frontend provides accurate counts
            pass

        # Get prices (use new prices if route/date changed, otherwise use current)
        if new_ferry_prices:
            adult_price = Decimal(str(new_ferry_prices.get("adult", 85.00)))
            child_price = Decimal(str(new_ferry_prices.get("child", 42.50)))
            infant_price = Decimal(str(new_ferry_prices.get("infant", 0.00)))
        else:
            # Use original booking prices (extracted from booking history or defaults)
            adult_price = Decimal("85.00")
            child_price = Decimal("42.50")
            infant_price = Decimal("0.00")

        # Calculate total passenger cost
        total = (
            (adult_price * new_adults) +
            (child_price * new_children) +
            (infant_price * new_infants)
        )

        # If round trip, double the cost
        if booking.is_round_trip:
            total = total * 2

        return total

    async def _calculate_vehicle_costs(
        self,
        booking: Booking,
        modification_request: ModificationRequest,
        new_ferry_prices: Optional[Dict[str, Any]] = None
    ) -> Decimal:
        """Calculate new vehicle costs."""

        # Get current vehicle count
        current_vehicle_count = len(booking.vehicles)

        # Calculate new vehicle count
        new_vehicle_count = current_vehicle_count

        if modification_request.add_vehicles:
            new_vehicle_count += len(modification_request.add_vehicles)

        if modification_request.remove_vehicles:
            new_vehicle_count -= len(modification_request.remove_vehicles)
            if new_vehicle_count < 0:
                new_vehicle_count = 0

        # Get vehicle price
        if new_ferry_prices:
            vehicle_price = Decimal(str(new_ferry_prices.get("vehicle", 120.00)))
        else:
            vehicle_price = Decimal("120.00")

        total = vehicle_price * new_vehicle_count

        # If round trip, double the cost
        if booking.is_round_trip:
            total = total * 2

        return total

    async def _calculate_cabin_costs(
        self,
        booking: Booking,
        modification_request: ModificationRequest,
        new_ferry_prices: Optional[Dict[str, Any]] = None
    ) -> Decimal:
        """Calculate new cabin costs."""

        total = Decimal("0.00")

        # Check if cabin is being added, removed, or changed
        if modification_request.new_cabin_id:
            # Adding/changing cabin
            cabin_price = Decimal(str(new_ferry_prices.get("cabin", 50.00) if new_ferry_prices else 50.00))
            total += cabin_price

        if modification_request.new_return_cabin_id and booking.is_round_trip:
            # Adding/changing return cabin
            cabin_price = Decimal(str(new_ferry_prices.get("cabin", 50.00) if new_ferry_prices else 50.00))
            total += cabin_price

        # Subtract if removing cabin
        if modification_request.remove_cabin:
            cabin_price = Decimal(str(booking.cabin_supplement if booking.cabin_supplement else 0))
            total -= cabin_price

        if modification_request.remove_return_cabin:
            cabin_price = Decimal(str(booking.return_cabin_supplement if booking.return_cabin_supplement else 0))
            total -= cabin_price

        return total

    async def _calculate_meal_costs(
        self,
        booking: Booking,
        modification_request: ModificationRequest,
        new_ferry_prices: Optional[Dict[str, Any]] = None
    ) -> Decimal:
        """Calculate new meal costs."""

        total = Decimal("0.00")

        # Add new meals
        if modification_request.add_meals:
            for meal in modification_request.add_meals:
                meal_price = Decimal(str(meal.get("price", 15.00)))
                total += meal_price

        # Remove meals
        if modification_request.remove_meals:
            # Would need to look up meal prices from booking
            # For simplicity, assuming average meal price
            total -= Decimal(str(len(modification_request.remove_meals) * 15.00))

        return total

    def get_availability_check_params(
        self,
        booking: Booking,
        modification_request: ModificationRequest
    ) -> Dict[str, Any]:
        """
        Get parameters for checking availability with operator API.

        Returns:
            Dictionary with search parameters for ferry operator API
        """

        # Start with current booking details
        params = {
            "departure_port": booking.departure_port,
            "arrival_port": booking.arrival_port,
            "departure_date": booking.departure_time,
            "adults": sum(1 for p in booking.passengers if p.type.value == "ADULT"),
            "children": sum(1 for p in booking.passengers if p.type.value == "CHILD"),
            "infants": sum(1 for p in booking.passengers if p.type.value == "INFANT"),
            "vehicles": len(booking.vehicles),
        }

        # Apply modifications
        if modification_request.new_departure_date:
            params["departure_date"] = modification_request.new_departure_date

        if modification_request.new_departure_port:
            params["departure_port"] = modification_request.new_departure_port

        if modification_request.new_arrival_port:
            params["arrival_port"] = modification_request.new_arrival_port

        # Update passenger counts
        if modification_request.add_passengers:
            for passenger in modification_request.add_passengers:
                p_type = passenger.get("type", "adult").lower()
                if p_type == "adult":
                    params["adults"] += 1
                elif p_type == "child":
                    params["children"] += 1
                elif p_type == "infant":
                    params["infants"] += 1

        # Update vehicle count
        if modification_request.add_vehicles:
            params["vehicles"] += len(modification_request.add_vehicles)

        if modification_request.remove_vehicles:
            params["vehicles"] -= len(modification_request.remove_vehicles)
            if params["vehicles"] < 0:
                params["vehicles"] = 0

        return params
