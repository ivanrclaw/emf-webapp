import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getProjects, createProject, Project } from '../api/client';

export default function ProjectList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

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

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim()) return;
    setSubmitting(true);
    try {
      const created = await createProject({ name: formName.trim(), description: formDesc.trim() || undefined });
      setShowForm(false);
      setFormName('');
      setFormDesc('');
      navigate(`/projects/${created.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create project');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="project-list-header">
        <h1>Projects</h1>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          + New Project
        </button>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {loading && <p className="empty-state">Loading…</p>}

      {!loading && projects.length === 0 && (
        <p className="empty-state">No projects yet. Create your first one!</p>
      )}

      {projects.map((p) => (
        <Link key={p.id} to={`/projects/${p.id}`} className="project-link">
          <div className="card">
            <div className="project-name">{p.name}</div>
            {p.description && <div className="project-desc">{p.description}</div>}
            <div className="project-meta">
              Created {new Date(p.createdAt).toLocaleDateString()}
              {' · '}Updated {new Date(p.updatedAt).toLocaleDateString()}
            </div>
          </div>
        </Link>
      ))}

      {/* ── Create form modal ──────────────────────────────── */}
      {showForm && (
        <div className="form-overlay" onClick={() => setShowForm(false)}>
          <div className="form-panel" onClick={(e) => e.stopPropagation()}>
            <h2>New Project</h2>
            <form onSubmit={handleCreate}>
              <div className="form-field">
                <label htmlFor="pname">Name *</label>
                <input
                  id="pname"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
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
                />
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => setShowForm(false)}>
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
