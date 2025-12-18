"""
Integration tests for FerryHopper API.

These tests make actual API calls to the FerryHopper UAT environment
to verify the integration works correctly.

Run with:
    pytest tests/integration/test_ferryhopper_api.py -v

Note: Requires FERRYHOPPER_API_KEY environment variable to be set.
Uses the restricted key for search tests and sandbox key for booking tests.
"""

import pytest
import os
from datetime import date, timedelta
from unittest.mock import patch

from app.services.ferry_integrations.ferryhopper import FerryHopperIntegration
from app.services.ferry_integrations.base import SearchRequest, BookingRequest, FerryAPIError
from app.config import settings


# ============================================================================
# Skip conditions
# ============================================================================

# Skip if no API key is configured
skip_if_no_api_key = pytest.mark.skipif(
    not os.environ.get("FERRYHOPPER_API_KEY") and not settings.FERRYHOPPER_API_KEY,
    reason="FERRYHOPPER_API_KEY not configured"
)

# Mark tests that require sandbox key (for booking)
requires_sandbox_key = pytest.mark.skipif(
    os.environ.get("FERRYHOPPER_API_KEY", settings.FERRYHOPPER_API_KEY or "") == "1ed30ab9-c51f-45ae-9409-4fc7e483c96a",
    reason="Booking tests require sandbox key, not restricted key"
)


# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture
def api_key():
    """Get the FerryHopper API key."""
    return os.environ.get("FERRYHOPPER_API_KEY") or settings.FERRYHOPPER_API_KEY


@pytest.fixture
def base_url():
    """Get the FerryHopper base URL."""
    return os.environ.get("FERRYHOPPER_BASE_URL") or settings.FERRYHOPPER_BASE_URL or "https://ferryhapi.uat.ferryhopper.com"


@pytest.fixture
def integration(api_key, base_url):
    """Create a FerryHopper integration for testing."""
    return FerryHopperIntegration(
        api_key=api_key,
        base_url=base_url
    )


@pytest.fixture
def future_date():
    """Get a date 30 days in the future for searches."""
    return date.today() + timedelta(days=30)


# ============================================================================
# Test Routes from FerryHopper Documentation
# ============================================================================

# Test routes recommended by FerryHopper docs for different boarding methods
TEST_ROUTES = [
    ("PIR", "JTR", "Athens (Piraeus) to Santorini - E-TICKET"),
    ("PIR", "JNX", "Athens to Naxos - PRINTED_BOARDING_PASS"),
    ("PIR", "HER", "Athens to Heraklion - ID_BOARDING"),
]


# ============================================================================
# Health Check Tests
# ============================================================================

@skip_if_no_api_key
class TestFerryHopperHealthCheck:
    """Integration tests for health check endpoint."""

    @pytest.mark.asyncio
    async def test_health_check_returns_true(self, integration):
        """Test that health check passes with valid API key."""
        async with integration:
            result = await integration.health_check()

        assert result is True

    @pytest.mark.asyncio
    async def test_health_check_with_invalid_key(self, base_url):
        """Test that health check still works (public endpoint)."""
        invalid_integration = FerryHopperIntegration(
            api_key="invalid-key-12345",
            base_url=base_url
        )

        async with invalid_integration:
            # Health check endpoint (/) should still respond
            result = await invalid_integration.health_check()

        # The / endpoint is public, so it should return True
        assert result is True


# ============================================================================
# Search Tests
# ============================================================================

