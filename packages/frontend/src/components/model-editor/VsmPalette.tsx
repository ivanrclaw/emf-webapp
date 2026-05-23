/**
 * @emf-webapp/frontend — VsmPalette (Sprint 4 Rewrite)
 *
 * Professional palette with:
 * - Search/filter
 * - Recent tools section
 * - Shape preview on hover (tooltip)
 * - Instance count per tool
 * - Drag-to-canvas support
 * - Collapsible sections
 */
import { useState, useCallback, useMemo } from 'react';
import {
  Plus,
  Link2,
  Trash2,
  Pencil,
  Box,
  Layers,
  ChevronRight,
  ChevronDown,
  Search,
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
  hasSelection?: boolean;
  /** Count of instances per eClass in the model */
  instanceCounts?: Record<string, number>;
  /** Callback for drag start (palette → canvas) */
  onDragStart?: (e: React.DragEvent, tool: NodeCreationTool | ContainerCreationTool) => void;
}

// ─── Shape Preview ────────────────────────────────────────────────────────────

function ShapePreview({ tool }: { tool: NodeCreationTool | ContainerCreationTool }) {
  const color = tool.iconColor || '#6366f1';
  const isContainer = tool.type === 'containerCreation';
  const size = 32;

  return (
    <div style={{
      width: size,
      height: size,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}>
      {isContainer ? (
        <div style={{
          width: size - 4,
          height: size - 8,
          borderRadius: 4,
          border: `2px solid ${color}`,
          background: `${color}15`,
          position: 'relative',
        }}>
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 8,
            background: `${color}30`,
            borderBottom: `1px solid ${color}40`,
            borderRadius: '2px 2px 0 0',
          }} />
        </div>
      ) : (
        <div style={{
          width: size - 6,
          height: size - 10,
          borderRadius: 3,
          background: `${color}25`,
          border: `2px solid ${color}`,
        }} />
      )}
    </div>
  );
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function ToolTooltip({ tool, instanceCount, visible, position }: {
  tool: Tool;
  instanceCount: number;
  visible: boolean;
  position: { x: number; y: number };
}) {
  if (!visible) return null;

  const isCreation = tool.type === 'nodeCreation' || tool.type === 'containerCreation';
  const createType = isCreation ? (tool as NodeCreationTool | ContainerCreationTool).createType : null;

  return (
    <div style={{
      position: 'fixed',
      left: position.x + 12,
      top: position.y - 10,
      zIndex: 10000,
      background: 'var(--surface, #1e1e2e)',
      border: '1px solid var(--border, #27272a)',
      borderRadius: 8,
      padding: '8px 12px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      minWidth: 140,
      maxWidth: 220,
      pointerEvents: 'none',
      animation: 'fadeIn 0.12s ease-out',
    }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text, #e4e4e7)', marginBottom: 4 }}>
        {tool.label}
      </div>
      {createType && (
        <div style={{ fontSize: 11, color: 'var(--text-muted, #71717a)', marginBottom: 4 }}>
          Creates: <span style={{ color: 'var(--primary, #818cf8)' }}>{createType}</span>
        </div>
      )}
      {tool.type === 'edgeCreation' && (
        <div style={{ fontSize: 11, color: 'var(--text-muted, #71717a)', marginBottom: 4 }}>
          Reference: <span style={{ color: 'var(--primary, #818cf8)' }}>{(tool as EdgeCreationTool).referenceToSet}</span>
        </div>
      )}
      {isCreation && (
        <div style={{ fontSize: 10, color: 'var(--text-muted, #71717a)' }}>
          Instances: {instanceCount} · Drag to canvas
        </div>
      )}
      {tool.type === 'edgeCreation' && (
        <div style={{ fontSize: 10, color: 'var(--text-muted, #71717a)' }}>
          Click, then drag source → target
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getToolIcon(tool: Tool) {
  const iconStyle = { flexShrink: 0, opacity: 0.7 };
  switch (tool.type) {
    case 'nodeCreation':
      return <Plus size={14} style={iconStyle} />;
    case 'containerCreation':
      return <Layers size={14} style={iconStyle} />;
    case 'edgeCreation':
      return <Link2 size={14} style={iconStyle} />;
    case 'delete':
      return <Trash2 size={14} style={iconStyle} />;
    case 'directEdit':
      return <Pencil size={14} style={iconStyle} />;
    default:
      return <Box size={14} style={iconStyle} />;
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
  instanceCounts: Record<string, number>;
  onSelectTool: (toolId: string | null) => void;
  onCreateNode: (tool: NodeCreationTool | ContainerCreationTool) => void;
  onDragStart?: (e: React.DragEvent, tool: NodeCreationTool | ContainerCreationTool) => void;
  onToolUsed: (toolId: string) => void;
  filter: string;
}

function ToolSectionGroup({
  section,
  activeTool,
  connectMode,
  hasSelection,
  instanceCounts,
  onSelectTool,
  onCreateNode,
  onDragStart,
  onToolUsed,
  filter,
}: ToolSectionGroupProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [hoveredTool, setHoveredTool] = useState<{ tool: Tool; pos: { x: number; y: number } } | null>(null);

  const filteredTools = useMemo(() => {
    if (!filter) return section.tools;
    const lower = filter.toLowerCase();
    return section.tools.filter((t) =>
      t.label.toLowerCase().includes(lower) ||
      ('createType' in t && (t as NodeCreationTool).createType.toLowerCase().includes(lower))
    );
  }, [section.tools, filter]);

  const handleToolClick = useCallback(
    (tool: Tool) => {
      onToolUsed(tool.id);
      switch (tool.type) {
        case 'nodeCreation':
        case 'containerCreation':
          onCreateNode(tool as NodeCreationTool | ContainerCreationTool);
          break;
        case 'edgeCreation':
          if (activeTool === tool.id) {
            onSelectTool(null);
          } else {
            onSelectTool(tool.id);
          }
          break;
        case 'delete':
        case 'directEdit':
          if (!hasSelection) return;
          if (activeTool === tool.id) {
            onSelectTool(null);
          } else {
            onSelectTool(tool.id);
          }
          break;
      }
    },
    [activeTool, hasSelection, onSelectTool, onCreateNode, onToolUsed]
  );

  const isToolDisabled = (tool: Tool): boolean => {
    if (tool.type === 'delete' || tool.type === 'directEdit') {
      return !hasSelection;
    }
    return false;
  };

  if (filteredTools.length === 0) return null;

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 6px',
          cursor: 'pointer',
          borderRadius: 4,
          color: 'var(--text-secondary, #a1a1aa)',
          fontWeight: 600,
          fontSize: 11,
          textTransform: 'uppercase' as const,
          letterSpacing: '0.03em',
        }}
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
        <span style={{ flex: 1 }}>{section.label}</span>
        <span style={{ fontSize: 10, opacity: 0.6, fontWeight: 400 }}>
          {filteredTools.length}
        </span>
      </div>

      {!collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {filteredTools.map((tool) => {
            const isActive = activeTool === tool.id;
            const disabled = isToolDisabled(tool);
            const color = getToolColor(tool);
            const isDraggable = tool.type === 'nodeCreation' || tool.type === 'containerCreation';
            const createType = 'createType' in tool ? (tool as NodeCreationTool).createType : '';
            const count = instanceCounts[createType] || 0;

            return (
              <button
                key={tool.id}
                draggable={isDraggable}
                onDragStart={(e) => {
                  if (isDraggable && onDragStart) {
                    onDragStart(e, tool as NodeCreationTool | ContainerCreationTool);
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '6px 8px 6px 16px',
                  border: 'none',
                  borderRadius: 4,
                  background: isActive
                    ? 'var(--color-accent-bg, rgba(99,102,241,0.15))'
                    : 'transparent',
                  color: isActive
                    ? 'var(--color-accent, #818cf8)'
                    : 'var(--color-text-primary, #e4e4e7)',
                  fontSize: 12,
                  cursor: disabled ? 'not-allowed' : isDraggable ? 'grab' : 'pointer',
                  textAlign: 'left' as const,
                  transition: 'background 0.1s',
                  opacity: disabled ? 0.4 : 1,
                }}
                onClick={() => handleToolClick(tool)}
                disabled={disabled}
                title={tool.label}
                aria-pressed={isActive}
                aria-disabled={disabled}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setHoveredTool({ tool, pos: { x: rect.right, y: rect.top } });
                  if (!disabled && !isActive) {
                    e.currentTarget.style.background = 'var(--color-bg-hover, rgba(255,255,255,0.04))';
                  }
                }}
                onMouseLeave={(e) => {
                  setHoveredTool(null);
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                {color && (
                  <span
                    style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }}
                    aria-hidden="true"
                  />
                )}
                {getToolIcon(tool)}
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {tool.label}
                </span>
                {isDraggable && count > 0 && (
                  <span style={{
                    fontSize: 10,
                    padding: '0 4px',
                    borderRadius: 3,
                    background: 'var(--border, #27272a)',
                    color: 'var(--text-muted, #71717a)',
                    fontWeight: 500,
                    minWidth: 16,
                    textAlign: 'center',
                  }}>
                    {count}
                  </span>
                )}
                {isActive && tool.type === 'edgeCreation' && connectMode && (
                  <span style={{
                    fontSize: 9,
                    padding: '1px 4px',
                    borderRadius: 3,
                    background: 'var(--color-accent, #818cf8)',
                    color: '#fff',
                    fontWeight: 600,
                  }}>
                    CONNECT
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Tooltip */}
      {hoveredTool && (
        <ToolTooltip
          tool={hoveredTool.tool}
          instanceCount={instanceCounts[
            'createType' in hoveredTool.tool
              ? (hoveredTool.tool as NodeCreationTool).createType
              : ''
          ] || 0}
          visible={true}
          position={hoveredTool.pos}
        />
      )}
    </div>
  );
}

// ─── Recent Tools ─────────────────────────────────────────────────────────────

function RecentToolsSection({ recentToolIds, allTools, activeTool, onSelectTool, onCreateNode, onDragStart, onToolUsed }: {
  recentToolIds: string[];
  allTools: Tool[];
  activeTool: string | null;
  onSelectTool: (toolId: string | null) => void;
  onCreateNode: (tool: NodeCreationTool | ContainerCreationTool) => void;
  onDragStart?: (e: React.DragEvent, tool: NodeCreationTool | ContainerCreationTool) => void;
  onToolUsed: (toolId: string) => void;
}) {
  const recentTools = useMemo(() => {
    return recentToolIds
      .map((id) => allTools.find((t) => t.id === id))
      .filter(Boolean) as Tool[];
  }, [recentToolIds, allTools]);

  if (recentTools.length === 0) return null;

  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 6px',
        color: 'var(--text-muted, #71717a)',
        fontWeight: 600,
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}>
        <span>⏱ Recent</span>
      </div>
      <div style={{ display: 'flex', gap: 4, padding: '2px 6px', flexWrap: 'wrap' }}>
        {recentTools.map((tool) => {
          const color = getToolColor(tool);
          const isDraggable = tool.type === 'nodeCreation' || tool.type === 'containerCreation';
          return (
            <button
              key={tool.id}
              draggable={isDraggable}
              onDragStart={(e) => {
                if (isDraggable && onDragStart) {
                  onDragStart(e, tool as NodeCreationTool | ContainerCreationTool);
                }
              }}
              onClick={() => {
                onToolUsed(tool.id);
                if (tool.type === 'nodeCreation' || tool.type === 'containerCreation') {
                  onCreateNode(tool as NodeCreationTool | ContainerCreationTool);
                } else if (tool.type === 'edgeCreation') {
                  onSelectTool(activeTool === tool.id ? null : tool.id);
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 8px',
                border: '1px solid var(--border, #27272a)',
                borderRadius: 4,
                background: activeTool === tool.id
                  ? 'var(--color-accent-bg, rgba(99,102,241,0.15))'
                  : 'var(--surface, #1e1e2e)',
                color: 'var(--text, #e4e4e7)',
                fontSize: 11,
                cursor: isDraggable ? 'grab' : 'pointer',
                transition: 'background 0.1s, border-color 0.1s',
              }}
              title={tool.label}
            >
              {color && (
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
              )}
              <span style={{ maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {tool.label}
              </span>
            </button>
          );
        })}
      </div>
      <div style={{ height: 1, background: 'var(--border, #27272a)', margin: '6px 8px 2px' }} />
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
  instanceCounts = {},
  onDragStart,
}: VsmPaletteProps) {
  const [filter, setFilter] = useState('');
  const [recentToolIds, setRecentToolIds] = useState<string[]>([]);

  const allTools = useMemo(() => {
    return toolSections.flatMap((s) => s.tools);
  }, [toolSections]);

  const handleToolUsed = useCallback((toolId: string) => {
    setRecentToolIds((prev) => {
      const filtered = prev.filter((id) => id !== toolId);
      return [toolId, ...filtered].slice(0, 3);
    });
  }, []);

  if (toolSections.length === 0) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '24px 16px', textAlign: 'center',
        color: 'var(--text-muted, #71717a)', fontSize: 12, lineHeight: 1.5, gap: 8,
        height: '100%',
      }}>
        <Box size={24} style={{ opacity: 0.4 }} />
        <span>No tools defined. Configure the Viewpoint Specification first.</span>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        padding: '8px',
        height: '100%',
        overflowY: 'auto',
        fontSize: 12,
        userSelect: 'none',
      }}
      role="toolbar"
      aria-label="Model editor palette"
    >
      {/* Search */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 8px',
        background: 'var(--bg, #0f0f14)',
        border: '1px solid var(--border, #27272a)',
        borderRadius: 6,
        marginBottom: 6,
      }}>
        <Search size={13} style={{ opacity: 0.5, flexShrink: 0 }} />
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter tools..."
          style={{
            flex: 1,
            border: 'none',
            background: 'transparent',
            color: 'var(--text, #e4e4e7)',
            fontSize: 11,
            outline: 'none',
            padding: '2px 0',
            fontFamily: 'inherit',
          }}
        />
        {filter && (
          <button
            onClick={() => setFilter('')}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--text-muted, #71717a)',
              cursor: 'pointer',
              fontSize: 12,
              padding: 0,
              lineHeight: 1,
            }}
            aria-label="Clear filter"
          >
            ×
          </button>
        )}
      </div>

      {/* Recent */}
      {!filter && (
        <RecentToolsSection
          recentToolIds={recentToolIds}
          allTools={allTools}
          activeTool={activeTool}
          onSelectTool={onSelectTool}
          onCreateNode={onCreateNode}
          onDragStart={onDragStart}
          onToolUsed={handleToolUsed}
        />
      )}

      {/* Tool Sections */}
      {toolSections.map((section) => (
        <ToolSectionGroup
          key={section.id}
          section={section}
          activeTool={activeTool}
          connectMode={connectMode}
          hasSelection={hasSelection}
          instanceCounts={instanceCounts}
          onSelectTool={onSelectTool}
          onCreateNode={onCreateNode}
          onDragStart={onDragStart}
          onToolUsed={handleToolUsed}
          filter={filter}
        />
      ))}

      {/* Drag hint */}
      {!filter && (
        <div style={{
          marginTop: 'auto',
          padding: '8px 6px',
          fontSize: 10,
          color: 'var(--text-muted, #71717a)',
          textAlign: 'center',
          lineHeight: 1.4,
          borderTop: '1px solid var(--border, #27272a)',
        }}>
          Drag tools to canvas · Click to create at center
        </div>
      )}
    </div>
  );
}

export default VsmPalette;
