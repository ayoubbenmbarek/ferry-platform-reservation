"""
Unit tests for FerryHopper Integration Service.

These tests mock all HTTP calls to test the FerryHopper integration logic
without making actual API requests.
"""

import pytest
from datetime import datetime, date, timedelta
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
import json

from app.services.ferry_integrations.ferryhopper import FerryHopperIntegration
from app.services.ferry_integrations.base import (
    SearchRequest,
    BookingRequest,
    FerryAPIError,
)
from app.services.ferry_integrations.ferryhopper_mappings import (
    FerryHopperMappingService,
    FALLBACK_PORT_MAP,
    REVERSE_PORT_MAP,
)


# ============================================================================
# Test Fixtures
# ============================================================================

@pytest.fixture
def ferryhopper_integration():
    """Create a FerryHopper integration instance for testing."""
    return FerryHopperIntegration(
        api_key="test-api-key-12345",
        base_url="https://ferryhapi.uat.ferryhopper.com"
    )


@pytest.fixture
def sample_search_request():
    """Create a sample search request."""
    return SearchRequest(
        departure_port="PIRAEUS",
        arrival_port="SANTORINI",
        departure_date=date.today() + timedelta(days=30),
        adults=2,
        children=1,
        infants=0,
        vehicles=[]
    )


@pytest.fixture
def sample_booking_request():
    """Create a sample booking request."""
    return BookingRequest(
        sailing_id="FH_0_0_V123_202502151000",
        passengers=[
            {
                "first_name": "John",
                "last_name": "Doe",
                "type": "adult",
                "gender": "male",
                "age": 35,
                "nationality": "US",
            },
            {
                "first_name": "Jane",
                "last_name": "Doe",
                "type": "adult",
                "gender": "female",
                "age": 32,
                "nationality": "US",
            },
        ],
        vehicles=[],
        cabin_selection=None,
        contact_info={
            "email": "john.doe@example.com",
            "phone": "+1234567890"
        },
        special_requests=None
    )


@pytest.fixture
def sample_solution_data():
    """Create sample solution data for booking request building."""
    return {
        "solution_hash": "abc123",
        "trip_index": 0,
        "segment_index": 0,
        "segment": {
            "departurePort": {"code": "PIR", "name": "Athens (Piraeus)"},
            "arrivalPort": {"code": "JTR", "name": "Santorini (Thira)"},
            "departureDateTime": "2025-02-15T08:00:00+02:00",
            "arrivalDateTime": "2025-02-15T16:00:00+02:00",
            "vessel": {"name": "Blue Star Delos", "vesselID": "V123"},
            "accommodations": [
                {
                    "type": "DECK",
                    "code": "DK",
                    "description": "Deck Passage",
                    "expectedPrice": {"totalPriceInCents": 4500, "currency": "EUR"},
                    "availability": 100,
                    "capacity": 1
                }
            ]
        },
        "trip": {
            "type": "DIRECT",
            "segments": [
                {
                    "departurePort": {"code": "PIR"},
                    "arrivalPort": {"code": "JTR"},
                    "departureDateTime": "2025-02-15T08:00:00+02:00",
                    "arrivalDateTime": "2025-02-15T16:00:00+02:00"
                }
            ]
        },
        "solution_vehicles": [
            {"code": "CAR", "type": "CAR", "description": "Car up to 4.5m"}
        ],
        "accommodations": [
            {
                "type": "DECK",
                "code": "DK",
                "description": "Deck Passage",
                "expectedPrice": {"totalPriceInCents": 4500, "currency": "EUR"},
                "availability": 100,
                "capacity": 1
            }
        ],
        "departure_port_code": "PIR",
        "arrival_port_code": "JTR"
    }


