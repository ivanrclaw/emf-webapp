import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getMetamodel,
  getM1Models,
  createM1Model,
  deleteM1Model,
  Metamodel,
  M1Model,
} from '../api/client';
import { AlertTriangle, Layers, Box, Calendar, Trash2 } from '../components/icons';
import ErrorPanel from '../components/feedback/ErrorPanel';

interface ModelListProps {
  projectId?: string;
  metamodelId?: string;
}

export default function ModelList(props: ModelListProps) {
  const params = useParams<{ pid: string; mmid: string }>();
  const projectId = props.projectId || params.pid || '';
  const metamodelId = props.metamodelId || params.mmid || '';

  const [metamodel, setMetamodel] = useState<Metamodel | null>(null);
  const [models, setModels] = useState<M1Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [modelName, setModelName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function load() {
    if (!projectId || !metamodelId) return;
    setLoading(true);
    setError('');
    try {
      const [mm, mList] = await Promise.all([
        getMetamodel(projectId, metamodelId),
        getM1Models(projectId, metamodelId),
      ]);
      setMetamodel(mm);
      setModels(mList);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load models');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [projectId, metamodelId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId || !metamodelId || !modelName.trim()) return;
    setSubmitting(true);
    try {
      await createM1Model(projectId, metamodelId, { name: modelName.trim() });
      setShowCreate(false);
      setModelName('');
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create model');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(modelId: string, name: string) {
    if (!projectId || !metamodelId) return;
    if (!window.confirm(`Delete model "${name}"?`)) return;
    setDeletingId(modelId);
    try {
      await deleteM1Model(projectId, metamodelId, modelId);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete model');
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div>
        <div className="skeleton" style={{ height: 32, width: 240, marginBottom: 24 }} />
        <div className="skeleton" style={{ height: 160, borderRadius: 'var(--radius)' }} />
      </div>
    );
  }

  if (error && !metamodel) {
    return <ErrorPanel title="Error" message={error} compact />;
  }

  return (
    <div>
      <div className="detail-header">
        <div className="detail-header-left">
          {!props.projectId && (
            <Link to={`/projects/${projectId}`} className="back-link">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
              </svg>
              Back to Metamodels
            </Link>
          )}
          {metamodel && (
            <div>
              <h1 className="page-title" style={{ margin: 0 }}>
                {metamodel.name} — Models
              </h1>
              <p className="page-subtitle" style={{ marginTop: 2 }}>
                M1 model instances based on this metamodel
              </p>
            </div>
          )}
        </div>
      </div>

      {error && <ErrorPanel title="Error" message={error} compact />}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 className="section-title" style={{ margin: 0 }}>
          Model Instances
          <span className="badge badge-primary" style={{ marginLeft: 10 }}>{models.length}</span>
        </h2>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)} disabled={!metamodel}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New Model Instance
        </button>
      </div>

      {models.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div className="empty-state-icon"><Layers size={24} /></div>
          <div className="empty-state-title">No model instances yet</div>
          <div className="empty-state-desc">
            Create a model instance to populate and edit M1 objects based on the &quot;{metamodel?.name}&quot; metamodel.
          </div>
        </div>
      )}

      {models.length > 0 && (
        <div className="mm-grid">
          {models.map((m) => (
            <div key={m.id} className="mm-card">
              <div className="mm-card-header">
                <span className="mm-card-name">{m.name}</span>
                <span className="badge badge-secondary" style={{ fontSize: '.6875rem' }}>
                  M1 Model
                </span>
              </div>

              <div className="mm-card-details">
                <div className="mm-card-detail">
                  <Box size={14} style={{opacity:0.5}} />
                  <span>ID: <code className="font-mono">{m.id.slice(0, 8)}…</code></span>
                </div>
                <div className="mm-card-detail">
                  <Calendar size={14} style={{opacity:0.5}} />
                  <span>{new Date(m.createdAt).toLocaleString()}</span>
                </div>
              </div>

              <div className="mm-card-actions">
                <Link
                  to={`/projects/${projectId}/metamodels/${metamodelId}/models/${m.id}/edit`}
                  className="btn btn-primary btn-sm"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                  </svg>
                  Open Editor
                </Link>
                <button
                  className="btn btn-sm btn-ghost"
                  style={{ color: 'var(--danger)', marginLeft: 'auto' }}
                  onClick={() => handleDelete(m.id, m.name)}
                  disabled={deletingId === m.id}
                >
                  {deletingId === m.id ? '...' : <Trash2 size={14} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="form-overlay" onClick={() => setShowCreate(false)}>
          <div className="form-panel" onClick={(e) => e.stopPropagation()}>
            <h2>New Model Instance</h2>
            <form onSubmit={handleCreate}>
              <div className="form-field">
                <label htmlFor="modelname">Name *</label>
                <input
                  id="modelname"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  placeholder="e.g., MyLibrary"
                  autoFocus
                  required
                />
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Model'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
