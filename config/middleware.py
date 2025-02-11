import jwt
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from organizations.models import Organization


class ClerkJWTAuthenticationMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        token = request.headers.get("Authorization", "").split("Bearer ")[-1]
        if token:
            try:
                payload = jwt.decode(
                    token, settings.CLERK_PEM_PUBLIC_KEY, algorithms=["RS256"]
                )
                request.org = Organization.objects.get(id=payload["org_id"])
                request.user = payload  # Simplified; map to Django user if needed
            except (jwt.PyJWTError, Organization.DoesNotExist):
                request.user = AnonymousUser()
        return self.get_response(request)


class OrganizationMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.user.is_authenticated:
            # Attach org and role from Clerk JWT
            request.org = request.user.org
            request.role = request.user.role
        return self.get_response(request)
