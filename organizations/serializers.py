from rest_framework import serializers
from .models import Organization


class OrganizationSerializer(serializers.ModelSerializer):
    """
    Serializer for the Organization model with full details.

    Includes all organization fields plus a calculated member count.
    Used for authenticated organization views and management.
    """

    member_count = serializers.SerializerMethodField()

    class Meta:
        model = Organization
        fields = [
            "id",
            "name",
            "slug",
            "description",
            "website",
            "logo",
            "is_active",
            "member_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def get_member_count(self, obj: Organization) -> int:
        """
        Calculate the total number of members in the organization.

        Args:
            obj: Organization instance

        Returns:
            int: Count of organization members
        """
        return obj.members.count()


class OrganizationPublicSerializer(serializers.ModelSerializer):
    """
    Serializer for public organization information.

    Includes only publicly visible fields and makes them all read-only.
    Used for public API endpoints.
    """

    class Meta:
        model = Organization
        fields = ["id", "name", "slug", "description", "website", "logo"]
        read_only_fields = fields
