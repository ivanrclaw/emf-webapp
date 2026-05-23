/**
 * @emf-webapp/frontend — VsmPropertyInspector (v2)
 *
 * Professional property inspector for the runtime model editor.
 * Tabs: Properties | References | Semantic
 *
 * Features:
 * - Typed attribute editors (string, number, boolean, enum)
 * - Reference list with navigation and add/remove
 * - Semantic info (eClass, id, containment)
 * - Metamodel-aware: knows attribute types and multiplicities
 * - Header with mapping color, shape icon, inline name edit, delete button
 */
import React, { useState, useMemo, useCallback } from 'react';
import type { NodeMapping, ContainerMapping, DirectEditTool } from '../spec-diagram/types';
import { getDirectEditTool } from '../../lib/vsm-runtime';
import type { Tool } from '../spec-diagram/types';
import { Trash2, Link2, Box, Hash, Info } from '../icons';

// ─── Types ───────────────────────────────────────────────────────────────────

interface EAttributeInfo {
  name: string;
  eType?: string;
  lowerBound?: number;
  upperBound?: number;
  defaultValue?: string;
}

interface EReferenceInfo {
  name: string;
  eType?: string;
  containment?: boolean;
  lowerBound?: number;
  upperBound?: number;
}

interface EClassInfo {
  name: string;
  abstract?: boolean;
  interface?: boolean;
  eAttributes?: EAttributeInfo[];
  eReferences?: EReferenceInfo[];
}

interface SemanticObject {
  id: string;
  eClass: string;
  attributes: Record<string, unknown>;
  references: Record<string, string[]>;
}

export interface VsmPropertyInspectorProps {
  /** The selected object's semantic data */
  semanticData: Record<string, unknown> | null;
  /** The full semantic object (for references) */
  selectedObject?: SemanticObject | null;
  /** The mapping for the selected object */
  mapping: (NodeMapping | ContainerMapping) | null;
  /** All tools from active layers */
  tools: Tool[];
  /** All objects in the model (for reference resolution) */
  allObjects?: SemanticObject[];
  /** EClass info from metamodel */
  eclasses?: EClassInfo[];
  /** Callback to update an attribute */
  onUpdateAttribute: (key: string, value: unknown) => void;
  /** Callback to update the object's name/label via direct edit */
  onDirectEdit: (value: string) => void;
  /** Callback to add a reference */
  onAddReference?: (refName: string, targetId: string) => void;
  /** Callback to remove a reference */
  onRemoveReference?: (refName: string, targetId: string) => void;
  /** Callback to navigate to an object */
  onNavigateToObject?: (objectId: string) => void;
  /** Callback to delete the selected object */
  onDelete?: () => void;
}

// ─── Tabs ────────────────────────────────────────────────────────────────────

type TabId = 'properties' | 'references' | 'semantic';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'properties', label: 'Properties', icon: <Hash size={12} /> },
  { id: 'references', label: 'References', icon: <Link2 size={12} /> },
  { id: 'semantic', label: 'Info', icon: <Info size={12} /> },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function VsmPropertyInspector({
  semanticData,
  selectedObject,
  mapping,
  tools,
  allObjects = [],
  eclasses = [],
  onUpdateAttribute,
  onDirectEdit,
  onAddReference,
  onRemoveReference,
  onNavigateToObject,
  onDelete,
}: VsmPropertyInspectorProps) {
  const [activeTab, setActiveTab] = useState<TabId>('properties');

  // Find EClass info for the selected object
  const eClassInfo = useMemo(() => {
    if (!selectedObject) return null;
    return eclasses.find((ec) => ec.name === selectedObject.eClass) || null;
  }, [selectedObject, eclasses]);

  const directEditTool = useMemo(() => {
    if (!mapping) return null;
    return getDirectEditTool(mapping.id, tools) || null;
  }, [mapping, tools]);

  if (!semanticData || !mapping) {
    return (
      <div style={styles.emptyState}>
        <Box size={24} style={{ opacity: 0.3, color: 'var(--text-muted)' }} />
        <span style={styles.emptyText}>Select an element to view its properties</span>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* ─── Header ─────────────────────────────────────────────── */}
      <InspectorHeader
        mapping={mapping}
        name={semanticData.name as string || selectedObject?.id || ''}
        eClass={selectedObject?.eClass || mapping.domainClass}
        onDelete={onDelete}
      />

      {/* ─── Tab Bar ────────────────────────────────────────────── */}
      <div style={styles.tabBar}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              ...styles.tab,
              color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-muted)',
              borderBottomColor: activeTab === tab.id ? 'var(--primary)' : 'transparent',
              fontWeight: activeTab === tab.id ? 600 : 400,
            }}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ─── Tab Content ────────────────────────────────────────── */}
      <div style={styles.content}>
        {activeTab === 'properties' && (
          <PropertiesTab
            semanticData={semanticData}
            eClassInfo={eClassInfo}
            directEditTool={directEditTool}
            onUpdateAttribute={onUpdateAttribute}
            onDirectEdit={onDirectEdit}
          />
        )}
        {activeTab === 'references' && (
          <ReferencesTab
            selectedObject={selectedObject || null}
            eClassInfo={eClassInfo}
            allObjects={allObjects}
            onAddReference={onAddReference}
            onRemoveReference={onRemoveReference}
            onNavigateToObject={onNavigateToObject}
          />
        )}
        {activeTab === 'semantic' && (
          <SemanticTab
            selectedObject={selectedObject || null}
            eClassInfo={eClassInfo}
            mapping={mapping}
          />
        )}
      </div>
    </div>
  );
}

