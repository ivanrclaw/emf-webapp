/**
 * @emf-webapp/frontend — OfflineBanner
 *
 * Shows a subtle banner when the collaboration WebSocket is disconnected.
 * Indicates that edits are being saved locally (IndexedDB) and will sync on reconnect.
 */
import React from 'react';

interface OfflineBannerProps {
  connected: boolean;
}

export function OfflineBanner({ connected }: OfflineBannerProps) {
  if (connected) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 14px',
        background: 'rgba(245, 158, 11, 0.95)',
        color: '#fff',
        fontSize: 12,
        fontWeight: 600,
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        backdropFilter: 'blur(4px)',
        pointerEvents: 'none',
        animation: 'fadeIn 0.3s ease',
      }}
    >
      {/* Offline icon */}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
        <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <line x1="12" y1="20" x2="12.01" y2="20" />
      </svg>
      <span>Offline — changes saved locally, will sync on reconnect</span>
    </div>
  );
}
