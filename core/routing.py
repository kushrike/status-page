from django.urls import re_path
from .consumers import StatusConsumer, PublicStatusConsumer

websocket_urlpatterns = [
    # Authenticated endpoint for organization-specific updates
    re_path(r"ws/status/org/(?P<org_id>[^/]+)/$", StatusConsumer.as_asgi()),
    # Public endpoint for public status updates
    re_path(r"ws/status/public/(?P<org_slug>[^/]+)/$", PublicStatusConsumer.as_asgi()),
]
