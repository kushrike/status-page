import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Service } from '../types/types';
import { searchServices } from '../api';
import { Combobox } from '@headlessui/react';
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/20/solid';

interface ServiceSelectorProps {
  selectedServices: Service[];
  onChange: (services: Service[]) => void;
  placeholder?: string;
  multiple?: boolean;
}

export function ServiceSelector({
  selectedServices,
  onChange,
  placeholder = 'Select services',
  multiple = true,
}: ServiceSelectorProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data, isLoading } = useQuery({
    queryKey: ['services', 'search', debouncedQuery],
    queryFn: () => searchServices({ q: debouncedQuery, rows: 10 }),
    enabled: true,
  });

  const filteredServices = data?.results || [];

  const displayValue = (services: Service | Service[] | null) => {
    if (!services) return '';
    if (Array.isArray(services)) {
      return services.map((s) => s.name).join(', ');
    }
    return services.name;
  };

  return (
    <Combobox
      value={multiple ? selectedServices : selectedServices[0] || null}
      onChange={(value) => {
        if (multiple) {
          onChange(value as Service[]);
        } else {
          onChange(value ? [value as Service] : []);
        }
      }}
      multiple={multiple}
    >
      <div className="relative mt-1">
        <div className="relative w-full cursor-default overflow-hidden rounded-lg bg-white text-left border border-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-300 sm:text-sm">
          <Combobox.Input
            className="w-full border-none py-2 pl-3 pr-10 text-sm leading-5 text-gray-900 focus:ring-0"
            displayValue={displayValue}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder}
          />
          <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
            <ChevronUpDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
          </Combobox.Button>
        </div>
        <Combobox.Options className="absolute mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm z-10">
          {isLoading && (
            <div className="relative cursor-default select-none py-2 px-4 text-gray-700">
              Loading...
            </div>
          )}
          {filteredServices.length === 0 && !isLoading && (
            <div className="relative cursor-default select-none py-2 px-4 text-gray-700">
              No services found.
            </div>
          )}
          {filteredServices.map((service) => (
            <Combobox.Option
              key={service.id}
              value={service}
              className={({ active }) =>
                `relative cursor-default select-none py-2 pl-10 pr-4 ${
                  active ? 'bg-indigo-600 text-white' : 'text-gray-900'
                }`
              }
            >
              {({ selected, active }) => (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span
                        className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}
                      >
                        {service.name}
                      </span>
                      {selected && (
                        <span
                          className={`absolute inset-y-0 left-0 flex items-center pl-3 ${
                            active ? 'text-white' : 'text-indigo-600'
                          }`}
                        >
                          <CheckIcon className="h-5 w-5" aria-hidden="true" />
                        </span>
                      )}
                    </div>
                    <div className="flex items-center">
                      <span className={`text-sm ${active ? 'text-indigo-100' : 'text-gray-500'}`}>
                        {service.status_display}
                      </span>
                      {service.active_incidents && service.active_incidents.length > 0 && (
                        <span
                          className={`ml-2 text-sm ${
                            active ? 'text-indigo-100' : 'text-yellow-500'
                          }`}
                        >
                          ({service.active_incidents.length} active)
                        </span>
                      )}
                    </div>
                  </div>
                </>
              )}
            </Combobox.Option>
          ))}
        </Combobox.Options>
      </div>
    </Combobox>
  );
}
