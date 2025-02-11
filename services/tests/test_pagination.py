from django.test import TestCase, override_settings
from django.urls import reverse, include, path
from rest_framework.test import APITestCase, APIClient
from organizations.models import Organization
from users.models import User
from services.models import Service
from django.utils import timezone


@override_settings(ROOT_URLCONF="core.tests.urls")
class ServicePaginationTestCase(APITestCase):
    def setUp(self):
        # Create test organization
        self.org = Organization.objects.create(name="Test Org", slug="test-org")

        # Create test user
        self.user = User.objects.create(
            email="test@example.com", org=self.org, role="admin"
        )

        # Create test services
        self.services = []
        for i in range(25):  # Create 25 services to test pagination
            service = Service.objects.create(
                name=f"Test Service {i}",
                description=f"Description {i}",
                status="operational",
                org=self.org,
            )
            self.services.append(service)

        # Setup client
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_default_pagination(self):
        """Test default pagination behavior"""
        response = self.client.get(reverse("services-list"))
        self.assertEqual(response.status_code, 200)
        self.assertIn("total", response.data)
        self.assertIn("page", response.data)
        self.assertIn("rows", response.data)
        self.assertIn("results", response.data)
        self.assertEqual(len(response.data["results"]), 20)  # Default page size
        self.assertEqual(response.data["total"], 25)
        self.assertEqual(response.data["page"], 1)

    def test_search_pagination(self):
        """Test pagination with search functionality"""
        response = self.client.get(reverse("services-search") + "?q=Test&rows=10")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["results"]), 10)
        self.assertEqual(response.data["total"], 25)
        self.assertEqual(response.data["page"], 1)

    def test_public_service_pagination(self):
        """Test pagination on public service endpoints"""
        # Logout the authenticated client
        self.client.logout()

        response = self.client.get(
            reverse("public:services-list", kwargs={"org_slug": self.org.slug})
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("total", response.data)
        self.assertIn("page", response.data)
        self.assertIn("rows", response.data)
        self.assertIn("results", response.data)

    def test_pagination_with_filters(self):
        """Test pagination with status filter"""
        # Update some services to have different status
        for service in self.services[:5]:
            service.status = "degraded"
            service.save()

        response = self.client.get(reverse("services-list") + "?status=degraded")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["total"], 5)
        self.assertEqual(len(response.data["results"]), 5)

    def test_pagination_ordering(self):
        """Test pagination with ordering"""
        response = self.client.get(reverse("services-list") + "?ordering=name")
        self.assertEqual(response.status_code, 200)
        results = response.data["results"]
        self.assertTrue(
            all(
                results[i]["name"] <= results[i + 1]["name"]
                for i in range(len(results) - 1)
            )
        )
