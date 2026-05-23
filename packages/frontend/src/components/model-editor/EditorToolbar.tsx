/**
 * EditorToolbar — Professional toolbar for the Model Editor.
 *
 * Sections:
 * - Breadcrumb navigation (Project > Metamodel > Model)
 * - Edit actions (Undo, Redo, Delete, Duplicate)
 * - View controls (Zoom In/Out, Fit, Grid, Minimap)
 * - Layer toggles
 * - Save & Export
 */
import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronRight,
  Save,
  Undo2,
  Redo2,
  Trash2,
  Copy,
  Download,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Grid3X3,
  Layers,
  Eye,
  EyeOff,
  MoreHorizontal,
} from '../icons';
import type { Layer } from '../spec-diagram/types';

// ─── Props ───────────────────────────────────────────────────────────────────

export interface EditorToolbarProps {
  // Breadcrumb
  projectId: string;
  metamodelId: string;
  modelName: string;

  // History
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;

  // Edit
  hasSelection: boolean;
  onDelete: () => void;
  onDuplicate: () => void;
  onSelectAll: () => void;

  // View
  zoomLevel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  showMinimap: boolean;
  onToggleMinimap: () => void;

  // Layers
  layers: Layer[];
  activeLayers: Set<string>;
  onToggleLayer: (layerId: string) => void;

