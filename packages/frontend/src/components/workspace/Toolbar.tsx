import React, { useState } from 'react';
import {
  Save,
  Download,
  Archive,
  Upload,
  Undo2,
  Redo2,
  CircleCheck,
  CircleAlert,
  Play,
  Settings,
  Sun,
  Moon,
} from '../icons';
import { Tooltip } from './Tooltip';

export interface ToolbarProps {
  activeTabType: string | null;
  onAction: (action: string) => void;
  dirty?: boolean;
  validationStatus?: 'valid' | 'invalid' | 'unknown';
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

interface ToolbarButton {
  action: string;
  label: string;
  icon: React.ReactNode;
  group?: number;
  shortcut?: string | null;
}

const buttonStyle: React.CSSProperties = {
  height: 26,
  padding: '0 8px',
  borderRadius: 4,
  border: 'none',
  background: 'transparent',
  color: 'var(--text)',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  cursor: 'pointer',
  fontSize: 12,
  whiteSpace: 'nowrap',
  position: 'relative',
};

const buttonHoverBg = 'var(--primary-bg)';

const separatorStyle: React.CSSProperties = {
  width: 1,
  height: 16,
  background: 'var(--border)',
  margin: '0 4px',
  flexShrink: 0,
};

const labelStyle: React.CSSProperties = {
  display: 'none',
};

// Show labels on wider screens via media query workaround with min-width container
const labelVisibleStyle: React.CSSProperties = {
  display: 'inline',
};

function getButtonsForTab(tabType: string | null): ToolbarButton[] {
  switch (tabType) {
    case 'diagram':
      return [
        { action: 'save', label: 'Save', icon: <Save size={14} />, group: 0, shortcut: 'Ctrl+S' },
        { action: 'import-ecore', label: 'Import .ecore', icon: <Upload size={14} />, group: 1, shortcut: null },
        { action: 'import-eclipse-zip', label: 'Import Eclipse ZIP', icon: <Upload size={14} />, group: 1, shortcut: null },
        { action: 'export-ecore', label: 'Export .ecore', icon: <Download size={14} />, group: 1, shortcut: null },
        { action: 'export-zip', label: 'Eclipse Project', icon: <Archive size={14} />, group: 1, shortcut: null },
        { action: 'validate', label: 'Validate', icon: <CircleCheck size={14} />, group: 2, shortcut: 'Ctrl+Shift+V' },
        { action: 'undo', label: 'Undo', icon: <Undo2 size={14} />, group: 3, shortcut: 'Ctrl+Z' },
        { action: 'redo', label: 'Redo', icon: <Redo2 size={14} />, group: 3, shortcut: 'Ctrl+Shift+Z' },
      ];
    case 'ocl':
      return [
        { action: 'save', label: 'Save', icon: <Save size={14} />, group: 0, shortcut: 'Ctrl+S' },
        { action: 'validate', label: 'Validate', icon: <CircleCheck size={14} />, group: 1, shortcut: 'Ctrl+Shift+V' },
      ];
    case 'codegen':
      return [
        { action: 'save', label: 'Save', icon: <Save size={14} />, group: 0, shortcut: 'Ctrl+S' },
        { action: 'run-generation', label: 'Run Generation', icon: <Play size={14} />, group: 1, shortcut: null },
      ];
    case 'models':
      return [
        { action: 'save', label: 'Save', icon: <Save size={14} />, group: 0, shortcut: 'Ctrl+S' },
        { action: 'export-xmi', label: 'Export XMI', icon: <Download size={14} />, group: 1, shortcut: null },
      ];
    case 'spec':
      return [
        { action: 'save', label: 'Save', icon: <Save size={14} />, group: 0, shortcut: 'Ctrl+S' },
      ];
    default:
      return [];
  }
}

function getValidationColor(status?: 'valid' | 'invalid' | 'unknown'): string {
  switch (status) {
    case 'valid':
      return '#22c55e';
    case 'invalid':
      return 'var(--danger)';
    default:
      return 'var(--text-muted)';
  }
}

export function Toolbar({ activeTabType, onAction, dirty, validationStatus, sidebarOpen, onToggleSidebar }: ToolbarProps) {
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);

