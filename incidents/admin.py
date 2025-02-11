from django.contrib import admin
from .models import Incident


@admin.register(Incident)
class IncidentAdmin(admin.ModelAdmin):
    list_display = ("title", "service", "status", "created_at", "updated_at")
    list_filter = ("status", "service")
    search_fields = ("title",)
    ordering = ("-created_at",)
