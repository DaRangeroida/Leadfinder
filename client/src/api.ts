import type {
  AiProvider,
  CreateJobInput,
  CreateLeadInput,
  JobLogEntry,
  Lead,
  LeadFilterOptions,
  LeadListItem,
  LeadStatus,
  Meta,
  Pitch,
  SearchJob,
  SenderProfile,
  Stats,
} from '../../shared/types.ts';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch {
    throw new ApiError(0, 'Der Server ist nicht erreichbar. Läuft das Backend (npm run dev)?');
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body?.error ?? `Anfrage fehlgeschlagen (HTTP ${res.status}).`);
  return body as T;
}

export interface LeadQuery {
  q?: string;
  industry?: string;
  city?: string;
  status?: string;
  minScore?: number;
  jobId?: number;
  hideUnreachable?: 1;
  sort?: string;
  dir?: 'asc' | 'desc';
}

function toSearch(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '' && value !== null) search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

export const api = {
  meta: () => request<Meta>('/meta'),
  updateSettings: (settings: { aiProvider: AiProvider }) => request<Meta>('/settings', { method: 'PUT', body: JSON.stringify(settings) }),
  updateProfile: (profile: SenderProfile) => request<Meta>('/profile', { method: 'PUT', body: JSON.stringify(profile) }),
  stats: () => request<Stats>('/stats'),
  leads: (query: LeadQuery) => request<LeadListItem[]>(`/leads${toSearch(query)}`),
  filters: () => request<LeadFilterOptions>('/leads/filters'),
  lead: (id: number) => request<Lead>(`/leads/${id}`),
  createLead: (input: CreateLeadInput) => request<Lead>('/leads', { method: 'POST', body: JSON.stringify(input) }),
  updateLead: (id: number, patch: Partial<{ status: LeadStatus; notes: string; phone: string | null; email: string | null }>) =>
    request<Lead>(`/leads/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteLead: (id: number) => request<void>(`/leads/${id}`, { method: 'DELETE' }),
  rescan: (id: number) => request<Lead>(`/leads/${id}/rescan`, { method: 'POST' }),
  pitch: (id: number) => request<{ pitch: Pitch | null; warning: string | null }>(`/leads/${id}/pitch`),
  generatePitch: (id: number, mode: 'auto' | 'vorlage') =>
    request<{ pitch: Pitch; warning: string | null }>(`/leads/${id}/pitch`, { method: 'POST', body: JSON.stringify({ mode }) }),
  jobs: () => request<SearchJob[]>('/jobs'),
  job: (id: number) => request<{ job: SearchJob; log: JobLogEntry[] }>(`/jobs/${id}`),
  createJob: (input: CreateJobInput) => request<SearchJob>('/jobs', { method: 'POST', body: JSON.stringify(input) }),
  exportUrl: (query: { status?: string; minScore?: number }) => `/api/leads/export.csv${toSearch(query)}`,
};
