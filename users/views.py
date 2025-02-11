from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from core.permissions import IsOrganizationAdmin, IsOrganizationMember
from .models import User
from .serializers import UserSerializer
from core.pagination import CustomPageNumberPagination
from django.db.models import QuerySet
from rest_framework.request import Request
from typing import List, Type


class UserViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing User objects.

    Provides CRUD operations for users within an organization with appropriate permission checks.
    Includes custom actions for retrieving current user and updating user roles.
    """

    serializer_class: Type[UserSerializer] = UserSerializer
    permission_classes: List[Type[permissions.BasePermission]] = [IsOrganizationMember]
    filterset_fields: List[str] = ["role"]
    search_fields: List[str] = ["username", "email", "first_name", "last_name"]
    ordering_fields: List[str] = ["username", "email", "last_active"]
    ordering: List[str] = ["username"]
    pagination_class: Type[CustomPageNumberPagination] = CustomPageNumberPagination

    def get_queryset(self) -> QuerySet:
        """
        Get the queryset of users filtered by the current user's organization.

        Returns:
            QuerySet: Filtered queryset of User objects
        """
        return User.objects.filter(org=self.request.user.org)

    def get_permissions(self) -> List[permissions.BasePermission]:
        """
        Get permissions based on the current action.

        Requires organization admin permissions for create, update, and delete operations.

        Returns:
            List[permissions.BasePermission]: List of permission instances
        """
        if self.action in ["create", "update", "partial_update", "destroy"]:
            self.permission_classes = [IsOrganizationAdmin]
        return super().get_permissions()

    @action(detail=False, methods=["get"])
    def me(self, request: Request) -> Response:
        """
        Retrieve the current user's information.

        Args:
            request (Request): The incoming request

        Returns:
            Response: Serialized current user data
        """
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def update_role(self, request: Request, pk: str = None) -> Response:
        """
        Update the role of a specific user.

        Args:
            request (Request): The incoming request
            pk (str, optional): Primary key of the user to update

        Returns:
            Response: Updated user data or error message

        Raises:
            403: If the requesting user is not an organization admin
            400: If the provided role is invalid
        """
        if not request.user.is_org_admin:
            return Response(
                {"error": "Only organization admins can update roles"},
                status=status.HTTP_403_FORBIDDEN,
            )

        user = self.get_object()
        role = request.data.get("role")

        if not role or role not in dict(User.Role.choices):
            return Response(
                {"error": "Invalid role"}, status=status.HTTP_400_BAD_REQUEST
            )

        user.role = role
        user.save(update_fields=["role"])

        return Response(UserSerializer(user).data)
