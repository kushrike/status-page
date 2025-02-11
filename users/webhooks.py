# users/webhooks.py
import json
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
from .models import User


@csrf_exempt
def clerk_webhook(request):
    payload = json.loads(request.body)
    event_type = payload["type"]

    if event_type == "user.created":
        user_data = payload["data"]
        User.objects.create(
            clerk_id=user_data["id"],
            email=user_data["email_addresses"][0]["email_address"],
            org_id=user_data["public_metadata"].get("org_id"),
            role=user_data["public_metadata"].get("role", "member"),
        )

    return JsonResponse({"status": "ok"})