  const buttons = getButtonsForTab(activeTabType);
  const hasActions = buttons.length > 0;

  const handleThemeToggle = () => {
    setDarkMode((prev) => !prev);
    onAction('toggle-theme');
  };

  // Group buttons by their group number and insert separators between groups
  const renderButtons = () => {
    if (!hasActions) return null;

    const elements: React.ReactNode[] = [];
    let lastGroup: number | undefined;

    buttons.forEach((btn, idx) => {
      if (lastGroup !== undefined && btn.group !== lastGroup) {
        elements.push(<div key={`sep-${idx}`} style={separatorStyle} aria-hidden="true" />);
      }
      lastGroup = btn.group;

      const isHovered = hoveredAction === btn.action;
      const isSave = btn.action === 'save';
      const isValidate = btn.action === 'validate';

      let iconElement = btn.icon;
      if (isValidate) {
        const color = getValidationColor(validationStatus);
        iconElement = validationStatus === 'invalid'
          ? <CircleAlert size={14} style={{ color }} />
          : <CircleCheck size={14} style={{ color }} />;
      }

      elements.push(
        <Tooltip key={btn.action} label={btn.label} shortcut={btn.shortcut}>
          <button
            type="button"
            onClick={() => onAction(btn.action)}
            onMouseEnter={() => setHoveredAction(btn.action)}
            onMouseLeave={() => setHoveredAction(null)}
            style={{
              ...buttonStyle,
              background: isHovered ? buttonHoverBg : 'transparent',
            }}
            aria-label={btn.label}
          >
            {iconElement}
            <span className="toolbar-btn-label" style={labelStyle}>
              {btn.label}
            </span>
            {isSave && dirty && (
              <span
                style={{
                  position: 'absolute',
                  top: 3,
                  right: 3,
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'var(--primary)',
                }}
                aria-label="Unsaved changes"
              />
            )}
          </button>
        </Tooltip>
      );
    });

    return elements;
  };

  return (
    <div
      role="toolbar"
      aria-label="Workspace toolbar"
      style={{
        height: 32,
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        padding: '0 8px',
        gap: 2,
        flexShrink: 0,
      }}
    >
      {/* Left side: sidebar toggle + action buttons */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flex: 1,
          minWidth: 0,
        }}
      >
        {/* Sidebar toggle — always visible */}
        {onToggleSidebar && (
          <Tooltip label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}>
            <button
              type="button"
              onClick={onToggleSidebar}
              onMouseEnter={() => setHoveredAction('sidebar')}
              onMouseLeave={() => setHoveredAction(null)}
              style={{
                ...buttonStyle,
                background: hoveredAction === 'sidebar' ? buttonHoverBg : 'transparent',
              }}
              aria-label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
            </button>
          </Tooltip>
        )}
        {onToggleSidebar && hasActions && (
          <div style={separatorStyle} aria-hidden="true" />
        )}
        {hasActions ? (
          renderButtons()
        ) : (
          <span
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--text-secondary)',
              userSelect: 'none',
            }}
          >
            EMF WebApp
          </span>
        )}
      </div>

      {/* Right side: theme toggle + settings */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Tooltip label="Toggle theme">
          <button
            type="button"
            onClick={handleThemeToggle}
            onMouseEnter={() => setHoveredAction('theme')}
            onMouseLeave={() => setHoveredAction(null)}
            style={{
              ...buttonStyle,
              background: hoveredAction === 'theme' ? buttonHoverBg : 'transparent',
            }}
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </Tooltip>
        <Tooltip label="Settings">
          <button
            type="button"
            onClick={() => onAction('settings')}
            onMouseEnter={() => setHoveredAction('settings')}
            onMouseLeave={() => setHoveredAction(null)}
            style={{
              ...buttonStyle,
              background: hoveredAction === 'settings' ? buttonHoverBg : 'transparent',
            }}
            aria-label="Settings"
          >
            <Settings size={14} />
          </button>
        </Tooltip>
      </div>

      {/* Inline style for responsive labels */}
      <style>{`
        @media (min-width: 768px) {
          .toolbar-btn-label {
            display: inline !important;
          }
        }
      `}</style>
    </div>
  );
}

export default Toolbar;
