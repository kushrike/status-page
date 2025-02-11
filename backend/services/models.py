from django.db import models
from organizations.models import Organization
from core.models import TenantModel
from django.utils import timezone
from django.core.exceptions import ValidationError
from django.db.models import Q


class ActiveManager(models.Manager):
    """
    Custom manager for filtering active (non-deleted) services and providing search functionality.
    """

    def get_queryset(self) -> models.QuerySet:
        """
        Get queryset of non-deleted services.

        Returns:
            models.QuerySet: Queryset filtered to exclude deleted services
        """
        return super().get_queryset().filter(is_deleted=False)

    def search_services(
        self, query: str = None, is_active: bool = True
    ) -> models.QuerySet:
        """
        Search for services with pagination support.

        Args:
            query (str, optional): Search query string to filter services by name or description
            is_active (bool): Filter for active services only. Defaults to True.

        Returns:
            models.QuerySet: Filtered and ordered queryset of services
        """
        queryset = self.get_queryset().filter(is_active=is_active)

        if query:
            queryset = queryset.filter(
                Q(name__icontains=query) | Q(description__icontains=query)
            )

        return queryset.order_by("name")


class Service(TenantModel):
    """
    Model representing a service that can be monitored for status and incidents.

    Inherits from TenantModel for organization-specific service management.
    Includes status tracking, soft deletion, and status transition validation.
    """

    class Status(models.TextChoices):
        """Valid status choices for a service"""

        OPERATIONAL = "operational", "Operational"
        DEGRADED = "degraded", "Degraded Performance"
        PARTIAL = "partial", "Partial Outage"
        MAJOR = "major", "Major Outage"
        MAINTENANCE = "maintenance", "Under Maintenance"

    # Define valid forward transitions for incident creation
    VALID_INCIDENT_TRANSITIONS = {
        "operational": ["degraded", "partial", "major"],
        "degraded": ["partial", "major"],
        "partial": ["major"],
        "major": [],
        "maintenance": [],
    }

    @classmethod
    def get_valid_next_states(cls, current_state: str) -> list[str]:
        """
        Get valid next states from the current state for incident creation.

        Args:
            current_state (str): The current status of the service

        Returns:
            list[str]: List of valid status values that can be transitioned to
        """
        return cls.VALID_INCIDENT_TRANSITIONS.get(current_state, [])

    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.OPERATIONAL
    )
    is_active = models.BooleanField(default=True)
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="%(class)s_deleted",
    )
    org = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="services"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = models.Manager()
    active = ActiveManager()

    def soft_delete(self, user=None) -> None:
        """
        Soft delete the service by marking it as deleted.

        Args:
            user (User, optional): The user performing the deletion
        """
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.deleted_by = user
        self.save()

    def update_status(self, new_status: str, user=None) -> bool:
        """
        Update the service status with validation.

        Args:
            new_status (str): The new status to set
            user (User, optional): The user making the change

        Returns:
            bool: True if status was updated successfully

        Raises:
            ValidationError: If the provided status is invalid
        """
        if not new_status or new_status not in dict(self.Status.choices):
            raise ValidationError("Invalid status")

        self.status = new_status
        self.save(update_fields=["status", "updated_at"])
        return True

    def __str__(self) -> str:
        """
        String representation of the service.

        Returns:
            str: The service name
        """
        return self.name

    class Meta:
        ordering = ["name"]
        unique_together = ["org", "name", "is_deleted"]
        indexes = [
            models.Index(fields=["org", "status"]),
            models.Index(fields=["is_deleted"]),
        ]
