from rest_framework import permissions


class IsOrganizationMember(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.org)

    def has_object_permission(self, request, view, obj):
        return obj.org == request.user.org


class IsOrganizationAdmin(IsOrganizationMember):
    def has_permission(self, request, view):
        return super().has_permission(request, view) and request.user.role == "admin"


class ReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.method in permissions.SAFE_METHODS


class IsOrganizationAdminOrReadOnly(IsOrganizationMember):
    """
    Custom permission class that allows:
    - Read access to authenticated organization members
    - Write access only to organization admins
    """

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user.role == "admin"

    def has_object_permission(self, request, view, obj):
        if not super().has_object_permission(request, view, obj):
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user.role == "admin"
