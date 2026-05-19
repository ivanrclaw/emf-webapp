import { useState, useEffect, useRef } from 'react';
import { X, Plus, Edit2, Trash2, Download, Upload, Code } from 'lucide-react';
import { useIDEStore, type Snippet } from './useIDEStore';

interface UserSnippetsProps {
  open: boolean;
  onClose: () => void;
}

export function UserSnippets({ open, onClose }: UserSnippetsProps) {
  const { state, dispatch } = useIDEStore();
  const { snippets } = state;

  const [editing, setEditing] = useState<Snippet | null>(null);
  const [creating, setCreating] = useState(false);
  const [prefix, setPrefix] = useState('');
  const [body, setBody] = useState('');
  const [description, setDescription] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setEditing(null);
      setCreating(false);
    }
  }, [open]);

  const resetForm = () => {
    setPrefix('');
    setBody('');
    setDescription('');
    setEditing(null);
    setCreating(false);
  };

  const handleCreate = () => {
    setCreating(true);
    setEditing(null);
    setPrefix('');
    setBody('');
    setDescription('');
  };

  const handleEdit = (snippet: Snippet) => {
    setEditing(snippet);
    setCreating(false);
    setPrefix(snippet.prefix);
    setBody(snippet.body);
    setDescription(snippet.description);
  };

  const handleSave = () => {
    if (!prefix.trim() || !body.trim()) return;

    if (editing) {
      dispatch({
        type: 'UPDATE_SNIPPET',
        snippet: { ...editing, prefix: prefix.trim(), body, description: description.trim() },
      });
    } else {
      dispatch({
        type: 'ADD_SNIPPET',
        snippet: {
          id: crypto.randomUUID(),
          prefix: prefix.trim(),
          body,
          description: description.trim(),
        },
      });
    }
    resetForm();
  };

  const handleDelete = (snippetId: string) => {
    dispatch({ type: 'REMOVE_SNIPPET', snippetId });
    if (editing?.id === snippetId) {
      resetForm();
    }
  };

  const handleExport = () => {
    const data = JSON.stringify(snippets, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'snippets.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target?.result as string) as Snippet[];
        if (Array.isArray(imported)) {
          for (const snippet of imported) {
            if (snippet.prefix && snippet.body) {
              dispatch({
                type: 'ADD_SNIPPET',
                snippet: {
                  id: crypto.randomUUID(),
                  prefix: snippet.prefix,
                  body: snippet.body,
                  description: snippet.description || '',
                },
              });
            }
          }
        }
      } catch {
        console.error('Failed to parse snippets JSON');
      }
    };
    reader.readAsText(file);
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (!open) return null;

  const isFormOpen = creating || editing !== null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="User Snippets"
    >
      {/* Backdrop */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />

      {/* Modal */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '90%',
          maxWidth: 600,
          maxHeight: '80vh',
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Code size={16} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
              User Snippets
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              ({snippets.length})
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={handleExport}
              disabled={snippets.length === 0}
              className="btn btn-ghost btn-sm"
              title="Export snippets"
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <Download size={13} />
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn btn-ghost btn-sm"
              title="Import snippets"
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <Upload size={13} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              style={{ display: 'none' }}
              aria-label="Import snippets file"
            />
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                padding: 4,
              }}
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '12px 20px' }}>
          {/* Form */}
          {isFormOpen && (
            <div
              style={{
                marginBottom: 16,
                padding: 14,
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--surface)',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>
                {editing ? 'Edit Snippet' : 'New Snippet'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>
                  <label
                    style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}
                  >
                    Prefix (trigger text)
                  </label>
                  <input
                    type="text"
                    value={prefix}
                    onChange={(e) => setPrefix(e.target.value)}
                    placeholder="e.g., mtl-template"
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      fontSize: 12,
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      color: 'var(--text)',
                      outline: 'none',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}
                  >
                    Description
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Short description"
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      fontSize: 12,
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      color: 'var(--text)',
                      outline: 'none',
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}
                  >
                    Body (template content)
                  </label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="[template public myTemplate(e : EClass)]&#10;...&#10;[/template]"
                    rows={6}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      fontSize: 12,
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      color: 'var(--text)',
                      outline: 'none',
                      resize: 'vertical',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button
                    onClick={resetForm}
                    className="btn btn-ghost btn-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!prefix.trim() || !body.trim()}
                    className="btn btn-primary btn-sm"
                  >
                    {editing ? 'Update' : 'Add'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Add button */}
          {!isFormOpen && (
            <button
              onClick={handleCreate}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 12 }}
            >
              <Plus size={13} />
              New Snippet
            </button>
          )}

          {/* Snippet list */}
          {snippets.length === 0 && !isFormOpen && (
            <div
              style={{
                textAlign: 'center',
                padding: 32,
                color: 'var(--text-muted)',
                fontSize: 12,
              }}
            >
              No snippets yet. Create one or import from JSON.
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {snippets.map((snippet) => (
              <div
                key={snippet.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: editing?.id === snippet.id ? 'var(--accent)11' : 'var(--surface)',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <code
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--accent)',
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      {snippet.prefix}
                    </code>
                    {snippet.description && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        — {snippet.description}
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: 'var(--text-muted)',
                      marginTop: 2,
                      fontFamily: "'JetBrains Mono', monospace",
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {snippet.body.split('\n')[0]}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button
                    onClick={() => handleEdit(snippet)}
                    className="btn btn-ghost btn-sm"
                    title="Edit snippet"
                    style={{ padding: 4 }}
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    onClick={() => handleDelete(snippet.id)}
                    className="btn btn-ghost btn-sm"
                    title="Delete snippet"
                    style={{ padding: 4, color: '#e06c75' }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
