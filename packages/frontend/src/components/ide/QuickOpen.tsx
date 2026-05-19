import { useState, useEffect, useRef, useMemo } from 'react';
import { useIDEStore } from './useIDEStore';

interface QuickOpenProps {
  open: boolean;
  onClose: () => void;
}

export function QuickOpen({ open, onClose }: QuickOpenProps) {
  const { state, openFile } = useIDEStore();
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const files = state.project?.files || [];

  const filtered = useMemo(() => {
    if (!query.trim()) return files;
    const q = query.toLowerCase();
    return files.filter((f) => f.filename.toLowerCase().includes(q));
  }, [query, files]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (selectedIdx >= filtered.length) {
      setSelectedIdx(Math.max(0, filtered.length - 1));
    }
  }, [filtered.length, selectedIdx]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIdx]) {
        openFile(filtered[selectedIdx].id);
        onClose();
      }
    }
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        justifyContent: 'center',
        paddingTop: 80,
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Quick Open"
    >
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 450,
          maxHeight: 350,
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onKeyDown={handleKeyDown}
      >
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIdx(0);
            }}
            placeholder="Search files..."
            aria-label="Search files"
            style={{
              width: '100%',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              padding: '8px 12px',
              fontSize: 13,
              color: 'var(--text)',
              outline: 'none',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          />
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '4px 0' }} role="listbox">
          {filtered.length === 0 && (
            <div
              style={{
                padding: '16px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: 12,
              }}
            >
              No files found
            </div>
          )}
          {filtered.map((file, i) => (
            <div
              key={file.id}
              role="option"
              aria-selected={i === selectedIdx}
              onClick={() => {
                openFile(file.id);
                onClose();
              }}
              style={{
                padding: '8px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                background: i === selectedIdx ? 'var(--surface)' : 'transparent',
                borderLeft:
                  i === selectedIdx
                    ? '2px solid var(--accent)'
                    : '2px solid transparent',
              }}
            >
              <span style={{ fontSize: 12, color: 'var(--text)' }}>{file.filename}</span>
              {file.isDirty && (
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--accent)',
                  }}
                />
              )}
              {file.hasErrors && (
                <span style={{ fontSize: 10, color: 'var(--error, #f44336)' }}>●</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
