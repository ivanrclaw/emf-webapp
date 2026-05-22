/**
 * ConditionalStylesEditor — Manage conditional style overrides.
 *
 * Each rule: predicateExpression → partial style override
 * Supports both NodeStyle and EdgeStyleSpec conditionals.
 */
import React, { useState } from 'react';
import type { ConditionalStyle, NodeStyle, EdgeStyleSpec } from '../../spec-diagram/types';
import { FormField, TextInput, SectionDivider } from '../shared/FormControls';
import { NodeStyleEditor } from './NodeStyleEditor';
import { EdgeStyleEditor } from './EdgeStyleEditor';
import { Plus, Trash2, ChevronDown, ChevronRight } from '../../icons';

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ─── Node Conditional Styles ──────────────────────────────────────────────────

interface NodeConditionalStylesEditorProps {
  conditionalStyles: ConditionalStyle<NodeStyle>[];
  onChange: (styles: ConditionalStyle<NodeStyle>[]) => void;
}

export function NodeConditionalStylesEditor({ conditionalStyles, onChange }: NodeConditionalStylesEditorProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleAdd = () => {
    const newRule: ConditionalStyle<NodeStyle> = {
      id: `cs_${uid()}`,
      predicateExpression: '',
      style: {},
    };
    onChange([...conditionalStyles, newRule]);
    setExpandedId(newRule.id);
  };

  const handleRemove = (id: string) => {
    onChange(conditionalStyles.filter((cs) => cs.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const handleUpdatePredicate = (id: string, expr: string) => {
    onChange(conditionalStyles.map((cs) => cs.id === id ? { ...cs, predicateExpression: expr } : cs));
  };

  const handleUpdateStyle = (id: string, patch: Partial<NodeStyle>) => {
    onChange(conditionalStyles.map((cs) =>
      cs.id === id ? { ...cs, style: { ...cs.style, ...patch } } : cs
    ));
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.headerLabel}>
          {conditionalStyles.length} conditional style{conditionalStyles.length !== 1 ? 's' : ''}
        </span>
        <button onClick={handleAdd} style={styles.addBtn} title="Add conditional style">
          <Plus size={12} /> Add Rule
        </button>
      </div>

      {conditionalStyles.length === 0 && (
        <div style={styles.empty}>
          No conditional styles. Add a rule to override styles based on a predicate expression.
        </div>
      )}

      {conditionalStyles.map((cs, idx) => {
        const isExpanded = expandedId === cs.id;
        return (
          <div key={cs.id} style={styles.rule}>
            <div
              style={styles.ruleHeader}
              onClick={() => setExpandedId(isExpanded ? null : cs.id)}
            >
              {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <span style={styles.ruleIndex}>#{idx + 1}</span>
              <span style={styles.rulePredicate}>
                {cs.predicateExpression || '(no predicate)'}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); handleRemove(cs.id); }}
                style={styles.removeBtn}
                title="Remove rule"
              >
                <Trash2 size={11} />
              </button>
            </div>
            {isExpanded && (
              <div style={styles.ruleBody}>
                <FormField label="Predicate Expression">
                  <TextInput
                    value={cs.predicateExpression}
                    onChange={(v) => handleUpdatePredicate(cs.id, v)}
                    placeholder="aql:self.abstract"
                    monospace
                  />
                </FormField>
                <SectionDivider label="Style Overrides" />
                <NodeStyleEditor
                  style={cs.style as NodeStyle}
                  onChange={(patch) => handleUpdateStyle(cs.id, patch)}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Edge Conditional Styles ──────────────────────────────────────────────────

interface EdgeConditionalStylesEditorProps {
  conditionalStyles: ConditionalStyle<EdgeStyleSpec>[];
  onChange: (styles: ConditionalStyle<EdgeStyleSpec>[]) => void;
}

export function EdgeConditionalStylesEditor({ conditionalStyles, onChange }: EdgeConditionalStylesEditorProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleAdd = () => {
    const newRule: ConditionalStyle<EdgeStyleSpec> = {
      id: `cs_${uid()}`,
      predicateExpression: '',
      style: {},
    };
    onChange([...conditionalStyles, newRule]);
    setExpandedId(newRule.id);
  };

  const handleRemove = (id: string) => {
    onChange(conditionalStyles.filter((cs) => cs.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const handleUpdatePredicate = (id: string, expr: string) => {
    onChange(conditionalStyles.map((cs) => cs.id === id ? { ...cs, predicateExpression: expr } : cs));
  };

  const handleUpdateStyle = (id: string, patch: Partial<EdgeStyleSpec>) => {
    onChange(conditionalStyles.map((cs) =>
      cs.id === id ? { ...cs, style: { ...cs.style, ...patch } } : cs
    ));
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.headerLabel}>
          {conditionalStyles.length} conditional style{conditionalStyles.length !== 1 ? 's' : ''}
        </span>
        <button onClick={handleAdd} style={styles.addBtn} title="Add conditional style">
          <Plus size={12} /> Add Rule
        </button>
      </div>

      {conditionalStyles.length === 0 && (
        <div style={styles.empty}>
          No conditional styles. Add a rule to override edge styles based on a predicate.
        </div>
      )}

      {conditionalStyles.map((cs, idx) => {
        const isExpanded = expandedId === cs.id;
        return (
          <div key={cs.id} style={styles.rule}>
            <div
              style={styles.ruleHeader}
              onClick={() => setExpandedId(isExpanded ? null : cs.id)}
            >
              {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <span style={styles.ruleIndex}>#{idx + 1}</span>
              <span style={styles.rulePredicate}>
                {cs.predicateExpression || '(no predicate)'}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); handleRemove(cs.id); }}
                style={styles.removeBtn}
                title="Remove rule"
              >
                <Trash2 size={11} />
              </button>
            </div>
            {isExpanded && (
              <div style={styles.ruleBody}>
                <FormField label="Predicate Expression">
                  <TextInput
                    value={cs.predicateExpression}
                    onChange={(v) => handleUpdatePredicate(cs.id, v)}
                    placeholder="aql:self.containment"
                    monospace
                  />
                </FormField>
                <SectionDivider label="Style Overrides" />
                <EdgeStyleEditor
                  style={cs.style as EdgeStyleSpec}
                  onChange={(patch) => handleUpdateStyle(cs.id, patch)}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLabel: {
    fontSize: '11px',
    color: 'var(--text-muted)',
  },
  addBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 10px',
    border: '1px dashed var(--border)',
    borderRadius: '4px',
    background: 'none',
    cursor: 'pointer',
    fontSize: '11px',
    color: 'var(--primary)',
    fontWeight: 500,
  },
  empty: {
    padding: '12px',
    fontSize: '11px',
    color: 'var(--text-muted)',
    textAlign: 'center',
    border: '1px dashed var(--border)',
    borderRadius: '6px',
  },
  rule: {
    border: '1px solid var(--border)',
    borderRadius: '6px',
    overflow: 'hidden',
  },
  ruleHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 10px',
    cursor: 'pointer',
    background: 'var(--surface)',
    fontSize: '11px',
  },
  ruleIndex: {
    fontWeight: 700,
    color: 'var(--primary)',
    fontSize: '10px',
  },
  rulePredicate: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: 'var(--text)',
    fontFamily: 'monospace',
    fontSize: '11px',
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
    flexShrink: 0,
  },
  ruleBody: {
    padding: '12px',
    borderTop: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
};
