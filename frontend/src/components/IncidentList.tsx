import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchIncidents, fetchPublicIncidents } from '../api';
import { Incident, PaginatedResponse } from '../types/types';
import { Pagination } from './Pagination';
import { CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/solid';
import { useParams } from 'react-router-dom';
import {
  addWebSocketHandler,
  getWebSocketManager,
  getPublicWebSocketManager,
} from '../utils/websocket';

interface IncidentStatusIconProps {
  status: Incident['status'];
}

function IncidentStatusIcon({ status }: IncidentStatusIconProps) {
  switch (status) {
    case 'investigating':
      return <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />;
    case 'identified':
      return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />;
    case 'monitoring':
      return <CheckCircleIcon className="h-5 w-5 text-blue-500" />;
    case 'resolved':
      return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
    default:
      return null;
  }
}

interface IncidentListProps {
  isPublic?: boolean;
  initialRows?: number;
}

export function IncidentList({ isPublic = false, initialRows = 5 }: IncidentListProps) {
  const { orgSlug } = useParams<{ orgSlug?: string }>();
  const [page, setPage] = useState(1);
  const [rows] = useState(initialRows);
  const queryClient = useQueryClient();

  // For public routes, we need orgSlug
  // For private routes, we don't need orgSlug as we use the authenticated user's org
  const shouldFetch = isPublic ? !!orgSlug : true;

  const { data: incidentsData, isLoading } = useQuery({
    queryKey: isPublic ? ['public-incidents', orgSlug, page, rows] : ['incidents', page, rows],
    queryFn: () =>
      isPublic && orgSlug
        ? fetchPublicIncidents(orgSlug, { page, rows })
        : fetchIncidents({ page, rows }),
    enabled: shouldFetch,
  });

  useEffect(() => {
    const handleIncidentUpdate = (data: Incident | { id: string; is_deleted?: boolean }) => {
      // Get the base query key pattern
      const baseQueryKey = isPublic ? ['public-incidents', orgSlug] : ['incidents'];

      // Update all queries that match the base pattern
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
        (oldData: PaginatedResponse<Incident> | undefined) => {
          if (!oldData) return oldData;

          // Handle deletion
          if ('is_deleted' in data && data.is_deleted) {
            return {
              ...oldData,
              results: oldData.results.filter((incident) => incident.id !== data.id),
              total: oldData.total - 1,
            };
          }

          const incidentData = data as Incident;
          const existingIndex = oldData.results.findIndex(
            (incident) => incident.id === incidentData.id
          );

          if (existingIndex !== -1) {
            // Update existing incident
            return {
              ...oldData,
              results: oldData.results.map((incident) =>
                incident.id === incidentData.id ? incidentData : incident
              ),
            };
          } else if (oldData.page === 1) {
            // Add new incident only on the first page
            return {
              ...oldData,
              results: [incidentData, ...oldData.results.slice(0, -1)],
              total: oldData.total + 1,
            };
          }

          return oldData;
        }
      );
    };

    // Register handlers for both private and public WebSocket updates
    if (isPublic) {
      const publicManager = getPublicWebSocketManager();
      if (publicManager) {
        publicManager.addMessageHandler('incident_update', handleIncidentUpdate);
      }
    } else {
      addWebSocketHandler('incident_update', handleIncidentUpdate);
    }

    // Cleanup
    return () => {
      if (isPublic) {
        const publicManager = getPublicWebSocketManager();
        if (publicManager) {
          publicManager.removeMessageHandler('incident_update');
        }
      } else {
        const manager = getWebSocketManager();
        if (manager) {
          manager.removeMessageHandler('incident_update');
        }
      }
    };
  }, [queryClient, isPublic, orgSlug]);

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
      <h2 className="text-lg font-medium text-gray-900">Recent Incidents</h2>
      <div className="mt-4">
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <ul role="list" className="divide-y divide-gray-200">
            {incidentsData?.results.slice(0, rows).map((incident) => (
              <li key={incident.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <IncidentStatusIcon status={incident.status} />
                    <div>
                      <h3 className="font-medium text-gray-900">{incident.title}</h3>
                      <p className="text-sm text-gray-500">{incident.service.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        incident.status === 'resolved'
                          ? 'bg-green-100 text-green-800'
                          : incident.status === 'monitoring'
                            ? 'bg-blue-100 text-blue-800'
                            : incident.status === 'identified'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {incident.status_display}
                    </span>
                    <time dateTime={incident.created_at} className="text-sm text-gray-500">
                      {new Date(incident.created_at).toLocaleDateString()}
                    </time>
                  </div>
                </div>
                <p className="mt-2 text-sm text-gray-500">{incident.description}</p>
              </li>
            ))}
          </ul>
        </div>
        {incidentsData && (
          <div className="mt-4">
            <Pagination
              total={incidentsData.total}
              page={incidentsData.page}
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
