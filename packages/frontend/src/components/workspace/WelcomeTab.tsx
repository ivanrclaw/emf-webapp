import React from 'react';
import { Plus, Upload, ExternalLink, FolderOpen } from '../icons';

interface Project {
  id: string;
  name: string;
  updatedAt: string;
}

interface WelcomeTabProps {
  projects: Project[];
  onOpenProject: (id: string) => void;
  onCreateProject: () => void;
  onImportEcore: () => void;
}

export const WelcomeTab: React.FC<WelcomeTabProps> = ({
  projects,
  onOpenProject,
  onCreateProject,
  onImportEcore,
}) => {
  const recentProjects = projects.slice(0, 5);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '48px 24px',
        overflowY: 'auto',
        height: '100%',
        backgroundColor: 'var(--bg)',
        color: 'var(--text)',
      }}
    >
      <div style={{ width: '100%', maxWidth: 800 }}>
        {/* Header */}
        <header style={{ textAlign: 'center', marginBottom: 48 }}>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 700,
              margin: 0,
              color: 'var(--text)',
            }}
          >
            EMF WebApp
          </h1>
          <p
            style={{
              fontSize: 15,
              color: 'var(--text-secondary)',
              marginTop: 8,
              margin: '8px 0 0',
            }}
          >
            Model-Driven Engineering in the Browser
          </p>
        </header>

        {/* Recent Projects */}
        {recentProjects.length > 0 && (
          <section style={{ marginBottom: 40 }}>
            <h2
              style={{
                fontSize: 16,
                fontWeight: 600,
                marginBottom: 16,
                color: 'var(--text)',
              }}
            >
              Recent Projects
            </h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: 12,
              }}
            >
              {recentProjects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => onOpenProject(project.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '12px 16px',
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'border-color 0.15s, background-color 0.15s',
                    color: 'var(--text)',
                    width: '100%',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--primary)';
                    e.currentTarget.style.backgroundColor = 'var(--primary-bg)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.backgroundColor = 'var(--surface)';
                  }}
                >
                  <FolderOpen size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                  <div style={{ overflow: 'hidden' }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {project.name}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--text-secondary)',
                        marginTop: 2,
                        fontFamily: 'monospace',
                      }}
                    >
                      {project.updatedAt}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Quick Start */}
        <section>
          <h2
            style={{
              fontSize: 16,
              fontWeight: 600,
              marginBottom: 16,
              color: 'var(--text)',
            }}
          >
            Quick Start
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 12,
            }}
          >
            {/* New Project */}
            <button
              onClick={onCreateProject}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 10,
                padding: '20px 16px',
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                cursor: 'pointer',
                transition: 'border-color 0.15s, background-color 0.15s',
                color: 'var(--text)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--primary)';
                e.currentTarget.style.backgroundColor = 'var(--primary-bg)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.backgroundColor = 'var(--surface)';
              }}
            >
              <Plus size={24} style={{ color: 'var(--primary)' }} />
              <span style={{ fontSize: 14, fontWeight: 500 }}>New Project</span>
            </button>

            {/* Import .ecore */}
            <button
              onClick={onImportEcore}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 10,
                padding: '20px 16px',
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                cursor: 'pointer',
                transition: 'border-color 0.15s, background-color 0.15s',
                color: 'var(--text)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--primary)';
                e.currentTarget.style.backgroundColor = 'var(--primary-bg)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.backgroundColor = 'var(--surface)';
              }}
            >
              <Upload size={24} style={{ color: 'var(--primary)' }} />
              <span style={{ fontSize: 14, fontWeight: 500 }}>Import .ecore</span>
            </button>

            {/* Documentation */}
            <a
              href="https://github.com/ivanrclaw/emf-webapp"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 10,
                padding: '20px 16px',
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                cursor: 'pointer',
                transition: 'border-color 0.15s, background-color 0.15s',
                color: 'var(--text)',
                textDecoration: 'none',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--primary)';
                e.currentTarget.style.backgroundColor = 'var(--primary-bg)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.backgroundColor = 'var(--surface)';
              }}
            >
              <ExternalLink size={24} style={{ color: 'var(--primary)' }} />
              <span style={{ fontSize: 14, fontWeight: 500 }}>Documentation</span>
            </a>
          </div>
        </section>
      </div>
    </div>
  );
};

export default WelcomeTab;
