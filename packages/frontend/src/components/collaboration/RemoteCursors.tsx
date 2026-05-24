/**
 * @emf-webapp/frontend — RemoteCursors (Sprint 2: Professional Awareness)
 *
 * Renders remote user cursors with proper viewport transformation.
 * Cursors are shared in CANVAS coordinates (flow space) and transformed
 * to screen coordinates using the current user's viewport (zoom + pan).
 *
 * Features:
 * - Viewport-transformed cursors (correct at any zoom/pan)
 * - Smooth interpolation (CSS transitions at ~30fps)
 * - User color + name label with fade-out on idle
 * - Selection highlight rings on nodes selected by others
 * - Editing indicators on nodes being edited by others
 */
import React, { memo, useMemo } from 'react';
import { useReactFlow, useViewport } from '@xyflow/react';
import type { AwarenessState } from '../../hooks/useYjsCollaboration';
import { CursorMessages } from './PremiumFeatures';

// ─── Types ───────────────────────────────────────────────────────────────

interface RemoteCursorsProps {
  /** Yjs awareness states (remote users only) */
  awarenessStates: Map<number, AwarenessState>;
}

// ─── Cursor SVG ──────────────────────────────────────────────────────────

const CursorIcon = memo(function CursorIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="20" viewBox="0 0 16 20" fill="none" style={{ display: 'block' }}>
      <path
        d="M1 1L1 14L5 10.5L7.5 17L10 16L7.5 9.5L12.5 9.5L1 1Z"
        fill={color}
        stroke="#fff"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
});

// ─── Component ───────────────────────────────────────────────────────────

