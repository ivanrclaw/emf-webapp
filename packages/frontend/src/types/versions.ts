/** Types for the version history feature */
export interface VersionSummary {
  id: string;
  versionNumber: number;
  description: string;
  createdAt: string;
}

export interface VersionDetail {
  id: string;
  versionNumber: number;
  description: string;
  createdAt: string;
  snapshot: Record<string, any>;
}

export interface VersionDiffEntry {
  path: string;
  type: 'added' | 'removed' | 'modified';
  oldValue?: any;
  newValue?: any;
}

export interface VersionDiff {
  versionA: string;
  versionB: string;
  changes: VersionDiffEntry[];
}
