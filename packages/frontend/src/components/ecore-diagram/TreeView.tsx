/**
 * @emf-webapp/frontend — TreeView Panel
 *
 * Panel lateral izquierdo (debajo del toolbox) que muestra la estructura
 * jerárquica del EPackage como un árbol expandible.
 */
import React, { useCallback, useState } from 'react';
import type {
  SerializableEPackage,
  SerializableEClass,
  SerializableEEnum,
  SerializableEDataType,
} from './types';

// ── Helpers ─────────────────────────────────────────────────────

function isEClass(c: SerializableEClass | SerializableEEnum | SerializableEDataType): c is SerializableEClass {
  return 'eAttributes' in c && 'eReferences' in c;
}

function isEEnum(c: SerializableEClass | SerializableEEnum | SerializableEDataType): c is SerializableEEnum {
  return 'eLiterals' in c;
}

function isEDataType(c: SerializableEClass | SerializableEEnum | SerializableEDataType): c is SerializableEDataType {
  return !isEClass(c) && !isEEnum(c);
}

// ── Types ───────────────────────────────────────────────────────

export interface TreeViewProps {
  /** El EPackage a mostrar */
  pkg: SerializableEPackage;
  /** Callback al seleccionar un elemento */
  onSelect: (id: string | null) => void;
  /** ID del elemento actualmente seleccionado */
  selectedId: string | null;
}

// ── TreeNode ────────────────────────────────────────────────────

interface TreeNodeProps {
  label: string;
  icon: string;
  nodeId: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  children?: React.ReactNode;
  defaultExpanded?: boolean;
  depth?: number;
}

