from django.test import TestCase, override_settings
from django.urls import reverse, include, path
from rest_framework.test import APITestCase, APIClient
from organizations.models import Organization
from users.models import User
from incidents.models import Incident
from services.models import Service
from django.utils import timezone


@override_settings(ROOT_URLCONF="core.tests.urls")
class IncidentPaginationTestCase(APITestCase):
    def setUp(self):
        # Create test organization
        self.org = Organization.objects.create(name="Test Org", slug="test-org")

        # Create test user
        self.user = User.objects.create(
            email="test@example.com", org=self.org, role="admin"
        )

        # Create test service
        self.service = Service.objects.create(
            name="Test Service", org=self.org, status="operational"
        )

        # Create test incidents
        self.incidents = []
        for i in range(25):  # Create 25 incidents to test pagination
            incident = Incident.objects.create(
                title=f"Test Incident {i}",
                description=f"Description {i}",
                status="investigating",
                started_at=timezone.now(),
                service=self.service,
                org=self.org,
                created_by=self.user,
                updated_by=self.user,
                from_state="operational",
                to_state="major",
            )
            self.incidents.append(incident)

        # Setup client
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_default_pagination(self):
        """Test default pagination behavior"""
        response = self.client.get(reverse("incidents-list"))
        self.assertEqual(response.status_code, 200)
        self.assertIn("total", response.data)
        self.assertIn("page", response.data)
        self.assertIn("rows", response.data)
        self.assertIn("results", response.data)
        self.assertEqual(len(response.data["results"]), 20)  # Default page size
        self.assertEqual(response.data["total"], 25)
        self.assertEqual(response.data["page"], 1)

    def test_custom_page_size(self):
        """Test custom page size using rows parameter"""
        response = self.client.get(reverse("incidents-list") + "?rows=10")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["results"]), 10)
        self.assertEqual(response.data["rows"], 10)

    def test_pagination_with_page_parameter(self):
        """Test pagination with specific page"""
        response = self.client.get(reverse("incidents-list") + "?page=2&rows=10")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["results"]), 10)
        self.assertEqual(response.data["page"], 2)

    def test_pagination_last_page(self):
        """Test pagination behavior on last page"""
        response = self.client.get(reverse("incidents-list") + "?page=3&rows=10")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["results"]), 5)  # Last 5 items
        self.assertEqual(response.data["page"], 3)

    def test_pagination_invalid_page(self):
        """Test pagination with invalid page number"""
        response = self.client.get(reverse("incidents-list") + "?page=999")
        self.assertEqual(response.status_code, 404)

    def test_max_page_size(self):
        """Test that page size is capped at max_page_size"""
        response = self.client.get(reverse("incidents-list") + "?rows=200")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            len(response.data["results"]), 25
        )  # All items since we have only 25
        self.assertEqual(response.data["total"], 25)  # Total should be 25

    def test_public_endpoint_pagination(self):
        """Test pagination on public endpoints"""
        # Logout the authenticated client
        self.client.logout()

        response = self.client.get(
            reverse("public:incidents-list", kwargs={"org_slug": self.org.slug})
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("total", response.data)
        self.assertIn("page", response.data)
        self.assertIn("rows", response.data)
        self.assertIn("results", response.data)

    def test_empty_page(self):
        """Test pagination behavior with empty queryset"""
        # Delete all incidents
        Incident.objects.all().delete()

        response = self.client.get(reverse("incidents-list"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["results"]), 0)
        self.assertEqual(response.data["total"], 0)
        self.assertEqual(response.data["page"], 1)
