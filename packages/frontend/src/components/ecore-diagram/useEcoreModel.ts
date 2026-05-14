/**
 * @emf-webapp/frontend — useEcoreModel Hook
 *
 * Hook central que gestiona el modelo Ecore, los nodos/edges de React Flow,
 * y la sincronización bidireccional entre el modelo y la representación visual.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  type NodeChange,
  type EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
  type OnNodesChange,
  type OnEdgesChange,
  type Connection,
  addEdge,
} from '@xyflow/react';
import type {
  AppNode,
  AppEdge,
  SerializableEPackage,
  SerializableEClass,
  SerializableEEnum,
  SerializableEDataType,
  SerializableEAttribute,
  SerializableEReference,
  SerializableEEnumLiteral,
  EcoreNodeData,
  EcoreEdgeData,
  ValidationResult,
} from './types';

// ── Type guard ─────────────────────────────────────────────────

function isEClass(c: SerializableEClass | SerializableEEnum | SerializableEDataType): c is SerializableEClass {
  return 'eAttributes' in c && 'eReferences' in c;
}

// ── Helpers para generar IDs únicos ──────────────────────────────

let _idCounter = 0;
function genId(prefix = 'e'): string {
  return `${prefix}_${Date.now()}_${++_idCounter}`;
}

// ── Conversión: EPackage ↔ Nodes/Edges ─────────────────────────

function packageToNodesAndEdges(
  pkg: SerializableEPackage,
  callbacks: {
    onClassifierChange: (id: string, updates: Partial<any>) => void;
    onAddAttribute: (classId: string) => void;
    onAddReference: (classId: string) => void;
    onSelect: (id: string | null) => void;
  },
): { nodes: AppNode[]; edges: AppEdge[] } {
  const nodes: AppNode[] = [];
  const edges: AppEdge[] = [];
  const positions = [
    { x: 50, y: 50 },
    { x: 400, y: 50 },
    { x: 750, y: 50 },
    { x: 50, y: 350 },
    { x: 400, y: 350 },
    { x: 750, y: 350 },
    { x: 50, y: 650 },
    { x: 400, y: 650 },
    { x: 750, y: 650 },
  ];
  let posIdx = 0;

  for (const cls of pkg.eClassifiers) {
    const defaultPos = positions[posIdx++ % positions.length];
    const pos = 'position' in cls && cls.position
      ? cls.position!
      : defaultPos;

    if ('eAttributes' in cls && 'eReferences' in cls) {
      // EClass
      const eclass = cls as SerializableEClass;
      nodes.push({
        id: eclass.id,
        type: 'ecoreClass',
        position: pos,
        data: {
          label: eclass.name,
          type: 'ecoreClass',
          classifier: eclass,
          ePackage: pkg,
          ...callbacks,
        },
      });

      // Herencia
      for (const superId of eclass.eSuperTypes) {
        edges.push({
          id: `inh_${eclass.id}_${superId}`,
          source: eclass.id,
          target: superId,
          type: 'inheritanceEdge',
          data: {
            label: '',
            type: 'inheritanceEdge',
            sourceId: eclass.id,
            targetId: superId,
            onSelect: callbacks.onSelect,
          },
        });
      }

      // Referencias
      for (const ref of eclass.eReferences) {
        edges.push({
          id: `ref_${ref.id}`,
          source: eclass.id,
          target: ref.targetId,
          type: ref.containment ? 'containmentEdge' : 'referenceEdge',
          data: {
            label: ref.name,
            type: ref.containment ? 'containmentEdge' : 'referenceEdge',
            sourceId: eclass.id,
            targetId: ref.targetId,
            reference: ref,
            onSelect: callbacks.onSelect,
          },
        });
      }
    } else if ('eLiterals' in cls) {
      // EEnum
      nodes.push({
        id: cls.id,
        type: 'ecoreEnum',
        position: pos,
        data: {
          label: cls.name,
          type: 'ecoreEnum',
          classifier: cls,
          ePackage: pkg,
          ...callbacks,
        },
      });
    } else {
      // EDataType
      nodes.push({
        id: cls.id,
        type: 'ecoreDataType',
        position: pos,
        data: {
          label: cls.name,
          type: 'ecoreDataType',
          classifier: cls,
          ePackage: pkg,
          ...callbacks,
        },
      });
    }
  }

  return { nodes, edges };
}

function nodesAndEdgesToPackage(
  nodes: AppNode[],
  edges: AppEdge[],
  currentPkg: SerializableEPackage,
): SerializableEPackage {
  const classifiers = [...currentPkg.eClassifiers];

  // Actualizar posiciones desde los nodos
  for (const node of nodes) {
    const idx = classifiers.findIndex((c) => c.id === node.id);
    if (idx >= 0) {
      classifiers[idx] = {
        ...classifiers[idx],
        position: { x: node.position.x, y: node.position.y },
      };
    }
  }

  return { ...currentPkg, eClassifiers: classifiers };
}

// ── Hook Principal ──────────────────────────────────────────────

export function useEcoreModel(initialPkg: SerializableEPackage) {
  const [pkg, setPkg] = useState<SerializableEPackage>(initialPkg);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<
    'class' | 'attribute' | 'reference' | 'enum' | 'dataType' | 'edge' | 'annotation' | null
  >(null);
  const [undoStack, setUndoStack] = useState<SerializableEPackage[]>([]);
  const [redoStack, setRedoStack] = useState<SerializableEPackage[]>([]);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Callbacks para pasar a los nodos
  const onSelect = useCallback((id: string | null) => {
    setSelectedId(id);
    if (id === null) {
      setSelectedType(null);
    }
  }, []);

  const onClassifierChange = useCallback(
    (id: string, updates: Partial<SerializableEClass | SerializableEEnum | SerializableEDataType>) => {
      setPkg((prev) => {
        const newPkg = {
          ...prev,
          eClassifiers: prev.eClassifiers.map((c) =>
            c.id === id ? { ...c, ...updates } as any : c,
          ),
        };
        setUndoStack((u) => [...u.slice(-50), prev]);
        setRedoStack([]);
        setDirty(true);
        return newPkg;
      });
    },
    [],
  );

  const onAddAttribute = useCallback((classId: string) => {
    setPkg((prev) => {
      const newAttr: SerializableEAttribute = {
        id: genId('attr'),
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
      const newPkg = {
        ...prev,
        eClassifiers: prev.eClassifiers.map((c) => {
          if (c.id === classId && 'eAttributes' in c) {
            const cls = c as SerializableEClass;
            return { ...cls, eAttributes: [...cls.eAttributes, newAttr] };
          }
          return c;
        }),
      };
      setUndoStack((u) => [...u.slice(-50), prev]);
      setRedoStack([]);
      setDirty(true);
      return newPkg;
    });
  }, []);

  const onAddReference = useCallback((classId: string) => {
    setPkg((prev) => {
      // Find first other class as default target
      const firstOther = prev.eClassifiers.find(
        (c) => c.id !== classId && 'eAttributes' in c,
      );
      const newRef: SerializableEReference = {
        id: genId('ref'),
        name: 'newReference',
        targetId: firstOther?.id ?? '',
        containment: false,
        lowerBound: 0,
        upperBound: -1,
        eOpposite: null,
        changeable: true,
        derived: false,
      };
      const newPkg = {
        ...prev,
        eClassifiers: prev.eClassifiers.map((c) => {
          if (c.id === classId && 'eReferences' in c) {
            const cls = c as SerializableEClass;
            return { ...cls, eReferences: [...cls.eReferences, newRef] };
          }
          return c;
        }),
      };
      setUndoStack((u) => [...u.slice(-50), prev]);
      setRedoStack([]);
      setDirty(true);
      return newPkg;
    });
  }, []);

  // Construir callbacks
  const callbacks = useMemo(
    () => ({ onClassifierChange, onAddAttribute, onAddReference, onSelect }),
    [onClassifierChange, onAddAttribute, onAddReference, onSelect],
  );

  // Nodos y edges derivados del estado del paquete
  const { nodes, edges } = useMemo(
    () => packageToNodesAndEdges(pkg, callbacks),
    [pkg, callbacks],
  );

  // ── Handlers de React Flow ────────────────────────────────

  const onNodesChange: OnNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setPkg((prev) => {
        // Compute the resulting nodes
      const currentNodes = packageToNodesAndEdges(prev, callbacks).nodes;
      const newNodes = applyNodeChanges(changes, currentNodes) as AppNode[];
      return nodesAndEdgesToPackage(newNodes, [], prev);
      });
    },
    [callbacks],
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      // For now just track selection
      for (const change of changes) {
        if (change.type === 'select') {
          setSelectedId(change.selected ? change.id : null);
          setSelectedType(change.selected ? 'edge' : null);
        }
      }
    },
    [],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;

      setPkg((prev) => {
        const sourceClass = prev.eClassifiers.find(
          (c) => c.id === connection.source && 'eReferences' in c,
        ) as SerializableEClass | undefined;
        if (!sourceClass) return prev;

        // Verificar si la conexión ya existe
        const exists = sourceClass.eReferences.some(
          (r) => r.targetId === connection.target,
        );
        if (exists) return prev;

        const newRef: SerializableEReference = {
          id: genId('ref'),
          name: `to${(prev.eClassifiers.find((c) => c.id === connection.target)?.name ?? 'Target')}`,
          targetId: connection.target,
          containment: false,
          lowerBound: 0,
          upperBound: -1,
          eOpposite: null,
          changeable: true,
          derived: false,
        };

        const newPkg = {
          ...prev,
          eClassifiers: prev.eClassifiers.map((c) => {
            if (c.id === connection.source && 'eReferences' in c) {
              return {
                ...c,
                eReferences: [...(c as SerializableEClass).eReferences, newRef],
              };
            }
            return c;
          }),
        };
        setUndoStack((u) => [...u.slice(-50), prev]);
        setRedoStack([]);
        setDirty(true);
        return newPkg;
      });
    },
    [],
  );

  const onNodeClick = useCallback((_event: React.MouseEvent, node: AppNode) => {
    setSelectedId(node.id);
    const data = node.data as EcoreNodeData;
    const classifier = data.classifier;
    if ('eAttributes' in classifier) setSelectedType('class');
    else if ('eLiterals' in classifier) setSelectedType('enum');
    else setSelectedType('dataType');
  }, []);

  const onEdgeClick = useCallback((_event: React.MouseEvent, edge: AppEdge) => {
    setSelectedId(edge.id);
    setSelectedType('edge');
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedId(null);
    setSelectedType(null);
  }, []);

  // ── Acciones del modelo ───────────────────────────────────

  const addClassifier = useCallback(
    (type: 'class' | 'enum' | 'dataType') => {
      setPkg((prev) => {
        const id = genId('cls');
        let newClassifier: SerializableEClass | SerializableEEnum | SerializableEDataType;

        switch (type) {
          case 'class':
            newClassifier = {
              id,
              name: `NewClass${prev.eClassifiers.length + 1}`,
              abstract: false,
              interface: false,
              eSuperTypes: [],
              eAttributes: [],
              eReferences: [],
            };
            break;
          case 'enum':
            newClassifier = {
              id,
              name: `NewEnum${prev.eClassifiers.length + 1}`,
              eLiterals: [
                { id: genId('lit'), name: 'LITERAL1', value: 0, literal: 'LITERAL1' },
              ],
            };
            break;
          case 'dataType':
            newClassifier = {
              id,
              name: `NewDataType${prev.eClassifiers.length + 1}`,
              instanceClassName: 'java.lang.String',
              serializable: true,
            };
            break;
        }

        const newPkg = {
          ...prev,
          eClassifiers: [...prev.eClassifiers, newClassifier],
        };
        setUndoStack((u) => [...u.slice(-50), prev]);
        setRedoStack([]);
        setDirty(true);
        return newPkg;
      });
    },
    [],
  );

  const removeClassifier = useCallback((id: string) => {
    setPkg((prev) => {
      // First, filter out the classifier being removed
      const filtered = prev.eClassifiers.filter((c) => c.id !== id);
      // Then clean up references to the removed classifier
      const cleaned = filtered.map((c) => {
        if (isEClass(c)) {
          return {
            ...c,
            eReferences: c.eReferences.filter(
              (r) => r.targetId !== id,
            ),
            eSuperTypes: c.eSuperTypes.filter(
              (s) => s !== id,
            ),
          } as (typeof filtered)[number];
        }
        return c;
      });
      const newPkg = { ...prev, eClassifiers: cleaned };
      setUndoStack((u) => [...u.slice(-50), prev]);
      setRedoStack([]);
      setDirty(true);
      return newPkg;
    });
  }, []);

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((u) => u.slice(0, -1));
    setRedoStack((r) => [...r, pkg]);
    setPkg(prev);
    setDirty(true);
  }, [undoStack, pkg]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((r) => r.slice(0, -1));
    setUndoStack((u) => [...u, pkg]);
    setPkg(next);
    setDirty(true);
  }, [redoStack, pkg]);

  // ── Actualizar modelo externo ─────────────────────────────

  const updateFromExternal = useCallback((newPkg: SerializableEPackage) => {
    setPkg(newPkg);
    setUndoStack([]);
    setRedoStack([]);
    setDirty(false);
  }, []);

  return {
    // Estado
    pkg,
    nodes,
    edges,
    selectedId,
    selectedType,
    validation,
    saving,
    dirty,
    undoCount: undoStack.length,
    redoCount: redoStack.length,

    // Handlers React Flow
    onNodesChange,
    onEdgesChange,
    onConnect,
    onNodeClick,
    onEdgeClick,
    onPaneClick,

    // Acciones
    onClassifierChange,
    onAddAttribute,
    onAddReference,
    addClassifier,
    removeClassifier,
    undo,
    redo,
    setSaving,
    setValidation,
    updateFromExternal,
    setSelectedId,
    setSelectedType,
    onSelect,
  };
}