@pytest.fixture
def mock_search_response():
    """Create a mock FerryHopper search response."""
    return {
        "bookingSolutions": [
            {
                "trips": [
                    {
                        "type": "DIRECT",
                        "segments": [
                            {
                                "departurePort": {
                                    "code": "PIR",
                                    "name": "Athens (Piraeus)"
                                },
                                "arrivalPort": {
                                    "code": "JTR",
                                    "name": "Santorini (Thira)"
                                },
                                "departureDateTime": "2025-02-15T08:00:00+02:00",
                                "arrivalDateTime": "2025-02-15T16:00:00+02:00",
                                "ownerCompany": {
                                    "name": "Blue Star Ferries",
                                    "code": "BSF",
                                    "iconURL": "https://example.com/bluestar-logo.png"
                                },
                                "vessel": {
                                    "name": "Blue Star Delos",
                                    "vesselID": "V123"
                                },
                                "accommodations": [
                                    {
                                        "type": "DECK",
                                        "code": "DK",
                                        "description": "Deck Passage",
                                        "expectedPrice": {
                                            "totalPriceInCents": 4500,
                                            "currency": "EUR"
                                        },
                                        "availability": 100,
                                        "capacity": 1,
                                        "refundType": "REFUNDABLE",
                                        "imageUrl": ""
                                    },
                                    {
                                        "type": "CABIN",
                                        "code": "C2",
                                        "description": "2-Bed Cabin",
                                        "expectedPrice": {
                                            "totalPriceInCents": 12000,
                                            "currency": "EUR"
                                        },
                                        "availability": 10,
                                        "capacity": 2,
                                        "refundType": "REFUNDABLE",
                                        "imageUrl": "https://example.com/cabin.jpg"
                                    }
                                ],
                                "discountRates": [
                                    {"minAge": 0, "maxAge": 4, "discountPercentage": 100},
                                    {"minAge": 5, "maxAge": 11, "discountPercentage": 50}
                                ],
                                "boardingMethod": {
                                    "key": "BOARDING_METHOD_ETICKET",
                                    "name": "E-Ticket",
                                    "description": "Print or show on mobile"
                                },
                                "cancellationPolicies": [
                                    {"deadline": "24h", "refundPercentage": 100},
                                    {"deadline": "2h", "refundPercentage": 50}
                                ],
                                "vehicleIsMandatory": False
                            }
                        ]
                    }
                ],
                "vehicles": [
                    {
                        "code": "CAR",
                        "type": "CAR",
                        "description": "Car up to 4.5m",
                        "detailedDescription": "Standard car"
                    }
                ]
            }
        ]
    }


@pytest.fixture
def mock_booking_create_response():
    """Create a mock booking creation response."""
    return {
        "bookingCode": "BK-TEST-12345",
        "externalBookingReference": "EXT-REF-001",
        "price": {
            "totalPriceInCents": 13500,
            "currency": "EUR"
        },
        "segments": [
            {
                "segmentId": "SEG001",
                "status": "PENDING"
            }
        ]
    }


@pytest.fixture
def mock_booking_status_response():
    """Create a mock booking status response."""
    return {
        "bookingStatus": "SUCCESSFUL",
        "booking": {
            "bookingCode": "BK-TEST-12345",
            "price": {
                "totalPriceInCents": 13500,
                "currency": "EUR"
            },
            "segments": [
                {
                    "boardingMethod": {
                        "key": "BOARDING_METHOD_ETICKET",
                        "url": "https://checkin.example.com/BK-TEST-12345",
                        "identifiers": {"ticketId": "TKT001"}
                    }
                }
            ],
            "contactDetails": {
                "email": "john.doe@example.com",
                "phone": "+1234567890"
            }
        }
    }


# ============================================================================
# FerryHopper Integration Unit Tests
# ============================================================================

