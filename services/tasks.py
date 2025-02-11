from celery import shared_task
from .models import Service
import logging
from typing import Optional
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .serializers import ServiceSerializer, ServiceListSerializer

logger = logging.getLogger(__name__)


@shared_task
def check_service_status() -> None:
    """
    Not implemented yet. Periodic task to check the status of all active services.

    Iterates through active services, checks their status, and updates if changed.
    Triggers notifications via WebSocket when status changes are detected.

    Returns:
        None
    """
    for service in Service.objects.filter(is_active=True):
        try:
            # Here you would implement the actual status check logic
            # For example, making HTTP requests, checking databases, etc.
            status = check_single_service(service)

            # Update service status if needed
            if status != service.status:
                service.status = status
                service.save()

                # Notify via WebSocket
                notify_status_change.delay(service.id)

        except Exception as e:
            print(f"Error checking service {service.name}: {str(e)}")


@shared_task
def notify_status_change(service_id: int, is_deleted: bool = False) -> None:
    """
    Send WebSocket notification for service status change to both
    private organization channel and public channel.

    Args:
        service_id (int): ID of the service that changed
        is_deleted (bool, optional): Whether the service was deleted. Defaults to False.

    Returns:
        None

    Raises:
        Service.DoesNotExist: If service with given ID is not found
    """
    try:
        # Get channel layer first
        channel_layer = get_channel_layer()

        if is_deleted:
            # For soft-deleted services, we need to get the org info
            service = Service.objects.select_related("org").get(id=service_id)

            # Basic deletion message
            message = {
                "type": "service_status_update",
                "data": {"id": service_id, "is_deleted": True},
            }

            # Send to both channels
            async_to_sync(channel_layer.group_send)(f"org_{service.org.id}", message)
            async_to_sync(channel_layer.group_send)(
                f"public_status_{service.org.slug}", message
            )

            logger.info(f"Notified service deletion {service_id} to both channels")
            return

        # For non-deletion updates
        service = Service.objects.select_related("org").get(id=service_id)

        # Send to private organization channel (with full details)
        private_message = {
            "type": "service_status_update",
            "data": ServiceSerializer(service).data,
        }
        async_to_sync(channel_layer.group_send)(
            f"org_{service.org.id}", private_message
        )

        # Send to public channel (with limited details)
        if service.is_active and not service.is_deleted:
            public_message = {
                "type": "service_status_update",
                "data": ServiceListSerializer(service).data,
            }
            async_to_sync(channel_layer.group_send)(
                f"public_status_{service.org.slug}", public_message
            )

        logger.info(
            f"Notified status change for service {service.id} to both private and public channels"
        )
    except Service.DoesNotExist:
        logger.error(f"Service {service_id} not found")
    except Exception as e:
        logger.error(f"Error notifying service status change: {str(e)}", exc_info=True)


def check_single_service(service: Service) -> str:
    """
    Check the status of a single service.

    This is a placeholder that should be replaced with actual monitoring logic.

    Args:
        service (Service): The service instance to check

    Returns:
        str: The status of the service, currently hardcoded to 'operational'
    """
    return "operational"  # Placeholder return
