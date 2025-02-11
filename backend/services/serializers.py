from rest_framework import serializers
from .models import Service
from typing import List, Dict


class ServiceListSerializer(serializers.ModelSerializer):
    """
    Simplified serializer for Service model when used in nested relationships.

    Attributes:
        status_display (CharField): Human readable display of service status
    """

    status_display: serializers.CharField = serializers.CharField(
        source="get_status_display", read_only=True
    )

    class Meta:
        model = Service
        fields = ["id", "name", "description", "status", "status_display"]


class ServiceSerializer(serializers.ModelSerializer):
    """
    Full serializer for Service model with additional computed fields.

    Attributes:
        status_display (CharField): Human readable display of service status
        valid_next_states (SerializerMethodField): List of valid status transitions
    """

    status_display: serializers.CharField = serializers.CharField(
        source="get_status_display", read_only=True
    )
    valid_next_states: serializers.SerializerMethodField = (
        serializers.SerializerMethodField()
    )

    class Meta:
        model = Service
        fields = [
            "id",
            "name",
            "description",
            "status",
            "status_display",
            "is_active",
            "valid_next_states",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def get_valid_next_states(self, obj: Service) -> List[Dict[str, str]]:
        """
        Get list of valid status transitions for the service.

        Args:
            obj (Service): The service instance being serialized

        Returns:
            List[Dict[str, str]]: List of dictionaries containing value and label
                for each valid next status
        """
        next_states = Service.get_valid_next_states(obj.status)
        return [
            {"value": state, "label": dict(Service.Status.choices)[state]}
            for state in next_states
        ]
