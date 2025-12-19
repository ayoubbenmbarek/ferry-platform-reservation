"""
FerryHopper API integration.
Aggregator API providing access to multiple Mediterranean ferry operators.
Documentation: https://ferryhapi.uat.ferryhopper.com/documentation/
"""

import logging
import asyncio
import hashlib
from typing import List, Dict, Optional, Any
from datetime import datetime, date, timedelta
from decimal import Decimal
import httpx

from .base import (
    BaseFerryIntegration,
    SearchRequest,
    FerryResult,
    BookingRequest,
    BookingConfirmation,
    FerryAPIError
)
from .ferryhopper_mappings import (
    FerryHopperMappingService,
    calculate_age_from_type,
    map_ferryhopper_cabin_type,
    FALLBACK_PORT_MAP,
    REVERSE_PORT_MAP,
    VOILAFERRY_TO_FERRYHOPPER_PORT_MAP,
    UNSUPPORTED_PORTS,
)
from app.services.cache_service import cache_service
from app.config import settings

logger = logging.getLogger(__name__)


class FerryHopperIntegration(BaseFerryIntegration):
    """
    FerryHopper API integration.

    Provides access to multiple ferry operators through FerryHopper's unified API.
    Implements the complete booking flow: search -> create -> confirm -> retrieve.
    """

    def __init__(
        self,
        api_key: str = "",
        base_url: str = "https://ferryhapi.uat.ferryhopper.com",
        timeout: int = 60  # Increased from 30 to 60 for slower API responses
    ):
        """
        Initialize FerryHopper integration.

        Args:
            api_key: FerryHopper API key (x-api-key header)
            base_url: API base URL (UAT or production)
            timeout: Request timeout in seconds (default 60s for FerryHopper)
        """
        super().__init__(api_key, base_url, timeout)
        self.operator_name = "FerryHopper"
        self.mapping_service: Optional[FerryHopperMappingService] = None
        self._headers = {
            "X-Api-Key": api_key,  # Capitalized as per FerryHopper API
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        # Track concurrent users for session management
        self._session_ref_count = 0
        self._session_lock = asyncio.Lock()

    async def __aenter__(self):
        """
        Async context manager entry.

        Uses reference counting to safely handle concurrent requests.
        The session is created on first enter and kept open until all
        concurrent users have exited.
        """
        async with self._session_lock:
            self._session_ref_count += 1
            if self.session is None:
                self.session = httpx.AsyncClient(
                    timeout=self.timeout,
                    headers=self._headers
                )
                self.mapping_service = FerryHopperMappingService(self)
                logger.debug("FerryHopper session created")
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """
        Async context manager exit.

        Only closes the session when the last concurrent user exits.
        """
        async with self._session_lock:
            self._session_ref_count -= 1
            # Only close session when no more users
            if self._session_ref_count == 0 and self.session is not None:
                await self.session.aclose()
                self.session = None
                logger.debug("FerryHopper session closed")

    async def get(self, endpoint: str, params: Optional[Dict] = None, max_retries: int = 3) -> Dict:
        """
        Make GET request to FerryHopper API with retry logic for rate limiting.

        Args:
            endpoint: API endpoint (e.g., "/ports")
            params: Query parameters
            max_retries: Maximum retry attempts for rate limiting

        Returns:
            Response JSON
        """
        url = f"{self.base_url}{endpoint}"

        for attempt in range(max_retries):
            try:
                response = await self.session.get(url, params=params)

                # Handle rate limiting with retry
                if response.status_code == 429:
                    if attempt < max_retries - 1:
                        wait_time = (2 ** attempt) + 1  # Exponential backoff: 2, 3, 5 seconds
                        logger.warning(f"FerryHopper rate limit hit, waiting {wait_time}s (attempt {attempt + 1}/{max_retries})")
                        await asyncio.sleep(wait_time)
                        continue

                self._handle_api_error(response)
                return response.json()

            except httpx.ReadError as e:
                if attempt < max_retries - 1:
                    wait_time = (2 ** attempt) + 1
                    logger.warning(f"FerryHopper ReadError, retrying in {wait_time}s: {e}")
                    await asyncio.sleep(wait_time)
                    continue
                raise FerryAPIError(f"FerryHopper connection error: {str(e)}")

        raise FerryAPIError("FerryHopper rate limit exceeded after retries")

    async def post(self, endpoint: str, data: Dict, max_retries: int = 3) -> Dict:
        """
        Make POST request to FerryHopper API with retry logic for rate limiting.

        Args:
            endpoint: API endpoint (e.g., "/search")
            data: Request body
            max_retries: Maximum retry attempts for rate limiting

        Returns:
            Response JSON
        """
        url = f"{self.base_url}{endpoint}"

        for attempt in range(max_retries):
            try:
                response = await self.session.post(url, json=data)

                # Handle rate limiting with retry
                if response.status_code == 429:
                    if attempt < max_retries - 1:
                        wait_time = (2 ** attempt) + 1  # Exponential backoff: 2, 3, 5 seconds
                        logger.warning(f"FerryHopper rate limit hit, waiting {wait_time}s (attempt {attempt + 1}/{max_retries})")
                        await asyncio.sleep(wait_time)
                        continue

                self._handle_api_error(response)
                return response.json()

            except httpx.ReadError as e:
                if attempt < max_retries - 1:
                    wait_time = (2 ** attempt) + 1
                    logger.warning(f"FerryHopper ReadError, retrying in {wait_time}s: {e}")
                    await asyncio.sleep(wait_time)
                    continue
                raise FerryAPIError(f"FerryHopper connection error: {str(e)}")

        raise FerryAPIError("FerryHopper rate limit exceeded after retries")

    async def search_ferries(self, search_request: SearchRequest) -> List[FerryResult]:
        """
        Search for available ferries via FerryHopper.

        Implements FerryHopper best practices:
        - Cache results from Search Booking Solutions step
        - Short TTL (5 min) due to availability changes

        Args:
            search_request: Search parameters

        Returns:
            List of FerryResult objects
        """
        try:
            logger.info(
                f"FerryHopper search: {search_request.departure_port} -> "
                f"{search_request.arrival_port} on {search_request.departure_date}"
            )

            # Map port codes
            departure_code = await self._map_port_code(search_request.departure_port)
            arrival_code = await self._map_port_code(search_request.arrival_port)

            if not departure_code or not arrival_code:
                logger.warning(
                    f"Could not map ports: {search_request.departure_port} -> {departure_code}, "
                    f"{search_request.arrival_port} -> {arrival_code}"
                )
                return []

            # Calculate total passengers for cache key
            total_passengers = search_request.adults + search_request.children + search_request.infants

            # Check Redis cache first (Best Practice: cache search results)
            cached_results = cache_service.get_ferryhopper_search(
                departure_port=departure_code,
                arrival_port=arrival_code,
                departure_date=search_request.departure_date.isoformat(),
                passengers=total_passengers
            )

            if cached_results:
                logger.info(f"FerryHopper search cache HIT: {departure_code}->{arrival_code}")
                # Reconstruct FerryResult objects from cached data
                results = []
                for result_data in cached_results.get("results", []):
                    result = self._reconstruct_ferry_result(result_data)
                    if result:
                        results.append(result)
                return results

            # Build search request
            search_data = {
                "language": "en",
                "departurePortCode": departure_code,
                "arrivalPortCode": arrival_code,
                "departureDate": search_request.departure_date.isoformat(),
            }

            # Add return date if round trip
            if search_request.return_date:
                search_data["returnDate"] = search_request.return_date.isoformat()

            # Add passengers
            passengers = self._build_passengers(search_request)
            if passengers:
                search_data["passengers"] = passengers

            # Make search request
            response = await self.post("/search", search_data)

            # Parse booking solutions
            solutions = response.get("bookingSolutions", [])
            logger.info(f"FerryHopper returned {len(solutions)} booking solutions")

            # Convert to FerryResult objects
            results = []
            for solution in solutions:
                ferry_results = self._parse_solution(solution, search_request)
                results.extend(ferry_results)

            # Sort by departure time
            results.sort(key=lambda x: x.departure_time)

            # Cache results (Best Practice: cache for short period due to availability)
            cache_data = {
                "results": [self._serialize_ferry_result(r) for r in results],
                "cached_at": datetime.now().isoformat(),
            }
            cache_service.set_ferryhopper_search(
                departure_port=departure_code,
                arrival_port=arrival_code,
                departure_date=search_request.departure_date.isoformat(),
                passengers=total_passengers,
                results=cache_data,
                ttl=settings.CACHE_TTL_SECONDS  # 15 minutes (ferry schedules don't change often)
            )

            logger.info(f"FerryHopper search returned {len(results)} results")
            return results

        except FerryAPIError:
            raise
        except httpx.ReadTimeout:
            logger.warning(f"FerryHopper search timeout: {search_request.departure_port}->{search_request.arrival_port}")
            raise  # Re-raise for caller to handle
        except httpx.ConnectError as e:
            logger.warning(f"FerryHopper connection error: {e}")
            raise FerryAPIError(f"FerryHopper connection failed: {str(e)}")
        except Exception as e:
            logger.error(f"FerryHopper search failed: {e}", exc_info=True)
            raise FerryAPIError(f"FerryHopper search failed: {str(e)}")

    def _serialize_ferry_result(self, result: FerryResult) -> Dict:
        """Serialize FerryResult for caching."""
        data = result.to_dict()
        if hasattr(result, 'route_info'):
            data['route_info'] = result.route_info
        if hasattr(result, 'booking_solution'):
            data['booking_solution'] = result.booking_solution
        return data

    def _reconstruct_ferry_result(self, data: Dict) -> Optional[FerryResult]:
        """Reconstruct FerryResult from cached data."""
        try:
            departure_time = datetime.fromisoformat(data['departure_time']) if isinstance(data['departure_time'], str) else data['departure_time']
            arrival_time = datetime.fromisoformat(data['arrival_time']) if isinstance(data['arrival_time'], str) else data['arrival_time']

            result = FerryResult(
                sailing_id=data['sailing_id'],
                operator=data['operator'],
                departure_port=data['departure_port'],
                arrival_port=data['arrival_port'],
                departure_time=departure_time,
                arrival_time=arrival_time,
                vessel_name=data['vessel_name'],
                prices=data['prices'],
                cabin_types=data.get('cabin_types', []),
                available_spaces=data.get('available_spaces', {})
            )
            if 'route_info' in data:
                result.route_info = data['route_info']
            if 'booking_solution' in data:
                result.booking_solution = data['booking_solution']
            return result
        except Exception as e:
            logger.error(f"Error reconstructing FerryResult from cache: {e}")
            return None

    async def create_booking(self, booking_request: BookingRequest) -> BookingConfirmation:
        """
        Create a booking via FerryHopper.

        FerryHopper uses a two-step process:
        1. POST /booking - Creates booking in PENDING state
        2. POST /booking/confirm - Confirms and charges

        Args:
            booking_request: Booking details including:
                - sailing_id: FerryHopper sailing ID from search
                - passengers: List of passenger details
                - cabin_selection: Selected accommodation (optional)
                - vehicles: List of vehicles (optional)
                - contact_info: Contact details

        Returns:
            BookingConfirmation with booking reference
        """
        try:
            logger.info(f"FerryHopper booking for sailing: {booking_request.sailing_id}")

            # Retrieve cached solution data
            solution_data = cache_service.get(f"fh_solution:{booking_request.sailing_id}")

            if not solution_data:
                raise FerryAPIError(
                    f"Booking solution expired or not found for {booking_request.sailing_id}. "
                    "Please search again."
                )

            # Log solution data details for debugging
            segment = solution_data.get("segment", {})
            accommodations = solution_data.get("accommodations") or segment.get("accommodations", [])
            logger.info(f"Retrieved solution data for booking: hash={solution_data.get('solution_hash')}, "
                       f"accommodations_count={len(accommodations)}, "
                       f"segment_keys={list(segment.keys()) if segment else 'NO_SEGMENT'}")

            if accommodations:
                acc_info = [(a.get("code") or a.get("type", "NO_CODE"), a.get("type", "NO_TYPE")) for a in accommodations[:5]]
                logger.info(f"Available accommodations (code/type): {acc_info}")
            else:
                logger.warning(f"NO ACCOMMODATIONS in solution data! Full keys: {list(solution_data.keys())}")

            # Build booking request with proper tripSelections
            booking_data = self._build_booking_request(booking_request, solution_data)

            logger.debug(f"Booking request data: {booking_data}")

            # Step 1: Create booking (PENDING state)
            create_response = await self.post("/booking", booking_data)
            booking_code = create_response.get("bookingCode")

            if not booking_code:
                error_msg = create_response.get("message", "No booking code returned")
                raise FerryAPIError(f"FerryHopper booking creation failed: {error_msg}")

            logger.info(f"FerryHopper booking created: {booking_code} (PENDING)")

            # Get price for confirmation
            price = create_response.get("price", {})
            total_cents = price.get("totalPriceInCents", 0)

            # Step 2: Confirm booking (this charges the customer)
            confirm_data = {
                "language": "en",
                "bookingCode": booking_code,
                "price": {
                    "totalPriceInCents": total_cents,
                    "currency": price.get("currency", "EUR")
                }
            }

            confirm_response = await self.post("/booking/confirm", confirm_data)
            logger.info(f"FerryHopper booking confirmed: {booking_code}")

            # Step 3: Wait for successful status (poll until SUCCESSFUL or FAILED)
            booking_details = await self._wait_for_booking_success(booking_code)

            booking_status = booking_details.get("bookingStatus", "UNKNOWN")

            return BookingConfirmation(
                booking_reference=booking_code,
                operator_reference=booking_code,
                status="confirmed" if booking_status == "SUCCESSFUL" else "pending",
                total_amount=total_cents / 100,  # Convert cents to EUR
                currency=price.get("currency", "EUR"),
                confirmation_details={
                    "ferryhopper_booking_code": booking_code,
                    "external_reference": create_response.get("externalBookingReference"),
                    "segments": create_response.get("segments", []),
                    "booking_status": booking_status,
                    "boarding_methods": self._extract_boarding_methods(booking_details),
                    "price_breakdown": price,
                }
            )

        except FerryAPIError:
            raise
        except Exception as e:
            logger.error(f"FerryHopper booking failed: {e}", exc_info=True)
            raise FerryAPIError(f"FerryHopper booking failed: {str(e)}")

    async def get_booking_status(self, booking_reference: str) -> Dict[str, Any]:
        """
        Get booking status from FerryHopper.

        Args:
            booking_reference: FerryHopper booking code

        Returns:
            Booking status information
        """
        try:
            response = await self.get(
                "/booking",
                params={
                    "language": "en",
                    "bookingCode": booking_reference
                }
            )

            status = response.get("bookingStatus", "UNKNOWN")
            booking = response.get("booking", {})

            return {
                "booking_reference": booking_reference,
                "status": self._map_booking_status(status),
                "ferryhopper_status": status,
                "operator": "FerryHopper",
                "price": booking.get("price", {}),
                "segments": booking.get("segments", []),
                "contact_details": booking.get("contactDetails", {}),
                "boarding_methods": self._extract_boarding_methods(response),
            }

        except FerryAPIError:
            raise
        except Exception as e:
            logger.error(f"FerryHopper status check failed: {e}", exc_info=True)
            raise FerryAPIError(f"FerryHopper status check failed: {str(e)}")

    async def cancel_booking(
        self,
        booking_reference: str,
        reason: Optional[str] = None
    ) -> bool:
        """
        Cancel a booking via FerryHopper.

        Args:
            booking_reference: FerryHopper booking code
            reason: Cancellation reason

        Returns:
            True if cancellation successful
        """
        try:
            logger.info(f"FerryHopper cancellation for: {booking_reference}")

            # First, get refund estimate
            refund_response = await self.post(
                "/booking/user-cancellation/estimate-refund",
                {"bookingCode": booking_reference}
            )

            refund_amount = refund_response.get("refundAmount", {})
            refund_cents = refund_amount.get("totalPriceInCents", 0)

            logger.info(
                f"FerryHopper refund estimate: {refund_cents / 100} EUR "
                f"(fee: {refund_amount.get('cancellationFee', 0) / 100} EUR)"
            )

            # Execute cancellation
            cancel_data = {
                "bookingCode": booking_reference,
            }

            # Include expected refund amount if available
            if refund_cents > 0:
                cancel_data["expectedRefundAmount"] = refund_cents

            await self.post("/booking/user-cancellation", cancel_data)

            logger.info(f"FerryHopper booking cancelled: {booking_reference}")
            return True

        except FerryAPIError:
            raise
        except Exception as e:
            logger.error(f"FerryHopper cancellation failed: {e}", exc_info=True)
            raise FerryAPIError(f"FerryHopper cancellation failed: {str(e)}")

    async def health_check(self) -> bool:
        """
        Check if FerryHopper API is available.

        Returns:
            True if API is healthy
        """
        try:
            response = await self.session.get(f"{self.base_url}/")
            return response.status_code == 200
        except Exception as e:
            logger.warning(f"FerryHopper health check failed: {e}")
            return False

    # =========================================================================
    # Helper Methods
    # =========================================================================

    async def _map_port_code(self, voilaferry_code: str) -> Optional[str]:
        """Map VoilaFerry port code to FerryHopper code."""
        normalized = voilaferry_code.upper().strip()

        # Check if port is unsupported
        if normalized in UNSUPPORTED_PORTS:
            logger.debug(f"Port {normalized} is not supported by FerryHopper")
            return None

        # Use VoilaFerry -> FerryHopper code map first (fastest)
        if normalized in VOILAFERRY_TO_FERRYHOPPER_PORT_MAP:
            mapped = VOILAFERRY_TO_FERRYHOPPER_PORT_MAP[normalized]
            logger.debug(f"Mapped port code: {normalized} -> {mapped}")
            return mapped

        # Try name-based fallback map
        if normalized in FALLBACK_PORT_MAP:
            return FALLBACK_PORT_MAP[normalized]

        # Try mapping service for API lookup
        if self.mapping_service:
            return await self.mapping_service.get_ferryhopper_port_code(voilaferry_code)

        logger.warning(f"No FerryHopper mapping for port: {voilaferry_code}")
        return None

    def _build_passengers(self, search_request: SearchRequest) -> List[Dict]:
        """Build passenger list for FerryHopper search."""
        passengers = []
        ref_counter = 1

        # Add adults
        for _ in range(search_request.adults):
            passengers.append({
                "ref": f"PAX{ref_counter}",
                "age": 30,
                "sex": "MALE"  # Default, will be updated in booking
            })
            ref_counter += 1

        # Add children
        for _ in range(search_request.children):
            passengers.append({
                "ref": f"PAX{ref_counter}",
                "age": 8,
                "sex": "MALE"
            })
            ref_counter += 1

        # Add infants
        for _ in range(search_request.infants):
            passengers.append({
                "ref": f"PAX{ref_counter}",
                "age": 1,
                "sex": "MALE"
            })
            ref_counter += 1

        return passengers

    def _parse_solution(
        self,
        solution: Dict,
        search_request: SearchRequest
    ) -> List[FerryResult]:
        """
        Parse a FerryHopper booking solution into FerryResult objects.

        Implements Integration Health Check requirements:
        - Trip duration (Mandatory)
        - Departure & Arrival time (Mandatory)
        - Ferry Operator brand (Mandatory)
        - Ferry Operator logo (Recommended)
        - Vessel name (Optional)
        - Price per passenger type with discounts (Mandatory)
        - Price per accommodation type (Mandatory)
        - Vehicle prices (Mandatory)
        - Cancellation policy (Recommended)
        - Boarding method/ticket type (Highly recommended)
        - Indirect trips clarity (Mandatory if included)

        Args:
            solution: FerryHopper booking solution
            search_request: Original search request

        Returns:
            List of FerryResult objects (one per segment)
        """
        results = []
        trips = solution.get("trips", [])

        # Extract solution-level vehicle prices
        solution_vehicles = self._extract_solution_vehicles(solution)

        for trip_idx, trip in enumerate(trips):
            trip_type = trip.get("type", "DIRECT")  # DIRECT or INDIRECT
            segments = trip.get("segments", [])
            num_segments = len(segments)

            for seg_idx, segment in enumerate(segments):
                try:
                    # Extract departure/arrival info (nested objects)
                    departure_port_obj = segment.get("departurePort", {})
                    arrival_port_obj = segment.get("arrivalPort", {})
                    departure_port = departure_port_obj.get("code", "")
                    arrival_port = arrival_port_obj.get("code", "")
                    departure_port_name = departure_port_obj.get("name", departure_port)
                    arrival_port_name = arrival_port_obj.get("name", arrival_port)

                    # Parse times
                    departure_str = segment.get("departureDateTime", "")
                    arrival_str = segment.get("arrivalDateTime", "")

                    departure_time = self._parse_datetime(departure_str)
                    arrival_time = self._parse_datetime(arrival_str)

                    if not departure_time or not arrival_time:
                        logger.warning(f"Could not parse times for segment: {segment}")
                        continue

                    # Calculate trip duration (Mandatory)
                    duration_delta = arrival_time - departure_time
                    duration_hours = duration_delta.total_seconds() / 3600
                    duration_str = self._format_duration(duration_delta)

                    # Get operator info with logo (Mandatory + Recommended)
                    owner_company_obj = segment.get("ownerCompany", {})
                    owner_company = owner_company_obj.get("name", "Unknown")
                    owner_company_code = owner_company_obj.get("code", "")
                    operator_logo_url = owner_company_obj.get("iconURL", "")

                    # Get vessel info (Optional)
                    vessel_obj = segment.get("vessel", {})
                    vessel_name = vessel_obj.get("name", "Unknown Vessel")
                    vessel_id = vessel_obj.get("vesselID", "")

                    # Extract discount rates for child/infant pricing (Mandatory)
                    discount_rates = segment.get("discountRates", [])

                    # Extract prices with discounts applied (Mandatory)
                    prices = self._extract_prices_with_discounts(segment, solution, discount_rates)

                    # Note: Vehicle prices are not included in prices dict
                    # They are available in route_info.available_vehicles for booking
                    # prices dict must only contain float values

                    # Extract cabin/accommodation types (Mandatory)
                    cabin_types = self._extract_cabin_types(segment)

                    # Extract cancellation policies (Recommended)
                    cancellation_policies = segment.get("cancellationPolicies", [])

                    # Extract boarding method for ticket type (Highly recommended)
                    boarding_method = segment.get("boardingMethod", {})
                    boarding_method_key = boarding_method.get("key", "")
                    is_eticket = boarding_method_key in [
                        "BOARDING_METHOD_ETICKET",
                        "BOARDING_METHOD_BOARDING_PASS",
                        "BOARDING_METHOD_CONFIRMATION_EMAIL",
                    ]

                    # Check if vehicles are supported (Optional)
                    vehicle_is_mandatory = segment.get("vehicleIsMandatory", False)
                    vehicles_supported = len(solution.get("vehicles", [])) > 0

                    # Create unique sailing ID that encodes booking info
                    # Format: FH_{solutionHash}_{tripIdx}_{segIdx}_{vesselId}_{datetime}
                    solution_hash = hashlib.md5(str(solution).encode()).hexdigest()[:8]
                    sailing_id = f"FH_{solution_hash}_{trip_idx}_{seg_idx}_{vessel_id}_{departure_time.strftime('%Y%m%d%H%M')}"

                    # Map ports back to VoilaFerry codes
                    vf_departure = REVERSE_PORT_MAP.get(departure_port, departure_port)
                    vf_arrival = REVERSE_PORT_MAP.get(arrival_port, arrival_port)

                    # Store booking solution data for later use in booking
                    # This includes all data needed to build tripSelections
                    segment_accommodations = segment.get("accommodations", [])
                    booking_solution = {
                        "solution_hash": solution_hash,
                        "trip_index": trip_idx,
                        "segment_index": seg_idx,
                        "segment": segment,  # Full segment data with accommodations
                        "trip": trip,  # Full trip data
                        "solution_vehicles": solution.get("vehicles", []),
                        "accommodations": segment_accommodations,  # Available accommodations
                        "departure_port_code": departure_port,
                        "arrival_port_code": arrival_port,
                    }

                    # Build route info for indirect trips (Mandatory if indirect)
                    route_info = {
                        "trip_type": trip_type,
                        "segment_index": seg_idx + 1,
                        "total_segments": num_segments,
                        "departure_port_name": departure_port_name,
                        "arrival_port_name": arrival_port_name,
                        "duration_hours": round(duration_hours, 1),
                        "duration_formatted": duration_str,
                        "operator_code": owner_company_code,
                        "operator_logo_url": operator_logo_url,
                        "is_eticket": is_eticket,
                        "boarding_method": boarding_method_key,
                        "boarding_method_name": boarding_method.get("name", ""),
                        "boarding_method_description": boarding_method.get("description", ""),
                        "vehicles_supported": vehicles_supported,
                        "vehicle_mandatory": vehicle_is_mandatory,
                        "cancellation_policies": cancellation_policies,
                        "discount_rates": discount_rates,
                        "available_vehicles": solution_vehicles,  # Vehicle types with prices
                    }

                    # For indirect trips, add connection info
                    if trip_type == "INDIRECT" and seg_idx < num_segments - 1:
                        next_segment = segments[seg_idx + 1]
                        next_departure_str = next_segment.get("departureDateTime", "")
                        next_departure = self._parse_datetime(next_departure_str)
                        if next_departure and arrival_time:
                            connection_delta = next_departure - arrival_time
                            route_info["connection_time_minutes"] = int(connection_delta.total_seconds() / 60)
                            route_info["connection_time_formatted"] = self._format_duration(connection_delta)
                            route_info["connection_port"] = arrival_port_name

                    result = FerryResult(
                        sailing_id=sailing_id,
                        operator=owner_company,
                        departure_port=vf_departure,
                        arrival_port=vf_arrival,
                        departure_time=departure_time,
                        arrival_time=arrival_time,
                        vessel_name=vessel_name,
                        prices=prices,
                        cabin_types=cabin_types,
                        available_spaces=self._calculate_available_spaces(cabin_types, vehicles_supported)
                    )

                    # Add route_info as additional attribute
                    result.route_info = route_info

                    # Add booking solution data for later use
                    result.booking_solution = booking_solution

                    # Cache the booking solution by sailing_id for booking retrieval
                    # Log accommodation info for debugging booking issues
                    acc_count = len(segment_accommodations)
                    acc_info = [(a.get("code") or a.get("type", "NO_CODE"), a.get("type")) for a in segment_accommodations[:3]]
                    logger.info(f"Caching solution {sailing_id} for {owner_company}: {acc_count} accommodations, codes/types: {acc_info}")

                    # CRITICAL: If no accommodations, log full segment for debugging
                    if acc_count == 0:
                        logger.warning(f"NO ACCOMMODATIONS for {owner_company}! Segment keys: {list(segment.keys())}")
                        # Check if accommodations might be elsewhere
                        if "accommodations" in segment:
                            logger.warning(f"Segment has 'accommodations' key but empty: {segment.get('accommodations')}")
                        else:
                            logger.warning(f"Segment missing 'accommodations' key entirely")

                    cache_service.set(
                        f"fh_solution:{sailing_id}",
                        booking_solution,
                        ttl=7200  # 2 hours (extended for cabin alerts)
                    )

                    results.append(result)

                except Exception as e:
                    logger.error(f"Error parsing segment: {e}", exc_info=True)
                    continue

        return results

    def _format_duration(self, delta: timedelta) -> str:
        """Format timedelta as human-readable duration string."""
        total_seconds = int(delta.total_seconds())
        hours, remainder = divmod(total_seconds, 3600)
        minutes, _ = divmod(remainder, 60)
        if hours > 0:
            return f"{hours}h {minutes}m"
        return f"{minutes}m"

    def _extract_solution_vehicles(self, solution: Dict) -> List[Dict]:
        """Extract vehicle types and prices from solution."""
        vehicles = []
        for vehicle in solution.get("vehicles", []):
            vehicles.append({
                "code": vehicle.get("code", ""),
                "type": vehicle.get("type", ""),
                "description": vehicle.get("description", ""),
                "detailed_description": vehicle.get("detailedDescription", ""),
            })
        return vehicles

    def _extract_prices_with_discounts(
        self,
        segment: Dict,
        solution: Dict,
        discount_rates: List[Dict]
    ) -> Dict[str, float]:
        """
        Extract prices with discount rates applied for child/infant.

        Implements Integration Health Check: Price per passenger type (Mandatory)
        """
        prices = {
            "adult": 0.0,
            "child": 0.0,
            "infant": 0.0,
            "vehicle": 0.0,
        }

        accommodations = segment.get("accommodations", [])

        if accommodations:
            # Find the lowest priced accommodation (deck/lounge)
            lowest_price = float("inf")
            for acc in accommodations:
                expected_price = acc.get("expectedPrice", {})
                price_cents = expected_price.get("totalPriceInCents", 0)
                if price_cents > 0 and price_cents < lowest_price:
                    lowest_price = price_cents

            if lowest_price < float("inf"):
                adult_price = lowest_price / 100
                prices["adult"] = adult_price

                # Apply discount rates for child/infant
                child_discount = 0
                infant_discount = 100  # Default: infants free

                for rate in discount_rates:
                    min_age = rate.get("minAge", 0)
                    max_age = rate.get("maxAge", 99)
                    discount_pct = rate.get("discountPercentage", 0)

                    # Child typically 5-10 or 2-11
                    if min_age <= 8 <= max_age:
                        child_discount = discount_pct

                    # Infant typically 0-4 or 0-2
                    if min_age == 0 and max_age <= 4:
                        infant_discount = discount_pct

                prices["child"] = round(adult_price * (1 - child_discount / 100), 2)
                prices["infant"] = round(adult_price * (1 - infant_discount / 100), 2)

        # Vehicle prices from solution
        vehicles = solution.get("vehicles", [])
        if vehicles:
            # Get first vehicle price as default
            for vehicle in vehicles:
                if vehicle.get("type") == "CAR":
                    # Vehicle prices would come from a separate call or estimate
                    prices["vehicle"] = 0.0  # Would need estimate-prices call
                    break

        return prices

    def _extract_cabin_types(self, segment: Dict) -> List[Dict]:
        """
        Extract cabin/accommodation types from segment.

        Implements Integration Health Check:
        - Price per accommodation type (Mandatory)
        - Fare classes (Highly recommended)
        """
        cabin_types = []
        accommodations = segment.get("accommodations", [])

        seen_codes = set()
        for idx, acc in enumerate(accommodations):
            expected_price = acc.get("expectedPrice", {})
            price_cents = expected_price.get("totalPriceInCents", 0)
            fh_type = acc.get("type", "DECK")

            # Map FerryHopper type to VoilaFerry CabinType enum value
            vf_type = map_ferryhopper_cabin_type(fh_type)

            # Ensure unique cabin code - use "code" if available, else "type", else generate
            cabin_code = acc.get("code") or acc.get("type") or ""
            if not cabin_code or cabin_code in seen_codes:
                cabin_code = f"{fh_type}_{idx}"
            seen_codes.add(cabin_code)

            cabin_types.append({
                "type": vf_type,  # Now uses VoilaFerry enum values
                "code": cabin_code,
                "name": acc.get("description", "Unknown"),
                "price": price_cents / 100,
                "currency": expected_price.get("currency", "EUR"),
                "available": acc.get("availability", 0),
                "capacity": acc.get("capacity", 1),
                "refund_type": acc.get("refundType", ""),  # REFUNDABLE, NON_REFUNDABLE
                "image_url": acc.get("imageUrl", ""),
                "original_type": fh_type,  # Keep original for reference
            })

        return cabin_types

    def _calculate_available_spaces(self, cabin_types: List[Dict], vehicles_supported: bool) -> Dict:
        """
        Calculate available passenger and vehicle spaces from cabin types.

        Uses actual availability data from FerryHopper instead of hardcoded values.
        Deck/seat types indicate passenger capacity, cabin types indicate cabin capacity.

        For vehicles: FerryHopper doesn't return exact vehicle capacity counts.
        However, if a search with a vehicle returns results, it means vehicle space exists.
        We use vehicles_supported (True if solution has vehicle types) as the indicator.
        """
        # Calculate passenger availability from deck/seat types
        passengers_available = 0
        for cabin in cabin_types:
            cabin_type = cabin.get("type", "").lower()
            available = cabin.get("available", 0)
            capacity = cabin.get("capacity", 1)

            # Deck seats count towards passenger availability
            if cabin_type in ("deck", "seat", "deck_seat", "reclining_seat"):
                passengers_available += available * capacity

        # If no deck seats found, sum all accommodation availability
        # (some ferries only have cabins, no deck passage)
        if passengers_available == 0:
            for cabin in cabin_types:
                available = cabin.get("available", 0)
                capacity = cabin.get("capacity", 1)
                passengers_available += available * capacity

        # Vehicle availability from FerryHopper:
        # - If solution includes vehicle types, vehicles ARE available (at least 1 slot)
        # - FerryHopper wouldn't return vehicle options if no capacity existed
        # - We use 1 to indicate "available" since exact count isn't provided
        vehicles_available = 1 if vehicles_supported else 0

        return {
            "passengers": passengers_available,
            "vehicles": vehicles_available,
        }

    def _parse_datetime(self, dt_str: str) -> Optional[datetime]:
        """Parse FerryHopper datetime string (ISO 8601 with timezone)."""
        if not dt_str:
            return None

        try:
            # Python 3.7+ can parse ISO 8601 with fromisoformat
            # Handle timezone offset format like +02:00
            return datetime.fromisoformat(dt_str)
        except ValueError:
            pass

        # Fallback: try multiple formats
        formats = [
            "%Y-%m-%dT%H:%M:%S%z",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M:%SZ",
        ]

        for fmt in formats:
            try:
                return datetime.strptime(dt_str, fmt)
            except ValueError:
                continue

        logger.warning(f"Could not parse datetime: {dt_str}")
        return None

    def _build_booking_request(
        self,
        booking_request: BookingRequest,
        solution_data: Dict
    ) -> Dict:
        """
        Build FerryHopper booking request from BookingRequest and cached solution data.

        FerryHopper booking request structure:
        {
            "language": "en",
            "passengers": [...],
            "tripSelections": [...],
            "vehicle": {...},  // optional
            "contactDetails": {...},
            "externalBookingReference": "..."
        }
        """
        # Build passenger list with refs
        passengers = []
        passenger_refs = []

        for idx, pax in enumerate(booking_request.passengers):
            ref = f"PAX{idx + 1}"
            passenger_refs.append(ref)

            passenger = {
                "ref": ref,
                "firstName": pax.get("first_name", pax.get("firstName", "")),
                "lastName": pax.get("last_name", pax.get("lastName", "")),
                "age": pax.get("age", calculate_age_from_type(pax.get("type", "adult"))),
                "sex": "MALE" if pax.get("gender", pax.get("sex", "male")).upper() in ["MALE", "M"] else "FEMALE",
            }

            # Add optional fields
            if pax.get("nationality"):
                passenger["nationality"] = pax["nationality"]
            if pax.get("date_of_birth") or pax.get("birthdate"):
                passenger["birthdate"] = pax.get("date_of_birth") or pax.get("birthdate")
            if pax.get("passport_number") or pax.get("document"):
                passenger["document"] = pax.get("passport_number") or pax.get("document")

            passengers.append(passenger)

        # Build trip selections from solution data
        trip_selections = self._build_trip_selections(
            solution_data=solution_data,
            passenger_refs=passenger_refs,
            cabin_selection=booking_request.cabin_selection
        )

        # Contact details
        contact = booking_request.contact_info or {}

        booking_data = {
            "language": "en",
            "passengers": passengers,
            "tripSelections": trip_selections,
            "contactDetails": {
                "email": contact.get("email", ""),
                "phone": contact.get("phone", ""),
                "phoneCountryCode": contact.get("phone_country_code", "+33"),
            },
            "externalBookingReference": booking_request.sailing_id,
        }

        # Add vehicle if provided
        if booking_request.vehicles:
            vehicle = self._build_vehicle_selection(
                booking_request.vehicles,
                solution_data.get("solution_vehicles", [])
            )
            if vehicle:
                booking_data["vehicle"] = vehicle

        return booking_data

    def _build_trip_selections(
        self,
        solution_data: Dict,
        passenger_refs: List[str],
        cabin_selection: Optional[Dict] = None
    ) -> List[Dict]:
        """
        Build tripSelections array for FerryHopper booking.

        Each trip selection contains:
        - tripIndex: which trip (0 = outbound, 1 = return)
        - segmentIndex: which segment within the trip
        - passengerAccommodations: mapping of passenger refs to accommodation codes
        """
        trip_selections = []

        segment = solution_data.get("segment", {})
        # Try both locations where accommodations might be stored
        accommodations = solution_data.get("accommodations") or segment.get("accommodations", [])
        trip_index = solution_data.get("trip_index", 0)
        segment_index = solution_data.get("segment_index", 0)

        logger.info(f"Building trip selections - trip_index: {trip_index}, segment_index: {segment_index}")
        logger.info(f"Accommodations count: {len(accommodations)}, cabin_selection: {cabin_selection}")

        if not accommodations:
            logger.warning(f"No accommodations found in solution data. Keys: {list(solution_data.keys())}")
            logger.warning(f"Segment keys: {list(segment.keys()) if segment else 'No segment'}")
            # Try to extract from segment accommodations array
            if segment:
                logger.warning(f"Segment accommodations raw: {segment.get('accommodations', 'NOT FOUND')}")

        # Select accommodation - use cabin_selection if provided, else first available
        selected_acc_code = None

        if cabin_selection:
            # User selected a specific accommodation
            selected_acc_code = cabin_selection.get("code") or cabin_selection.get("accommodation_code")
            logger.info(f"User selected accommodation code: {selected_acc_code}")

        if not selected_acc_code and accommodations:
            # Helper function to get accommodation code - try "code" first, then "type" as fallback
            def get_acc_code(acc):
                return acc.get("code") or acc.get("type")

            # Default to first (usually cheapest) accommodation
            # Prefer deck/lounge/seat for cheapest option
            for acc in accommodations:
                acc_type = acc.get("type", "").upper()
                if acc_type in ["DECK", "LOUNGE", "AIRPLANE_SEAT", "SEAT_NOTNUMBERED", "SEAT_NUMBERED"]:
                    selected_acc_code = get_acc_code(acc)
                    logger.info(f"Auto-selected deck/seat accommodation: {selected_acc_code} (type: {acc_type})")
                    break

            # If no deck/seat, use first accommodation
            if not selected_acc_code and accommodations:
                selected_acc_code = get_acc_code(accommodations[0])
                logger.info(f"Auto-selected first accommodation: {selected_acc_code}")

        if not selected_acc_code:
            # Log all available accommodations for debugging
            if accommodations:
                acc_details = [{"code": a.get("code"), "type": a.get("type"), "name": a.get("name")} for a in accommodations]
                logger.error(f"Could not select accommodation code. Available: {acc_details}")
                # Try harder - look for any accommodation with a code or type
                for acc in accommodations:
                    code = acc.get("code") or acc.get("type")
                    if code:
                        selected_acc_code = code
                        logger.info(f"Fallback: selected accommodation with code/type: {selected_acc_code}")
                        break

            if not selected_acc_code:
                # FerryHopper REQUIRES tripSelections - cannot be empty
                # This means the solution data is missing accommodations
                logger.error(f"CRITICAL: No accommodation available. Solution data keys: {list(solution_data.keys())}")
                logger.error(f"Segment data: {segment.get('accommodations', 'NO_ACCOMMODATIONS_KEY')}")
                raise FerryAPIError(
                    "No accommodation available for this ferry. "
                    "Please search again and select a different sailing."
                )

        logger.info(f"Selected accommodation: {selected_acc_code}")

        # Build passenger accommodations (all passengers in same accommodation)
        passenger_accommodations = []
        for ref in passenger_refs:
            passenger_accommodations.append({
                "passengerRef": ref,
                "accommodationCode": selected_acc_code
            })

        trip_selection = {
            "tripIndex": trip_index,
            "segmentIndex": segment_index,
            "passengerAccommodations": passenger_accommodations
        }

        trip_selections.append(trip_selection)

        return trip_selections

    def _build_vehicle_selection(
        self,
        vehicles: List[Dict],
        available_vehicles: List[Dict]
    ) -> Optional[Dict]:
        """
        Build vehicle selection for FerryHopper booking.

        Args:
            vehicles: List of vehicles from booking request
            available_vehicles: Available vehicle types from solution

        Returns:
            Vehicle selection dict or None
        """
        if not vehicles or not available_vehicles:
            return None

        # Get first vehicle from request
        vehicle = vehicles[0]
        vehicle_type = vehicle.get("type", "CAR").upper()

        # Find matching vehicle code from available options
        vehicle_code = None
        for av in available_vehicles:
            av_type = av.get("type", "").upper()
            if av_type == vehicle_type or (av_type == "CAR" and vehicle_type in ["CAR", "VEHICLE"]):
                vehicle_code = av.get("code")
                break

        if not vehicle_code and available_vehicles:
            # Default to first available
            vehicle_code = available_vehicles[0].get("code")

        if not vehicle_code:
            logger.warning(f"No matching vehicle found for type: {vehicle_type}")
            return None

        return {
            "code": vehicle_code,
            "licensePlate": vehicle.get("license_plate", vehicle.get("licensePlate", "")),
            "brand": vehicle.get("brand", ""),
            "model": vehicle.get("model", ""),
        }

    async def _wait_for_booking_success(
        self,
        booking_code: str,
        max_attempts: int = 10,
        delay_seconds: int = 3
    ) -> Dict:
        """
        Poll for booking success status.

        Args:
            booking_code: FerryHopper booking code
            max_attempts: Maximum polling attempts
            delay_seconds: Delay between polls

        Returns:
            Final booking status response
        """
        for attempt in range(max_attempts):
            response = await self.get(
                "/booking",
                params={
                    "language": "en",
                    "bookingCode": booking_code
                }
            )

            status = response.get("bookingStatus")

            if status == "SUCCESSFUL":
                logger.info(f"Booking {booking_code} confirmed successfully")
                return response
            elif status == "FAILED":
                raise FerryAPIError(f"Booking {booking_code} failed")

            # Still PENDING, wait and retry
            logger.debug(f"Booking {booking_code} still pending, attempt {attempt + 1}/{max_attempts}")
            await asyncio.sleep(delay_seconds)

        # Return last response even if still pending
        logger.warning(f"Booking {booking_code} still pending after {max_attempts} attempts")
        return response

    def _extract_boarding_methods(self, booking_response: Dict) -> List[Dict]:
        """Extract boarding methods from booking response."""
        boarding_methods = []
        booking = booking_response.get("booking", {})
        segments = booking.get("segments", [])

        for segment in segments:
            boarding = segment.get("boardingMethod", {})
            if boarding:
                boarding_methods.append({
                    "key": boarding.get("key"),
                    "url": boarding.get("url"),
                    "identifiers": boarding.get("identifiers", {}),
                })

        return boarding_methods

    def _map_booking_status(self, ferryhopper_status: str) -> str:
        """Map FerryHopper status to VoilaFerry status."""
        status_map = {
            "PENDING": "pending",
            "SUCCESSFUL": "confirmed",
            "FAILED": "failed",
        }
        return status_map.get(ferryhopper_status, "unknown")

    async def estimate_prices(
        self,
        passengers: List[Dict],
        trip_selections: List[Dict],
        vehicle: Optional[Dict] = None,
        pets: Optional[List[Dict]] = None
    ) -> Dict:
        """
        Get price estimate without creating a booking.

        Args:
            passengers: Passenger list
            trip_selections: Selected trips and accommodations
            vehicle: Optional vehicle selection
            pets: Optional pet list

        Returns:
            Price breakdown
        """
        request_data = {
            "language": "en",
            "passengers": passengers,
            "tripSelections": trip_selections,
        }

        if vehicle:
            request_data["vehicle"] = vehicle
        if pets:
            request_data["pets"] = pets

        response = await self.post("/booking/estimate-prices", request_data)
        return response

    async def estimate_refund(self, booking_code: str) -> Dict:
        """
        Get refund estimate for a booking.

        Args:
            booking_code: FerryHopper booking code

        Returns:
            Refund amount details
        """
        response = await self.post(
            "/booking/user-cancellation/estimate-refund",
            {"bookingCode": booking_code}
        )
        return response.get("refundAmount", {})

    async def get_companies(self) -> List[Dict]:
        """Get list of enabled ferry operators."""
        response = await self.get("/companies")
        return response.get("companies", [])

    async def get_boarding_methods(self, language: str = "en") -> List[Dict]:
        """Get list of boarding methods."""
        response = await self.get("/boarding-methods", params={"language": language})
        return response.get("boardingMethods", [])

    async def get_nationalities(self, language: str = "en") -> List[Dict]:
        """Get list of allowed nationalities."""
        response = await self.get("/nationalities", params={"language": language})
        return response.get("nationalities", [])

    async def get_ports(self, language: str = "en") -> List[Dict]:
        """
        Get list of all ports from FerryHopper API.

        Per FerryHopper best practices: Cache this endpoint (ports rarely change).
        TTL: 24 hours recommended.

        Args:
            language: Language for port names (default: "en")

        Returns:
            List of port dictionaries with code, name, country, coordinates, etc.
        """
        # Check cache first
        cached = cache_service.get_ferryhopper_ports(language)
        if cached:
            logger.debug(f"✅ FerryHopper ports cache HIT (language: {language})")
            return cached.get("ports", [])

        logger.info(f"📍 Fetching ports from FerryHopper API (language: {language})")
        response = await self.get("/ports", params={"language": language})
        ports = response.get("ports", [])

        # Cache for 24 hours
        cache_service.set_ferryhopper_ports({"ports": ports}, language=language, ttl=86400)
        logger.info(f"✅ Fetched and cached {len(ports)} ports from FerryHopper")

        return ports

    async def get_vehicles(self, language: str = "en") -> List[Dict]:
        """
        Get list of vehicle types from FerryHopper API.

        Args:
            language: Language for descriptions (default: "en")

        Returns:
            List of vehicle type dictionaries
        """
        # Check cache first
        cached = cache_service.get_ferryhopper_vehicles(language)
        if cached:
            logger.debug(f"✅ FerryHopper vehicles cache HIT")
            return cached.get("vehicles", [])

        logger.info(f"🚗 Fetching vehicles from FerryHopper API")
        response = await self.get("/vehicles", params={"language": language})
        vehicles = response.get("vehicles", [])

        # Cache for 24 hours
        cache_service.set_ferryhopper_vehicles({"vehicles": vehicles}, language=language, ttl=86400)
        logger.info(f"✅ Fetched and cached {len(vehicles)} vehicle types from FerryHopper")

        return vehicles

    async def get_accommodations(self) -> List[Dict]:
        """
        Get list of accommodation types from FerryHopper API.

        Returns:
            List of accommodation type dictionaries
        """
        # Check cache first
        cached = cache_service.get_ferryhopper_accommodations()
        if cached:
            logger.debug(f"✅ FerryHopper accommodations cache HIT")
            return cached.get("accommodations", [])

        logger.info(f"🛏️ Fetching accommodations from FerryHopper API")
        response = await self.get("/accommodations")
        accommodations = response.get("accommodations", [])

        # Cache for 24 hours
        cache_service.set_ferryhopper_accommodations({"accommodations": accommodations}, ttl=86400)
        logger.info(f"✅ Fetched and cached {len(accommodations)} accommodation types from FerryHopper")

        return accommodations
