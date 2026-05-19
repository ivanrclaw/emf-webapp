import React, { useState } from 'react';
import { Play, Save, Plus, Settings, BookOpen, HelpCircle } from 'lucide-react';
import { useIDEStore } from './useIDEStore';

export function IDEToolbar({
  onOpenLibrary,
  onOpenHelp,
  onSave,
  onGenerate,
}: {
  onOpenLibrary?: () => void;
  onOpenHelp?: () => void;
  onSave?: () => void;
  onGenerate?: () => void;
}) {
  const { state, addFile, dispatch } = useIDEStore();
  const { project, generating, saving } = state;
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');

  const dirtyCount = project?.files.filter((f) => f.isDirty).length || 0;

  const handleGenerate = () => {
    onGenerate?.();
  };

  const handleSaveAll = () => {
    onSave?.();
  };

  const handleNewFile = () => {
    const newFile = {
      id: crypto.randomUUID(),
      filename: 'untitled.mtl',
      content: '',
      language: 'mtl',
      isDirty: true,
      hasErrors: false,
      isNew: true,
    };
    addFile(newFile);
  };

  const handleNameDoubleClick = () => {
    if (project) {
      setEditingName(true);
      setNameValue(project.name);
    }
  };

  const handleNameSubmit = () => {
    if (nameValue.trim() && project) {
      dispatch({ type: 'LOAD_PROJECT', project: { ...project, name: nameValue.trim() } });
    }
    setEditingName(false);
  };

  return (
    <div
      role="toolbar"
      aria-label="IDE toolbar"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 12px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        minHeight: 38,
      }}
    >
      {/* Left: Project name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {editingName ? (
          <input
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleNameSubmit();
              if (e.key === 'Escape') setEditingName(false);
            }}
            autoFocus
            style={{
              fontSize: 13,
              fontWeight: 600,
              padding: '2px 6px',
              border: '1px solid var(--accent)',
              borderRadius: 4,
              background: 'var(--bg)',
              color: 'var(--text)',
              outline: 'none',
            }}
          />
        ) : (
          <span
            onDoubleClick={handleNameDoubleClick}
            style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', cursor: 'default' }}
            title="Double-click to rename"
          >
            {project?.name || 'No Project'}
          </span>
        )}
        {project && (
          <span
            style={{
              fontSize: 10,
              padding: '2px 6px',
              borderRadius: 8,
              background: 'var(--bg)',
              color: 'var(--text-muted)',
            }}
          >
            {project.files.length} file{project.files.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Right: Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          className="btn btn-primary btn-sm"
          onClick={handleGenerate}
          disabled={generating || !project || project.files.length === 0}
          title="Generate code (Ctrl+Enter)"
          aria-label="Generate code"
          style={{ display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <Play size={13} aria-hidden="true" />
          {generating ? 'Generating...' : 'Generate'}
        </button>
        <button
          className="btn btn-secondary btn-sm"
          onClick={handleSaveAll}
          disabled={saving || dirtyCount === 0}
          title="Save all files (Ctrl+S)"
          aria-label="Save all files"
          style={{ display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <Save size={13} aria-hidden="true" />
          Save{dirtyCount > 0 ? ` (${dirtyCount})` : ''}
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={handleNewFile}
          title="New file"
          aria-label="New file"
          style={{ display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <Plus size={13} aria-hidden="true" />
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={onOpenLibrary}
          title="Template Library"
          aria-label="Open template library"
          style={{ display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <BookOpen size={13} aria-hidden="true" />
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={onOpenHelp}
          title="Help (F1)"
          aria-label="Open help"
          style={{ display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <HelpCircle size={13} aria-hidden="true" />
        </button>
        <button
          className="btn btn-ghost btn-sm"
          title="Settings"
          aria-label="Settings"
          style={{ display: 'flex', alignItems: 'center', gap: 4 }}
          disabled
        >
          <Settings size={13} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
