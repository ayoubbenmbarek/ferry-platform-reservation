"""
Ferry service orchestrator - manages all ferry operator integrations.
"""

import logging
import asyncio
from typing import List, Dict, Optional
from datetime import date

from app.config import settings
from app.services.ferry_integrations.base import (
    BaseFerryIntegration,
    SearchRequest,
    FerryResult,
    BookingRequest,
    BookingConfirmation,
    FerryAPIError
)
from app.services.ferry_integrations.ctn import CTNIntegration
from app.services.ferry_integrations.gnv import GNVIntegration
from app.services.ferry_integrations.corsica import CorsicaIntegration
from app.services.ferry_integrations.danel import DanelIntegration
from app.services.ferry_integrations.mock import MockFerryIntegration
from app.services.ferry_integrations.ferryhopper import FerryHopperIntegration
from app.services.ferry_integrations.ferryhopper_mappings import (
    VOILAFERRY_TO_FERRYHOPPER_PORT_MAP,
    FALLBACK_PORT_MAP,
    VIRTUAL_ALL_PORTS_CODES,
    VIRTUAL_PORT_TO_COUNTRY,
    VIRTUAL_PORT_TO_DEFAULT,
)

logger = logging.getLogger(__name__)


def get_port_country(port_code: str) -> str:
    """
    Get the country code for a port based on official FerryHopper codes.
    Returns 2-letter country code or the port code itself if unknown.
    """
    port_upper = port_code.upper().strip()

    # Check virtual all-ports codes first
    if port_upper in VIRTUAL_PORT_TO_COUNTRY:
        return VIRTUAL_PORT_TO_COUNTRY[port_upper]

    # Tunisia ports (official FerryHopper codes)
    if port_upper in {"TUN", "TNZRZ"} or port_upper.startswith("TN"):
        return "TN"
    # Italy ports (official FerryHopper codes)
    if port_upper in {"GOA", "CIV", "PLE", "TPS", "SAL", "NAP", "LIV", "AEL00", "ANC", "BAR", "MLZ", "MSN"}:
        return "IT"
    # France ports (official FerryHopper codes)
    if port_upper in {"MRS", "NCE", "TLN", "AJA", "BIA", "COR00"}:
        return "FR"
    # Morocco ports (official FerryHopper codes)
    if port_upper in {"TNG"}:
        return "MA"
    # Spain ports (official FerryHopper codes)
    if port_upper in {"BRC", "ALG"}:
        return "ES"
    # Algeria ports (official FerryHopper codes)
    if port_upper in {"DZALG"} or port_upper.startswith("DZ"):
        return "DZ"

    return port_upper


def validate_ports_are_different(departure_port: str, arrival_port: str) -> None:
    """
    Validate that departure and arrival ports are different.
    This is a critical check to prevent same-port searches from reaching external APIs.

    Raises:
        FerryAPIError: If ports resolve to the same location
    """
    dep = departure_port.upper().strip()
    arr = arrival_port.upper().strip()

    logger.info(f"🔍 ferry_service validating ports: departure={dep}, arrival={arr}")

    # Direct equality check
    if dep == arr:
        logger.warning(f"⚠️ Same port codes: {dep} == {arr}")
        raise FerryAPIError(
            "Departure and arrival ports cannot be the same. Please select a different destination."
        )

    # Check if either port is a virtual "all ports" code (e.g., TN00, IT00)
    dep_is_virtual = dep in VIRTUAL_ALL_PORTS_CODES
    arr_is_virtual = arr in VIRTUAL_ALL_PORTS_CODES

    # Get countries for both ports
    dep_country = get_port_country(dep)
    arr_country = get_port_country(arr)

    logger.info(f"🔍 Port countries: {dep} ({dep_country}), {arr} ({arr_country})")

    # If either is a virtual code, check if they're in the same country
    if dep_is_virtual or arr_is_virtual:
        if dep_country == arr_country:
            logger.warning(f"⚠️ Virtual code with same country: {dep} ({dep_country}) -> {arr} ({arr_country})")
            raise FerryAPIError(
                f"Cannot search from '{departure_port}' to '{arrival_port}' - "
                "both are in the same country. Please select a destination in a different country."
            )
        # Virtual codes for different countries are OK - they'll be mapped to default ports later

    # Map to FerryHopper codes and check
    def get_fh_code(port_code: str) -> str:
        normalized = port_code.upper().strip()
        # First check if it's a virtual "all ports" code and map to default port
        if normalized in VIRTUAL_PORT_TO_DEFAULT:
            return VIRTUAL_PORT_TO_DEFAULT[normalized]
        if normalized in VOILAFERRY_TO_FERRYHOPPER_PORT_MAP:
            return VOILAFERRY_TO_FERRYHOPPER_PORT_MAP[normalized]
        if normalized in FALLBACK_PORT_MAP:
            return FALLBACK_PORT_MAP[normalized]
        return normalized

    fh_departure = get_fh_code(dep)
    fh_arrival = get_fh_code(arr)

    logger.info(f"🔍 FerryHopper mapping: {dep} -> {fh_departure}, {arr} -> {fh_arrival}")

    if fh_departure == fh_arrival:
        logger.warning(f"⚠️ Ports map to same FerryHopper code: {fh_departure}")
        raise FerryAPIError(
            f"Departure port ({departure_port}) and arrival port ({arrival_port}) "
            "resolve to the same location. Please select a different destination."
        )

    # Check if both ports are in the same country (additional safety check)
    if dep_country == arr_country and len(dep_country) == 2:
        logger.warning(f"⚠️ Same country: {dep_country}")
        raise FerryAPIError(
            f"Departure and arrival ports are both in the same country ({dep_country}). "
            "Please select a destination in a different country."
        )

    logger.info(f"✅ Port validation passed: {dep} -> {arr}")


