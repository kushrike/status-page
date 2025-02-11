from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = "admin", "Admin"
        MEMBER = "member", "Member"

    clerk_id = models.CharField(max_length=255, unique=True)
    org = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.SET_NULL,
        null=True,
        related_name="members",
    )
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.MEMBER)
    avatar_url = models.URLField(blank=True)
    phone_number = models.CharField(max_length=20, blank=True)
    timezone = models.CharField(max_length=50, default="UTC")
    last_active = models.DateTimeField(null=True, blank=True)
    notification_preferences = models.JSONField(default=dict)

    def __str__(self):
        return self.email or self.username

    @property
    def is_org_admin(self):
        return self.role == self.Role.ADMIN

    class Meta:
        indexes = [
            models.Index(fields=["org", "role"]),
            models.Index(fields=["clerk_id"]),
        ]
