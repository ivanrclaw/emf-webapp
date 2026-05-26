import React, { useMemo } from 'react';
import {
  CircleCheck,
  CircleX,
  CircleAlert,
  Users,
  Wifi,
  WifiOff,
} from '../icons';

interface StatusBarProps {
  validationStatus: 'valid' | 'invalid' | 'unknown';
  collaborators: number;
  connected: boolean;
  lastSaved: string | null;
  dirty: boolean;
  zoom?: number;
  nodeCount?: number;
  edgeCount?: number;
}

function formatTimeSince(isoTimestamp: string): string {
  const now = Date.now();
  const saved = new Date(isoTimestamp).getTime();
  const diffMs = now - saved;

  if (diffMs < 0) return 'just now';

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

const dividerStyle: React.CSSProperties = {
  width: 1,
  height: 14,
  backgroundColor: 'rgba(255, 255, 255, 0.25)',
  margin: '0 8px',
  flexShrink: 0,
};

const sectionItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
};

export const StatusBar: React.FC<StatusBarProps> = ({
  validationStatus,
  collaborators,
  connected,
  lastSaved,
  dirty,
  zoom,
  nodeCount,
  edgeCount,
}) => {
  const saveStatusText = useMemo(() => {
    if (dirty) return '● Unsaved changes';
    if (lastSaved) return `Saved ${formatTimeSince(lastSaved)}`;
    return null;
  }, [dirty, lastSaved]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 24,
        minHeight: 24,
        maxHeight: 24,
        padding: '0 12px',
        backgroundColor: 'var(--primary-dark)',
        color: 'rgba(255, 255, 255, 0.9)',
        fontSize: 11,
        userSelect: 'none',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
      role="status"
    >
      {/* Left section */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {/* Validation badge */}
        <div
          style={{
            ...sectionItemStyle,
            color:
              validationStatus === 'valid'
                ? '#4ade80'
                : validationStatus === 'invalid'
                  ? '#f87171'
                  : 'rgba(255, 255, 255, 0.6)',
          }}
        >
          {validationStatus === 'valid' && <CircleCheck size={12} />}
          {validationStatus === 'invalid' && <CircleX size={12} />}
          {validationStatus === 'unknown' && <CircleAlert size={12} />}
          <span>
            {validationStatus === 'valid' && 'Valid'}
            {validationStatus === 'invalid' && 'Invalid'}
            {validationStatus === 'unknown' && '?'}
          </span>
        </div>

        {/* Divider */}
        <div style={dividerStyle} />

        {/* Collaborators */}
        <div style={sectionItemStyle}>
          <Users size={12} />
          <span>{collaborators}</span>
        </div>

        {/* Divider */}
        <div style={dividerStyle} />

        {/* Connection status */}
        <div
          style={{
            ...sectionItemStyle,
            color: connected ? 'rgba(255, 255, 255, 0.9)' : '#f87171',
          }}
        >
          {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
        </div>
      </div>

      {/* Center section (reserved) */}
      <div />

      {/* Right section */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {/* Save status */}
        {saveStatusText && (
          <div
            style={{
              ...sectionItemStyle,
              color: dirty ? '#fbbf24' : 'rgba(255, 255, 255, 0.7)',
            }}
          >
            <span>{saveStatusText}</span>
          </div>
        )}

        {/* Node/Edge count (shown when in diagram context) */}
        {nodeCount !== undefined && edgeCount !== undefined && (
          <>
            <div style={dividerStyle} />
            <div style={sectionItemStyle}>
              <span>
                {nodeCount} nodes, {edgeCount} edges
              </span>
            </div>
          </>
        )}

        {/* Zoom */}
        {zoom !== undefined && (
          <>
            <div style={dividerStyle} />
            <div style={sectionItemStyle}>
              <span>{Math.round(zoom)}%</span>
            </div>
          </>
        )}

        {/* Version */}
        <div style={dividerStyle} />
        <div style={{ ...sectionItemStyle, color: 'rgba(255, 255, 255, 0.5)' }}>
          <span>v0.5.8</span>
        </div>
      </div>
    </div>
  );
};

export default StatusBar;
