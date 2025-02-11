from rest_framework.exceptions import (
    APIException,
    AuthenticationFailed,
    NotAuthenticated,
    PermissionDenied,
)
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


class ServiceUnavailable(APIException):
    status_code = 503
    default_detail = "Service temporarily unavailable."
    default_code = "service_unavailable"


class InvalidOrganization(APIException):
    status_code = 400
    default_detail = "Invalid organization data."
    default_code = "invalid_organization"


def custom_exception_handler(exc, context):
    """
    Custom exception handler for DRF.

    Handles:
    1. Public endpoint authentication exceptions
    2. Standard DRF exceptions
    3. Unhandled exceptions
    """
    logger.info(f"Exception handler called for {exc.__class__.__name__}")
    logger.info(f"Request path: {context['request'].path}")

    # Call DRF's default exception handler first
    response = exception_handler(exc, context)

    # If this is a public endpoint and we get an authentication error, allow the request
    if isinstance(exc, (AuthenticationFailed, NotAuthenticated, PermissionDenied)):
        request = context["request"]
        if getattr(request, "is_public_endpoint", False):
            logger.info("Allowing unauthenticated access to public endpoint")
            return None

    if response is None:
        logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)
        response = Response(
            {
                "error": "Internal server error",
                "detail": (
                    str(exc) if settings.DEBUG else "An unexpected error occurred"
                ),
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    return response
