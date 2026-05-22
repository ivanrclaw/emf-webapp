/**
 * WorkspaceLayout — Shell principal del editor integrado.
 *
 * Estructura:
 *   ┌─────────────────────────────────────────────────────────┐
 *   │ TabBar                                                   │
 *   ├────────┬──────────────────────────────────┬─────────────┤
 *   │Sidebar │ Toolbar                           │ Right Panel │
 *   │(resize)│ Active Tab Content                │ (Inspector) │
 *   │        │                                   │             │
 *   ├────────┴──────────────────────────────────┴─────────────┤
 *   │ StatusBar                                                │
 *   └─────────────────────────────────────────────────────────┘
 */
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWorkspace, type TabType, type WorkspaceTab } from '../hooks/useWorkspace';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useToast } from '../components/ToastProvider';
import Sidebar from '../components/workspace/Sidebar';
import { TabBar } from '../components/workspace/TabBar';
import { StatusBar } from '../components/workspace/StatusBar';
import { WelcomeTab } from '../components/workspace/WelcomeTab';
import { Toolbar } from '../components/workspace/Toolbar';
import { CommandPalette } from '../components/workspace/CommandPalette';
import ResizablePanel from '../components/workspace/ResizablePanel';
import { OnboardingTour } from '../components/workspace/OnboardingTour';
import { EditorProvider, useEditorContext } from '../contexts/EditorContext';
import { PanelPortalProvider, usePanelPortals } from '../contexts/PanelPortalContext';
import { getProjects, createProject } from '../api/client';
import type { Project } from '../api/client';

// Tab content components
import { DiagramTab, OCLTab, CodeGenTab, ModelsTab, ModelEditorTab, SpecTab, ProjectInfoTab } from '../components/workspace/tabs';

// ─── Styles ──────────────────────────────────────────────────────────────

const styles = {
  root: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100vh',
    width: '100vw',
    overflow: 'hidden',
    background: 'var(--bg)',
  },
  body: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column' as const,
    position: 'relative' as const,
    background: 'var(--bg)',
    minWidth: 0,
  },
  tabContent: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative' as const,
  },
  emptyContent: {
    flex: 1,
    display: 'flex',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    color: 'var(--text-muted)',
    fontSize: 14,
  },
  rightPanel: {
    flexShrink: 0,
    borderLeft: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column' as const,
    background: 'var(--surface)',
    overflow: 'hidden',
    width: 300,
    minHeight: 0,
  },
  rightPanelHidden: {
    display: 'none' as const,
  },
};

// ─── Tab Content Router ──────────────────────────────────────────────────

interface TabContentProps {
  tab: WorkspaceTab;
  onOpenTab: (tab: { type: string; title: string; projectId: string; metamodelId?: string }) => void;
  onShowCreateProject: () => void;
  onShowImportEcore: () => void;
  projectRefreshKey?: number;
}

function TabContent({ tab, onOpenTab, onShowCreateProject, onShowImportEcore, projectRefreshKey }: TabContentProps) {
  switch (tab.type) {
    case 'welcome':
      return <WelcomeTabWrapper onShowCreateProject={onShowCreateProject} onShowImportEcore={onShowImportEcore} projectRefreshKey={projectRefreshKey} />;
    case 'diagram':
      return (
        <DiagramTab
          projectId={tab.projectId || ''}
          metamodelId={tab.metamodelId || ''}
        />
      );
    case 'ocl':
      return (
        <OCLTab
          projectId={tab.projectId || ''}
          metamodelId={tab.metamodelId || ''}
        />
      );
    case 'codegen':
      return (
        <CodeGenTab
          projectId={tab.projectId || ''}
          metamodelId={tab.metamodelId || ''}
        />
      );
    case 'models':
      return (
        <ModelsTab
          projectId={tab.projectId || ''}
          metamodelId={tab.metamodelId || ''}
        />
      );
    case 'model-editor':
      return (
        <ModelEditorTab
          projectId={tab.projectId || ''}
          metamodelId={tab.metamodelId || ''}
          modelId={tab.modelId || ''}
        />
      );
    case 'spec':
      return (
        <SpecTab
          projectId={tab.projectId || ''}
          metamodelId={tab.metamodelId || ''}
        />
      );
    case 'project-info':
      return (
        <ProjectInfoTab
          projectId={tab.projectId || ''}
          onOpenTab={onOpenTab}
        />
      );
    default:
      return (
        <div style={styles.emptyContent}>
          Unknown tab type: {tab.type}
        </div>
      );
  }
}

