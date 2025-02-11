from rest_framework import serializers
from .models import User


class UserSerializer(serializers.ModelSerializer):
    """
    Serializer for User model.

    Handles serialization and deserialization of User objects, including role display
    and read-only fields.

    Attributes:
        role_display (CharField): Human-readable display of user's role, read-only
    """

    role_display: serializers.CharField = serializers.CharField(
        source="get_role_display", read_only=True
    )

    class Meta:
        model = User
        fields: list[str] = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "role",
            "role_display",
            "avatar_url",
            "phone_number",
            "timezone",
            "last_active",
            "notification_preferences",
            "date_joined",
            "is_active",
        ]
        read_only_fields: list[str] = [
            "date_joined",
            "last_active",
            "is_active",
            "clerk_id",
        ]
