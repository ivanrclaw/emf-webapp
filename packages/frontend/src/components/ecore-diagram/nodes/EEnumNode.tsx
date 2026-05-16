/**
 * @emf-webapp/frontend — EEnumNode
 *
 * Nodo React Flow que representa un EEnum del metamodelo Ecore.
 * Muestra el nombre y la lista de literales con sus valores.
 */
import { useCallback, useState, type KeyboardEvent } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { EcoreNodeData, SerializableEEnum } from '../types';
import styles from './EEnumNode.module.css';
import { AlertTriangle } from '../../icons';

// ── Type guard ─────────────────────────────────────────────────
function isEEnum(c: unknown): c is SerializableEEnum {
  return (
    typeof c === 'object' &&
    c !== null &&
    'eLiterals' in c
  );
}

// ── Componente ────────────────────────────────────────────────
export default function EEnumNode(props: NodeProps) {
  const data = props.data as EcoreNodeData;
  const classifier = data.classifier;

  if (!isEEnum(classifier)) {
    return <div className={styles.node}><AlertTriangle size={14} /> Invalid EEnum data</div>;
  }

  const { onClassifierChange, onSelect } = data;

  // ── Inline editing del nombre ───────────────────────────────
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

  return (
    <div className={styles.node} onClick={() => onSelect(classifier.id, 'enum')}>
      {/* ── Handles ──────────────────────────────────────── */}
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />

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
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: '#9a3412',
            background: '#fed7aa',
            padding: '1px 6px',
            borderRadius: 4,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          &lt;&lt;enum&gt;&gt;
        </span>
      </div>

      {/* ── Literals ─────────────────────────────────────── */}
      <div className={styles.literals}>
        {classifier.eLiterals.length === 0 && (
          <div className={styles.literalItem} style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
            no literals
          </div>
        )}
        {classifier.eLiterals.map((literal) => (
          <div key={literal.id} className={styles.literalItem}>
            <span className={styles.literalName}>{literal.name}</span>
            <span className={styles.equals}>=</span>
            <span className={styles.literalValue}>{literal.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