class TestFerryHopperIntegrationInit:
    """Tests for FerryHopper integration initialization."""

    def test_init_with_params(self):
        """Test initialization with parameters."""
        integration = FerryHopperIntegration(
            api_key="test-key",
            base_url="https://test.api.com",
            timeout=60
        )

        assert integration.api_key == "test-key"
        assert integration.base_url == "https://test.api.com"
        assert integration.timeout == 60
        assert integration.operator_name == "FerryHopper"
        assert integration._headers["X-Api-Key"] == "test-key"

    def test_init_defaults(self):
        """Test initialization with defaults."""
        integration = FerryHopperIntegration()

        assert integration.api_key == ""
        assert integration.base_url == "https://ferryhapi.uat.ferryhopper.com"
        assert integration.timeout == 30

    def test_headers_include_required_fields(self, ferryhopper_integration):
        """Test that headers include all required fields."""
        headers = ferryhopper_integration._headers

        assert "X-Api-Key" in headers
        assert headers["Content-Type"] == "application/json"
        assert headers["Accept"] == "application/json"


class TestBuildPassengers:
    """Tests for passenger building logic."""

    def test_build_passengers_adults_only(self, ferryhopper_integration):
        """Test building passengers with adults only."""
        search_request = SearchRequest(
            departure_port="PIR",
            arrival_port="JTR",
            departure_date=date.today(),
            adults=2,
            children=0,
            infants=0,
            vehicles=[]
        )

        passengers = ferryhopper_integration._build_passengers(search_request)

        assert len(passengers) == 2
        assert all(p["age"] == 30 for p in passengers)
        assert passengers[0]["ref"] == "PAX1"
        assert passengers[1]["ref"] == "PAX2"

    def test_build_passengers_mixed(self, ferryhopper_integration):
        """Test building passengers with mixed types."""
        search_request = SearchRequest(
            departure_port="PIR",
            arrival_port="JTR",
            departure_date=date.today(),
            adults=2,
            children=1,
            infants=1,
            vehicles=[]
        )

        passengers = ferryhopper_integration._build_passengers(search_request)

        assert len(passengers) == 4
        # First 2 adults
        assert passengers[0]["age"] == 30
        assert passengers[1]["age"] == 30
        # Child
        assert passengers[2]["age"] == 8
        # Infant
        assert passengers[3]["age"] == 1


