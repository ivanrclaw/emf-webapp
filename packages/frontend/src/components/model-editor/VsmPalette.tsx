/**
 * VsmPalette — Runtime model editor palette driven exclusively by VSM ToolSections.
 * No tool defined in the ViewpointSpec = no creation capability in the editor.
 */
import { useState, useCallback } from 'react';
import {
  Plus,
  Link2,
  Trash2,
  Pencil,
  Box,
  Layers,
  ChevronRight,
  ChevronDown,
} from '../../components/icons';
import type {
  ToolSection,
  Tool,
  NodeCreationTool,
  ContainerCreationTool,
  EdgeCreationTool,
  DeleteTool,
  DirectEditTool,
} from '../spec-diagram/types';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface VsmPaletteProps {
  toolSections: ToolSection[];
  activeTool: string | null;
  onSelectTool: (toolId: string | null) => void;
  onCreateNode: (tool: NodeCreationTool | ContainerCreationTool) => void;
  connectMode: boolean;
  /** Whether something is currently selected in the diagram */
  hasSelection?: boolean;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
    padding: '8px',
    minWidth: '200px',
    maxWidth: '260px',
    height: '100%',
    overflowY: 'auto' as const,
    background: 'var(--color-bg-secondary, #1e1e2e)',
    borderRight: '1px solid var(--color-border, #2e2e3e)',
    fontSize: '12px',
    userSelect: 'none' as const,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
    textAlign: 'center' as const,
    color: 'var(--color-text-muted, #71717a)',
    fontSize: '12px',
    lineHeight: '1.5',
    gap: '8px',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 6px',
    cursor: 'pointer',
    borderRadius: '4px',
    color: 'var(--color-text-secondary, #a1a1aa)',
    fontWeight: 600,
    fontSize: '11px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.03em',
  },
  sectionHeaderHover: {
    background: 'var(--color-bg-hover, rgba(255,255,255,0.04))',
  },
  toolButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    padding: '5px 8px 5px 20px',
    border: 'none',
    borderRadius: '4px',
    background: 'transparent',
    color: 'var(--color-text-primary, #e4e4e7)',
    fontSize: '12px',
    cursor: 'pointer',
    textAlign: 'left' as const,
    transition: 'background 0.1s',
  },
  toolButtonActive: {
    background: 'var(--color-accent-bg, rgba(99,102,241,0.15))',
    color: 'var(--color-accent, #818cf8)',
  },
  toolButtonDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
  colorDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  toolIcon: {
    flexShrink: 0,
    opacity: 0.7,
  },
  toolLabel: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  connectBadge: {
    fontSize: '9px',
    padding: '1px 4px',
    borderRadius: '3px',
    background: 'var(--color-accent, #818cf8)',
    color: '#fff',
    fontWeight: 600,
  },
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getToolIcon(tool: Tool) {
  switch (tool.type) {
    case 'nodeCreation':
      return <Plus size={14} style={styles.toolIcon} />;
    case 'containerCreation':
      return <Layers size={14} style={styles.toolIcon} />;
    case 'edgeCreation':
      return <Link2 size={14} style={styles.toolIcon} />;
    case 'delete':
      return <Trash2 size={14} style={styles.toolIcon} />;
    case 'directEdit':
      return <Pencil size={14} style={styles.toolIcon} />;
    default:
      return <Box size={14} style={styles.toolIcon} />;
  }
}

function getToolColor(tool: Tool): string | undefined {
  if ('iconColor' in tool) {
    return (tool as NodeCreationTool | ContainerCreationTool | EdgeCreationTool).iconColor;
  }
  return undefined;
}

// ─── Section Component ────────────────────────────────────────────────────────

interface ToolSectionGroupProps {
  section: ToolSection;
  activeTool: string | null;
  connectMode: boolean;
  hasSelection: boolean;
  onSelectTool: (toolId: string | null) => void;
  onCreateNode: (tool: NodeCreationTool | ContainerCreationTool) => void;
}

function ToolSectionGroup({
  section,
  activeTool,
  connectMode,
  hasSelection,
  onSelectTool,
  onCreateNode,
}: ToolSectionGroupProps) {
  const [collapsed, setCollapsed] = useState(false);

  const handleToolClick = useCallback(
    (tool: Tool) => {
      switch (tool.type) {
        case 'nodeCreation':
        case 'containerCreation':
          // Immediately create the element
          onCreateNode(tool as NodeCreationTool | ContainerCreationTool);
          break;
        case 'edgeCreation':
          // Toggle connect mode
          if (activeTool === tool.id) {
            onSelectTool(null);
          } else {
            onSelectTool(tool.id);
          }
          break;
        case 'delete':
        case 'directEdit':
          // Toggle selection-dependent tools
          if (!hasSelection) return;
          if (activeTool === tool.id) {
            onSelectTool(null);
          } else {
            onSelectTool(tool.id);
          }
          break;
      }
    },
    [activeTool, hasSelection, onSelectTool, onCreateNode]
  );

  const isToolDisabled = (tool: Tool): boolean => {
    if (tool.type === 'delete' || tool.type === 'directEdit') {
      return !hasSelection;
    }
    return false;
  };

  return (
    <div>
      <div
        style={styles.sectionHeader}
        onClick={() => setCollapsed((c) => !c)}
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        aria-label={`${section.label} tool section`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setCollapsed((c) => !c);
          }
        }}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
        <span>{section.label}</span>
      </div>

      {!collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          {section.tools.map((tool) => {
            const isActive = activeTool === tool.id;
            const disabled = isToolDisabled(tool);
            const color = getToolColor(tool);

            return (
              <button
                key={tool.id}
                style={{
                  ...styles.toolButton,
                  ...(isActive ? styles.toolButtonActive : {}),
                  ...(disabled ? styles.toolButtonDisabled : {}),
                }}
                onClick={() => handleToolClick(tool)}
                disabled={disabled}
                title={tool.label}
                aria-pressed={isActive}
                aria-disabled={disabled}
              >
                {color && (
                  <span
                    style={{ ...styles.colorDot, background: color }}
                    aria-hidden="true"
                  />
                )}
                {getToolIcon(tool)}
                <span style={styles.toolLabel}>{tool.label}</span>
                {isActive && tool.type === 'edgeCreation' && connectMode && (
                  <span style={styles.connectBadge} aria-label="Connect mode active">
                    CONNECT
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function VsmPalette({
  toolSections,
  activeTool,
  onSelectTool,
  onCreateNode,
  connectMode,
  hasSelection = false,
}: VsmPaletteProps) {
  if (toolSections.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>
          <Box size={24} style={{ opacity: 0.4 }} />
          <span>No tools defined. Configure the Viewpoint Specification first.</span>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container} role="toolbar" aria-label="Model editor palette">
      {toolSections.map((section) => (
        <ToolSectionGroup
          key={section.id}
          section={section}
          activeTool={activeTool}
          connectMode={connectMode}
          hasSelection={hasSelection}
          onSelectTool={onSelectTool}
          onCreateNode={onCreateNode}
        />
      ))}
    </div>
  );
}

export default VsmPalette;
