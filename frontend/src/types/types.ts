export interface Service {
  id: string;
  name: string;
  description: string;
  status: 'operational' | 'degraded' | 'partial' | 'major' | 'maintenance';
  status_display: string;
  is_active: boolean;
  active_incidents?: { id: string }[];
  created_at: string;
  updated_at: string;
  valid_next_states: Array<{
    value: string;
    label: string;
  }>;
}

export interface Incident {
  id: string;
  title: string;
  description: string;
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  status_display: string;
  started_at: string;
  resolved_at?: string;
  service: Service;
  service_id?: string; // Used only when submitting
  from_state: string;
  to_state: string;
  from_state_display: string;
  to_state_display: string;
  resulting_state?: string;
  created_at: string;
  updated_at: string;
}

export interface Team {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  clerk_id: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'member';
  org_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description: string;
  website: string;
  logo: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Team {
  id: string;
  name: string;
  description: string;
  org_id: string;
  created_at: string;
  updated_at: string;
}

export interface PaginatedResponse<T> {
  total: number;
  page: number;
  rows: number;
  results: T[];
}

export interface PaginationParams {
  page?: number;
  rows?: number;
}

export interface SearchParams extends PaginationParams {
  q?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}