/**
 * WelcomeTab wrapper that fetches projects and wires actions.
 */
interface WelcomeTabWrapperProps {
  onShowCreateProject: () => void;
  onShowImportEcore: () => void;
  projectRefreshKey?: number;
}

function WelcomeTabWrapper({ onShowCreateProject, onShowImportEcore, projectRefreshKey }: WelcomeTabWrapperProps) {
  const { openTab, setContext } = useWorkspace();
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    getProjects()
      .then((res) => setProjects(res.items))
      .catch(() => {});
  }, [projectRefreshKey]);

  const handleOpenProject = useCallback(
    (projectId: string) => {
      setContext(projectId);
      openTab({
        type: 'project-info',
        title: projects.find((p) => p.id === projectId)?.name || 'Project',
        projectId,
        metamodelId: null,
        dirty: false,
        closable: true,
      });
    },
    [openTab, setContext, projects],
  );

  const handleCreateProject = useCallback(() => {
    onShowCreateProject();
  }, [onShowCreateProject]);

  const handleImportEcore = useCallback(() => {
    onShowImportEcore();
  }, [onShowImportEcore]);

  return (
    <WelcomeTab
      projects={projects}
      onOpenProject={handleOpenProject}
      onCreateProject={handleCreateProject}
      onImportEcore={handleImportEcore}
    />
  );
}

// ─── Create Project Modal ──────────────────────────────────────────────

const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const modalCardStyle: React.CSSProperties = {
  backgroundColor: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: 24,
  minWidth: 360,
  maxWidth: 480,
  width: '100%',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
};

const modalTitleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 600,
  margin: '0 0 16px',
  color: 'var(--text)',
};

const fieldLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 500,
  marginBottom: 6,
  color: 'var(--text-secondary)',
};

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

const modalActionsStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
  marginTop: 20,
};

const buttonBaseStyle: React.CSSProperties = {
  padding: '8px 16px',
  fontSize: 14,
  fontWeight: 500,
  borderRadius: 4,
  cursor: 'pointer',
  border: '1px solid var(--border)',
  transition: 'opacity 0.15s',
};

interface CreateProjectModalProps {
  onClose: () => void;
  onCreated: (projectId: string, projectName: string) => void;
}

