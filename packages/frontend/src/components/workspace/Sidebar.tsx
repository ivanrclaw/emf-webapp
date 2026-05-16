import { useState, useEffect, useCallback } from 'react';
import {
  Folder,
  FolderOpen,
  Box,
  List,
  Hash,
  Workflow,
  Code,
  Play,
  Plus,
  Upload,
  ChevronRight,
  ChevronDown,
  PanelLeftClose,
  Package,
  Pencil,
  Link2,
} from '../icons';
import {
  getProjects,
  getMetamodels,
  type Project,
  type Metamodel,
} from '../../api/client';

// ── Types ────────────────────────────────────────────────────────────

interface TabDescriptor {
  type: string;
  title: string;
  projectId: string;
  metamodelId?: string;
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onOpenTab: (tab: TabDescriptor) => void;
  currentProjectId?: string;
  currentMetamodelId?: string;
}

interface ProjectNode {
  project: Project;
  expanded: boolean;
  metamodels: Metamodel[];
  loading: boolean;
  error: string | null;
}

// ── Sidebar Component ────────────────────────────────────────────────

export default function Sidebar({
  collapsed,
  onToggle,
  onOpenTab,
  currentProjectId,
  currentMetamodelId,
}: SidebarProps) {
  const [projects, setProjects] = useState<ProjectNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getProjects();
      setProjects(
        res.items.map((p) => ({
          project: p,
          expanded: false,
          metamodels: [],
          loading: false,
          error: null,
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const toggleProject = async (index: number) => {
    setProjects((prev) => {
      const next = [...prev];
      const node = { ...next[index] };
      node.expanded = !node.expanded;
      next[index] = node;
      return next;
    });

    const node = projects[index];
    if (!node.expanded && node.metamodels.length === 0) {
      // Fetch metamodels on first expand
      setProjects((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], loading: true, error: null };
        return next;
      });
      try {
        const metamodels = await getMetamodels(node.project.id);
        setProjects((prev) => {
          const next = [...prev];
          next[index] = { ...next[index], metamodels, loading: false };
          return next;
        });
      } catch (err) {
        setProjects((prev) => {
          const next = [...prev];
          next[index] = {
            ...next[index],
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to load',
          };
          return next;
        });
      }
    }
  };

  // ── Styles ───────────────────────────────────────────────────────

  const sidebarStyle: React.CSSProperties = {
    width: '100%',
    minWidth: 0,
    flex: '0 1 auto',
    maxHeight: '50%',
    background: 'var(--surface)',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    transition: 'width 0.2s ease, min-width 0.2s ease',
    userSelect: 'none',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: collapsed ? 'center' : 'space-between',
    padding: collapsed ? '12px 8px' : '12px 14px',
    borderBottom: '1px solid var(--border)',
    gap: 8,
    flexShrink: 0,
  };

  const logoStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    overflow: 'hidden',
    whiteSpace: 'nowrap',
  };

  const logoTextStyle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text)',
    opacity: collapsed ? 0 : 1,
    transition: 'opacity 0.15s ease',
    width: collapsed ? 0 : 'auto',
    overflow: 'hidden',
  };

  const toggleBtnStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 4,
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'color 0.15s ease, background 0.15s ease',
  };

  const explorerStyle: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: collapsed ? '8px 4px' : '8px 0',
  };

  const sectionLabelStyle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--text-muted)',
    padding: '8px 14px 4px',
    opacity: collapsed ? 0 : 1,
    transition: 'opacity 0.15s ease',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
  };

  const quickActionsStyle: React.CSSProperties = {
    borderTop: '1px solid var(--border)',
    padding: collapsed ? '8px 4px' : '8px 10px',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  };

  // ── Render helpers ─────────────────────────────────────────────────

  const renderSkeleton = () => (
    <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            height: 28,
            borderRadius: 'var(--radius-sm)',
            background: 'var(--border)',
            opacity: 0.5,
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        />
      ))}
      <style>{`@keyframes pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.6; } }`}</style>
    </div>
  );

  const renderError = (message: string, onRetry: () => void) => (
    <div
      style={{
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <span style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
        {message}
      </span>
      <button
        onClick={onRetry}
        style={{
          fontSize: 11,
          padding: '4px 10px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border)',
          background: 'var(--bg)',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
        }}
      >
        Retry
      </button>
    </div>
  );

  const renderMetamodelActions = (mm: Metamodel, projectId: string) => {
    const actions = [
      { type: 'diagram', icon: Workflow, title: `${mm.name} — Diagram` },
      { type: 'ocl', icon: Pencil, title: `${mm.name} — OCL` },
      { type: 'codegen', icon: Code, title: `${mm.name} — Code Gen` },
      { type: 'models', icon: Play, title: `${mm.name} — Models` },
    ];

    return (
      <div
        style={{
          display: 'flex',
          gap: 2,
          marginLeft: 'auto',
          opacity: 0,
          transition: 'opacity 0.15s ease',
        }}
        className="mm-actions"
      >
        {actions.map((action) => (
          <button
            key={action.type}
            title={action.type}
            onClick={(e) => {
              e.stopPropagation();
              onOpenTab({
                type: action.type,
                title: action.title,
                projectId,
                metamodelId: mm.id,
              });
            }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 2,
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              lineHeight: 0,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = 'var(--primary)';
              (e.currentTarget as HTMLElement).style.background = 'var(--primary-bg)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
              (e.currentTarget as HTMLElement).style.background = 'none';
            }}
          >
            <action.icon size={13} />
          </button>
        ))}
      </div>
    );
  };

  const renderProjectTree = () => {
    if (loading) return renderSkeleton();
    if (error) return renderError(error, fetchProjects);
    if (projects.length === 0) {
      return (
        <div
          style={{
            padding: '16px 14px',
            fontSize: 12,
            color: 'var(--text-muted)',
            textAlign: 'center',
          }}
        >
          No projects yet
        </div>
      );
    }

    return (
      <div role="tree" aria-label="Project explorer">
        {projects.map((node, idx) => {
      const isActive = node.project.id === currentProjectId;
      const FolderIcon = node.expanded ? FolderOpen : Folder;
      const ChevronIcon = node.expanded ? ChevronDown : ChevronRight;

      return (
        <div key={node.project.id} role="treeitem" aria-expanded={node.expanded} aria-label={node.project.name}>
          {/* Project row */}
          <div
            onClick={() => toggleProject(idx)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: collapsed ? '6px 8px' : '6px 10px',
              cursor: 'pointer',
              borderRadius: 'var(--radius-sm)',
              margin: '0 4px',
              transition: 'background 0.12s ease',
              background: isActive ? 'var(--primary-bg)' : 'transparent',
            }}
            onMouseEnter={(e) => {
              if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--bg)';
            }}
            onMouseLeave={(e) => {
              if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
          >
            {!collapsed && (
              <ChevronIcon size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            )}
            <FolderIcon
              size={15}
              style={{ color: 'var(--primary)', flexShrink: 0 }}
            />
            {!collapsed && (
              <span
                style={{
                  fontSize: 13,
                  color: 'var(--text)',
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                }}
              >
                {node.project.name}
              </span>
            )}
          </div>

          {/* Metamodels */}
          {node.expanded && !collapsed && (
            <div style={{ paddingLeft: 18, overflow: 'hidden' }}>
              {node.loading && (
                <div style={{ padding: '4px 10px' }}>
                  <div
                    style={{
                      height: 20,
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--border)',
                      opacity: 0.4,
                      animation: 'pulse 1.5s ease-in-out infinite',
                    }}
                  />
                </div>
              )}
              {node.error && (
                <div style={{ padding: '4px 10px', fontSize: 11, color: 'var(--text-muted)' }}>
                  {node.error}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // Reset and re-expand
                      setProjects((prev) => {
                        const next = [...prev];
                        next[idx] = { ...next[idx], expanded: false, metamodels: [], error: null };
                        return next;
                      });
                      setTimeout(() => toggleProject(idx), 50);
                    }}
                    style={{
                      marginLeft: 6,
                      fontSize: 11,
                      color: 'var(--primary)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    retry
                  </button>
                </div>
              )}
              {node.metamodels.map((mm) => {
                const isActiveMM = mm.id === currentMetamodelId;
                return (
                  <div
                    key={mm.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '5px 10px',
                      cursor: 'pointer',
                      borderRadius: 'var(--radius-sm)',
                      margin: '1px 4px',
                      transition: 'background 0.12s ease',
                      background: isActiveMM ? 'var(--primary-bg)' : 'transparent',
                    }}
                    onClick={() =>
                      onOpenTab({
                        type: 'diagram',
                        title: `${mm.name} — Diagram`,
                        projectId: node.project.id,
                        metamodelId: mm.id,
                      })
                    }
                    onMouseEnter={(e) => {
                      if (!isActiveMM)
                        (e.currentTarget as HTMLElement).style.background = 'var(--bg)';
                      const actions = e.currentTarget.querySelector('.mm-actions') as HTMLElement;
                      if (actions) actions.style.opacity = '1';
                    }}
                    onMouseLeave={(e) => {
                      if (!isActiveMM)
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                      const actions = e.currentTarget.querySelector('.mm-actions') as HTMLElement;
                      if (actions) actions.style.opacity = '0';
                    }}
                  >
                    <Package size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                    <span
                      style={{
                        fontSize: 12,
                        color: isActiveMM ? 'var(--primary)' : 'var(--text-secondary)',
                        fontWeight: isActiveMM ? 500 : 400,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1,
                      }}
                    >
                      {mm.name}
                    </span>
                    {renderMetamodelActions(mm, node.project.id)}
                  </div>
                );
              })}
              {!node.loading && !node.error && node.metamodels.length === 0 && (
                <div
                  style={{
                    padding: '6px 10px',
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    fontStyle: 'italic',
                  }}
                >
                  No metamodels
                </div>
              )}
            </div>
          )}
        </div>
      );
    })}
      </div>
    );
  };

  const renderQuickActionButton = (
    Icon: React.ComponentType<{ size: number }>,
    label: string,
    onClick: () => void,
  ) => (
    <button
      onClick={onClick}
      title={label}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: collapsed ? '8px 8px' : '7px 10px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        background: 'none',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        cursor: 'pointer',
        color: 'var(--text-secondary)',
        fontSize: 12,
        fontWeight: 500,
        transition: 'background 0.12s ease, border-color 0.12s ease, color 0.12s ease',
        width: '100%',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'var(--primary-bg)';
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary)';
        (e.currentTarget as HTMLElement).style.color = 'var(--primary)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'none';
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
        (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
      }}
    >
      <Icon size={14} />
      {!collapsed && <span>{label}</span>}
    </button>
  );

  // ── Main render ────────────────────────────────────────────────────

  return (
    <aside style={sidebarStyle}>
      {/* Header */}
      <div style={headerStyle}>
        {!collapsed && (
          <div style={logoStyle}>
            <Box size={18} style={{ color: 'var(--primary)' }} />
            <span style={logoTextStyle}>EMF Web</span>
          </div>
        )}
        <button
          onClick={onToggle}
          style={toggleBtnStyle}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'var(--bg)';
            (e.currentTarget as HTMLElement).style.color = 'var(--text)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'none';
            (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
          }}
        >
          <PanelLeftClose
            size={16}
            style={{
              transform: collapsed ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s ease',
            }}
          />
        </button>
      </div>

      {/* Explorer */}
      <div style={explorerStyle}>
        {!collapsed && <div style={sectionLabelStyle}>Explorer</div>}
        {renderProjectTree()}
      </div>

      {/* Quick Actions */}
      <div style={quickActionsStyle}>
        {!collapsed && (
          <div style={{ ...sectionLabelStyle, padding: '4px 4px 6px' }}>Quick Actions</div>
        )}
        {renderQuickActionButton(Plus, 'New Project', () =>
          onOpenTab({ type: 'new-project', title: 'New Project', projectId: '' }),
        )}
        {renderQuickActionButton(Upload, 'Import .ecore', () =>
          onOpenTab({ type: 'import-ecore', title: 'Import .ecore', projectId: '' }),
        )}
      </div>
    </aside>
  );
}
