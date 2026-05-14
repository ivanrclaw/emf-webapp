/**
 * @emf-webapp/frontend — useEcoreModel Hook
 *
 * Hook principal para el editor visual de metamodelos Ecore.
 *
 * Arquitectura:
 *   - `pkg` (SerializableEPackage) es la fuente de verdad para DATOS
 *   - React Flow maneja su propio estado UI (posición, selección, dimensiones)
 *   - Tras cambios semánticos + debounce, se sincroniza a pkg y se re-derivan
 *     los nodos/edges de React Flow preservando posiciones
 *   - Cambios de UI (arrastrar, seleccionar) no tocan el modelo
 *
 * Debe llamarse DENTRO de un ReactFlowProvider para usar useNodesState.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  useNodesState,
  useEdgesState,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type NodeChange,
  type EdgeChange,
  type Connection,
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
  EcoreEdgeType,
  EditorState,
} from './types';
import { updateMetamodelContent } from '../../api/client';

// ═══════════════════════════════════════════════════════════════
// ID generator (UUID v4 sin dash para @emf-webapp/types/CommonId)
// ═══════════════════════════════════════════════════════════════

let _counter = 0;
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${++_counter}`;
}

// ═══════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════

const DEFAULT_POSITION = { x: 250, y: 150 };
const AUTO_SAVE_DELAY = 2000;

// ═══════════════════════════════════════════════════════════════
// Converters: Package ⇄ Nodes/Edges
// ═══════════════════════════════════════════════════════════════

/**
 * Convierte SerializableEPackage → AppNode[] + AppEdge[]
 *
 * @param pkg        Paquete fuente
 * @param posMap     Mapa de posiciones { id → {x,y} } (preserva arrastres)
 */
function buildNodesAndEdges(
  pkg: SerializableEPackage,
  posMap: Map<string, { x: number; y: number }>,
): { nodes: AppNode[]; edges: AppEdge[] } {
  const nodes: AppNode[] = [];
  const edges: AppEdge[] = [];

  // ── Type helpers ────────────────────────────────────────────
  const isClass = (c: any): c is SerializableEClass =>
    'eAttributes' in c && 'eReferences' in c;
  const isEnum = (c: any): c is SerializableEEnum =>
    'eLiterals' in c && !('eAttributes' in c);
  const isDataType = (c: any): c is SerializableEDataType =>
    !isClass(c) && !isEnum(c);

  // ── EClass nodes ────────────────────────────────────────────
  const classifiers = pkg.eClassifiers ?? [];

  function makeNodeData(
    c: SerializableEClass | SerializableEEnum | SerializableEDataType,
    type: EcoreNodeType,
  ): EcoreNodeData {
    return {
      label: 'label' in c ? (c as any).name || 'Unnamed' : 'Unnamed',
      type,
      classifier: c,
      ePackage: pkg,
      onClassifierChange: handleClassifierChangeStub,
      onAddAttribute: () => {},
      onAddReference: () => {},
      onSelect: () => {},
    };
  }

  function pushNode(id: string, nodeType: string, pos: { x: number; y: number }, data: EcoreNodeData): void {
    (nodes as any[]).push({ id, type: nodeType, position: pos, data });
  }

  for (const c of classifiers) {
    if (isClass(c)) {
      const pos = posMap.get(c.id) ?? c.position ?? DEFAULT_POSITION;
      pushNode(c.id, 'eClassNode', pos, makeNodeData(c, 'ecoreClass'));
    }
  }

  // ── EEnum nodes ─────────────────────────────────────────────
  for (const c of classifiers) {
    if (isEnum(c)) {
      const pos = posMap.get(c.id) ?? c.position ?? DEFAULT_POSITION;
      pushNode(c.id, 'eEnumNode', pos, makeNodeData(c, 'ecoreEnum'));
    }
  }

  // ── EDataType nodes ─────────────────────────────────────────
  for (const c of classifiers) {
    if (isDataType(c)) {
      const pos = posMap.get(c.id) ?? c.position ?? DEFAULT_POSITION;
      pushNode(c.id, 'eDataTypeNode', pos, makeNodeData(c, 'ecoreDataType'));
    }
  }

  // ── Edge tracking: store edges by ref ID so we don't duplicate ───
  const emittedEdges = new Set<string>();

  // ── EReference edges (containment / reference) ──────────────
  for (const c of classifiers) {
    if (!isClass(c)) continue;
    for (const ref of c.eReferences) {
      if (!ref.targetId) continue;
      const edgeId = `ref_${ref.id}`;
      if (emittedEdges.has(edgeId)) continue;
      emittedEdges.add(edgeId);

      const edgeType: EcoreEdgeType = ref.containment ? 'containmentEdge' : 'referenceEdge';
      const edgeData: EcoreEdgeData = {
        label: ref.name,
        type: edgeType,
        sourceId: c.id,
        targetId: ref.targetId,
        reference: ref,
        onSelect: () => {},
      };
      edges.push({
        id: edgeId,
        source: c.id,
        target: ref.targetId,
        type: edgeType,
        data: edgeData,
      } as AppEdge);
    }
  }

  // ── Inheritance edges (child → parent) ──────────────────────
  for (const c of classifiers) {
    if (!isClass(c)) continue;
    for (const superId of c.eSuperTypes) {
      const edgeId = `inh_${c.id}_${superId}`;
      if (emittedEdges.has(edgeId)) continue;
      emittedEdges.add(edgeId);

      const edgeData: EcoreEdgeData = {
        label: '',
        type: 'inheritanceEdge',
        sourceId: c.id,
        targetId: superId,
        reference: undefined,
        onSelect: () => {},
      };
      edges.push({
        id: edgeId,
        source: c.id,
        target: superId,
        type: 'inheritanceEdge',
        data: edgeData,
      } as AppEdge);
    }
  }

  return { nodes, edges };
}

