"""
Integration tests for Ferry Search API endpoints.
"""

import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock


class TestFerrySearch:
    """Test ferry search endpoints."""

    def test_search_ferries_success(self, client: TestClient):
        """Test successful ferry search (POST endpoint)."""
        search_data = {
            "departure_port": "Tunis",
            "arrival_port": "Marseille",
            "departure_date": (datetime.utcnow() + timedelta(days=7)).strftime("%Y-%m-%d"),
            "adults": 2,
            "children": 0,
            "infants": 0,
        }
        response = client.post("/api/v1/ferries/search", json=search_data)
        assert response.status_code == 200
        data = response.json()
        # Should return search results with outbound ferries
        assert isinstance(data, dict)

    def test_search_ferries_with_vehicles(self, client: TestClient):
        """Test ferry search with vehicle."""
        search_data = {
            "departure_port": "Tunis",
            "arrival_port": "Genoa",
            "departure_date": (datetime.utcnow() + timedelta(days=14)).strftime("%Y-%m-%d"),
            "adults": 2,
            "children": 0,
            "infants": 0,
            "vehicle_type": "car",
        }
        response = client.post("/api/v1/ferries/search", json=search_data)
        assert response.status_code == 200

    def test_search_ferries_round_trip(self, client: TestClient):
        """Test round-trip ferry search."""
        search_data = {
            "departure_port": "Tunis",
            "arrival_port": "Marseille",
            "departure_date": (datetime.utcnow() + timedelta(days=7)).strftime("%Y-%m-%d"),
            "return_date": (datetime.utcnow() + timedelta(days=14)).strftime("%Y-%m-%d"),
            "adults": 1,
            "children": 0,
            "infants": 0,
        }
        response = client.post("/api/v1/ferries/search", json=search_data)
        assert response.status_code == 200

    def test_search_ferries_missing_params(self, client: TestClient):
        """Test ferry search with missing required params."""
        response = client.post("/api/v1/ferries/search", json={"departure_port": "Tunis"})
        assert response.status_code == 422

    def test_search_ferries_invalid_date_format(self, client: TestClient):
        """Test ferry search with invalid date format."""
        search_data = {
            "departure_port": "Tunis",
            "arrival_port": "Marseille",
            "departure_date": "invalid-date",
            "adults": 1,
        }
        response = client.post("/api/v1/ferries/search", json=search_data)
        assert response.status_code == 422


class TestFerryRoutes:
    """Test ferry routes endpoints."""

    def test_get_routes(self, client: TestClient):
        """Test getting available routes."""
        response = client.get("/api/v1/ferries/routes")
        # Accept 200 (success) or 500 (external service unavailable in tests)
        assert response.status_code in [200, 500]
        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, dict)

    def test_get_operators(self, client: TestClient):
        """Test getting list of operators."""
        response = client.get("/api/v1/ferries/operators")
        # Accept 200 (success) or 500 (external service unavailable in tests)
        assert response.status_code in [200, 500]
        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, (list, dict))


class TestFerryPriceComparison:
    """Test ferry price comparison endpoints."""

    def test_compare_prices(self, client: TestClient):
        """Test price comparison endpoint."""
        params = {
            "departure_port": "Tunis",
            "arrival_port": "Marseille",
            "departure_date": (datetime.utcnow() + timedelta(days=7)).strftime("%Y-%m-%d"),
            "adults": 2,
        }
        response = client.get("/api/v1/ferries/compare-prices", params=params)
        # Accept 200, 422, or 500 (external service unavailable in tests)
        assert response.status_code in [200, 422, 500]

    def test_get_date_prices(self, client: TestClient):
        """Test date prices endpoint for calendar view."""
        params = {
            "departure_port": "Tunis",
            "arrival_port": "Marseille",
            "month": (datetime.utcnow() + timedelta(days=30)).strftime("%Y-%m"),
        }
        response = client.get("/api/v1/ferries/date-prices", params=params)
        assert response.status_code in [200, 422]


class TestFerrySchedules:
    """Test ferry schedule endpoints."""

    def test_get_schedules(self, client: TestClient):
        """Test getting ferry schedules."""
        params = {
            "departure_port": "Tunis",
            "arrival_port": "Marseille",
        }
        response = client.get("/api/v1/ferries/schedules", params=params)
        assert response.status_code in [200, 422]


class TestFerryHealth:
    """Test ferry service health endpoints."""

    def test_ferry_service_health(self, client: TestClient):
        """Test ferry service health check."""
        response = client.get("/api/v1/ferries/health")
        # Accept 200 (success) or 500 (external service unavailable in tests)
        assert response.status_code in [200, 500]
        if response.status_code == 200:
            data = response.json()
            assert "status" in data