class TestParseSolution:
    """Tests for parsing FerryHopper booking solutions."""

    def test_parse_direct_trip(self, ferryhopper_integration, mock_search_response, sample_search_request):
        """Test parsing a direct trip solution."""
        solution = mock_search_response["bookingSolutions"][0]

        results = ferryhopper_integration._parse_solution(solution, sample_search_request)

        assert len(results) == 1
        result = results[0]

        assert result.operator == "Blue Star Ferries"
        assert result.vessel_name == "Blue Star Delos"
        assert "FH_" in result.sailing_id
        assert result.departure_time.hour == 8
        assert result.arrival_time.hour == 16

    def test_parse_solution_extracts_prices(self, ferryhopper_integration, mock_search_response, sample_search_request):
        """Test that prices are correctly extracted."""
        solution = mock_search_response["bookingSolutions"][0]

        results = ferryhopper_integration._parse_solution(solution, sample_search_request)

        assert len(results) == 1
        result = results[0]

        # Adult price = 45.00 EUR (4500 cents)
        assert result.prices["adult"] == 45.0
        # Child price with 50% discount
        assert result.prices["child"] == 22.5
        # Infant price with 100% discount (free)
        assert result.prices["infant"] == 0.0

    def test_parse_solution_extracts_cabin_types(self, ferryhopper_integration, mock_search_response, sample_search_request):
        """Test that cabin types are correctly extracted."""
        solution = mock_search_response["bookingSolutions"][0]

        results = ferryhopper_integration._parse_solution(solution, sample_search_request)

        result = results[0]
        assert len(result.cabin_types) == 2

        deck = next(c for c in result.cabin_types if c["type"] == "DECK")
        assert deck["price"] == 45.0
        assert deck["name"] == "Deck Passage"

        cabin = next(c for c in result.cabin_types if c["type"] == "CABIN")
        assert cabin["price"] == 120.0
        assert cabin["name"] == "2-Bed Cabin"

    def test_parse_solution_extracts_route_info(self, ferryhopper_integration, mock_search_response, sample_search_request):
        """Test that route info is correctly extracted."""
        solution = mock_search_response["bookingSolutions"][0]

        results = ferryhopper_integration._parse_solution(solution, sample_search_request)

        result = results[0]
        route_info = result.route_info

        assert route_info["trip_type"] == "DIRECT"
        assert route_info["departure_port_name"] == "Athens (Piraeus)"
        assert route_info["arrival_port_name"] == "Santorini (Thira)"
        assert route_info["duration_hours"] == 8.0
        assert route_info["is_eticket"] is True
        assert route_info["boarding_method"] == "BOARDING_METHOD_ETICKET"
        assert route_info["operator_logo_url"] == "https://example.com/bluestar-logo.png"

    def test_parse_indirect_trip_with_connection(self, ferryhopper_integration, sample_search_request):
        """Test parsing indirect trip with connection info."""
        indirect_solution = {
            "trips": [
                {
                    "type": "INDIRECT",
                    "segments": [
                        {
                            "departurePort": {"code": "PIR", "name": "Athens"},
                            "arrivalPort": {"code": "NAX", "name": "Naxos"},
                            "departureDateTime": "2025-02-15T08:00:00+02:00",
                            "arrivalDateTime": "2025-02-15T12:00:00+02:00",
                            "ownerCompany": {"name": "Blue Star", "code": "BSF", "iconURL": ""},
                            "vessel": {"name": "Blue Star 1", "vesselID": "V1"},
                            "accommodations": [
                                {
                                    "type": "DECK",
                                    "code": "DK",
                                    "description": "Deck",
                                    "expectedPrice": {"totalPriceInCents": 3000, "currency": "EUR"},
                                    "availability": 100,
                                    "capacity": 1
                                }
                            ],
                            "discountRates": [],
                            "boardingMethod": {"key": "BOARDING_METHOD_ETICKET", "name": "E-Ticket"}
                        },
                        {
                            "departurePort": {"code": "NAX", "name": "Naxos"},
                            "arrivalPort": {"code": "JTR", "name": "Santorini"},
                            "departureDateTime": "2025-02-15T14:00:00+02:00",
                            "arrivalDateTime": "2025-02-15T16:00:00+02:00",
                            "ownerCompany": {"name": "Blue Star", "code": "BSF", "iconURL": ""},
                            "vessel": {"name": "Blue Star 2", "vesselID": "V2"},
                            "accommodations": [
                                {
                                    "type": "DECK",
                                    "code": "DK",
                                    "description": "Deck",
                                    "expectedPrice": {"totalPriceInCents": 2000, "currency": "EUR"},
                                    "availability": 100,
                                    "capacity": 1
                                }
                            ],
                            "discountRates": [],
                            "boardingMethod": {"key": "BOARDING_METHOD_ETICKET", "name": "E-Ticket"}
                        }
                    ]
                }
            ],
            "vehicles": []
        }

        results = ferryhopper_integration._parse_solution(indirect_solution, sample_search_request)

        assert len(results) == 2

        # First segment should have connection info
        first_segment = results[0]
        assert first_segment.route_info["trip_type"] == "INDIRECT"
        assert first_segment.route_info["total_segments"] == 2
        assert first_segment.route_info["segment_index"] == 1
        assert first_segment.route_info["connection_time_minutes"] == 120  # 2 hours
        assert first_segment.route_info["connection_port"] == "Naxos"

        # Second segment
        second_segment = results[1]
        assert second_segment.route_info["segment_index"] == 2


class TestFormatDuration:
    """Tests for duration formatting."""

    def test_format_duration_hours_and_minutes(self, ferryhopper_integration):
        """Test formatting duration with hours and minutes."""
        delta = timedelta(hours=8, minutes=30)

        result = ferryhopper_integration._format_duration(delta)

        assert result == "8h 30m"

    def test_format_duration_only_minutes(self, ferryhopper_integration):
        """Test formatting duration with only minutes."""
        delta = timedelta(minutes=45)

        result = ferryhopper_integration._format_duration(delta)

        assert result == "45m"

    def test_format_duration_zero(self, ferryhopper_integration):
        """Test formatting zero duration."""
        delta = timedelta(0)

        result = ferryhopper_integration._format_duration(delta)

        assert result == "0m"


