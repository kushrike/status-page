from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import IncidentViewSet, PublicIncidentViewSet

router = DefaultRouter()
router.register(r"", IncidentViewSet, basename="incident")

public_router = DefaultRouter()
public_router.register(
    r"(?P<org_slug>[\w-]+)", PublicIncidentViewSet, basename="public-incident"
)

urlpatterns = [
    path("", include(router.urls)),
    path("public/", include(public_router.urls)),
]
