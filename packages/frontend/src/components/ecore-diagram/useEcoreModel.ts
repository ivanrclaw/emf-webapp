/**
 * @emf-webapp/frontend — useEcoreModel Hook
 *
 * Hook principal para el editor visual de metamodelos Ecore.
 *
 * Arquitectura simplificada:
 *   - `pkg` (SerializableEPackage) es la única fuente de verdad
 *   - Nodos/edges se derivan de pkg con useMemo
 *   - `onNodesChange` aplica cambios sobre los nodos derivados
 *   - En cada cambio semántico → marcamos dirty + auto-save
 *
 * EVITA useNodesState/useEdgesState por compatibilidad con React 19.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type NodeChange,
  type EdgeChange,
  type Connection,
  type Node,
  type Edge,
} from '@xyflow/react';
import type {
  SerializableEPackage,
  SerializableEClass,
  SerializableEEnum,
  SerializableEDataType,
  SerializableEAttribute,
  SerializableEReference,
  SerializableEEnumLiteral,
  AppNode,
  AppEdge,
  EcoreNodeData,
  EcoreEdgeData,
  EcoreNodeType,
} from './types';
import { updateMetamodelContent } from '../../api/client';

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

let _counter = 0;
function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${++_counter}`;
}

function isClass(c: any): c is SerializableEClass {
  return c && 'eAttributes' in c;
}
function isEnum(c: any): c is SerializableEEnum {
  return c && 'eLiterals' in c && !('eAttributes' in c);
}
function isDataType(c: any): c is SerializableEDataType {
  return c && !('eAttributes' in c) && !('eLiterals' in c);
}

const DEFAULT_POS = { x: 250, y: 150 };
const AUTO_SAVE_MS = 2000;

// ── Module-level callback refs so pkgToNodes can wire real functions ──
const _callbacks = {
  onClassifierChange: (() => {}) as (id: string, updates: any) => void,
  onAddAttribute: (() => {}) as (classId: string) => void,
  onAddReference: (() => {}) as (classId: string) => void,
  onSelect: (() => {}) as (id: string | null, type?: string | null) => void,
};

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface UseEcoreModelOptions {
  projectId: string;
  metamodelId: string;
  initialPkg: SerializableEPackage | null;
}

export interface UseEcoreModelReturn {
  nodes: AppNode[];
  edges: AppEdge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  onDropNode: (type: 'class' | 'enum' | 'dataType', pos: { x: number; y: number }) => void;

  pkg: SerializableEPackage;
  selectedId: string | null;
  selectedType: string | null;
  setSelected: (id: string | null, type: string | null) => void;

  addClassifier: (type: 'class' | 'enum' | 'dataType') => void;
  deleteSelected: () => void;
  addAttribute: (classId: string) => void;
  addReference: (classId: string) => void;
  deleteFeature: (parentId: string, featureId: string) => void;
  handleClassifierChange: (id: string, updates: any) => void;

  isDirty: boolean;
  save: () => Promise<void>;
  loading: boolean;
}

// ═══════════════════════════════════════════════════════════════
// Converters
// ═══════════════════════════════════════════════════════════════

function pkgToNodes(pkg: SerializableEPackage, posMap: Map<string, { x: number; y: number }>): AppNode[] {
  const out: AppNode[] = [];
  const classifiers = pkg.eClassifiers ?? [];

  for (const c of classifiers) {
    const pos = posMap.get(c.id) ?? (c as any).position ?? DEFAULT_POS;
    const nodeType = isClass(c) ? 'eClassNode' : isEnum(c) ? 'eEnumNode' : 'eDataTypeNode';
    const ecoreType: EcoreNodeType = isClass(c) ? 'ecoreClass' : isEnum(c) ? 'ecoreEnum' : 'ecoreDataType';

    const data: EcoreNodeData = {
      label: c.name || 'Unnamed',
      type: ecoreType,
      classifier: c,
      ePackage: pkg,
      onClassifierChange: _callbacks.onClassifierChange,
      onAddAttribute: _callbacks.onAddAttribute,
      onAddReference: _callbacks.onAddReference,
      onSelect: _callbacks.onSelect,
    };

    out.push({ id: c.id, type: nodeType, position: pos, data } as AppNode);
  }

  return out;
}

/**
 * Determinación de handles para edges con smart routing.
 * Escoge source/target handle según la posición relativa de los nodos:
 *   - Source a la izquierda del target → source=Right, target=Left (flujo natural →)
 *   - Source a la derecha del target → source=Left, target=Right (flujo inverso ←)
 * Esto evita que las aristas crucen los nodos sin importar desde qué handle
 * arrastró el usuario (connectionMode='loose' permite cualquier handle).
 */