class TestParseDatetime:
    """Tests for datetime parsing."""

    def test_parse_iso_with_timezone(self, ferryhopper_integration):
        """Test parsing ISO datetime with timezone."""
        dt_str = "2025-02-15T08:00:00+02:00"

        result = ferryhopper_integration._parse_datetime(dt_str)

        assert result is not None
        assert result.year == 2025
        assert result.month == 2
        assert result.day == 15
        assert result.hour == 8

    def test_parse_iso_without_timezone(self, ferryhopper_integration):
        """Test parsing ISO datetime without timezone."""
        dt_str = "2025-02-15T08:00:00"

        result = ferryhopper_integration._parse_datetime(dt_str)

        assert result is not None
        assert result.hour == 8

    def test_parse_iso_with_z_suffix(self, ferryhopper_integration):
        """Test parsing ISO datetime with Z suffix."""
        dt_str = "2025-02-15T08:00:00Z"

        result = ferryhopper_integration._parse_datetime(dt_str)

        assert result is not None

    def test_parse_empty_string(self, ferryhopper_integration):
        """Test parsing empty string returns None."""
        result = ferryhopper_integration._parse_datetime("")

        assert result is None

    def test_parse_invalid_string(self, ferryhopper_integration):
        """Test parsing invalid string returns None."""
        result = ferryhopper_integration._parse_datetime("not-a-date")

        assert result is None


class TestMapBookingStatus:
    """Tests for booking status mapping."""

    def test_map_pending_status(self, ferryhopper_integration):
        """Test mapping PENDING status."""
        result = ferryhopper_integration._map_booking_status("PENDING")
        assert result == "pending"

    def test_map_successful_status(self, ferryhopper_integration):
        """Test mapping SUCCESSFUL status."""
        result = ferryhopper_integration._map_booking_status("SUCCESSFUL")
        assert result == "confirmed"

    def test_map_failed_status(self, ferryhopper_integration):
        """Test mapping FAILED status."""
        result = ferryhopper_integration._map_booking_status("FAILED")
        assert result == "failed"

    def test_map_unknown_status(self, ferryhopper_integration):
        """Test mapping unknown status."""
        result = ferryhopper_integration._map_booking_status("SOMETHING_ELSE")
        assert result == "unknown"


class TestBuildBookingRequest:
    """Tests for booking request building."""

    def test_build_booking_request_basic(self, ferryhopper_integration, sample_booking_request, sample_solution_data):
        """Test building a basic booking request."""
        result = ferryhopper_integration._build_booking_request(sample_booking_request, sample_solution_data)

        assert result["language"] == "en"
        assert len(result["passengers"]) == 2
        assert result["contactDetails"]["email"] == "john.doe@example.com"
        assert result["contactDetails"]["phone"] == "+1234567890"

    def test_build_booking_request_passenger_details(self, ferryhopper_integration, sample_booking_request, sample_solution_data):
        """Test that passenger details are correctly built."""
        result = ferryhopper_integration._build_booking_request(sample_booking_request, sample_solution_data)

        pax1 = result["passengers"][0]
        assert pax1["firstName"] == "John"
        assert pax1["lastName"] == "Doe"
        assert pax1["sex"] == "MALE"
        assert pax1["ref"] == "PAX1"

        pax2 = result["passengers"][1]
        assert pax2["firstName"] == "Jane"
        assert pax2["lastName"] == "Doe"
        assert pax2["sex"] == "FEMALE"
        assert pax2["ref"] == "PAX2"


