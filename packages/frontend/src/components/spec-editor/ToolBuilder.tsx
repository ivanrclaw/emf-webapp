import React, { useState } from 'react';
import {
  ToolSection,
  Tool,
  NodeCreationTool,
  EdgeCreationTool,
  DeleteTool,
  DirectEditTool,
  NodeMapping,
  EdgeMapping,
} from '../../components/spec-diagram/types';
import { Plus, Trash2, ChevronDown, ChevronRight } from '../../components/icons';

interface ToolBuilderProps {
  toolSections: ToolSection[];
  nodeMappings: NodeMapping[];
  edgeMappings: EdgeMapping[];
  onUpdateToolSections: (sections: ToolSection[]) => void;
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function getToolTypeBadge(tool: Tool): { label: string; color: string } {
  switch (tool.type) {
    case 'nodeCreation':
    case 'containerCreation':
      return { label: 'Node', color: 'var(--color-info, #3b82f6)' };
    case 'edgeCreation':
      return { label: 'Edge', color: 'var(--color-warning, #f59e0b)' };
    case 'delete':
      return { label: 'Delete', color: 'var(--color-error, #ef4444)' };
    case 'directEdit':
      return { label: 'Edit', color: 'var(--color-success, #10b981)' };
  }
}

function getToolIconColor(tool: Tool): string {
  if ('iconColor' in tool && tool.iconColor) {
    return tool.iconColor;
  }
  return 'var(--color-text-muted, #6b7280)';
}

export function ToolBuilder({
  toolSections,
  nodeMappings,
  edgeMappings,
  onUpdateToolSections,
}: ToolBuilderProps) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const toggleSection = (sectionId: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const handleAddSection = () => {
    const newSection: ToolSection = {
      id: generateId(),
      label: 'New Section',
      tools: [],
    };
    onUpdateToolSections([...toolSections, newSection]);
  };

  const handleRemoveSection = (sectionId: string) => {
    onUpdateToolSections(toolSections.filter((s) => s.id !== sectionId));
  };

  const handleSectionLabelChange = (sectionId: string, label: string) => {
    onUpdateToolSections(
      toolSections.map((s) => (s.id === sectionId ? { ...s, label } : s))
    );
  };

  const handleAddTool = (sectionId: string, toolType: string) => {
    setOpenDropdown(null);
    let newTool: Tool;

    switch (toolType) {
      case 'nodeCreation': {
        const mapping = nodeMappings[0];
        newTool = {
          id: generateId(),
          type: 'nodeCreation',
          label: mapping ? `Create ${mapping.domainClass}` : 'Create Node',
          iconColor: '#3b82f6',
          mappingId: mapping?.id ?? '',
          createType: mapping?.domainClass ?? '',
          containmentReference: '',
        } satisfies NodeCreationTool;
        break;
      }
      case 'edgeCreation': {
        const mapping = edgeMappings[0];
        newTool = {
          id: generateId(),
          type: 'edgeCreation',
          label: mapping
            ? `Create ${mapping.sourceReference ?? mapping.domainClass ?? 'Edge'}`
            : 'Create Edge',
          iconColor: '#f59e0b',
          edgeMappingId: mapping?.id ?? '',
          referenceToSet: mapping?.sourceReference,
          createType: mapping?.domainClass,
        } satisfies EdgeCreationTool;
        break;
      }
      case 'delete': {
        newTool = {
          id: generateId(),
          type: 'delete',
          label: 'Delete Element',
          mappingIds: nodeMappings.map((m) => m.id),
        } satisfies DeleteTool;
        break;
      }
      case 'directEdit': {
        newTool = {
          id: generateId(),
          type: 'directEdit',
          label: 'Edit Label',
          mappingIds: nodeMappings.length > 0 ? [nodeMappings[0].id] : [],
          featureToSet: 'name',
          inputLabelExpression: 'aql:self.name',
        } satisfies DirectEditTool;
        break;
      }
      default:
        return;
    }

    onUpdateToolSections(
      toolSections.map((s) =>
        s.id === sectionId ? { ...s, tools: [...s.tools, newTool] } : s
      )
    );
  };

  const handleRemoveTool = (sectionId: string, toolId: string) => {
    onUpdateToolSections(
      toolSections.map((s) =>
        s.id === sectionId
          ? { ...s, tools: s.tools.filter((t) => t.id !== toolId) }
          : s
      )
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {toolSections.map((section) => {
        const isCollapsed = collapsedSections.has(section.id);
        return (
          <div
            key={section.id}
            style={{
              border: '1px solid var(--color-border, #e5e7eb)',
              borderRadius: '4px',
              overflow: 'hidden',
            }}
          >
            {/* Section header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 6px',
                background: 'var(--color-bg-subtle, #f9fafb)',
                cursor: 'pointer',
                userSelect: 'none',
              }}
              onClick={() => toggleSection(section.id)}
            >
              {isCollapsed ? (
                <ChevronRight size={14} />
              ) : (
                <ChevronDown size={14} />
              )}
              <input
                value={section.label}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) =>
                  handleSectionLabelChange(section.id, e.target.value)
                }
                style={{
                  flex: 1,
                  border: 'none',
                  background: 'transparent',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--color-text, #111827)',
                  outline: 'none',
                  padding: '0',
                  minWidth: 0,
                }}
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveSection(section.id);
                }}
                title="Remove section"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  padding: '2px',
                  borderRadius: '2px',
                  color: 'var(--color-text-muted, #6b7280)',
                }}
              >
                <Trash2 size={12} />
              </button>
            </div>

            {/* Section body */}
            {!isCollapsed && (
              <div style={{ padding: '4px 6px' }}>
                {/* Tool list */}
                {section.tools.map((tool) => {
                  const badge = getToolTypeBadge(tool);
                  const iconColor = getToolIconColor(tool);
                  return (
                    <div
                      key={tool.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '3px 4px',
                        borderRadius: '3px',
                        fontSize: '11px',
                      }}
                    >
                      {/* Colored dot */}
                      <span
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: iconColor,
                          flexShrink: 0,
                        }}
                      />
                      {/* Label */}
                      <span
                        style={{
                          flex: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          color: 'var(--color-text, #111827)',
                        }}
                      >
                        {tool.label}
                      </span>
                      {/* Type badge */}
                      <span
                        style={{
                          fontSize: '9px',
                          fontWeight: 600,
                          padding: '1px 4px',
                          borderRadius: '3px',
                          background: badge.color + '1a',
                          color: badge.color,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {badge.label}
                      </span>
                      {/* Remove button */}
                      <button
                        onClick={() => handleRemoveTool(section.id, tool.id)}
                        title="Remove tool"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: 'none',
                          background: 'none',
                          cursor: 'pointer',
                          padding: '1px',
                          borderRadius: '2px',
                          color: 'var(--color-text-muted, #6b7280)',
                          flexShrink: 0,
                        }}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}

                {/* Add Tool dropdown */}
                <div style={{ position: 'relative', marginTop: '4px' }}>
                  <button
                    onClick={() =>
                      setOpenDropdown(
                        openDropdown === section.id ? null : section.id
                      )
                    }
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                      border: '1px dashed var(--color-border, #d1d5db)',
                      background: 'none',
                      cursor: 'pointer',
                      padding: '2px 6px',
                      borderRadius: '3px',
                      fontSize: '11px',
                      color: 'var(--color-text-muted, #6b7280)',
                      width: '100%',
                    }}
                  >
                    <Plus size={11} />
                    Add Tool
                  </button>
                  {openDropdown === section.id && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        marginTop: '2px',
                        background: 'var(--color-bg, #ffffff)',
                        border: '1px solid var(--color-border, #e5e7eb)',
                        borderRadius: '4px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                        zIndex: 10,
                        minWidth: '140px',
                      }}
                    >
                      {[
                        { key: 'nodeCreation', label: 'Node Creation' },
                        { key: 'edgeCreation', label: 'Edge Creation' },
                        { key: 'delete', label: 'Delete' },
                        { key: 'directEdit', label: 'Direct Edit' },
                      ].map((option) => (
                        <button
                          key={option.key}
                          onClick={() => handleAddTool(section.id, option.key)}
                          style={{
                            display: 'block',
                            width: '100%',
                            textAlign: 'left',
                            border: 'none',
                            background: 'none',
                            cursor: 'pointer',
                            padding: '5px 10px',
                            fontSize: '11px',
                            color: 'var(--color-text, #111827)',
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.background =
                              'var(--color-bg-subtle, #f3f4f6)')
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.background = 'none')
                          }
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Add Section button */}
      <button
        onClick={handleAddSection}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '4px',
          border: '1px dashed var(--color-border, #d1d5db)',
          background: 'none',
          cursor: 'pointer',
          padding: '5px 8px',
          borderRadius: '4px',
          fontSize: '11px',
          color: 'var(--color-text-muted, #6b7280)',
          width: '100%',
        }}
      >
        <Plus size={12} />
        Add Section
      </button>
    </div>
  );
}
