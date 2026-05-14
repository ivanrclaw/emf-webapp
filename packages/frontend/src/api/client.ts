const BASE_URL = '/api';

export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Metamodel {
  id: string;
  projectId: string;
  name: string;
  nsUri: string;
  nsPrefix: string;
  content?: Record<string, any>;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

async function request<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${BASE_URL}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${body || res.statusText}`);
  }
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : (undefined as unknown as T);
}

// ── Projects ──────────────────────────────────────────────────────

export function getProjects(): Promise<PaginatedResponse<Project>> {
  return request<PaginatedResponse<Project>>('/projects');
}

export function getProject(id: string): Promise<Project> {
  return request<Project>(`/projects/${id}`);
}

export function createProject(data: Partial<Project>): Promise<Project> {
  return request<Project>('/projects', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateProject(
  id: string,
  data: Partial<Project>,
): Promise<Project> {
  return request<Project>(`/projects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteProject(id: string): Promise<void> {
  return request<void>(`/projects/${id}`, { method: 'DELETE' });
}

// ── Metamodels ────────────────────────────────────────────────────

export function getMetamodels(projectId: string): Promise<Metamodel[]> {
  return request<Metamodel[]>(`/projects/${projectId}/metamodels`);
}

export function createMetamodel(
  projectId: string,
  data: Partial<Metamodel>,
): Promise<Metamodel> {
  return request<Metamodel>(`/projects/${projectId}/metamodels`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function getMetamodel(
  projectId: string,
  mmid: string,
): Promise<Metamodel> {
  return request<Metamodel>(`/projects/${projectId}/metamodels/${mmid}`);
}

export function deleteMetamodel(
  projectId: string,
  mmid: string,
): Promise<void> {
  return request<void>(`/projects/${projectId}/metamodels/${mmid}`, {
    method: 'DELETE',
  });
}

export function updateMetamodelContent(
  projectId: string,
  mmid: string,
  content: Record<string, any>,
): Promise<Metamodel> {
  return request<Metamodel>(`/projects/${projectId}/metamodels/${mmid}/content`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });
}

export function exportMetamodel(
  projectId: string,
  mmid: string,
  format: string,
): Promise<string> {
  return request<string>(
    `/projects/${projectId}/metamodels/${mmid}/export?format=${encodeURIComponent(format)}`,
    { method: 'POST' },
  );
}
