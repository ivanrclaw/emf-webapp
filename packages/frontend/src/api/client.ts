const BASE_URL = '/api';

// ── Error types ────────────────────────────────────────────────────

export interface ApiError {
  status: number;
  message: string;
  details?: string;
  code?: string;
}

function isApiError(err: unknown): err is ApiError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    'message' in err
  );
}

/**
 * Extract a human-readable message from any error type.
 */
export function getErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unexpected error occurred';
}

/**
 * Extract detail string from an error, if available.
 */
export function getErrorDetails(error: unknown): string | undefined {
  if (isApiError(error)) {
    return error.details;
  }
  return undefined;
}

// ── Internal request helpers ───────────────────────────────────────

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Core request function.
 *
 * - On HTTP errors (status >= 400), parses the response body as JSON to
 *   extract a rich ApiError and throws it.
 * - On network errors (TypeError), retries up to 3 times with exponential
 *   backoff (1 s, 2 s, 4 s).
 * - On success, converts snake_case keys to camelCase via snakeToCamel.
 */
async function request<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const maxRetries = 3;
  const baseDelay = 1000; // 1 second

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(`${BASE_URL}${url}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
      });

      if (!res.ok) {
        let errorBody: Record<string, unknown> | null = null;
        try {
          errorBody = (await res.json()) as Record<string, unknown>;
        } catch {
          // Response body is not valid JSON — that's okay
        }

        const apiError: ApiError = {
          status: res.status,
          message:
            (errorBody?.message as string) || res.statusText,
          details:
            (errorBody?.error as string) ||
            (errorBody?.details as string) ||
            (errorBody ? JSON.stringify(errorBody) : undefined),
          code: errorBody?.code as string | undefined,
        };

        throw apiError;
      }

      const text = await res.text();
      return text
        ? (snakeToCamel(JSON.parse(text)) as T)
        : (undefined as unknown as T);
    } catch (err) {
      // Network errors (TypeError) are retryable — apply exponential backoff
      if (err instanceof TypeError && attempt < maxRetries) {
        await sleep(baseDelay * Math.pow(2, attempt));
        continue;
      }
      // Everything else (ApiError, SyntaxError, …) is re-thrown immediately
      throw err;
    }
  }

  // TypeScript safety net — the loop always returns or throws before reaching here
  throw new Error('Max retries exceeded');
}

/**
 * Safe wrapper around request().
 *
 * Never throws — returns { success, data, error } so callers can handle
 * errors without try / catch.
 */
export async function safeRequest<T>(
  url: string,
  options?: RequestInit,
): Promise<{ success: boolean; data?: T; error?: ApiError }> {
  try {
    const data = await request<T>(url, options);
    return { success: true, data };
  } catch (err) {
    if (isApiError(err)) {
      return { success: false, error: err };
    }
    return {
      success: false,
      error: {
        status: 0,
        message:
          err instanceof Error ? err.message : 'An unexpected error occurred',
      },
    };
  }
}

function snakeToCamel(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(snakeToCamel);
  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const camelKey = key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
      result[camelKey] = snakeToCamel(value);
    }
    return result;
  }
  return obj;
}

// ── Domain types ─────────────────────────────────────────────────

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
  nsUri?: string;
  nsPrefix?: string;
  content: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
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

export function exportProjectAsZip(projectId: string): void {
  window.open(`${BASE_URL}/projects/${projectId}/export/zip`, '_blank');
}

// ── Metamodels ────────────────────────────────────────────────────

export function getMetamodels(projectId: string): Promise<Metamodel[]> {
  return request<Metamodel[]>(`/projects/${projectId}/metamodels`);
}

export interface CreateMetamodelInput {
  name: string;
  nsURI?: string;
  nsPrefix?: string;
}

export function createMetamodel(
  projectId: string,
  data: CreateMetamodelInput,
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

// ── XMI Export (Eclipse EMF interoperability) ────────────────────────

/**
 * Abre el archivo .ecore (XMI 2.0) exportado en nueva pestaña.
 */
export function exportEcore(projectId: string, metamodelId: string): void {
  window.open(`${BASE_URL}/projects/${projectId}/xmi/${metamodelId}/ecore`, '_blank');
}

/**
 * Abre el archivo .genmodel en nueva pestaña.
 */
export function exportGenmodel(projectId: string, metamodelId: string): void {
  window.open(`${BASE_URL}/projects/${projectId}/xmi/${metamodelId}/genmodel`, '_blank');
}

/**
 * Descarga el ZIP con .ecore + .genmodel.
 */
export function exportXmiZip(projectId: string, metamodelId: string): void {
  window.open(`${BASE_URL}/projects/${projectId}/xmi/${metamodelId}/zip`, '_blank');
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
  data: { name?: string; content?: any },
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

// ── OCL Diagnostics (real-time semantic validation) ─────────────────

export interface OCLDiagnosticResult {
  message: string;
  severity: 'error' | 'warning' | 'info';
  offset: number;
  length: number;
}

export function diagnoseOCLExpression(
  mmid: string,
  expression: string,
  context: string,
  metamodelContent: any,
): Promise<OCLDiagnosticResult[]> {
  return request<OCLDiagnosticResult[]>(`/metamodels/${mmid}/constraints/diagnose`, {
    method: 'POST',
    body: JSON.stringify({ expression, context, metamodelContent }),
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
  log?: Array<{
    type: 'template-start' | 'template-end' | 'query-call' | 'file-write' | 'error' | 'warning' | 'info';
    timestamp: number;
    templateName?: string;
    moduleName?: string;
    sourceLine?: number;
    args?: string;
    duration?: number;
    outputLength?: number;
    fileName?: string;
    message?: string;
  }>;
  traces?: Array<{
    outputStart: number;
    outputEnd: number;
    templateName: string;
    moduleName: string;
    sourceLine: number;
    modelElementType?: string;
    modelElementName?: string;
  }>;
  executionTime?: number;
  stats?: { generated: number; skipped: number; lost: number };
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

// ── Template Projects ─────────────────────────────────────────────

export interface TemplateProject {
  id: string;
  name: string;
  description: string | null;
  metamodelId: string;
  fileCount?: number;
  files?: CodeTemplate[];
  createdAt: string;
  updatedAt: string;
}

export function getTemplateProjects(mmid: string): Promise<TemplateProject[]> {
  return request<TemplateProject[]>(`/metamodels/${mmid}/template-projects`);
}

export function getTemplateProject(mmid: string, projectId: string): Promise<TemplateProject> {
  return request<TemplateProject>(`/metamodels/${mmid}/template-projects/${projectId}`);
}

export function createTemplateProject(
  mmid: string,
  data: { name: string; description?: string },
): Promise<TemplateProject> {
  return request<TemplateProject>(`/metamodels/${mmid}/template-projects`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateTemplateProject(
  mmid: string,
  projectId: string,
  data: { name?: string; description?: string },
): Promise<TemplateProject> {
  return request<TemplateProject>(`/metamodels/${mmid}/template-projects/${projectId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteTemplateProject(mmid: string, projectId: string): Promise<void> {
  return request<void>(`/metamodels/${mmid}/template-projects/${projectId}`, {
    method: 'DELETE',
  });
}

export function addProjectFile(
  mmid: string,
  projectId: string,
  data: { filename: string; template: string; language?: string },
): Promise<CodeTemplate> {
  return request<CodeTemplate>(`/metamodels/${mmid}/template-projects/${projectId}/files`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateProjectFile(
  mmid: string,
  projectId: string,
  fileId: string,
  data: { filename?: string; template?: string; language?: string },
): Promise<CodeTemplate> {
  return request<CodeTemplate>(`/metamodels/${mmid}/template-projects/${projectId}/files/${fileId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteProjectFile(mmid: string, projectId: string, fileId: string): Promise<void> {
  return request<void>(`/metamodels/${mmid}/template-projects/${projectId}/files/${fileId}`, {
    method: 'DELETE',
  });
}

export function reorderProjectFiles(
  mmid: string,
  projectId: string,
  fileIds: string[],
): Promise<void> {
  return request<void>(`/metamodels/${mmid}/template-projects/${projectId}/files/reorder`, {
    method: 'PUT',
    body: JSON.stringify({ fileIds }),
  });
}

export function generateFromProject(mmid: string, projectId: string): Promise<GenerationResult> {
  return request<GenerationResult>(`/metamodels/${mmid}/template-projects/${projectId}/generate`, {
    method: 'POST',
  });
}
