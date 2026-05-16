/**
 * API client for version history endpoints.
 */
import type { VersionSummary, VersionDetail, VersionDiff } from '../types/versions';

const BASE = '/api';

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json();
}

export function getVersions(entityId: string, entityType: 'metamodel' | 'm1model' = 'metamodel'): Promise<VersionSummary[]> {
  return fetchJSON<VersionSummary[]>(`${BASE}/versions/${entityType}/${entityId}`);
}

export function createVersion(
  entityId: string,
  snapshot: Record<string, any>,
  description?: string,
  entityType: 'metamodel' | 'm1model' = 'metamodel',
): Promise<{ id: string; versionNumber: number }> {
  return fetchJSON(`${BASE}/versions/${entityType}/${entityId}`, {
    method: 'POST',
    body: JSON.stringify({ snapshot, description }),
  });
}

export function getVersion(vid: string): Promise<VersionDetail> {
  return fetchJSON<VersionDetail>(`${BASE}/versions/${vid}`);
}

export function getDiff(entityId: string, vidA: string, vidB: string, entityType: 'metamodel' | 'm1model' = 'metamodel'): Promise<VersionDiff> {
  return fetchJSON<VersionDiff>(`${BASE}/versions/${entityType}/${entityId}/diff/${vidA}/${vidB}`);
}

export function revertToVersion(vid: string): Promise<{ snapshot: Record<string, any> }> {
  return fetchJSON<{ snapshot: Record<string, any> }>(`${BASE}/versions/${vid}/revert`, { method: 'POST' });
}
