"""
Push notification service for sending Expo push notifications.
"""
import os
import logging
import httpx
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

# Expo Push API endpoint
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


class PushNotificationService:
    """Service for sending push notifications via Expo Push API."""

    def __init__(self):
        self.expo_push_url = EXPO_PUSH_URL

    def send_push_notification(
        self,
        push_token: str,
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None,
        sound: str = "default",
        badge: Optional[int] = None,
        channel_id: Optional[str] = None,
    ) -> bool:
        """
        Send a single push notification.

        Args:
            push_token: Expo push token (ExponentPushToken[xxx])
            title: Notification title
            body: Notification body
            data: Additional data to send with notification
            sound: Sound to play (default, or None for silent)
            badge: Badge count to show on app icon
            channel_id: Android notification channel ID

        Returns:
            bool: True if notification was sent successfully
        """
        if not push_token:
            logger.warning("No push token provided, skipping notification")
            return False

        # Validate token format
        if not push_token.startswith("ExponentPushToken[") and not push_token.startswith("ExpoPushToken["):
            logger.warning(f"Invalid push token format: {push_token[:20]}...")
            return False

        message = {
            "to": push_token,
            "title": title,
            "body": body,
            "sound": sound,
        }

        if data:
            message["data"] = data

        if badge is not None:
            message["badge"] = badge

        if channel_id:
            message["channelId"] = channel_id

        return self._send_to_expo([message])

    def send_bulk_notifications(
        self,
        notifications: List[Dict[str, Any]]
    ) -> bool:
        """
        Send multiple push notifications in a batch.

        Args:
            notifications: List of notification objects with push_token, title, body, etc.

        Returns:
            bool: True if all notifications were sent successfully
        """
        messages = []
        for notif in notifications:
            push_token = notif.get("push_token")
            if not push_token:
                continue

            if not push_token.startswith("ExponentPushToken[") and not push_token.startswith("ExpoPushToken["):
                continue

            message = {
                "to": push_token,
                "title": notif.get("title", "Notification"),
                "body": notif.get("body", ""),
                "sound": notif.get("sound", "default"),
            }

            if notif.get("data"):
                message["data"] = notif["data"]

            if notif.get("badge") is not None:
                message["badge"] = notif["badge"]

            if notif.get("channel_id"):
                message["channelId"] = notif["channel_id"]

            messages.append(message)

        if not messages:
            logger.warning("No valid push tokens to send notifications to")
            return False

        return self._send_to_expo(messages)

    def _send_to_expo(self, messages: List[Dict[str, Any]]) -> bool:
        """
        Send messages to Expo Push API.

        Args:
            messages: List of Expo push message objects

        Returns:
            bool: True if request was successful
        """
        try:
            # Expo recommends batching up to 100 messages per request
            batch_size = 100
            success = True

            for i in range(0, len(messages), batch_size):
                batch = messages[i:i + batch_size]

                response = httpx.post(
                    self.expo_push_url,
                    json=batch if len(batch) > 1 else batch[0],
                    headers={
                        "Content-Type": "application/json",
                        "Accept": "application/json",
                    },
                    timeout=30.0
                )

                if response.status_code != 200:
                    logger.error(f"Expo Push API error: {response.status_code} - {response.text}")
                    success = False
                    continue

                result = response.json()

                # Check for errors in response
                if "data" in result:
                    data = result["data"]
                    # Handle both single and batch responses
                    if isinstance(data, list):
                        for item in data:
                            if item.get("status") == "error":
                                logger.error(f"Push notification error: {item.get('message')}")
                                success = False
                    elif isinstance(data, dict):
                        if data.get("status") == "error":
                            logger.error(f"Push notification error: {data.get('message')}")
                            success = False

                logger.info(f"Sent {len(batch)} push notifications successfully")

            return success

        except httpx.TimeoutException:
            logger.error("Expo Push API request timed out")
            return False
        except Exception as e:
            logger.error(f"Failed to send push notification: {str(e)}")
            return False

    def send_availability_alert(
        self,
        push_token: str,
        alert_type: str,
        departure_port: str,
        arrival_port: str,
        departure_date: str,
        alert_id: Optional[int] = None,
        booking_id: Optional[int] = None,
    ) -> bool:
        """
        Send availability alert push notification.

        Args:
            push_token: User's Expo push token
            alert_type: Type of alert (cabin, vehicle, passenger)
            departure_port: Departure port name
            arrival_port: Arrival port name
            departure_date: Departure date string
            alert_id: Alert ID for navigation
            booking_id: Booking ID if alert is linked to a booking

        Returns:
            bool: True if notification was sent
        """
        # Build notification content based on alert type
        if alert_type == "cabin":
            title = "Cabin Available! 🛏️"
            body = f"A cabin is now available for {departure_port} → {arrival_port} on {departure_date}. Book now before it's gone!"
        elif alert_type == "vehicle":
            title = "Vehicle Space Available! 🚗"
            body = f"Vehicle space is now available for {departure_port} → {arrival_port} on {departure_date}. Book now!"
        else:  # passenger
            title = "Seats Available! 👥"
            body = f"Passenger seats are now available for {departure_port} → {arrival_port} on {departure_date}. Book now!"

        data = {
            "type": "availability_alert",
            "alert_type": alert_type,
            "alert_id": alert_id,
            "booking_id": booking_id,
            "departure_port": departure_port,
            "arrival_port": arrival_port,
            "departure_date": departure_date,
        }

        return self.send_push_notification(
            push_token=push_token,
            title=title,
            body=body,
            data=data,
            channel_id="price-alerts",  # Using price-alerts channel for availability
        )


# Singleton instance
push_notification_service = PushNotificationService()
