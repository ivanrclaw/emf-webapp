/**
 * @emf-webapp/frontend — RemoteCursors
 *
 * Muestra los cursores de otros usuarios colaborando en el mismo metamodelo.
 * Soporta tanto el sistema legacy (RoomUser) como el nuevo Yjs awareness.
 * Se renderiza como overlay absoluto sobre el canvas React Flow.
 */
import React from 'react';
import type { RoomUser } from '../../hooks/useCollaboration';
import type { AwarenessState } from '../../hooks/useYjsCollaboration';

interface RemoteCursorsProps {
  /** Legacy users from Socket.IO */
  users: RoomUser[];
  /** ID del usuario actual para no mostrar su propio cursor */
  currentUserSocketId?: string;
  /** New Yjs awareness states */
  awarenessStates?: Map<number, AwarenessState>;
}

const userColors = [
  '#6366f1', // Indigo
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#ec4899', // Pink
  '#8b5cf6', // Violet
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#14b8a6', // Teal
];

function getUserColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i);
    hash |= 0;
  }
  return userColors[Math.abs(hash) % userColors.length];
}

export function RemoteCursors({ users, currentUserSocketId, awarenessStates }: RemoteCursorsProps) {
  const activeCursors = users.filter(
    (u) => u.cursor && u.id !== currentUserSocketId
  );

  // Yjs awareness cursors
  const yjsCursors: Array<{ id: string; name: string; color: string; cursor: { x: number; y: number } }> = [];
  if (awarenessStates) {
    awarenessStates.forEach((state, clientId) => {
      if (state.cursor && state.user) {
        yjsCursors.push({
          id: `yjs-${clientId}`,
          name: state.user.name,
          color: state.user.color,
          cursor: state.cursor,
        });
      }
    });
  }

  if (activeCursors.length === 0 && yjsCursors.length === 0) return null;

  return (
    <>
      {activeCursors.map((user) => {
        const color = getUserColor(user.id);
        return (
          <div
            key={user.id}
            style={{
              position: 'absolute',
              left: user.cursor!.x,
              top: user.cursor!.y,
              pointerEvents: 'none',
              zIndex: 1000,
              transform: 'translate(-4px, -4px)',
              transition: 'left 0.08s ease, top 0.08s ease',
            }}
          >
            {/* Cursor SVG */}
            <svg width="16" height="20" viewBox="0 0 16 20" fill="none">
              <path
                d="M2 1L13 12H8L6 15L4 12H2L2 1Z"
                fill={color}
                stroke="#fff"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
            {/* User name label */}
            <span
              style={{
                position: 'absolute',
                left: 12,
                top: -2,
                background: color,
                color: '#fff',
                fontSize: 11,
                fontWeight: 600,
                padding: '1px 6px',
                borderRadius: 4,
                whiteSpace: 'nowrap',
                lineHeight: '18px',
              }}
            >
              {user.userName}
            </span>
          </div>
        );
      })}
      {yjsCursors.map((cursor) => (
        <div
          key={cursor.id}
          style={{
            position: 'absolute',
            left: cursor.cursor.x,
            top: cursor.cursor.y,
            pointerEvents: 'none',
            zIndex: 1000,
            transform: 'translate(-4px, -4px)',
            transition: 'left 0.05s linear, top 0.05s linear',
          }}
        >
          <svg width="16" height="20" viewBox="0 0 16 20" fill="none">
            <path
              d="M2 1L13 12H8L6 15L4 12H2L2 1Z"
              fill={cursor.color}
              stroke="#fff"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
          <span
            style={{
              position: 'absolute',
              left: 12,
              top: -2,
              background: cursor.color,
              color: '#fff',
              fontSize: 11,
              fontWeight: 600,
              padding: '1px 6px',
              borderRadius: 4,
              whiteSpace: 'nowrap',
              lineHeight: '18px',
            }}
          >
            {cursor.name}
          </span>
        </div>
      ))}
    </>
  );
}

/**
 * Badge de colaboración para la barra superior.
 * Muestra el estado de conexión y los usuarios conectados.
 */
interface CollaborationBadgeProps {
  connected: boolean;
  users: RoomUser[];
  currentUserSocketId?: string;
}

export function CollaborationBadge({ connected, users, currentUserSocketId }: CollaborationBadgeProps) {
  const others = currentUserSocketId
    ? users.filter((u) => u.id !== currentUserSocketId)
    : users;

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 12px',
        borderRadius: 8,
        background: connected ? 'rgba(16,185,129,0.1)' : 'rgba(100,116,139,0.1)',
        border: `1px solid ${connected ? 'rgba(16,185,129,0.3)' : 'rgba(100,116,139,0.2)'}`,
        fontSize: 12,
        fontWeight: 500,
      }}
    >
      {/* Status dot */}
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: connected ? '#10b981' : 'var(--text-secondary)',
          display: 'inline-block',
          flexShrink: 0,
        }}
      />
      <span style={{ color: connected ? '#059669' : 'var(--text-muted)' }}>
        {connected ? `${others.length ? `${others.length} online` : 'Connected'}` : 'Offline'}
      </span>

      {/* User avatars */}
      {connected && others.length > 0 && (
        <div style={{ display: 'inline-flex', alignItems: 'center', marginLeft: 2 }}>
          {others.slice(0, 4).map((u) => (
            <div
              key={u.id}
              title={u.userName}
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: getUserColor(u.id),
                color: '#fff',
                fontSize: 10,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: -4,
                border: '2px solid var(--surface)',
                flexShrink: 0,
              }}
            >
              {u.userName.charAt(0).toUpperCase()}
            </div>
          ))}
          {others.length > 4 && (
            <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 2 }}>
              +{others.length - 4}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
