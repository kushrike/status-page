import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PlusIcon } from '@heroicons/react/24/outline';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  WrenchIcon,
} from '@heroicons/react/24/solid';
import { fetchServices, createService, updateService, deleteService } from '../api';
import { Service, PaginatedResponse } from '../types/types';
import { Pagination } from '../components/Pagination';
import { ServiceModal } from '../components/ServiceModal';
import toast from 'react-hot-toast';
import { getWebSocketManager, addWebSocketHandler } from '../utils/websocket';
import { useIsAdmin } from '../utils/auth';

function ServiceStatusIcon({ status }: { status: Service['status'] }) {
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

function Services() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | undefined>();
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState(20);
  const isAdmin = useIsAdmin();

  const queryClient = useQueryClient();

  const { data = { total: 0, page: 1, rows: 20, results: [] }, isLoading } = useQuery({
    queryKey: ['services', page, rows],
    queryFn: () => fetchServices({ page, rows }),
  });

  // Add WebSocket handlers
  useEffect(() => {
    // Handle service updates
    addWebSocketHandler(
      'service_status_update',
      (data: Service | { id: string; is_deleted?: boolean }) => {
        console.log(data);
        // Handle deletion
        if ('is_deleted' in data && data.is_deleted) {
          queryClient.setQueryData(
            ['services', page, rows],
            (oldData: PaginatedResponse<Service> | undefined) => {
              if (!oldData) return oldData;
              return {
                ...oldData,
                results: oldData.results.filter((service) => service.id !== data.id),
                total: oldData.total - 1,
              };
            }
          );
          return;
        }

        // Handle update or creation
        queryClient.setQueryData(
          ['services', page, rows],
          (oldData: PaginatedResponse<Service> | undefined) => {
            if (!oldData) return oldData;

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
              // Add new service only if we're on the first page
              return {
                ...oldData,
                results: [serviceData, ...oldData.results.slice(0, -1)], // Remove last item to maintain page size
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
        manager.removeMessageHandler('service_status_update');
      }
    };
  }, [queryClient, page, rows]);

  const createMutation = useMutation({
    mutationFn: createService,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast.success('Service created successfully');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: Partial<Service> & { id: string }) => updateService(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast.success('Service updated successfully');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteService,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast.success('Service deleted successfully');
    },
  });

  const handleSubmit = (data: Partial<Service>) => {
    if (selectedService) {
      updateMutation.mutate({ id: selectedService.id, ...data });
    } else {
      createMutation.mutate(data as Omit<Service, 'id' | 'created_at' | 'updated_at'>);
    }
    setIsModalOpen(false);
    setSelectedService(undefined);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this service?')) {
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
    <div>
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-xl font-semibold text-gray-900">Services</h1>
          <p className="mt-2 text-sm text-gray-700">
            Complete list of all services and their current status. Showing {rows} items per page.
          </p>
        </div>
        {isAdmin && (
          <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
            <button
              onClick={() => {
                setSelectedService(undefined);
                setIsModalOpen(true);
              }}
              className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
            >
              <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
              Add Service
            </button>
          </div>
        )}
      </div>

      <div className="mt-8 flex flex-col">
        <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                    >
                      Name
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
                      Description
                    </th>
                    {isAdmin && (
                      <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                        <span className="sr-only">Actions</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {data?.results.map((service) => (
                    <tr key={service.id}>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">
                        {service.name}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm">
                        <div className="flex items-center">
                          <ServiceStatusIcon status={service.status} />
                          <span className="ml-2">{service.status_display}</span>
                        </div>
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-500">{service.description}</td>
                      {isAdmin && (
                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                          <button
                            onClick={() => {
                              setSelectedService(service);
                              setIsModalOpen(true);
                            }}
                            className="text-indigo-600 hover:text-indigo-900 mr-4"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(service.id)}
                            className="text-red-600 hover:text-red-900"
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
          page={data.page}
          rows={data.rows}
          onPageChange={setPage}
          onRowsChange={setRows}
        />
      )}

      {isModalOpen && isAdmin && (
        <ServiceModal
          service={selectedService}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedService(undefined);
          }}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}

export default Services;
