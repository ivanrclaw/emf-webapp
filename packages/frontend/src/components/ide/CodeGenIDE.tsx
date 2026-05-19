import { useEffect, useCallback, useState, useMemo, useRef } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { IDEContext, useIDEReducer, type IDEFile } from './useIDEStore';
import { useEditorContext } from '../../contexts/EditorContext';
import { FileExplorer } from './FileExplorer';
import { EditorTabs } from './EditorTabs';
import { EditorPanel } from './EditorPanel';
import { OutputPanel } from './OutputPanel';
import { OutlinePanel } from './OutlinePanel';
import { Breadcrumbs } from './Breadcrumbs';
import { StatusBar } from './StatusBar';
import { IDEToolbar } from './IDEToolbar';
import { CommandPalette, type Command } from './CommandPalette';
import { QuickOpen } from './QuickOpen';
import { TemplateLibrary } from './TemplateLibrary';
import { UserSnippets } from './UserSnippets';
import { TemplateWizard } from './TemplateWizard';
import { HelpPanel } from './HelpPanel';
import {
  getTemplateProjects,
  getTemplateProject,
  createTemplateProject,
  addProjectFile,
  updateProjectFile,
  generateFromProject,
  getMetamodel,
  type TemplateProject,
} from '../../api/client';

interface CodeGenIDEProps {
  projectId: string;
  metamodelId: string;
}

