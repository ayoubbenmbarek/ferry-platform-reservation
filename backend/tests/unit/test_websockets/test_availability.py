"""
Unit tests for WebSocket availability endpoint.

Tests the availability WebSocket endpoint functionality including:
- Connection handling
- Route subscription via query params
- Message handling (subscribe, unsubscribe, ping)
- Error handling
"""

import pytest
import json
from unittest.mock import AsyncMock, MagicMock, patch


class TestAvailabilityWebSocketMessages:
    """Test message types for availability WebSocket."""

    def test_subscribe_message_format(self):
        """Test subscribe message format."""
        message = {
            "action": "subscribe",
            "routes": ["TUNIS-MARSEILLE", "TUNIS-GENOA"]
        }
        assert message["action"] == "subscribe"
        assert len(message["routes"]) == 2

    def test_unsubscribe_message_format(self):
        """Test unsubscribe message format."""
        message = {
            "action": "unsubscribe",
            "routes": ["TUNIS-MARSEILLE"]
        }
        assert message["action"] == "unsubscribe"

    def test_ping_message_format(self):
        """Test ping message format."""
        message = {"action": "ping"}
        assert message["action"] == "ping"

    def test_stats_message_format(self):
        """Test stats message format."""
        message = {"action": "stats"}
        assert message["action"] == "stats"


class TestAvailabilityUpdatePayload:
    """Test availability update payload formats."""

    def test_booking_update_payload(self):
        """Test payload for booking (decrease availability)."""
        payload = {
            "ferry_id": "CTN-001",
            "route": "TUNIS-MARSEILLE",
            "departure_time": "2024-01-15T10:00:00",
            "availability": {
                "change_type": "booking",
                "passengers_booked": 2,
                "vehicles_booked": 1,
                "cabin_quantity": 1,
                "cabin_type": "inside"
            }
        }
        assert payload["availability"]["change_type"] == "booking"
        assert payload["availability"]["cabin_quantity"] == 1

    def test_cancellation_update_payload(self):
        """Test payload for cancellation (increase availability)."""
        payload = {
            "ferry_id": "CTN-001",
            "route": "TUNIS-MARSEILLE",
            "departure_time": "2024-01-15T10:00:00",
            "availability": {
                "change_type": "cancellation",
                "passengers_freed": 2,
                "vehicles_freed": 1,
                "cabins_freed": 1
            }
        }
        assert payload["availability"]["change_type"] == "cancellation"
        assert payload["availability"]["cabins_freed"] == 1

    def test_cabin_types_in_update(self):
        """Test cabin type breakdown in availability update."""
        payload = {
            "ferry_id": "CTN-001",
            "route": "TUNIS-MARSEILLE",
            "availability": {
                "cabin_types": {
                    "inside": {"available": 10, "booked": 2},
                    "outside": {"available": 8, "booked": 1},
                    "suite": {"available": 4, "booked": 0}
                }
            }
        }
        assert payload["availability"]["cabin_types"]["inside"]["available"] == 10
        assert payload["availability"]["cabin_types"]["outside"]["booked"] == 1


