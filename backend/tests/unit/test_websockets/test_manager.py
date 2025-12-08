"""
Unit tests for WebSocket manager.

Tests the WebSocketManager class functionality including:
- Connection management
- Subscription handling
- Message broadcasting
- Statistics tracking
"""

import pytest
import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime

from app.websockets.manager import WebSocketManager, get_ws_manager


class TestWebSocketManager:
    """Tests for WebSocketManager class."""

    @pytest.fixture
    def manager(self):
        """Create a WebSocketManager instance for testing."""
        return WebSocketManager(redis_url="redis://localhost:6379/15")

    @pytest.fixture
    def mock_websocket(self):
        """Create a mock WebSocket."""
        ws = AsyncMock()
        ws.accept = AsyncMock()
        ws.send_json = AsyncMock()
        ws.send_text = AsyncMock()
        ws.receive_text = AsyncMock()
        return ws


class TestConnection(TestWebSocketManager):
    """Test WebSocket connection handling."""

    @pytest.mark.asyncio
    async def test_connect_success(self, manager, mock_websocket):
        """Test successful WebSocket connection."""
        client_id = "test-client-1"

        result = await manager.connect(mock_websocket, client_id)

        assert result is True
        assert client_id in manager.active_connections
        assert manager.active_connections[client_id] == mock_websocket
        mock_websocket.accept.assert_called_once()
        mock_websocket.send_json.assert_called_once()
        # Verify welcome message
        call_args = mock_websocket.send_json.call_args[0][0]
        assert call_args["type"] == "connected"
        assert call_args["client_id"] == client_id

    @pytest.mark.asyncio
    async def test_connect_initializes_client_channels(self, manager, mock_websocket):
        """Test that connection initializes empty client channels set."""
        client_id = "test-client-2"

        await manager.connect(mock_websocket, client_id)

        assert client_id in manager.client_channels
        assert manager.client_channels[client_id] == set()

    @pytest.mark.asyncio
    async def test_connect_runtime_error_returns_false(self, manager, mock_websocket):
        """Test that RuntimeError during accept returns False."""
        mock_websocket.accept.side_effect = RuntimeError("Connection closed")

        result = await manager.connect(mock_websocket, "test-client")

        assert result is False
        assert "test-client" not in manager.active_connections

    @pytest.mark.asyncio
    async def test_connect_generic_error_returns_false(self, manager, mock_websocket):
        """Test that generic exception during accept returns False."""
        mock_websocket.accept.side_effect = Exception("Unknown error")

        result = await manager.connect(mock_websocket, "test-client")

        assert result is False


class TestDisconnection(TestWebSocketManager):
    """Test WebSocket disconnection handling."""

    @pytest.mark.asyncio
    async def test_disconnect_removes_from_active_connections(self, manager, mock_websocket):
        """Test that disconnect removes client from active connections."""
        client_id = "test-client-1"
        await manager.connect(mock_websocket, client_id)

        await manager.disconnect(client_id)

        assert client_id not in manager.active_connections

    @pytest.mark.asyncio
    async def test_disconnect_removes_from_subscriptions(self, manager, mock_websocket):
        """Test that disconnect removes client from all subscriptions."""
        client_id = "test-client-1"
        await manager.connect(mock_websocket, client_id)
        await manager.subscribe(client_id, ["TUNIS-MARSEILLE", "TUNIS-GENOA"])

        await manager.disconnect(client_id)

        assert client_id not in manager.client_channels
        assert client_id not in manager.subscriptions.get("TUNIS-MARSEILLE", set())
        assert client_id not in manager.subscriptions.get("TUNIS-GENOA", set())

    @pytest.mark.asyncio
    async def test_disconnect_cleans_up_empty_subscription_channels(self, manager, mock_websocket):
        """Test that empty subscription channels are removed."""
        client_id = "test-client-1"
        await manager.connect(mock_websocket, client_id)
        await manager.subscribe(client_id, ["TUNIS-MARSEILLE"])

        await manager.disconnect(client_id)

        assert "TUNIS-MARSEILLE" not in manager.subscriptions

    @pytest.mark.asyncio
    async def test_disconnect_nonexistent_client(self, manager):
        """Test that disconnecting nonexistent client doesn't raise."""
        # Should not raise
        await manager.disconnect("nonexistent-client")


