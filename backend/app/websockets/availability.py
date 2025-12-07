"""
WebSocket endpoint for real-time availability updates.

Clients can:
- Subscribe to specific routes to get updates when availability changes
- Receive instant updates when bookings are made
- Stay synced with external API changes
"""

import asyncio
import json
import logging
import uuid
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from typing import Optional

from .manager import get_ws_manager

logger = logging.getLogger(__name__)

availability_router = APIRouter()


@availability_router.websocket("/ws/availability")
async def availability_websocket(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
    routes: Optional[str] = Query(None)  # Comma-separated routes
):
    """
    WebSocket endpoint for real-time availability updates.

    Query params:
        token: Optional JWT token for authenticated users
        routes: Comma-separated list of routes to subscribe to (e.g., "TUNIS-MARSEILLE,TUNIS-GENOA")

    Messages from client:
        - {"action": "subscribe", "routes": ["TUNIS-MARSEILLE"]}
        - {"action": "unsubscribe", "routes": ["TUNIS-MARSEILLE"]}
        - {"action": "ping"}

    Messages to client:
        - {"type": "connected", "client_id": "...", "message": "..."}
        - {"type": "subscribed", "routes": [...]}
        - {"type": "availability_update", "route": "...", "data": {...}}
        - {"type": "pong"}
    """
    ws_manager = get_ws_manager()

    # Generate unique client ID
    client_id = str(uuid.uuid4())

    # Ensure Redis connection is active
    await ws_manager.connect_redis()
    await ws_manager.start_listener()

    # Accept connection
    if not await ws_manager.connect(websocket, client_id):
        return

    try:
        # Auto-subscribe to initial routes if provided
        if routes:
            initial_routes = [r.strip() for r in routes.split(",") if r.strip()]
            if initial_routes:
                await ws_manager.subscribe(client_id, initial_routes)

        # Handle incoming messages
        while True:
            try:
                data = await websocket.receive_text()
                message = json.loads(data)

                action = message.get("action")

                if action == "subscribe":
                    routes_to_sub = message.get("routes", [])
                    if routes_to_sub:
                        await ws_manager.subscribe(client_id, routes_to_sub)

                elif action == "unsubscribe":
                    routes_to_unsub = message.get("routes", [])
                    if routes_to_unsub:
                        await ws_manager.unsubscribe(client_id, routes_to_unsub)

                elif action == "ping":
                    await websocket.send_json({"type": "pong"})

                elif action == "stats":
                    stats = ws_manager.get_stats()
                    await websocket.send_json({"type": "stats", "data": stats})

            except json.JSONDecodeError:
                await websocket.send_json({
                    "type": "error",
                    "message": "Invalid JSON"
                })

    except WebSocketDisconnect:
        logger.info(f"Client {client_id} disconnected")
    except Exception as e:
        logger.error(f"WebSocket error for client {client_id}: {e}")
    finally:
        await ws_manager.disconnect(client_id)


@availability_router.get("/ws/stats")
async def get_websocket_stats():
    """Get WebSocket connection statistics."""
    ws_manager = get_ws_manager()
    return ws_manager.get_stats()
