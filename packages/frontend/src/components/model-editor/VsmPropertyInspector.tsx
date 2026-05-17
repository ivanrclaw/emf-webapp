/**
 * @emf-webapp/frontend — VsmPropertyInspector
 *
 * Property inspector for the runtime model editor. Shows editable attributes
 * of the selected M1 object. Respects DirectEditTool constraints.
 */
import React, { useCallback } from 'react';
import type { NodeMapping, DirectEditTool } from '../spec-diagram/types';
import { canDirectEdit, getDirectEditTool } from '../../lib/vsm-runtime';
import type { Tool } from '../spec-diagram/types';

interface VsmPropertyInspectorProps {
  /** The selected object's semantic data */
  semanticData: Record<string, unknown> | null;
  /** The mapping for the selected object */
  mapping: NodeMapping | null;
  /** All tools from active layers (for checking direct edit capability) */
  tools: Tool[];
  /** Callback to update an attribute */
  onUpdateAttribute: (key: string, value: unknown) => void;
  /** Callback to update the object's name/label via direct edit */
  onDirectEdit: (value: string) => void;
}

export function VsmPropertyInspector({
  semanticData,
  mapping,
  tools,
  onUpdateAttribute,
  onDirectEdit,
}: VsmPropertyInspectorProps) {
  if (!semanticData || !mapping) {
    return (
      <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>
        Select an element to view its properties
      </div>
    );
  }

  const directEditTool = getDirectEditTool(mapping.id, tools);
  const hasDirectEdit = !!directEditTool;

  return (
    <div style={{ padding: 12 }}>
      {/* Header */}
      <div style={{
        fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8,
      }}>
        {mapping.domainClass}
      </div>

      {/* Attributes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Object.entries(semanticData).map(([key, value]) => {
          // Skip internal fields
          if (key.startsWith('_') || key === 'eClass') return null;

          const isDirectEditField = directEditTool?.featureToSet === key;

          return (
            <div key={key}>
              <label style={{
                display: 'block', fontSize: 11, color: 'var(--text-secondary)',
                marginBottom: 2,
              }}>
                {key}
                {isDirectEditField && (
                  <span style={{ color: 'var(--primary)', marginLeft: 4, fontSize: 9 }}>●</span>
                )}
              </label>
              {typeof value === 'boolean' ? (
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(e) => onUpdateAttribute(key, e.target.checked)}
                  style={{ accentColor: 'var(--primary)' }}
                />
              ) : typeof value === 'number' ? (
                <input
                  type="number"
                  value={value}
                  onChange={(e) => onUpdateAttribute(key, parseFloat(e.target.value) || 0)}
                  style={{
                    width: '100%', padding: '4px 8px', fontSize: 12,
                    background: 'var(--bg)', border: '1px solid var(--border)',
                    borderRadius: 4, color: 'var(--text)', outline: 'none',
                  }}
                />
              ) : (
                <input
                  type="text"
                  value={String(value ?? '')}
                  onChange={(e) => {
                    onUpdateAttribute(key, e.target.value);
                    if (isDirectEditField) onDirectEdit(e.target.value);
                  }}
                  style={{
                    width: '100%', padding: '4px 8px', fontSize: 12,
                    background: 'var(--bg)', border: '1px solid var(--border)',
                    borderRadius: 4, color: 'var(--text)', outline: 'none',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* No editable attributes */}
      {Object.keys(semanticData).filter((k) => !k.startsWith('_') && k !== 'eClass').length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
          No attributes
        </div>
      )}
    </div>
  );
}

export default React.memo(VsmPropertyInspector);
