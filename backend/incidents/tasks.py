from celery import shared_task
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .models import Incident
from .serializers import IncidentSerializer
import logging

logger = logging.getLogger(__name__)


@shared_task(bind=True)
def notify_incident_update(self, incident_id, is_deleted=False, org_info=None):
    """
    Send WebSocket notification for incident updates to both
    private organization channel and public channel

    Args:
        incident_id: ID of the incident
        is_deleted: Whether this is a deletion notification
        org_info: Dict containing org ID and slug for deletion notifications
    """
    try:
        # Get channel layer first
        channel_layer = get_channel_layer()

        if is_deleted:
            if not org_info:
                logger.error(
                    f"No org_info provided for incident deletion {incident_id}"
                )
                return

            # Basic deletion message
            message = {
                "type": "incident_update",
                "data": {"id": incident_id, "is_deleted": True},
            }

            # Send to both channels using pre-fetched org info
            async_to_sync(channel_layer.group_send)(f'org_{org_info["id"]}', message)
            async_to_sync(channel_layer.group_send)(
                f'public_status_{org_info["slug"]}', message
            )

            logger.info(f"Notified incident deletion {incident_id} to both channels")
            return

        # For non-deletion updates
        incident = Incident.objects.select_related("service", "org").get(id=incident_id)

        # Send to private organization channel (with full details)
        private_message = {
            "type": "incident_update",
            "data": IncidentSerializer(incident).data,
        }
        async_to_sync(channel_layer.group_send)(
            f"org_{incident.org.id}", private_message
        )

        # Send to public channel (with limited details) if the incident is public
        if incident.service.is_active and not incident.service.is_deleted:
            public_message = {
                "type": "incident_update",
                "data": IncidentSerializer(incident).data,
            }
            async_to_sync(channel_layer.group_send)(
                f"public_status_{incident.org.slug}", public_message
            )

        logger.info(
            f"Notified incident update {incident_id} to both private and public channels"
        )

    except Incident.DoesNotExist:
        logger.error(f"Incident {incident_id} not found")
    except Exception as e:
        logger.error(f"Error notifying incident update: {str(e)}", exc_info=True)