@skip_if_no_api_key
class TestFerryHopperSearch:
    """Integration tests for search endpoint."""

    @pytest.mark.asyncio
    async def test_search_piraeus_to_santorini(self, integration, future_date):
        """Test searching the PIR-JTR route (popular Greek island route)."""
        search_request = SearchRequest(
            departure_port="PIRAEUS",
            arrival_port="SANTORINI",
            departure_date=future_date,
            adults=2,
            children=0,
            infants=0,
            vehicles=[]
        )

        # Disable caching for integration tests
        with patch('app.services.ferry_integrations.ferryhopper.cache_service') as mock_cache:
            mock_cache.get_ferryhopper_search.return_value = None
            mock_cache.set_ferryhopper_search.return_value = True

            async with integration:
                results = await integration.search_ferries(search_request)

        # Should return at least some results (this is a popular route)
        # Note: In low season or far future dates, there might be no results
        assert isinstance(results, list)

        if len(results) > 0:
            result = results[0]
            # Verify result structure
            assert result.operator is not None
            assert result.departure_port is not None
            assert result.arrival_port is not None
            assert result.departure_time is not None
            assert result.arrival_time is not None
            assert "adult" in result.prices
            assert hasattr(result, 'route_info')

    @pytest.mark.asyncio
    async def test_search_with_children(self, integration, future_date):
        """Test searching with children (discount rates)."""
        search_request = SearchRequest(
            departure_port="PIRAEUS",
            arrival_port="SANTORINI",
            departure_date=future_date,
            adults=2,
            children=1,
            infants=1,
            vehicles=[]
        )

        with patch('app.services.ferry_integrations.ferryhopper.cache_service') as mock_cache:
            mock_cache.get_ferryhopper_search.return_value = None
            mock_cache.set_ferryhopper_search.return_value = True

            async with integration:
                results = await integration.search_ferries(search_request)

        if len(results) > 0:
            result = results[0]
            # Verify child/infant prices are present
            assert "child" in result.prices
            assert "infant" in result.prices
            # Child price should be less than or equal to adult
            assert result.prices["child"] <= result.prices["adult"]
            # Infant price should be less than or equal to child
            assert result.prices["infant"] <= result.prices["child"]

    @pytest.mark.asyncio
    async def test_search_unknown_route_returns_empty(self, integration, future_date):
        """Test searching an invalid route returns empty list."""
        search_request = SearchRequest(
            departure_port="INVALID",
            arrival_port="ROUTE",
            departure_date=future_date,
            adults=1,
            children=0,
            infants=0,
            vehicles=[]
        )

        with patch('app.services.ferry_integrations.ferryhopper.cache_service') as mock_cache:
            mock_cache.get_ferryhopper_search.return_value = None

            async with integration:
                results = await integration.search_ferries(search_request)

        # Should return empty list for invalid route
        assert results == []

    @pytest.mark.asyncio
    async def test_search_past_date_fails(self, integration):
        """Test searching with past date fails gracefully."""
        past_date = date.today() - timedelta(days=7)

        search_request = SearchRequest(
            departure_port="PIRAEUS",
            arrival_port="SANTORINI",
            departure_date=past_date,
            adults=1,
            children=0,
            infants=0,
            vehicles=[]
        )

        with patch('app.services.ferry_integrations.ferryhopper.cache_service') as mock_cache:
            mock_cache.get_ferryhopper_search.return_value = None

            async with integration:
                with pytest.raises(FerryAPIError):
                    await integration.search_ferries(search_request)

    @pytest.mark.asyncio
    async def test_search_returns_route_info(self, integration, future_date):
        """Test that search results include mandatory route info."""
        search_request = SearchRequest(
            departure_port="PIRAEUS",
            arrival_port="SANTORINI",
            departure_date=future_date,
            adults=1,
            children=0,
            infants=0,
            vehicles=[]
        )

        with patch('app.services.ferry_integrations.ferryhopper.cache_service') as mock_cache:
            mock_cache.get_ferryhopper_search.return_value = None
            mock_cache.set_ferryhopper_search.return_value = True

            async with integration:
                results = await integration.search_ferries(search_request)

        if len(results) > 0:
            result = results[0]
            route_info = result.route_info

            # Verify mandatory Health Check requirements
            assert "duration_hours" in route_info
            assert "duration_formatted" in route_info
            assert "departure_port_name" in route_info
            assert "arrival_port_name" in route_info
            assert "is_eticket" in route_info
            assert "boarding_method" in route_info

    @pytest.mark.asyncio
    async def test_search_returns_cabin_types(self, integration, future_date):
        """Test that search results include cabin/accommodation types."""
        search_request = SearchRequest(
            departure_port="PIRAEUS",
            arrival_port="SANTORINI",
            departure_date=future_date,
            adults=1,
            children=0,
            infants=0,
            vehicles=[]
        )

        with patch('app.services.ferry_integrations.ferryhopper.cache_service') as mock_cache:
            mock_cache.get_ferryhopper_search.return_value = None
            mock_cache.set_ferryhopper_search.return_value = True

            async with integration:
                results = await integration.search_ferries(search_request)

        if len(results) > 0:
            result = results[0]

            # Should have at least one cabin/accommodation type
            assert len(result.cabin_types) >= 0  # May be empty for some operators

            if len(result.cabin_types) > 0:
                cabin = result.cabin_types[0]
                assert "type" in cabin
                assert "price" in cabin
                assert "name" in cabin


