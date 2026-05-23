import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, Command } from '../icons';

interface PaletteCommand {
  id: string;
  label: string;
  shortcut?: string;
  category?: 'edit' | 'view' | 'file';
}

const COMMANDS: PaletteCommand[] = [
  { id: 'new-constraint', label: 'New Constraint', shortcut: 'Ctrl+Alt+N', category: 'edit' },
  { id: 'save', label: 'Save', shortcut: 'Ctrl+S', category: 'file' },
  { id: 'format-expression', label: 'Format Expression', shortcut: 'Shift+Alt+F', category: 'edit' },
  { id: 'validate-current', label: 'Validate Current', category: 'edit' },
  { id: 'validate-all', label: 'Validate All', shortcut: 'Ctrl+Shift+B', category: 'edit' },
  { id: 'go-to-line', label: 'Go to Line...', shortcut: 'Ctrl+G', category: 'edit' },
  { id: 'toggle-problems', label: 'Toggle Problems Panel', shortcut: 'Ctrl+Shift+M', category: 'view' },
  { id: 'toggle-inspector', label: 'Toggle Inspector', shortcut: 'Ctrl+Shift+I', category: 'view' },
  { id: 'toggle-constraint-browser', label: 'Toggle Constraint Browser', shortcut: 'Ctrl+B', category: 'view' },
  { id: 'export-ocl', label: 'Export as .ocl file', category: 'file' },
  { id: 'import-ocl', label: 'Import .ocl file', category: 'file' },
];

export interface OCLCommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onExecute: (commandId: string) => void;
}

export function OCLCommandPalette({ open, onClose, onExecute }: OCLCommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = COMMANDS.filter((cmd) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      cmd.label.toLowerCase().includes(q) ||
      (cmd.category && cmd.category.toLowerCase().includes(q))
    );
  });

  // Reset state when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      // Focus input on next frame to ensure DOM is ready
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [open]);

  // Keep active index in bounds
  useEffect(() => {
    if (activeIndex >= filtered.length) {
      setActiveIndex(Math.max(0, filtered.length - 1));
    }
  }, [filtered.length, activeIndex]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.children[activeIndex] as HTMLElement | undefined;
    active?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const execute = useCallback(
    (id: string) => {
      onExecute(id);
      onClose();
    },
    [onExecute, onClose],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex((i) => (i + 1) % filtered.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length);
          break;
        case 'Enter':
          e.preventDefault();
          if (filtered[activeIndex]) {
            execute(filtered[activeIndex].id);
          }
          break;
      }
    },
    [filtered, activeIndex, onClose, execute],
  );

  // Click outside to close
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label="Command palette"
      aria-modal="true"
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 80,
        background: 'rgba(0, 0, 0, 0.45)',
        transition: 'opacity 120ms',
      }}
    >
      <div
        ref={containerRef}
        onKeyDown={handleKeyDown}
        style={{
          width: 480,
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: 'min(420px, 60vh)',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          boxShadow: '0 16px 48px rgba(0,0,0,0.35)',
          overflow: 'hidden',
        }}
      >
        {/* Search input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 14px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            placeholder="Type a command…"
            autoFocus
            aria-label="Search commands"
            aria-activedescendant={
              filtered[activeIndex] ? `cmd-${filtered[activeIndex].id}` : undefined
            }
            aria-controls="command-list"
            role="combobox"
            aria-expanded="true"
            aria-autocomplete="list"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text)',
              fontSize: 13,
              fontFamily: 'inherit',
            }}
          />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              color: 'var(--text-muted)',
              fontSize: 11,
              flexShrink: 0,
            }}
          >
            <Command size={11} />
            <span>K</span>
          </div>
        </div>

        {/* Command list */}
        <div
          id="command-list"
          ref={listRef}
          role="listbox"
          aria-label="Commands"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '4px 0',
          }}
        >
          {filtered.length === 0 && (
            <div
              style={{
                padding: '16px 14px',
                color: 'var(--text-muted)',
                fontSize: 12,
                textAlign: 'center',
              }}
            >
              No commands found
            </div>
          )}
          {filtered.map((cmd, idx) => (
            <CommandItem
              key={cmd.id}
              command={cmd}
              active={idx === activeIndex}
              onSelect={() => execute(cmd.id)}
              onHover={() => setActiveIndex(idx)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface CommandItemProps {
  command: PaletteCommand;
  active: boolean;
  onSelect: () => void;
  onHover: () => void;
}

function CommandItem({ command, active, onSelect, onHover }: CommandItemProps) {
  return (
    <div
      id={`cmd-${command.id}`}
      role="option"
      aria-selected={active}
      onClick={onSelect}
      onMouseEnter={onHover}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '7px 14px',
        margin: '0 4px',
        borderRadius: 4,
        cursor: 'pointer',
        background: active ? 'var(--primary-bg)' : 'transparent',
        transition: 'background 120ms',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {command.category && (
          <span
            style={{
              fontSize: 10,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              width: 28,
            }}
          >
            {command.category === 'edit' ? 'Edit' : command.category === 'view' ? 'View' : 'File'}
          </span>
        )}
        <span
          style={{
            fontSize: 13,
            color: active ? 'var(--text)' : 'var(--text-secondary)',
            transition: 'color 120ms',
          }}
        >
          {command.label}
        </span>
      </div>
      {command.shortcut && (
        <span
          style={{
            fontSize: 11,
            fontFamily: "'JetBrains Mono', monospace",
            color: 'var(--text-muted)',
            background: 'var(--bg)',
            padding: '2px 6px',
            borderRadius: 4,
            border: '1px solid var(--border)',
          }}
        >
          {command.shortcut}
        </span>
      )}
    </div>
  );
}

export default OCLCommandPalette;
