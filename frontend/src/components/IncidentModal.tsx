import { useState } from 'react';
import { Incident } from '../types/types';
import { ServiceSelector } from './ServiceSelector';
import { InformationCircleIcon } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';

interface IncidentModalProps {
  incident?: Incident;
  onClose: () => void;
  onSubmit: (data: Partial<Incident>) => void;
}

export function IncidentModal({ incident, onClose, onSubmit }: IncidentModalProps) {
  const [formData, setFormData] = useState({
    title: incident?.title || '',
    description: incident?.description || '',
    status: incident?.status || 'investigating',
    service: incident?.service || null,
    to_state: '',
    started_at: incident?.started_at || new Date().toISOString(),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const submitData: Partial<Incident> = {
      title: formData.title,
      description: formData.description,
      status: formData.status,
    };

    if (incident) {
      // Edit mode - send service_id and current service state
      submitData.service_id = incident.service.id;
      submitData.to_state = incident.service.status;
    } else {
      // Create mode - require service and state selection
      if (!formData.service) {
        toast.error('Please select a service');
        return;
      }
      if (!formData.to_state) {
        toast.error('Please select a new state for the service');
        return;
      }
      submitData.service_id = formData.service.id;
      submitData.to_state = formData.to_state;
      submitData.started_at = formData.started_at;
    }

    onSubmit(submitData);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h2 className="text-lg font-medium mb-4">{incident ? 'Edit Incident' : 'New Incident'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {!incident && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Service</label>
                <ServiceSelector
                  selectedServices={formData.service ? [formData.service] : []}
                  onChange={(services) =>
                    setFormData((prev) => ({ ...prev, service: services[0] }))
                  }
                  multiple={false}
                />
              </div>
            )}

            {!incident && formData.service && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700">New Service State</label>
                <select
                  value={formData.to_state}
                  onChange={(e) => setFormData((prev) => ({ ...prev, to_state: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                >
                  <option value="">Select a state</option>
                  {formData.service.valid_next_states.map((state) => (
                    <option key={state.value} value={state.value}>
                      {state.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {incident && formData.status === 'resolved' && (
              <div className="mt-4 rounded-md bg-blue-50 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <InformationCircleIcon className="h-5 w-5 text-blue-400" aria-hidden="true" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-blue-700">
                      Resolving this incident will restore the service status if there are no other
                      active incidents.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700">Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                rows={3}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Status</label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value as Incident['status'] })
                }
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option value="investigating">Investigating</option>
                <option value="identified">Identified</option>
                <option value="monitoring">Monitoring</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
          </div>

          <div className="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              {incident ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
