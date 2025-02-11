from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from core.permissions import IsOrganizationAdminOrReadOnly, ReadOnly
from .models import Service
from .serializers import ServiceSerializer, ServiceListSerializer
from .tasks import notify_status_change
from django.db.models import Q, QuerySet
import logging
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from core.throttling import PublicEndpointThrottle
from rest_framework import permissions
from django.core.exceptions import ValidationError
from core.pagination import CustomPageNumberPagination
from typing import Any, Optional

logger = logging.getLogger(__name__)


class ServiceViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing Service objects.

    Provides CRUD operations and additional actions for services within an organization.
    Requires:
    - Organization membership for read access
    - Organization admin role for create/update/delete operations

    Attributes:
        serializer_class: Serializer class for Service model
        permission_classes: Required permissions for access
        filterset_fields: Fields available for filtering
        search_fields: Fields available for searching
        ordering_fields: Fields available for ordering
        ordering: Default ordering
        pagination_class: Class handling result pagination
    """

    serializer_class = ServiceSerializer
    permission_classes = [IsOrganizationAdminOrReadOnly]
    filterset_fields = ["status", "is_active"]
    search_fields = ["name", "description"]
    ordering_fields = ["name", "status", "created_at"]
    ordering = ["name"]
    pagination_class = CustomPageNumberPagination

    def get_queryset(self) -> QuerySet[Service]:
        """
        Get queryset of services for current organization.

        Returns:
            QuerySet[Service]: Filtered queryset of non-deleted services
        """
        return Service.objects.filter(org=self.request.user.org, is_deleted=False)

    def perform_create(self, serializer: ServiceSerializer) -> None:
        """
        Create a new service and send notification.

        Args:
            serializer (ServiceSerializer): Validated serializer instance
        """
        service = serializer.save(org=self.request.user.org)
        logger.info(f"Created service {service.id}")
        # Send WebSocket notification
        notify_status_change.delay(service.id)

    def perform_update(self, serializer: ServiceSerializer) -> None:
        """
        Update service and send notification.

        Args:
            serializer (ServiceSerializer): Validated serializer instance
        """
        service = serializer.save()
        # Send WebSocket notification
        notify_status_change.delay(service.id)

    def perform_destroy(self, instance: Service) -> None:
        """
        Soft delete service and send notification.

        Args:
            instance (Service): Service instance to delete
        """
        instance.soft_delete(user=self.request.user)
        # Send WebSocket notification for the soft delete
        notify_status_change.delay(instance.id, is_deleted=True)

    @action(detail=True, methods=["post"])
    def update_status(self, request: Any, pk: Optional[int] = None) -> Response:
        """
        Update service status.

        Args:
            request: Request object containing new status
            pk (Optional[int]): Primary key of service

        Returns:
            Response: Updated service data or error message
        """
        service = self.get_object()
        status = request.data.get("status")

        try:
            service.update_status(status, user=request.user)
            # Notify via WebSocket
            notify_status_change.delay(service.id)
            return Response(ServiceSerializer(service).data)
        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["get"])
    def active(self, request: Any) -> Response:
        """
        Get all active services for incident creation.

        Args:
            request: Request object

        Returns:
            Response: List of active services
        """
        services = (
            self.get_queryset()
            .filter(is_active=True, is_deleted=False)
            .order_by("name")
        )
        serializer = ServiceListSerializer(services, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def search(self, request: Any) -> Response:
        """
        Typeahead search for services.

        Args:
            request: Request object with query parameters:
                - q: search query string
                - rows: number of results (default 10)
                - page: page number (default 1)

        Returns:
            Response: Paginated search results
        """
        query = request.query_params.get("q", "").strip()
        services = Service.active.search_services(query=query)
        page = self.paginate_queryset(services)
        serializer = ServiceSerializer(page, many=True)
        return self.get_paginated_response(serializer.data)


class PublicServiceViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for public access to Service objects.

    Provides read-only access to active services for a given organization.
    No authentication required but includes rate limiting.
    Write operations (POST, PUT, PATCH, DELETE) are not allowed.

    Attributes:
        serializer_class: Serializer class for Service model
        permission_classes: Allows public read-only access
        throttle_classes: Rate limiting classes
        pagination_class: Class handling result pagination
    """

    serializer_class = ServiceListSerializer
    permission_classes = [
        ReadOnly,
        permissions.AllowAny,
    ]  # Explicitly enforce read-only for all users
    throttle_classes = [PublicEndpointThrottle]
    pagination_class = CustomPageNumberPagination

    def get_queryset(self) -> QuerySet[Service]:
        """
        Get queryset of public services for given organization.

        Returns:
            QuerySet[Service]: Filtered queryset of active, non-deleted services
        """
        org_slug = self.kwargs.get("org_slug")
        return Service.objects.filter(
            org__slug=org_slug, org__is_active=True, is_active=True, is_deleted=False
        ).order_by("name")

    @method_decorator(cache_page(60))  # Cache for 1 minute
    def list(self, request: Any, *args: Any, **kwargs: Any) -> Response:
        """
        List public services with caching.

        Args:
            request: Request object
            *args: Variable length argument list
            **kwargs: Arbitrary keyword arguments

        Returns:
            Response: List of public services
        """
        return super().list(request, *args, **kwargs)
