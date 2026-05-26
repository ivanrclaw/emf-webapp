/**
 * @emf-webapp/frontend — Ecore Diagram Editor Types
 *
 * Types compartidos para el editor visual de metamodelos.
 * Conecta los nodos/edges de React Flow con el modelo Ecore (@emf-webapp/core).
 */

import type { Node, Edge, BuiltInNode } from '@xyflow/react';

// ================================================================
// Tipos auxiliares del modelo Ecore (versión simplificada para editor)
// ================================================================

export interface SerializableAnnotation {
  source: string;
  details: Record<string, string>;
}

export interface SerializableEAttribute {
  id: string;
  name: string;
  eType: string; // nombre del EDataType
  lowerBound: number;
  upperBound: number;
  iD: boolean;
  defaultValueLiteral: string;
  changeable: boolean;
  derived: boolean;
  transient: boolean;
  annotations?: SerializableAnnotation[];
}

export interface SerializableEReference {
  id: string;
  name: string;
  targetId: string; // ID del EClass destino
  containment: boolean;
  lowerBound: number;
  upperBound: number;
  eOpposite: string | null; // ID de la referencia opuesta
  changeable: boolean;
  derived: boolean;
  annotations?: SerializableAnnotation[];
}

export interface SerializableEClass {
  id: string;
  name: string;
  abstract: boolean;
  interface: boolean;
  eSuperTypes: string[]; // IDs de supertipos
  eAttributes: SerializableEAttribute[];
  eReferences: SerializableEReference[];
  annotations?: SerializableAnnotation[];
  position?: { x: number; y: number };
}

export interface SerializableEEnumLiteral {
  id: string;
  name: string;
  value: number;
  literal: string;
}

export interface SerializableEEnum {
  id: string;
  name: string;
  eLiterals: SerializableEEnumLiteral[];
  annotations?: SerializableAnnotation[];
  position?: { x: number; y: number };
}

export interface SerializableEDataType {
  id: string;
  name: string;
  instanceClassName: string;
  serializable: boolean;
  annotations?: SerializableAnnotation[];
  position?: { x: number; y: number };
}

export interface SerializableEPackage {
  name: string;
  nsURI: string;
  nsPrefix: string;
  eClassifiers: (SerializableEClass | SerializableEEnum | SerializableEDataType)[];
  annotations?: SerializableAnnotation[];
}

// ================================================================
// Tipos de nodos React Flow
// ================================================================

export type EcoreNodeType = 'ecoreClass' | 'ecoreEnum' | 'ecoreDataType';

export type EcoreNodeData = {
  label: string;
  type: EcoreNodeType;
  classifier: SerializableEClass | SerializableEEnum | SerializableEDataType;
  ePackage: SerializableEPackage;
  // Violaciones OCL (opcional, para validación en vivo)
  violations?: Array<{
    constraintId: string;
    constraintName: string;
    expression: string;
    severity: 'error' | 'warning' | 'info';
    passed: boolean;
    error?: string;
  }>;
  // Callbacks
  onClassifierChange: (id: string, updates: Partial<SerializableEClass | SerializableEEnum | SerializableEDataType>) => void;
  onAddAttribute: (classId: string) => void;
  onAddReference: (classId: string) => void;
  onSelect: (id: string | null, type?: string | null) => void;
};

export type AppNode = Node<EcoreNodeData, EcoreNodeType> | BuiltInNode;

// ================================================================
// Tipos de edges React Flow
// ================================================================

export type EcoreEdgeType = 'referenceEdge' | 'containmentEdge' | 'inheritanceEdge';

export interface EcoreEdgeData extends Record<string, unknown> {
  label: string;
  type: EcoreEdgeType;
  sourceId: string;
  targetId: string;
  reference?: SerializableEReference;
  onSelect?: (id: string | null) => void;
  /** Posición óptima del handle source (calculada por pkgToEdges según posición de nodos) */
  sourceHandlePos?: 'left' | 'right' | 'top' | 'bottom';
  /** Posición óptima del handle target (calculada por pkgToEdges) */
  targetHandlePos?: 'left' | 'right' | 'top' | 'bottom';
  /** Port spreading: index of this edge among siblings sharing the same (node, side) */
  sourcePortIndex?: number;
  /** Port spreading: total edges sharing the same source (node, side) */
  sourcePortTotal?: number;
  /** Port spreading: index of this edge among siblings sharing the same target (node, side) */
  targetPortIndex?: number;
  /** Port spreading: total edges sharing the same target (node, side) */
  targetPortTotal?: number;
  /** Pair index: position among edges connecting the same node pair (for mid-segment offset) */
  pairIndex?: number;
  /** Pair total: how many edges connect the same node pair */
  pairTotal?: number;
}

export type AppEdge = Edge<EcoreEdgeData>;

// ================================================================
// Estado del editor
// ================================================================

export interface EditorState {
  /** El EPackage que se está editando */
  ePackage: SerializableEPackage;
  /** ID del elemento seleccionado (nodo o edge) */
  selectedId: string | null;
  /** Tipo de elemento seleccionado */
  selectedType: 'class' | 'attribute' | 'reference' | 'enum' | 'dataType' | 'edge' | 'annotation' | null;
  /** Nodos de React Flow */
  nodes: AppNode[];
  /** Edges de React Flow */
  edges: AppEdge[];
  /** Historial para undo */
  undoStack: SerializableEPackage[];
  /** Historial para redo */
  redoStack: SerializableEPackage[];
  /** ID del proyecto y metamodelo */
  projectId: string;
  metamodelId: string;
}

// ================================================================
// Eventos del editor (para comunicación entre componentes)
// ================================================================

export type EditorEvent =
  | { type: 'NODE_SELECTED'; nodeId: string }
  | { type: 'EDGE_SELECTED'; edgeId: string }
  | { type: 'DESELECT_ALL' }
  | { type: 'CLASSIFIER_ADDED'; classifierId: string }
  | { type: 'CLASSIFIER_REMOVED'; classifierId: string }
  | { type: 'CLASSIFIER_CHANGED'; classifierId: string }
  | { type: 'FEATURE_ADDED'; classId: string; featureId: string }
  | { type: 'FEATURE_REMOVED'; classId: string; featureId: string }
  | { type: 'FEATURE_CHANGED'; classId: string; featureId: string }
  | { type: 'SAVE_REQUESTED' }
  | { type: 'UNDO' }
  | { type: 'REDO' };

// ================================================================
// Resultados de validación
// ================================================================

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  nodeId: string;
  field: string;
  message: string;
}

export interface ValidationWarning {
  nodeId: string;
  field: string;
  message: string;
}
