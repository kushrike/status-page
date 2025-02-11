from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async
import jwt
from django.conf import settings
from django.contrib.auth import get_user_model
import logging
from typing import Dict, Optional, Any
from channels.layers import BaseChannelLayer

logger = logging.getLogger(__name__)
User = get_user_model()


class StatusConsumer(AsyncJsonWebsocketConsumer):
    """
    WebSocket consumer for handling real-time status updates.

    This consumer authenticates users via JWT token, adds them to their organization's
    group channel, and handles status update messages. It expects a valid JWT token
    in the query string parameters when establishing the WebSocket connection.

    Inherits from:
        AsyncJsonWebsocketConsumer: Base class for handling async JSON WebSocket connections
    """

    channel_layer: BaseChannelLayer
    org_group_name: str
    user: User

    async def connect(self) -> None:
        try:
            # Get token from query string safely
            query_string: str = self.scope["query_string"].decode()
            token: Optional[str] = None

            # Parse query string to find token
            params: Dict[str, str] = dict(
                param.split("=") for param in query_string.split("&") if "=" in param
            )
            token = params.get("token")

            if not token:
                logger.error("No token provided in WebSocket connection")
                await self.close(code=4001)
                return

            # Verify token
            try:
                payload: Dict[str, Any] = jwt.decode(
                    token,
                    settings.CLERK_PEM_PUBLIC_KEY,
                    algorithms=["RS256"],
                    audience=settings.CLERK_JWT_AUDIENCE,
                    issuer=settings.CLERK_ISSUER_URL,
                    options={
                        "verify_exp": True,
                        "verify_aud": True,
                        "verify_iss": True,
                    },
                )
            except jwt.InvalidTokenError as e:
                logger.error(f"Invalid token: {str(e)}")
                await self.close(code=4002)
                return

            try:
                # Get or create user
                self.user = await self.get_user(payload["sub"])
            except User.DoesNotExist:
                logger.error(f"User not found for clerk_id: {payload['sub']}")
                await self.close(code=4003)
                return

            # Add to organization group
            self.org_group_name = f"org_{self.user.org.id}"
            await self.channel_layer.group_add(self.org_group_name, self.channel_name)

            await self.accept()
            logger.info(f"WebSocket connection accepted for org: {self.user.org.id}")

        except Exception as e:
            logger.error(f"WebSocket connection error: {str(e)}")
            await self.close(code=4000)
            return

    async def disconnect(self, close_code: int) -> None:
        if hasattr(self, "org_group_name"):
            await self.channel_layer.group_discard(
                self.org_group_name, self.channel_name
            )

    async def service_status_update(self, event: Dict[str, Any]) -> None:
        """
        Handle service status update messages
        """
        await self.send_json(event)

    async def incident_update(self, event: Dict[str, Any]) -> None:
        """
        Handle incident update messages
        """
        await self.send_json(event)

    @database_sync_to_async
    def get_user(self, clerk_id: str) -> User:
        return User.objects.select_related("org").get(clerk_id=clerk_id)


class PublicStatusConsumer(AsyncJsonWebsocketConsumer):
    """
    Consumer for public status updates that don't require authentication.
    Handles organization-specific public updates using org_slug.
    """

    channel_layer: BaseChannelLayer
    public_group_name: str
    org_slug: str

    async def connect(self) -> None:
        try:
            # Get org_slug from URL route
            self.org_slug = self.scope["url_route"]["kwargs"]["org_slug"]
            if not self.org_slug:
                logger.error("No org_slug provided in WebSocket connection")
                await self.close(code=4001)
                return

            # Join the organization-specific public group
            self.public_group_name = f"public_status_{self.org_slug}"
            await self.channel_layer.group_add(
                self.public_group_name, self.channel_name
            )

            await self.accept()
            logger.info(
                f"Public WebSocket connection accepted for org: {self.org_slug}"
            )

        except Exception as e:
            logger.error(f"Public WebSocket connection error: {str(e)}")
            await self.close(code=4000)
            return

    async def disconnect(self, close_code: int) -> None:
        if hasattr(self, "public_group_name"):
            await self.channel_layer.group_discard(
                self.public_group_name, self.channel_name
            )

    async def service_status_update(self, event: Dict[str, Any]) -> None:
        """
        Handle service status update messages
        """
        await self.send_json(event)

    async def incident_update(self, event: Dict[str, Any]) -> None:
        """
        Handle incident update messages
        """
        await self.send_json(event)
