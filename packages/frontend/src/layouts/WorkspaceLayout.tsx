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
import { getProjects } from '../api/client';
import type { Project } from '../api/client';

// Tab content components
import { DiagramTab, OCLTab, CodeGenTab, ModelsTab, SpecTab, ProjectInfoTab } from '../components/workspace/tabs';

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
}

function TabContent({ tab, onOpenTab }: TabContentProps) {
  switch (tab.type) {
    case 'welcome':
      return <WelcomeTabWrapper />;
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
function WelcomeTabWrapper() {
  const { openTab, setContext } = useWorkspace();
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    getProjects()
      .then((res) => setProjects(res.items))
      .catch(() => {});
  }, []);

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
    // TODO: Open create project modal
  }, []);

  const handleImportEcore = useCallback(() => {
    // TODO: Open import dialog
  }, []);

  return (
    <WelcomeTab
      projects={projects}
      onOpenProject={handleOpenProject}
      onCreateProject={handleCreateProject}
      onImportEcore={handleImportEcore}
    />
  );
}

// ─── Inner Layout (needs context access) ─────────────────────────────────

function WorkspaceInner() {
  const workspace = useWorkspace();
  const editor = useEditorContext();
  const panels = usePanelPortals();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

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
          break;
        case 'save':
          editor.actions.save();
          break;
        case 'import-ecore':
          editor.actions.importEcore();
          break;
        case 'export-ecore':
          editor.actions.exportEcore();
          break;
        case 'export-zip':
          editor.actions.exportZip();
          break;
        case 'validate':
          editor.actions.validate();
          break;
        case 'undo':
          editor.actions.undo();
          break;
        case 'redo':
          editor.actions.redo();
          break;
        default:
          break;
      }
    },
    [editor.actions],
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
        <div data-tour="sidebar" style={{ display: workspace.sidebarOpen ? undefined : 'none' }}>
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
            />
            {/* Portal target for editor panels (Toolbox + TreeView) */}
            <div ref={panels.leftPanelRef} style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--border)' }} />
          </ResizablePanel>
        </div>

        {/* Main Content Area */}
        <div style={styles.content}>
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
                <TabContent tab={activeTab} onOpenTab={handleOpenTab} />
              </Suspense>
            </div>
          ) : (
            <div style={styles.emptyContent}>
              No tabs open. Use the sidebar to open a metamodel.
            </div>
          )}
        </div>

        {/* Right Panel (Inspector/Properties — filled via portal by active editor) */}
        <div
          style={{
            ...styles.rightPanel,
            ...(panels.rightPanelVisible ? {} : styles.rightPanelHidden),
          }}
        >
          <div
            ref={panels.rightPanelRef}
            style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', background: 'var(--surface)' }}
          />
        </div>
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
