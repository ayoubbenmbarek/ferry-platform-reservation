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

logger = logging.getLogger(__name__)


class FerryService:
    """
    Ferry service orchestrator that manages all ferry operator integrations.
    Provides unified interface for searching and booking across multiple operators.
    """

    # Mapping from operator display names to integration keys
    OPERATOR_KEY_MAP = {
        "CTN": "ctn",
        "GNV": "gnv",
        "Corsica Lines": "corsica",
        "Danel": "danel",
        "Danel Casanova": "danel"
    }

    def __init__(self, use_mock: bool = False):
        """
        Initialize ferry service with operator integrations.

        Args:
            use_mock: If True, use mock integrations for development
        """
        self.use_mock = use_mock or settings.ENVIRONMENT == "development" or settings.USE_MOCK_FERRIES
        self.integrations: Dict[str, BaseFerryIntegration] = {}
        self._initialize_integrations()

    def _initialize_integrations(self):
        """Initialize all ferry operator integrations."""
        if self.use_mock:
            logger.info("Initializing MOCK ferry integrations for development")
            self.integrations = {
                "ctn": MockFerryIntegration(operator_name="CTN"),
                "gnv": MockFerryIntegration(operator_name="GNV"),
                "corsica": MockFerryIntegration(operator_name="Corsica Lines"),
                "danel": MockFerryIntegration(operator_name="Danel")
            }
        else:
            logger.info("Initializing REAL ferry integrations")
            try:
                # CTN Integration
                if settings.CTN_API_KEY:
                    self.integrations["ctn"] = CTNIntegration(
                        api_key=settings.CTN_API_KEY,
                        base_url=settings.CTN_BASE_URL
                    )
                    logger.info("CTN integration initialized")
            except Exception as e:
                logger.warning(f"Failed to initialize CTN integration: {e}")

            try:
                # GNV Integration
                if settings.GNV_CLIENT_ID:
                    self.integrations["gnv"] = GNVIntegration(
                        api_key=settings.GNV_CLIENT_ID,  # Will need OAuth implementation
                        base_url=settings.GNV_BASE_URL
                    )
                    logger.info("GNV integration initialized")
            except Exception as e:
                logger.warning(f"Failed to initialize GNV integration: {e}")

            try:
                # Corsica Integration
                if settings.CORSICA_API_KEY:
                    self.integrations["corsica"] = CorsicaIntegration(
                        api_key=settings.CORSICA_API_KEY,
                        base_url=settings.CORSICA_BASE_URL
                    )
                    logger.info("Corsica integration initialized")
            except Exception as e:
                logger.warning(f"Failed to initialize Corsica integration: {e}")

            try:
                # Danel Integration
                if settings.DANEL_USERNAME:
                    self.integrations["danel"] = DanelIntegration(
                        api_key=settings.DANEL_USERNAME,  # Using username as key
                        base_url=settings.DANEL_BASE_URL
                    )
                    logger.info("Danel integration initialized")
            except Exception as e:
                logger.warning(f"Failed to initialize Danel integration: {e}")

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
            operators: Optional list of specific operators to search (e.g., ["ctn", "gnv"])

        Returns:
            Combined list of ferry results from all operators
        """
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
            vehicles=vehicles or []
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
        operator_key = self.OPERATOR_KEY_MAP.get(operator, operator.lower())
        integration = self.integrations.get(operator_key)
        if not integration:
            raise ValueError(f"Unknown operator: {operator}")

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
        operator_key = self.OPERATOR_KEY_MAP.get(operator, operator.lower())
        integration = self.integrations.get(operator_key)
        if not integration:
            raise ValueError(f"Unknown operator: {operator}")

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
        operator_key = self.OPERATOR_KEY_MAP.get(operator, operator.lower())
        integration = self.integrations.get(operator_key)
        if not integration:
            raise ValueError(f"Unknown operator: {operator}")

        try:
            async with integration:
                success = await integration.cancel_booking(booking_reference, reason)
                if success:
                    logger.info(f"Booking cancelled: {booking_reference} with {operator}")
                return success
        except FerryAPIError as e:
            logger.error(f"Cancellation failed for {operator}: {e.message}")
            raise
        except Exception as e:
            logger.error(f"Cancellation error for {operator}: {e}", exc_info=True)
            raise FerryAPIError(f"Failed to cancel booking with {operator}: {str(e)}")

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
        use_mock_integrations = use_mock if use_mock is not None else settings.ENVIRONMENT == "development"
        _ferry_service = FerryService(use_mock=use_mock_integrations)

    return _ferry_service