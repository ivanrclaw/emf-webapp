/**
 * @emf-webapp/frontend — Premium Collaboration Features (Sprint 7)
 *
 * - FollowMode: Follow another user's viewport in real-time
 * - CursorChat: Ephemeral messages that appear next to cursors
 * - ActivityFeed: Recent operations log
 */
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useReactFlow } from '@xyflow/react';
import type { AwarenessState } from '../../hooks/useYjsCollaboration';

// ─── Follow Mode ─────────────────────────────────────────────────────────

interface FollowModeProps {
  awarenessStates: Map<number, AwarenessState>;
  /** Currently following this client ID (null = not following) */
  followingId: number | null;
  onFollow: (clientId: number | null) => void;
}

/**
 * Follow mode panel — select a user to follow their viewport.
 * When following, your viewport mirrors theirs in real-time.
 */
export function FollowModePanel({ awarenessStates, followingId, onFollow }: FollowModeProps) {
  const users = useMemo(() => {
    const list: Array<{ id: number; name: string; color: string }> = [];
    awarenessStates.forEach((state, clientId) => {
      if (state.user) {
        list.push({ id: clientId, name: state.user.name, color: state.user.color });
      }
    });
    return list;
  }, [awarenessStates]);

  if (users.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '8px 10px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        minWidth: 140,
      }}
    >
      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        Follow
      </span>
      {users.map((user) => (
        <button
          key={user.id}
          onClick={() => onFollow(followingId === user.id ? null : user.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 8px',
            border: followingId === user.id ? `1.5px solid ${user.color}` : '1px solid var(--border)',
            borderRadius: 6,
            background: followingId === user.id ? `${user.color}15` : 'transparent',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--text)',
          }}
        >
          <span
            style={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: user.color,
              color: '#fff',
              fontSize: 9,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {user.name.charAt(0).toUpperCase()}
          </span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.name}
          </span>
          {followingId === user.id && (
            <span style={{ fontSize: 10, color: user.color, marginLeft: 'auto' }}>●</span>
          )}
        </button>
      ))}
      {followingId !== null && (
        <button
          onClick={() => onFollow(null)}
          style={{
            padding: '3px 8px',
            border: '1px solid var(--border)',
            borderRadius: 6,
            background: 'transparent',
            cursor: 'pointer',
            fontSize: 11,
            color: 'var(--text-muted)',
          }}
        >
          Stop following
        </button>
      )}
    </div>
  );
}

/**
 * Hook that syncs viewport to followed user's viewport.
 * Uses direct setViewport without animation to avoid stacking 150ms transitions
 * on every frame. Throttled to ~30fps to reduce jitter.
 */
export function useFollowMode(
  followingId: number | null,
  awarenessStates: Map<number, AwarenessState>,
) {
  const reactFlow = useReactFlow();
  const animFrameRef = useRef<number | null>(null);
  const lastAppliedRef = useRef<{ x: number; y: number; zoom: number } | null>(null);
  const lastTimeRef = useRef(0);

  useEffect(() => {
    if (followingId === null) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      lastAppliedRef.current = null;
      return;
    }

    function syncViewport() {
      const now = performance.now();
      // Throttle to ~30fps (33ms) to avoid excessive updates
      if (now - lastTimeRef.current < 33) {
        animFrameRef.current = requestAnimationFrame(syncViewport);
        return;
      }
      lastTimeRef.current = now;

      const state = awarenessStates.get(followingId!);
      if (state?.viewport) {
        const { x, y, zoom } = state.viewport;
        const last = lastAppliedRef.current;
        // Only update if viewport actually changed (avoid redundant calls)
        if (!last || Math.abs(last.x - x) > 0.5 || Math.abs(last.y - y) > 0.5 || Math.abs(last.zoom - zoom) > 0.001) {
          lastAppliedRef.current = { x, y, zoom };
          // No duration — instant snap prevents animation stacking
          reactFlow.setViewport({ x, y, zoom });
        }
      }
      animFrameRef.current = requestAnimationFrame(syncViewport);
    }

    animFrameRef.current = requestAnimationFrame(syncViewport);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [followingId, awarenessStates, reactFlow]);
}

// ─── Cursor Chat ─────────────────────────────────────────────────────────

interface CursorChatProps {
  /** Callback to send a message */
  onSend: (text: string) => void;
}

/**
 * Cursor chat input — press "/" to open, Enter to send, Escape to cancel.
 * Message appears next to your cursor for 4 seconds.
 */
