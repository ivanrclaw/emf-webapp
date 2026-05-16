import React, { useCallback, useState } from 'react';
import {
  LayoutGrid,
  Workflow,
  CircleAlert,
  Code,
  Layers,
  Palette,
  Info,
  X,
} from '../icons';

export interface TabItem {
  id: string;
  type: string;
  title: string;
  dirty?: boolean;
  closable?: boolean;
}

interface TabBarProps {
  tabs: TabItem[];
  activeTabId: string | null;
  onActivate: (tabId: string) => void;
  onClose: (tabId: string) => void;
}

const TAB_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  welcome: LayoutGrid,
  diagram: Workflow,
  ocl: CircleAlert,
  codegen: Code,
  models: Layers,
  spec: Palette,
  'project-info': Info,
};

export const TabBar: React.FC<TabBarProps> = ({ tabs, activeTabId, onActivate, onClose }) => {
  const [hoveredTabId, setHoveredTabId] = useState<string | null>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, tabId: string, closable?: boolean) => {
      if (e.button === 1) {
        e.preventDefault();
        if (closable !== false) {
          onClose(tabId);
        }
      }
    },
    [onClose]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, tabId: string, index: number) => {
      let targetIndex = -1;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        targetIndex = (index + 1) % tabs.length;
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        targetIndex = (index - 1 + tabs.length) % tabs.length;
      } else if (e.key === 'Home') {
        e.preventDefault();
        targetIndex = 0;
      } else if (e.key === 'End') {
        e.preventDefault();
        targetIndex = tabs.length - 1;
      }
      if (targetIndex >= 0) {
        onActivate(tabs[targetIndex].id);
        // Move focus to the new tab
        const container = e.currentTarget.parentElement;
        const targetEl = container?.children[targetIndex + 1] as HTMLElement; // +1 for <style>
        targetEl?.focus();
      }
    },
    [tabs, onActivate]
  );

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        height: 36,
        minHeight: 36,
        maxHeight: 36,
        overflowX: 'auto',
        overflowY: 'hidden',
        backgroundColor: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        scrollbarWidth: 'none',
      }}
      role="tablist"
    >
      <style>{`
        .emf-tabbar::-webkit-scrollbar { display: none; }
        .emf-tab-item:hover { background-color: var(--surface-hover) !important; }
        .emf-tab-item:hover .emf-tab-close { opacity: 1 !important; }
        .emf-tab-close:hover { background-color: var(--border) !important; color: var(--text) !important; }
      `}</style>
      {tabs.map((tab, index) => {
        const isActive = tab.id === activeTabId;
        const isHovered = tab.id === hoveredTabId;
        const Icon = TAB_ICONS[tab.type];
        const showClose = (isActive || isHovered) && tab.closable !== false;

        return (
          <div
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onActivate(tab.id)}
            onMouseDown={(e) => handleMouseDown(e, tab.id, tab.closable)}
            onMouseEnter={() => setHoveredTabId(tab.id)}
            onMouseLeave={() => setHoveredTabId(null)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onActivate(tab.id);
              } else {
                handleKeyDown(e, tab.id, index);
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '0 12px',
              height: '100%',
              minWidth: 120,
              maxWidth: 200,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              userSelect: 'none',
              fontSize: 13,
              color: isActive ? 'var(--text)' : 'var(--text-secondary)',
              backgroundColor: isActive ? 'var(--surface-hover)' : 'var(--surface)',
              borderBottom: isActive ? '2px solid var(--primary)' : '2px solid transparent',
              borderRight: isActive ? 'none' : '1px solid var(--border)',
              transition: 'background-color 0.15s, color 0.15s',
              position: 'relative',
            }}
            className="emf-tab-item"
          >
            {Icon && <Icon size={14} />}
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                flex: 1,
                minWidth: 0,
              }}
            >
              {tab.dirty && (
                <span
                  style={{
                    color: 'var(--primary)',
                    marginRight: 4,
                    fontSize: 10,
                    lineHeight: 1,
                  }}
                  aria-label="unsaved changes"
                >
                  ●
                </span>
              )}
              {tab.title}
            </span>
            {tab.closable !== false && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(tab.id);
                }}
                aria-label={`Close ${tab.title}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 16,
                  height: 16,
                  border: 'none',
                  background: 'transparent',
                  borderRadius: 3,
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  padding: 0,
                  marginLeft: 4,
                  opacity: showClose ? 1 : 0,
                  transition: 'opacity 0.15s, background-color 0.15s',
                  flexShrink: 0,
                }}
                className="emf-tab-close"
              >
                <X size={12} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default TabBar;