class TestExtractBoardingMethods:
    """Tests for boarding method extraction."""

    def test_extract_boarding_methods(self, ferryhopper_integration, mock_booking_status_response):
        """Test extracting boarding methods from booking response."""
        result = ferryhopper_integration._extract_boarding_methods(mock_booking_status_response)

        assert len(result) == 1
        assert result[0]["key"] == "BOARDING_METHOD_ETICKET"
        assert "url" in result[0]

    def test_extract_boarding_methods_empty(self, ferryhopper_integration):
        """Test extracting boarding methods from empty response."""
        result = ferryhopper_integration._extract_boarding_methods({"booking": {"segments": []}})

        assert result == []


class TestExtractSolutionVehicles:
    """Tests for vehicle extraction."""

    def test_extract_vehicles(self, ferryhopper_integration, mock_search_response):
        """Test extracting vehicles from solution."""
        solution = mock_search_response["bookingSolutions"][0]

        result = ferryhopper_integration._extract_solution_vehicles(solution)

        assert len(result) == 1
        assert result[0]["code"] == "CAR"
        assert result[0]["type"] == "CAR"
        assert result[0]["description"] == "Car up to 4.5m"

    def test_extract_vehicles_empty(self, ferryhopper_integration):
        """Test extracting vehicles when none present."""
        solution = {"vehicles": []}

        result = ferryhopper_integration._extract_solution_vehicles(solution)

        assert result == []


class TestSerializeAndReconstructFerryResult:
    """Tests for FerryResult serialization and reconstruction."""

    def test_serialize_ferry_result(self, ferryhopper_integration, mock_search_response, sample_search_request):
        """Test serializing FerryResult for caching."""
        solution = mock_search_response["bookingSolutions"][0]
        results = ferryhopper_integration._parse_solution(solution, sample_search_request)
        result = results[0]

        serialized = ferryhopper_integration._serialize_ferry_result(result)

        assert isinstance(serialized, dict)
        assert serialized["sailing_id"] == result.sailing_id
        assert serialized["operator"] == "Blue Star Ferries"
        assert "route_info" in serialized

    def test_reconstruct_ferry_result(self, ferryhopper_integration, mock_search_response, sample_search_request):
        """Test reconstructing FerryResult from cache."""
        solution = mock_search_response["bookingSolutions"][0]
        results = ferryhopper_integration._parse_solution(solution, sample_search_request)
        original = results[0]

        serialized = ferryhopper_integration._serialize_ferry_result(original)
        reconstructed = ferryhopper_integration._reconstruct_ferry_result(serialized)

        assert reconstructed is not None
        assert reconstructed.sailing_id == original.sailing_id
        assert reconstructed.operator == original.operator
        assert reconstructed.prices == original.prices

    def test_reconstruct_invalid_data(self, ferryhopper_integration):
        """Test reconstructing from invalid data returns None."""
        result = ferryhopper_integration._reconstruct_ferry_result({"invalid": "data"})

        assert result is None


# ============================================================================
# Async Method Tests (with mocking)
# ============================================================================