  // Save & Export
  saving: boolean;
  saveStatus: 'saved' | 'unsaved' | '';
  onSave: () => void;
  onExport: (format: 'json' | 'xmi' | 'svg' | 'png') => void;
  onImport?: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function EditorToolbar({
  projectId,
  metamodelId,
  modelName,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  hasSelection,
  onDelete,
  onDuplicate,
  onSelectAll,
  zoomLevel,
  onZoomIn,
  onZoomOut,
  onFitView,
  showGrid,
  onToggleGrid,
  showMinimap,
  onToggleMinimap,
  layers,
  activeLayers,
  onToggleLayer,
  saving,
  saveStatus,
  onSave,
  onExport,
  onImport,
}: EditorToolbarProps) {
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  // Close export dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    }
    if (exportOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [exportOpen]);

  const additionalLayers = layers.filter((l) => !l.isDefault);

  return (
    <div style={styles.toolbar}>
      {/* ─── Breadcrumb ─────────────────────────────────────────── */}
      <div style={styles.breadcrumb}>
        <Link to={`/projects/${projectId}/metamodels/${metamodelId}/models`} style={styles.breadcrumbLink}>
          Models
        </Link>
        <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />
        <span style={styles.breadcrumbCurrent}>{modelName}</span>
      </div>

      <Separator />

      {/* ─── Edit Actions ───────────────────────────────────────── */}
      <div style={styles.group}>
        <ToolbarButton
          icon={<Undo2 size={14} />}
          title="Undo (Ctrl+Z)"
          onClick={onUndo}
          disabled={!canUndo}
        />
        <ToolbarButton
          icon={<Redo2 size={14} />}
          title="Redo (Ctrl+Shift+Z)"
          onClick={onRedo}
          disabled={!canRedo}
        />
        <ToolbarButton
          icon={<Trash2 size={14} />}
          title="Delete (Del)"
          onClick={onDelete}
          disabled={!hasSelection}
        />
        <ToolbarButton
          icon={<Copy size={14} />}
          title="Duplicate (Ctrl+D)"
          onClick={onDuplicate}
          disabled={!hasSelection}
        />
      </div>

      <Separator />

      {/* ─── View Controls ──────────────────────────────────────── */}
      <div style={styles.group}>
        <ToolbarButton icon={<ZoomOut size={14} />} title="Zoom Out" onClick={onZoomOut} />
        <span style={styles.zoomLabel}>{Math.round(zoomLevel * 100)}%</span>
        <ToolbarButton icon={<ZoomIn size={14} />} title="Zoom In" onClick={onZoomIn} />
        <ToolbarButton icon={<Maximize2 size={14} />} title="Fit View" onClick={onFitView} />
        <ToolbarButton
          icon={<Grid3X3 size={14} />}
          title="Toggle Grid"
          onClick={onToggleGrid}
          active={showGrid}
        />
      </div>

      <Separator />

      {/* ─── Layers ─────────────────────────────────────────────── */}
      {additionalLayers.length > 0 && (
        <>
          <div style={styles.group}>
            <Layers size={13} style={{ color: 'var(--text-muted)' }} />
            {additionalLayers.map((layer) => {
              const isActive = activeLayers.has(layer.id);
              return (
                <button
                  key={layer.id}
                  onClick={() => onToggleLayer(layer.id)}
                  title={`${isActive ? 'Hide' : 'Show'} ${layer.name}`}
                  style={{
                    ...styles.layerChip,
                    background: isActive ? 'var(--primary)' : 'transparent',
                    color: isActive ? '#fff' : 'var(--text-muted)',
                    borderColor: isActive ? 'var(--primary)' : 'var(--border)',
                  }}
                >
                  {isActive ? <Eye size={10} /> : <EyeOff size={10} />}
                  <span>{layer.name}</span>
                </button>
              );
            })}
          </div>
          <Separator />
        </>
      )}

      {/* ─── Spacer ─────────────────────────────────────────────── */}
      <div style={{ flex: 1 }} />

      {/* ─── Save Status ────────────────────────────────────────── */}
      {saveStatus === 'saved' && (
        <span style={{ ...styles.statusBadge, color: 'var(--success)' }}>Saved</span>
      )}
      {saveStatus === 'unsaved' && (
        <span style={{ ...styles.statusBadge, color: 'var(--warning)' }}>Unsaved</span>
      )}

      {/* ─── Export Dropdown ────────────────────────────────────── */}
      <div ref={exportRef} style={{ position: 'relative' }}>
        <ToolbarButton
          icon={<Download size={14} />}
          title="Export"
          onClick={() => setExportOpen(!exportOpen)}
        />
        {exportOpen && (
          <div style={styles.dropdown}>
            <button style={styles.dropdownItem} onClick={() => { onExport('json'); setExportOpen(false); }}>
              Export JSON
            </button>
            <button style={styles.dropdownItem} onClick={() => { onExport('xmi'); setExportOpen(false); }}>
              Export XMI
            </button>
            <button style={styles.dropdownItem} onClick={() => { onExport('svg'); setExportOpen(false); }}>
              Export SVG
            </button>
            <button style={styles.dropdownItem} onClick={() => { onExport('png'); setExportOpen(false); }}>
              Export PNG
            </button>
            {onImport && (
              <>
                <div style={{ height: 1, background: 'var(--border, #27272a)', margin: '4px 0' }} />
                <button style={styles.dropdownItem} onClick={() => { onImport(); setExportOpen(false); }}>
                  Import JSON/XMI
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* ─── Save Button ────────────────────────────────────────── */}
      <button style={styles.saveBtn} onClick={onSave} disabled={saving}>
        <Save size={14} />
        <span>{saving ? 'Saving...' : 'Save'}</span>
      </button>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ToolbarButton({
  icon,
  title,
  onClick,
  disabled,
  active,
}: {
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        ...styles.iconBtn,
        opacity: disabled ? 0.35 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: active ? 'var(--primary-bg, rgba(99, 102, 241, 0.15))' : 'transparent',
        color: active ? 'var(--primary)' : 'var(--text-secondary)',
      }}
    >
      {icon}
    </button>
  );
}

function Separator() {
  return <div style={styles.separator} />;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    background: 'var(--surface)',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
    minHeight: 40,
  },
  breadcrumb: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  breadcrumbLink: {
    fontSize: 12,
    color: 'var(--text-muted)',
    textDecoration: 'none',
    transition: 'color 0.15s',
  },
  breadcrumbCurrent: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text)',
    maxWidth: 160,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  group: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
  },
  separator: {
    width: 1,
    height: 20,
    background: 'var(--border)',
    margin: '0 4px',
    flexShrink: 0,
  },
  iconBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    border: 'none',
    borderRadius: 4,
    background: 'transparent',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    transition: 'background 0.1s, color 0.1s',
  },
  zoomLabel: {
    fontSize: 11,
    fontWeight: 500,
    color: 'var(--text-muted)',
    minWidth: 36,
    textAlign: 'center',
  },
  layerChip: {
    display: 'flex',
    alignItems: 'center',
    gap: 3,
    padding: '2px 8px',
    borderRadius: 4,
    border: '1px solid var(--border)',
    fontSize: 11,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  statusBadge: {
    fontSize: 11,
    fontWeight: 500,
    padding: '2px 8px',
    borderRadius: 4,
  },
  saveBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    padding: '5px 12px',
    borderRadius: 5,
    border: 'none',
    background: 'var(--primary)',
    color: '#fff',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 4,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    zIndex: 100,
    minWidth: 140,
    padding: 4,
  },
  dropdownItem: {
    display: 'block',
    width: '100%',
    padding: '6px 12px',
    border: 'none',
    borderRadius: 4,
    background: 'transparent',
    color: 'var(--text)',
    fontSize: 12,
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'background 0.1s',
  },
};

export default EditorToolbar;
