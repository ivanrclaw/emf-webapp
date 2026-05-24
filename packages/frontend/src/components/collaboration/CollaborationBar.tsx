/**
 * @emf-webapp/frontend — CollaborationBar
 *
 * Compact presence bar showing connection status and user avatars.
 * Matches the style of PresencePanel in RemoteCursors.tsx.
 */
import React, { useMemo } from 'react';
import type { PresenceState } from '../../hooks/useRoomPresence';

export interface CollaborationBarProps {
  connected: boolean;
  remoteStates: Map<number, PresenceState>;
  currentUserName: string;
  currentUserColor: string;
}

export function CollaborationBar({
  connected,
  remoteStates,
  currentUserName,
  currentUserColor,
}: CollaborationBarProps) {
  const users = useMemo(() => {
    const list: Array<{ id: string; name: string; color: string; isActive: boolean }> = [];

    // Current user first
    list.push({
      id: 'self',
      name: currentUserName + ' (you)',
      color: currentUserColor,
      isActive: true,
    });

    // Remote users
    remoteStates.forEach((state, clientId) => {
      if (!state.user) return;
      list.push({
        id: `remote-${clientId}`,
        name: state.user.name,
        color: state.user.color,
        isActive: !!(state.cursor || state.activeElementId || state.editingField),
      });
    });

    return list;
  }, [remoteStates, currentUserName, currentUserColor]);

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
            title={user.name}
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
              opacity: user.isActive ? 1 : 0.6,
              position: 'relative',
            }}
          >
            {user.name.charAt(0).toUpperCase()}
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