class TestSearchFerriesAsync:
    """Tests for async search_ferries method."""

    @pytest.mark.asyncio
    async def test_search_returns_results(self, ferryhopper_integration, mock_search_response, sample_search_request):
        """Test that search returns FerryResult objects."""
        # Mock the session and cache
        ferryhopper_integration.session = AsyncMock()
        ferryhopper_integration.session.post = AsyncMock()

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = mock_search_response
        ferryhopper_integration.session.post.return_value = mock_response

        # Mock cache to return None (cache miss)
        with patch('app.services.ferry_integrations.ferryhopper.cache_service') as mock_cache:
            mock_cache.get_ferryhopper_search.return_value = None
            mock_cache.set_ferryhopper_search.return_value = True

            # Mock port mapping
            ferryhopper_integration.mapping_service = MagicMock()

            results = await ferryhopper_integration.search_ferries(sample_search_request)

        assert len(results) > 0
        assert results[0].operator == "Blue Star Ferries"

    @pytest.mark.asyncio
    async def test_search_uses_cache(self, ferryhopper_integration, sample_search_request):
        """Test that search uses cache when available."""
        cached_data = {
            "results": [
                {
                    "sailing_id": "FH_cached_123",
                    "operator": "Cached Operator",
                    "departure_port": "PIR",
                    "arrival_port": "JTR",
                    "departure_time": "2025-02-15T08:00:00",
                    "arrival_time": "2025-02-15T16:00:00",
                    "vessel_name": "Cached Vessel",
                    "prices": {"adult": 50.0, "child": 25.0, "infant": 0.0},
                    "cabin_types": [],
                    "available_spaces": {}
                }
            ],
            "cached_at": datetime.now().isoformat()
        }

        with patch('app.services.ferry_integrations.ferryhopper.cache_service') as mock_cache:
            mock_cache.get_ferryhopper_search.return_value = cached_data

            # Mock port mapping
            ferryhopper_integration.mapping_service = MagicMock()

            results = await ferryhopper_integration.search_ferries(sample_search_request)

        # Should return cached results without calling API
        assert len(results) == 1
        assert results[0].sailing_id == "FH_cached_123"
        assert results[0].operator == "Cached Operator"

    @pytest.mark.asyncio
    async def test_search_handles_api_error(self, ferryhopper_integration, sample_search_request):
        """Test that search handles API errors gracefully."""
        ferryhopper_integration.session = AsyncMock()

        mock_response = MagicMock()
        mock_response.status_code = 401
        mock_response.text = "Unauthorized"
        mock_response.raise_for_status = MagicMock(side_effect=Exception("401 Unauthorized"))
        ferryhopper_integration.session.post.return_value = mock_response

        with patch('app.services.ferry_integrations.ferryhopper.cache_service') as mock_cache:
            mock_cache.get_ferryhopper_search.return_value = None
            ferryhopper_integration.mapping_service = MagicMock()

            with pytest.raises(FerryAPIError):
                await ferryhopper_integration.search_ferries(sample_search_request)


class TestCreateBookingAsync:
    """Tests for async create_booking method."""

    @pytest.mark.asyncio
    async def test_create_booking_two_step_flow(
        self,
        ferryhopper_integration,
        sample_booking_request,
        sample_solution_data,
        mock_booking_create_response,
        mock_booking_status_response
    ):
        """Test that booking follows two-step flow (create + confirm)."""
        ferryhopper_integration.session = AsyncMock()

        # Mock cache service to return solution data
        with patch('app.services.ferry_integrations.ferryhopper.cache_service') as mock_cache:
            mock_cache.get.return_value = sample_solution_data

            # Setup mock responses for different endpoints
            async def mock_post(url, json=None):
                mock_resp = MagicMock()
                mock_resp.status_code = 200
                if "/booking/confirm" in url:
                    mock_resp.json.return_value = {"status": "confirmed"}
                else:
                    mock_resp.json.return_value = mock_booking_create_response
                return mock_resp

            async def mock_get(url, params=None):
                mock_resp = MagicMock()
                mock_resp.status_code = 200
                mock_resp.json.return_value = mock_booking_status_response
                return mock_resp

            ferryhopper_integration.session.post = mock_post
            ferryhopper_integration.session.get = mock_get

            result = await ferryhopper_integration.create_booking(sample_booking_request)

            assert result.booking_reference == "BK-TEST-12345"
            assert result.status == "confirmed"
            assert result.total_amount == 135.0  # 13500 cents


class TestCancelBookingAsync:
    """Tests for async cancel_booking method."""

    @pytest.mark.asyncio
    async def test_cancel_booking_with_refund(self, ferryhopper_integration):
        """Test cancellation with refund estimation."""
        ferryhopper_integration.session = AsyncMock()

        refund_response = {
            "refundAmount": {
                "totalPriceInCents": 10000,
                "cancellationFee": 500,
                "currency": "EUR"
            }
        }

        async def mock_post(url, json=None):
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            if "estimate-refund" in url:
                mock_resp.json.return_value = refund_response
            else:
                mock_resp.json.return_value = {"success": True}
            return mock_resp

        ferryhopper_integration.session.post = mock_post

        result = await ferryhopper_integration.cancel_booking("BK-TEST-12345")

        assert result is True


