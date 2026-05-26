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
import { computeAutoLayout } from './autoLayout';

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
  violationsMap?: Map<string, Array<{
    constraintId: string;
    constraintName: string;
    expression: string;
    severity: 'error' | 'warning' | 'info';
    passed: boolean;
    error?: string;
  }>>;
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
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  autoLayout: (direction?: 'TB' | 'LR') => void;

  /** Apply remote nodes directly (no undo, no dirty flag) */
  applyRemoteNodes: (nodes: AppNode[]) => void;
  /** Apply remote edges directly (no undo, no dirty flag) */
  applyRemoteEdges: (edges: AppEdge[]) => void;
}

// ═══════════════════════════════════════════════════════════════
// Converters
// ═══════════════════════════════════════════════════════════════

function pkgToNodes(
  pkg: SerializableEPackage,
  posMap: Map<string, { x: number; y: number }>,
  violationsMap?: Map<string, Array<{
    constraintId: string;
    constraintName: string;
    expression: string;
    severity: 'error' | 'warning' | 'info';
    passed: boolean;
    error?: string;
  }>>,
): AppNode[] {
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
      violations: violationsMap?.get(c.id)?.filter(v => !v.passed) || [],
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
 * Determinación de handles para edges con smart routing (4 lados).
 * Escoge el par source/target handle que minimiza la distancia entre
 * los puntos de conexión, evitando que las aristas crucen los nodos.
 *
 * Algoritmo: calcula la distancia entre cada combinación de lados
 * (source: left/right/top/bottom × target: left/right/top/bottom)
 * y elige la que produce el camino más corto y natural.
 */
type HandleSide = 'left' | 'right' | 'top' | 'bottom';

const DEFAULT_W = 180;
const DEFAULT_H = 140;

function getHandlePoint(
  pos: { x: number; y: number },
  side: HandleSide,
  w = DEFAULT_W,
  h = DEFAULT_H,
): { x: number; y: number } {
  switch (side) {
    case 'left': return { x: pos.x, y: pos.y + h / 2 };
    case 'right': return { x: pos.x + w, y: pos.y + h / 2 };
    case 'top': return { x: pos.x + w / 2, y: pos.y };
    case 'bottom': return { x: pos.x + w / 2, y: pos.y + h };
  }
}

function bestHandleForEdge(
  sourceId: string,
  targetId: string,
  posMap?: Map<string, { x: number; y: number }>,
): { sourceHandlePos: HandleSide; targetHandlePos: HandleSide } {
  const sourcePos = posMap?.get(sourceId);
  const targetPos = posMap?.get(targetId);

  if (!sourcePos || !targetPos) {
    return { sourceHandlePos: 'right', targetHandlePos: 'left' };
  }

  const sides: HandleSide[] = ['left', 'right', 'top', 'bottom'];
  let bestDist = Infinity;
  let bestSource: HandleSide = 'right';
  let bestTarget: HandleSide = 'left';

  for (const sSide of sides) {
    const sp = getHandlePoint(sourcePos, sSide);
    for (const tSide of sides) {
      const tp = getHandlePoint(targetPos, tSide);
      const dx = sp.x - tp.x;
      const dy = sp.y - tp.y;
      const dist = dx * dx + dy * dy; // squared distance (no need for sqrt)

      // Penalize same-side connections (both left or both right etc.)
      // because they produce U-shaped paths that look worse
      const sameSidePenalty = sSide === tSide ? 1.3 : 1.0;
      const adjusted = dist * sameSidePenalty;

      if (adjusted < bestDist) {
        bestDist = adjusted;
        bestSource = sSide;
        bestTarget = tSide;
      }
    }
  }

  return { sourceHandlePos: bestSource, targetHandlePos: bestTarget };
}

function pkgToEdges(pkg: SerializableEPackage, _posMap?: Map<string, { x: number; y: number }>): AppEdge[] {
  const out: AppEdge[] = [];
  const seenIds = new Set<string>();
  for (const c of pkg.eClassifiers ?? []) {
    if (!isClass(c)) continue;

    // Inheritance edges: child → parent (source=child, target=parent)
    if (c.eSuperTypes) {
      for (const superTypeId of c.eSuperTypes) {
        if (!superTypeId) continue;
        const edgeId = `inh_${c.id}_${superTypeId}`;
        // Avoid duplicates (when both classes declare the same super type)
        if (seenIds.has(edgeId)) continue;
        seenIds.add(edgeId);
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

  // ── Port spreading: assign index/total per (node, side) ──
  // Group all connections by the (nodeId, side) they touch
  const portGroups = new Map<string, number[]>(); // key → edge indices in `out`
  for (let i = 0; i < out.length; i++) {
    const e = out[i];
    const sKey = `${e.source}|${e.sourceHandle ?? 'right'}`;
    const tKey = `${e.target}|${e.targetHandle ?? 'left'}`;
    if (!portGroups.has(sKey)) portGroups.set(sKey, []);
    portGroups.get(sKey)!.push(i);
    if (!portGroups.has(tKey)) portGroups.set(tKey, []);
    portGroups.get(tKey)!.push(i);
  }

  // ── Pair grouping: edges between the same two nodes (for mid-segment offset) ──
  const pairGroups = new Map<string, number[]>();
  for (let i = 0; i < out.length; i++) {
    const e = out[i];
    const pairKey = [e.source, e.target].sort().join('|');
    if (!pairGroups.has(pairKey)) pairGroups.set(pairKey, []);
    pairGroups.get(pairKey)!.push(i);
  }

  // For each edge, assign port and pair info
  for (let i = 0; i < out.length; i++) {
    const e = out[i];
    const sKey = `${e.source}|${e.sourceHandle ?? 'right'}`;
    const tKey = `${e.target}|${e.targetHandle ?? 'left'}`;

    const sourceGroup = portGroups.get(sKey)!;
    const targetGroup = portGroups.get(tKey)!;

    const sourcePortIndex = sourceGroup.indexOf(i);
    const targetPortIndex = targetGroup.indexOf(i);

    const pairKey = [e.source, e.target].sort().join('|');
    const pairGroup = pairGroups.get(pairKey)!;
    const pairIndex = pairGroup.indexOf(i);

    (e.data as EcoreEdgeData).sourcePortIndex = sourcePortIndex;
    (e.data as EcoreEdgeData).sourcePortTotal = sourceGroup.length;
    (e.data as EcoreEdgeData).targetPortIndex = targetPortIndex;
    (e.data as EcoreEdgeData).targetPortTotal = targetGroup.length;
    (e.data as EcoreEdgeData).pairIndex = pairIndex;
    (e.data as EcoreEdgeData).pairTotal = pairGroup.length;
  }

  return out;
}

// ═══════════════════════════════════════════════════════════════
// Hook
// ═══════════════════════════════════════════════════════════════

export function useEcoreModel({ projectId, metamodelId, initialPkg, violationsMap }: UseEcoreModelOptions): UseEcoreModelReturn {
  // ── Core state ─────────────────────────────────────────────
  const [pkg, setPkg] = useState<SerializableEPackage>(() =>
    initialPkg ?? { name: 'model', nsURI: '', nsPrefix: '', eClassifiers: [] },
  );

  // We need our OWN node/edge state, NOT useNodesState (to avoid hook-count issues)
  const [nodes, setNodes] = useState<AppNode[]>(() => {
    if (initialPkg) return pkgToNodes(initialPkg, new Map(), violationsMap);
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

  // ── Undo/Redo stacks ────────────────────────────────────────
  const [undoStack, setUndoStack] = useState<SerializableEPackage[]>([]);
  const [redoStack, setRedoStack] = useState<SerializableEPackage[]>([]);

  // Wrapper around setPkg that pushes snapshots to undo stack
  const setPkgWithUndo = useCallback(
    (updater: SerializableEPackage | ((prev: SerializableEPackage) => SerializableEPackage)) => {
      setPkg((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        if (next === prev) return prev;
        setUndoStack((stack) => {
          const nextStack = [...stack, structuredClone(prev)];
          return nextStack.length > 50 ? nextStack.slice(-50) : nextStack;
        });
        setRedoStack([]);
        return next;
      });
    },
    [],
  );

  const undo = useCallback(() => {
    setUndoStack((stack) => {
      if (stack.length === 0) return stack;
      const prev = stack[stack.length - 1];
      const rest = stack.slice(0, -1);
      setPkg((current) => {
        setRedoStack((rstack) => [...rstack, structuredClone(current)]);
        return prev;
      });
      setIsDirty(true);
      return rest;
    });
  }, []);

  const redoFn = useCallback(() => {
    setRedoStack((stack) => {
      if (stack.length === 0) return stack;
      const next = stack[stack.length - 1];
      const rest = stack.slice(0, -1);
      setPkg((current) => {
        setUndoStack((ustack) => [...ustack, structuredClone(current)]);
        return next;
      });
      setIsDirty(true);
      return rest;
    });
  }, []);

  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const posMap = useRef<Map<string, { x: number; y: number }>>(new Map());
  const pkgRef = useRef(pkg);
  pkgRef.current = pkg;
  const violationsMapRef = useRef(violationsMap);
  violationsMapRef.current = violationsMap;
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const initialLoadDone = useRef(false);

  // ── Initialize from initialPkg ──────────────────────────────
  useEffect(() => {
    if (initialPkg && !initialLoadDone.current) {
      initialLoadDone.current = true;
      const pos = new Map<string, { x: number; y: number }>();
      // Populate posMap from loaded classifier positions
      for (const c of initialPkg.eClassifiers ?? []) {
        const p = (c as any).position;
        if (p && typeof p.x === 'number' && typeof p.y === 'number') {
          pos.set(c.id, { x: p.x, y: p.y });
        }
      }
      setNodes(pkgToNodes(initialPkg, pos, violationsMap));
      setEdges(pkgToEdges(initialPkg, pos));
      posMap.current = pos;
      setPkg(initialPkg);
    }
  }, [initialPkg]);

  // ── Re-sync from pkg (recompute nodes/edges preserving positions) ─
  // Preserves React Flow internal state (measured dimensions, internals)
  // to avoid "node not initialized" warning (#015) after remote updates.
  const resync = useCallback(() => {
    setNodes((currentNodes) => {
      const freshNodes = pkgToNodes(pkgRef.current, posMap.current, violationsMapRef.current);
      // Preserve measured dimensions from current nodes so React Flow
      // doesn't lose track of node sizes (which causes error #015 on drag)
      const currentMap = new Map(currentNodes.map(n => [n.id, n]));
      return freshNodes.map(fresh => {
        const existing = currentMap.get(fresh.id);
        if (existing?.measured) {
          return { ...fresh, measured: existing.measured };
        }
        return fresh;
      });
    });
    setEdges(pkgToEdges(pkgRef.current, posMap.current));
  }, []);

  // ── Auto-save (disabled — handled by EcoreEditor with leader election) ──

  // ── Selection ─────────────────────────────────────────────
  const setSelected = useCallback((id: string | null, type: string | null) => {
    setSelectedId(id);
    setSelectedType(type);
  }, []);

  // ── Track locally-dragging nodes (prevents remote updates mid-drag) ──
  const draggingNodesRef = useRef<Set<string>>(new Set());

  // ── React Flow handlers ────────────────────────────────────
  const onNodesChange: OnNodesChange = useCallback(
    (changes: NodeChange[]) => {
      let positionChanged = false;
      setNodes((cur) => {
        // Track positions + dragging state
        for (const ch of changes) {
          if (ch.type === 'position' && 'position' in ch && ch.position) {
            posMap.current.set(ch.id, { ...ch.position });
            positionChanged = true;
          }
          if (ch.type === 'position' && ch.dragging === true) {
            draggingNodesRef.current.add(ch.id);
          }
          if (ch.type === 'position' && ch.dragging === false) {
            draggingNodesRef.current.delete(ch.id);
            setIsDirty(true);
          }
        }
        return applyNodeChanges(changes, cur) as AppNode[];
      });
      // Recompute edge handles on every position change so arrows stay correct during drag
      if (positionChanged) {
        setEdges(pkgToEdges(pkgRef.current, posMap.current));
      }
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
      setPkgWithUndo((prev) => {
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
      setPkgWithUndo((prev) => {
        const count = prev.eClassifiers.length;
        const pos = { x: 100 + (count % 4) * 240, y: 100 + Math.floor(count / 4) * 220 };

        // Generate a unique name with dedup counter
        const baseName = type === 'class' ? 'NewClass' : type === 'enum' ? 'NewEnum' : 'NewType';
        let suffix = count + 1;
        const existingNames = new Set(prev.eClassifiers.map((c) => c.name));
        while (existingNames.has(`${baseName}${suffix}`)) {
          suffix++;
        }

        let newClassifier: any;
        const id = genId('ec');
        if (type === 'class') {
          newClassifier = { id, name: `${baseName}${suffix}`, abstract: false, interface: false, eSuperTypes: [], eAttributes: [], eReferences: [], position: pos };
        } else if (type === 'enum') {
          newClassifier = { id, name: `${baseName}${suffix}`, eLiterals: [{ id: genId('lit'), name: 'LITERAL1', value: 0 }] };
        } else {
          newClassifier = { id, name: `${baseName}${suffix}`, instanceClassName: 'java.lang.String' };
        }

        return { ...prev, eClassifiers: [...prev.eClassifiers, newClassifier] };
      });
      setTimeout(() => { setIsDirty(true); }, 0);
    },
    [],
  );

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    setPkgWithUndo((prev) => {
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
    setPkgWithUndo((prev) => ({
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
    const refId = genId('ref');
    setPkgWithUndo((prev) => ({
      ...prev,
      eClassifiers: prev.eClassifiers.map((c) => {
        if (c.id !== classId || !isClass(c)) return c;
        return {
          ...c,
          eReferences: [...c.eReferences, { id: refId, name: 'newRef', targetId: '', containment: false, lowerBound: 0, upperBound: -1, eOpposite: null, changeable: true, derived: false }],
        };
      }),
    }));
    // Auto-select the new reference so user can set targetId in PropertyInspector
    setTimeout(() => {
      setSelectedId(refId);
      setSelectedType('reference');
    }, 0);
    setIsDirty(true);
  }, []);

  const deleteFeature = useCallback((parentId: string, featureId: string) => {
    setPkgWithUndo((prev) => ({
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
    setPkgWithUndo((prev) => ({
      ...prev,
      eClassifiers: prev.eClassifiers.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    }));
    setIsDirty(true);
  }, []);

  // ── Wire real callbacks into module-level references      ──
  _callbacks.onAddAttribute = addAttribute;
  _callbacks.onAddReference = addReference;
  _callbacks.onClassifierChange = handleClassifierChange;
  _callbacks.onSelect = (id: string | null, type?: string | null) => setSelected(id, type ?? null);

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
        newClassifier = { id, name: `NewType`, instanceClassName: 'java.lang.String' };
      }
      setPkgWithUndo((prev) => ({ ...prev, eClassifiers: [...prev.eClassifiers, newClassifier] }));
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

  // ── Auto Layout ─────────────────────────────────────────────
  const autoLayout = useCallback(async (direction: 'TB' | 'LR' = 'TB') => {
    const currentNodes = nodesRef.current;
    const currentEdges = pkgToEdges(pkgRef.current, posMap.current);
    const positions = computeAutoLayout(currentNodes, currentEdges, { direction });
    // Apply positions to posMap and trigger resync
    positions.forEach((pos, id) => {
      posMap.current.set(id, pos);
    });
    resync();
    // Save immediately to persist positions before remote echo can overwrite posMap
    await save();
  }, [resync, save]);

  // ── Re-sync when pkg changes ────────────────────────────────
  useEffect(() => {
    resync();
  }, [pkg, resync]);

  // ── Remote state application (no undo, no dirty, no auto-save) ──
  // Updates pkgRef (source of truth for save) from remote node data,
  // then resync() regenerates nodes with proper callbacks.
  // Skips position updates for nodes the local user is currently dragging.
  // Applies CSS transition for smooth remote movement (Figma-style).
  const applyRemoteNodes = useCallback((remoteNodes: AppNode[]) => {
    const dragging = draggingNodesRef.current;

    // 1. Update posMap from remote positions (skip dragging nodes)
    for (const n of remoteNodes) {
      if (n.position && !dragging.has(n.id)) {
        posMap.current.set(n.id, { ...n.position });
      }
    }

    // 2. Rebuild eClassifiers from remote node data
    const remoteClassifiers = remoteNodes
      .map((n) => (n.data as any)?.classifier)
      .filter(Boolean);

    if (remoteClassifiers.length === 0) {
      // No classifier data in remote nodes — just update positions visually
      const remoteMap = new Map(remoteNodes.map(n => [n.id, n]));
      setNodes((cur) =>
        cur.map((node) => {
          // Never override position of a node the user is actively dragging
          if (dragging.has(node.id)) return node;
          const remote = remoteMap.get(node.id);
          if (!remote) return node;
          const posChanged = remote.position.x !== node.position.x ||
                            remote.position.y !== node.position.y;
          if (!posChanged) return node;
          return {
            ...node,
            position: { ...remote.position },
          };
        }),
      );
      return;
    }

    // 3. Update pkg (source of truth) — triggers resync via useEffect[pkg]
    // Use setPkg directly (not setPkgWithUndo) to avoid undo stack pollution
    setPkg((prev) => ({
      ...prev,
      eClassifiers: remoteClassifiers,
    }));
  }, []);

  const applyRemoteEdges = useCallback((_remoteEdges: AppEdge[]) => {
    // Edges are derived from pkg (references/supertypes) — they'll be
    // regenerated by resync() when pkg updates from applyRemoteNodes.
    // Only update if remote edges carry data not derivable from pkg
    // (currently all edges ARE derived from pkg, so this is a no-op).
  }, []);

  return useMemo(() => ({
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
    undo: undo,
    redo: redoFn,
    canUndo,
    canRedo,
    autoLayout,
    applyRemoteNodes,
    applyRemoteEdges,
  }), [
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
    undo,
    redoFn,
    canUndo,
    canRedo,
    autoLayout,
    applyRemoteNodes,
    applyRemoteEdges,
  ]);
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
          position: pos,
          eLiterals: (c.eLiterals || []).map((l) => ({ ...l })),
        };
      }
      return { ...c, position: pos };
    }),
  };
}
