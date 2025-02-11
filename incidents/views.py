from rest_framework import viewsets
from django.db.models import QuerySet
from core.permissions import IsOrganizationAdminOrReadOnly, ReadOnly
from .models import Incident
from .serializers import IncidentSerializer
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from core.throttling import PublicEndpointThrottle
from rest_framework import permissions
from core.pagination import CustomPageNumberPagination


class IncidentViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing incidents within an organization.

    Provides CRUD operations for incidents with appropriate permissions and filtering.
    Requires:
    - Organization membership for read access
    - Organization admin role for create/update/delete operations

    Handles real-time notifications on incident changes.
    """

    serializer_class = IncidentSerializer
    permission_classes = [IsOrganizationAdminOrReadOnly]
    filterset_fields = ["status"]
    search_fields = ["title", "description"]
    ordering_fields = ["started_at", "resolved_at", "created_at"]
    ordering = ["-started_at"]
    pagination_class = CustomPageNumberPagination

    def get_queryset(self) -> "QuerySet[Incident]":
        """
        Get queryset of incidents for the current user's organization.

        Returns:
            QuerySet[Incident]: Filtered queryset of active incidents
        """
        return Incident.active.search_incidents(org=self.request.user.org)

    def perform_create(self, serializer: IncidentSerializer) -> None:
        """
        Create a new incident and send notification.

        Args:
            serializer: Validated incident serializer instance
        """
        incident = serializer.save(
            org=self.request.user.org,
            created_by=self.request.user,
            updated_by=self.request.user,
        )
        incident.notify_update()

    def perform_update(self, serializer: IncidentSerializer) -> None:
        """
        Update an incident and send notification.

        Args:
            serializer: Validated incident serializer instance
        """
        incident = serializer.save(updated_by=self.request.user)
        incident.notify_update()

    def perform_destroy(self, instance: Incident) -> None:
        """
        Delete an incident and send notification.

        Args:
            instance: Incident instance to delete
        """
        instance.delete_and_notify(user=self.request.user)


class PublicIncidentViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for public access to Incident objects.

    Provides read-only access to incidents for a given organization.
    No authentication required but includes rate limiting.
    Write operations (POST, PUT, PATCH, DELETE) are not allowed.
    """

    serializer_class = IncidentSerializer
    permission_classes = [
        ReadOnly,
        permissions.AllowAny,
    ]  # Explicitly enforce read-only for all users
    throttle_classes = [PublicEndpointThrottle]
    pagination_class = CustomPageNumberPagination

    def get_queryset(self):
        org_slug = self.kwargs.get("org_slug")
        return Incident.active.get_public_incidents(org_slug=org_slug)

    @method_decorator(cache_page(60))
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)