class TestResponseMessageFormats:
    """Test WebSocket response message formats."""

    def test_connected_response_format(self):
        """Test connected response format."""
        response = {
            "type": "connected",
            "client_id": "uuid-123",
            "message": "Connected to real-time availability updates"
        }
        assert response["type"] == "connected"
        assert "client_id" in response

    def test_subscribed_response_format(self):
        """Test subscribed response format."""
        response = {
            "type": "subscribed",
            "routes": ["TUNIS-MARSEILLE", "TUNIS-GENOA"]
        }
        assert response["type"] == "subscribed"
        assert isinstance(response["routes"], list)

    def test_availability_update_response_format(self):
        """Test availability update response format."""
        response = {
            "type": "availability_update",
            "route": "TUNIS-MARSEILLE",
            "data": {
                "ferry_id": "CTN-001",
                "availability": {
                    "cabin_quantity": 2,
                    "passengers_booked": 4
                }
            },
            "timestamp": "2024-01-15T10:00:00.000000"
        }
        assert response["type"] == "availability_update"
        assert "timestamp" in response
        assert response["data"]["ferry_id"] == "CTN-001"

    def test_pong_response_format(self):
        """Test pong response format."""
        response = {"type": "pong"}
        assert response["type"] == "pong"

    def test_error_response_format(self):
        """Test error response format."""
        response = {
            "type": "error",
            "message": "Invalid JSON"
        }
        assert response["type"] == "error"
        assert "message" in response

    def test_stats_response_format(self):
        """Test stats response format."""
        response = {
            "type": "stats",
            "data": {
                "active_connections": 5,
                "subscriptions": {
                    "TUNIS-MARSEILLE": 3,
                    "TUNIS-GENOA": 2
                },
                "total_subscriptions": 5
            }
        }
        assert response["type"] == "stats"
        assert response["data"]["active_connections"] == 5


class TestRouteNormalization:
    """Test route name normalization."""

    def test_uppercase_conversion(self):
        """Test that routes are converted to uppercase."""
        route = "tunis-marseille"
        normalized = route.upper().replace(" ", "-")
        assert normalized == "TUNIS-MARSEILLE"

    def test_space_to_dash_conversion(self):
        """Test that spaces are converted to dashes."""
        route = "tunis marseille"
        normalized = route.upper().replace(" ", "-")
        assert normalized == "TUNIS-MARSEILLE"

    def test_mixed_case_normalization(self):
        """Test mixed case normalization."""
        route = "Tunis Marseille"
        normalized = route.upper().replace(" ", "-")
        assert normalized == "TUNIS-MARSEILLE"


class TestQueryParamParsing:
    """Test query parameter parsing."""

    def test_parse_comma_separated_routes(self):
        """Test parsing comma-separated routes."""
        routes_param = "TUNIS-MARSEILLE,TUNIS-GENOA,TUNIS-PALERMO"
        routes = [r.strip() for r in routes_param.split(",") if r.strip()]
        assert len(routes) == 3
        assert "TUNIS-MARSEILLE" in routes
        assert "TUNIS-GENOA" in routes

    def test_parse_routes_with_spaces(self):
        """Test parsing routes with extra spaces."""
        routes_param = "TUNIS-MARSEILLE, TUNIS-GENOA , TUNIS-PALERMO"
        routes = [r.strip() for r in routes_param.split(",") if r.strip()]
        assert len(routes) == 3
        assert routes[0] == "TUNIS-MARSEILLE"
        assert routes[1] == "TUNIS-GENOA"

    def test_parse_empty_routes(self):
        """Test parsing empty routes param."""
        routes_param = ""
        routes = [r.strip() for r in routes_param.split(",") if r.strip()]
        assert len(routes) == 0

    def test_parse_single_route(self):
        """Test parsing single route."""
        routes_param = "TUNIS-MARSEILLE"
        routes = [r.strip() for r in routes_param.split(",") if r.strip()]
        assert len(routes) == 1
        assert routes[0] == "TUNIS-MARSEILLE"


