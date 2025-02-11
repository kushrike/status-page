from django.db import models, transaction
from core.models import TenantModel
from django.utils import timezone
from django.core.exceptions import ValidationError
from django.db.models import Q


class ActiveManager(models.Manager):
    def get_queryset(self):
        return super().get_queryset().select_related("service", "org")

    def search_incidents(self, org, query=None, status=None):
        """
        Search for incidents with filters
        Args:
            org: Organization to filter by
            query (str, optional): Search query string
            status (str, optional): Status to filter by
        Returns:
            QuerySet: Filtered queryset of incidents
        """
        queryset = self.get_queryset().filter(org=org)

        if status:
            queryset = queryset.filter(status=status)

        if query:
            queryset = queryset.filter(
                Q(title__icontains=query) | Q(description__icontains=query)
            )

        return queryset.order_by("-started_at")

    def get_public_incidents(self, org_slug):
        """
        Get public incidents for an organization
        Args:
            org_slug (str): Organization slug
        Returns:
            QuerySet: Filtered queryset of public incidents
        """
        return (
            self.get_queryset()
            .filter(org__slug=org_slug, org__is_active=True, service__is_active=True)
            .select_related("service")
            .order_by("-started_at")
        )


class Incident(TenantModel):
    class Status(models.TextChoices):
        INVESTIGATING = "investigating", "Investigating"
        IDENTIFIED = "identified", "Identified"
        MONITORING = "monitoring", "Monitoring"
        RESOLVED = "resolved", "Resolved"

    title = models.CharField(max_length=255)
    description = models.TextField()
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.INVESTIGATING
    )
    started_at = models.DateTimeField()
    resolved_at = models.DateTimeField(null=True, blank=True)
    service = models.ForeignKey(
        "services.Service",
        on_delete=models.PROTECT,
        related_name="incidents",
        null=True,  # Temporarily allow null
        blank=True,
    )
    from_state = models.CharField(
        max_length=20, null=True, blank=True
    )  # Temporarily allow null
    to_state = models.CharField(
        max_length=20, null=True, blank=True
    )  # Temporarily allow null

    objects = models.Manager()
    active = ActiveManager()

    def __str__(self):
        return self.title

    class Meta:
        ordering = ["-started_at"]
        indexes = [
            models.Index(fields=["org", "-started_at"]),
            models.Index(fields=["status"]),
            models.Index(fields=["service", "status"]),
        ]

    def clean(self):
        # Validate states against Service.Status choices
        from services.models import Service

        valid_states = dict(Service.Status.choices).keys()

        if self.from_state not in valid_states:
            raise ValidationError(
                {
                    "from_state": f'Invalid state. Must be one of: {", ".join(valid_states)}'
                }
            )

        if self.to_state not in valid_states:
            raise ValidationError(
                {
                    "to_state": f'Invalid state. Must be one of: {", ".join(valid_states)}'
                }
            )

        # Validate status transitions
        if self.pk:  # If updating existing incident
            old_incident = Incident.objects.get(pk=self.pk)
            if (
                old_incident.status == self.Status.RESOLVED
                and self.status != self.Status.RESOLVED
            ):
                raise ValidationError(
                    "Cannot reopen a resolved incident. Create a new incident instead."
                )

    def save(self, *args, **kwargs):
        self.full_clean()  # Run validation

        with transaction.atomic():
            is_new = self.pk is None

            if is_new:
                # Lock the service for update to prevent race conditions
                self.service = self.service.__class__.objects.select_for_update().get(
                    pk=self.service.pk
                )
                self.from_state = self.service.status

                # Update service status
                self.service.status = self.to_state
                self.service.save()

            elif self.status == self.Status.RESOLVED and not self.resolved_at:
                self.resolved_at = timezone.now()

                # Lock the service and recalculate its status
                service = self.service.__class__.objects.select_for_update().get(
                    pk=self.service.pk
                )

                # Get all active incidents for this service except this one
                active_incidents = (
                    service.incidents.exclude(status=self.Status.RESOLVED)
                    .exclude(pk=self.pk)
                    .order_by("-started_at")
                )

                if active_incidents.exists():
                    # Set service status to the most recent active incident's to_state
                    service.status = active_incidents.first().to_state
                else:
                    # No active incidents, return to operational
                    service.status = "operational"

                service.save()

            super().save(*args, **kwargs)

    def notify_update(self, is_deleted=False, org_info=None):
        """
        Send notifications for incident updates
        Args:
            is_deleted (bool): Whether the incident was deleted
            org_info (dict): Organization info for deletion notifications
        """
        from .tasks import notify_incident_update
        from services.tasks import notify_status_change

        if is_deleted and not org_info:
            org_info = {"id": self.org.id, "slug": self.org.slug}

        notify_incident_update.delay(self.id, is_deleted=is_deleted, org_info=org_info)
        notify_status_change.delay(self.service.id)

    def delete_and_notify(self, user=None):
        """
        Delete the incident and send notifications
        Args:
            user (User, optional): The user performing the deletion
        """
        org_info = {"id": self.org.id, "slug": self.org.slug}
        incident_id = self.id
        service_id = self.service.id

        # Delete the instance
        self.delete()

        # Send notifications
        from .tasks import notify_incident_update
        from services.tasks import notify_status_change

        notify_incident_update.delay(incident_id, is_deleted=True, org_info=org_info)
        notify_status_change.delay(service_id)
