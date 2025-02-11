from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    OrganizationViewSet,
    PublicOrganizationViewSet,
)

# Private endpoints router
router = DefaultRouter()
router.register(r"", OrganizationViewSet, basename="organization")

# Public endpoints with explicit paths
public_urls = [
    path(
        "",
        PublicOrganizationViewSet.as_view({"get": "list"}),
        name="public-organization-list",
    ),
    path(
        "<slug:org_slug>/",
        PublicOrganizationViewSet.as_view({"get": "retrieve"}),
        name="public-organization-detail",
    ),
]

urlpatterns = [
    path("", include(router.urls)),
    path("public/", include(public_urls)),
]