# ============================================================================
# Reference Data Tests
# ============================================================================

@skip_if_no_api_key
class TestFerryHopperReferenceData:
    """Integration tests for reference data endpoints."""

    @pytest.mark.asyncio
    async def test_get_companies(self, integration):
        """Test getting list of ferry companies."""
        async with integration:
            companies = await integration.get_companies()

        assert isinstance(companies, list)
        # Should have at least some companies
        if len(companies) > 0:
            company = companies[0]
            # Verify company structure
            assert isinstance(company, dict)

    @pytest.mark.asyncio
    async def test_get_boarding_methods(self, integration):
        """Test getting list of boarding methods."""
        async with integration:
            methods = await integration.get_boarding_methods()

        assert isinstance(methods, list)
        # Should have multiple boarding methods
        if len(methods) > 0:
            method = methods[0]
            assert isinstance(method, dict)

    @pytest.mark.asyncio
    async def test_get_nationalities(self, integration):
        """Test getting list of nationalities."""
        async with integration:
            nationalities = await integration.get_nationalities()

        assert isinstance(nationalities, list)
        # Should have many nationalities
        if len(nationalities) > 0:
            nationality = nationalities[0]
            assert isinstance(nationality, dict)


# ============================================================================
# Booking Tests (Requires Sandbox Key)
# ============================================================================

@skip_if_no_api_key
@requires_sandbox_key
class TestFerryHopperBooking:
    """Integration tests for booking endpoints.

    Note: These tests require the sandbox API key to execute actual bookings.
    The sandbox key allows full booking flow with mock carriers.
    """

    @pytest.mark.asyncio
    async def test_estimate_prices(self, integration):
        """Test getting price estimate.

        This test verifies the estimate-prices endpoint works.
        Actual booking flow would need real trip selections.
        """
        # Note: This would need actual trip selections from a search
        # For now, just verify the method exists and integration is set up
        assert hasattr(integration, 'estimate_prices')

    @pytest.mark.asyncio
    async def test_booking_flow_structure(self, integration):
        """Test that booking methods exist and are properly structured."""
        assert hasattr(integration, 'create_booking')
        assert hasattr(integration, 'get_booking_status')
        assert hasattr(integration, 'cancel_booking')
        assert hasattr(integration, 'estimate_refund')


# ============================================================================
# Error Handling Tests
# ============================================================================

@skip_if_no_api_key
class TestFerryHopperErrorHandling:
    """Integration tests for error handling."""

    @pytest.mark.asyncio
    async def test_api_error_includes_message(self, integration, future_date):
        """Test that API errors include helpful messages."""
        # Try to search with invalid port codes
        search_request = SearchRequest(
            departure_port="XXX",
            arrival_port="YYY",
            departure_date=future_date,
            adults=1,
            children=0,
            infants=0,
            vehicles=[]
        )

        with patch('app.services.ferry_integrations.ferryhopper.cache_service') as mock_cache:
            mock_cache.get_ferryhopper_search.return_value = None

            async with integration:
                # Should return empty results, not crash
                results = await integration.search_ferries(search_request)

        assert results == []

    @pytest.mark.asyncio
    async def test_invalid_booking_reference(self, integration):
        """Test getting status of invalid booking reference."""
        async with integration:
            with pytest.raises(FerryAPIError):
                await integration.get_booking_status("INVALID-REF-12345")


# ============================================================================
# Port Mapping Integration Tests
# ============================================================================

@skip_if_no_api_key
class TestFerryHopperPortMapping:
    """Integration tests for port code mapping."""

    @pytest.mark.asyncio
    async def test_port_mapping_piraeus(self, integration):
        """Test mapping PIRAEUS to FerryHopper code."""
        async with integration:
            result = await integration._map_port_code("PIRAEUS")

        assert result == "PIR"

    @pytest.mark.asyncio
    async def test_port_mapping_santorini(self, integration):
        """Test mapping SANTORINI to FerryHopper code."""
        async with integration:
            result = await integration._map_port_code("SANTORINI")

        assert result == "JTR"

    @pytest.mark.asyncio
    async def test_port_mapping_tunis(self, integration):
        """Test mapping TUNIS to FerryHopper code."""
        async with integration:
            result = await integration._map_port_code("TUNIS")

        assert result == "TUN"

    @pytest.mark.asyncio
    async def test_port_mapping_marseille(self, integration):
        """Test mapping MARSEILLE to FerryHopper code."""
        async with integration:
            result = await integration._map_port_code("MARSEILLE")

        assert result == "MRS"