class TestSubscription(TestWebSocketManager):
    """Test subscription handling."""

    @pytest.mark.asyncio
    async def test_subscribe_single_route(self, manager, mock_websocket):
        """Test subscribing to a single route."""
        client_id = "test-client-1"
        await manager.connect(mock_websocket, client_id)

        await manager.subscribe(client_id, ["TUNIS-MARSEILLE"])

        assert client_id in manager.subscriptions["TUNIS-MARSEILLE"]
        assert "TUNIS-MARSEILLE" in manager.client_channels[client_id]

    @pytest.mark.asyncio
    async def test_subscribe_multiple_routes(self, manager, mock_websocket):
        """Test subscribing to multiple routes."""
        client_id = "test-client-1"
        await manager.connect(mock_websocket, client_id)

        await manager.subscribe(client_id, ["TUNIS-MARSEILLE", "TUNIS-GENOA", "TUNIS-PALERMO"])

        assert client_id in manager.subscriptions["TUNIS-MARSEILLE"]
        assert client_id in manager.subscriptions["TUNIS-GENOA"]
        assert client_id in manager.subscriptions["TUNIS-PALERMO"]
        assert len(manager.client_channels[client_id]) == 3

    @pytest.mark.asyncio
    async def test_subscribe_normalizes_route_format(self, manager, mock_websocket):
        """Test that route names are normalized (uppercase, dashes)."""
        client_id = "test-client-1"
        await manager.connect(mock_websocket, client_id)

        await manager.subscribe(client_id, ["tunis marseille"])

        assert client_id in manager.subscriptions["TUNIS-MARSEILLE"]

    @pytest.mark.asyncio
    async def test_subscribe_sends_confirmation(self, manager, mock_websocket):
        """Test that subscription sends confirmation message."""
        client_id = "test-client-1"
        await manager.connect(mock_websocket, client_id)
        mock_websocket.send_json.reset_mock()

        await manager.subscribe(client_id, ["TUNIS-MARSEILLE"])

        mock_websocket.send_json.assert_called_once()
        call_args = mock_websocket.send_json.call_args[0][0]
        assert call_args["type"] == "subscribed"
        assert "TUNIS-MARSEILLE" in call_args["routes"]

    @pytest.mark.asyncio
    async def test_subscribe_nonexistent_client_does_nothing(self, manager):
        """Test that subscribing nonexistent client does nothing."""
        await manager.subscribe("nonexistent", ["TUNIS-MARSEILLE"])

        assert "TUNIS-MARSEILLE" not in manager.subscriptions


class TestUnsubscribe(TestWebSocketManager):
    """Test unsubscription handling."""

    @pytest.mark.asyncio
    async def test_unsubscribe_removes_from_route(self, manager, mock_websocket):
        """Test unsubscribing from a route."""
        client_id = "test-client-1"
        await manager.connect(mock_websocket, client_id)
        await manager.subscribe(client_id, ["TUNIS-MARSEILLE", "TUNIS-GENOA"])

        await manager.unsubscribe(client_id, ["TUNIS-MARSEILLE"])

        assert client_id not in manager.subscriptions.get("TUNIS-MARSEILLE", set())
        assert client_id in manager.subscriptions["TUNIS-GENOA"]

    @pytest.mark.asyncio
    async def test_unsubscribe_sends_confirmation(self, manager, mock_websocket):
        """Test that unsubscription sends confirmation message."""
        client_id = "test-client-1"
        await manager.connect(mock_websocket, client_id)
        await manager.subscribe(client_id, ["TUNIS-MARSEILLE"])
        mock_websocket.send_json.reset_mock()

        await manager.unsubscribe(client_id, ["TUNIS-MARSEILLE"])

        mock_websocket.send_json.assert_called_once()
        call_args = mock_websocket.send_json.call_args[0][0]
        assert call_args["type"] == "unsubscribed"