// ═══════════════════════════════════════════════════════════════
// Stub (will be replaced by real callbacks after mount)
// ═══════════════════════════════════════════════════════════════

function handleClassifierChangeStub() {
  console.warn('handleClassifierChange not yet wired');
}

// ═══════════════════════════════════════════════════════════════
// THE HOOK
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
  onDropNode: (type: 'class' | 'enum' | 'dataType', position: { x: number; y: number }) => void;

  pkg: SerializableEPackage;

  selectedId: string | null;
  selectedType: string | null;
  setSelected: (id: string | null, type: string | null) => void;

  addClassifier: (type: 'class' | 'enum' | 'dataType') => void;
  deleteSelected: () => void;
  addAttribute: (classId: string) => void;
  addReference: (classId: string) => void;
  deleteFeature: (parentId: string, featureId: string) => void;
  handleClassifierChange: (id: string, updates: Partial<SerializableEClass | SerializableEEnum | SerializableEDataType>) => void;
  handleFeatureChange: (parentId: string, featureId: string, updates: Partial<SerializableEAttribute | SerializableEReference>) => void;

  isDirty: boolean;
  save: () => Promise<void>;
  loading: boolean;
  error: string | null;
}

export function useEcoreModel({ projectId, metamodelId, initialPkg }: UseEcoreModelOptions): UseEcoreModelReturn {
  // ── Package data state ──────────────────────────────────────
  const [pkg, setPkg] = useState<SerializableEPackage>(() => {
    if (initialPkg) return initialPkg;
    return { name: 'model', nsURI: '', nsPrefix: '', eClassifiers: [] };
  });

  // ── React Flow state ────────────────────────────────────────
  const [nodes, setNodes, onNodesChangeBase] = useNodesState<AppNode>([]);
  const [edges, setEdges, onEdgesChangeBase] = useEdgesState<AppEdge>([]);

  // ── Selection ──────────────────────────────────────────────
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const setSelected = useCallback((id: string | null, type: string | null) => {
    setSelectedId(id);
    setSelectedType(type);
  }, []);

  // ── Dirty + auto-save ──────────────────────────────────────
  const [isDirty, setIsDirty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nodesVersionRef = useRef(0); // increment when model-derived nodes change
  const pkgRef = useRef(pkg);
  pkgRef.current = pkg; // always up-to-date for closures

  // ── Position snapshot (persists across model re-derives) ────
  const posMapRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // =============================================================
  // Sync: Package → Nodes/Edges (on semantic change only)
  // =============================================================

  /**
   * Reconstruye nodos/edges desde pkg, preservando posiciones
   * actuales. Llámala tras cambios semánticos.
   */
  const syncFromModel = useCallback(
    (newPkg: SerializableEPackage, currentNodes: AppNode[]) => {
      // Build position map from current nodes
      const currentPositions = new Map<string, { x: number; y: number }>();
      for (const n of currentNodes) {
        currentPositions.set(n.id, { ...n.position });
      }

      const { nodes: newNodes, edges: newEdges } = buildNodesAndEdges(newPkg, currentPositions);

      // Wire real callbacks into node data
      const wiredNodes = newNodes.map((n) => ({
        ...n,
        data: {
          ...n.data,
          onClassifierChange: (id: string, updates: any) => {
            handleClassifierChange(id, updates);
          },
          onAddAttribute: (classId: string) => addAttribute(classId),
          onAddReference: (classId: string) => addReference(classId),
          onSelect: (id: string | null) => {
            const found = findElement(newPkg, id ?? '');
            if (found) {
              setSelectedId(id);
              setSelectedType(found.type);
            } else {
              setSelectedId(id);
              setSelectedType(null);
            }
          },
        },
      }));

      const wiredEdges = newEdges.map((e) => ({
        ...e,
        data: {
          ...e.data,
          onSelect: (edgeId: string | null) => {
            setSelectedId(edgeId);
            setSelectedType('edge');
          },
        },
      }));

      setNodes(wiredNodes as any);
      setEdges(wiredEdges as any);
      nodesVersionRef.current += 1;
      posMapRef.current = currentPositions;
    },
    [],
  );

  // ── Initialize on mount ────────────────────────────────────
  const initialSyncDone = useRef(false);
  useEffect(() => {
    if (initialPkg && !initialSyncDone.current) {
      initialSyncDone.current = true;
      const currentNodes: AppNode[] = [];
      syncFromModel(initialPkg, currentNodes);
    }
  }, [initialPkg, syncFromModel]);

  // =============================================================
  // React Flow event handlers
  // =============================================================

  /**
   * Capturamos cambios de nodos, preservando posiciones para
   * futuras re-derivaciones del modelo.
   * La posición ES accesible desde currentNodes, así que
   * delegamos en useNodesState.
   */
  const onNodesChange: OnNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((curNodes) => {
        // Track position changes for model sync
        for (const ch of changes) {
          if (ch.type === 'position' && 'position' in ch && ch.position) {
            posMapRef.current.set(ch.id, { ...ch.position });
          }
          // Detect completed drag → mark dirty
          if (ch.type === 'position' && ch.dragging === false) {
            setIsDirty(true);
          }
        }
        const updated = applyNodeChanges(changes, curNodes) as AppNode[];
        return updated;
      });
    },
    [],
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((curEdges) => {
        const updated = applyEdgeChanges(changes, curEdges) as AppEdge[];
        return updated;
      });
    },
    [],
  );

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;

      setPkg((prev) => {
        const foundSource = findElement(prev, connection.source);
        const foundTarget = findElement(prev, connection.target);
        if (!foundSource || foundSource.type !== 'class' || !foundTarget || foundTarget.type !== 'class') return prev;

        const cls = foundSource.element as SerializableEClass;
        const targetCls = foundTarget.element as SerializableEClass;

        const newRef: SerializableEReference = {
          id: generateId('ref'),
          name: targetCls.name.toLowerCase(),
          targetId: connection.target,
          containment: false,
          lowerBound: 0,
          upperBound: -1,
          eOpposite: null,
          changeable: true,
          derived: false,
        };

        const updated = {
          ...prev,
          eClassifiers: prev.eClassifiers.map((c) => {
            if (c.id !== cls.id || !('eReferences' in c)) return c;
            return { ...c, eReferences: [...(c as SerializableEClass).eReferences, newRef] };
          }),
        };

        // Schedule sync
        setTimeout(() => syncFromModel(updated, []), 0);
        setIsDirty(true);
        return updated;
      });
    },
    [syncFromModel],
  );

  // =============================================================
  // Semantic callbacks
  // =============================================================

  const findElement = useCallback(
    (
      p: SerializableEPackage,
      id: string,
    ): { type: string; element: any } | null => {
      for (const c of p.eClassifiers) {
        if (c.id === id) {
          if ('eAttributes' in c && 'eReferences' in c) return { type: 'class', element: c };
          if ('eLiterals' in c && !('eAttributes' in c)) return { type: 'enum', element: c };
          return { type: 'dataType', element: c };
        }
        if ('eAttributes' in c && 'eReferences' in c) {
          const cls = c as SerializableEClass;
          const attr = cls.eAttributes.find((a) => a.id === id);
          if (attr) return { type: 'attribute', element: attr };
          const ref = cls.eReferences.find((r) => r.id === id);
          if (ref) return { type: 'reference', element: ref };
        }
      }
      return null;
    },
    [],
  );

  const handleClassifierChange = useCallback(
    (id: string, updates: Partial<SerializableEClass | SerializableEEnum | SerializableEDataType>) => {
      setPkg((prev) => {
        const updated = {
          ...prev,
          eClassifiers: prev.eClassifiers.map((c) =>
            c.id === id ? ({ ...c, ...updates } as any) : c,
          ),
        };
        // Defer sync to next tick to avoid stale closure
        setTimeout(() => syncFromModel(updated, []), 0);
        setIsDirty(true);
        return updated;
      });
    },
    [syncFromModel],
  );

  const handleFeatureChange = useCallback(
    (parentId: string, featureId: string, updates: Partial<SerializableEAttribute | SerializableEReference>) => {
      setPkg((prev) => {
        const updated = {
          ...prev,
          eClassifiers: prev.eClassifiers.map((c) => {
            if (c.id !== parentId || !('eAttributes' in c)) return c;
            const cls = c as SerializableEClass;
            return {
              ...cls,
              eAttributes: cls.eAttributes.map((a) =>
                a.id === featureId ? ({ ...a, ...updates } as SerializableEAttribute) : a,
              ),
              eReferences: cls.eReferences.map((r) =>
                r.id === featureId ? ({ ...r, ...updates } as SerializableEReference) : r,
              ),
            };
          }),
        };
        setTimeout(() => syncFromModel(updated, []), 0);
        setIsDirty(true);
        return updated;
      });
    },
    [syncFromModel],
  );

  const addClassifier = useCallback(
    (type: 'class' | 'enum' | 'dataType') => {
      setPkg((prev) => {
        const count = prev.eClassifiers.length;
        const pos = { x: 100 + (count % 4) * 240, y: 100 + Math.floor(count / 4) * 220 };

        if (type === 'class') {
          const newCls: SerializableEClass = {
            id: generateId('ec'),
            name: `NewClass${count + 1}`,
            abstract: false,
            interface: false,
            eSuperTypes: [],
            eAttributes: [],
            eReferences: [],
            position: pos,
          };
          return {
            ...prev,
            eClassifiers: [...prev.eClassifiers, newCls as any],
          };
        }

        if (type === 'enum') {
          const newEnum: SerializableEEnum = {
            id: generateId('een'),
            name: `NewEnum${count + 1}`,
            eLiterals: [{ id: generateId('lit'), name: 'LITERAL1', value: 0, literal: 'LITERAL1' }],
            position: pos,
          };
          return {
            ...prev,
            eClassifiers: [...prev.eClassifiers, newEnum as any],
          };
        }

        // dataType
        const newDT: SerializableEDataType = {
          id: generateId('edt'),
          name: `NewDataType${count + 1}`,
          instanceClassName: 'java.lang.String',
          serializable: true,
          position: pos,
        };
        return {
          ...prev,
          eClassifiers: [...prev.eClassifiers, newDT as any],
        };
      });
    },
    [],
  );

  const addAttribute = useCallback(
    (classId: string) => {
      setPkg((prev) => {
        const newAttr: SerializableEAttribute = {
          id: generateId('attr'),
          name: 'newAttribute',
          eType: 'EString',
          lowerBound: 0,
          upperBound: 1,
          iD: false,
          defaultValueLiteral: '',
          changeable: true,
          derived: false,
          transient: false,
        };
        return {
          ...prev,
          eClassifiers: prev.eClassifiers.map((c) => {
            if (c.id !== classId || !('eAttributes' in c)) return c;
            return { ...c, eAttributes: [...(c as SerializableEClass).eAttributes, newAttr] };
          }),
        };
      });
    },
    [],
  );

  const addReference = useCallback(
    (classId: string) => {
      setPkg((prev) => {
        const newRef: SerializableEReference = {
          id: generateId('ref'),
          name: 'newReference',
          targetId: '',
          containment: false,
          lowerBound: 0,
          upperBound: -1,
          eOpposite: null,
          changeable: true,
          derived: false,
        };
        return {
          ...prev,
          eClassifiers: prev.eClassifiers.map((c) => {
            if (c.id !== classId || !('eReferences' in c)) return c;
            return { ...c, eReferences: [...(c as SerializableEClass).eReferences, newRef] };
          }),
        };
      });
    },
    [],
  );

  const deleteFeature = useCallback(
    (parentId: string, featureId: string) => {
      setPkg((prev) => ({
        ...prev,
        eClassifiers: prev.eClassifiers.map((c) => {
          if (c.id !== parentId || !('eAttributes' in c)) return c;
          return {
            ...c,
            eAttributes: (c as SerializableEClass).eAttributes.filter((a) => a.id !== featureId),
            eReferences: (c as SerializableEClass).eReferences.filter((r) => r.id !== featureId),
          };
        }),
      }));
    },
    [],
  );

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    const found = findElement(pkgRef.current, selectedId);
    if (!found) {
      setSelectedId(null);
      setSelectedType(null);
      return;
    }
    if (found.type === 'attribute' || found.type === 'reference') {
      // Find parent
      for (const c of pkgRef.current.eClassifiers) {
        if ('eAttributes' in c && 'eReferences' in c) {
          const cls = c as SerializableEClass;
          if (cls.eAttributes.some((a) => a.id === selectedId) || cls.eReferences.some((r) => r.id === selectedId)) {
            deleteFeature(cls.id, selectedId);
            break;
          }
        }
      }
    } else {
      // Delete classifier
      setPkg((prev) => ({
        ...prev,
        eClassifiers: prev.eClassifiers.filter((c) => c.id !== selectedId),
      }));
    }
    setSelectedId(null);
    setSelectedType(null);
  }, [selectedId, findElement, deleteFeature]);

  // ── Sync after pkg changes (via effect) ────────────────────
  useEffect(() => {
    if (initialSyncDone.current) {
      setNodes((curNodes) => {
        syncFromModel(pkg, curNodes);
        return curNodes; // syncFromModel already calls setNodes
      });
    }
  }, [pkg]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Drag & Drop ────────────────────────────────────────────
  const onDropNode = useCallback(
    (type: 'class' | 'enum' | 'dataType', position: { x: number; y: number }) => {
      setPkg((prev) => {
        const count = prev.eClassifiers.length;
        if (type === 'class') {
          const newCls: SerializableEClass = {
            id: generateId('ec'),
            name: `NewClass${count + 1}`,
            abstract: false,
            interface: false,
            eSuperTypes: [],
            eAttributes: [],
            eReferences: [],
            position,
          };
          return { ...prev, eClassifiers: [...prev.eClassifiers, newCls as any] };
        }
        if (type === 'enum') {
          const newEnum: SerializableEEnum = {
            id: generateId('een'),
            name: `NewEnum${count + 1}`,
            eLiterals: [{ id: generateId('lit'), name: 'LITERAL1', value: 0, literal: 'LITERAL1' }],
            position,
          };
          return { ...prev, eClassifiers: [...prev.eClassifiers, newEnum as any] };
        }
        const newDT: SerializableEDataType = {
          id: generateId('edt'),
          name: `NewDataType${count + 1}`,
          instanceClassName: 'java.lang.String',
          serializable: true,
          position,
        };
        return { ...prev, eClassifiers: [...prev.eClassifiers, newDT as any] };
      });
    },
    [],
  );

  // =============================================================
  // Auto-save
  // =============================================================

  const save = useCallback(async () => {
    if (!projectId || !metamodelId) return;
    setLoading(true);
    setError(null);
    try {
      // Sync current positions into pkg before saving
      const finalPkg = pkgRef.current;
      await updateMetamodelContent(projectId, metamodelId, finalPkg as any);
      setIsDirty(false);
    } catch (err: any) {
      setError(err.message || 'Save failed');
    } finally {
      setLoading(false);
    }
  }, [projectId, metamodelId]);

  useEffect(() => {
    if (!isDirty) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(save, AUTO_SAVE_DELAY);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [isDirty, save]);

  // =============================================================
  // Return
  // =============================================================

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
    handleFeatureChange,
    isDirty,
    save,
    loading,
    error,
  };
}

export default useEcoreModel;
