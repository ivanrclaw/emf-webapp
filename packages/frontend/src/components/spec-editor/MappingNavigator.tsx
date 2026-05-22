/**
 * MappingNavigator — Hierarchical tree browser for ViewpointSpec mappings.
 *
 * Sections:
 *  📦 Node Mappings
 *  📦 Container Mappings
 *  🔗 Edge Mappings
 *  🛠️ Tool Sections
 *  🎨 Layers
 */
import React, { useState, useMemo } from 'react';
import type {
  Layer,
  NodeMapping,
  ContainerMapping,
  EdgeMapping,
  ToolSection,
} from '../spec-diagram/types';
import {
  Box,
  Link2,
  Plus,
  Trash2,
  Copy,
  ChevronDown,
  ChevronRight,
  Layers,
  Wrench,
} from '../icons';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SelectionType = 'node' | 'container' | 'edge' | 'tool-section' | 'layer';

export interface MappingSelection {
  type: SelectionType;
  id: string;
}

interface EClassInfo {
  name: string;
  abstract?: boolean;
  interface?: boolean;
  eReferences?: { name: string; eType?: string; containment?: boolean }[];
}

export interface MappingNavigatorProps {
  layer: Layer;
  allLayers: Layer[];
  activeLayerId: string;
  eclasses: EClassInfo[];
  selection: MappingSelection | null;
  onSelect: (sel: MappingSelection | null) => void;
  onAddNodeMapping: (className: string) => void;
  onAddContainerMapping: (className: string) => void;
  onAddEdgeMapping: (sourceClass: string, refName: string, targetClass: string) => void;
  onDeleteMapping: (type: SelectionType, id: string) => void;
  onDuplicateMapping: (type: SelectionType, id: string) => void;
  onSelectLayer: (layerId: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MappingNavigator({
  layer,
  allLayers,
  activeLayerId,
  eclasses,
  selection,
  onSelect,
  onAddNodeMapping,
  onAddContainerMapping,
  onAddEdgeMapping,
  onDeleteMapping,
  onDuplicateMapping,
  onSelectLayer,
}: MappingNavigatorProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['nodes', 'containers', 'edges', 'tools', 'layers'])
  );
  const [addMenuOpen, setAddMenuOpen] = useState<string | null>(null);

  // Classes not yet mapped as nodes
  const unmappedNodeClasses = useMemo(() => {
    const mapped = new Set([
      ...layer.nodeMappings.map((m) => m.domainClass),
      ...layer.containerMappings.map((m) => m.domainClass),
    ]);
    return eclasses.filter((ec) => !ec.abstract && !ec.interface && !mapped.has(ec.name));
  }, [eclasses, layer.nodeMappings, layer.containerMappings]);

  // References not yet mapped as edges
  const unmappedEdgeRefs = useMemo(() => {
    const mappedKeys = new Set(
      layer.edgeMappings.map((em) => `${em.sourceMappingIds.join(',')}_${em.sourceReference || em.domainClass}`)
    );
    const refs: { sourceClass: string; refName: string; targetClass: string; key: string }[] = [];
    for (const ec of eclasses) {
      for (const ref of ec.eReferences || []) {
        const key = `${ec.name}.${ref.name}.${ref.eType || 'EObject'}`;
        // Simple check: if no edge mapping references this ref name from this class
        const alreadyMapped = layer.edgeMappings.some(
          (em) => em.sourceReference === ref.name
        );
        if (!alreadyMapped) {
          refs.push({ sourceClass: ec.name, refName: ref.name, targetClass: ref.eType || 'EObject', key });
        }
      }
    }
    return refs;
  }, [eclasses, layer.edgeMappings]);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const isSelected = (type: SelectionType, id: string) =>
    selection?.type === type && selection?.id === id;

