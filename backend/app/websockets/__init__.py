"""
WebSocket module for real-time updates.
"""

from .manager import WebSocketManager, get_ws_manager
from .availability import availability_router

__all__ = ["WebSocketManager", "get_ws_manager", "availability_router"]
