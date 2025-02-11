import axios from 'axios';
import type { InternalAxiosRequestConfig, AxiosError } from 'axios';
import {
  Service,
  Incident,
  User,
  Team,
  Organization,
  PaginatedResponse,
  PaginationParams,
  SearchParams,
} from '../types/types';
import { AuthError, isAuthError } from '../utils/auth';

// Create two axios instances - one for authenticated routes and one for public routes
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const publicApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Create an auth token manager
let getAuthToken: (() => Promise<string>) | null = null;

export function initializeApi(tokenGetter: () => Promise<string>) {
  getAuthToken = tokenGetter;
}

// Add request interceptor to add auth token only for authenticated routes
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  try {
    if (!getAuthToken) {
      throw new Error('API not initialized with auth token getter');
    }

    const token = await getAuthToken();
    if (config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  } catch (error) {
    console.error('Error getting token:', error);
    return Promise.reject(error);
  }
});

// Add response interceptor for error handling and token refresh only for authenticated routes
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // If the error is not 401 or we've already tried to refresh, reject
    if (!isAuthError(error) || originalRequest?._retry || !getAuthToken) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const token = await getAuthToken();
      originalRequest.headers!.Authorization = `Bearer ${token}`;
      return axios(originalRequest);
    } catch (refreshError) {
      console.error('Token refresh failed:', refreshError);
      throw new AuthError('Session expired');
    }
  }
);

// Helper to build query string
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildQueryString(params: Record<string, any>): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      query.append(key, String(value));
    }
  });
  return query.toString();
}

// Services
export const fetchServices = async (
  params: PaginationParams = {}
): Promise<PaginatedResponse<Service>> => {
  const query = buildQueryString(params);
  const { data } = await api.get<PaginatedResponse<Service>>(`/api/v1/services/?${query}`);
  return data;
};

export const searchServices = async (
  params: SearchParams = {}
): Promise<PaginatedResponse<Service>> => {
  const query = buildQueryString(params);
  const { data } = await api.get<PaginatedResponse<Service>>(`/api/v1/services/search/?${query}`);
  return data;
};

export const createService = async (
  service: Omit<Service, 'id' | 'created_at' | 'updated_at'>
): Promise<Service> => {
  const { data } = await api.post<Service>('/api/v1/services/', service);
  return data;
};

export const updateService = async (id: string, service: Partial<Service>): Promise<Service> => {
  const { data } = await api.patch<Service>(`/api/v1/services/${id}/`, service);
  return data;
};

export const deleteService = async (id: string): Promise<void> => {
  await api.delete(`/api/v1/services/${id}/`);
};

// Incidents
export const fetchIncidents = async (
  params: PaginationParams = {}
): Promise<PaginatedResponse<Incident>> => {
  const query = buildQueryString(params);
  const { data } = await api.get<PaginatedResponse<Incident>>(`/api/v1/incidents/?${query}`);
  return data;
};

export const createIncident = async (
  incident: Omit<Incident, 'id' | 'created_at' | 'updated_at'>
): Promise<Incident> => {
  const { data } = await api.post<Incident>('/api/v1/incidents/', incident);
  return data;
};

export const updateIncident = async (
  id: string,
  incident: Partial<Incident>
): Promise<Incident> => {
  const { data } = await api.patch<Incident>(`/api/v1/incidents/${id}/`, incident);
  return data;
};

export const deleteIncident = async (id: string): Promise<void> => {
  await api.delete(`/api/v1/incidents/${id}/`);
};

// Teams
export const fetchTeams = async (): Promise<PaginatedResponse<Team>> => {
  const { data } = await api.get<PaginatedResponse<Team>>('/api/v1/teams/');
  return data;
};

export const createTeam = async (
  team: Omit<Team, 'id' | 'created_at' | 'updated_at'>
): Promise<Team> => {
  const { data } = await api.post<Team>('/api/v1/teams/', team);
  return data;
};

export const updateTeam = async (id: string, team: Partial<Team>): Promise<Team> => {
  const { data } = await api.patch<Team>(`/api/v1/teams/${id}/`, team);
  return data;
};

export const deleteTeam = async (id: string): Promise<void> => {
  await api.delete(`/api/v1/teams/${id}/`);
};

// Users
export const fetchUsers = async (): Promise<PaginatedResponse<User>> => {
  const { data } = await api.get<PaginatedResponse<User>>('/api/v1/users/');
  return data;
};

export const updateUser = async (id: string, user: Partial<User>): Promise<User> => {
  const { data } = await api.patch<User>(`/api/v1/users/${id}/`, user);
  return data;
};

// Organizations
export const fetchOrganization = async (): Promise<Organization> => {
  const { data } = await api.get<Organization>('/api/v1/organizations/');
  return data;
};

export const updateOrganization = async (org: Partial<Organization>): Promise<Organization> => {
  const { data } = await api.patch<Organization>('/api/v1/organizations/', org);
  return data;
};

// Public Organizations
export const fetchPublicOrganizations = async (
  params: PaginationParams = {}
): Promise<PaginatedResponse<Organization>> => {
  const query = buildQueryString(params);
  const { data } = await publicApi.get<PaginatedResponse<Organization>>(
    `/api/v1/organizations/public/?${query}`
  );
  return data;
};

export const fetchPublicOrganization = async (slug: string): Promise<Organization> => {
  const { data } = await publicApi.get<Organization>(`/api/v1/organizations/public/${slug}/`);
  return data;
};

// Public Services
export const fetchPublicServices = async (
  orgSlug: string,
  params: PaginationParams = {}
): Promise<PaginatedResponse<Service>> => {
  const query = buildQueryString(params);
  const { data } = await publicApi.get<PaginatedResponse<Service>>(
    `/api/v1/services/public/${orgSlug}/?${query}`
  );
  return data;
};

// Public Incidents
export const fetchPublicIncidents = async (
  orgSlug: string,
  params: PaginationParams = {}
): Promise<PaginatedResponse<Incident>> => {
  const query = buildQueryString(params);
  const { data } = await publicApi.get<PaginatedResponse<Incident>>(
    `/api/v1/incidents/public/${orgSlug}/?${query}`
  );
  return data;
};

// Health Check
export const checkHealth = async (): Promise<{ status: string }> => {
  const { data } = await publicApi.get<{ status: string }>('/api/v1/health/');
  return data;
};
