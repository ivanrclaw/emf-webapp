import React, { useEffect, useState } from 'react';
import { getProject, getMetamodels } from '../../../api/client';
import { Box, Calendar, Hash, Link2, Pencil } from '../../icons';

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

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      getProject(projectId),
      getMetamodels(projectId),
    ])
      .then(([proj, mms]) => {
        setProject(proj);
        setMetamodels(mms);
      })
      .catch((err) => setError(err.message || 'Failed to load project'))
      .finally(() => setLoading(false));
  }, [projectId]);

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

      <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0 0 16px' }}>Metamodels</h2>

      {metamodels.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No metamodels yet.</p>
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