const TreeNode: React.FC<TreeNodeProps> = ({
  label,
  icon,
  nodeId,
  selectedId,
  onSelect,
  children,
  defaultExpanded = false,
  depth = 0,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const hasChildren = React.Children.count(children) > 0;
  const isSelected = selectedId === nodeId;

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setExpanded((prev) => !prev);
    },
    [],
  );

  const handleSelect = useCallback(() => {
    onSelect(nodeId);
  }, [nodeId, onSelect]);

  return (
    <div>
      <div
        className={`
          flex items-center gap-1.5 px-2 py-1 cursor-pointer rounded-sm text-sm
          transition-colors duration-100
          ${isSelected ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-100 text-gray-700'}
        `}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={handleSelect}
        role="treeitem"
        aria-selected={isSelected}
      >
        {/* Expand/collapse icon */}
        {hasChildren ? (
          <button
            type="button"
            onClick={handleToggle}
            className="flex-shrink-0 w-4 h-4 flex items-center justify-center
                       text-gray-400 hover:text-gray-600 transition-transform duration-150
                       focus:outline-none"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            <svg
              className={`w-3 h-3 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <span className="flex-shrink-0 w-4" />
        )}

        {/* Icon */}
        <span className="flex-shrink-0 text-sm">{icon}</span>

        {/* Label */}
        <span className="truncate font-medium text-sm">{label}</span>
      </div>

      {/* Children with expand animation */}
      <div
        className={`overflow-hidden transition-all duration-200 ease-in-out ${
          expanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        {children}
      </div>
    </div>
  );
};

// ── Feature Nodes ───────────────────────────────────────────────

const AttributeNode: React.FC<{
  attrId: string;
  name: string;
  eType: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  depth: number;
}> = ({ attrId, name, eType, selectedId, onSelect, depth }) => (
  <TreeNode
    label={`${name} : ${eType}`}
    icon="🏷️"
    nodeId={attrId}
    selectedId={selectedId}
    onSelect={onSelect}
    depth={depth}
  />
);

const ReferenceNode: React.FC<{
  refId: string;
  name: string;
  containment: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  depth: number;
}> = ({ refId, name, containment, selectedId, onSelect, depth }) => (
  <TreeNode
    label={`${name} ${containment ? '🔄' : '🔗'}`}
    icon="🔗"
    nodeId={refId}
    selectedId={selectedId}
    onSelect={onSelect}
    depth={depth}
  />
);

const EnumLiteralNode: React.FC<{
  litId: string;
  name: string;
  value: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  depth: number;
}> = ({ litId, name, value, selectedId, onSelect, depth }) => (
  <TreeNode
    label={`${name} = ${value}`}
    icon="📌"
    nodeId={litId}
    selectedId={selectedId}
    onSelect={onSelect}
    depth={depth}
  />
);

// ── Classifier Nodes ────────────────────────────────────────────

const EClassTreeNode: React.FC<{
  cls: SerializableEClass;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  depth: number;
}> = ({ cls, selectedId, onSelect, depth }) => {
  const allChildren = [
    ...cls.eAttributes.map((a) => (
      <AttributeNode
        key={a.id}
        attrId={a.id}
        name={a.name}
        eType={a.eType}
        selectedId={selectedId}
        onSelect={onSelect}
        depth={depth + 1}
      />
    )),
    ...cls.eReferences.map((r) => (
      <ReferenceNode
        key={r.id}
        refId={r.id}
        name={r.name}
        containment={r.containment}
        selectedId={selectedId}
        onSelect={onSelect}
        depth={depth + 1}
      />
    )),
  ];

  return (
    <TreeNode
      label={`${cls.name}${cls.abstract ? ' (abstract)' : ''}${cls.interface ? ' (interface)' : ''}`}
      icon="📦"
      nodeId={cls.id}
      selectedId={selectedId}
      onSelect={onSelect}
      defaultExpanded={false}
      depth={depth}
    >
      {allChildren.length > 0 ? (
        allChildren
      ) : (
        <div
          className="text-xs text-gray-400 italic pl-10 py-1"
          style={{ paddingLeft: `${8 + (depth + 1) * 16}px` }}
        >
          No features
        </div>
      )}
    </TreeNode>
  );
};

const EEnumTreeNode: React.FC<{
  enm: SerializableEEnum;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  depth: number;
}> = ({ enm, selectedId, onSelect, depth }) => (
  <TreeNode
    label={enm.name}
    icon="📋"
    nodeId={enm.id}
    selectedId={selectedId}
    onSelect={onSelect}
    defaultExpanded={false}
    depth={depth}
  >
    {enm.eLiterals.map((lit) => (
      <EnumLiteralNode
        key={lit.id}
        litId={lit.id}
        name={lit.name}
        value={lit.value}
        selectedId={selectedId}
        onSelect={onSelect}
        depth={depth + 1}
      />
    ))}
  </TreeNode>
);

const EDataTypeTreeNode: React.FC<{
  dt: SerializableEDataType;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  depth: number;
}> = ({ dt, selectedId, onSelect, depth }) => (
  <TreeNode
    label={`${dt.name}${dt.instanceClassName ? ` : ${dt.instanceClassName}` : ''}`}
    icon="🔤"
    nodeId={dt.id}
    selectedId={selectedId}
    onSelect={onSelect}
    depth={depth}
  />
);

// ── Main Component ──────────────────────────────────────────────

export const TreeView: React.FC<TreeViewProps> = ({ pkg, onSelect, selectedId }) => {
  // Contar classifiers por tipo
  const classCount = pkg.eClassifiers.filter(isEClass).length;
  const enumCount = pkg.eClassifiers.filter(isEEnum).length;
  const dataTypeCount = pkg.eClassifiers.filter(isEDataType).length;

  return (
    <div className="flex-1 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
          <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
          Model
        </h2>
        <span className="text-xs text-gray-400">
          {pkg.eClassifiers.length} classifier{pkg.eClassifiers.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Tree content */}
      <div className="flex-1 overflow-y-auto py-1" role="tree" aria-label="Model tree">
        {/* Root: EPackage */}
        <TreeNode
          label={`${pkg.name}${pkg.nsURI ? ` (${pkg.nsURI})` : ''}`}
          icon="📦"
          nodeId="__package__"
          selectedId={selectedId}
          onSelect={onSelect}
          defaultExpanded={true}
          depth={0}
        >
          {/* Summary row */}
          <div
            className="text-xs text-gray-400 italic px-2 py-1"
            style={{ paddingLeft: `${8 + 1 * 16}px` }}
          >
            {classCount} class{classCount !== 1 ? 'es' : ''}, {enumCount} enum{enumCount !== 1 ? 's' : ''},{' '}
            {dataTypeCount} data type{dataTypeCount !== 1 ? 's' : ''}
          </div>

          {/* Classifiers */}
          {pkg.eClassifiers.map((cls) => {
            if (isEClass(cls)) {
              return (
                <EClassTreeNode
                  key={cls.id}
                  cls={cls}
                  selectedId={selectedId}
                  onSelect={onSelect}
                  depth={1}
                />
              );
            }
            if (isEEnum(cls)) {
              return (
                <EEnumTreeNode
                  key={cls.id}
                  enm={cls}
                  selectedId={selectedId}
                  onSelect={onSelect}
                  depth={1}
                />
              );
            }
            return (
              <EDataTypeTreeNode
                key={cls.id}
                dt={cls}
                selectedId={selectedId}
                onSelect={onSelect}
                depth={1}
              />
            );
          })}

          {/* Empty state */}
          {pkg.eClassifiers.length === 0 && (
            <div
              className="text-xs text-gray-400 italic px-2 py-2"
              style={{ paddingLeft: `${8 + 1 * 16}px` }}
            >
              No classifiers yet. Use the toolbox to add one.
            </div>
          )}
        </TreeNode>
      </div>
    </div>
  );
};

export default TreeView;
