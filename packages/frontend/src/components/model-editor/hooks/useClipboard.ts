/**
 * @emf-webapp/frontend — useClipboard
 *
 * Hook for copy/paste operations in the model editor.
 * Stores copied objects in memory with position offsets for paste.
 */
import { useState, useCallback, useRef } from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SemanticObject {
  id: string;
  eClass: string;
  attributes: Record<string, unknown>;
  references: Record<string, string[]>;
}

interface ClipboardEntry {
  objects: SemanticObject[];
  positions: Record<string, { x: number; y: number }>;
  pasteCount: number;
}

interface UseClipboardReturn {
  hasClipboard: boolean;
  copy: (objectIds: string[], allObjects: SemanticObject[], positions: Record<string, { x: number; y: number }>) => void;
  paste: () => { objects: SemanticObject[]; positions: Record<string, { x: number; y: number }> } | null;
  clear: () => void;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

const PASTE_OFFSET = 40;

function uid(): string {
  return `obj_${Math.random().toString(36).slice(2, 10)}`;
}

export function useClipboard(): UseClipboardReturn {
  const [hasClipboard, setHasClipboard] = useState(false);
  const clipboardRef = useRef<ClipboardEntry | null>(null);

  const copy = useCallback((
    objectIds: string[],
    allObjects: SemanticObject[],
    positions: Record<string, { x: number; y: number }>,
  ) => {
    const objectsToCopy = allObjects.filter((o) => objectIds.includes(o.id));
    if (objectsToCopy.length === 0) return;

    const posMap: Record<string, { x: number; y: number }> = {};
    for (const obj of objectsToCopy) {
      posMap[obj.id] = positions[obj.id] || { x: 100, y: 100 };
    }

    clipboardRef.current = {
      objects: objectsToCopy,
      positions: posMap,
      pasteCount: 0,
    };
    setHasClipboard(true);
  }, []);

  const paste = useCallback(() => {
    const clip = clipboardRef.current;
    if (!clip || clip.objects.length === 0) return null;

    clip.pasteCount += 1;
    const offset = PASTE_OFFSET * clip.pasteCount;

    // Create new objects with fresh IDs
    const idMap: Record<string, string> = {};
    const newObjects: SemanticObject[] = clip.objects.map((obj) => {
      const newId = uid();
      idMap[obj.id] = newId;
      return {
        id: newId,
        eClass: obj.eClass,
        attributes: {
          ...obj.attributes,
          name: `${obj.attributes.name || obj.eClass}_copy`,
        },
        references: {}, // Will remap below
      };
    });

    // Remap internal references (only those pointing to other copied objects)
    for (let i = 0; i < clip.objects.length; i++) {
      const origRefs = clip.objects[i].references;
      const newRefs: Record<string, string[]> = {};
      for (const [refName, targets] of Object.entries(origRefs)) {
        const remapped = targets
          .filter((t) => idMap[t]) // Only keep internal refs
          .map((t) => idMap[t]);
        if (remapped.length > 0) {
          newRefs[refName] = remapped;
        }
      }
      newObjects[i].references = newRefs;
    }

    // Compute new positions with offset
    const newPositions: Record<string, { x: number; y: number }> = {};
    for (const obj of clip.objects) {
      const pos = clip.positions[obj.id] || { x: 100, y: 100 };
      newPositions[idMap[obj.id]] = { x: pos.x + offset, y: pos.y + offset };
    }

    return { objects: newObjects, positions: newPositions };
  }, []);

  const clear = useCallback(() => {
    clipboardRef.current = null;
    setHasClipboard(false);
  }, []);

  return { hasClipboard, copy, paste, clear };
}
