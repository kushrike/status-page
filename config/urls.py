from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static


api_patterns = [
    path("", include("core.urls")),
    path("organizations/", include("organizations.urls")),
    path("services/", include("services.urls")),
    path("incidents/", include("incidents.urls")),
    path("users/", include("users.urls")),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include((api_patterns, "api"), namespace="v1")),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
