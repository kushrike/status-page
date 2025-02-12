import jwt
from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework import authentication
from rest_framework.exceptions import AuthenticationFailed
from organizations.models import Organization
from django.utils.text import slugify
import logging
from typing import Tuple, Any, Optional

logger = logging.getLogger(__name__)
User = get_user_model()


class ClerkAuthentication(authentication.BaseAuthentication):
    """
    Custom authentication class for Clerk authentication.

    This class handles JWT token authentication from Clerk.com, validating tokens
    and creating/updating users based on the token payload. It also handles
    organization membership and roles from the token claims.

    Inherits from DRF's BaseAuthentication class.
    """

    def authenticate(self, request: Any) -> Optional[Tuple[Any, None]]:
        """
        Authenticate the request using Clerk JWT token.

        Args:
            request: The request object containing the Authorization header with JWT token

        Returns:
            Optional[Tuple[User, None]]: A tuple containing the authenticated user and None if successful,
                                       or None if no token is present

        Raises:
            AuthenticationFailed: If token is invalid or authentication fails
        """
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return None

        try:
            token = auth_header.split(" ")[1]
            logger.info("Attempting to decode token")

            logger.info(f"Public Key: {settings.CLERK_PEM_PUBLIC_KEY}")
            logger.info(f"Token: {token}")
            logger.info(f"Token: {settings.CLERK_JWT_AUDIENCE}")
            logger.info(f"Token: {settings.CLERK_ISSUER_URL}")
            payload = jwt.decode(
                token,
                settings.CLERK_PEM_PUBLIC_KEY,
                algorithms=["RS256"],
                audience=settings.CLERK_JWT_AUDIENCE,
                issuer=settings.CLERK_ISSUER_URL,
                options={
                    "verify_exp": True,
                    "verify_aud": True,
                    "verify_iss": True,
                },
            )

            # Get or create user
            user = User.objects.get_or_create(
                clerk_id=payload["sub"],
                defaults={
                    "email": payload.get("email", ""),
                    "username": payload.get("email", payload["sub"]),
                    "first_name": payload.get("given_name", ""),
                    "last_name": payload.get("family_name", ""),
                },
            )[0]

            # Get Clerk organization data from token
            clerk_org_id = payload.get("org_id")
            # Handle Clerk's org:admin format
            clerk_org_role = payload.get("org_role", "org:member")
            clerk_org_slug = payload.get("org_slug")
            clerk_org_name = payload.get("org_name")

            logger.info(
                f"Clerk org data - ID: {clerk_org_id}, Role: {clerk_org_role}, Name: {clerk_org_name}"
            )

            if not clerk_org_id:
                logger.warning(
                    f"No organization ID found in token. Full payload: {payload}"
                )
                # If no org in token, remove user's org association
                if user.org:
                    logger.info(
                        f"Removing organization association for user {user.email}"
                    )
                    user.org = None
                    user.role = "member"
                    user.save()
                return (user, None)

            # Get or create organization based on Clerk org ID
            org, created = Organization.objects.get_or_create(
                clerk_org_id=clerk_org_id,
                defaults={
                    "name": clerk_org_name or f"Organization {clerk_org_id}",
                    "slug": clerk_org_slug or slugify(clerk_org_id),
                    "created_by": user,
                },
            )

            logger.info(
                f"Organization {'created' if created else 'retrieved'}: {org.name}"
            )

            # Update user's organization and role
            user.org = org
            # Map Clerk's org:admin role format to your system roles
            user.role = "admin" if clerk_org_role == "org:admin" else "member"
            user.save()

            logger.info(
                f"Updated user {user.email} with org {org.name} and role {user.role}"
            )

            return (user, None)

        except jwt.InvalidTokenError as e:
            logger.error(f"Invalid token error: {str(e)}")
            raise AuthenticationFailed(f"Invalid token: {str(e)}")
        except Exception as e:
            logger.error(f"Authentication error: {str(e)}", exc_info=True)
            raise AuthenticationFailed(f"Authentication error: {str(e)}")