export function CodeGenIDE({ projectId, metamodelId }: CodeGenIDEProps) {
  const ideContext = useIDEReducer();
  const { state, dispatch } = ideContext;
  const editor = useEditorContext();
  const isSavingRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Register save action with EditorContext so workspace toolbar Save button works
  useEffect(() => {
    editor.register(
      {
        save: () => {
          const s = stateRef.current;
          if (s.project && s.project.files.some((f) => f.isDirty) && !isSavingRef.current) {
            // Trigger save directly (not via SET_SAVING effect which may be disconnected)
            isSavingRef.current = true;
            const doSave = async () => {
              try {
                const dirtyFiles = s.project!.files.filter((f) => f.isDirty);
                const newFiles = dirtyFiles.filter((f) => f.isNew);
                const existingFiles = dirtyFiles.filter((f) => !f.isNew);
                if (newFiles.length > 0) {
                  const results = await Promise.all(
                    newFiles.map(async (f) => {
                      const created = await addProjectFile(metamodelId, s.project!.id, { filename: f.filename, template: f.content, language: f.language });
                      return { localId: f.id, serverId: created.id };
                    }),
                  );
                  for (const { localId, serverId } of results) {
                    dispatch({ type: 'FILE_PERSISTED', localId, serverId });
                  }
                }
                if (existingFiles.length > 0) {
                  await Promise.all(existingFiles.map((f) => updateProjectFile(metamodelId, s.project!.id, f.id, { filename: f.filename, template: f.content, language: f.language })));
                }
                const allDirtyIds = [...newFiles.map((f) => f.id), ...existingFiles.map((f) => f.id)];
                dispatch({ type: 'MARK_SAVED', fileIds: allDirtyIds });
              } catch (err) {
                console.error('Save failed:', err);
              } finally {
                isSavingRef.current = false;
              }
            };
            doSave();
          }
        },
        exportEcore: () => {},
        exportZip: () => {},
        exportGenmodel: () => {},
        autoLayout: () => {},
        importEcore: () => {},
        importEclipseZip: () => {},
        undo: () => {},
        redo: () => {},
        validate: () => {},
      },
      { dirty: false, loading: false, canUndo: false, canRedo: false, validationStatus: 'unknown', totalViolations: 0, nodeCount: 0, edgeCount: 0, packageName: '', connected: false, collaborators: 0 },
    );
    return () => editor.unregister();
    // Only register once on mount — use stateRef to avoid stale closures
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [quickOpenOpen, setQuickOpenOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [snippetsOpen, setSnippetsOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  // Stable callbacks for toolbar (avoid stale closure issues)
  const openLibrary = useCallback(() => setLibraryOpen(true), []);
  const openSnippets = useCallback(() => setSnippetsOpen(true), []);
  const openWizard = useCallback(() => setWizardOpen(true), []);
  const openHelp = useCallback(() => setHelpOpen(true), []);

  // ── Command definitions ────────────────────────────────────────────
  const commands: Command[] = useMemo(
    () => [
      {
        id: 'save',
        label: 'Save All',
        category: 'File',
        shortcut: 'Ctrl+S',
        action: () => {
          if (state.project?.files.some((f) => f.isDirty))
            dispatch({ type: 'SET_SAVING', saving: true });
        },
      },
      {
        id: 'generate',
        label: 'Generate Output',
        category: 'Run',
        shortcut: 'Ctrl+Enter',
        action: () => {
          if (state.project && !state.generating)
            dispatch({ type: 'SET_GENERATING', generating: true });
        },
      },
      {
        id: 'quick-open',
        label: 'Quick Open File',
        category: 'Navigation',
        shortcut: 'Ctrl+P',
        action: () => setQuickOpenOpen(true),
      },
      {
        id: 'toggle-live',
        label: 'Toggle Live Preview',
        category: 'View',
        action: () => dispatch({ type: 'TOGGLE_LIVE_PREVIEW' }),
      },
      {
        id: 'toggle-diff',
        label: 'Toggle Diff View',
        category: 'View',
        action: () => dispatch({ type: 'TOGGLE_DIFF_VIEW' }),
      },
      {
        id: 'close-tab',
        label: 'Close Active Tab',
        category: 'Editor',
        shortcut: 'Ctrl+W',
        action: () => {
          if (state.activeTab) dispatch({ type: 'CLOSE_TAB', fileId: state.activeTab });
        },
      },
      {
        id: 'next-tab',
        label: 'Next Tab',
        category: 'Editor',
        shortcut: 'Ctrl+Tab',
        action: () => {
          if (state.openTabs.length > 1 && state.activeTab) {
            const idx = state.openTabs.indexOf(state.activeTab);
            const next = state.openTabs[(idx + 1) % state.openTabs.length];
            dispatch({ type: 'SET_ACTIVE_TAB', fileId: next });
          }
        },
      },
      {
        id: 'prev-tab',
        label: 'Previous Tab',
        category: 'Editor',
        shortcut: 'Ctrl+Shift+Tab',
        action: () => {
          if (state.openTabs.length > 1 && state.activeTab) {
            const idx = state.openTabs.indexOf(state.activeTab);
            const prev =
              state.openTabs[(idx - 1 + state.openTabs.length) % state.openTabs.length];
            dispatch({ type: 'SET_ACTIVE_TAB', fileId: prev });
          }
        },
      },
      {
        id: 'new-file',
        label: 'New File',
        category: 'File',
        action: () => {
          if (state.project) {
            const newFile: IDEFile = {
              id: crypto.randomUUID(),
              filename: `template${state.project.files.length + 1}.mtl`,
              content:
                "[comment @main/]\n[module generate('http://example.org/1.0')/]\n\n[template public generate(e : EClass)]\n[/template]\n",
              language: 'mtl',
              isDirty: true,
              hasErrors: false,
              isNew: true,
            };
            dispatch({ type: 'ADD_FILE', file: newFile });
          }
        },
      },
      {
        id: 'template-library',
        label: 'Open Template Library',
        category: 'Templates',
        action: () => setLibraryOpen(true),
      },
      {
        id: 'user-snippets',
        label: 'Manage Snippets',
        category: 'Templates',
        action: () => setSnippetsOpen(true),
      },
      {
        id: 'template-wizard',
        label: 'New Template from Wizard',
        category: 'Templates',
        action: () => setWizardOpen(true),
      },
      {
        id: 'help',
        label: 'Open Help',
        category: 'Help',
        shortcut: 'F1',
        action: () => setHelpOpen(true),
      },
    ],
    [state.project, state.generating, state.activeTab, state.openTabs, dispatch],
  );

  // ── Load projects on mount ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function loadProjects() {
      try {
        const projects = await getTemplateProjects(metamodelId);
        if (cancelled) return;

        dispatch({
          type: 'LOAD_PROJECTS',
          projects: projects.map((p) => ({ id: p.id, name: p.name, fileCount: p.fileCount || 0 })),
        });

        if (projects.length > 0) {
          await loadProject(projects[0].id);
        }
      } catch (err) {
        // If the endpoint doesn't exist yet, start with empty state
        console.warn('Failed to load template projects:', err);
      }

      // Load metamodel content for context-aware completions
      try {
        const mm = await getMetamodel(projectId, metamodelId);
        if (cancelled) return;
        if (mm.content) {
          dispatch({ type: 'SET_METAMODEL_CONTENT', content: mm.content });
        }
      } catch (err) {
        console.warn('Failed to load metamodel for completions:', err);
      }
    }

    async function loadProject(tpId: string) {
      try {
        const tp = await getTemplateProject(metamodelId, tpId);
        if (cancelled) return;

        const files: IDEFile[] = (tp.files || []).map((f) => ({
          id: f.id,
          filename: f.name,
          content: f.template,
          language: f.language || 'mtl',
          isDirty: false,
          hasErrors: false,
        }));

        dispatch({
          type: 'LOAD_PROJECT',
          project: {
            id: tp.id,
            name: tp.name,
            description: tp.description,
            metamodelId: tp.metamodelId,
            files,
          },
        });

        // Restore session (open tabs + active tab) from localStorage
        try {
          const sessionKey = `ide-session-${tp.id}`;
          const saved = localStorage.getItem(sessionKey);
          if (saved) {
            const session = JSON.parse(saved) as { openTabs?: string[]; activeTab?: string | null };
            const fileIds = new Set(files.map((f) => f.id));
            // Only restore tabs that still exist
            const validTabs = (session.openTabs || []).filter((id: string) => fileIds.has(id));
            if (validTabs.length > 0) {
              for (const tabId of validTabs) {
                dispatch({ type: 'OPEN_FILE', fileId: tabId });
              }
              if (session.activeTab && fileIds.has(session.activeTab)) {
                dispatch({ type: 'SET_ACTIVE_TAB', fileId: session.activeTab });
              }
            }
          }
        } catch {
          // Ignore localStorage errors
        }
      } catch (err) {
        console.warn('Failed to load template project:', err);
      }
    }

    loadProjects();
    return () => { cancelled = true; };
  }, [projectId, metamodelId, dispatch]);

  // ── Handle generation trigger ───────────────────────────────────────
  useEffect(() => {
    if (!state.generating || !state.project) return;

    let cancelled = false;

    async function generate() {
      try {
        const result = await generateFromProject(metamodelId, state.project!.id);
        if (cancelled) return;
        dispatch({ type: 'SET_OUTPUT', output: result.files });
        dispatch({
          type: 'SET_EXECUTION_META',
          log: result.log || [],
          traces: result.traces || [],
          executionTime: result.executionTime ?? null,
          stats: result.stats || null,
        });
      } catch (err) {
        console.error('Generation failed:', err);
        dispatch({ type: 'SET_OUTPUT_STATUS', status: 'error' });
      } finally {
        if (!cancelled) {
          dispatch({ type: 'SET_GENERATING', generating: false });
        }
      }
    }

    generate();
    return () => { cancelled = true; };
  }, [state.generating, state.project?.id, metamodelId, dispatch]);

  // ── Live Preview: auto-generate on content change ──────────────────
  useEffect(() => {
    if (!state.livePreview || !state.project || state.project.files.length === 0) return;
    if (state.generating) return;

    dispatch({ type: 'SET_OUTPUT_STATUS', status: 'generating' });

    const timer = setTimeout(() => {
      dispatch({ type: 'SET_GENERATING', generating: true });
    }, 1500);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.project?.files.map(f => f.content).join('\n'), state.livePreview]);

  // ── Handle save trigger ─────────────────────────────────────────────
  useEffect(() => {
    if (!state.saving || !state.project) return;
    if (isSavingRef.current) return;
    isSavingRef.current = true;

    let cancelled = false;

    async function saveAll() {
      try {
        const dirtyFiles = state.project!.files.filter((f) => f.isDirty);
        const newFiles = dirtyFiles.filter((f) => f.isNew);
        const existingFiles = dirtyFiles.filter((f) => !f.isNew);

        // Persist new files via POST (addProjectFile)
        if (newFiles.length > 0) {
          const results = await Promise.all(
            newFiles.map(async (f) => {
              const created = await addProjectFile(metamodelId, state.project!.id, {
                filename: f.filename,
                template: f.content,
                language: f.language,
              });
              return { localId: f.id, serverId: created.id };
            }),
          );
          if (!cancelled) {
            for (const { localId, serverId } of results) {
              dispatch({ type: 'FILE_PERSISTED', localId, serverId });
            }
          }
        }

        // Update existing files via PUT (updateProjectFile)
        if (existingFiles.length > 0) {
          await Promise.all(
            existingFiles.map((f) =>
              updateProjectFile(metamodelId, state.project!.id, f.id, {
                filename: f.filename,
                template: f.content,
                language: f.language,
              }),
            ),
          );
        }

        if (cancelled) return;
        // Mark all original dirty files as saved (new files already marked by FILE_PERSISTED)
        const allDirtyIds = [...newFiles.map((f) => f.id), ...existingFiles.map((f) => f.id)];
        dispatch({ type: 'MARK_SAVED', fileIds: allDirtyIds });
      } catch (err) {
        console.error('Save failed:', err);
      } finally {
        isSavingRef.current = false;
        if (!cancelled) {
          dispatch({ type: 'SET_SAVING', saving: false });
        }
      }
    }

    saveAll();
    return () => { cancelled = true; };
  }, [state.saving, state.project?.id, metamodelId, dispatch]);

  // ── Auto-save every 5s if dirty files exist ─────────────────────────
  useEffect(() => {
    if (!state.project) return;

    const interval = setInterval(() => {
      if (isSavingRef.current) return; // Don't auto-save while manual save is in progress

      // Access the latest files via the state snapshot
      if (!state.project) return;
      const dirtyFiles = state.project.files.filter((f) => f.isDirty);
      if (dirtyFiles.length === 0) return;

      const newFiles = dirtyFiles.filter((f) => f.isNew);
      const existingFiles = dirtyFiles.filter((f) => !f.isNew);

      const promises: Promise<void>[] = [];

      // Persist new files via POST
      for (const f of newFiles) {
        promises.push(
          addProjectFile(metamodelId, state.project.id, {
            filename: f.filename,
            template: f.content,
            language: f.language,
          }).then((created) => {
            dispatch({ type: 'FILE_PERSISTED', localId: f.id, serverId: created.id });
          }),
        );
      }

      // Update existing files via PUT
      for (const f of existingFiles) {
        promises.push(
          updateProjectFile(metamodelId, state.project.id, f.id, {
            filename: f.filename,
            template: f.content,
            language: f.language,
          }).then(() => {}),
        );
      }

      if (promises.length === 0) return;

      Promise.all(promises)
        .then(() => {
          const allIds = [...newFiles.map((f) => f.id), ...existingFiles.map((f) => f.id)];
          dispatch({ type: 'MARK_SAVED', fileIds: allIds });
          dispatch({ type: 'SET_AUTO_SAVE_STATUS', status: 'saved' });
          setTimeout(() => {
            dispatch({ type: 'SET_AUTO_SAVE_STATUS', status: 'idle' });
          }, 2000);
        })
        .catch((err) => {
          console.error('Auto-save failed:', err);
          dispatch({ type: 'SET_AUTO_SAVE_STATUS', status: 'idle' });
        });
    }, 5000);

    return () => clearInterval(interval);
    // Use project.id to avoid recreating interval on every keystroke
  }, [state.project?.id, metamodelId, dispatch]);

  // ── Unsaved changes confirmation ────────────────────────────────────
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      const hasDirty = state.project?.files.some((f) => f.isDirty);
      if (hasDirty) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [state.project?.files]);

  // ── Session persistence (save open tabs + active tab) ───────────────
  useEffect(() => {
    if (!state.project) return;
    try {
      const sessionKey = `ide-session-${state.project.id}`;
      localStorage.setItem(
        sessionKey,
        JSON.stringify({ openTabs: state.openTabs, activeTab: state.activeTab }),
      );
    } catch {
      // Ignore localStorage errors
    }
  }, [state.project?.id, state.openTabs, state.activeTab]);

  // ── Create project handler ──────────────────────────────────────────
  const handleCreateProject = useCallback(async () => {
    try {
      const tp = await createTemplateProject(metamodelId, {
        name: 'New Project',
        description: 'Acceleo code generation project',
      });

      dispatch({
        type: 'LOAD_PROJECTS',
        projects: [...state.projects, { id: tp.id, name: tp.name, fileCount: 0 }],
      });

      dispatch({
        type: 'LOAD_PROJECT',
        project: {
          id: tp.id,
          name: tp.name,
          description: tp.description,
          metamodelId: tp.metamodelId,
          files: [],
        },
      });
    } catch (err) {
      console.error('Failed to create project:', err);
    }
  }, [metamodelId, state.projects, dispatch]);

  // ── Keyboard shortcuts ──────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;

      // Ctrl+S — Save
      if (ctrl && e.key === 's' && !e.shiftKey) {
        e.preventDefault();
        if (state.project && state.project.files.some((f) => f.isDirty) && !isSavingRef.current) {
          isSavingRef.current = true;
          const doSave = async () => {
            try {
              const dirtyFiles = state.project!.files.filter((f) => f.isDirty);
              const newFiles = dirtyFiles.filter((f) => f.isNew);
              const existingFiles = dirtyFiles.filter((f) => !f.isNew);
              if (newFiles.length > 0) {
                const results = await Promise.all(
                  newFiles.map(async (f) => {
                    const created = await addProjectFile(metamodelId, state.project!.id, { filename: f.filename, template: f.content, language: f.language });
                    return { localId: f.id, serverId: created.id };
                  }),
                );
                for (const { localId, serverId } of results) {
                  dispatch({ type: 'FILE_PERSISTED', localId, serverId });
                }
              }
              if (existingFiles.length > 0) {
                await Promise.all(existingFiles.map((f) => updateProjectFile(metamodelId, state.project!.id, f.id, { filename: f.filename, template: f.content, language: f.language })));
              }
              const allDirtyIds = [...newFiles.map((f) => f.id), ...existingFiles.map((f) => f.id)];
              dispatch({ type: 'MARK_SAVED', fileIds: allDirtyIds });
            } catch (err) {
              console.error('Save failed:', err);
            } finally {
              isSavingRef.current = false;
            }
          };
          doSave();
        }
      }
      // Ctrl+Enter — Generate
      if (ctrl && e.key === 'Enter') {
        e.preventDefault();
        if (state.project && state.project.files.length > 0 && !state.generating) {
          dispatch({ type: 'SET_GENERATING', generating: true });
        }
      }
      // Ctrl+Shift+P — Command Palette
      if (ctrl && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        setPaletteOpen(true);
      }
      // Ctrl+P — Quick Open
      if (ctrl && !e.shiftKey && e.key === 'p') {
        e.preventDefault();
        setQuickOpenOpen(true);
      }
      // Ctrl+W — Close tab
      if (ctrl && e.key === 'w') {
        e.preventDefault();
        if (state.activeTab) {
          dispatch({ type: 'CLOSE_TAB', fileId: state.activeTab });
        }
      }
      // Ctrl+Tab — Next tab
      if (ctrl && e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        if (state.openTabs.length > 1 && state.activeTab) {
          const idx = state.openTabs.indexOf(state.activeTab);
          const next = state.openTabs[(idx + 1) % state.openTabs.length];
          dispatch({ type: 'SET_ACTIVE_TAB', fileId: next });
        }
      }
      // Ctrl+Shift+Tab — Previous tab
      if (ctrl && e.key === 'Tab' && e.shiftKey) {
        e.preventDefault();
        if (state.openTabs.length > 1 && state.activeTab) {
          const idx = state.openTabs.indexOf(state.activeTab);
          const prev =
            state.openTabs[(idx - 1 + state.openTabs.length) % state.openTabs.length];
          dispatch({ type: 'SET_ACTIVE_TAB', fileId: prev });
        }
      }
      // F5 — Generate
      if (e.key === 'F5') {
        e.preventDefault();
        if (state.project && state.project.files.length > 0 && !state.generating) {
          dispatch({ type: 'SET_GENERATING', generating: true });
        }
      }
      // F1 — Help
      if (e.key === 'F1') {
        e.preventDefault();
        setHelpOpen(true);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [state.project, state.generating, state.activeTab, state.openTabs, dispatch]);

  // ── No project state ────────────────────────────────────────────────
  if (!state.project && state.projects.length === 0) {
    return (
      <IDEContext.Provider value={ideContext}>
        <div
          style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            color: 'var(--text-muted)',
            background: 'var(--bg)',
          }}
        >
          <div style={{ fontSize: 14 }}>No code generation project yet</div>
          <button className="btn btn-primary" onClick={handleCreateProject}>
            Create Project
          </button>
        </div>
      </IDEContext.Provider>
    );
  }

  return (
    <IDEContext.Provider value={ideContext}>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Toolbar */}
        <IDEToolbar
          onOpenLibrary={openLibrary}
          onOpenHelp={openHelp}
          onSave={() => {
            if (!state.project || isSavingRef.current) return;
            isSavingRef.current = true;
            // Direct save without going through SET_SAVING effect
            const doSave = async () => {
              try {
                const dirtyFiles = state.project!.files.filter((f) => f.isDirty);
                const newFiles = dirtyFiles.filter((f) => f.isNew);
                const existingFiles = dirtyFiles.filter((f) => !f.isNew);

                if (newFiles.length > 0) {
                  const results = await Promise.all(
                    newFiles.map(async (f) => {
                      const created = await addProjectFile(metamodelId, state.project!.id, {
                        filename: f.filename,
                        template: f.content,
                        language: f.language,
                      });
                      return { localId: f.id, serverId: created.id };
                    }),
                  );
                  for (const { localId, serverId } of results) {
                    dispatch({ type: 'FILE_PERSISTED', localId, serverId });
                  }
                }

                if (existingFiles.length > 0) {
                  await Promise.all(
                    existingFiles.map((f) =>
                      updateProjectFile(metamodelId, state.project!.id, f.id, {
                        filename: f.filename,
                        template: f.content,
                        language: f.language,
                      }),
                    ),
                  );
                }

                const allDirtyIds = [...newFiles.map((f) => f.id), ...existingFiles.map((f) => f.id)];
                dispatch({ type: 'MARK_SAVED', fileIds: allDirtyIds });
              } catch (err) {
                console.error('Save failed:', err);
              } finally {
                isSavingRef.current = false;
              }
            };
            doSave();
          }}
          onGenerate={() => {
            if (state.project && !state.generating) {
              dispatch({ type: 'SET_GENERATING', generating: true });
            }
          }}
        />

        {/* Main content */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <PanelGroup direction="horizontal" autoSaveId="ide-panels">
            {/* File Explorer */}
            <Panel defaultSize={18} minSize={12} collapsible>
              <FileExplorer />
            </Panel>

            <PanelResizeHandle
              style={{
                width: 4,
                background: 'var(--border)',
                cursor: 'col-resize',
                transition: 'background 0.15s',
              }}
            />

            {/* Editor + Output */}
            <Panel minSize={40}>
              <PanelGroup direction="vertical" autoSaveId="ide-panels-vertical">
                {/* Editor area */}
                <Panel defaultSize={70} minSize={30}>
                  <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <EditorTabs />
                    <Breadcrumbs />
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <EditorPanel />
                    </div>
                  </div>
                </Panel>

                <PanelResizeHandle
                  style={{
                    height: 4,
                    background: 'var(--border)',
                    cursor: 'row-resize',
                    transition: 'background 0.15s',
                  }}
                />

                {/* Output panel */}
                <Panel defaultSize={30} minSize={10} collapsible>
                  <OutputPanel />
                </Panel>
              </PanelGroup>
            </Panel>

            <PanelResizeHandle
              style={{
                width: 4,
                background: 'var(--border)',
                cursor: 'col-resize',
                transition: 'background 0.15s',
              }}
            />

            {/* Outline panel (right sidebar) */}
            <Panel defaultSize={15} minSize={10} collapsible>
              <OutlinePanel />
            </Panel>
          </PanelGroup>
        </div>

        {/* Status bar */}
        <StatusBar />
      </div>

      {/* Command Palette & Quick Open overlays */}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} commands={commands} />
      <QuickOpen open={quickOpenOpen} onClose={() => setQuickOpenOpen(false)} />
      <TemplateLibrary open={libraryOpen} onClose={() => setLibraryOpen(false)} />
      <UserSnippets open={snippetsOpen} onClose={() => setSnippetsOpen(false)} />
      <TemplateWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
      <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} />
    </IDEContext.Provider>
  );
}
