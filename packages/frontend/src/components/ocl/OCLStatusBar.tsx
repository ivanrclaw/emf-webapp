import { useEffect, useMemo, useState } from 'react';
import { CircleCheck, CircleX, CircleAlert } from '../icons';
import type { CursorPosition, DiagnosticsMap } from './types';

interface OCLStatusBarProps {
  cursor: CursorPosition | null;
  contextClass: string;
  diagnosticsMap: DiagnosticsMap;
  selectedModelName: string | null;
  saving: boolean;
  dirty: boolean;
  lastSaved: string | null;
  validationStatus: 'valid' | 'invalid' | 'unknown';
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

export function OCLStatusBar({
  cursor,
  contextClass,
  diagnosticsMap,
  selectedModelName,
  saving,
  dirty,
  lastSaved,
  validationStatus,
}: OCLStatusBarProps) {
  // Re-render every 15s so "Saved 12s ago" stays fresh
  const [, force] = useState(0);
  useEffect(() => {
    if (!lastSaved) return;
    const t = setInterval(() => force((v) => v + 1), 15000);
    return () => clearInterval(t);
  }, [lastSaved]);

  const totals = useMemo(() => {
    let e = 0;
    let w = 0;
    let i = 0;
    for (const list of Object.values(diagnosticsMap)) {
      for (const d of list) {
        if (d.severity === 'error') e++;
        else if (d.severity === 'warning') w++;
        else i++;
      }
    }
    return { e, w, i };
  }, [diagnosticsMap]);

  const saveText = saving
    ? 'Saving…'
    : dirty
      ? '● Unsaved'
      : lastSaved
        ? `Saved ${formatTimeSince(lastSaved)}`
        : null;

  return (
    <div
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        height: 24,
        minHeight: 24,
        padding: '0 12px',
        background: 'var(--primary-dark)',
        color: 'rgba(255,255,255,0.9)',
        fontSize: 11,
        userSelect: 'none',
        flexShrink: 0,
      }}
    >
      {/* Left */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        <ValidationItem status={validationStatus} />
        <Divider />
        <Item>
          <span>OCL</span>
        </Item>
        {contextClass && (
          <>
            <Divider />
            <Item>
              <span style={{ color: 'rgba(255,255,255,0.65)' }}>self:</span>
              <span style={{ marginLeft: 4, fontFamily: "'JetBrains Mono', monospace" }}>
                {contextClass}
              </span>
            </Item>
          </>
        )}
      </div>

      <div style={{ flex: 1 }} />

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {/* Diagnostics totals */}
        <Item>
          <CircleX size={12} style={{ color: '#fca5a5' }} />
          <span style={{ marginLeft: 3 }}>{totals.e}</span>
        </Item>
        <Item style={{ marginLeft: 8 }}>
          <CircleAlert size={12} style={{ color: '#fde68a' }} />
          <span style={{ marginLeft: 3 }}>{totals.w}</span>
        </Item>

        {cursor && (
          <>
            <Divider />
            <Item>
              <span>
                Ln {cursor.line}, Col {cursor.column}
              </span>
            </Item>
          </>
        )}

        {selectedModelName && (
          <>
            <Divider />
            <Item>
              <span style={{ color: 'rgba(255,255,255,0.65)' }}>M1:</span>
              <span style={{ marginLeft: 4 }}>{selectedModelName}</span>
            </Item>
          </>
        )}

        {saveText && (
          <>
            <Divider />
            <Item style={{ color: dirty ? '#fde68a' : 'rgba(255,255,255,0.85)' }}>
              <span>{saveText}</span>
            </Item>
          </>
        )}
      </div>
    </div>
  );
}

function ValidationItem({ status }: { status: 'valid' | 'invalid' | 'unknown' }) {
  if (status === 'valid') {
    return (
      <Item style={{ color: '#86efac' }}>
        <CircleCheck size={12} />
        <span style={{ marginLeft: 4 }}>Valid</span>
      </Item>
    );
  }
  if (status === 'invalid') {
    return (
      <Item style={{ color: '#fca5a5' }}>
        <CircleX size={12} />
        <span style={{ marginLeft: 4 }}>Invalid</span>
      </Item>
    );
  }
  return (
    <Item style={{ color: 'rgba(255,255,255,0.6)' }}>
      <CircleAlert size={12} />
      <span style={{ marginLeft: 4 }}>Unchecked</span>
    </Item>
  );
}

function Item({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', ...style }}>{children}</div>
  );
}

function Divider() {
  return (
    <div
      style={{
        width: 1,
        height: 14,
        background: 'rgba(255,255,255,0.25)',
        margin: '0 8px',
      }}
    />
  );
}

export default OCLStatusBar;
