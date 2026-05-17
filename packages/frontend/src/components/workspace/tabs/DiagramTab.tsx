import React, { useCallback, useState, type DragEvent } from 'react';
import EcoreEditor from '../../ecore-diagram/EcoreEditor';
import { useToast } from '../../ToastProvider';

interface DiagramTabProps {
  projectId: string;
  metamodelId: string;
}

export function DiagramTab({ projectId, metamodelId }: DiagramTabProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const { addToast } = useToast();

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Only show overlay when dragging actual files (not toolbox items)
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    async (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files);
      // Silently ignore non-file drags (toolbox items, etc.)
      if (files.length === 0) return;
      const ecoreFile = files.find(
        (f) => f.name.endsWith('.ecore') || f.name.endsWith('.xml'),
      );
      if (!ecoreFile) {
        addToast('Please drop a .ecore file', 'warning');
        return;
      }

      try {
        const text = await ecoreFile.text();
        const resp = await fetch(`/api/projects/${projectId}/xmi/${metamodelId}/import`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ xml: text }),
        });
        const data = await resp.json();
        if (data.success) {
          addToast('Metamodel imported successfully', 'success');
        } else {
          addToast('Import failed: ' + (data.message || 'Unknown error'), 'error');
        }
      } catch (err: any) {
        addToast('Error importing file: ' + err.message, 'error');
      }
    },
    [projectId, metamodelId],
  );

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <EcoreEditor projectId={projectId} metamodelId={metamodelId} />

      {isDragOver && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(59, 130, 246, 0.1)',
            border: '2px dashed var(--primary)',
            borderRadius: 8,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              padding: '16px 32px',
              background: 'var(--surface)',
              borderRadius: 8,
              border: '1px solid var(--border)',
              color: 'var(--primary)',
              fontWeight: 600,
              fontSize: 16,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}
          >
            Drop .ecore file to import
          </div>
        </div>
      )}
    </div>
  );
}

export default DiagramTab;