class FerryService:
    """
    Ferry service orchestrator that manages all ferry operator integrations.
    Provides unified interface for searching and booking across multiple operators.
    """

    # Mapping from operator display names to integration keys
    # Map operator names to integration keys
    # FerryHopper returns full operator names, all go through "ferryhopper" integration
    OPERATOR_KEY_MAP = {
        # Short codes
        "CTN": "ferryhopper",
        "GNV": "ferryhopper",
        "Corsica Lines": "ferryhopper",
        "Danel": "ferryhopper",
        "Danel Casanova": "ferryhopper",
        "FerryHopper": "ferryhopper",
        # Full operator names from FerryHopper API
        "GRANDI NAVI VELOCI": "ferryhopper",
        "Grandi Navi Veloci": "ferryhopper",
        "GRIMALDI LINES": "ferryhopper",
        "Grimaldi Lines": "ferryhopper",
        "CORSICA LINEA": "ferryhopper",
        "Corsica Linea": "ferryhopper",
        "CORSICA FERRIES": "ferryhopper",
        "Corsica Ferries": "ferryhopper",
        "TIRRENIA": "ferryhopper",
        "Tirrenia": "ferryhopper",
        "MOBY": "ferryhopper",
        "Moby": "ferryhopper",
        "LA MERIDIONALE": "ferryhopper",
        "La Meridionale": "ferryhopper",
        "BLUE STAR FERRIES": "ferryhopper",
        "Blue Star Ferries": "ferryhopper",
        "HELLENIC SEAWAYS": "ferryhopper",
        "Hellenic Seaways": "ferryhopper",
        "ANEK LINES": "ferryhopper",
        "Anek Lines": "ferryhopper",
        "SUPERFAST FERRIES": "ferryhopper",
        "Superfast Ferries": "ferryhopper",
        "MINOAN LINES": "ferryhopper",
        "Minoan Lines": "ferryhopper",
        "JADROLINIJA": "ferryhopper",
        "Jadrolinija": "ferryhopper",
        "BALEARIA": "ferryhopper",
        "Balearia": "ferryhopper",
        "TRASMEDITERRANEA": "ferryhopper",
        "Trasmediterranea": "ferryhopper",
    }

    def __init__(self, use_mock: bool = False):
        """
        Initialize ferry service with operator integrations.

        Args:
            use_mock: If True, use mock integrations for development
        """
        # Only use mock if explicitly set via USE_MOCK_FERRIES setting
        self.use_mock = use_mock or settings.USE_MOCK_FERRIES
        self.integrations: Dict[str, BaseFerryIntegration] = {}
        self._initialize_integrations()

    def _initialize_integrations(self):
        """Initialize ferry operator integrations.

        Currently using FerryHopper as the primary aggregator API.
        FerryHopper provides access to multiple Mediterranean ferry operators
        through a unified API (CTN, GNV, Grimaldi, Blue Star, etc.)
        """
        logger.info("Initializing FerryHopper integration (aggregator API)")

        try:
            # FerryHopper Integration (Aggregator) - Primary integration
            if settings.FERRYHOPPER_API_KEY:
                self.integrations["ferryhopper"] = FerryHopperIntegration(
                    api_key=settings.FERRYHOPPER_API_KEY,
                    base_url=settings.FERRYHOPPER_BASE_URL
                )
                logger.info(f"✅ FerryHopper integration initialized (API: {settings.FERRYHOPPER_BASE_URL})")
            else:
                logger.error("❌ FERRYHOPPER_API_KEY not configured!")
        except Exception as e:
            logger.error(f"❌ Failed to initialize FerryHopper integration: {e}")

        # Legacy integrations - disabled, using FerryHopper aggregator instead
        # CTN, GNV, Corsica, Danel are all available through FerryHopper API

        logger.info(f"Initialized {len(self.integrations)} ferry integrations")

    async def search_ferries(
        self,
        departure_port: str,
        arrival_port: str,
        departure_date: date,
        return_date: Optional[date] = None,
        return_departure_port: Optional[str] = None,
        return_arrival_port: Optional[str] = None,
        adults: int = 1,
        children: int = 0,
        infants: int = 0,
        vehicles: Optional[List[Dict]] = None,
        pets: Optional[List[Dict]] = None,
        operators: Optional[List[str]] = None
    ) -> List[FerryResult]:
        """
        Search for ferries across all or specific operators.

        Args:
            departure_port: Departure port code (e.g., "TUNIS")
            arrival_port: Arrival port code (e.g., "GENOA")
            departure_date: Departure date
            return_date: Optional return date for round trip
            return_departure_port: Optional different departure port for return trip
            return_arrival_port: Optional different arrival port for return trip
            adults: Number of adult passengers
            children: Number of child passengers (2-11 years)
            infants: Number of infant passengers (0-2 years)
            vehicles: List of vehicles to transport
            pets: List of pets to transport (with weight_kg for pricing)
            operators: Optional list of specific operators to search (e.g., ["ctn", "gnv"])

        Returns:
            Combined list of ferry results from all operators
        """
        # CRITICAL: Validate ports are different BEFORE calling any integration
        # This prevents same-port errors from reaching external APIs like FerryHopper
        validate_ports_are_different(departure_port, arrival_port)

        search_request = SearchRequest(
            departure_port=departure_port,
            arrival_port=arrival_port,
            departure_date=departure_date,
            return_date=return_date,
            return_departure_port=return_departure_port,
            return_arrival_port=return_arrival_port,
            adults=adults,
            children=children,
            infants=infants,
            vehicles=vehicles or [],
            pets=pets or []
        )

        # Determine which integrations to search
        if operators:
            integrations_to_search = {
                name: integration
                for name, integration in self.integrations.items()
                if name in operators
            }
        else:
            integrations_to_search = self.integrations

        if not integrations_to_search:
            logger.warning("No ferry integrations available to search")
            return []

        logger.debug(f"Searching {len(integrations_to_search)} operators: {list(integrations_to_search.keys())}")

        # Search all operators concurrently
        search_tasks = []
        for operator_name, integration in integrations_to_search.items():
            task = self._search_operator(operator_name, integration, search_request)
            search_tasks.append(task)

        # Wait for all searches to complete
        results_by_operator = await asyncio.gather(*search_tasks, return_exceptions=True)

        # Combine all results
        all_results = []
        for operator_name, results in zip(integrations_to_search.keys(), results_by_operator):
            if isinstance(results, Exception):
                logger.error(f"Search failed for {operator_name}: {results}")
                continue

            logger.debug(f"{operator_name}: Found {len(results)} sailings")
            all_results.extend(results)

        # Sort by departure time
        all_results.sort(key=lambda x: x.departure_time)

        logger.debug(f"Total results: {len(all_results)} sailings from {len(integrations_to_search)} operators")
        return all_results

    async def _search_operator(
        self,
        operator_name: str,
        integration: BaseFerryIntegration,
        search_request: SearchRequest
    ) -> List[FerryResult]:
        """
        Search a single operator with error handling.

        Args:
            operator_name: Name of the operator
            integration: Ferry integration instance
            search_request: Search parameters

        Returns:
            List of ferry results
        """
        try:
            async with integration:
                results = await integration.search_ferries(search_request)
                return results
        except FerryAPIError as e:
            logger.error(f"{operator_name} API error: {e.message} (code: {e.error_code})")
            return []
        except Exception as e:
            logger.error(f"{operator_name} search failed: {e}", exc_info=True)
            return []

    async def create_booking(
        self,
        operator: str,
        sailing_id: str,
        passengers: List[Dict],
        vehicles: Optional[List[Dict]] = None,
        cabin_selection: Optional[Dict] = None,
        contact_info: Optional[Dict] = None,
        special_requests: Optional[str] = None
    ) -> BookingConfirmation:
        """
        Create a booking with a specific operator.

        Args:
            operator: Operator code (e.g., "ctn", "gnv")
            sailing_id: Sailing/voyage identifier
            passengers: List of passenger details
            vehicles: Optional list of vehicles
            cabin_selection: Optional cabin preferences
            contact_info: Contact information
            special_requests: Special requests or notes

        Returns:
            Booking confirmation

        Raises:
            FerryAPIError: If booking fails
            ValueError: If operator not found
        """
        # Map operator name to integration key
        # Default to ferryhopper since it's our primary aggregator
        operator_key = self.OPERATOR_KEY_MAP.get(operator)
        if not operator_key:
            # Fallback: use ferryhopper for any unknown operator
            operator_key = "ferryhopper"
            logger.info(f"Unknown operator '{operator}' - routing to FerryHopper integration")
        integration = self.integrations.get(operator_key)
        if not integration:
            raise ValueError(f"No integration available for operator: {operator}")

        booking_request = BookingRequest(
            sailing_id=sailing_id,
            passengers=passengers,
            vehicles=vehicles or [],
            cabin_selection=cabin_selection,
            contact_info=contact_info or {},
            special_requests=special_requests
        )

        try:
            async with integration:
                confirmation = await integration.create_booking(booking_request)
                logger.info(f"Booking created: {confirmation.booking_reference} with {operator}")
                return confirmation
        except FerryAPIError as e:
            logger.error(f"Booking failed for {operator}: {e.message}")
            raise
        except Exception as e:
            logger.error(f"Booking error for {operator}: {e}", exc_info=True)
            raise FerryAPIError(f"Failed to create booking with {operator}: {str(e)}")

    async def create_pending_booking(
        self,
        operator: str,
        sailing_id: str,
        passengers: List[Dict],
        vehicles: Optional[List[Dict]] = None,
        cabin_selection: Optional[Dict] = None,
        contact_info: Optional[Dict] = None,
        special_requests: Optional[str] = None
    ) -> Dict:
        """
        Create a PENDING booking to hold inventory (Step 1 of two-step booking).

        This creates a pending booking that holds the inventory for 15 minutes,
        allowing the user time to complete payment.

        Args:
            operator: Operator code (e.g., "ctn", "gnv")
            sailing_id: Sailing/voyage identifier
            passengers: List of passenger details
            vehicles: Optional list of vehicles
            cabin_selection: Optional cabin preferences
            contact_info: Contact information
            special_requests: Special requests or notes

        Returns:
            Dict with booking_code and price info for later confirmation

        Raises:
            FerryAPIError: If booking fails
            ValueError: If operator not found
        """
        # Map operator name to integration key
        operator_key = self.OPERATOR_KEY_MAP.get(operator)
        if not operator_key:
            operator_key = "ferryhopper"
            logger.info(f"Unknown operator '{operator}' - routing to FerryHopper integration")
        integration = self.integrations.get(operator_key)
        if not integration:
            raise ValueError(f"No integration available for operator: {operator}")

        # Check if integration supports pending booking (FerryHopper only)
        if not hasattr(integration, 'create_pending_booking'):
            raise FerryAPIError(f"Operator {operator} does not support inventory hold")

        booking_request = BookingRequest(
            sailing_id=sailing_id,
            passengers=passengers,
            vehicles=vehicles or [],
            cabin_selection=cabin_selection,
            contact_info=contact_info or {},
            special_requests=special_requests
        )

        try:
            async with integration:
                result = await integration.create_pending_booking(booking_request)
                logger.info(f"🔒 PENDING booking created: {result.get('booking_code')} with {operator}")
                return result
        except FerryAPIError as e:
            logger.error(f"Pending booking failed for {operator}: {e.message}")
            raise
        except Exception as e:
            logger.error(f"Pending booking error for {operator}: {e}", exc_info=True)
            raise FerryAPIError(f"Failed to create pending booking with {operator}: {str(e)}")

    async def confirm_pending_booking(
        self,
        operator: str,
        booking_code: str,
        total_price_cents: int,
        currency: str = "EUR"
    ) -> BookingConfirmation:
        """
        Confirm a PENDING booking after payment succeeds (Step 2 of two-step booking).

        Args:
            operator: Operator code
            booking_code: Booking code from create_pending_booking
            total_price_cents: Total price in cents for verification
            currency: Currency code (default EUR)

        Returns:
            BookingConfirmation with final status

        Raises:
            FerryAPIError: If confirmation fails
        """
        operator_key = self.OPERATOR_KEY_MAP.get(operator)
        if not operator_key:
            operator_key = "ferryhopper"
        integration = self.integrations.get(operator_key)
        if not integration:
            raise ValueError(f"No integration available for operator: {operator}")

        if not hasattr(integration, 'confirm_pending_booking'):
            raise FerryAPIError(f"Operator {operator} does not support pending booking confirmation")

        try:
            async with integration:
                confirmation = await integration.confirm_pending_booking(
                    booking_code=booking_code,
                    total_price_cents=total_price_cents,
                    currency=currency
                )
                logger.info(f"✅ PENDING booking confirmed: {booking_code} with {operator}")
                return confirmation
        except FerryAPIError as e:
            logger.error(f"Booking confirmation failed for {operator}: {e.message}")
            raise
        except Exception as e:
            logger.error(f"Booking confirmation error for {operator}: {e}", exc_info=True)
            raise FerryAPIError(f"Failed to confirm booking with {operator}: {str(e)}")

    async def cancel_pending_booking(
        self,
        operator: str,
        booking_code: str
    ) -> bool:
        """
        Cancel a PENDING booking to release held inventory.

        Used when payment fails, times out, or user abandons checkout.

        Args:
            operator: Operator code
            booking_code: Booking code from create_pending_booking

        Returns:
            True if cancellation successful

        Raises:
            FerryAPIError: If cancellation fails
        """
        operator_key = self.OPERATOR_KEY_MAP.get(operator)
        if not operator_key:
            operator_key = "ferryhopper"
        integration = self.integrations.get(operator_key)
        if not integration:
            raise ValueError(f"No integration available for operator: {operator}")

        if not hasattr(integration, 'cancel_pending_booking'):
            # Fallback to regular cancel_booking for operators without pending support
            logger.warning(f"Operator {operator} has no pending booking cancellation - using regular cancel")
            try:
                async with integration:
                    return await integration.cancel_booking(booking_code)
            except Exception:
                return False

        try:
            async with integration:
                result = await integration.cancel_pending_booking(booking_code)
                logger.info(f"🔓 PENDING booking released: {booking_code} with {operator}")
                return result
        except FerryAPIError as e:
            logger.error(f"Pending booking cancellation failed for {operator}: {e.message}")
            raise
        except Exception as e:
            logger.error(f"Pending booking cancellation error for {operator}: {e}", exc_info=True)
            raise FerryAPIError(f"Failed to cancel pending booking with {operator}: {str(e)}")

    async def get_booking_status(self, operator: str, booking_reference: str) -> Dict:
        """
        Get booking status from operator.

        Args:
            operator: Operator code
            booking_reference: Operator's booking reference

        Returns:
            Booking status information
        """
        # Map operator name to integration key
        # Default to ferryhopper since it's our primary aggregator
        operator_key = self.OPERATOR_KEY_MAP.get(operator)
        if not operator_key:
            # Fallback: use ferryhopper for any unknown operator
            operator_key = "ferryhopper"
            logger.info(f"Unknown operator '{operator}' - routing to FerryHopper integration")
        integration = self.integrations.get(operator_key)
        if not integration:
            raise ValueError(f"No integration available for operator: {operator}")

        try:
            async with integration:
                status = await integration.get_booking_status(booking_reference)
                return status
        except FerryAPIError as e:
            logger.error(f"Status check failed for {operator}: {e.message}")
            raise
        except Exception as e:
            logger.error(f"Status check error for {operator}: {e}", exc_info=True)
            raise FerryAPIError(f"Failed to check status with {operator}: {str(e)}")

    async def cancel_booking(
        self,
        operator: str,
        booking_reference: str,
        reason: Optional[str] = None
    ) -> bool:
        """
        Cancel a booking with operator.

        Args:
            operator: Operator code
            booking_reference: Operator's booking reference
            reason: Cancellation reason

        Returns:
            True if cancellation successful
        """
        # Map operator name to integration key
        # Default to ferryhopper since it's our primary aggregator
        operator_key = self.OPERATOR_KEY_MAP.get(operator)
        if not operator_key:
            # Fallback: use ferryhopper for any unknown operator
            operator_key = "ferryhopper"
            logger.info(f"Unknown operator '{operator}' - routing to FerryHopper integration")
        integration = self.integrations.get(operator_key)
        if not integration:
            raise ValueError(f"No integration available for operator: {operator}")

        try:
            async with integration:
                success = await integration.cancel_booking(booking_reference, reason)
                if success:
                    logger.info(f"Booking cancelled: {booking_reference} with {operator}")
                return success
        except FerryAPIError as e:
            error_msg = str(e.message).lower() if e.message else ""
            # "Booking not found" is expected for bookings created with restricted API key
            if "not found" in error_msg or "does not exist" in error_msg:
                logger.info(f"Booking {booking_reference} not found in {operator} system (may have never been created)")
            else:
                logger.error(f"Cancellation failed for {operator}: {e.message}")
            raise
        except Exception as e:
            logger.error(f"Cancellation error for {operator}: {e}", exc_info=True)
            raise FerryAPIError(f"Failed to cancel booking with {operator}: {str(e)}")

    async def estimate_refund(
        self,
        operator: str,
        booking_reference: str
    ) -> Dict:
        """
        Get refund estimate from operator.

        Args:
            operator: Operator code
            booking_reference: Operator's booking reference

        Returns:
            Dictionary with refund details:
            - refund_amount: Amount to be refunded (in EUR)
            - cancellation_fee: Fee charged for cancellation
            - currency: Currency code
            - refundable: Whether booking is refundable
        """
        operator_key = self.OPERATOR_KEY_MAP.get(operator)
        if not operator_key:
            operator_key = "ferryhopper"
            logger.info(f"Unknown operator '{operator}' - routing to FerryHopper integration")

        integration = self.integrations.get(operator_key)
        if not integration:
            raise ValueError(f"No integration available for operator: {operator}")

        try:
            async with integration:
                # Check if integration supports estimate_refund
                if not hasattr(integration, 'estimate_refund'):
                    logger.warning(f"Integration {operator_key} does not support refund estimates")
                    return {
                        "refund_amount": None,
                        "cancellation_fee": None,
                        "currency": "EUR",
                        "refundable": True,  # Assume refundable if we can't check
                        "estimate_available": False
                    }

                estimate = await integration.estimate_refund(booking_reference)

                # Parse FerryHopper response format
                refund_cents = estimate.get("totalPriceInCents", 0)
                fee_cents = estimate.get("cancellationFee", 0)
                currency = estimate.get("currency", "EUR")

                return {
                    "refund_amount": refund_cents / 100 if refund_cents else 0,
                    "cancellation_fee": fee_cents / 100 if fee_cents else 0,
                    "currency": currency,
                    "refundable": refund_cents > 0,
                    "estimate_available": True,
                    "raw_response": estimate  # Include raw response for debugging
                }

        except FerryAPIError as e:
            error_msg = str(e.message).lower() if e.message else ""
            if "not found" in error_msg:
                logger.info(f"Booking {booking_reference} not found for refund estimate (may not exist in operator system)")
                return {
                    "refund_amount": None,
                    "cancellation_fee": None,
                    "currency": "EUR",
                    "refundable": True,
                    "estimate_available": False,
                    "reason": "Booking not found in operator system"
                }
            raise
        except Exception as e:
            logger.error(f"Refund estimate error for {operator}: {e}", exc_info=True)
            raise FerryAPIError(f"Failed to get refund estimate from {operator}: {str(e)}")

    async def health_check(self) -> Dict[str, str]:
        """
        Check health of all ferry operator APIs.

        Returns:
            Dictionary of operator names to health status
        """
        health_status = {}

        check_tasks = []
        for operator_name, integration in self.integrations.items():
            task = self._check_operator_health(operator_name, integration)
            check_tasks.append(task)

        results = await asyncio.gather(*check_tasks, return_exceptions=True)

        for operator_name, is_healthy in zip(self.integrations.keys(), results):
            if isinstance(is_healthy, Exception):
                health_status[operator_name] = f"error: {str(is_healthy)}"
            else:
                health_status[operator_name] = "healthy" if is_healthy else "unhealthy"

        return health_status

    async def _check_operator_health(
        self,
        operator_name: str,
        integration: BaseFerryIntegration
    ) -> bool:
        """Check health of single operator."""
        try:
            async with integration:
                is_healthy = await integration.health_check()
                return is_healthy
        except Exception as e:
            logger.warning(f"Health check failed for {operator_name}: {e}")
            return False

    def get_available_operators(self) -> List[str]:
        """Get list of available operator codes."""
        return list(self.integrations.keys())

    async def check_operator_health(self) -> Dict[str, bool]:
        """
        Check health status of all ferry operator APIs.

        Returns:
            Dictionary mapping operator names to health status (True = healthy)
        """
        health_status = {}

        for operator_name, integration in self.integrations.items():
            try:
                is_healthy = await self._check_operator_health(operator_name, integration)
                health_status[operator_name] = is_healthy
            except Exception as e:
                logger.warning(f"Health check failed for {operator_name}: {e}")
                health_status[operator_name] = False

        return health_status

    async def compare_prices(
        self,
        departure_port: str,
        arrival_port: str,
        departure_date: date,
        adults: int = 1,
        children: int = 0,
        infants: int = 0
    ) -> List[Dict]:
        """
        Compare prices across all operators for a specific route.

        Returns:
            List of price comparisons from each operator
        """
        # CRITICAL: Validate ports are different
        validate_ports_are_different(departure_port, arrival_port)

        results = await self.search_ferries(
            departure_port=departure_port,
            arrival_port=arrival_port,
            departure_date=departure_date,
            adults=adults,
            children=children,
            infants=infants
        )

        # Group results by operator and find lowest price per operator
        operator_prices = {}
        for result in results:
            operator = result.operator
            price = result.prices.get('adult', 0) * adults + \
                    result.prices.get('child', 0) * children

            if operator not in operator_prices or price < operator_prices[operator]['price']:
                operator_prices[operator] = {
                    'operator': operator,
                    'price': price,
                    'sailing_id': result.sailing_id,
                    'departure_time': result.departure_time.isoformat() if result.departure_time else None,
                    'vessel': result.vessel_name
                }

        return list(operator_prices.values())

    async def get_cheapest_option(
        self,
        departure_port: str,
        arrival_port: str,
        departure_date: date,
        adults: int = 1,
        children: int = 0,
        infants: int = 0
    ) -> Optional[Dict]:
        """
        Get the cheapest ferry option across all operators.

        Returns:
            Cheapest option details or None if no results
        """
        comparisons = await self.compare_prices(
            departure_port=departure_port,
            arrival_port=arrival_port,
            departure_date=departure_date,
            adults=adults,
            children=children,
            infants=infants
        )

        if not comparisons:
            return None

        return min(comparisons, key=lambda x: x['price'])

    def get_supported_routes(self) -> Dict[str, List[Dict[str, str]]]:
        """
        Get supported routes from all integrations.

        Returns:
            Dictionary mapping operator names to list of routes
        """
        all_routes = {}

        for operator_key, integration in self.integrations.items():
            operator_name = integration.operator_name if hasattr(integration, 'operator_name') else operator_key.upper()
            routes = []

            # Get routes from mock integration
            if hasattr(integration, 'routes'):
                for (departure, arrival) in integration.routes.keys():
                    routes.append({
                        "departure": departure,
                        "arrival": arrival
                    })

            all_routes[operator_name] = routes

        return all_routes


# Global ferry service instance
_ferry_service: Optional[FerryService] = None


def get_ferry_service(use_mock: Optional[bool] = None) -> FerryService:
    """
    Get or create the global ferry service instance.

    Args:
        use_mock: Override mock setting (None uses default from settings)

    Returns:
        FerryService instance
    """
    global _ferry_service

    if _ferry_service is None or use_mock is not None:
        # Only use mock if explicitly set via USE_MOCK_FERRIES setting
        use_mock_integrations = use_mock if use_mock is not None else settings.USE_MOCK_FERRIES
        _ferry_service = FerryService(use_mock=use_mock_integrations)

    return _ferry_service