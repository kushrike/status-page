from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ServiceViewSet,
    PublicServiceViewSet,
)

router = DefaultRouter()
router.register(r"", ServiceViewSet, basename="service")

public_router = DefaultRouter()
public_router.register(
    r"(?P<org_slug>[\w-]+)", PublicServiceViewSet, basename="public-service"
)

urlpatterns = [
    path("", include(router.urls)),
    path("public/", include(public_router.urls)),
]
