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

// ── M1 Models ──────────────────────────────────────────────────────

export interface M1Model {
  id: string;
  projectId: string;
  metamodelId: string;
  name: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export function getM1Models(projectId: string, mmid: string): Promise<M1Model[]> {
  return request<M1Model[]>(`/projects/${projectId}/metamodels/${mmid}/models`);
}

export function createM1Model(
  projectId: string,
  mmid: string,
  data: { name: string; content?: string },
): Promise<M1Model> {
  return request<M1Model>(`/projects/${projectId}/metamodels/${mmid}/models`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function getM1Model(
  projectId: string,
  mmid: string,
  modelId: string,
): Promise<M1Model> {
  return request<M1Model>(`/projects/${projectId}/metamodels/${mmid}/models/${modelId}`);
}

export function updateM1Model(
  projectId: string,
  mmid: string,
  modelId: string,
  data: { name?: string; content?: string },
): Promise<M1Model> {
  return request<M1Model>(`/projects/${projectId}/metamodels/${mmid}/models/${modelId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteM1Model(
  projectId: string,
  mmid: string,
  modelId: string,
): Promise<void> {
  return request<void>(`/projects/${projectId}/metamodels/${mmid}/models/${modelId}`, {
    method: 'DELETE',
  });
}

// ── GraphicalSpecs (Sirius-like) ────────────────────────────────────

export interface GraphicalSpec {
  id: string;
  metamodelId: string;
  name: string;
  spec: string;
  createdAt: string;
  updatedAt: string;
}

export function getGraphicalSpecs(mmid: string): Promise<GraphicalSpec[]> {
  return request<GraphicalSpec[]>(`/metamodels/${mmid}/specs`);
}

export function createGraphicalSpec(
  mmid: string,
  data: { name: string; spec?: string },
): Promise<GraphicalSpec> {
  return request<GraphicalSpec>(`/metamodels/${mmid}/specs`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function getGraphicalSpec(mmid: string, specId: string): Promise<GraphicalSpec> {
  return request<GraphicalSpec>(`/metamodels/${mmid}/specs/${specId}`);
}

export function updateGraphicalSpec(
  mmid: string,
  specId: string,
  data: { name?: string; spec?: string },
): Promise<GraphicalSpec> {
  return request<GraphicalSpec>(`/metamodels/${mmid}/specs/${specId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteGraphicalSpec(mmid: string, specId: string): Promise<void> {
  return request<void>(`/metamodels/${mmid}/specs/${specId}`, {
    method: 'DELETE',
  });
}

// ── OCL Constraints ────────────────────────────────────────────────

export interface OCLConstraint {
  id: string;
  metamodelId: string;
  name: string;
  context: string;
  expression: string;
  severity: string;
  createdAt: string;
  updatedAt: string;
}

export interface OCLValidationResult {
  constraintId: string;
  name: string;
  context: string;
  expression: string;
  passed: boolean;
  error?: string;
}

export function getOCLConstraints(mmid: string): Promise<OCLConstraint[]> {
  return request<OCLConstraint[]>(`/metamodels/${mmid}/constraints`);
}

export function createOCLConstraint(
  mmid: string,
  data: { name: string; context: string; expression: string; severity?: string },
): Promise<OCLConstraint> {
  return request<OCLConstraint>(`/metamodels/${mmid}/constraints`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateOCLConstraint(
  mmid: string,
  id: string,
  data: { name?: string; context?: string; expression?: string; severity?: string },
): Promise<OCLConstraint> {
  return request<OCLConstraint>(`/metamodels/${mmid}/constraints/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteOCLConstraint(mmid: string, id: string): Promise<void> {
  return request<void>(`/metamodels/${mmid}/constraints/${id}`, {
    method: 'DELETE',
  });
}

export function validateOCLConstraints(
  mmid: string,
  modelContent: string,
): Promise<OCLValidationResult[]> {
  return request<OCLValidationResult[]>(`/metamodels/${mmid}/constraints/validate`, {
    method: 'POST',
    body: JSON.stringify({ modelContent }),
  });
}

// ── Code Templates ─────────────────────────────────────────────────

export interface CodeTemplate {
  id: string;
  metamodelId: string;
  name: string;
  description?: string;
  template: string;
  language: string;
  isPredefined: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GenerationFile {
  name: string;
  content: string;
}

export interface GenerationResult {
  files: GenerationFile[];
}

export interface PredefinedGenerator {
  type: string;
  name: string;
  description: string;
}

export function getCodeTemplates(mmid: string): Promise<CodeTemplate[]> {
  return request<CodeTemplate[]>(`/metamodels/${mmid}/templates`);
}

export function createCodeTemplate(
  mmid: string,
  data: { name: string; description?: string; template: string; language?: string },
): Promise<CodeTemplate> {
  return request<CodeTemplate>(`/metamodels/${mmid}/templates`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateCodeTemplate(
  mmid: string,
  id: string,
  data: { name?: string; description?: string; template?: string; language?: string },
): Promise<CodeTemplate> {
  return request<CodeTemplate>(`/metamodels/${mmid}/templates/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteCodeTemplate(mmid: string, id: string): Promise<void> {
  return request<void>(`/metamodels/${mmid}/templates/${id}`, {
    method: 'DELETE',
  });
}

export function generateFromTemplate(mmid: string, templateId: string): Promise<GenerationResult> {
  return request<GenerationResult>(`/metamodels/${mmid}/templates/${templateId}/generate`, {
    method: 'POST',
  });
}

export function getPredefinedGenerators(mmid: string): Promise<PredefinedGenerator[]> {
  return request<PredefinedGenerator[]>(`/metamodels/${mmid}/templates/generate/predefined`, {
    method: 'POST',
  });
}

export function runPredefinedGenerator(mmid: string, type: string): Promise<GenerationResult> {
  return request<GenerationResult>(`/metamodels/${mmid}/templates/generate/${type}`, {
    method: 'POST',
  });
}