  return (
    <div style={styles.container}>
      {/* ─── Node Mappings ─────────────────────────────────────────── */}
      <SectionHeader
        label="Node Mappings"
        icon={<Box size={12} />}
        count={layer.nodeMappings.length}
        expanded={expandedSections.has('nodes')}
        onToggle={() => toggleSection('nodes')}
        onAdd={unmappedNodeClasses.length > 0 ? () => setAddMenuOpen(addMenuOpen === 'nodes' ? null : 'nodes') : undefined}
      />
      {expandedSections.has('nodes') && (
        <div style={styles.sectionBody}>
          {layer.nodeMappings.map((nm) => (
            <MappingItem
              key={nm.id}
              label={nm.domainClass}
              sublabel={nm.defaultStyle.shape}
              color={nm.defaultStyle.color}
              selected={isSelected('node', nm.id)}
              onClick={() => onSelect({ type: 'node', id: nm.id })}
              onDelete={() => onDeleteMapping('node', nm.id)}
              onDuplicate={() => onDuplicateMapping('node', nm.id)}
            />
          ))}
          {layer.nodeMappings.length === 0 && (
            <EmptyHint text="No node mappings" />
          )}
          {addMenuOpen === 'nodes' && (
            <AddMenu
              items={unmappedNodeClasses.map((ec) => ({ label: ec.name, value: ec.name }))}
              onSelect={(name) => { onAddNodeMapping(name); setAddMenuOpen(null); }}
              onClose={() => setAddMenuOpen(null)}
              placeholder="Add node mapping..."
            />
          )}
        </div>
      )}

      {/* ─── Container Mappings ────────────────────────────────────── */}
      <SectionHeader
        label="Container Mappings"
        icon={<Box size={12} />}
        count={layer.containerMappings.length}
        expanded={expandedSections.has('containers')}
        onToggle={() => toggleSection('containers')}
        onAdd={unmappedNodeClasses.length > 0 ? () => setAddMenuOpen(addMenuOpen === 'containers' ? null : 'containers') : undefined}
      />
      {expandedSections.has('containers') && (
        <div style={styles.sectionBody}>
          {layer.containerMappings.map((cm) => (
            <MappingItem
              key={cm.id}
              label={cm.domainClass}
              sublabel={`${cm.childrenPresentation} · ${cm.subNodeMappingIds.length} children`}
              color={cm.defaultStyle.color}
              selected={isSelected('container', cm.id)}
              onClick={() => onSelect({ type: 'container', id: cm.id })}
              onDelete={() => onDeleteMapping('container', cm.id)}
              onDuplicate={() => onDuplicateMapping('container', cm.id)}
            />
          ))}
          {layer.containerMappings.length === 0 && (
            <EmptyHint text="No container mappings" />
          )}
          {addMenuOpen === 'containers' && (
            <AddMenu
              items={unmappedNodeClasses.map((ec) => ({ label: ec.name, value: ec.name }))}
              onSelect={(name) => { onAddContainerMapping(name); setAddMenuOpen(null); }}
              onClose={() => setAddMenuOpen(null)}
              placeholder="Add container mapping..."
            />
          )}
        </div>
      )}

      {/* ─── Edge Mappings ─────────────────────────────────────────── */}
      <SectionHeader
        label="Edge Mappings"
        icon={<Link2 size={12} />}
        count={layer.edgeMappings.length}
        expanded={expandedSections.has('edges')}
        onToggle={() => toggleSection('edges')}
        onAdd={unmappedEdgeRefs.length > 0 ? () => setAddMenuOpen(addMenuOpen === 'edges' ? null : 'edges') : undefined}
      />
      {expandedSections.has('edges') && (
        <div style={styles.sectionBody}>
          {layer.edgeMappings.map((em) => (
            <MappingItem
              key={em.id}
              label={em.sourceReference || em.domainClass || em.id}
              sublabel={`${em.type} · ${em.defaultStyle.routingStyle}`}
              color={em.defaultStyle.color}
              selected={isSelected('edge', em.id)}
              onClick={() => onSelect({ type: 'edge', id: em.id })}
              onDelete={() => onDeleteMapping('edge', em.id)}
              onDuplicate={() => onDuplicateMapping('edge', em.id)}
              isEdge
            />
          ))}
          {layer.edgeMappings.length === 0 && (
            <EmptyHint text="No edge mappings" />
          )}
          {addMenuOpen === 'edges' && (
            <AddMenu
              items={unmappedEdgeRefs.map((r) => ({
                label: `${r.sourceClass}.${r.refName} → ${r.targetClass}`,
                value: r.key,
              }))}
              onSelect={(key) => {
                const parts = key.split('.');
                if (parts.length >= 3) {
                  onAddEdgeMapping(parts[0], parts[1], parts.slice(2).join('.'));
                }
                setAddMenuOpen(null);
              }}
              onClose={() => setAddMenuOpen(null)}
              placeholder="Add edge mapping..."
            />
          )}
        </div>
      )}

      {/* ─── Tool Sections ─────────────────────────────────────────── */}
      <SectionHeader
        label="Tool Sections"
        icon={<Wrench size={12} />}
        count={layer.toolSections.length}
        expanded={expandedSections.has('tools')}
        onToggle={() => toggleSection('tools')}
      />
      {expandedSections.has('tools') && (
        <div style={styles.sectionBody}>
          {layer.toolSections.map((ts) => (
            <div
              key={ts.id}
              style={{
                ...styles.item,
                ...(isSelected('tool-section', ts.id) ? styles.itemSelected : {}),
              }}
              onClick={() => onSelect({ type: 'tool-section', id: ts.id })}
            >
              <Wrench size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <span style={styles.itemLabel}>{ts.label}</span>
              <span style={styles.badge}>{ts.tools.length} tools</span>
            </div>
          ))}
          {layer.toolSections.length === 0 && (
            <EmptyHint text="No tool sections" />
          )}
        </div>
      )}

      {/* ─── Layers ────────────────────────────────────────────────── */}
      <SectionHeader
        label="Layers"
        icon={<Layers size={12} />}
        count={allLayers.length}
        expanded={expandedSections.has('layers')}
        onToggle={() => toggleSection('layers')}
      />
      {expandedSections.has('layers') && (
        <div style={styles.sectionBody}>
          {allLayers.map((l) => (
            <div
              key={l.id}
              style={{
                ...styles.item,
                ...(l.id === activeLayerId ? styles.itemActive : {}),
                ...(isSelected('layer', l.id) ? styles.itemSelected : {}),
              }}
              onClick={() => {
                onSelectLayer(l.id);
                onSelect({ type: 'layer', id: l.id });
              }}
            >
              <Layers size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <span style={styles.itemLabel}>{l.name}</span>
              {l.isDefault && <span style={styles.badgeDefault}>Default</span>}
              {!l.activeByDefault && <span style={styles.badgeHidden}>Hidden</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({
  label,
  icon,
  count,
  expanded,
  onToggle,
  onAdd,
}: {
  label: string;
  icon: React.ReactNode;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  onAdd?: () => void;
}) {
  return (
    <div style={styles.sectionHeader}>
      <button onClick={onToggle} style={styles.sectionToggle}>
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {icon}
        <span style={styles.sectionLabel}>{label}</span>
        <span style={styles.sectionCount}>{count}</span>
      </button>
      {onAdd && (
        <button onClick={onAdd} style={styles.addBtn} title={`Add ${label.toLowerCase()}`}>
          <Plus size={12} />
        </button>
      )}
    </div>
  );
}

function MappingItem({
  label,
  sublabel,
  color,
  selected,
  onClick,
  onDelete,
  onDuplicate,
  isEdge,
}: {
  label: string;
  sublabel: string;
  color: string;
  selected: boolean;
  onClick: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  isEdge?: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        ...styles.item,
        ...(selected ? styles.itemSelected : {}),
        ...(hovered && !selected ? styles.itemHover : {}),
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Color indicator */}
      <span
        style={{
          width: isEdge ? 16 : 10,
          height: isEdge ? 3 : 10,
          borderRadius: isEdge ? '1px' : '2px',
          background: color,
          flexShrink: 0,
        }}
      />
      {/* Label */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={styles.itemLabel}>{label}</div>
        <div style={styles.itemSublabel}>{sublabel}</div>
      </div>
      {/* Actions (visible on hover/selected) */}
      {(hovered || selected) && (
        <div style={styles.itemActions}>
          <button
            onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
            style={styles.itemActionBtn}
            title="Duplicate"
          >
            <Copy size={11} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            style={{ ...styles.itemActionBtn, color: 'var(--error, #ef4444)' }}
            title="Delete"
          >
            <Trash2 size={11} />
          </button>
        </div>
      )}
    </div>
  );
}

function AddMenu({
  items,
  onSelect,
  onClose,
  placeholder,
}: {
  items: { label: string; value: string }[];
  onSelect: (value: string) => void;
  onClose: () => void;
  placeholder: string;
}) {
  const [filter, setFilter] = useState('');
  const filtered = items.filter((i) =>
    i.label.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <>
      {/* Backdrop */}
      <div style={styles.menuBackdrop} onClick={onClose} />
      <div style={styles.menu}>
        <input
          autoFocus
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={placeholder}
          style={styles.menuInput}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'Enter' && filtered.length === 1) onSelect(filtered[0].value);
          }}
        />
        <div style={styles.menuList}>
          {filtered.map((item) => (
            <button
              key={item.value}
              onClick={() => onSelect(item.value)}
              style={styles.menuItem}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover, rgba(255,255,255,0.05))')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {item.label}
            </button>
          ))}
          {filtered.length === 0 && (
            <div style={styles.menuEmpty}>No matches</div>
          )}
        </div>
      </div>
    </>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div style={styles.emptyHint}>{text}</div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflowY: 'auto',
    fontSize: '12px',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    borderBottom: '1px solid var(--border)',
    background: 'var(--surface)',
  },
  sectionToggle: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    flex: 1,
    padding: '6px 8px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    textAlign: 'left',
  },
  sectionLabel: { flex: 1 },
  sectionCount: {
    fontSize: '10px',
    color: 'var(--text-muted)',
    fontWeight: 400,
  },
  sectionBody: {
    padding: '2px 0',
  },
  addBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    height: '24px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    color: 'var(--primary)',
    borderRadius: '3px',
    marginRight: '4px',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '5px 10px 5px 16px',
    cursor: 'pointer',
    transition: 'background 0.1s',
    minHeight: '32px',
  },
  itemSelected: {
    background: 'var(--primary-bg, rgba(99, 102, 241, 0.12))',
    borderLeft: '3px solid var(--primary)',
    paddingLeft: '13px',
  },
  itemHover: {
    background: 'var(--bg-hover, rgba(255, 255, 255, 0.03))',
  },
  itemActive: {
    fontWeight: 600,
  },
  itemLabel: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: 'var(--text)',
    fontSize: '12px',
    lineHeight: '16px',
  },
  itemSublabel: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: 'var(--text-muted)',
    fontSize: '10px',
    lineHeight: '14px',
  },
  itemActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    flexShrink: 0,
  },
  itemActionBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '20px',
    height: '20px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    color: 'var(--text-muted)',
    borderRadius: '3px',
    padding: 0,
  },
  badge: {
    fontSize: '10px',
    color: 'var(--text-muted)',
    flexShrink: 0,
  },
  badgeDefault: {
    fontSize: '9px',
    fontWeight: 600,
    padding: '1px 4px',
    borderRadius: '3px',
    background: 'var(--primary-bg, rgba(99, 102, 241, 0.15))',
    color: 'var(--primary)',
  },
  badgeHidden: {
    fontSize: '9px',
    fontWeight: 600,
    padding: '1px 4px',
    borderRadius: '3px',
    background: 'rgba(239, 68, 68, 0.1)',
    color: 'var(--error, #ef4444)',
  },
  emptyHint: {
    padding: '8px 16px',
    fontSize: '11px',
    color: 'var(--text-muted)',
    fontStyle: 'italic',
  },
  // Add menu
  menuBackdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 99,
  },
  menu: {
    position: 'relative',
    margin: '4px 8px',
    background: 'var(--surface-elevated, var(--surface))',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
    zIndex: 100,
    overflow: 'hidden',
  },
  menuInput: {
    width: '100%',
    padding: '8px 10px',
    border: 'none',
    borderBottom: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text)',
    fontSize: '12px',
    outline: 'none',
  },
  menuList: {
    maxHeight: '180px',
    overflowY: 'auto',
  },
  menuItem: {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '6px 10px',
    border: 'none',
    background: 'transparent',
    color: 'var(--text)',
    fontSize: '11px',
    cursor: 'pointer',
  },
  menuEmpty: {
    padding: '8px 10px',
    fontSize: '11px',
    color: 'var(--text-muted)',
    textAlign: 'center',
  },
};

export default MappingNavigator;
