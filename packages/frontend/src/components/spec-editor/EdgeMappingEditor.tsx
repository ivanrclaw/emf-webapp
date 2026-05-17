/**
 * @emf-webapp/frontend — EdgeMappingEditor
 *
 * Editor for edge mapping configuration: type toggle, source/target references,
 * finder expressions, and source/target mapping multi-select.
 */
import React from 'react';
import type { EdgeMapping, NodeMapping } from '../spec-diagram/types';

export interface EdgeMappingEditorProps {
  edgeMapping: EdgeMapping;
  nodeMappings: NodeMapping[];
  onUpdate: (patch: Partial<EdgeMapping>) => void;
}

export function EdgeMappingEditor({
  edgeMapping,
  nodeMappings,
  onUpdate,
}: EdgeMappingEditorProps) {
  const isRelationBased = edgeMapping.type === 'relation-based';

  const toggleMappingId = (
    field: 'sourceMappingIds' | 'targetMappingIds',
    id: string
  ) => {
    const current = edgeMapping[field];
    const next = current.includes(id)
      ? current.filter((x) => x !== id)
      : [...current, id];
    onUpdate({ [field]: next });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Type Toggle */}
      <div>
        <label style={sectionHeaderStyle}>TYPE</label>
        <div style={{ display: 'flex', gap: 0, borderRadius: 5, overflow: 'hidden', border: '1px solid var(--border)' }}>
          <button
            onClick={() => onUpdate({ type: 'relation-based' })}
            style={{
              ...toggleBtnStyle,
              background: isRelationBased ? 'var(--primary)' : 'var(--bg)',
              color: isRelationBased ? '#fff' : 'var(--text-secondary)',
            }}
            aria-pressed={isRelationBased}
          >
            Relation-based
          </button>
          <button
            onClick={() => onUpdate({ type: 'element-based' })}
            style={{
              ...toggleBtnStyle,
              background: !isRelationBased ? 'var(--primary)' : 'var(--bg)',
              color: !isRelationBased ? '#fff' : 'var(--text-secondary)',
            }}
            aria-pressed={!isRelationBased}
          >
            Element-based
          </button>
        </div>
      </div>

      {/* Relation-based fields */}
      {isRelationBased && (
        <>
          <div>
            <label style={fieldLabelStyle}>Source Reference</label>
            <input
              value={edgeMapping.sourceReference || ''}
              onChange={(e) => onUpdate({ sourceReference: e.target.value })}
              placeholder="e.g. references"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={fieldLabelStyle}>Target Finder Expression</label>
            <input
              value={edgeMapping.targetFinderExpression || ''}
              onChange={(e) => onUpdate({ targetFinderExpression: e.target.value })}
              placeholder="e.g. self.target"
              style={inputStyle}
            />
          </div>
        </>
      )}

      {/* Element-based fields */}
      {!isRelationBased && (
        <>
          <div>
            <label style={fieldLabelStyle}>Domain Class</label>
            <input
              value={edgeMapping.domainClass || ''}
              onChange={(e) => onUpdate({ domainClass: e.target.value })}
              placeholder="e.g. MyEdgeClass"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={fieldLabelStyle}>Semantic Candidates Expression</label>
            <input
              value={edgeMapping.semanticCandidatesExpression || ''}
              onChange={(e) => onUpdate({ semanticCandidatesExpression: e.target.value })}
              placeholder="e.g. self.eAllContents()"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={fieldLabelStyle}>Source Finder Expression</label>
            <input
              value={edgeMapping.sourceFinderExpression || ''}
              onChange={(e) => onUpdate({ sourceFinderExpression: e.target.value })}
              placeholder="e.g. self.source"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={fieldLabelStyle}>Target Finder Expression</label>
            <input
              value={edgeMapping.targetFinderExpression || ''}
              onChange={(e) => onUpdate({ targetFinderExpression: e.target.value })}
              placeholder="e.g. self.target"
              style={inputStyle}
            />
          </div>
        </>
      )}

      {/* Source Mappings */}
      <div>
        <label style={sectionHeaderStyle}>SOURCE MAPPINGS</label>
        <div style={checkboxListStyle}>
          {nodeMappings.length === 0 && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              No node mappings available
            </span>
          )}
          {nodeMappings.map((nm) => (
            <label key={nm.id} style={checkboxItemStyle}>
              <input
                type="checkbox"
                checked={edgeMapping.sourceMappingIds.includes(nm.id)}
                onChange={() => toggleMappingId('sourceMappingIds', nm.id)}
                style={{ marginRight: 6 }}
              />
              <span style={{ fontSize: 12 }}>
                {nm.domainClass || nm.id}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Target Mappings */}
      <div>
        <label style={sectionHeaderStyle}>TARGET MAPPINGS</label>
        <div style={checkboxListStyle}>
          {nodeMappings.length === 0 && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              No node mappings available
            </span>
          )}
          {nodeMappings.map((nm) => (
            <label key={nm.id} style={checkboxItemStyle}>
              <input
                type="checkbox"
                checked={edgeMapping.targetMappingIds.includes(nm.id)}
                onChange={() => toggleMappingId('targetMappingIds', nm.id)}
                style={{ marginRight: 6 }}
              />
              <span style={{ fontSize: 12 }}>
                {nm.domainClass || nm.id}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Precondition */}
      <div>
        <label style={fieldLabelStyle}>Precondition Expression</label>
        <input
          value={edgeMapping.preconditionExpression || ''}
          onChange={(e) => onUpdate({ preconditionExpression: e.target.value || undefined })}
          placeholder="Optional filter expression"
          style={inputStyle}
        />
      </div>
    </div>
  );
}

/* ─── Styles ───────────────────────────────────────────────────────────────── */

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-secondary)',
  display: 'block',
  marginBottom: 5,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const fieldLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  color: 'var(--text-secondary)',
  display: 'block',
  marginBottom: 3,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '5px 8px',
  borderRadius: 5,
  border: '1px solid var(--border)',
  fontSize: 12,
  fontFamily: 'inherit',
  background: 'var(--bg)',
  color: 'var(--text)',
  boxSizing: 'border-box',
};

const toggleBtnStyle: React.CSSProperties = {
  flex: 1,
  padding: '5px 8px',
  fontSize: 11,
  fontWeight: 600,
  border: 'none',
  cursor: 'pointer',
  transition: 'background 0.15s',
};

const checkboxListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 3,
  padding: '6px 8px',
  border: '1px solid var(--border)',
  borderRadius: 5,
  background: 'var(--bg)',
  maxHeight: 120,
  overflowY: 'auto',
};

const checkboxItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  cursor: 'pointer',
  fontSize: 12,
};

export default EdgeMappingEditor;
