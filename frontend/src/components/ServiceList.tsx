import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchServices, fetchPublicServices } from '../api';
import { Service, PaginatedResponse } from '../types/types';
import { Pagination } from './Pagination';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  WrenchIcon,
} from '@heroicons/react/24/solid';
import { useParams } from 'react-router-dom';
import {
  addWebSocketHandler,
  getWebSocketManager,
  getPublicWebSocketManager,
} from '../utils/websocket';

interface ServiceStatusIconProps {
  status: Service['status'];
}

function ServiceStatusIcon({ status }: ServiceStatusIconProps) {
  switch (status) {
    case 'operational':
      return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
    case 'degraded':
      return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />;
    case 'partial':
      return <ExclamationTriangleIcon className="h-5 w-5 text-orange-500" />;
    case 'major':
      return <XCircleIcon className="h-5 w-5 text-red-500" />;
    case 'maintenance':
      return <WrenchIcon className="h-5 w-5 text-blue-500" />;
    default:
      return null;
  }
}

interface ServiceListProps {
  isPublic?: boolean;
  initialRows?: number;
}

export function ServiceList({ isPublic = false, initialRows = 5 }: ServiceListProps) {
  const { orgSlug } = useParams<{ orgSlug?: string }>();
  const [page, setPage] = useState(1);
  const [rows] = useState(initialRows);
  const queryClient = useQueryClient();

  // For public routes, we need orgSlug
  // For private routes, we don't need orgSlug as we use the authenticated user's org
  const shouldFetch = isPublic ? !!orgSlug : true;

  const { data: servicesData, isLoading } = useQuery({
    queryKey: isPublic ? ['public-services', orgSlug, page, rows] : ['services', page, rows],
    queryFn: () =>
      isPublic && orgSlug
        ? fetchPublicServices(orgSlug, { page, rows })
        : fetchServices({ page, rows }),
    enabled: shouldFetch,
  });

  useEffect(() => {
    const handleServiceUpdate = (data: Service | { id: string; is_deleted?: boolean }) => {
      // Get the base query key pattern
      const baseQueryKey = isPublic ? ['public-services', orgSlug] : ['services'];

      // Update queries directly instead of invalidating them
      queryClient.setQueriesData(
        {
          predicate: (query) => {
            const queryKey = query.queryKey;
            // Match any query that starts with our base key
            return (
              Array.isArray(queryKey) &&
              queryKey.length >= baseQueryKey.length &&
              queryKey
                .slice(0, baseQueryKey.length)
                .every((value, index) => value === baseQueryKey[index])
            );
          },
        },
        (oldData: PaginatedResponse<Service> | undefined) => {
          if (!oldData) return oldData;

          // Handle deletion
          if ('is_deleted' in data && data.is_deleted) {
            return {
              ...oldData,
              results: oldData.results.filter((service) => service.id !== data.id),
              total: oldData.total - 1,
            };
          }

          const serviceData = data as Service;
          const existingIndex = oldData.results.findIndex(
            (service) => service.id === serviceData.id
          );

          if (existingIndex !== -1) {
            // Update existing service
            return {
              ...oldData,
              results: oldData.results.map((service) =>
                service.id === serviceData.id ? serviceData : service
              ),
            };
          } else if (page === 1) {
            // Add new service only on the first page
            return {
              ...oldData,
              results: [serviceData, ...oldData.results.slice(0, -1)],
              total: oldData.total + 1,
            };
          }

          return oldData;
        }
      );

      // Log the update for debugging
      console.log('Updated service data:', data);
    };

    // Register handlers for both private and public WebSocket updates
    if (isPublic) {
      const publicManager = getPublicWebSocketManager();
      if (publicManager) {
        publicManager.addMessageHandler('service_status_update', handleServiceUpdate);
      }
    } else {
      addWebSocketHandler('service_status_update', handleServiceUpdate);
    }

    // Cleanup
    return () => {
      if (isPublic) {
        const publicManager = getPublicWebSocketManager();
        if (publicManager) {
          publicManager.removeMessageHandler('service_status_update');
        }
      } else {
        const manager = getWebSocketManager();
        if (manager) {
          manager.removeMessageHandler('service_status_update');
        }
      }
    };
  }, [queryClient, isPublic, orgSlug, page]);

  if (!shouldFetch) {
    return <div>Invalid organization</div>;
  }

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <h2 className="text-lg font-medium text-gray-900">System Status</h2>
      <div className="mt-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {servicesData?.results.slice(0, rows).map((service) => (
            <div
              key={service.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 p-4 shadow-sm transition-all hover:shadow-md"
            >
              <div className="flex items-center space-x-3">
                <ServiceStatusIcon status={service.status} />
                <div>
                  <h3 className="font-medium text-gray-900">{service.name}</h3>
                  <p className="text-sm text-gray-500">{service.description}</p>
                </div>
              </div>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  service.status === 'operational'
                    ? 'bg-green-100 text-green-800'
                    : service.status === 'degraded'
                      ? 'bg-yellow-100 text-yellow-800'
                      : service.status === 'partial'
                        ? 'bg-orange-100 text-orange-800'
                        : service.status === 'major'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-blue-100 text-blue-800'
                }`}
              >
                {service.status_display}
              </span>
            </div>
          ))}
        </div>
        {servicesData && (
          <div className="mt-4">
            <Pagination
              total={servicesData.total}
              page={servicesData.page}
              rows={rows}
              onPageChange={setPage}
              onRowsChange={() => {}}
              showRowsDropdown={false}
            />
          </div>
        )}
      </div>
    </div>
  );
}
