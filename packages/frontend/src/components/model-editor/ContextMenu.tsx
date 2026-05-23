/**
 * @emf-webapp/frontend — ContextMenu
 *
 * Right-click context menu for the model editor canvas.
 * Shows different actions depending on what was clicked:
 * - Node: Rename, Delete, Duplicate, Copy, Paste
 * - Edge: Delete, Reverse Direction
 * - Canvas: Paste, Create (submenu), Select All, Fit View
 */
import { useEffect, useRef, useCallback } from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type ContextMenuTarget =
  | { type: 'node'; nodeId: string; position: { x: number; y: number } }
  | { type: 'edge'; edgeId: string; position: { x: number; y: number } }
  | { type: 'canvas'; position: { x: number; y: number }; flowPosition: { x: number; y: number } };

interface MenuItem {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  separator?: boolean;
}

interface ContextMenuProps {
  target: ContextMenuTarget | null;
  onClose: () => void;
  onAction: (actionId: string, target: ContextMenuTarget) => void;
  hasClipboard: boolean;
  hasSelection: boolean;
  multiSelectCount: number;
}

/* ------------------------------------------------------------------ */
/*  Menu Definitions                                                    */
/* ------------------------------------------------------------------ */

function getNodeMenuItems(hasClipboard: boolean, multiSelectCount: number): MenuItem[] {
  const items: MenuItem[] = [
    { id: 'rename', label: 'Rename', icon: '✏️', shortcut: 'F2' },
    { id: 'separator-1', label: '', separator: true },
    { id: 'copy', label: 'Copy', icon: '📋', shortcut: '⌘C' },
    { id: 'duplicate', label: 'Duplicate', icon: '⧉', shortcut: '⌘D' },
    { id: 'paste', label: 'Paste', icon: '📄', shortcut: '⌘V', disabled: !hasClipboard },
    { id: 'separator-2', label: '', separator: true },
    { id: 'select-all', label: 'Select All', icon: '⊞', shortcut: '⌘A' },
  ];

  if (multiSelectCount > 1) {
    items.push(
      { id: 'separator-3', label: '', separator: true },
      { id: 'delete-all', label: `Delete ${multiSelectCount} items`, icon: '🗑️', danger: true },
    );
  } else {
    items.push(
      { id: 'separator-3', label: '', separator: true },
      { id: 'delete', label: 'Delete', icon: '🗑️', shortcut: 'Del', danger: true },
    );
  }

  return items;
}

function getEdgeMenuItems(): MenuItem[] {
  return [
    { id: 'reverse-edge', label: 'Reverse Direction', icon: '↔️' },
    { id: 'separator-1', label: '', separator: true },
    { id: 'delete', label: 'Delete Edge', icon: '🗑️', shortcut: 'Del', danger: true },
  ];
}

function getCanvasMenuItems(hasClipboard: boolean): MenuItem[] {
  return [
    { id: 'paste', label: 'Paste', icon: '📄', shortcut: '⌘V', disabled: !hasClipboard },
    { id: 'separator-1', label: '', separator: true },
    { id: 'select-all', label: 'Select All', icon: '⊞', shortcut: '⌘A' },
    { id: 'fit-view', label: 'Fit View', icon: '⊡', shortcut: '⌘1' },
    { id: 'separator-2', label: '', separator: true },
    { id: 'toggle-grid', label: 'Toggle Grid', icon: '⊞' },
    { id: 'toggle-minimap', label: 'Toggle Minimap', icon: '🗺️' },
  ];
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ContextMenu({ target, onClose, onAction, hasClipboard, hasSelection, multiSelectCount }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside or Escape
  useEffect(() => {
    if (!target) return;

    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [target, onClose]);

  // Adjust position to stay within viewport
  useEffect(() => {
    if (!target || !menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (rect.right > vw) {
      menuRef.current.style.left = `${target.position.x - rect.width}px`;
    }
    if (rect.bottom > vh) {
      menuRef.current.style.top = `${target.position.y - rect.height}px`;
    }
  }, [target]);

  const handleItemClick = useCallback((item: MenuItem) => {
    if (item.disabled || item.separator) return;
    if (target) {
      onAction(item.id, target);
    }
    onClose();
  }, [target, onAction, onClose]);

  if (!target) return null;

  const items = target.type === 'node'
    ? getNodeMenuItems(hasClipboard, multiSelectCount)
    : target.type === 'edge'
      ? getEdgeMenuItems()
      : getCanvasMenuItems(hasClipboard);

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: target.position.x,
        top: target.position.y,
        zIndex: 9999,
        minWidth: 180,
        background: 'var(--surface, #1e1e2e)',
        border: '1px solid var(--border, #27272a)',
        borderRadius: 8,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2)',
        padding: '4px 0',
        animation: 'fadeIn 0.1s ease-out',
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item) => {
        if (item.separator) {
          return (
            <div
              key={item.id}
              style={{
                height: 1,
                background: 'var(--border, #27272a)',
                margin: '4px 8px',
              }}
            />
          );
        }

        return (
          <button
            key={item.id}
            onClick={() => handleItemClick(item)}
            disabled={item.disabled}
            style={{
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              padding: '7px 12px',
              gap: 8,
              border: 'none',
              background: 'transparent',
              color: item.disabled
                ? 'var(--text-muted, #71717a)'
                : item.danger
                  ? '#ef4444'
                  : 'var(--text, #e4e4e7)',
              fontSize: 13,
              fontFamily: 'inherit',
              cursor: item.disabled ? 'default' : 'pointer',
              textAlign: 'left',
              borderRadius: 0,
              opacity: item.disabled ? 0.5 : 1,
              transition: 'background 0.1s',
            }}
            onMouseEnter={(e) => {
              if (!item.disabled) {
                (e.currentTarget as HTMLElement).style.background = 'var(--hover, rgba(255,255,255,0.05))';
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
          >
            <span style={{ width: 18, textAlign: 'center', fontSize: 14 }}>
              {item.icon}
            </span>
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.shortcut && (
              <span style={{
                fontSize: 11,
                color: 'var(--text-muted, #71717a)',
                fontFamily: 'monospace',
              }}>
                {item.shortcut}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
