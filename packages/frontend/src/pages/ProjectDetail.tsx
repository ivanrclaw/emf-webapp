import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getProject,
  getMetamodels,
  createMetamodel,
  deleteMetamodel,
  exportMetamodel,
  Project,
  Metamodel,
} from '../api/client';
import { formatDate } from '../utils/format';
import { useToast } from '../components/ToastProvider';

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const { addToast } = useToast();

  const [project, setProject] = useState<Project | null>(null);
  const [metamodels, setMetamodels] = useState<Metamodel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [mmName, setMmName] = useState('');
  const [mmNsUri, setMmNsUri] = useState('');
  const [mmNsPrefix, setMmNsPrefix] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Export
  const [exportOutput, setExportOutput] = useState('');
  const [exportFormat, setExportFormat] = useState('json');
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function load() {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const [proj, mms] = await Promise.all([
        getProject(id),
        getMetamodels(id),
      ]);
      setProject(proj);
      setMetamodels(mms);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load project');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !mmName.trim()) return;
    setSubmitting(true);
    try {
      await createMetamodel(id, {
        name: mmName.trim(),
        nsUri: mmNsUri.trim() || undefined,
        nsPrefix: mmNsPrefix.trim() || undefined,
      });
      setShowCreate(false);
      setMmName(''); setMmNsUri(''); setMmNsPrefix('');
      await load();
      addToast('Metamodel created successfully', 'success');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create metamodel');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(mmid: string, name: string) {
    if (!id) return;
    if (!window.confirm(`Delete metamodel "${name}"?`)) return;
    setDeletingId(mmid);
    try {
      await deleteMetamodel(id, mmid);
      await load();
      addToast('Metamodel deleted successfully', 'success');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete metamodel');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleExport(mmid: string) {
    if (!id) return;
    setExportingId(mmid);
    try {
      const result = await exportMetamodel(id, mmid, exportFormat);
      setExportOutput(result);
      addToast('Metamodel exported successfully', 'success');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to export metamodel');
    } finally {
      setExportingId(null);
    }
  }

  // ── Loading State ───────────────────────────────────────────
  if (loading) {
    return (
      <div>
        <div className="skeleton" style={{ height: 32, width: 200, marginBottom: 24 }} />
        <div className="skeleton" style={{ height: 200, borderRadius: 'var(--radius)', marginBottom: 24 }} />
        <div className="mm-grid">
          {[1, 2].map((i) => (
            <div key={i} className="skeleton" style={{ height: 160, borderRadius: 'var(--radius)' }} />
          ))}
        </div>
      </div>
    );
  }

  // ── Error State ─────────────────────────────────────────────
  if (error && !project) {
    return <div className="msg msg-error">⚠️ {error}</div>;
  }

  if (!project) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🔍</div>
        <div className="empty-state-title">Project not found</div>
        <Link to="/" className="btn btn-secondary" style={{ marginTop: 16 }}>← Back to projects</Link>
      </div>
    );
  }

  return (
    <div>
      {/* ── Back + Header ──────────────────────────────────── */}
      <div className="detail-header">
        <div className="detail-header-left">
          <Link to="/" className="back-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
            </svg>
            Back
          </Link>
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>{project.name}</h1>
            {project.description && (
              <p className="page-subtitle" style={{ marginTop: 2 }}>{project.description}</p>
            )}
          </div>
        </div>
      </div>

      {error && <div className="msg msg-error" style={{ marginBottom: 16 }}>⚠️ {error}</div>}

      {/* ── Project Info Card ──────────────────────────────── */}
      <div className="card" style={{ marginBottom: 32 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 20 }}>
          <div>
            <div className="text-xs text-muted" style={{ marginBottom: 4 }}>Project ID</div>
            <code className="text-sm font-mono">{project.id}</code>
          </div>
          <div>
            <div className="text-xs text-muted" style={{ marginBottom: 4 }}>Created</div>
            <div className="text-sm">{formatDate(project.createdAt)}</div>
          </div>
          <div>
            <div className="text-xs text-muted" style={{ marginBottom: 4 }}>Last Updated</div>
            <div className="text-sm">{formatDate(project.updatedAt)}</div>
          </div>
          <div>
            <div className="text-xs text-muted" style={{ marginBottom: 4 }}>Metamodels</div>
            <div className="text-sm" style={{ fontWeight: 600 }}>{metamodels.length}</div>
          </div>
        </div>
      </div>

      {/* ── Metamodels Section ──────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 className="section-title" style={{ margin: 0 }}>
          Metamodels
          <span className="badge badge-primary" style={{ marginLeft: 10 }}>{metamodels.length}</span>
        </h2>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New Metamodel
        </button>
      </div>

      {/* ── Export Controls ──────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 20, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span className="text-sm text-muted" style={{ fontWeight: 500 }}>Export format:</span>
        <select
          value={exportFormat}
          onChange={(e) => setExportFormat(e.target.value)}
          style={{
            padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)',
            fontSize: '.8125rem', fontFamily: 'inherit', background: 'var(--surface)'
          }}
        >
          <option value="json">JSON</option>
          <option value="xml">XML</option>
          <option value="xmi">XMI (Eclipse)</option>
        </select>
      </div>

      {/* ── Empty State ────────────────────────────────────── */}
      {metamodels.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div className="empty-state-icon">📐</div>
          <div className="empty-state-title">No metamodels yet</div>
          <div className="empty-state-desc">
            Add your first metamodel to start designing Ecore diagrams visually.
          </div>
        </div>
      )}

      {/* ── Metamodel Grid ─────────────────────────────────── */}
      {metamodels.length > 0 && (
        <div className="mm-grid">
          {metamodels.map((mm) => (
            <div key={mm.id} className="mm-card">
              <div className="mm-card-header">
                <span className="mm-card-name">{mm.name}</span>
                <span className="badge badge-primary" style={{ fontSize: '.6875rem' }}>
                  {mm.nsPrefix}
                </span>
              </div>

              <div className="mm-card-details">
                <div className="mm-card-detail">
                  <span style={{ opacity: .5 }}>🔗</span>
                  <span style={{ wordBreak: 'break-all' }}>{mm.nsUri}</span>
                </div>
                <div className="mm-card-detail">
                  <span style={{ opacity: .5 }}>🏷️</span>
                  <span>Prefix: <code className="font-mono">{mm.nsPrefix}</code></span>
                </div>
              </div>

              <div className="mm-card-actions">
                <Link
                  to={`/projects/${id}/metamodels/${mm.id}/edit`}
                  className="btn btn-primary btn-sm"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                  </svg>
                  Edit
                </Link>
                <Link
                  to={`/projects/${id}/metamodels/${mm.id}/models`}
                  className="btn btn-secondary btn-sm"
                >
                  🗂️ Models
                </Link>
                <Link
                  to={`/projects/${id}/metamodels/${mm.id}/specs`}
                  className="btn btn-secondary btn-sm"
                >
                  🎨 Graphics
                </Link>
                <Link
                  to={`/projects/${id}/metamodels/${mm.id}/constraints`}
                  className="btn btn-secondary btn-sm"
                >
                  🔬 OCL
                </Link>
                <Link
                  to={`/projects/${id}/metamodels/${mm.id}/templates`}
                  className="btn btn-secondary btn-sm"
                >
                  📝 Code
                </Link>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleExport(mm.id)}
                  disabled={exportingId === mm.id}
                >
                  {exportingId === mm.id ? 'Exporting...' : '📥 Export'}
                </button>
                <button
                  className="btn btn-sm btn-ghost"
                  style={{ color: 'var(--danger)', marginLeft: 'auto' }}
                  onClick={() => handleDelete(mm.id, mm.name)}
                  disabled={deletingId === mm.id}
                >
                  {deletingId === mm.id ? '...' : '🗑️'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Export Output ───────────────────────────────────── */}
      {exportOutput && (
        <div className="card" style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span className="section-title" style={{ margin: 0, fontSize: '1rem' }}>Export Result</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setExportOutput('')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <pre style={{
            background: '#0f172a', color: '#e2e8f0', padding: 16, borderRadius: 8,
            fontSize: '.8125rem', overflow: 'auto', maxHeight: 400, fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {exportOutput}
          </pre>
        </div>
      )}

      {/* ── Create Modal ────────────────────────────────────── */}
      {showCreate && (
        <div className="form-overlay" onClick={() => setShowCreate(false)}>
          <div className="form-panel" onClick={(e) => e.stopPropagation()}>
            <h2>New Metamodel</h2>
            <form onSubmit={handleCreate}>
              <div className="form-field">
                <label htmlFor="mmname">Name *</label>
                <input
                  id="mmname"
                  value={mmName}
                  onChange={(e) => setMmName(e.target.value)}
                  placeholder="e.g., LibraryModel"
                  autoFocus
                  required
                />
              </div>
              <div className="form-field">
                <label htmlFor="mmnsuri">Namespace URI</label>
                <input
                  id="mmnsuri"
                  value={mmNsUri}
                  onChange={(e) => setMmNsUri(e.target.value)}
                  placeholder="http://example.org/library"
                />
              </div>
              <div className="form-field">
                <label htmlFor="mmnsprefix">Namespace Prefix</label>
                <input
                  id="mmnsprefix"
                  value={mmNsPrefix}
                  onChange={(e) => setMmNsPrefix(e.target.value)}
                  placeholder="library"
                />
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Metamodel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
