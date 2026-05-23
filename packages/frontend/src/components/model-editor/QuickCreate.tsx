/**
 * @emf-webapp/frontend — QuickCreate
 *
 * Floating "+" button in the canvas corner that opens a mini-palette
 * with the most used creation tools for quick access.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { Plus } from '../../components/icons';
import type { NodeCreationTool, ContainerCreationTool, Tool } from '../spec-diagram/types';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface QuickCreateProps {
  tools: Tool[];
  onCreateNode: (tool: NodeCreationTool | ContainerCreationTool) => void;
  instanceCounts: Record<string, number>;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function QuickCreate({ tools, onCreateNode, instanceCounts }: QuickCreateProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Only show creation tools, sorted by usage
  const creationTools = tools
    .filter((t) => t.type === 'nodeCreation' || t.type === 'containerCreation')
    .sort((a, b) => {
      const countA = instanceCounts[(a as NodeCreationTool).createType] || 0;
      const countB = instanceCounts[(b as NodeCreationTool).createType] || 0;
      return countB - countA;
    })
    .slice(0, 6) as (NodeCreationTool | ContainerCreationTool)[];

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as HTMLElement)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleCreate = useCallback((tool: NodeCreationTool | ContainerCreationTool) => {
    onCreateNode(tool);
    setOpen(false);
  }, [onCreateNode]);

  if (creationTools.length === 0) return null;

  return (
    <div
      ref={panelRef}
      style={{
        position: 'absolute',
        bottom: 16,
        right: 16,
        zIndex: 100,
      }}
    >
      {/* Expanded panel */}
      {open && (
        <div style={{
          position: 'absolute',
          bottom: 48,
          right: 0,
          background: 'var(--surface, #1e1e2e)',
          border: '1px solid var(--border, #27272a)',
          borderRadius: 10,
          padding: '8px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          minWidth: 160,
          animation: 'fadeIn 0.12s ease-out',
        }}>
          <div style={{
            fontSize: 10,
            color: 'var(--text-muted, #71717a)',
            padding: '2px 6px 6px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            Quick Create
          </div>
          {creationTools.map((tool) => {
            const color = tool.iconColor || '#6366f1';
            return (
              <button
                key={tool.id}
                onClick={() => handleCreate(tool)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '6px 8px',
                  border: 'none',
                  borderRadius: 5,
                  background: 'transparent',
                  color: 'var(--text, #e4e4e7)',
                  fontSize: 12,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--hover, rgba(255,255,255,0.05))';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <span style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: color,
                  flexShrink: 0,
                }} />
                <span style={{ flex: 1 }}>{tool.label}</span>
                <span style={{
                  fontSize: 10,
                  color: 'var(--text-muted, #71717a)',
                }}>
                  {instanceCounts[tool.createType] || 0}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* FAB button */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          border: 'none',
          background: open ? 'var(--primary, #6366f1)' : 'var(--surface, #1e1e2e)',
          color: open ? '#fff' : 'var(--text, #e4e4e7)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.3), 0 0 0 1px var(--border, #27272a)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.15s, transform 0.15s',
          transform: open ? 'rotate(45deg)' : 'none',
        }}
        title="Quick Create"
        aria-label="Quick create element"
        aria-expanded={open}
      >
        <Plus size={20} />
      </button>
    </div>
  );
}
