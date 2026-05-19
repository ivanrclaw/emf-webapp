import React from 'react';
import { X } from 'lucide-react';
import { useIDEStore } from './useIDEStore';

export function EditorTabs() {
  const { state, setActiveTab, closeTab } = useIDEStore();
  const { project, openTabs, activeTab } = state;

  if (openTabs.length === 0) {
    return null;
  }

  const getFile = (fileId: string) => project?.files.find((f) => f.id === fileId);

  const handleMouseDown = (e: React.MouseEvent, fileId: string) => {
    // Middle-click to close
    if (e.button === 1) {
      e.preventDefault();
      closeTab(fileId);
    }
  };

  return (
    <div
      role="tablist"
      aria-label="Open files"
      style={{
        display: 'flex',
        alignItems: 'stretch',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg)',
        overflow: 'auto',
        minHeight: 35,
      }}
    >
      {openTabs.map((fileId) => {
        const file = getFile(fileId);
        if (!file) return null;
        const isActive = fileId === activeTab;

        return (
          <div
            key={fileId}
            role="tab"
            aria-selected={isActive}
            aria-label={`${file.filename}${file.isDirty ? ' (unsaved)' : ''}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => setActiveTab(fileId)}
            onMouseDown={(e) => handleMouseDown(e, fileId)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setActiveTab(fileId);
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '0 12px',
              fontSize: 12,
              cursor: 'pointer',
              borderRight: '1px solid var(--border)',
              borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
              background: isActive ? 'var(--surface)' : 'transparent',
              color: isActive ? 'var(--text)' : 'var(--text-muted)',
              whiteSpace: 'nowrap',
              minWidth: 0,
            }}
          >
            {file.isDirty && (
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'var(--text-muted)',
                  flexShrink: 0,
                }}
                aria-hidden="true"
              />
            )}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {file.filename}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeTab(fileId);
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 2,
                borderRadius: 4,
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                opacity: 0.6,
              }}
              title="Close tab"
              aria-label={`Close ${file.filename}`}
            >
              <X size={12} aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
