import React, { useState, useRef, useEffect } from 'react';
import type { Layer } from '../../components/spec-diagram/types';
import { Plus, Trash2, Eye, EyeOff, Lock } from '../../components/icons';

export interface LayerPanelProps {
  layers: Layer[];
  activeLayerId: string;
  onSelectLayer: (layerId: string) => void;
  onAddLayer: () => void;
  onRemoveLayer: (layerId: string) => void;
  onRenameLayer: (layerId: string, newName: string) => void;
  onToggleActive: (layerId: string) => void;
}

export function LayerPanel({
  layers,
  activeLayerId,
  onSelectLayer,
  onAddLayer,
  onRemoveLayer,
  onRenameLayer,
  onToggleActive,
}: LayerPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const handleDoubleClick = (layer: Layer) => {
    if (layer.isDefault) return; // Don't allow renaming default layer
    setEditingId(layer.id);
    setEditValue(layer.name);
  };

  const commitRename = () => {
    if (editingId && editValue.trim()) {
      onRenameLayer(editingId, editValue.trim());
    }
    setEditingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      commitRename();
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.title}>Layers</span>
      </div>

      <div style={styles.list}>
        {layers.map((layer) => {
          const isSelected = layer.id === activeLayerId;
          return (
            <div
              key={layer.id}
              style={{
                ...styles.item,
                borderLeft: isSelected
                  ? '3px solid var(--primary)'
                  : '3px solid transparent',
                background: isSelected ? 'var(--bg-hover, rgba(255,255,255,0.05))' : 'transparent',
              }}
              onClick={() => onSelectLayer(layer.id)}
              role="button"
              tabIndex={0}
              aria-label={`Select layer ${layer.name}`}
              aria-current={isSelected ? 'true' : undefined}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectLayer(layer.id);
                }
              }}
            >
              {/* Lock icon for default layer */}
              {layer.isDefault && (
                <Lock size={12} style={styles.lockIcon} aria-label="Default layer (locked)" />
              )}

              {/* Layer name — editable on double-click */}
              {editingId === layer.id ? (
                <input
                  ref={inputRef}
                  style={styles.nameInput}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={handleKeyDown}
                  aria-label="Rename layer"
                />
              ) : (
                <span
                  style={styles.name}
                  onDoubleClick={() => handleDoubleClick(layer)}
                  title={layer.isDefault ? 'Default layer' : 'Double-click to rename'}
                >
                  {layer.name}
                </span>
              )}

              {/* Action buttons */}
              <div style={styles.actions}>
                {/* Active toggle */}
                <button
                  style={styles.iconBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleActive(layer.id);
                  }}
                  title={layer.activeByDefault ? 'Hide layer' : 'Show layer'}
                  aria-label={layer.activeByDefault ? 'Hide layer' : 'Show layer'}
                >
                  {layer.activeByDefault ? (
                    <Eye size={14} />
                  ) : (
                    <EyeOff size={14} style={{ opacity: 0.5 }} />
                  )}
                </button>

                {/* Delete button — not for default layer */}
                {!layer.isDefault && (
                  <button
                    style={styles.iconBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveLayer(layer.id);
                    }}
                    title="Remove layer"
                    aria-label={`Remove layer ${layer.name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <button
        style={styles.addBtn}
        onClick={onAddLayer}
        aria-label="Add layer"
      >
        <Plus size={14} />
        <span>Add Layer</span>
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    fontSize: '13px',
  },
  header: {
    padding: '8px 12px',
    borderBottom: '1px solid var(--border, #333)',
    fontWeight: 600,
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: 'var(--text-muted, #999)',
  },
  title: {},
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: '4px 0',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 10px',
    cursor: 'pointer',
    transition: 'background 0.1s',
    minHeight: '32px',
  },
  lockIcon: {
    flexShrink: 0,
    opacity: 0.5,
  },
  name: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    userSelect: 'none',
  },
  nameInput: {
    flex: 1,
    background: 'var(--bg-input, #1e1e1e)',
    border: '1px solid var(--primary, #007acc)',
    borderRadius: '2px',
    color: 'inherit',
    fontSize: '13px',
    padding: '1px 4px',
    outline: 'none',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    flexShrink: 0,
  },
  iconBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '22px',
    height: '22px',
    border: 'none',
    background: 'transparent',
    color: 'inherit',
    borderRadius: '3px',
    cursor: 'pointer',
    opacity: 0.7,
  },
  addBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '8px 12px',
    margin: '4px 8px 8px',
    border: '1px dashed var(--border, #444)',
    borderRadius: '4px',
    background: 'transparent',
    color: 'var(--text-muted, #999)',
    cursor: 'pointer',
    fontSize: '12px',
    transition: 'border-color 0.15s, color 0.15s',
  },
};

export default LayerPanel;