export function useCursorChat(onSend: (text: string) => void) {
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState('');

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && !isOpen &&
          document.activeElement?.tagName !== 'INPUT' &&
          document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        setIsOpen(true);
        setText('');
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setText('');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      onSend(text.trim());
      // Auto-clear after 4 seconds
      setTimeout(() => onSend(''), 4000);
    }
    setIsOpen(false);
    setText('');
  }, [text, onSend]);

  return { isOpen, text, setText, handleSubmit, close: () => setIsOpen(false) };
}

export function CursorChatInput({ chat }: { chat: ReturnType<typeof useCursorChat> }) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (chat.isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [chat.isOpen]);

  if (!chat.isOpen) return null;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 60,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1200,
      }}
    >
      <form onSubmit={chat.handleSubmit} style={{ display: 'flex', gap: 4 }}>
        <input
          ref={inputRef}
          type="text"
          value={chat.text}
          onChange={(e) => chat.setText(e.target.value)}
          placeholder="Type a message..."
          style={{
            width: 240,
            padding: '8px 12px',
            fontSize: 13,
            border: '1px solid var(--border)',
            borderRadius: 8,
            outline: 'none',
            background: 'var(--surface)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
            color: 'var(--text)',
          }}
        />
        <button
          type="submit"
          style={{
            padding: '8px 12px',
            fontSize: 12,
            fontWeight: 600,
            border: '1px solid var(--primary)',
            borderRadius: 8,
            background: 'var(--primary)',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          Send
        </button>
      </form>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', marginTop: 4 }}>
        Press Enter to send · Escape to cancel
      </div>
    </div>
  );
}

/**
 * Renders cursor chat messages next to remote cursors.
 * Messages auto-fade after 4 seconds.
 */
export function CursorMessages({ awarenessStates }: { awarenessStates: Map<number, AwarenessState> }) {
  const messages = useMemo(() => {
    const result: Array<{ id: number; text: string; color: string; name: string; x: number; y: number }> = [];
    const now = Date.now();

    awarenessStates.forEach((state, clientId) => {
      if (!state.cursorMessage || !state.cursor || !state.user) return;
      // Only show messages less than 5 seconds old
      if (now - state.cursorMessage.timestamp > 5000) return;

      result.push({
        id: clientId,
        text: state.cursorMessage.text,
        color: state.user.color,
        name: state.user.name,
        x: state.cursor.x,
        y: state.cursor.y,
      });
    });

    return result;
  }, [awarenessStates]);

  if (messages.length === 0) return null;

  // Note: these are in canvas coords — they'll be rendered inside the viewport-transformed overlay
  return (
    <>
      {messages.map((msg) => (
        <div
          key={`msg-${msg.id}`}
          style={{
            position: 'absolute',
            left: msg.x + 20,
            top: msg.y - 30,
            pointerEvents: 'none',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <div
            style={{
              background: msg.color,
              color: '#fff',
              fontSize: 12,
              fontWeight: 500,
              padding: '4px 10px',
              borderRadius: 8,
              borderTopLeftRadius: 2,
              maxWidth: 200,
              wordBreak: 'break-word',
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            }}
          >
            {msg.text}
          </div>
        </div>
      ))}
    </>
  );
}

// ─── Activity Feed ───────────────────────────────────────────────────────

export interface ActivityEntry {
  id: string;
  userName: string;
  userColor: string;
  action: string;
  target: string;
  timestamp: number;
}

interface ActivityFeedProps {
  entries: ActivityEntry[];
}

export function ActivityFeed({ entries }: ActivityFeedProps) {
  if (entries.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        padding: '8px 10px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        maxHeight: 200,
        overflowY: 'auto',
        minWidth: 200,
      }}
    >
      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
        Activity
      </span>
      {entries.slice(0, 20).map((entry) => {
        const ago = Math.round((Date.now() - entry.timestamp) / 1000);
        const timeStr = ago < 60 ? `${ago}s` : `${Math.round(ago / 60)}m`;

        return (
          <div
            key={entry.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 0',
              fontSize: 11,
              color: 'var(--text-secondary)',
            }}
          >
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: entry.userColor,
                color: '#fff',
                fontSize: 8,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {entry.userName.charAt(0).toUpperCase()}
            </span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <strong style={{ fontWeight: 600, color: 'var(--text)' }}>{entry.userName}</strong>
              {' '}{entry.action}{' '}
              <em style={{ color: 'var(--text-muted)' }}>{entry.target}</em>
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>{timeStr}</span>
          </div>
        );
      })}
    </div>
  );
}
