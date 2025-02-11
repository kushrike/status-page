from django.urls import path, include
from rest_framework.routers import DefaultRouter
from services.views import ServiceViewSet, PublicServiceViewSet
from incidents.views import IncidentViewSet, PublicIncidentViewSet

# Create a router for regular endpoints
router = DefaultRouter()
router.register(r"services", ServiceViewSet, basename="services")
router.register(r"incidents", IncidentViewSet, basename="incidents")

# Create a router for public endpoints
public_router = DefaultRouter()
public_router.register(r"services", PublicServiceViewSet, basename="services")
public_router.register(r"incidents", PublicIncidentViewSet, basename="incidents")

urlpatterns = [
    path("api/", include(router.urls)),
    path("api/public/<str:org_slug>/", include((public_router.urls, "public"))),
]
