from django.db import models
from core.models import BaseModel


class Organization(BaseModel):
    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True)
    description = models.TextField(blank=True)
    website = models.URLField(blank=True)
    logo = models.ImageField(upload_to="org_logos/", null=True, blank=True)
    is_active = models.BooleanField(default=True)
    clerk_org_id = models.CharField(max_length=255, unique=True, null=True)

    def __str__(self):
        return self.name

    class Meta:
        ordering = ["name"]
        indexes = [
            models.Index(fields=["clerk_org_id"]),
        ]


class Team(BaseModel):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    org = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="teams"
    )
    members = models.ManyToManyField(
        "users.User", through="TeamMembership", through_fields=("team", "user")
    )

    def __str__(self):
        return f"{self.org.name} - {self.name}"

    class Meta:
        unique_together = ["org", "name"]
        ordering = ["name"]


class TeamMembership(BaseModel):
    ROLE_CHOICES = [
        ("admin", "Admin"),
        ("member", "Member"),
    ]

    team = models.ForeignKey(Team, on_delete=models.CASCADE)
    user = models.ForeignKey("users.User", on_delete=models.CASCADE)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="member")

    class Meta:
        unique_together = ["team", "user"]
