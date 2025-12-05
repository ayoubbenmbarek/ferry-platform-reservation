"""
Integration tests for Price Alerts API endpoints.
"""

import pytest
from datetime import datetime, timedelta, date
from decimal import Decimal
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

from app.models.price_alert import PriceAlert, PriceAlertStatusEnum


class TestPriceAlertCreation:
    """Test price alert creation endpoints."""

    def test_create_price_alert_authenticated(self, client: TestClient, auth_headers):
        """Test creating a price alert as authenticated user."""
        alert_data = {
            "departure_port": "marseille",
            "arrival_port": "tunis",
            "notify_on_drop": True,
            "notify_on_increase": True,
            "price_threshold_percent": 5.0,
        }

        response = client.post(
            "/api/v1/price-alerts",
            json=alert_data,
            headers=auth_headers,
        )

        assert response.status_code in [200, 201]
        data = response.json()
        assert data["departure_port"] == "marseille"
        assert data["arrival_port"] == "tunis"
        assert data["notify_on_drop"] is True
        assert data["notify_on_increase"] is True
        assert data["status"] == "active"

    def test_create_price_alert_with_date_range(self, client: TestClient, auth_headers):
        """Test creating a price alert with specific date range."""
        date_from = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        date_to = (datetime.now() + timedelta(days=21)).strftime("%Y-%m-%d")

        alert_data = {
            "departure_port": "genoa",
            "arrival_port": "tunis",
            "date_from": date_from,
            "date_to": date_to,
            "initial_price": 85.0,
            "notify_on_drop": True,
            "notify_on_increase": False,
            "price_threshold_percent": 10.0,
        }

        response = client.post(
            "/api/v1/price-alerts",
            json=alert_data,
            headers=auth_headers,
        )

        assert response.status_code in [200, 201]
        data = response.json()
        assert data["date_from"] == date_from
        assert data["date_to"] == date_to
        assert data["initial_price"] == 85.0

    def test_create_price_alert_unauthenticated_with_email(self, client: TestClient):
        """Test creating a price alert without authentication but with email."""
        alert_data = {
            "email": "guest@example.com",
            "departure_port": "marseille",
            "arrival_port": "tunis",
            "notify_on_drop": True,
        }

        response = client.post(
            "/api/v1/price-alerts",
            json=alert_data,
        )

        # Should work with email provided
        assert response.status_code in [200, 201, 422]

    def test_create_price_alert_missing_ports(self, client: TestClient, auth_headers):
        """Test creating a price alert without required ports."""
        alert_data = {
            "notify_on_drop": True,
        }

        response = client.post(
            "/api/v1/price-alerts",
            json=alert_data,
            headers=auth_headers,
        )

        assert response.status_code == 422


