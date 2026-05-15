/**
 * @emf-webapp/frontend — EDataTypeNode
 *
 * Nodo React Flow que representa un EDataType del metamodelo Ecore.
 * Muestra el nombre y el instanceClassName en un nodo compacto.
 */
import { useCallback, useState, type KeyboardEvent } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { EcoreNodeData, SerializableEDataType } from '../types';
import styles from './EDataTypeNode.module.css';

// ── Type guard ─────────────────────────────────────────────────
function isEDataType(c: unknown): c is SerializableEDataType {
  return (
    typeof c === 'object' &&
    c !== null &&
    'instanceClassName' in c &&
    !('eLiterals' in c) &&
    !('eAttributes' in c)
  );
}

// ── Componente ────────────────────────────────────────────────
export default function EDataTypeNode(props: NodeProps) {
  const data = props.data as EcoreNodeData;
  const classifier = data.classifier;

  if (!isEDataType(classifier)) {
    return <div className={styles.node}>⚠️ Invalid EDataType data</div>;
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
    <div className={styles.node} onClick={() => onSelect(classifier.id, 'dataType')}>
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
          <div>
            <div className={styles.name}>{classifier.name}</div>
            <div className={styles.instanceClass}>{classifier.instanceClassName}</div>
          </div>
        )}
      </div>
    </div>
  );
}