function CreateProjectModal({ onClose, onCreated }: CreateProjectModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Project name is required');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const project = await createProject({ name: trimmed, description: description.trim() || undefined });
      onCreated(project.id, project.name);
    } catch (err: any) {
      setError(err?.message || 'Failed to create project');
    } finally {
      setLoading(false);
    }
  }, [name, description, onCreated]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !loading) {
        handleSubmit();
      }
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [handleSubmit, loading, onClose],
  );

  return (
    <div style={modalOverlayStyle} onClick={onClose} onKeyDown={handleKeyDown} tabIndex={-1}>
      <div style={modalCardStyle} onClick={(e) => e.stopPropagation()}>
        <h2 style={modalTitleStyle}>New Project</h2>
        <div>
          <label style={fieldLabelStyle}>Name *</label>
          <input
            style={inputStyle}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Project"
            autoFocus
            disabled={loading}
          />
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={fieldLabelStyle}>Description (optional)</label>
          <textarea
            style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Project description"
            disabled={loading}
          />
        </div>
        {error && (
          <div style={{ color: 'var(--error)', fontSize: 13, marginTop: 8 }}>
            {error}
          </div>
        )}
        <div style={modalActionsStyle}>
          <button
            style={buttonBaseStyle}
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            style={{
              ...buttonBaseStyle,
              backgroundColor: 'var(--primary)',
              color: '#fff',
              border: '1px solid var(--primary)',
              opacity: loading ? 0.6 : 1,
            }}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Import Ecore Modal ─────────────────────────────────────────────────

interface ImportEcoreModalProps {
  onClose: () => void;
  addToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => string;
  onCreated: (projectId: string, projectName: string) => void;
}

function ImportEcoreModal({ onClose, addToast, onCreated }: ImportEcoreModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Auto-open file picker on mount
    fileInputRef.current?.click();
  }, []);

  const handleFileSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const xml = await file.text();

      // Step 1: Create a new project
      const projectName = file.name.replace(/\.(ecore|xml)$/i, '');
      const project = await createProject({ name: projectName });

      // Step 2: Create a metamodel within the project
      const res = await fetch(`/api/projects/${project.id}/metamodels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: projectName }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.message || 'Failed to create metamodel');
      }
      const metamodel = await res.json();

      // Step 3: Import the .ecore XML into the metamodel
      const importRes = await fetch(`/api/projects/${project.id}/xmi/${metamodel.id}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ xml }),
      });
      if (!importRes.ok) {
        const errBody = await importRes.json().catch(() => ({}));
        throw new Error(errBody.message || 'Failed to import .ecore');
      }

      addToast(`Imported ${file.name} successfully`, 'success');

      // Step 4: Navigate to project via callback
      onCreated(project.id, projectName);
      onClose();
    } catch (err: any) {
      addToast(err?.message || 'Failed to import .ecore file', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast, onCreated, onClose]);

  return (
    <div style={modalOverlayStyle} onClick={loading ? undefined : onClose}>
      <div style={modalCardStyle} onClick={(e) => e.stopPropagation()}>
        <h2 style={modalTitleStyle}>Import .ecore</h2>
        {loading ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Importing and creating project...</p>
        ) : (
          <>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: '0 0 16px' }}>
              Select an .ecore or .xml file to import.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".ecore,.xml"
              style={{ display: 'none' }}
              onChange={handleFileSelected}
            />
            <div style={modalActionsStyle}>
              <button style={buttonBaseStyle} onClick={onClose}>
                Cancel
              </button>
              <button
                style={{
                  ...buttonBaseStyle,
                  backgroundColor: 'var(--primary)',
                  color: '#fff',
                  border: '1px solid var(--primary)',
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                Browse Files
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Inner Layout (needs context access) ─────────────────────────────────

function WorkspaceInner() {
  const workspace = useWorkspace();
  const editor = useEditorContext();
  const panels = usePanelPortals();
  const { addToast } = useToast();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showImportEcore, setShowImportEcore] = useState(false);
  const [projectRefreshKey, setProjectRefreshKey] = useState(0);

  // Responsive sidebar: auto-collapse < 1024px, restore >= 1024px
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const manuallyToggled = useRef(false);

  useEffect(() => {
    if (!isDesktop) {
      if (workspace.sidebarOpen) {
        workspace.toggleSidebar();
      }
      manuallyToggled.current = false;
    } else {
      if (!workspace.sidebarOpen && !manuallyToggled.current) {
        workspace.toggleSidebar();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDesktop]);

  const activeTab = useMemo(
    () => workspace.tabs.find((t) => t.id === workspace.activeTabId) || null,
    [workspace.tabs, workspace.activeTabId],
  );

  // Handle sidebar tab opening
  const handleOpenTab = useCallback(
    (tabInfo: { type: string; title: string; projectId: string; metamodelId?: string }) => {
      // Intercept special tab types that open modals
      if (tabInfo.type === 'new-project') {
        setShowCreateProject(true);
        return;
      }
      if (tabInfo.type === 'import-ecore') {
        setShowImportEcore(true);
        return;
      }
      workspace.setContext(tabInfo.projectId, tabInfo.metamodelId);
      workspace.openTab({
        type: tabInfo.type as TabType,
        title: tabInfo.title,
        projectId: tabInfo.projectId,
        metamodelId: tabInfo.metamodelId || null,
        dirty: false,
        closable: true,
      });
    },
    [workspace],
  );

  // Toolbar action handler — delegates to EditorContext when available
  const handleToolbarAction = useCallback(
    async (action: string) => {
      switch (action) {
        case 'toggle-theme': {
          const html = document.documentElement;
          const current = html.getAttribute('data-theme');
          html.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark');
          localStorage.setItem('theme', current === 'dark' ? 'light' : 'dark');
          break;
        }
        case 'settings':
          addToast('Settings panel coming soon', 'info');
          break;
        case 'save':
          editor.actions.save();
          break;
        case 'import-ecore':
          editor.actions.importEcore();
          break;
        case 'import-eclipse-zip':
          editor.actions.importEclipseZip();
          break;
        case 'export-ecore':
          addToast('Exporting .ecore file...', 'info');
          editor.actions.exportEcore();
          break;
        case 'export-zip':
          addToast('Exporting .zip file...', 'info');
          editor.actions.exportZip();
          break;
        case 'validate':
          editor.actions.validate();
          addToast('Validation complete', 'success');
          break;
        case 'undo':
          editor.actions.undo();
          break;
        case 'redo':
          editor.actions.redo();
          break;
        default:
          // Dispatch OCL commands as CustomEvents for OCLConstraintPage to handle
          if (action.startsWith('ocl-')) {
            window.dispatchEvent(new CustomEvent('ocl-command', { detail: action }));
          }
          break;
      }
    },
    [editor.actions, addToast],
  );

  // Command palette action handler
  const handleCommandAction = useCallback(
    (action: { type: string; payload: any }) => {
      setCommandPaletteOpen(false);
      switch (action.type) {
        case 'switch-tab':
          workspace.setActiveTab(action.payload.tabId);
          break;
        case 'open-tab':
          handleOpenTab(action.payload);
          break;
        case 'action':
          handleToolbarAction(action.payload);
          break;
      }
    },
    [workspace, handleOpenTab, handleToolbarAction],
  );

  // Centralized keyboard shortcuts
  useKeyboardShortcuts({
    onAction: handleToolbarAction,
    onToggleCommandPalette: () => setCommandPaletteOpen((v) => !v),
    onToggleSidebar: () => {
      manuallyToggled.current = workspace.sidebarOpen;
      workspace.toggleSidebar();
    },
    onCloseTab: () => {
      if (workspace.activeTabId) {
        workspace.closeTab(workspace.activeTabId);
      }
    },
    onNextTab: () => {
      const idx = workspace.tabs.findIndex((t) => t.id === workspace.activeTabId);
      if (idx >= 0 && workspace.tabs.length > 1) {
        const nextIdx = (idx + 1) % workspace.tabs.length;
        workspace.setActiveTab(workspace.tabs[nextIdx].id);
      }
    },
    onPreviousTab: () => {
      const idx = workspace.tabs.findIndex((t) => t.id === workspace.activeTabId);
      if (idx >= 0 && workspace.tabs.length > 1) {
        const prevIdx = (idx - 1 + workspace.tabs.length) % workspace.tabs.length;
        workspace.setActiveTab(workspace.tabs[prevIdx].id);
      }
    },
    onEscape: () => setCommandPaletteOpen(false),
    isCommandPaletteOpen: commandPaletteOpen,
  });

  // Compute status bar props from editor context
  const statusProps = useMemo(() => {
    return {
      validationStatus: editor.state.validationStatus,
      collaborators: editor.state.collaborators,
      connected: editor.state.connected,
      lastSaved: null,
      dirty: editor.state.dirty,
    };
  }, [editor.state]);

  return (
    <div style={styles.root}>
      {/* Tab Bar */}
      <div data-tour="tabbar">
        <TabBar
          tabs={workspace.tabs.map((t) => ({
            id: t.id,
            type: t.type,
            title: t.title,
            dirty: t.dirty,
            closable: t.closable,
          }))}
          activeTabId={workspace.activeTabId}
          onActivate={workspace.setActiveTab}
          onClose={workspace.closeTab}
        />
      </div>

      {/* Body: Sidebar + Content + Right Panel */}
      <div style={styles.body}>
        {/* Left Sidebar */}
        <div data-tour="sidebar" role="navigation" aria-label="Project explorer" style={{ display: workspace.sidebarOpen ? undefined : 'none' }}>
          <ResizablePanel
            direction="right"
            defaultWidth={260}
            minWidth={200}
            maxWidth={400}
            storageKey="emf-sidebar-width"
            style={{ flexDirection: 'column', overflow: 'hidden' }}
          >
            <Sidebar
              collapsed={!workspace.sidebarOpen}
              onToggle={() => {
                manuallyToggled.current = workspace.sidebarOpen;
                workspace.toggleSidebar();
              }}
              onOpenTab={handleOpenTab}
              currentProjectId={workspace.currentProjectId || undefined}
              currentMetamodelId={workspace.currentMetamodelId || undefined}
              projectRefreshKey={projectRefreshKey}
              onProjectDeleted={(projectId) => {
                setProjectRefreshKey((k) => k + 1);
                workspace.closeProjectTabs(projectId);
              }}
            />
            {/* Portal target for editor panels (Toolbox + TreeView) */}
            <div ref={panels.leftPanelRef} style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--border)' }} />
          </ResizablePanel>
        </div>

        {/* Main Content Area */}
        <main style={styles.content} aria-label="Editor">
          {/* Contextual Toolbar */}
          <Toolbar
            activeTabType={activeTab?.type || null}
            onAction={handleToolbarAction}
            dirty={editor.state.dirty}
            validationStatus={editor.state.validationStatus}
            sidebarOpen={workspace.sidebarOpen}
            onToggleSidebar={() => {
              manuallyToggled.current = workspace.sidebarOpen;
              workspace.toggleSidebar();
            }}
          />

          {activeTab ? (
            <div style={styles.tabContent} role="tabpanel" aria-label={activeTab.title}>
              <Suspense fallback={<div style={styles.emptyContent}><span>Loading...</span></div>}>
                <TabContent tab={activeTab} onOpenTab={handleOpenTab} onShowCreateProject={() => setShowCreateProject(true)} onShowImportEcore={() => setShowImportEcore(true)} projectRefreshKey={projectRefreshKey} />
              </Suspense>
            </div>
          ) : (
            <div style={styles.emptyContent}>
              No tabs open. Use the sidebar to open a metamodel.
            </div>
          )}
        </main>
        {/* Right Panel (Inspector/Properties — filled via portal by active editor) */}
        <aside
          aria-label="Properties inspector"
          style={{
            ...styles.rightPanel,
            ...(panels.rightPanelVisible ? {} : styles.rightPanelHidden),
          }}
        >
          <div
            ref={panels.rightPanelRef}
            style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', background: 'var(--surface)' }}
          />
        </aside>
      </div>

      {/* Status Bar */}
      <StatusBar {...statusProps} />

      {/* Command Palette */}
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onAction={handleCommandAction}
      />

      {/* Onboarding Tour */}
      <OnboardingTour />

      {/* Create Project Modal */}
      {showCreateProject && <CreateProjectModal
        onClose={() => setShowCreateProject(false)}
        onCreated={(projectId, projectName) => {
          setShowCreateProject(false);
          setProjectRefreshKey((k) => k + 1);
          workspace.setContext(projectId);
          workspace.openTab({
            type: 'project-info',
            title: projectName || 'Project',
            projectId,
            metamodelId: null,
            dirty: false,
            closable: true,
          });
        }}
      />}

      {/* Import Ecore File Picker */}
      {showImportEcore && <ImportEcoreModal
        onClose={() => setShowImportEcore(false)}
        addToast={addToast}
        onCreated={(projectId, projectName) => {
          setShowImportEcore(false);
          setProjectRefreshKey((k) => k + 1);
          workspace.setContext(projectId);
          workspace.openTab({
            type: 'project-info',
            title: projectName || 'Project',
            projectId,
            metamodelId: null,
            dirty: false,
            closable: true,
          });
        }}
      />}
    </div>
  );
}

// ─── Main Layout (wraps with providers) ──────────────────────────────────

export function WorkspaceLayout() {
  return (
    <EditorProvider>
      <PanelPortalProvider>
        <WorkspaceInner />
      </PanelPortalProvider>
    </EditorProvider>
  );
}

export default WorkspaceLayout;
