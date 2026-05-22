/**
 * ToolMappingEditor — Shows tools associated with a specific mapping.
 * Allows viewing and managing creation/delete/edit tools for a node or edge mapping.
 */
import React from 'react';
import type {
  ToolSection,
  Tool,
  NodeCreationTool,
  EdgeCreationTool,
  DeleteTool,
  DirectEditTool,
  NodeMapping,
  EdgeMapping,
} from '../../spec-diagram/types';
import { FormField, TextInput, Select, SectionDivider } from '../shared/FormControls';
import { Wrench, Plus, Trash2 } from '../../icons';

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

interface ToolMappingEditorProps {
  mappingId: string;
  mappingType: 'node' | 'container' | 'edge';
  domainClass: string;
  toolSections: ToolSection[];
  onUpdateToolSections: (sections: ToolSection[]) => void;
}

export function ToolMappingEditor({
  mappingId,
  mappingType,
  domainClass,
  toolSections,
  onUpdateToolSections,
}: ToolMappingEditorProps) {
  // Find tools that reference this mapping
  const relatedTools: { sectionId: string; sectionLabel: string; tool: Tool }[] = [];
  for (const section of toolSections) {
    for (const tool of section.tools) {
      const isRelated = isToolRelatedToMapping(tool, mappingId);
      if (isRelated) {
        relatedTools.push({ sectionId: section.id, sectionLabel: section.label, tool });
      }
    }
  }

  const handleAddCreationTool = () => {
    // Add to first section, or create one
    let sections = [...toolSections];
    if (sections.length === 0) {
      sections = [{ id: uid(), label: 'Tools', tools: [] }];
    }

    const newTool: Tool = mappingType === 'edge'
      ? {
          id: uid(),
          type: 'edgeCreation',
          label: `Create ${domainClass}`,
          iconColor: '#f59e0b',
          edgeMappingId: mappingId,
          referenceToSet: domainClass,
        } as EdgeCreationTool
      : {
          id: uid(),
          type: 'nodeCreation',
          label: `Create ${domainClass}`,
          iconColor: '#3b82f6',
          mappingId,
          createType: domainClass,
          containmentReference: '',
        } as NodeCreationTool;

    sections = sections.map((s, i) =>
      i === 0 ? { ...s, tools: [...s.tools, newTool] } : s
    );
    onUpdateToolSections(sections);
  };

  const handleAddDeleteTool = () => {
    let sections = [...toolSections];
    if (sections.length === 0) {
      sections = [{ id: uid(), label: 'Tools', tools: [] }];
    }

    const newTool: DeleteTool = {
      id: uid(),
      type: 'delete',
      label: `Delete ${domainClass}`,
      mappingIds: [mappingId],
    };

    sections = sections.map((s, i) =>
      i === 0 ? { ...s, tools: [...s.tools, newTool] } : s
    );
    onUpdateToolSections(sections);
  };

  const handleAddEditTool = () => {
    let sections = [...toolSections];
    if (sections.length === 0) {
      sections = [{ id: uid(), label: 'Tools', tools: [] }];
    }

    const newTool: DirectEditTool = {
      id: uid(),
      type: 'directEdit',
      label: `Edit ${domainClass}`,
      mappingIds: [mappingId],
      featureToSet: 'name',
      inputLabelExpression: 'aql:self.name',
    };

    sections = sections.map((s, i) =>
      i === 0 ? { ...s, tools: [...s.tools, newTool] } : s
    );
    onUpdateToolSections(sections);
  };

  const handleRemoveTool = (toolId: string) => {
    const sections = toolSections.map((s) => ({
      ...s,
      tools: s.tools.filter((t) => t.id !== toolId),
    }));
    onUpdateToolSections(sections);
  };

  const handleUpdateTool = (toolId: string, patch: Record<string, any>) => {
    const sections = toolSections.map((s) => ({
      ...s,
      tools: s.tools.map((t) => (t.id === toolId ? { ...t, ...patch } as Tool : t)),
    }));
    onUpdateToolSections(sections);
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <Wrench size={12} style={{ color: 'var(--text-muted)' }} />
        <span style={styles.headerLabel}>Tools for {domainClass}</span>
      </div>

      {relatedTools.length === 0 && (
        <div style={styles.empty}>
          No tools configured for this mapping.
        </div>
      )}

      {relatedTools.map(({ sectionLabel, tool }) => (
        <div key={tool.id} style={styles.toolCard}>
          <div style={styles.toolHeader}>
            <span style={{ ...styles.toolDot, background: getToolColor(tool) }} />
            <span style={styles.toolType}>{getToolTypeLabel(tool)}</span>
            <span style={{ flex: 1 }} />
            <button
              onClick={() => handleRemoveTool(tool.id)}
              style={styles.removeBtn}
              title="Remove tool"
            >
              <Trash2 size={11} />
            </button>
          </div>
          <div style={styles.toolBody}>
            <FormField label="Label">
              <TextInput
                value={tool.label}
                onChange={(v) => handleUpdateTool(tool.id, { label: v })}
              />
            </FormField>
            {'preconditionExpression' in tool && (
              <FormField label="Precondition">
                <TextInput
                  value={(tool as any).preconditionExpression || ''}
                  onChange={(v) => handleUpdateTool(tool.id, { preconditionExpression: v || undefined } as any)}
                  placeholder="(optional)"
                  monospace
                />
              </FormField>
            )}
            {tool.type === 'nodeCreation' && (
              <FormField label="Containment Reference">
                <TextInput
                  value={(tool as NodeCreationTool).containmentReference}
                  onChange={(v) => handleUpdateTool(tool.id, { containmentReference: v } as any)}
                  placeholder="eClassifiers"
                />
              </FormField>
            )}
            {tool.type === 'directEdit' && (
              <FormField label="Feature to Set">
                <TextInput
                  value={(tool as DirectEditTool).featureToSet}
                  onChange={(v) => handleUpdateTool(tool.id, { featureToSet: v } as any)}
                  placeholder="name"
                />
              </FormField>
            )}
          </div>
        </div>
      ))}

      {/* Add tool buttons */}
      <SectionDivider label="Add Tool" />
      <div style={styles.addRow}>
        <button onClick={handleAddCreationTool} style={styles.addBtn}>
          <Plus size={11} /> Creation
        </button>
        <button onClick={handleAddDeleteTool} style={styles.addBtn}>
          <Plus size={11} /> Delete
        </button>
        {mappingType !== 'edge' && (
          <button onClick={handleAddEditTool} style={styles.addBtn}>
            <Plus size={11} /> Edit
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isToolRelatedToMapping(tool: Tool, mappingId: string): boolean {
  switch (tool.type) {
    case 'nodeCreation':
    case 'containerCreation':
      return tool.mappingId === mappingId;
    case 'edgeCreation':
      return tool.edgeMappingId === mappingId;
    case 'delete':
      return tool.mappingIds.includes(mappingId);
    case 'directEdit':
      return tool.mappingIds.includes(mappingId);
  }
}

function getToolColor(tool: Tool): string {
  if ('iconColor' in tool && tool.iconColor) return tool.iconColor;
  switch (tool.type) {
    case 'nodeCreation':
    case 'containerCreation':
      return '#3b82f6';
    case 'edgeCreation':
      return '#f59e0b';
    case 'delete':
      return '#ef4444';
    case 'directEdit':
      return '#10b981';
  }
}

function getToolTypeLabel(tool: Tool): string {
  switch (tool.type) {
    case 'nodeCreation': return 'Node Creation';
    case 'containerCreation': return 'Container Creation';
    case 'edgeCreation': return 'Edge Creation';
    case 'delete': return 'Delete';
    case 'directEdit': return 'Direct Edit';
  }
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  headerLabel: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
  },
  empty: {
    padding: '12px',
    fontSize: '11px',
    color: 'var(--text-muted)',
    textAlign: 'center',
    border: '1px dashed var(--border)',
    borderRadius: '6px',
  },
  toolCard: {
    border: '1px solid var(--border)',
    borderRadius: '6px',
    overflow: 'hidden',
  },
  toolHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 10px',
    background: 'var(--surface)',
    borderBottom: '1px solid var(--border)',
    fontSize: '11px',
  },
  toolDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  toolType: {
    fontWeight: 600,
    color: 'var(--text)',
  },
  toolBody: {
    padding: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  removeBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '20px',
    height: '20px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    color: 'var(--error, #ef4444)',
    borderRadius: '3px',
    padding: 0,
  },
  addRow: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
  },
  addBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '5px 10px',
    border: '1px dashed var(--border)',
    borderRadius: '4px',
    background: 'none',
    cursor: 'pointer',
    fontSize: '11px',
    color: 'var(--text-muted)',
    fontWeight: 500,
    transition: 'border-color 0.15s, color 0.15s',
  },
};

export default ToolMappingEditor;