function bestHandleForEdge(
  sourceId: string,
  targetId: string,
  posMap?: Map<string, { x: number; y: number }>,
): { sourceHandlePos: 'left' | 'right'; targetHandlePos: 'left' | 'right' } {
  const sourcePos = posMap?.get(sourceId);
  const targetPos = posMap?.get(targetId);

  if (!sourcePos || !targetPos) {
    // Fallback: flujo natural derecha
    return { sourceHandlePos: 'right', targetHandlePos: 'left' } as const;
  }

  if (sourcePos.x < targetPos.x) {
    return { sourceHandlePos: 'right', targetHandlePos: 'left' } as const;
  } else {
    return { sourceHandlePos: 'left', targetHandlePos: 'right' } as const;
  }
}

function pkgToEdges(pkg: SerializableEPackage, _posMap?: Map<string, { x: number; y: number }>): AppEdge[] {
  const out: AppEdge[] = [];
  for (const c of pkg.eClassifiers ?? []) {
    if (!isClass(c)) continue;

    // Inheritance edges: child → parent (source=child, target=parent)
    if (c.eSuperTypes) {
      for (const superTypeId of c.eSuperTypes) {
        if (!superTypeId) continue;
        const edgeId = `inh_${c.id}_${superTypeId}`;
        // Avoid duplicates (when both classes declare the same super type)
        if (out.some((e) => e.id === edgeId)) continue;
        const handles = bestHandleForEdge(c.id, superTypeId, _posMap);
        out.push({
          id: edgeId,
          source: c.id,
          target: superTypeId,
          sourceHandle: handles.sourceHandlePos,
          targetHandle: handles.targetHandlePos,
          type: 'inheritanceEdge',
          data: {
            label: '', type: 'inheritanceEdge',
            sourceId: c.id, targetId: superTypeId,
            sourceHandlePos: handles.sourceHandlePos,
            targetHandlePos: handles.targetHandlePos,
          } satisfies EcoreEdgeData,
        } as AppEdge);
      }
    }

    // Reference edges
    for (const ref of c.eReferences) {
      if (!ref.targetId) continue;
      const edgeType = ref.containment ? 'containmentEdge' as const : 'referenceEdge' as const;
      const handles = bestHandleForEdge(c.id, ref.targetId, _posMap);
      const data: EcoreEdgeData = {
        label: ref.name || ref.targetId,
        type: edgeType,
        sourceId: c.id,
        targetId: ref.targetId,
        reference: ref,
        sourceHandlePos: handles.sourceHandlePos,
        targetHandlePos: handles.targetHandlePos,
      };
      out.push({
        id: ref.id,
        source: c.id,
        target: ref.targetId,
        sourceHandle: handles.sourceHandlePos,
        targetHandle: handles.targetHandlePos,
        type: edgeType,
        animated: ref.containment,
        data,
      } as AppEdge);
    }
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════
// Hook
// ═══════════════════════════════════════════════════════════════

export function useEcoreModel({ projectId, metamodelId, initialPkg }: UseEcoreModelOptions): UseEcoreModelReturn {
  // ── Core state ─────────────────────────────────────────────
  const [pkg, setPkg] = useState<SerializableEPackage>(() =>
    initialPkg ?? { name: 'model', nsURI: '', nsPrefix: '', eClassifiers: [] },
  );

  // We need our OWN node/edge state, NOT useNodesState (to avoid hook-count issues)
  const [nodes, setNodes] = useState<AppNode[]>(() => {
    if (initialPkg) return pkgToNodes(initialPkg, new Map());
    return [];
  });
  const [edges, setEdges] = useState<AppEdge[]>(() => {
    if (initialPkg) return pkgToEdges(initialPkg, new Map());
    return [];
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [loading, setLoading] = useState(false);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const posMap = useRef<Map<string, { x: number; y: number }>>(new Map());
  const pkgRef = useRef(pkg);
  pkgRef.current = pkg;
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const initialLoadDone = useRef(false);

  // ── Initialize from initialPkg ──────────────────────────────
  useEffect(() => {
    if (initialPkg && !initialLoadDone.current) {
      initialLoadDone.current = true;
      const pos = new Map<string, { x: number; y: number }>();
      setNodes(pkgToNodes(initialPkg, pos));
      setEdges(pkgToEdges(initialPkg, pos));
      posMap.current = pos;
      setPkg(initialPkg);
    }
  }, [initialPkg]);

  // ── Re-sync from pkg (recompute nodes/edges preserving positions) ─
  const resync = useCallback(() => {
    setNodes(pkgToNodes(pkgRef.current, posMap.current));
    setEdges(pkgToEdges(pkgRef.current, posMap.current));
  }, []);

  // ── Auto-save ─────────────────────────────────────────────
  useEffect(() => {
    if (isDirty) {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        // Build content with positions from nodesRef
        const content = buildContent(pkgRef.current, posMap.current);
        updateMetamodelContent(projectId, metamodelId, content);
        setIsDirty(false);
      }, AUTO_SAVE_MS);
    }
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [isDirty, projectId, metamodelId]);

  // ── Selection ─────────────────────────────────────────────
  const setSelected = useCallback((id: string | null, type: string | null) => {
    setSelectedId(id);
    setSelectedType(type);
  }, []);

  // ── React Flow handlers ────────────────────────────────────
  const onNodesChange: OnNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((cur) => {
        // Track positions
        for (const ch of changes) {
          if (ch.type === 'position' && 'position' in ch && ch.position) {
            posMap.current.set(ch.id, { ...ch.position });
          }
          if (ch.type === 'position' && ch.dragging === false) {
            setIsDirty(true);
          }
        }
        return applyNodeChanges(changes, cur) as AppNode[];
      });
    },
    [],
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((cur) => applyEdgeChanges(changes, cur) as AppEdge[]);
    },
    [],
  );

  const onConnect: OnConnect = useCallback(
    (conn: Connection) => {
      if (!conn.source || !conn.target) return;
      setPkg((prev) => {
        const src = prev.eClassifiers.find((c) => c.id === conn.source);
        if (!src || !isClass(src)) return prev;
        const tgt = prev.eClassifiers.find((c) => c.id === conn.target);
        if (!tgt) return prev;

        const newRef: SerializableEReference = {
          id: genId('ref'),
          name: tgt.name.toLowerCase(),
          targetId: conn.target,
          containment: false,
          lowerBound: 0,
          upperBound: -1,
          eOpposite: null,
          changeable: true,
          derived: false,
        };

        const updated = {
          ...prev,
          eClassifiers: prev.eClassifiers.map((c) =>
            c.id === conn.source && isClass(c)
              ? { ...c, eReferences: [...c.eReferences, newRef] }
              : c,
          ),
        };

        // Resync after paint
        setTimeout(() => {
          setIsDirty(true);
        }, 0);

        return updated;
      });
    },
    [],
  );

  // ── Semantic operations ────────────────────────────────────
  const addClassifier = useCallback(
    (type: 'class' | 'enum' | 'dataType') => {
      setPkg((prev) => {
        const count = prev.eClassifiers.length;
        const pos = { x: 100 + (count % 4) * 240, y: 100 + Math.floor(count / 4) * 220 };

        let newClassifier: any;
        const id = genId('ec');
        if (type === 'class') {
          newClassifier = { id, name: `NewClass${count + 1}`, abstract: false, interface: false, eSuperTypes: [], eAttributes: [], eReferences: [], position: pos };
        } else if (type === 'enum') {
          newClassifier = { id, name: `NewEnum${count + 1}`, eLiterals: [{ id: genId('lit'), name: 'LITERAL1', value: 0 }] };
        } else {
          newClassifier = { id, name: `NewType${count + 1}`, instanceTypeName: 'java.lang.String' };
        }

        return { ...prev, eClassifiers: [...prev.eClassifiers, newClassifier] };
      });
      setTimeout(() => { setIsDirty(true); }, 0);
    },
    [],
  );

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    setPkg((prev) => {
      // Check if it's a classifier
      const hasClassifier = prev.eClassifiers.some((c) => c.id === selectedId);
      if (hasClassifier) {
        return {
          ...prev,
          eClassifiers: prev.eClassifiers.filter((c) => c.id !== selectedId),
        };
      }
      // Else try to delete an attribute/reference
      return {
        ...prev,
        eClassifiers: prev.eClassifiers.map((c) => {
          if (!isClass(c)) return c;
          return {
            ...c,
            eAttributes: c.eAttributes.filter((a) => a.id !== selectedId),
            eReferences: c.eReferences.filter((r) => r.id !== selectedId),
          };
        }),
      };
    });
    setSelectedId(null);
    setSelectedType(null);
    setIsDirty(true);
  }, [selectedId]);

  const addAttribute = useCallback((classId: string) => {
    setPkg((prev) => ({
      ...prev,
      eClassifiers: prev.eClassifiers.map((c) => {
        if (c.id !== classId || !isClass(c)) return c;
        return {
          ...c,
          eAttributes: [...c.eAttributes, { id: genId('attr'), name: 'newAttr', eType: 'EString', lowerBound: 0, upperBound: 1, iD: false, defaultValueLiteral: '', changeable: true, derived: false, transient: false }],
        };
      }),
    }));
    setIsDirty(true);
  }, []);

  const addReference = useCallback((classId: string) => {
    setPkg((prev) => ({
      ...prev,
      eClassifiers: prev.eClassifiers.map((c) => {
        if (c.id !== classId || !isClass(c)) return c;
        return {
          ...c,
          eReferences: [...c.eReferences, { id: genId('ref'), name: 'newRef', targetId: '', containment: false, lowerBound: 0, upperBound: -1, eOpposite: null, changeable: true, derived: false }],
        };
      }),
    }));
    setIsDirty(true);
  }, []);

  const deleteFeature = useCallback((parentId: string, featureId: string) => {
    setPkg((prev) => ({
      ...prev,
      eClassifiers: prev.eClassifiers.map((c) => {
        if (c.id !== parentId || !isClass(c)) return c;
        return {
          ...c,
          eAttributes: c.eAttributes.filter((a) => a.id !== featureId),
          eReferences: c.eReferences.filter((r) => r.id !== featureId),
        };
      }),
    }));
    setIsDirty(true);
  }, []);

  const handleClassifierChange = useCallback((id: string, updates: any) => {
    setPkg((prev) => ({
      ...prev,
      eClassifiers: prev.eClassifiers.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    }));
    setIsDirty(true);
  }, []);

  // ── Wire real callbacks into module-level references      ──
  _callbacks.onAddAttribute = addAttribute;
  _callbacks.onAddReference = addReference;
  _callbacks.onClassifierChange = handleClassifierChange;
  _callbacks.onSelect = (id: string | null) => setSelected(id, null);

  // ── Drop new classifier on canvas ──────────────────────────
  const onDropNode = useCallback(
    (type: 'class' | 'enum' | 'dataType', pos: { x: number; y: number }) => {
      const id = genId('ec');
      let newClassifier: any;
      if (type === 'class') {
        newClassifier = { id, name: `NewClass`, abstract: false, interface: false, eSuperTypes: [], eAttributes: [], eReferences: [], position: pos };
      } else if (type === 'enum') {
        newClassifier = { id, name: `NewEnum`, eLiterals: [{ id: genId('lit'), name: 'LITERAL1', value: 0 }] };
      } else {
        newClassifier = { id, name: `NewType`, instanceTypeName: 'java.lang.String' };
      }
      setPkg((prev) => ({ ...prev, eClassifiers: [...prev.eClassifiers, newClassifier] }));
      setIsDirty(true);
    },
    [],
  );

  // ── Save ───────────────────────────────────────────────────
  const save = useCallback(async () => {
    setLoading(true);
    try {
      const content = buildContent(pkgRef.current, posMap.current);
      await updateMetamodelContent(projectId, metamodelId, content);
      setIsDirty(false);
    } finally {
      setLoading(false);
    }
  }, [projectId, metamodelId]);

  // ── Re-sync when pkg changes ────────────────────────────────
  useEffect(() => {
    resync();
  }, [pkg, resync]);

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onDropNode,
    pkg,
    selectedId,
    selectedType,
    setSelected,
    addClassifier,
    deleteSelected,
    addAttribute,
    addReference,
    deleteFeature,
    handleClassifierChange,
    isDirty,
    save,
    loading,
  };
}

// ═══════════════════════════════════════════════════════════════
// Content builder for API
// ═══════════════════════════════════════════════════════════════

function buildContent(pkg: SerializableEPackage, posMap: Map<string, { x: number; y: number }>): any {
  return {
    name: pkg.name,
    nsURI: pkg.nsURI,
    nsPrefix: pkg.nsPrefix,
    eClassifiers: pkg.eClassifiers.map((c) => {
      const pos = posMap.get(c.id) ?? (c as any).position ?? DEFAULT_POS;
      if (isClass(c)) {
        return {
          ...c,
          position: pos,
          eSuperTypes: c.eSuperTypes || [],
          eAttributes: (c.eAttributes || []).map((a) => ({ ...a })),
          eReferences: (c.eReferences || []).map((r) => ({ ...r })),
        };
      }
      if (isEnum(c)) {
        return {
          ...c,
          eLiterals: (c.eLiterals || []).map((l) => ({ ...l })),
        };
      }
      return { ...c };
    }),
  };
}
