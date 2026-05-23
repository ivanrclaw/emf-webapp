/**
 * @emf-webapp/frontend — ObjectExplorer
 *
 * Hierarchical tree view of model objects with:
 * - Collapsible tree structure based on containment
 * - Search/filter by name, eClass, or attribute
 * - Click to select + center view on canvas
 * - Double-click for inline rename
 * - Color-coded icons from VSM mappings
 * - Context menu (delete, duplicate, move)
 * - Ctrl+F shortcut to focus search
 */
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { ChevronRight, ChevronDown, Search, Box, Layers } from '../../components/icons';
import { useObjectTree, flattenTree, type TreeNode } from './hooks/useObjectTree';
import type { NodeMapping, ContainerMapping } from '../spec-diagram/types';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SemanticObject {
  id: string;
  eClass: string;
  attributes: Record<string, unknown>;
  references: Record<string, string[]>;
}

interface EClass {
  name: string;
  abstract?: boolean;
  interface?: boolean;
  eAttributes?: { name: string; eType?: string; lowerBound?: number; upperBound?: number }[];
  eReferences?: { name: string; eType?: string; containment?: boolean; lowerBound?: number; upperBound?: number }[];
}

interface ObjectExplorerProps {
  objects: SemanticObject[];
  eclasses: EClass[];
  selectedNodeId: string | null;
  selectedNodeIds: Set<string>;
  nodeMappings: NodeMapping[];
  containerMappings: ContainerMapping[];
  onSelect: (objectId: string) => void;
  onNavigate: (objectId: string) => void;
  onRename: (objectId: string, newName: string) => void;
  onDelete: (objectId: string) => void;
  onDuplicate: (objectId: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Tree Item Component                                                */
/* ------------------------------------------------------------------ */

interface TreeItemProps {
  node: TreeNode;
  isSelected: boolean;
  isMultiSelected: boolean;
  isCollapsed: boolean;
  onToggleCollapse: (id: string) => void;
  onSelect: (id: string) => void;
  onNavigate: (id: string) => void;
  onStartRename: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
  mappingColor: string | undefined;
  isContainer: boolean;
  matchHighlight: string;
}

function TreeItem({
  node,
  isSelected,
  isMultiSelected,
  isCollapsed,
  onToggleCollapse,
  onSelect,
  onNavigate,
  onStartRename,
  onContextMenu,
  mappingColor,
  isContainer,
  matchHighlight,
}: TreeItemProps) {
  const name = (node.object.attributes.name as string) || node.object.id;
  const hasChildren = node.children.length > 0;
  const indent = node.depth * 16 + 4;

  // Highlight matching text
  const renderName = useMemo(() => {
    if (!matchHighlight) return name;
    const idx = name.toLowerCase().indexOf(matchHighlight.toLowerCase());
    if (idx === -1) return name;
    return (
      <>
        {name.slice(0, idx)}
        <span style={{ background: 'rgba(99,102,241,0.3)', borderRadius: 2, padding: '0 1px' }}>
          {name.slice(idx, idx + matchHighlight.length)}
        </span>
        {name.slice(idx + matchHighlight.length)}
      </>
    );
  }, [name, matchHighlight]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 6px 3px',
        paddingLeft: indent,
        cursor: 'pointer',
        borderRadius: 4,
        background: isSelected
          ? 'var(--color-accent-bg, rgba(99,102,241,0.15))'
          : isMultiSelected
            ? 'rgba(99,102,241,0.08)'
            : 'transparent',
        color: isSelected
          ? 'var(--color-accent, #818cf8)'
          : 'var(--text, #e4e4e7)',
        fontSize: 12,
        transition: 'background 0.1s',
        userSelect: 'none',
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(node.id);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onNavigate(node.id);
      }}
      onContextMenu={(e) => onContextMenu(e, node.id)}
      onMouseEnter={(e) => {
        if (!isSelected && !isMultiSelected) {
          e.currentTarget.style.background = 'var(--hover, rgba(255,255,255,0.04))';
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected && !isMultiSelected) {
          e.currentTarget.style.background = 'transparent';
        }
      }}
      role="treeitem"
      aria-selected={isSelected}
      aria-expanded={hasChildren ? !isCollapsed : undefined}
      aria-level={node.depth + 1}
    >
      {/* Collapse toggle */}
      <span
        style={{
          width: 14,
          height: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          opacity: hasChildren ? 0.7 : 0,
          cursor: hasChildren ? 'pointer' : 'default',
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (hasChildren) onToggleCollapse(node.id);
        }}
      >
        {hasChildren && (isCollapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />)}
      </span>

      {/* Color dot from mapping */}
      <span style={{
        width: 8,
        height: 8,
        borderRadius: isContainer ? 2 : '50%',
        background: mappingColor || 'var(--text-muted, #71717a)',
        flexShrink: 0,
        opacity: 0.8,
      }} />

      {/* Name */}
      <span style={{
        flex: 1,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontWeight: isSelected ? 600 : 400,
      }}>
        {renderName}
      </span>

      {/* eClass badge */}
      <span style={{
        fontSize: 9,
        padding: '0 4px',
        borderRadius: 3,
        background: 'var(--border, #27272a)',
        color: 'var(--text-muted, #71717a)',
        fontWeight: 500,
        flexShrink: 0,
        maxWidth: 60,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {node.object.eClass}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Inline Rename                                                      */
/* ------------------------------------------------------------------ */

function InlineRenameInput({ initialValue, onConfirm, onCancel }: {
  initialValue: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter' && value.trim()) {
          onConfirm(value.trim());
        } else if (e.key === 'Escape') {
          onCancel();
        }
      }}
      onBlur={() => {
        if (value.trim() && value.trim() !== initialValue) {
          onConfirm(value.trim());
        } else {
          onCancel();
        }
      }}
      style={{
        width: '100%',
        padding: '2px 6px',
        fontSize: 12,
        border: '1px solid var(--primary, #6366f1)',
        borderRadius: 4,
        background: 'var(--surface, #1e1e2e)',
        color: 'var(--text, #e4e4e7)',
        outline: 'none',
        fontFamily: 'inherit',
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Context Menu                                                        */
/* ------------------------------------------------------------------ */

function ExplorerContextMenu({ position, onAction, onClose }: {
  position: { x: number; y: number };
  onAction: (action: string) => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const items = [
    { id: 'rename', label: 'Rename', shortcut: 'F2' },
    { id: 'separator-1', label: '', separator: true },
    { id: 'duplicate', label: 'Duplicate', shortcut: '⌘D' },
    { id: 'separator-2', label: '', separator: true },
    { id: 'delete', label: 'Delete', shortcut: 'Del', danger: true },
  ];

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 9999,
        minWidth: 150,
        background: 'var(--surface, #1e1e2e)',
        border: '1px solid var(--border, #27272a)',
        borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        padding: '4px 0',
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item) => {
        if (item.separator) {
          return <div key={item.id} style={{ height: 1, background: 'var(--border, #27272a)', margin: '4px 8px' }} />;
        }
        return (
          <button
            key={item.id}
            onClick={() => { onAction(item.id); onClose(); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              padding: '6px 12px',
              border: 'none',
              background: 'transparent',
              color: item.danger ? '#ef4444' : 'var(--text, #e4e4e7)',
              fontSize: 12,
              cursor: 'pointer',
              textAlign: 'left',
              gap: 8,
              fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hover, rgba(255,255,255,0.05))'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.shortcut && (
              <span style={{ fontSize: 10, color: 'var(--text-muted, #71717a)', fontFamily: 'monospace' }}>
                {item.shortcut}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export function ObjectExplorer({
  objects,
  eclasses,
  selectedNodeId,
  selectedNodeIds,
  nodeMappings,
  containerMappings,
  onSelect,
  onNavigate,
  onRename,
  onDelete,
  onDuplicate,
}: ObjectExplorerProps) {
  const [filter, setFilter] = useState('');
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ id: string; position: { x: number; y: number } } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Build tree
  const tree = useObjectTree(objects, eclasses);

  // Flatten for rendering
  const flatNodes = useMemo(() => flattenTree(tree, collapsedIds), [tree, collapsedIds]);

  // Filter
  const filteredNodes = useMemo(() => {
    if (!filter) return flatNodes;
    const lower = filter.toLowerCase();
    return flatNodes.filter((node) => {
      const name = (node.object.attributes.name as string) || '';
      const eClass = node.object.eClass;
      // Also search in attribute values
      const attrMatch = Object.values(node.object.attributes).some(
        (v) => typeof v === 'string' && v.toLowerCase().includes(lower),
      );
      return name.toLowerCase().includes(lower)
        || eClass.toLowerCase().includes(lower)
        || attrMatch;
    });
  }, [flatNodes, filter]);

  // Mapping color lookup
  const getMappingColor = useCallback((eClass: string): string | undefined => {
    const nodeMapping = nodeMappings.find((m) => m.domainClass === eClass);
    if (nodeMapping) return nodeMapping.defaultStyle?.color;
    const containerMapping = containerMappings.find((m) => m.domainClass === eClass);
    if (containerMapping) return containerMapping.defaultStyle?.color;
    return undefined;
  }, [nodeMappings, containerMappings]);

  const isContainer = useCallback((eClass: string): boolean => {
    return containerMappings.some((m) => m.domainClass === eClass);
  }, [containerMappings]);

  // Handlers
  const handleToggleCollapse = useCallback((id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect(id);
    setContextMenu({ id, position: { x: e.clientX, y: e.clientY } });
  }, [onSelect]);

  const handleContextAction = useCallback((action: string) => {
    if (!contextMenu) return;
    switch (action) {
      case 'rename':
        setRenamingId(contextMenu.id);
        break;
      case 'delete':
        onDelete(contextMenu.id);
        break;
      case 'duplicate':
        onDuplicate(contextMenu.id);
        break;
    }
  }, [contextMenu, onDelete, onDuplicate]);

  const handleConfirmRename = useCallback((value: string) => {
    if (renamingId) {
      onRename(renamingId, value);
    }
    setRenamingId(null);
  }, [renamingId, onRename]);

  // Ctrl+F to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        // Only capture if explorer is visible
        const el = searchRef.current;
        if (el && el.offsetParent !== null) {
          e.preventDefault();
          el.focus();
          el.select();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      fontSize: 12,
    }}>
      {/* Header */}
      <div style={{
        padding: '8px 10px 6px',
        borderBottom: '1px solid var(--border, #27272a)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}>
        <Layers size={13} style={{ opacity: 0.6 }} />
        <span style={{ fontWeight: 600, fontSize: 11, color: 'var(--text-secondary, #a1a1aa)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
          Explorer
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted, #71717a)' }}>
          {objects.length}
        </span>
      </div>

      {/* Search */}
      <div style={{
        padding: '6px 8px',
        borderBottom: '1px solid var(--border, #27272a)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '3px 8px',
          background: 'var(--bg, #0f0f14)',
          border: '1px solid var(--border, #27272a)',
          borderRadius: 5,
        }}>
          <Search size={12} style={{ opacity: 0.5, flexShrink: 0 }} />
          <input
            ref={searchRef}
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search objects... (Ctrl+F)"
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              color: 'var(--text, #e4e4e7)',
              fontSize: 11,
              outline: 'none',
              padding: '2px 0',
              fontFamily: 'inherit',
            }}
          />
          {filter && (
            <button
              onClick={() => setFilter('')}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--text-muted, #71717a)',
                cursor: 'pointer',
                fontSize: 12,
                padding: 0,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          )}
        </div>
        {filter && (
          <div style={{ fontSize: 10, color: 'var(--text-muted, #71717a)', marginTop: 3, paddingLeft: 4 }}>
            {filteredNodes.length} result{filteredNodes.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Tree */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '4px 4px',
        }}
        role="tree"
        aria-label="Object explorer tree"
      >
        {filteredNodes.length === 0 ? (
          <div style={{
            padding: '20px 12px',
            textAlign: 'center',
            color: 'var(--text-muted, #71717a)',
            fontSize: 11,
          }}>
            {objects.length === 0
              ? 'No objects in model. Use the palette to create elements.'
              : 'No matches found.'}
          </div>
        ) : (
          filteredNodes.map((node) => (
            renamingId === node.id ? (
              <div key={node.id} style={{ padding: '2px 6px', paddingLeft: node.depth * 16 + 22 }}>
                <InlineRenameInput
                  initialValue={(node.object.attributes.name as string) || ''}
                  onConfirm={handleConfirmRename}
                  onCancel={() => setRenamingId(null)}
                />
              </div>
            ) : (
              <TreeItem
                key={node.id}
                node={node}
                isSelected={selectedNodeId === node.id}
                isMultiSelected={selectedNodeIds.has(node.id)}
                isCollapsed={collapsedIds.has(node.id)}
                onToggleCollapse={handleToggleCollapse}
                onSelect={onSelect}
                onNavigate={onNavigate}
                onStartRename={setRenamingId}
                onContextMenu={handleContextMenu}
                mappingColor={getMappingColor(node.object.eClass)}
                isContainer={isContainer(node.object.eClass)}
                matchHighlight={filter}
              />
            )
          ))
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ExplorerContextMenu
          position={contextMenu.position}
          onAction={handleContextAction}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