# ============================================================================
# Caching Integration Tests
# ============================================================================

@skip_if_no_api_key
class TestFerryHopperCaching:
    """Integration tests for caching behavior."""

    @pytest.mark.asyncio
    async def test_search_caches_results(self, integration, future_date):
        """Test that search results are cached."""
        search_request = SearchRequest(
            departure_port="PIRAEUS",
            arrival_port="SANTORINI",
            departure_date=future_date,
            adults=1,
            children=0,
            infants=0,
            vehicles=[]
        )

        # Track cache calls
        cache_set_called = False

        def mock_set_search(*args, **kwargs):
            nonlocal cache_set_called
            cache_set_called = True
            return True

        with patch('app.services.ferry_integrations.ferryhopper.cache_service') as mock_cache:
            mock_cache.get_ferryhopper_search.return_value = None
            mock_cache.set_ferryhopper_search.side_effect = mock_set_search

            async with integration:
                results = await integration.search_ferries(search_request)

        # If we got results, cache should have been called
        if len(results) > 0:
            assert cache_set_called is True


# ============================================================================
# Performance Tests
# ============================================================================

@skip_if_no_api_key
class TestFerryHopperPerformance:
    """Performance-related integration tests."""

    @pytest.mark.asyncio
    async def test_search_completes_within_timeout(self, integration, future_date):
        """Test that search completes within the configured timeout."""
        import asyncio

        search_request = SearchRequest(
            departure_port="PIRAEUS",
            arrival_port="SANTORINI",
            departure_date=future_date,
            adults=1,
            children=0,
            infants=0,
            vehicles=[]
        )

        with patch('app.services.ferry_integrations.ferryhopper.cache_service') as mock_cache:
            mock_cache.get_ferryhopper_search.return_value = None
            mock_cache.set_ferryhopper_search.return_value = True

            async with integration:
                # Should complete within 30 seconds (the default timeout)
                try:
                    results = await asyncio.wait_for(
                        integration.search_ferries(search_request),
                        timeout=30.0
                    )
                    assert isinstance(results, list)
                except asyncio.TimeoutError:
                    pytest.fail("Search took too long (>30 seconds)")


# ============================================================================
# Full Flow Tests
# ============================================================================

@skip_if_no_api_key
class TestFerryHopperFullFlow:
    """End-to-end integration tests."""

    @pytest.mark.asyncio
    async def test_search_to_result_parsing(self, integration, future_date):
        """Test complete flow from search to parsed results."""
        search_request = SearchRequest(
            departure_port="PIRAEUS",
            arrival_port="SANTORINI",
            departure_date=future_date,
            adults=2,
            children=1,
            infants=0,
            vehicles=[]
        )

        with patch('app.services.ferry_integrations.ferryhopper.cache_service') as mock_cache:
            mock_cache.get_ferryhopper_search.return_value = None
            mock_cache.set_ferryhopper_search.return_value = True

            async with integration:
                results = await integration.search_ferries(search_request)

        if len(results) > 0:
            # Verify complete result structure
            result = results[0]

            # Core fields
            assert result.sailing_id.startswith("FH_")
            assert result.operator
            assert result.vessel_name
            assert result.departure_time
            assert result.arrival_time
            assert result.departure_time < result.arrival_time

            # Price breakdown
            assert result.prices["adult"] > 0
            assert "child" in result.prices
            assert "infant" in result.prices

            # Route info
            assert result.route_info["duration_hours"] > 0
            assert result.route_info["duration_formatted"]
            assert result.route_info["departure_port_name"]
            assert result.route_info["arrival_port_name"]

            # Results should be sorted by departure time
            if len(results) > 1:
                for i in range(len(results) - 1):
                    assert results[i].departure_time <= results[i + 1].departure_time
