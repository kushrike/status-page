from rest_framework import serializers
from .models import Incident
from services.models import Service
from services.serializers import ServiceListSerializer
from django.db import transaction


class IncidentSerializer(serializers.ModelSerializer):
    """
    Serializer for the Incident model.

    Handles creation, updates and validation of incidents, including service state transitions.
    Provides human-readable display fields for status and state values.
    """

    service = ServiceListSerializer(read_only=True)
    service_id = serializers.PrimaryKeyRelatedField(
        queryset=Service.objects.all(), write_only=True, source="service"
    )
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    from_state = serializers.CharField(read_only=True)
    to_state = serializers.CharField(write_only=True)
    from_state_display = serializers.SerializerMethodField()
    to_state_display = serializers.SerializerMethodField()
    resulting_state = serializers.SerializerMethodField()

    class Meta:
        model = Incident
        fields = [
            "id",
            "title",
            "description",
            "status",
            "status_display",
            "started_at",
            "resolved_at",
            "service",
            "service_id",
            "from_state",
            "to_state",
            "from_state_display",
            "to_state_display",
            "resulting_state",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def get_from_state_display(self, obj):
        """
        Get human-readable display value for the from_state field.

        Args:
            obj: Incident instance

        Returns:
            str: Human-readable state name or None if no from_state
        """
        if not obj.from_state:
            return None
        return dict(Service.Status.choices).get(obj.from_state)

    def get_to_state_display(self, obj):
        """
        Get human-readable display value for the to_state field.

        Args:
            obj: Incident instance

        Returns:
            str: Human-readable state name or None if no to_state
        """
        if not obj.to_state:
            return None
        return dict(Service.Status.choices).get(obj.to_state)

    def get_resulting_state(self, obj):
        """
        Calculate the resulting service state based on active incidents.

        For unresolved incidents, returns the to_state of the most recent active incident,
        or 'operational' if no other active incidents exist.

        Args:
            obj: Incident instance

        Returns:
            str: Resulting service state or None if incident is resolved
        """
        if obj.status == Incident.Status.RESOLVED or not obj.service:
            return None

        active_incidents = (
            obj.service.incidents.exclude(status=Incident.Status.RESOLVED)
            .exclude(id=obj.id)
            .order_by("-started_at")
        )

        if active_incidents.exists():
            return active_incidents.first().to_state
        return "operational"

    def validate(self, data):
        """
        Validate the incident data.

        Performs validation for:
        - Required fields on creation
        - Valid state transitions
        - Service state changes on resolution

        Args:
            data: Dict of field values to validate

        Returns:
            Dict: Validated data

        Raises:
            ValidationError: If validation fails
        """
        service = data.get("service")
        to_state = data.get("to_state")
        status = data.get("status")

        if not self.instance:
            if not service or not to_state:
                raise serializers.ValidationError(
                    "Both service and to_state are required"
                )

            if to_state not in dict(Service.Status.choices):
                raise serializers.ValidationError(f"Invalid state: {to_state}")

            valid_next_states = Service.get_valid_next_states(service.status)
            if to_state not in valid_next_states:
                current_status = service.get_status_display()
                raise serializers.ValidationError(
                    f"Invalid state transition. From '{current_status}', you can only transition to: "
                    f"{', '.join(s.title() for s in valid_next_states)}"
                )
        else:
            data.pop("to_state", None)

        if status == Incident.Status.RESOLVED:
            active_incidents = service.incidents.exclude(
                status=Incident.Status.RESOLVED
            )
            if self.instance:
                active_incidents = active_incidents.exclude(id=self.instance.id)

            if active_incidents.exists():
                data["_warning"] = (
                    "Service will remain in degraded state due to other active incidents"
                )

        return data

    def create(self, validated_data):
        """
        Create a new incident and update the associated service state.

        Uses a transaction to ensure service state is updated atomically with incident creation.

        Args:
            validated_data: Dict of validated data for creating the incident

        Returns:
            Incident: Created incident instance
        """
        service = validated_data["service"]
        to_state = validated_data["to_state"]

        with transaction.atomic():
            service = Service.objects.select_for_update().get(pk=service.pk)
            validated_data["from_state"] = service.status
            incident = super().create(validated_data)
            service.status = to_state
            service.save()
            return incident

    def update(self, instance, validated_data):
        """
        Update an existing incident and handle service state changes.

        When resolving an incident, updates the service state based on other active incidents.
        Uses a transaction to ensure consistency.

        Args:
            instance: Existing incident instance to update
            validated_data: Dict of validated data for the update

        Returns:
            Incident: Updated incident instance
        """
        old_status = instance.status
        new_status = validated_data.get("status", old_status)

        with transaction.atomic():
            incident = Incident.objects.select_for_update().get(pk=instance.pk)
            service = Service.objects.select_for_update().get(pk=incident.service.pk)
            incident = super().update(incident, validated_data)

            if old_status != new_status and new_status == Incident.Status.RESOLVED:
                active_incidents = (
                    service.incidents.exclude(status=Incident.Status.RESOLVED)
                    .exclude(id=incident.id)
                    .order_by("-created_at")
                )

                if active_incidents.exists():
                    service.status = active_incidents.first().to_state
                else:
                    service.status = "operational"
                service.save()
            return incident
