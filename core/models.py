from django.db import models
from django.conf import settings


class BaseModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="%(class)s_created",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="%(class)s_updated",
    )

    class Meta:
        abstract = True


class TenantModel(BaseModel):
    org = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="%(class)s_items",
    )

    class Meta:
        abstract = True
