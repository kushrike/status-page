# Generated by Django 4.2.19 on 2025-02-11 06:58

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("organizations", "0003_organization_clerk_org_id_and_more"),
        ("services", "0005_remove_incidentupdate_incident_and_more"),
    ]

    operations = [
        migrations.AlterUniqueTogether(
            name="service",
            unique_together={("org", "name", "is_deleted")},
        ),
    ]
