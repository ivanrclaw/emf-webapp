import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getProjects, createProject, Project } from '../api/client';

export default function ProjectList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await getProjects();
      setProjects(data.items);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim()) return;
    setSubmitting(true);
    try {
      await createProject({ name: formName.trim(), description: formDesc.trim() || undefined });
      setShowForm(false);
      setFormName('');
      setFormDesc('');
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create project');
    } finally {
      setSubmitting(false);
    }
  }

  const totalMetamodels = 0; // Could be fetched with a dedicated endpoint

  return (
    <div>
      {/* ── Hero Section ────────────────────────────────────── */}
      <div style={{ marginBottom: 40 }}>
        <h1 className="page-title">Projects</h1>
        <p className="page-subtitle">Manage your EMF metamodels and model-driven engineering projects</p>
      </div>

      {/* ── Stats ───────────────────────────────────────────── */}
      <div className="stats-grid">
        <div className="stat-card card-gradient">
          <div className="stat-icon">📦</div>
          <div className="stat-value">{projects.length}</div>
          <div className="stat-label">Total Projects</div>
        </div>
        <div className="stat-card card-gradient-accent">
          <div className="stat-icon">📐</div>
          <div className="stat-value">{projects.reduce((acc, p) => acc + 1, 0)}</div>
          <div className="stat-label">Active Metamodels</div>
        </div>
        <div className="stat-card card-gradient-success">
          <div className="stat-icon">⚡</div>
          <div className="stat-value">{projects.length > 0 ? 'Online' : '—'}</div>
          <div className="stat-label">Platform Status</div>
        </div>
      </div>

      {/* ── Header Row ──────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 className="section-title" style={{ margin: 0 }}>All Projects</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New Project
        </button>
      </div>

      {error && <div className="msg msg-error" style={{ marginBottom: 16 }}>⚠️ {error}</div>}

      {/* ── Loading Skeleton ────────────────────────────────── */}
      {loading && (
        <div className="project-grid">
          {[1, 2, 3].map((i) => (
            <div key={i} className="project-card" style={{ pointerEvents: 'none' }}>
              <div className="skeleton" style={{ height: 20, width: '60%', marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 14, width: '80%', marginBottom: 4 }} />
              <div className="skeleton" style={{ height: 14, width: '40%', marginTop: 8 }} />
            </div>
          ))}
        </div>
      )}

      {/* ── Empty State ─────────────────────────────────────── */}
      {!loading && projects.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '60px 24px' }}>
          <div className="empty-state-icon">📂</div>
          <div className="empty-state-title">No projects yet</div>
          <div className="empty-state-desc">
            Create your first EMF project to start designing metamodels visually.
          </div>
          <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => setShowForm(true)}>
            + Create your first project
          </button>
        </div>
      )}

      {/* ── Project Grid ────────────────────────────────────── */}
      {!loading && projects.length > 0 && (
        <div className="project-grid">
          {projects.map((p) => (
            <Link key={p.id} to={`/projects/${p.id}`} className="project-card">
              <div className="project-card-name">{p.name}</div>
              {p.description && <div className="project-card-desc">{p.description}</div>}
              <div className="project-card-meta">
                <span>📅 Created {new Date(p.createdAt).toLocaleDateString()}</span>
                <span>·</span>
                <span>🔄 Updated {new Date(p.updatedAt).toLocaleDateString()}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* ── Create Modal ────────────────────────────────────── */}
      {showForm && (
        <div className="form-overlay" onClick={() => setShowForm(false)}>
          <div className="form-panel" onClick={(e) => e.stopPropagation()}>
            <h2>New Project</h2>
            <form onSubmit={handleCreate}>
              <div className="form-field">
                <label htmlFor="pname">Project Name *</label>
                <input
                  id="pname"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Library Management System"
                  autoFocus
                  required
                />
              </div>
              <div className="form-field">
                <label htmlFor="pdesc">Description</label>
                <textarea
                  id="pdesc"
                  rows={3}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Brief description of the project..."
                />
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
