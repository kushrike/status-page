from django.conf import settings
from django.http import Http404
from rest_framework.exceptions import PermissionDenied
import logging

logger = logging.getLogger(__name__)


class PublicEndpointMiddleware:
    """
    Middleware to identify public endpoints based on configured paths.

    This middleware checks if the current request path matches any of the configured
    public endpoint paths defined in settings.PUBLIC_ENDPOINTS. It sets a flag
    `is_public_endpoint` on the request object that can be used by other middleware
    or views to determine if the current request is to a public endpoint.

    Attributes:
        get_response: The next middleware or view in the chain
        public_paths: List of URL path prefixes that should be considered public,
                     loaded from settings.PUBLIC_ENDPOINTS
    """

    def __init__(self, get_response):
        self.get_response = get_response
        # Get public paths from settings, with a fallback empty list if not defined
        self.public_paths = getattr(settings, "PUBLIC_ENDPOINTS", [])

    def __call__(self, request):
        # Check if this is a public endpoint
        is_public = any(request.path.startswith(path) for path in self.public_paths)
        request.is_public_endpoint = is_public
        logger.info(
            f"PublicEndpointMiddleware: path={request.path}, is_public={is_public}"
        )
        return self.get_response(request)


class TenantMiddleware:
    """
    Middleware to handle multi-tenancy by organization.

    This middleware ensures that authenticated users have an associated organization
    and makes that organization easily accessible throughout the request. It skips
    tenant checks for public endpoints, admin pages, and unauthenticated users.

    Attributes:
        get_response: The next middleware or view in the chain
    """

    def __init__(self, get_response):
        """Initialize the middleware with the next handler in the chain."""
        self.get_response = get_response

    def __call__(self, request):
        """
        Process each request to enforce tenant isolation.

        Args:
            request: The incoming HTTP request

        Returns:
            The response from the next handler

        Raises:
            PermissionDenied: If an authenticated user has no associated organization
        """
        logger.info(f"TenantMiddleware: Processing request to {request.path}")

        # Skip tenant check for public endpoints
        if getattr(request, "is_public_endpoint", False):
            logger.info("TenantMiddleware: Skipping tenant check for public endpoint")
            return self.get_response(request)

        if not hasattr(request, "user") or not request.user.is_authenticated:
            logger.info(
                "TenantMiddleware: No authenticated user, skipping tenant check"
            )
            return self.get_response(request)

        # Skip tenant check for admin
        if request.path.startswith("/admin/"):
            logger.info("TenantMiddleware: Skipping tenant check for admin")
            return self.get_response(request)

        # Ensure user has an organization
        if not request.user.org:
            logger.warning(
                f"TenantMiddleware: User {request.user.email} has no organization"
            )
            raise PermissionDenied("User is not associated with any organization")

        # Set organization in request for easy access
        request.organization = request.user.org
        logger.info(
            f"TenantMiddleware: Set organization {request.organization.name} for user {request.user.email}"
        )

        response = self.get_response(request)
        return response