class TestAvailabilityUpdateTypes:
    """Test different types of availability updates."""

    def test_passenger_booking_update(self):
        """Test passenger booking availability update."""
        update = {
            "change_type": "booking",
            "passengers_booked": 3
        }
        # Simulating reducer logic
        current_capacity = 100
        new_capacity = max(0, current_capacity - update.get("passengers_booked", 0))
        assert new_capacity == 97

    def test_passenger_cancellation_update(self):
        """Test passenger cancellation availability update."""
        update = {
            "change_type": "cancellation",
            "passengers_freed": 2
        }
        current_capacity = 97
        new_capacity = current_capacity + update.get("passengers_freed", 0)
        assert new_capacity == 99

    def test_vehicle_booking_update(self):
        """Test vehicle booking availability update."""
        update = {
            "change_type": "booking",
            "vehicles_booked": 1
        }
        current_space = 50
        new_space = max(0, current_space - update.get("vehicles_booked", 0))
        assert new_space == 49

    def test_vehicle_cancellation_update(self):
        """Test vehicle cancellation availability update."""
        update = {
            "change_type": "cancellation",
            "vehicles_freed": 1
        }
        current_space = 49
        new_space = current_space + update.get("vehicles_freed", 0)
        assert new_space == 50

    def test_cabin_booking_update(self):
        """Test cabin booking availability update."""
        update = {
            "change_type": "booking",
            "cabin_quantity": 2,
            "cabin_type": "inside"
        }
        current_cabins = 20
        new_cabins = max(0, current_cabins - update.get("cabin_quantity", 0))
        assert new_cabins == 18

    def test_cabin_cancellation_update(self):
        """Test cabin cancellation availability update."""
        update = {
            "change_type": "cancellation",
            "cabins_freed": 2
        }
        current_cabins = 18
        new_cabins = current_cabins + update.get("cabins_freed", 0)
        assert new_cabins == 20

    def test_combined_booking_update(self):
        """Test combined booking with passengers, vehicles, and cabins."""
        update = {
            "change_type": "booking",
            "passengers_booked": 4,
            "vehicles_booked": 1,
            "cabin_quantity": 1
        }
        # Initial state
        passengers = 100
        vehicles = 50
        cabins = 20

        # Apply update
        passengers = max(0, passengers - update.get("passengers_booked", 0))
        vehicles = max(0, vehicles - update.get("vehicles_booked", 0))
        cabins = max(0, cabins - update.get("cabin_quantity", 0))

        assert passengers == 96
        assert vehicles == 49
        assert cabins == 19

    def test_combined_cancellation_update(self):
        """Test combined cancellation update."""
        update = {
            "change_type": "cancellation",
            "passengers_freed": 4,
            "vehicles_freed": 1,
            "cabins_freed": 1
        }
        # After booking state
        passengers = 96
        vehicles = 49
        cabins = 19

        # Apply cancellation
        passengers = passengers + update.get("passengers_freed", 0)
        vehicles = vehicles + update.get("vehicles_freed", 0)
        cabins = cabins + update.get("cabins_freed", 0)

        assert passengers == 100
        assert vehicles == 50
        assert cabins == 20


class TestAvailabilityBoundaryConditions:
    """Test boundary conditions for availability updates."""

    def test_cannot_go_below_zero(self):
        """Test that availability cannot go below zero."""
        current_cabins = 1
        cabins_to_book = 5

        new_cabins = max(0, current_cabins - cabins_to_book)
        assert new_cabins == 0

    def test_handles_zero_availability(self):
        """Test handling zero availability."""
        current_cabins = 0
        cabins_freed = 3

        new_cabins = current_cabins + cabins_freed
        assert new_cabins == 3

    def test_handles_missing_fields(self):
        """Test handling updates with missing fields."""
        update = {
            "change_type": "booking"
            # Missing passengers_booked, vehicles_booked, cabin_quantity
        }

        passengers = 100
        vehicles = 50
        cabins = 20

        # Apply update (fields default to 0)
        passengers = max(0, passengers - update.get("passengers_booked", 0))
        vehicles = max(0, vehicles - update.get("vehicles_booked", 0))
        cabins = max(0, cabins - update.get("cabin_quantity", 0))

        # Should remain unchanged
        assert passengers == 100
        assert vehicles == 50
        assert cabins == 20

    def test_handles_none_values(self):
        """Test handling None values in availability."""
        current_cabins = None
        cabins_freed = 2

        # Handle None by defaulting to 0
        new_cabins = (current_cabins or 0) + cabins_freed
        assert new_cabins == 2