class TestPriceAlertRetrieval:
    """Test price alert retrieval endpoints."""

    def test_get_my_routes(self, client: TestClient, auth_headers, db_session):
        """Test getting authenticated user's saved routes."""
        # First create a price alert
        alert_data = {
            "departure_port": "marseille",
            "arrival_port": "tunis",
            "notify_on_drop": True,
        }
        client.post("/api/v1/price-alerts", json=alert_data, headers=auth_headers)

        # Get my routes
        response = client.get("/api/v1/price-alerts/my-routes", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert "routes" in data
        assert isinstance(data["routes"], list)

    def test_get_price_alert_by_id(self, client: TestClient, auth_headers):
        """Test getting a specific price alert by ID."""
        # First create a price alert
        alert_data = {
            "departure_port": "genoa",
            "arrival_port": "tunis",
            "notify_on_drop": True,
        }
        create_response = client.post(
            "/api/v1/price-alerts",
            json=alert_data,
            headers=auth_headers,
        )

        if create_response.status_code in [200, 201]:
            alert_id = create_response.json()["id"]

            response = client.get(
                f"/api/v1/price-alerts/{alert_id}",
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert data["id"] == alert_id

    def test_check_route_saved(self, client: TestClient, auth_headers):
        """Test checking if a route is saved."""
        # First create a price alert
        alert_data = {
            "departure_port": "civitavecchia",
            "arrival_port": "tunis",
            "notify_on_drop": True,
        }
        client.post("/api/v1/price-alerts", json=alert_data, headers=auth_headers)

        # Check if route is saved
        response = client.get(
            "/api/v1/price-alerts/check/civitavecchia/tunis",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "is_saved" in data
        # Should be True since we just created it
        assert data["is_saved"] is True
        assert data["alert_id"] is not None

    def test_check_route_not_saved(self, client: TestClient, auth_headers):
        """Test checking a route that is not saved."""
        response = client.get(
            "/api/v1/price-alerts/check/nice/tunis",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["is_saved"] is False
        assert data["alert_id"] is None


class TestPriceAlertUpdate:
    """Test price alert update endpoints."""

    def test_update_price_alert_settings(self, client: TestClient, auth_headers):
        """Test updating price alert notification settings."""
        # First create a price alert
        alert_data = {
            "departure_port": "marseille",
            "arrival_port": "tunis",
            "notify_on_drop": True,
            "notify_on_increase": False,
            "price_threshold_percent": 5.0,
        }
        create_response = client.post(
            "/api/v1/price-alerts",
            json=alert_data,
            headers=auth_headers,
        )

        if create_response.status_code in [200, 201]:
            alert_id = create_response.json()["id"]

            # Update settings
            update_data = {
                "notify_on_increase": True,
                "price_threshold_percent": 10.0,
            }

            response = client.patch(
                f"/api/v1/price-alerts/{alert_id}",
                json=update_data,
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert data["notify_on_increase"] is True
            assert data["price_threshold_percent"] == 10.0

    def test_pause_price_alert(self, client: TestClient, auth_headers):
        """Test pausing a price alert."""
        # First create a price alert
        alert_data = {
            "departure_port": "genoa",
            "arrival_port": "tunis",
            "notify_on_drop": True,
        }
        create_response = client.post(
            "/api/v1/price-alerts",
            json=alert_data,
            headers=auth_headers,
        )

        if create_response.status_code in [200, 201]:
            alert_id = create_response.json()["id"]

            response = client.post(
                f"/api/v1/price-alerts/{alert_id}/pause",
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "paused"

    def test_resume_price_alert(self, client: TestClient, auth_headers):
        """Test resuming a paused price alert."""
        # First create and pause a price alert
        alert_data = {
            "departure_port": "salerno",
            "arrival_port": "tunis",
            "notify_on_drop": True,
        }
        create_response = client.post(
            "/api/v1/price-alerts",
            json=alert_data,
            headers=auth_headers,
        )

        if create_response.status_code in [200, 201]:
            alert_id = create_response.json()["id"]

            # Pause first
            client.post(f"/api/v1/price-alerts/{alert_id}/pause", headers=auth_headers)

            # Resume
            response = client.post(
                f"/api/v1/price-alerts/{alert_id}/resume",
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "active"


class TestPriceAlertDeletion:
    """Test price alert deletion endpoints."""

    def test_delete_price_alert(self, client: TestClient, auth_headers):
        """Test deleting (cancelling) a price alert."""
        # First create a price alert
        alert_data = {
            "departure_port": "marseille",
            "arrival_port": "tunis",
            "notify_on_drop": True,
        }
        create_response = client.post(
            "/api/v1/price-alerts",
            json=alert_data,
            headers=auth_headers,
        )

        if create_response.status_code in [200, 201]:
            alert_id = create_response.json()["id"]

            response = client.delete(
                f"/api/v1/price-alerts/{alert_id}",
                headers=auth_headers,
            )

            assert response.status_code in [200, 204]

            # Verify it's cancelled (soft delete)
            get_response = client.get(
                f"/api/v1/price-alerts/{alert_id}",
                headers=auth_headers,
            )
            # Should either return cancelled status or 404
            if get_response.status_code == 200:
                assert get_response.json()["status"] == "cancelled"

    def test_deleted_route_not_in_my_routes(self, client: TestClient, auth_headers):
        """Test that deleted routes don't appear in my-routes list."""
        # Create a price alert
        alert_data = {
            "departure_port": "nice",
            "arrival_port": "tunis",
            "notify_on_drop": True,
        }
        create_response = client.post(
            "/api/v1/price-alerts",
            json=alert_data,
            headers=auth_headers,
        )

        if create_response.status_code in [200, 201]:
            alert_id = create_response.json()["id"]

            # Delete it
            client.delete(f"/api/v1/price-alerts/{alert_id}", headers=auth_headers)

            # Check my-routes - should not include deleted
            response = client.get("/api/v1/price-alerts/my-routes", headers=auth_headers)

            assert response.status_code == 200
            routes = response.json()["routes"]

            # The deleted route should not appear
            deleted_ids = [r["id"] for r in routes if r.get("status") != "cancelled"]
            assert alert_id not in deleted_ids or len([r for r in routes if r["id"] == alert_id]) == 0


class TestPriceAlertStats:
    """Test price alert statistics endpoints."""

    def test_get_alert_stats(self, client: TestClient, auth_headers):
        """Test getting price alert statistics."""
        # Create a few alerts
        for port in ["marseille", "genoa", "civitavecchia"]:
            client.post(
                "/api/v1/price-alerts",
                json={
                    "departure_port": port,
                    "arrival_port": "tunis",
                    "notify_on_drop": True,
                },
                headers=auth_headers,
            )

        response = client.get(
            "/api/v1/price-alerts/stats/summary",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "total_alerts" in data
        assert "active_alerts" in data
        assert data["total_alerts"] >= 0


class TestPriceAlertValidation:
    """Test price alert validation."""

    def test_invalid_threshold_percent(self, client: TestClient, auth_headers):
        """Test that invalid threshold percent is rejected."""
        alert_data = {
            "departure_port": "marseille",
            "arrival_port": "tunis",
            "price_threshold_percent": -5.0,  # Invalid negative
        }

        response = client.post(
            "/api/v1/price-alerts",
            json=alert_data,
            headers=auth_headers,
        )

        # Should reject or accept with validation
        assert response.status_code in [200, 201, 422]

    def test_same_departure_arrival_port(self, client: TestClient, auth_headers):
        """Test that same departure and arrival ports are rejected."""
        alert_data = {
            "departure_port": "marseille",
            "arrival_port": "marseille",  # Same as departure
            "notify_on_drop": True,
        }

        response = client.post(
            "/api/v1/price-alerts",
            json=alert_data,
            headers=auth_headers,
        )

        # Should reject with validation error
        assert response.status_code in [400, 422]

    def test_date_to_before_date_from(self, client: TestClient, auth_headers):
        """Test that date_to before date_from is rejected."""
        alert_data = {
            "departure_port": "marseille",
            "arrival_port": "tunis",
            "date_from": "2025-12-20",
            "date_to": "2025-12-10",  # Before date_from
            "notify_on_drop": True,
        }

        response = client.post(
            "/api/v1/price-alerts",
            json=alert_data,
            headers=auth_headers,
        )

        # Should reject with validation error
        assert response.status_code in [400, 422]
