"""
websocket_manager.py — Central WebSocket connection manager for real-time broadcasts
"""
import json
from typing import Dict, List
from fastapi import WebSocket
import logging

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    Manages active WebSocket connections.
    Connections are tracked by user_id for targeted messaging
    and by role for role-based broadcasts.
    """

    def __init__(self):
        # Map user_id -> list of WebSocket (multiple tabs per user)
        self._connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        if user_id not in self._connections:
            self._connections[user_id] = []
        self._connections[user_id].append(websocket)
        logger.info(f"[WS] User {user_id} connected. Total users: {len(self._connections)}")

    def disconnect(self, websocket: WebSocket, user_id: int):
        if user_id in self._connections:
            try:
                self._connections[user_id].remove(websocket)
            except ValueError:
                pass
            if not self._connections[user_id]:
                del self._connections[user_id]
        logger.info(f"[WS] User {user_id} disconnected. Total users: {len(self._connections)}")

    async def send_to_user(self, user_id: int, event: str, data: dict):
        """Send a message to all tabs of a specific user."""
        message = json.dumps({"event": event, "data": data})
        sockets = self._connections.get(user_id, [])
        dead = []
        for ws in sockets:
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        # Clean up dead connections
        for ws in dead:
            try:
                self._connections[user_id].remove(ws)
            except ValueError:
                pass

    async def broadcast(self, event: str, data: dict):
        """Broadcast an event to ALL connected users."""
        message = json.dumps({"event": event, "data": data})
        dead_users = []
        for user_id, sockets in list(self._connections.items()):
            dead = []
            for ws in sockets:
                try:
                    await ws.send_text(message)
                except Exception:
                    dead.append(ws)
            for ws in dead:
                try:
                    sockets.remove(ws)
                except ValueError:
                    pass
            if not sockets:
                dead_users.append(user_id)
        for uid in dead_users:
            self._connections.pop(uid, None)

    async def broadcast_to_roles(self, event: str, data: dict, user_role_map: Dict[int, str], target_roles: List[str]):
        """Broadcast only to users with specific roles."""
        message = json.dumps({"event": event, "data": data})
        for user_id, role in user_role_map.items():
            if role in target_roles:
                await self.send_to_user(user_id, event, data)

    @property
    def connected_count(self) -> int:
        return len(self._connections)


# Singleton instance used throughout the app
manager = ConnectionManager()
