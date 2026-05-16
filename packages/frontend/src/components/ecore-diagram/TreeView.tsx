/**
 * @emf-webapp/frontend — TreeView Panel
 *
 * Panel lateral izquierdo (debajo del toolbox) que muestra la estructura
 * jerárquica del EPackage como un árbol expandible.
 */
import React, { useCallback, useState, type ReactNode } from 'react';
import type {
  SerializableEPackage,
  SerializableEClass,
  SerializableEEnum,
  SerializableEDataType,
} from './types';
import { Box, List, Hash, Type, Link2, ArrowRight } from '../icons';

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
  icon: ReactNode;
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
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 8px',
          paddingLeft: `${8 + depth * 16}px`,
          cursor: 'pointer',
          borderRadius: 2,
          fontSize: 13,
          ...(isSelected
            ? { background: 'var(--primary-bg)', color: 'var(--primary)' }
            : { color: 'var(--text)' }),
        }}
        onClick={handleSelect}
        role="treeitem"
        aria-selected={isSelected}
      >
        {/* Expand/collapse icon */}
        {hasChildren ? (
          <button
            type="button"
            onClick={handleToggle}
            style={{
              flexShrink: 0,
              width: 16,
              height: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              outline: 'none',
              border: 'none',
              background: 'transparent',
              padding: 0,
              cursor: 'pointer',
            }}
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            <svg
              style={{
                width: 12,
                height: 12,
                transform: expanded ? 'rotate(90deg)' : 'none',
              }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <span style={{ flexShrink: 0, width: 16 }} />
        )}

        {/* Icon */}
        <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>{icon}</span>

        {/* Label */}
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontWeight: 500,
            fontSize: 13,
          }}
        >
          {label}
        </span>
      </div>

      {/* Children with expand animation */}
      <div
        style={{
          overflow: 'hidden',
          maxHeight: expanded ? 2000 : 0,
          opacity: expanded ? 1 : 0,
        }}
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
    icon={<Type size={14} style={{ color: '#6366f1' }} />}
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
    label={name}
    icon={containment ? <ArrowRight size={14} style={{ color: '#10b981' }} /> : <Link2 size={14} style={{ color: '#8b5cf6' }} />}
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
    icon={<Hash size={14} style={{ color: '#f59e0b' }} />}
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
      icon={<Box size={14} style={{ color: '#6366f1' }} />}
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
          style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            fontStyle: 'italic',
            padding: '4px 0',
            paddingLeft: `${8 + (depth + 1) * 16}px`,
          }}
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
    icon={<List size={14} style={{ color: '#fb923c' }} />}
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
    icon={<Hash size={14} style={{ color: '#9ca3af' }} />}
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
    <div
      style={{
        flex: 1,
        background: 'var(--surface)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '8px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h2
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text)',
            textTransform: 'uppercase',
            letterSpacing: '0.025em',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            margin: 0,
          }}
        >
          <svg
            style={{ width: 16, height: 16, color: 'var(--primary)' }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
          Model
        </h2>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {pkg.eClassifiers.length} classifier{pkg.eClassifiers.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Tree content */}
      <div
        style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}
        role="tree"
        aria-label="Model tree"
      >
        {/* Root: EPackage */}
        <TreeNode
          label={`${pkg.name}${pkg.nsURI ? ` (${pkg.nsURI})` : ''}`}
          icon={<Box size={14} style={{ color: '#6366f1' }} />}
          nodeId="__package__"
          selectedId={selectedId}
          onSelect={onSelect}
          defaultExpanded={true}
          depth={0}
        >
          {/* Summary row */}
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              fontStyle: 'italic',
              padding: '4px 8px',
              paddingLeft: `${8 + 1 * 16}px`,
            }}
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
              style={{
                fontSize: 11,
                color: 'var(--text-muted)',
                fontStyle: 'italic',
                padding: '8px 8px',
                paddingLeft: `${8 + 1 * 16}px`,
              }}
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