// ─── Header ──────────────────────────────────────────────────────────────────

function InspectorHeader({
  mapping,
  name,
  eClass,
  onDelete,
}: {
  mapping: NodeMapping | ContainerMapping;
  name: string;
  eClass: string;
  onDelete?: () => void;
}) {
  const style = mapping.defaultStyle;
  return (
    <div style={styles.header}>
      <div
        style={{
          ...styles.headerColorDot,
          background: style.color,
          borderColor: style.borderColor,
        }}
      />
      <div style={styles.headerInfo}>
        <span style={styles.headerName}>{name || '(unnamed)'}</span>
        <span style={styles.headerClass}>{eClass}</span>
      </div>
      {onDelete && (
        <button
          onClick={onDelete}
          title="Delete element"
          style={styles.headerDeleteBtn}
        >
          <Trash2 size={13} />
        </button>
      )}
    </div>
  );
}

// ─── Properties Tab ──────────────────────────────────────────────────────────

function PropertiesTab({
  semanticData,
  eClassInfo,
  directEditTool,
  onUpdateAttribute,
  onDirectEdit,
}: {
  semanticData: Record<string, unknown>;
  eClassInfo: EClassInfo | null;
  directEditTool: DirectEditTool | null;
  onUpdateAttribute: (key: string, value: unknown) => void;
  onDirectEdit: (value: string) => void;
}) {
  const attributes = Object.entries(semanticData).filter(
    ([key]) => !key.startsWith('_') && key !== 'eClass',
  );

  if (attributes.length === 0) {
    return <div style={styles.emptyTab}>No attributes defined</div>;
  }

  return (
    <div style={styles.fieldList}>
      {attributes.map(([key, value]) => {
        const attrInfo = eClassInfo?.eAttributes?.find((a) => a.name === key);
        const isDirectEdit = directEditTool?.featureToSet === key;
        const eType = attrInfo?.eType || inferType(value);
        const isRequired = (attrInfo?.lowerBound ?? 0) > 0;

        return (
          <div key={key} style={styles.field}>
            <div style={styles.fieldLabel}>
              <span>{key}</span>
              {isRequired && <span style={styles.requiredDot}>*</span>}
              {isDirectEdit && <span style={styles.directEditBadge}>label</span>}
              <span style={styles.typeBadge}>{eType}</span>
            </div>
            <AttributeEditor
              value={value}
              eType={eType}
              onChange={(v) => {
                onUpdateAttribute(key, v);
                if (isDirectEdit) onDirectEdit(String(v));
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

// ─── Attribute Editor ────────────────────────────────────────────────────────

function AttributeEditor({
  value,
  eType,
  onChange,
}: {
  value: unknown;
  eType: string;
  onChange: (v: unknown) => void;
}) {
  if (typeof value === 'boolean' || eType === 'EBoolean') {
    return (
      <label style={styles.toggleWrap}>
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          style={styles.toggleInput}
        />
        <span style={styles.toggleLabel}>{value ? 'true' : 'false'}</span>
      </label>
    );
  }

  if (typeof value === 'number' || eType === 'EInt' || eType === 'EFloat' || eType === 'EDouble') {
    return (
      <input
        type="number"
        value={value as number ?? 0}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        style={styles.input}
        step={eType === 'EInt' ? 1 : 0.1}
      />
    );
  }

  // Default: string
  return (
    <input
      type="text"
      value={String(value ?? '')}
      onChange={(e) => onChange(e.target.value)}
      style={styles.input}
      spellCheck={false}
    />
  );
}

// ─── References Tab ──────────────────────────────────────────────────────────

function ReferencesTab({
  selectedObject,
  eClassInfo,
  allObjects,
  onAddReference,
  onRemoveReference,
  onNavigateToObject,
}: {
  selectedObject: SemanticObject | null;
  eClassInfo: EClassInfo | null;
  allObjects: SemanticObject[];
  onAddReference?: (refName: string, targetId: string) => void;
  onRemoveReference?: (refName: string, targetId: string) => void;
  onNavigateToObject?: (objectId: string) => void;
}) {
  const [addingRef, setAddingRef] = useState<string | null>(null);

  if (!selectedObject) {
    return <div style={styles.emptyTab}>No object selected</div>;
  }

  const refs = Object.entries(selectedObject.references);
  const declaredRefs = eClassInfo?.eReferences || [];

  // Show all declared references (even empty ones)
  const allRefNames = new Set([
    ...refs.map(([name]) => name),
    ...declaredRefs.map((r) => r.name),
  ]);

  if (allRefNames.size === 0) {
    return <div style={styles.emptyTab}>No references in metamodel</div>;
  }

  return (
    <div style={styles.fieldList}>
      {Array.from(allRefNames).map((refName) => {
        const refInfo = declaredRefs.find((r) => r.name === refName);
        const targets = selectedObject.references[refName] || [];
        const isMulti = (refInfo?.upperBound ?? 1) === -1 || (refInfo?.upperBound ?? 1) > 1;
        const isRequired = (refInfo?.lowerBound ?? 0) > 0;

        return (
          <div key={refName} style={styles.refSection}>
            <div style={styles.refHeader}>
              <Link2 size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <span style={styles.refName}>{refName}</span>
              {isRequired && <span style={styles.requiredDot}>*</span>}
              <span style={styles.typeBadge}>
                → {refInfo?.eType || '?'}{isMulti ? ' [*]' : ''}
              </span>
              {refInfo?.containment && (
                <span style={{ ...styles.typeBadge, color: 'var(--warning)' }}>◆</span>
              )}
              {onAddReference && (isMulti || targets.length === 0) && (
                <button
                  onClick={() => setAddingRef(addingRef === refName ? null : refName)}
                  style={styles.refAddBtn}
                  title="Add reference"
                >
                  +
                </button>
              )}
            </div>

            {/* Target list */}
            {targets.length > 0 ? (
              <div style={styles.refTargets}>
                {targets.map((targetId) => {
                  const targetObj = allObjects.find((o) => o.id === targetId);
                  const targetName = targetObj
                    ? (targetObj.attributes.name as string) || targetObj.id
                    : targetId;
                  return (
                    <div key={targetId} style={styles.refTarget}>
                      <button
                        onClick={() => onNavigateToObject?.(targetId)}
                        style={styles.refTargetLink}
                        title="Navigate to element"
                      >
                        {targetName}
                      </button>
                      <span style={styles.refTargetClass}>
                        {targetObj?.eClass || '?'}
                      </span>
                      {onRemoveReference && (
                        <button
                          onClick={() => onRemoveReference(refName, targetId)}
                          style={styles.refRemoveBtn}
                          title="Remove reference"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={styles.refEmpty}>No targets</div>
            )}

            {/* Add reference dropdown */}
            {addingRef === refName && (
              <AddReferenceDropdown
                refInfo={refInfo}
                allObjects={allObjects}
                existingTargets={targets}
                onAdd={(targetId) => {
                  onAddReference?.(refName, targetId);
                  setAddingRef(null);
                }}
                onClose={() => setAddingRef(null)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function AddReferenceDropdown({
  refInfo,
  allObjects,
  existingTargets,
  onAdd,
  onClose,
}: {
  refInfo?: EReferenceInfo;
  allObjects: SemanticObject[];
  existingTargets: string[];
  onAdd: (targetId: string) => void;
  onClose: () => void;
}) {
  const [filter, setFilter] = useState('');

  // Filter objects by target type and exclude already-referenced
  const candidates = useMemo(() => {
    return allObjects.filter((obj) => {
      if (existingTargets.includes(obj.id)) return false;
      if (refInfo?.eType && obj.eClass !== refInfo.eType) return false;
      if (filter) {
        const name = (obj.attributes.name as string) || obj.id;
        return name.toLowerCase().includes(filter.toLowerCase());
      }
      return true;
    });
  }, [allObjects, existingTargets, refInfo, filter]);

  return (
    <div style={styles.addRefDropdown}>
      <input
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter..."
        style={styles.addRefInput}
        autoFocus
      />
      <div style={styles.addRefList}>
        {candidates.length === 0 ? (
          <div style={styles.addRefEmpty}>No matching objects</div>
        ) : (
          candidates.slice(0, 10).map((obj) => (
            <button
              key={obj.id}
              onClick={() => onAdd(obj.id)}
              style={styles.addRefItem}
            >
              <span>{(obj.attributes.name as string) || obj.id}</span>
              <span style={styles.addRefItemClass}>{obj.eClass}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Semantic Tab ────────────────────────────────────────────────────────────

function SemanticTab({
  selectedObject,
  eClassInfo,
  mapping,
}: {
  selectedObject: SemanticObject | null;
  eClassInfo: EClassInfo | null;
  mapping: NodeMapping | ContainerMapping;
}) {
  if (!selectedObject) {
    return <div style={styles.emptyTab}>No object selected</div>;
  }

  const isContainer = 'childrenPresentation' in mapping;

  return (
    <div style={styles.fieldList}>
      <InfoRow label="ID" value={selectedObject.id} mono />
      <InfoRow label="EClass" value={selectedObject.eClass} />
      <InfoRow label="Mapping Type" value={isContainer ? 'Container' : 'Node'} />
      <InfoRow label="Abstract" value={eClassInfo?.abstract ? 'Yes' : 'No'} />
      <InfoRow
        label="Attributes"
        value={`${eClassInfo?.eAttributes?.length ?? 0} declared`}
      />
      <InfoRow
        label="References"
        value={`${eClassInfo?.eReferences?.length ?? 0} declared`}
      />
      {isContainer && (
        <InfoRow
          label="Children Layout"
          value={(mapping as ContainerMapping).childrenPresentation}
        />
      )}
      <InfoRow
        label="Label Expression"
        value={mapping.labelExpression}
        mono
      />
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={styles.infoRow}>
      <span style={styles.infoLabel}>{label}</span>
      <span style={{ ...styles.infoValue, ...(mono ? { fontFamily: 'monospace', fontSize: 10 } : {}) }}>
        {value}
      </span>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function inferType(value: unknown): string {
  if (typeof value === 'boolean') return 'EBoolean';
  if (typeof value === 'number') return Number.isInteger(value) ? 'EInt' : 'EFloat';
  return 'EString';
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 24,
    height: '100%',
  },
  emptyText: {
    fontSize: 12,
    color: 'var(--text-muted)',
    textAlign: 'center',
  },
  // Header
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 12px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--surface)',
  },
  headerColorDot: {
    width: 14,
    height: 14,
    borderRadius: 3,
    border: '2px solid',
    flexShrink: 0,
  },
  headerInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
    overflow: 'hidden',
  },
  headerName: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  headerClass: {
    fontSize: 10,
    color: 'var(--text-muted)',
    fontWeight: 500,
  },
  headerDeleteBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
    border: 'none',
    borderRadius: 4,
    background: 'transparent',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'color 0.15s',
  },
  // Tab Bar
  tabBar: {
    display: 'flex',
    borderBottom: '1px solid var(--border)',
    background: 'var(--surface)',
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    padding: '7px 8px',
    border: 'none',
    borderBottom: '2px solid transparent',
    background: 'transparent',
    fontSize: 11,
    cursor: 'pointer',
    justifyContent: 'center',
    transition: 'color 0.15s, border-color 0.15s',
  },
  // Content
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px 0',
  },
  emptyTab: {
    padding: 16,
    fontSize: 11,
    color: 'var(--text-muted)',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // Fields
  fieldList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  field: {
    padding: '4px 12px',
  },
  fieldLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 10,
    fontWeight: 500,
    color: 'var(--text-secondary)',
    marginBottom: 3,
  },
  requiredDot: {
    color: 'var(--error, #ef4444)',
    fontSize: 12,
    fontWeight: 700,
  },
  directEditBadge: {
    fontSize: 9,
    padding: '0 4px',
    borderRadius: 3,
    background: 'var(--primary-bg, rgba(99, 102, 241, 0.15))',
    color: 'var(--primary)',
    fontWeight: 600,
  },
  typeBadge: {
    marginLeft: 'auto',
    fontSize: 9,
    color: 'var(--text-muted)',
    fontFamily: 'monospace',
  },
  input: {
    width: '100%',
    padding: '5px 8px',
    fontSize: 12,
    background: 'var(--bg-input, var(--background))',
    border: '1px solid var(--border)',
    borderRadius: 4,
    color: 'var(--text)',
    outline: 'none',
    transition: 'border-color 0.15s',
  },
  toggleWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    cursor: 'pointer',
    padding: '2px 0',
  },
  toggleInput: {
    width: 14,
    height: 14,
    accentColor: 'var(--primary)',
    cursor: 'pointer',
  },
  toggleLabel: {
    fontSize: 11,
    color: 'var(--text-muted)',
    fontFamily: 'monospace',
  },
  // References
  refSection: {
    padding: '6px 12px',
    borderBottom: '1px solid var(--border)',
  },
  refHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  refName: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text)',
  },
  refAddBtn: {
    marginLeft: 'auto',
    width: 18,
    height: 18,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid var(--border)',
    borderRadius: 3,
    background: 'transparent',
    color: 'var(--primary)',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    flexShrink: 0,
  },
  refTargets: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    marginLeft: 15,
  },
  refTarget: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 6px',
    borderRadius: 3,
    background: 'var(--bg-input, var(--background))',
  },
  refTargetLink: {
    border: 'none',
    background: 'transparent',
    color: 'var(--primary)',
    fontSize: 11,
    fontWeight: 500,
    cursor: 'pointer',
    padding: 0,
    textDecoration: 'underline',
    textDecorationColor: 'transparent',
    transition: 'text-decoration-color 0.15s',
  },
  refTargetClass: {
    marginLeft: 'auto',
    fontSize: 9,
    color: 'var(--text-muted)',
    fontFamily: 'monospace',
  },
  refRemoveBtn: {
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontSize: 14,
    cursor: 'pointer',
    padding: '0 2px',
    lineHeight: 1,
    flexShrink: 0,
  },
  refEmpty: {
    marginLeft: 15,
    fontSize: 10,
    color: 'var(--text-muted)',
    fontStyle: 'italic',
    padding: '2px 0',
  },
  // Add reference dropdown
  addRefDropdown: {
    marginTop: 4,
    marginLeft: 15,
    border: '1px solid var(--border)',
    borderRadius: 4,
    background: 'var(--surface)',
    overflow: 'hidden',
  },
  addRefInput: {
    width: '100%',
    padding: '5px 8px',
    border: 'none',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-input, var(--background))',
    color: 'var(--text)',
    fontSize: 11,
    outline: 'none',
  },
  addRefList: {
    maxHeight: 120,
    overflowY: 'auto',
  },
  addRefEmpty: {
    padding: '8px',
    fontSize: 10,
    color: 'var(--text-muted)',
    textAlign: 'center',
  },
  addRefItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: '4px 8px',
    border: 'none',
    background: 'transparent',
    color: 'var(--text)',
    fontSize: 11,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background 0.1s',
  },
  addRefItemClass: {
    fontSize: 9,
    color: 'var(--text-muted)',
    fontFamily: 'monospace',
  },
  // Semantic info
  infoRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    padding: '5px 12px',
    borderBottom: '1px solid var(--border)',
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
    flexShrink: 0,
  },
  infoValue: {
    fontSize: 11,
    color: 'var(--text)',
    textAlign: 'right',
    wordBreak: 'break-all',
  },
};

export default React.memo(VsmPropertyInspector);
