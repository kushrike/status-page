import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PlusIcon } from '@heroicons/react/24/outline';
import { CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/solid';
import { fetchIncidents, createIncident, updateIncident, deleteIncident } from '../api';
import { Incident, PaginatedResponse } from '../types/types';
import { Pagination } from '../components/Pagination';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { ArrowRightIcon } from '@heroicons/react/20/solid';
import { getWebSocketManager, addWebSocketHandler } from '../utils/websocket';
import { IncidentModal } from '../components/IncidentModal';
import { useIsAdmin } from '../utils/auth';

function IncidentStatusIcon({ status }: { status: Incident['status'] }) {
  switch (status.toLowerCase()) {
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

function StateTransition({
  from_state_display,
  to_state_display,
}: {
  from_state_display: string;
  to_state_display: string;
}) {
  return (
    <div className="flex items-center space-x-2 text-sm">
      <span className="font-medium">{from_state_display}</span>
      <ArrowRightIcon className="h-4 w-4 text-gray-500" />
      <span className="font-medium">{to_state_display}</span>
    </div>
  );
}

function Incidents() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | undefined>();
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState(20);
  const isAdmin = useIsAdmin();

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['incidents', page, rows],
    queryFn: () => fetchIncidents({ page, rows }),
  });

  // Add WebSocket handlers
  useEffect(() => {
    // Handle incident updates
    addWebSocketHandler(
      'incident_update',
      (data: Incident | { id: string; is_deleted?: boolean }) => {
        // Handle deletion
        if ('is_deleted' in data && data.is_deleted) {
          queryClient.setQueryData(
            ['incidents', page, rows],
            (oldData: PaginatedResponse<Incident> | undefined) => {
              if (!oldData) return oldData;
              return {
                ...oldData,
                results: oldData.results.filter((incident) => incident.id !== data.id),
                total: oldData.total - 1,
              };
            }
          );
          toast.success('Incident deleted');
          return;
        }

        // Handle update or creation
        queryClient.setQueryData(
          ['incidents', page, rows],
          (oldData: PaginatedResponse<Incident> | undefined) => {
            if (!oldData) return oldData;

            const incidentData = data as Incident;
            const existingIndex = oldData.results.findIndex(
              (incident) => incident.id === incidentData.id
            );

            if (existingIndex !== -1) {
              // Update existing incident
              toast.success('Incident updated');
              return {
                ...oldData,
                results: oldData.results.map((incident) =>
                  incident.id === incidentData.id ? incidentData : incident
                ),
              };
            } else if (page === 1) {
              // Add new incident only if we're on the first page
              toast.success('New incident created');
              return {
                ...oldData,
                results: [incidentData, ...oldData.results.slice(0, -1)], // Remove last item to maintain page size
                total: oldData.total + 1,
              };
            }
            return oldData;
          }
        );
      }
    );

    // Cleanup
    return () => {
      const manager = getWebSocketManager();
      if (manager) {
        manager.removeMessageHandler('incident_update');
      }
    };
  }, [queryClient, page, rows]);

  const createMutation = useMutation({
    mutationFn: createIncident,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast.success('Incident created successfully');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: Partial<Incident> & { id: string }) => updateIncident(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast.success('Incident updated successfully');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteIncident,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast.success('Incident deleted successfully');
    },
  });

  const handleSubmit = (data: Partial<Incident>) => {
    if (selectedIncident) {
      updateMutation.mutate({ id: selectedIncident.id, ...data });
    } else {
      createMutation.mutate(data as Omit<Incident, 'id' | 'created_at' | 'updated_at'>);
    }
    setIsModalOpen(false);
    setSelectedIncident(undefined);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this incident?')) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-xl font-semibold text-gray-900">Incidents</h1>
          <p className="mt-2 text-sm text-gray-700">
            A list of all incidents and their current status.
          </p>
        </div>
        {isAdmin && (
          <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
            <button
              onClick={() => {
                setSelectedIncident(undefined);
                setIsModalOpen(true);
              }}
              className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
            >
              <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
              Add Incident
            </button>
          </div>
        )}
      </div>

      {isModalOpen && isAdmin && (
        <IncidentModal
          incident={selectedIncident}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedIncident(undefined);
          }}
          onSubmit={handleSubmit}
        />
      )}

      <div className="mt-8 flex flex-col">
        <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6"
                    >
                      Title
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                    >
                      Service
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                    >
                      Status
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                    >
                      Service State Transition
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                    >
                      Started At
                    </th>
                    {isAdmin && (
                      <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                        <span className="sr-only">Actions</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {data?.results.map((incident) => (
                    <tr key={incident.id}>
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                        {incident.title}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {incident.service.name}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm">
                        <span className="inline-flex items-center">
                          <IncidentStatusIcon status={incident.status} />
                          <span className="ml-1.5">{incident.status_display}</span>
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        <StateTransition
                          from_state_display={incident.from_state_display}
                          to_state_display={incident.to_state_display}
                        />
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {format(new Date(incident.started_at), 'MMM d, yyyy HH:mm')}
                      </td>
                      {isAdmin && (
                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                          {incident.status !== 'resolved' && (
                            <button
                              onClick={() => {
                                setSelectedIncident(incident);
                                setIsModalOpen(true);
                              }}
                              className="text-indigo-600 hover:text-indigo-900 mr-4"
                            >
                              Edit
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(incident.id)}
                            className="ml-4 text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {data && (
        <Pagination
          total={data.total}
          page={page}
          rows={rows}
          onPageChange={setPage}
          onRowsChange={setRows}
        />
      )}
    </div>
  );
}

export default Incidents;
