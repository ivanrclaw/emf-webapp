/**
 * @emf-webapp/frontend — useFieldLocks
 *
 * Hook that provides field-level lock information from Yjs awareness.
 * Used by PropertyInspector to show which fields are being edited by others.
 */
import { useMemo } from 'react';
import type { AwarenessState } from './useYjsCollaboration';

export interface FieldLock {
  userName: string;
  userColor: string;
}

export interface FieldLocksReturn {
  /** Get lock info for a specific field. Returns null if not locked by another user. */
  getFieldLock: (nodeId: string, fieldName: string) => FieldLock | null;
  /** Get all locks for a specific node */
  getNodeLocks: (nodeId: string) => Map<string, FieldLock>;
}

export function useFieldLocks(awarenessStates: Map<number, AwarenessState>): FieldLocksReturn {
  // Build a map of nodeId:fieldName → lock info
  const lockMap = useMemo(() => {
    const map = new Map<string, FieldLock>();

    awarenessStates.forEach((state) => {
      if (!state.user || !state.editingField) return;
      const key = `${state.editingField.nodeId}:${state.editingField.fieldName}`;
      // First user to claim the field wins display
      if (!map.has(key)) {
        map.set(key, {
          userName: state.user.name,
          userColor: state.user.color,
        });
      }
    });

    return map;
  }, [awarenessStates]);

  const getFieldLock = (nodeId: string, fieldName: string): FieldLock | null => {
    return lockMap.get(`${nodeId}:${fieldName}`) || null;
  };

  const getNodeLocks = (nodeId: string): Map<string, FieldLock> => {
    const result = new Map<string, FieldLock>();
    lockMap.forEach((lock, key) => {
      if (key.startsWith(`${nodeId}:`)) {
        const fieldName = key.slice(nodeId.length + 1);
        result.set(fieldName, lock);
      }
    });
    return result;
  };

  return { getFieldLock, getNodeLocks };
}