class TestHealthCheckAsync:
    """Tests for async health_check method."""

    @pytest.mark.asyncio
    async def test_health_check_success(self, ferryhopper_integration):
        """Test health check returns True on success."""
        ferryhopper_integration.session = AsyncMock()

        mock_response = MagicMock()
        mock_response.status_code = 200
        ferryhopper_integration.session.get = AsyncMock(return_value=mock_response)

        result = await ferryhopper_integration.health_check()

        assert result is True

    @pytest.mark.asyncio
    async def test_health_check_failure(self, ferryhopper_integration):
        """Test health check returns False on failure."""
        ferryhopper_integration.session = AsyncMock()
        ferryhopper_integration.session.get = AsyncMock(side_effect=Exception("Connection failed"))

        result = await ferryhopper_integration.health_check()

        assert result is False


# ============================================================================
# Port Mapping Tests
# ============================================================================

class TestFerryHopperMappingService:
    """Tests for port mapping service."""

    def test_fallback_port_map_contains_common_ports(self):
        """Test that fallback map contains common Mediterranean ports."""
        assert "TUNIS" in FALLBACK_PORT_MAP
        assert "MARSEILLE" in FALLBACK_PORT_MAP
        assert "GENOA" in FALLBACK_PORT_MAP
        assert "PIRAEUS" in FALLBACK_PORT_MAP
        assert "SANTORINI" in FALLBACK_PORT_MAP

    def test_fallback_port_map_values(self):
        """Test fallback port map values."""
        assert FALLBACK_PORT_MAP["PIRAEUS"] == "PIR"
        assert FALLBACK_PORT_MAP["SANTORINI"] == "JTR"
        assert FALLBACK_PORT_MAP["TUNIS"] == "TUN"
        assert FALLBACK_PORT_MAP["MARSEILLE"] == "MRS"

    def test_reverse_port_map_exists(self):
        """Test that reverse port map exists and is populated."""
        assert len(REVERSE_PORT_MAP) > 0
        assert "PIR" in REVERSE_PORT_MAP
        assert REVERSE_PORT_MAP["PIR"] == "PIRAEUS"


class TestMapPortCode:
    """Tests for port code mapping method."""

    @pytest.mark.asyncio
    async def test_map_port_code_from_fallback(self, ferryhopper_integration):
        """Test port mapping uses fallback map."""
        result = await ferryhopper_integration._map_port_code("PIRAEUS")

        assert result == "PIR"

    @pytest.mark.asyncio
    async def test_map_port_code_case_insensitive(self, ferryhopper_integration):
        """Test port mapping is case insensitive."""
        result = await ferryhopper_integration._map_port_code("piraeus")

        assert result == "PIR"

    @pytest.mark.asyncio
    async def test_map_port_code_unknown(self, ferryhopper_integration):
        """Test mapping unknown port returns None."""
        ferryhopper_integration.mapping_service = None

        result = await ferryhopper_integration._map_port_code("UNKNOWN_PORT")

        assert result is None


# ============================================================================
# Integration with FerryService Tests
# ============================================================================

class TestFerryHopperInFerryService:
    """Tests for FerryHopper registration in FerryService."""

    def test_ferryhopper_in_operator_map(self):
        """Test that FerryHopper is in operator key map."""
        from app.services.ferry_service import FerryService

        assert "FerryHopper" in FerryService.OPERATOR_KEY_MAP
        assert FerryService.OPERATOR_KEY_MAP["FerryHopper"] == "ferryhopper"

    def test_ferryhopper_integration_imported(self):
        """Test that FerryHopper integration is imported in ferry_service."""
        from app.services.ferry_service import FerryHopperIntegration

        assert FerryHopperIntegration is not None
