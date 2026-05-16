import React, { useEffect, useState, useCallback } from 'react';
import { getProject, getMetamodels, createMetamodel } from '../../../api/client';
import { useToast } from '../../ToastProvider';
import { Box, Calendar, Hash, Link2, Pencil, Plus } from '../../icons';

interface ProjectInfoTabProps {
  projectId: string;
  onOpenTab?: (tab: { type: string; title: string; projectId: string; metamodelId: string }) => void;
}

interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

interface Metamodel {
  id: string;
  name: string;
  nsUri: string;
  nsPrefix: string;
}

export function ProjectInfoTab({ projectId, onOpenTab }: ProjectInfoTabProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [metamodels, setMetamodels] = useState<Metamodel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNsUri, setNewNsUri] = useState('http://example.org/default');
  const [newNsPrefix, setNewNsPrefix] = useState('default');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const { addToast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [proj, mms] = await Promise.all([
        getProject(projectId),
        getMetamodels(projectId),
      ]);
      setProject(proj);
      setMetamodels(mms);
    } catch (err: any) {
      setError(err.message || 'Failed to load project');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = useCallback(async () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      setCreateError('Metamodel name is required');
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      await createMetamodel(projectId, {
        name: trimmed,
        ns_uri: newNsUri.trim() || 'http://example.org/default',
        ns_prefix: newNsPrefix.trim() || 'default',
      });
      setNewName('');
      setNewNsUri('http://example.org/default');
      setNewNsPrefix('default');
      setShowNewForm(false);
      addToast(`Metamodel "${trimmed}" created`, 'success');
      // Refresh list
      const mms = await getMetamodels(projectId);
      setMetamodels(mms);
    } catch (err: any) {
      setCreateError(err?.message || 'Failed to create metamodel');
    } finally {
      setCreating(false);
    }
  }, [projectId, newName, newNsUri, newNsPrefix, addToast]);

  if (loading) {
    return (
      <div style={{ padding: 32, color: 'var(--text-muted)' }}>Loading project...</div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 32, color: 'var(--danger)' }}>
        <p>Error: {error}</p>
      </div>
    );
  }

  if (!project) return null;

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid var(--border)',
    borderRadius: 4,
    fontSize: 14,
    backgroundColor: 'var(--bg)',
    color: 'var(--text)',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const btnPrimaryStyle: React.CSSProperties = {
    padding: '8px 16px',
    fontSize: 14,
    fontWeight: 500,
    borderRadius: 4,
    cursor: 'pointer',
    border: 'none',
    backgroundColor: 'var(--primary)',
    color: '#fff',
    opacity: creating ? 0.6 : 1,
  };

  const btnSecondaryStyle: React.CSSProperties = {
    padding: '8px 16px',
    fontSize: 14,
    fontWeight: 500,
    borderRadius: 4,
    cursor: 'pointer',
    border: '1px solid var(--border)',
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
  };

  return (
    <div style={{ padding: '32px 40px', maxWidth: 800, color: 'var(--text)' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <Box size={22} />
        {project.name}
      </h1>
      {project.description && (
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: '0 0 24px' }}>
          {project.description}
        </p>
      )}

      <div style={{ display: 'flex', gap: 24, marginBottom: 32, fontSize: 13, color: 'var(--text-muted)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Calendar size={14} />
          Created: {new Date(project.createdAt).toLocaleDateString()}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Pencil size={14} />
          Updated: {new Date(project.updatedAt).toLocaleDateString()}
        </span>
      </div>

      {/* ── Metamodels section ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>Metamodels</h2>
        <button
          onClick={() => { setShowNewForm((v) => !v); setCreateError(null); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            fontSize: 13,
            fontWeight: 500,
            background: 'var(--primary)',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          <Plus size={14} />
          {showNewForm ? 'Cancel' : 'New Metamodel'}
        </button>
      </div>

      {/* ── Inline create form ── */}
      {showNewForm && (
        <div
          style={{
            padding: 16,
            marginBottom: 16,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4, color: 'var(--text-secondary)' }}>
              Name *
            </label>
            <input
              style={inputStyle}
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="MyMetamodel"
              autoFocus
              disabled={creating}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4, color: 'var(--text-secondary)' }}>
              Namespace URI
            </label>
            <input
              style={inputStyle}
              type="text"
              value={newNsUri}
              onChange={(e) => setNewNsUri(e.target.value)}
              placeholder="http://example.org/default"
              disabled={creating}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4, color: 'var(--text-secondary)' }}>
              Namespace Prefix
            </label>
            <input
              style={inputStyle}
              type="text"
              value={newNsPrefix}
              onChange={(e) => setNewNsPrefix(e.target.value)}
              placeholder="default"
              disabled={creating}
            />
          </div>
          {createError && (
            <div style={{ color: 'var(--error)', fontSize: 13 }}>{createError}</div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              style={btnSecondaryStyle}
              onClick={() => { setShowNewForm(false); setCreateError(null); }}
              disabled={creating}
            >
              Cancel
            </button>
            <button
              style={btnPrimaryStyle}
              onClick={handleCreate}
              disabled={creating}
            >
              {creating ? 'Creating...' : 'Create Metamodel'}
            </button>
          </div>
        </div>
      )}

      {/* ── Metamodel list ── */}
      {metamodels.length === 0 && !showNewForm ? (
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          No metamodels yet. Click "New Metamodel" to create one.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {metamodels.map((mm) => (
            <div
              key={mm.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 8,
              }}
            >
              <div>
                <div style={{ fontWeight: 500, fontSize: 14 }}>{mm.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 12, marginTop: 4 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Link2 size={11} /> {mm.nsUri}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Hash size={11} /> {mm.nsPrefix}
                  </span>
                </div>
              </div>
              {onOpenTab && (
                <button
                  onClick={() => onOpenTab({ type: 'diagram', title: `${mm.name} — Diagram`, projectId, metamodelId: mm.id })}
                  style={{
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 500,
                    background: 'var(--primary)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                >
                  Open Diagram
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ProjectInfoTab;
