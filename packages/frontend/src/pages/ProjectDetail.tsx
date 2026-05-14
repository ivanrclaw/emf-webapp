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

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();

  const [project, setProject] = useState<Project | null>(null);
  const [metamodels, setMetamodels] = useState<Metamodel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Create form state
  const [showCreate, setShowCreate] = useState(false);
  const [mmName, setMmName] = useState('');
  const [mmNsUri, setMmNsUri] = useState('');
  const [mmNsPrefix, setMmNsPrefix] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Export state
  const [exportOutput, setExportOutput] = useState('');
  const [exportFormat, setExportFormat] = useState('json');

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

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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
      setMmName('');
      setMmNsUri('');
      setMmNsPrefix('');
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create metamodel');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(mmid: string, name: string) {
    if (!id) return;
    if (!window.confirm(`Delete metamodel "${name}"?`)) return;
    try {
      await deleteMetamodel(id, mmid);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete metamodel');
    }
  }

  async function handleExport(mmid: string, name: string) {
    if (!id) return;
    try {
      const result = await exportMetamodel(id, mmid, exportFormat);
      setExportOutput(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to export metamodel');
    }
  }

  if (loading) {
    return <p className="empty-state">Loading…</p>;
  }

  if (error && !project) {
    return <div className="error-msg">{error}</div>;
  }

  if (!project) {
    return <p className="empty-state">Project not found.</p>;
  }

  return (
    <div>
      <Link to="/" className="back-link">← Back to projects</Link>

      <div className="detail-header">
        <h1>{project.name}</h1>
      </div>

      {error && <div className="error-msg">{error}</div>}

      <div className="card">
        <table className="meta-table">
          <tbody>
            <tr>
              <td>ID</td>
              <td><code>{project.id}</code></td>
            </tr>
            {project.description && (
              <tr>
                <td>Description</td>
                <td>{project.description}</td>
              </tr>
            )}
            <tr>
              <td>Created</td>
              <td>{new Date(project.createdAt).toLocaleString()}</td>
            </tr>
            <tr>
              <td>Updated</td>
              <td>{new Date(project.updatedAt).toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Metamodels section ─────────────────────────────── */}
      <div className="mm-header">
        <h2>Metamodels ({metamodels.length})</h2>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          + New Metamodel
        </button>
      </div>

      <div className="card">
        <div style={{ marginBottom: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <label htmlFor="exportFmt" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
            Export format:
          </label>
          <select
            id="exportFmt"
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value)}
            style={{ padding: '0.3rem 0.5rem', borderRadius: 4, border: '1px solid #ccc' }}
          >
            <option value="json">JSON</option>
            <option value="xml">XML</option>
            <option value="xmi">XMI</option>
          </select>
        </div>

        {metamodels.length === 0 ? (
          <p className="empty-state">No metamodels in this project.</p>
        ) : (
          <table className="mm-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>NS URI</th>
                <th>NS Prefix</th>
                <th className="actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {metamodels.map((mm) => (
                <tr key={mm.id}>
                  <td><code>{mm.name}</code></td>
                  <td style={{ fontSize: '0.85rem' }}>{mm.nsUri}</td>
                  <td><code>{mm.nsPrefix}</code></td>
                  <td className="actions">
                    <Link
                      to={`/projects/${id}/metamodels/${mm.id}/edit`}
                      className="inline-block px-2 py-1 text-sm border rounded hover:bg-blue-50"
                      title="Open in visual editor"
                    >
                      ✏️ Edit
                    </Link>
                    <button onClick={() => handleExport(mm.id, mm.name)}>
                      Export
                    </button>
                    <button
                      className="btn-danger"
                      onClick={() => handleDelete(mm.id, mm.name)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Export output ──────────────────────────────────── */}
      {exportOutput && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <strong>Export result</strong>
            <button onClick={() => setExportOutput('')}>Close</button>
          </div>
          <pre
            style={{
              background: '#f4f4f4',
              padding: '0.75rem',
              borderRadius: 4,
              fontSize: '0.8rem',
              overflowX: 'auto',
              maxHeight: 300,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {exportOutput}
          </pre>
        </div>
      )}

      {/* ── Create metamodel modal ─────────────────────────── */}
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
                  placeholder="http://example.org/my"
                />
              </div>
              <div className="form-field">
                <label htmlFor="mmnsprefix">Namespace Prefix</label>
                <input
                  id="mmnsprefix"
                  value={mmNsPrefix}
                  onChange={(e) => setMmNsPrefix(e.target.value)}
                  placeholder="my"
                />
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