class TestBroadcast(TestWebSocketManager):
    """Test message broadcasting."""

    @pytest.mark.asyncio
    async def test_broadcast_all_sends_to_all_clients(self, manager):
        """Test broadcasting to all connected clients."""
        # Create multiple mock clients
        clients = {}
        for i in range(3):
            ws = AsyncMock()
            ws.accept = AsyncMock()
            ws.send_json = AsyncMock()
            ws.send_text = AsyncMock()
            client_id = f"client-{i}"
            await manager.connect(ws, client_id)
            clients[client_id] = ws

        message = {"type": "test", "data": "hello"}
        await manager.broadcast_all(message)

        for client_id, ws in clients.items():
            ws.send_text.assert_called_once()
            sent_message = json.loads(ws.send_text.call_args[0][0])
            assert sent_message["type"] == "test"
            assert sent_message["data"] == "hello"

    @pytest.mark.asyncio
    async def test_broadcast_all_removes_failed_clients(self, manager, mock_websocket):
        """Test that failed clients are disconnected during broadcast."""
        # Connect a client that will fail
        failing_ws = AsyncMock()
        failing_ws.accept = AsyncMock()
        failing_ws.send_json = AsyncMock()
        failing_ws.send_text = AsyncMock(side_effect=Exception("Send failed"))
        await manager.connect(failing_ws, "failing-client")

        # Connect a working client
        await manager.connect(mock_websocket, "working-client")

        await manager.broadcast_all({"type": "test"})

        # Failing client should be disconnected
        assert "failing-client" not in manager.active_connections
        # Working client should still be connected
        assert "working-client" in manager.active_connections


class TestStats(TestWebSocketManager):
    """Test statistics tracking."""

    @pytest.mark.asyncio
    async def test_get_stats_empty(self, manager):
        """Test stats with no connections."""
        stats = manager.get_stats()

        assert stats["active_connections"] == 0
        assert stats["subscriptions"] == {}
        assert stats["total_subscriptions"] == 0

    @pytest.mark.asyncio
    async def test_get_stats_with_connections(self, manager, mock_websocket):
        """Test stats with connections and subscriptions."""
        await manager.connect(mock_websocket, "client-1")
        await manager.subscribe("client-1", ["TUNIS-MARSEILLE", "TUNIS-GENOA"])

        ws2 = AsyncMock()
        ws2.accept = AsyncMock()
        ws2.send_json = AsyncMock()
        await manager.connect(ws2, "client-2")
        await manager.subscribe("client-2", ["TUNIS-MARSEILLE"])

        stats = manager.get_stats()

        assert stats["active_connections"] == 2
        assert stats["subscriptions"]["TUNIS-MARSEILLE"] == 2
        assert stats["subscriptions"]["TUNIS-GENOA"] == 1
        assert stats["total_subscriptions"] == 3


class TestPublishAvailabilityUpdate(TestWebSocketManager):
    """Test availability update publishing."""

    @pytest.mark.asyncio
    async def test_publish_availability_update(self, manager):
        """Test publishing availability update to Redis."""
        # Mock Redis
        mock_redis = AsyncMock()
        manager.redis = mock_redis

        await manager.publish_availability_update(
            route="TUNIS-MARSEILLE",
            ferry_id="CTN-001",
            departure_time="2024-01-15T10:00:00",
            availability={
                "available_seats": 100,
                "available_cabins": 20,
                "cabin_quantity": 2
            }
        )

        mock_redis.publish.assert_called_once()
        call_args = mock_redis.publish.call_args
        assert call_args[0][0] == "availability:TUNIS-MARSEILLE"
        payload = json.loads(call_args[0][1])
        assert payload["ferry_id"] == "CTN-001"
        assert payload["route"] == "TUNIS-MARSEILLE"
        assert payload["availability"]["cabin_quantity"] == 2


