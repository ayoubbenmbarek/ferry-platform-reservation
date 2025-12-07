"""
WebSocket connection manager with Redis pub/sub for real-time updates.

Architecture:
- WebSocketManager handles all connected clients
- Redis pub/sub broadcasts updates across multiple server instances
- Clients subscribe to specific routes/ferries for targeted updates
"""

import asyncio
import json
import logging
from typing import Dict, Set, Optional, Any
from datetime import datetime
from fastapi import WebSocket, WebSocketDisconnect
import redis.asyncio as redis

logger = logging.getLogger(__name__)


class WebSocketManager:
    """
    Manages WebSocket connections and Redis pub/sub for real-time updates.

    Supports:
    - Route-based subscriptions (e.g., "TUNIS-MARSEILLE")
    - Ferry-specific subscriptions (e.g., "ferry:CTN-001")
    - Broadcast to all connected clients
    """

    def __init__(self, redis_url: str = "redis://localhost:6399/2"):
        self.redis_url = redis_url
        self.redis: Optional[redis.Redis] = None
        self.pubsub: Optional[redis.client.PubSub] = None

        # Active connections: {client_id: WebSocket}
        self.active_connections: Dict[str, WebSocket] = {}

        # Subscriptions: {channel: set of client_ids}
        self.subscriptions: Dict[str, Set[str]] = {}

        # Client subscriptions: {client_id: set of channels}
        self.client_channels: Dict[str, Set[str]] = {}

        # Background task for Redis listener
        self._listener_task: Optional[asyncio.Task] = None

    async def connect_redis(self):
        """Initialize Redis connection and pub/sub."""
        if self.redis is None:
            self.redis = redis.from_url(self.redis_url, decode_responses=True)
            self.pubsub = self.redis.pubsub()
            logger.info("WebSocket Redis connection established")

    async def disconnect_redis(self):
        """Close Redis connection."""
        if self._listener_task:
            self._listener_task.cancel()
            try:
                await self._listener_task
            except asyncio.CancelledError:
                pass

        if self.pubsub:
            await self.pubsub.close()
        if self.redis:
            await self.redis.close()
        logger.info("WebSocket Redis connection closed")

    async def start_listener(self):
        """Start background task to listen for Redis pub/sub messages."""
        if self._listener_task is None or self._listener_task.done():
            self._listener_task = asyncio.create_task(self._redis_listener())
            logger.info("Redis pub/sub listener started")

    async def _redis_listener(self):
        """Listen for Redis pub/sub messages and broadcast to WebSocket clients."""
        try:
            # Subscribe to availability channel pattern
            await self.pubsub.psubscribe("availability:*")

            async for message in self.pubsub.listen():
                if message["type"] == "pmessage":
                    channel = message["channel"]
                    data = message["data"]

                    try:
                        payload = json.loads(data)
                        await self._broadcast_to_subscribers(channel, payload)
                    except json.JSONDecodeError:
                        logger.error(f"Invalid JSON in pub/sub message: {data}")

        except asyncio.CancelledError:
            logger.info("Redis listener cancelled")
        except Exception as e:
            logger.error(f"Redis listener error: {e}")

    async def _broadcast_to_subscribers(self, channel: str, payload: dict):
        """Broadcast message to all clients subscribed to a channel."""
        # Extract route from channel (e.g., "availability:TUNIS-MARSEILLE" -> "TUNIS-MARSEILLE")
        route = channel.replace("availability:", "")

        # Find all subscribed clients
        client_ids = self.subscriptions.get(route, set())

        # Also broadcast to clients subscribed to "all"
        client_ids = client_ids.union(self.subscriptions.get("all", set()))

        if not client_ids:
            return

        message = json.dumps({
            "type": "availability_update",
            "route": route,
            "data": payload,
            "timestamp": datetime.utcnow().isoformat()
        })

        disconnected = []
        for client_id in client_ids:
            websocket = self.active_connections.get(client_id)
            if websocket:
                try:
                    await websocket.send_text(message)
                except Exception as e:
                    logger.warning(f"Failed to send to client {client_id}: {e}")
                    disconnected.append(client_id)

        # Clean up disconnected clients
        for client_id in disconnected:
            await self.disconnect(client_id)

    async def connect(self, websocket: WebSocket, client_id: str) -> bool:
        """Accept a new WebSocket connection."""
        try:
            await websocket.accept()
            self.active_connections[client_id] = websocket
            self.client_channels[client_id] = set()

            logger.info(f"WebSocket client connected: {client_id}")

            # Send welcome message
            await websocket.send_json({
                "type": "connected",
                "client_id": client_id,
                "message": "Connected to real-time availability updates"
            })

            return True
        except RuntimeError as e:
            # Common case: client disconnected before accept completed (page refresh, navigation)
            # Log at debug level to reduce noise
            logger.debug(f"WebSocket connection closed before accept (client may have navigated away): {e}")
            return False
        except Exception as e:
            # Unexpected errors should still be logged
            error_type = type(e).__name__
            error_msg = str(e) or "No details available"
            logger.warning(f"Failed to accept WebSocket connection ({error_type}): {error_msg}")
            return False

    async def disconnect(self, client_id: str):
        """Handle client disconnection."""
        # Remove from active connections
        self.active_connections.pop(client_id, None)

        # Remove from all subscriptions
        channels = self.client_channels.pop(client_id, set())
        for channel in channels:
            if channel in self.subscriptions:
                self.subscriptions[channel].discard(client_id)
                if not self.subscriptions[channel]:
                    del self.subscriptions[channel]

        logger.info(f"WebSocket client disconnected: {client_id}")

    async def subscribe(self, client_id: str, routes: list[str]):
        """Subscribe a client to specific routes."""
        if client_id not in self.active_connections:
            return

        for route in routes:
            # Normalize route format (e.g., "TUNIS-MARSEILLE")
            route = route.upper().replace(" ", "-")

            if route not in self.subscriptions:
                self.subscriptions[route] = set()

            self.subscriptions[route].add(client_id)
            self.client_channels[client_id].add(route)

        websocket = self.active_connections[client_id]
        await websocket.send_json({
            "type": "subscribed",
            "routes": routes
        })

        logger.info(f"Client {client_id} subscribed to routes: {routes}")

    async def unsubscribe(self, client_id: str, routes: list[str]):
        """Unsubscribe a client from specific routes."""
        for route in routes:
            route = route.upper().replace(" ", "-")

            if route in self.subscriptions:
                self.subscriptions[route].discard(client_id)
                if not self.subscriptions[route]:
                    del self.subscriptions[route]

            if client_id in self.client_channels:
                self.client_channels[client_id].discard(route)

        websocket = self.active_connections.get(client_id)
        if websocket:
            await websocket.send_json({
                "type": "unsubscribed",
                "routes": routes
            })

    async def publish_availability_update(
        self,
        route: str,
        ferry_id: str,
        departure_time: str,
        availability: dict
    ):
        """
        Publish an availability update to Redis (broadcasts to all server instances).

        Args:
            route: Route identifier (e.g., "TUNIS-MARSEILLE")
            ferry_id: Ferry identifier
            departure_time: Departure datetime
            availability: Dict with seats, cabins, vehicles availability
        """
        if not self.redis:
            await self.connect_redis()

        channel = f"availability:{route.upper()}"
        payload = {
            "ferry_id": ferry_id,
            "route": route,
            "departure_time": departure_time,
            "availability": availability,
            "updated_at": datetime.utcnow().isoformat()
        }

        await self.redis.publish(channel, json.dumps(payload))
        logger.debug(f"Published availability update for {route}: {ferry_id}")

    async def broadcast_all(self, message: dict):
        """Broadcast a message to all connected clients."""
        text = json.dumps(message)
        disconnected = []

        for client_id, websocket in self.active_connections.items():
            try:
                await websocket.send_text(text)
            except Exception:
                disconnected.append(client_id)

        for client_id in disconnected:
            await self.disconnect(client_id)

    def get_stats(self) -> dict:
        """Get WebSocket connection statistics."""
        return {
            "active_connections": len(self.active_connections),
            "subscriptions": {
                route: len(clients)
                for route, clients in self.subscriptions.items()
            },
            "total_subscriptions": sum(
                len(channels)
                for channels in self.client_channels.values()
            )
        }


# Global WebSocket manager instance
_ws_manager: Optional[WebSocketManager] = None


def get_ws_manager() -> WebSocketManager:
    """Get or create the global WebSocket manager."""
    global _ws_manager
    if _ws_manager is None:
        import os
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6399/2")
        _ws_manager = WebSocketManager(redis_url)
    return _ws_manager
