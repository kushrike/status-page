from rest_framework import viewsets, status, permissions
from rest_framework.response import Response
from core.permissions import IsOrganizationAdmin
from .models import Organization
from .serializers import OrganizationSerializer, OrganizationPublicSerializer
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from core.throttling import PublicEndpointThrottle
from rest_framework.authentication import SessionAuthentication
from core.authentication import ClerkAuthentication
from core.pagination import CustomPageNumberPagination
import logging

logger = logging.getLogger(__name__)


class PublicEndpointPermission(permissions.BasePermission):
    """
    Permission class that allows unrestricted access to public endpoints.
    """

    def has_permission(self, request, view):
        return True


class OrganizationViewSet(viewsets.ModelViewSet):
    serializer_class = OrganizationSerializer
    permission_classes = [IsOrganizationAdmin]
    authentication_classes = [ClerkAuthentication, SessionAuthentication]

    def get_queryset(self):
        if self.request.user.is_authenticated:
            return Organization.objects.filter(id=self.request.user.org_id)
        return Organization.objects.none()


class PublicOrganizationViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for public organization endpoints.
    No authentication required.
    """

    serializer_class = OrganizationPublicSerializer
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = [PublicEndpointThrottle]
    pagination_class = CustomPageNumberPagination

    def get_queryset(self):
        queryset = Organization.objects.filter(is_active=True)
        org_slug = self.kwargs.get("org_slug")
        if org_slug:
            return queryset.filter(slug=org_slug)
        return queryset.order_by("name")

    @method_decorator(cache_page(60))  # Cache for 1 minute
    def list(self, request, *args, **kwargs):
        try:
            return super().list(request, *args, **kwargs)
        except Exception as e:
            logger.error(f"Error in list view: {str(e)}", exc_info=True)
            return Response(
                {"error": "Internal server error"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