class TestBroadcastToSubscribers(TestWebSocketManager):
    """Test broadcasting to subscribed clients."""

    @pytest.mark.asyncio
    async def test_broadcast_to_subscribers_only(self, manager):
        """Test that messages only go to subscribed clients."""
        # Client subscribed to TUNIS-MARSEILLE
        ws1 = AsyncMock()
        ws1.accept = AsyncMock()
        ws1.send_json = AsyncMock()
        ws1.send_text = AsyncMock()
        await manager.connect(ws1, "client-1")
        await manager.subscribe("client-1", ["TUNIS-MARSEILLE"])

        # Client subscribed to different route
        ws2 = AsyncMock()
        ws2.accept = AsyncMock()
        ws2.send_json = AsyncMock()
        ws2.send_text = AsyncMock()
        await manager.connect(ws2, "client-2")
        await manager.subscribe("client-2", ["TUNIS-GENOA"])

        # Broadcast to TUNIS-MARSEILLE
        await manager._broadcast_to_subscribers(
            "availability:TUNIS-MARSEILLE",
            {"ferry_id": "CTN-001", "availability": {"seats": 50}}
        )

        # Only client-1 should receive
        ws1.send_text.assert_called_once()
        ws2.send_text.assert_not_called()

    @pytest.mark.asyncio
    async def test_broadcast_includes_all_subscribers(self, manager):
        """Test that all subscribers to 'all' channel also receive."""
        # Client subscribed to specific route
        ws1 = AsyncMock()
        ws1.accept = AsyncMock()
        ws1.send_json = AsyncMock()
        ws1.send_text = AsyncMock()
        await manager.connect(ws1, "client-1")
        await manager.subscribe("client-1", ["TUNIS-MARSEILLE"])

        # Client subscribed to "all" - note: gets normalized to "ALL"
        ws2 = AsyncMock()
        ws2.accept = AsyncMock()
        ws2.send_json = AsyncMock()
        ws2.send_text = AsyncMock()
        await manager.connect(ws2, "client-2")
        # Manually add to "all" subscription since normalize converts to "ALL"
        manager.subscriptions["all"] = {"client-2"}
        manager.client_channels["client-2"].add("all")

        await manager._broadcast_to_subscribers(
            "availability:TUNIS-MARSEILLE",
            {"ferry_id": "CTN-001"}
        )

        # Both should receive
        ws1.send_text.assert_called_once()
        ws2.send_text.assert_called_once()

    @pytest.mark.asyncio
    async def test_broadcast_message_format(self, manager, mock_websocket):
        """Test the format of broadcast messages."""
        await manager.connect(mock_websocket, "client-1")
        await manager.subscribe("client-1", ["TUNIS-MARSEILLE"])
        mock_websocket.send_text.reset_mock()

        await manager._broadcast_to_subscribers(
            "availability:TUNIS-MARSEILLE",
            {"ferry_id": "CTN-001", "availability": {"cabins_freed": 2}}
        )

        mock_websocket.send_text.assert_called_once()
        message = json.loads(mock_websocket.send_text.call_args[0][0])
        assert message["type"] == "availability_update"
        assert message["route"] == "TUNIS-MARSEILLE"
        assert message["data"]["ferry_id"] == "CTN-001"
        assert message["data"]["availability"]["cabins_freed"] == 2
        assert "timestamp" in message


class TestGetWsManager:
    """Test global WebSocket manager getter."""

    def test_get_ws_manager_creates_instance(self):
        """Test that get_ws_manager creates a manager instance."""
        # Reset global manager
        import app.websockets.manager as manager_module
        manager_module._ws_manager = None

        with patch.dict('os.environ', {'REDIS_URL': 'redis://test:6379/0'}):
            manager = get_ws_manager()

        assert manager is not None
        assert isinstance(manager, WebSocketManager)

    def test_get_ws_manager_returns_same_instance(self):
        """Test that get_ws_manager returns singleton."""
        manager1 = get_ws_manager()
        manager2 = get_ws_manager()

        assert manager1 is manager2