export function RemoteCursors({ awarenessStates }: RemoteCursorsProps) {
  const { x: vpX, y: vpY, zoom } = useViewport();

  // Convert awareness states to cursor data with screen positions
  // Lazy awareness: only render cursors visible in the viewport
  const cursors = useMemo(() => {
    const result: Array<{
      id: number;
      name: string;
      color: string;
      screenX: number;
      screenY: number;
    }> = [];

    awarenessStates.forEach((state, clientId) => {
      if (!state.cursor || !state.user) return;

      // Transform canvas coords → screen coords using current viewport
      const screenX = state.cursor.x * zoom + vpX;
      const screenY = state.cursor.y * zoom + vpY;

      // Skip cursors outside viewport (with 100px margin)
      if (screenX < -100 || screenX > window.innerWidth + 100 ||
          screenY < -100 || screenY > window.innerHeight + 100) {
        return;
      }

      result.push({
        id: clientId,
        name: state.user.name,
        color: state.user.color,
        screenX,
        screenY,
      });
    });

    return result;
  }, [awarenessStates, vpX, vpY, zoom]);

  if (cursors.length === 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 1000,
        overflow: 'hidden',
      }}
    >
      {cursors.map((cursor) => (
        <div
          key={cursor.id}
          style={{
            position: 'absolute',
            left: cursor.screenX,
            top: cursor.screenY,
            transform: 'translate(-2px, -2px)',
            transition: 'left 120ms cubic-bezier(0.25, 0.1, 0.25, 1), top 120ms cubic-bezier(0.25, 0.1, 0.25, 1)',
            willChange: 'left, top',
          }}
        >
          <CursorIcon color={cursor.color} />
          <span
            style={{
              position: 'absolute',
              left: 14,
              top: -1,
              background: cursor.color,
              color: '#fff',
              fontSize: 11,
              fontWeight: 600,
              padding: '2px 7px',
              borderRadius: 4,
              whiteSpace: 'nowrap',
              lineHeight: '16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
              userSelect: 'none',
            }}
          >
            {cursor.name}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Selection Highlights ────────────────────────────────────────────────

interface SelectionHighlightsProps {
  /** Yjs awareness states */
  awarenessStates: Map<number, AwarenessState>;
  /** Current nodes (to get positions/dimensions) */
  nodes: Array<{ id: string; position: { x: number; y: number }; measured?: { width?: number; height?: number } }>;
}

/**
 * Renders colored border highlights around nodes selected by remote users.
 * Positioned in flow-space (inside ReactFlow viewport transform).
 */
export const SelectionHighlights = memo(function SelectionHighlights({ awarenessStates, nodes }: SelectionHighlightsProps) {
  // Build map: nodeId → { color, name }[]
  const highlights = useMemo(() => {
    const map = new Map<string, { color: string; name: string }[]>();

    awarenessStates.forEach((state) => {
      if (!state.user || !state.selectedNodeIds?.length) return;
      for (const nodeId of state.selectedNodeIds) {
        const existing = map.get(nodeId) || [];
        existing.push({ color: state.user.color, name: state.user.name });
        map.set(nodeId, existing);
      }
    });

    return map;
  }, [awarenessStates]);

  // Build node lookup for positions (must be before early return — Rules of Hooks)
  const nodeMap = useMemo(() => {
    const m = new Map<string, { x: number; y: number; w: number; h: number }>();
    for (const node of nodes) {
      m.set(node.id, {
        x: node.position.x,
        y: node.position.y,
        w: node.measured?.width ?? 200,
        h: node.measured?.height ?? 100,
      });
    }
    return m;
  }, [nodes]);

  if (highlights.size === 0) return null;

  const elements: React.ReactElement[] = [];

  highlights.forEach((users, nodeId) => {
    const node = nodeMap.get(nodeId);
    if (!node) return;

    const primaryColor = users[0].color;
    const names = users.map(u => u.name).join(', ');

    elements.push(
      <div
        key={`sel-${nodeId}`}
        style={{
          position: 'absolute',
          left: node.x - 4,
          top: node.y - 4,
          width: node.w + 8,
          height: node.h + 8,
          border: `2px solid ${primaryColor}`,
          borderRadius: 10,
          pointerEvents: 'none',
          boxShadow: `0 0 0 1px ${primaryColor}33, 0 0 12px ${primaryColor}22`,
          transition: 'left 150ms ease-out, top 150ms ease-out, width 150ms ease-out, height 150ms ease-out',
        }}
      >
        {/* User name badge at top-left */}
        <span
          style={{
            position: 'absolute',
            top: -10,
            left: 8,
            background: primaryColor,
            color: '#fff',
            fontSize: 10,
            fontWeight: 600,
            padding: '1px 6px',
            borderRadius: 3,
            whiteSpace: 'nowrap',
            lineHeight: '14px',
          }}
        >
          {names}
        </span>
      </div>,
    );
  });

  return <>{elements}</>;
});

// ─── Editing Indicators ──────────────────────────────────────────────────

interface EditingIndicatorsProps {
  /** Yjs awareness states */
  awarenessStates: Map<number, AwarenessState>;
  /** Current nodes */
  nodes: Array<{ id: string; position: { x: number; y: number }; measured?: { width?: number; height?: number } }>;
}

/**
 * Shows "Editing..." indicator with user avatar on nodes being edited by others.
 */
export const EditingIndicators = memo(function EditingIndicators({ awarenessStates, nodes }: EditingIndicatorsProps) {
  // Build map: nodeId → user info
  const editing = useMemo(() => {
    const map = new Map<string, { color: string; name: string }>();

    awarenessStates.forEach((state) => {
      if (!state.user || !state.editingNodeId) return;
      // First user to claim editing wins display
      if (!map.has(state.editingNodeId)) {
        map.set(state.editingNodeId, { color: state.user.color, name: state.user.name });
      }
    });

    return map;
  }, [awarenessStates]);

  // Build node lookup (must be before early return — Rules of Hooks)
  const nodeMap = useMemo(() => {
    const m = new Map<string, { x: number; y: number; w: number; h: number }>();
    for (const node of nodes) {
      m.set(node.id, {
        x: node.position.x,
        y: node.position.y,
        w: node.measured?.width ?? 200,
        h: node.measured?.height ?? 100,
      });
    }
    return m;
  }, [nodes]);

  if (editing.size === 0) return null;

  const elements: React.ReactElement[] = [];

  editing.forEach((user, nodeId) => {
    const node = nodeMap.get(nodeId);
    if (!node) return;

    elements.push(
      <div
        key={`edit-${nodeId}`}
        style={{
          position: 'absolute',
          left: node.x + node.w - 8,
          top: node.y - 12,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          pointerEvents: 'none',
          transition: 'left 150ms ease-out, top 150ms ease-out',
        }}
      >
        {/* Avatar circle */}
        <div
          style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: user.color,
            color: '#fff',
            fontSize: 10,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid var(--surface, #fff)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          }}
        >
          {user.name.charAt(0).toUpperCase()}
        </div>
        {/* "Editing..." label */}
        <span
          style={{
            background: user.color,
            color: '#fff',
            fontSize: 10,
            fontWeight: 600,
            padding: '2px 6px',
            borderRadius: 4,
            whiteSpace: 'nowrap',
            lineHeight: '14px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
            animation: 'pulse-opacity 1.5s ease-in-out infinite',
          }}
        >
          Editing…
        </span>
      </div>,
    );
  });

  return <>{elements}</>;
});

// ─── Selection Highlights Overlay (viewport-transformed) ─────────────────

interface SelectionHighlightsOverlayProps {
  awarenessStates: Map<number, AwarenessState>;
  nodes: Array<{ id: string; position: { x: number; y: number }; measured?: { width?: number; height?: number } }>;
}

/**
 * Overlay that renders SelectionHighlights + EditingIndicators
 * with viewport transformation (so they track node positions correctly).
 */
export function SelectionHighlightsOverlay({ awarenessStates, nodes }: SelectionHighlightsOverlayProps) {
  const { x: vpX, y: vpY, zoom } = useViewport();

  // Memoize children so they don't re-render when only the viewport transform changes
  const children = useMemo(() => (
    <>
      <SelectionHighlights awarenessStates={awarenessStates} nodes={nodes} />
      <EditingIndicators awarenessStates={awarenessStates} nodes={nodes} />
      <CursorMessages awarenessStates={awarenessStates} />
    </>
  ), [awarenessStates, nodes]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 999,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          transform: `translate(${vpX}px, ${vpY}px) scale(${zoom})`,
          transformOrigin: '0 0',
          position: 'absolute',
          inset: 0,
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ─── Presence Panel ──────────────────────────────────────────────────────

interface PresencePanelProps {
  /** Yjs awareness states (remote users) */
  awarenessStates: Map<number, AwarenessState>;
  /** Current user name */
  currentUserName: string;
  /** Current user color */
  currentUserColor: string;
  /** Is connected to collaboration server? */
  connected: boolean;
}

/**
 * Compact presence panel showing connected users with avatars.
 * Replaces the old CollaborationBadge.
 */
export function PresencePanel({ awarenessStates, currentUserName, currentUserColor, connected }: PresencePanelProps) {
  const users = useMemo(() => {
    const list: Array<{ id: string; name: string; color: string; isEditing: boolean; isIdle: boolean }> = [];

    // Add current user first
    list.push({
      id: 'self',
      name: currentUserName + ' (you)',
      color: currentUserColor,
      isEditing: false,
      isIdle: false,
    });

    // Add remote users
    awarenessStates.forEach((state, clientId) => {
      if (!state.user) return;
      list.push({
        id: `remote-${clientId}`,
        name: state.user.name,
        color: state.user.color,
        isEditing: !!state.editingNodeId,
        isIdle: !state.cursor && !state.editingNodeId && (!state.selectedNodeIds || state.selectedNodeIds.length === 0),
      });
    });

    return list;
  }, [awarenessStates, currentUserName, currentUserColor]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}
    >
      {/* Connection indicator */}
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: connected ? '#10b981' : '#ef4444',
          flexShrink: 0,
          boxShadow: connected ? '0 0 4px #10b98166' : 'none',
        }}
      />

      {/* Stacked avatars */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {users.slice(0, 6).map((user, i) => (
          <div
            key={user.id}
            title={user.name + (user.isEditing ? ' (editing)' : user.isIdle ? ' (idle)' : '')}
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: user.color,
              color: '#fff',
              fontSize: 11,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: i > 0 ? -6 : 0,
              border: '2px solid var(--surface)',
              flexShrink: 0,
              opacity: user.isIdle ? 0.6 : 1,
              position: 'relative',
            }}
          >
            {user.name.charAt(0).toUpperCase()}
            {/* Editing pulse dot */}
            {user.isEditing && (
              <span
                style={{
                  position: 'absolute',
                  bottom: -1,
                  right: -1,
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#f59e0b',
                  border: '1.5px solid var(--surface)',
                  animation: 'pulse-opacity 1.5s ease-in-out infinite',
                }}
              />
            )}
          </div>
        ))}
        {users.length > 6 && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>
            +{users.length - 6}
          </span>
        )}
      </div>

      {/* Count label */}
      <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>
        {users.length}
      </span>
    </div>
  );
}
