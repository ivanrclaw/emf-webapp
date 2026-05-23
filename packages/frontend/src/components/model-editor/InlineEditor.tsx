/**
 * @emf-webapp/frontend — InlineEditor
 *
 * Floating input overlay for inline label editing on nodes.
 * Appears on double-click or F2, confirms on Enter, cancels on Escape.
 * Positions itself over the node using ReactFlow viewport coordinates.
 */
import { useState, useRef, useEffect, useCallback } from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface InlineEditorState {
  nodeId: string;
  initialValue: string;
  position: { x: number; y: number };
  width: number;
}

interface InlineEditorProps {
  state: InlineEditorState | null;
  onConfirm: (nodeId: string, value: string) => void;
  onCancel: () => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function InlineEditor({ state, onConfirm, onCancel }: InlineEditorProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync value when state changes (new edit session)
  useEffect(() => {
    if (state) {
      setValue(state.initialValue);
      // Focus and select all after mount
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [state]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      if (state && value.trim()) {
        onConfirm(state.nodeId, value.trim());
      } else {
        onCancel();
      }
    } else if (e.key === 'Escape') {
      onCancel();
    }
  }, [state, value, onConfirm, onCancel]);

  const handleBlur = useCallback(() => {
    if (state && value.trim() && value.trim() !== state.initialValue) {
      onConfirm(state.nodeId, value.trim());
    } else {
      onCancel();
    }
  }, [state, value, onConfirm, onCancel]);

  if (!state) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: state.position.x,
        top: state.position.y,
        zIndex: 1000,
        pointerEvents: 'all',
        animation: 'fadeIn 0.12s ease-out',
      }}
    >
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        style={{
          width: Math.max(state.width, 120),
          height: 30,
          padding: '4px 8px',
          fontSize: 13,
          fontWeight: 600,
          fontFamily: 'inherit',
          background: 'var(--surface, #1e1e2e)',
          color: 'var(--text, #e4e4e7)',
          border: '2px solid var(--primary, #6366f1)',
          borderRadius: 6,
          outline: 'none',
          boxShadow: '0 4px 16px rgba(99,102,241,0.3), 0 2px 4px rgba(0,0,0,0.2)',
          textAlign: 'center',
        }}
      />
      <div style={{
        marginTop: 4,
        display: 'flex',
        justifyContent: 'center',
        gap: 4,
      }}>
        <span style={{
          fontSize: 10,
          color: 'var(--text-muted, #71717a)',
          background: 'var(--surface, #1e1e2e)',
          padding: '1px 5px',
          borderRadius: 3,
          border: '1px solid var(--border, #27272a)',
        }}>
          Enter ✓
        </span>
        <span style={{
          fontSize: 10,
          color: 'var(--text-muted, #71717a)',
          background: 'var(--surface, #1e1e2e)',
          padding: '1px 5px',
          borderRadius: 3,
          border: '1px solid var(--border, #27272a)',
        }}>
          Esc ✗
        </span>
      </div>
    </div>
  );
}
