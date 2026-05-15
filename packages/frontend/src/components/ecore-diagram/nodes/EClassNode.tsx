/**
 * @emf-webapp/frontend — EClassNode
 *
 * Nodo React Flow que representa un EClass del metamodelo Ecore.
 * Muestra el nombre, estereotipos (abstract/interface), atributos y referencias.
 *
 * Los atributos y referencias son clicables → seleccionan el feature en PropertyInspector.
 */
import { useCallback, useState, type KeyboardEvent } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { EcoreNodeData, SerializableEClass, SerializableEAttribute, SerializableEReference } from '../types';
import styles from './EClassNode.module.css';

// ── Type guard ─────────────────────────────────────────────────
function isEClass(c: unknown): c is SerializableEClass {
  return (
    typeof c === 'object' &&
    c !== null &&
    'eAttributes' in c &&
    'eReferences' in c
  );
}

// ── Helper: representación de cardinalidad ────────────────────
function cardinalityLabel(lower: number, upper: number): string {
  if (lower === 0 && upper === -1) return '[0..*]';
  if (lower === 1 && upper === 1) return '[1]';
  if (lower === 0 && upper === 1) return '[0..1]';
  if (lower === 1 && upper === -1) return '[1..*]';
  return `[${lower}..${upper === -1 ? '*' : upper}]`;
}

// ── Componente ────────────────────────────────────────────────
export default function EClassNode(props: NodeProps) {
  const data = props.data as EcoreNodeData;
  const classifier = data.classifier;

  if (!isEClass(classifier)) {
    return <div className={styles.node}>⚠️ Invalid EClass data</div>;
  }

  const {
    onClassifierChange,
    onAddAttribute,
    onAddReference,
    onSelect,
  } = data;

  // ── Inline editing del nombre ─────────────────────────------
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(classifier.name);

  const handleDoubleClick = useCallback(() => {
    setEditValue(classifier.name);
    setEditing(true);
  }, [classifier.name]);

  const commitName = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== classifier.name) {
      onClassifierChange(classifier.id, { name: trimmed });
    }
    setEditing(false);
  }, [editValue, classifier.id, classifier.name, onClassifierChange]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') commitName();
      if (e.key === 'Escape') {
        setEditValue(classifier.name);
        setEditing(false);
      }
    },
    [commitName, classifier.name],
  );

  // ── Render helpers ──────────────────────────────────────────

  const renderAttribute = (a: SerializableEAttribute) => (
    <div
      key={a.id}
      className={styles.item}
      onClick={(e) => { e.stopPropagation(); onSelect(a.id, 'attribute'); }}
    >
      <span className={styles.itemLabel}>
        {a.name}<span className={styles.typeName}>: {a.eType}</span>
      </span>
      {a.iD && <span className={`${styles.itemBadge} ${styles.badgeId}`}>ID</span>}
      {a.lowerBound > 0 && (
        <span className={`${styles.itemBadge} ${styles.badgeRequired}`}>*</span>
      )}
      {a.derived && (
        <span className={`${styles.itemBadge} ${styles.badgeDerived}`}>/</span>
      )}
    </div>
  );

  const renderReference = (ref: SerializableEReference) => (
    <div
      key={ref.id}
      className={styles.item}
      onClick={(e) => { e.stopPropagation(); onSelect(ref.id, 'reference'); }}
    >
      <span className={styles.itemLabel}>
        {ref.name}<span className={styles.arrow}>→</span>
        <span className={styles.typeName}>{ref.targetId}</span>
      </span>
      <span className={`${styles.itemBadge} ${styles.badgeCardinality}`}>
        {cardinalityLabel(ref.lowerBound, ref.upperBound)}
      </span>
    </div>
  );

  return (
    <div className={styles.node} onClick={() => onSelect(classifier.id, 'class')}>
      {/* ── Handles ──────────────────────────────────────── */}
      <Handle type="target" position={Position.Left} id="left" />
      <Handle type="source" position={Position.Right} id="right" />

      {/* ── Header ───────────────────────────────────────── */}
      <div className={styles.header} onDoubleClick={handleDoubleClick}>
        {editing ? (
          <input
            className={styles.nameInput}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitName}
            onKeyDown={handleKeyDown}
            autoFocus
          />
        ) : (
          <span className={styles.name}>{classifier.name}</span>
        )}
        {classifier.abstract && (
          <span className={`${styles.badge} ${styles.badgeAbstract}`}>
            &lt;&lt;abstract&gt;&gt;
          </span>
        )}
        {classifier.interface && (
          <span className={`${styles.badge} ${styles.badgeInterface}`}>
            &lt;&lt;interface&gt;&gt;
          </span>
        )}
      </div>

      {/* ── Attributes ───────────────────────────────────── */}
      <div className={`${styles.section} ${styles.sectionAttributes}`}>
        <div className={styles.sectionTitle}>Attributes</div>
        {classifier.eAttributes.length === 0 && (
          <div className={styles.item} style={{ color: '#9ca3af', fontStyle: 'italic' }}>
            no attributes
          </div>
        )}
        {classifier.eAttributes.map(renderAttribute)}
        <button
          className={styles.addBtn}
          onClick={(e) => {
            e.stopPropagation();
            onAddAttribute(classifier.id);
          }}
          title="Add attribute"
        >
          +
        </button>
      </div>

      {/* ── References ───────────────────────────────────── */}
      <div className={`${styles.section} ${styles.sectionReferences}`}>
        <div className={styles.sectionTitle}>References</div>
        {classifier.eReferences.length === 0 && (
          <div className={styles.item} style={{ color: '#9ca3af', fontStyle: 'italic' }}>
            no references
          </div>
        )}
        {classifier.eReferences.map(renderReference)}
        <button
          className={styles.addBtn}
          onClick={(e) => {
            e.stopPropagation();
            onAddReference(classifier.id);
          }}
          title="Add reference"
        >
          +
        </button>
      </div>
    </div>
  );
}