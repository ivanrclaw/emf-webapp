import { createContext, useContext, useReducer, useCallback, useMemo, useEffect, useRef } from 'react';
import { ImportResolver } from './language/ImportResolver';

// ── Types ─────────────────────────────────────────────────────────────

export interface IDEFile {
  id: string;
  filename: string;
  content: string;
  language: string;
  isDirty: boolean;
  hasErrors: boolean;
  /** True when the file was created locally and hasn't been persisted to the backend yet */
  isNew?: boolean;
}

export interface IDEProject {
  id: string;
  name: string;
  description: string | null;
  metamodelId: string;
  files: IDEFile[];
}

export interface IDEDiagnostic {
  fileId: string;
  line: number;
  col: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface Snippet {
  id: string;
  prefix: string;
  body: string;
  description: string;
}

export interface IDEState {
  project: IDEProject | null;
  projects: Array<{ id: string; name: string; fileCount: number }>;
  openTabs: string[]; // file IDs
  activeTab: string | null; // file ID
  output: Array<{ name: string; content: string }> | null;
  generating: boolean;
  saving: boolean;
  diagnostics: IDEDiagnostic[];
  metamodelContent: Record<string, unknown> | null;
  livePreview: boolean;
  previousOutput: Array<{ name: string; content: string }> | null;
  outputStatus: 'idle' | 'generating' | 'up-to-date' | 'error';
  showDiff: boolean;
  snippets: Snippet[];
  autoSaveStatus: 'idle' | 'saving' | 'saved';
  cursorRequest: { line: number; col: number } | null;
  executionLog: Array<{
    type: 'template-start' | 'template-end' | 'query-call' | 'file-write' | 'error' | 'warning' | 'info';
    timestamp: number;
    templateName?: string;
    moduleName?: string;
    sourceLine?: number;
    args?: string;
    duration?: number;
    outputLength?: number;
    fileName?: string;
    message?: string;
  }>;
  traces: Array<{
    outputStart: number;
    outputEnd: number;
    templateName: string;
    moduleName: string;
    sourceLine: number;
    modelElementType?: string;
    modelElementName?: string;
  }>;
  executionTime: number | null;
  executionStats: { generated: number; skipped: number; lost: number } | null;
}

// ── Utilities ─────────────────────────────────────────────────────────

/** Check if a filename already exists in the file list, optionally excluding a file by id */
export function isFilenameDuplicate(files: IDEFile[], filename: string, excludeId?: string): boolean {
  return files.some((f) => f.filename === filename && f.id !== excludeId);
}

/** Generate a unique filename by appending _1, _2, etc. before the extension */
function generateUniqueFilename(files: IDEFile[], filename: string): string {
  if (!isFilenameDuplicate(files, filename)) return filename;

  const lastDotIndex = filename.lastIndexOf('.');
  const hasExtension = lastDotIndex > filename.lastIndexOf('/');
  const baseName = hasExtension ? filename.slice(0, lastDotIndex) : filename;
  const extension = hasExtension ? filename.slice(lastDotIndex) : '';

  let counter = 1;
  let candidate = `${baseName}_${counter}${extension}`;
  while (isFilenameDuplicate(files, candidate)) {
    counter++;
    candidate = `${baseName}_${counter}${extension}`;
  }
  return candidate;
}

// ── Actions ───────────────────────────────────────────────────────────

type IDEAction =
  | { type: 'LOAD_PROJECTS'; projects: IDEState['projects'] }
  | { type: 'SELECT_PROJECT'; projectId: string }
  | { type: 'LOAD_PROJECT'; project: IDEProject }
  | { type: 'OPEN_FILE'; fileId: string }
  | { type: 'CLOSE_TAB'; fileId: string }
  | { type: 'SET_ACTIVE_TAB'; fileId: string | null }
  | { type: 'UPDATE_FILE_CONTENT'; fileId: string; content: string }
  | { type: 'MARK_SAVED'; fileIds?: string[] }
  | { type: 'ADD_FILE'; file: IDEFile }
  | { type: 'REMOVE_FILE'; fileId: string }
  | { type: 'RENAME_FILE'; fileId: string; filename: string }
  | { type: 'MOVE_FILE'; fileId: string; newPath: string }
  | { type: 'DELETE_FOLDER'; folderPath: string }
  | { type: 'REORDER_FILES'; fileIds: string[] }
  | { type: 'SET_OUTPUT'; output: IDEState['output'] }
  | { type: 'SET_GENERATING'; generating: boolean }
  | { type: 'SET_SAVING'; saving: boolean }
  | { type: 'SET_DIAGNOSTICS'; diagnostics: IDEDiagnostic[] }
  | { type: 'SET_METAMODEL_CONTENT'; content: Record<string, unknown> }
  | { type: 'TOGGLE_LIVE_PREVIEW' }
  | { type: 'TOGGLE_DIFF_VIEW' }
  | { type: 'SET_OUTPUT_STATUS'; status: IDEState['outputStatus'] }
  | { type: 'ADD_SNIPPET'; snippet: Snippet }
  | { type: 'UPDATE_SNIPPET'; snippet: Snippet }
  | { type: 'REMOVE_SNIPPET'; snippetId: string }
  | { type: 'SET_AUTO_SAVE_STATUS'; status: IDEState['autoSaveStatus'] }
  | { type: 'FILE_PERSISTED'; localId: string; serverId: string }
  | { type: 'SET_CURSOR'; line: number; col: number }
  | { type: 'CLEAR_CURSOR_REQUEST' }
  | { type: 'SET_EXECUTION_META'; log: IDEState['executionLog']; traces: IDEState['traces']; executionTime: number | null; stats: IDEState['executionStats'] };

// ── Initial state ─────────────────────────────────────────────────────

export const initialIDEState: IDEState = {
  project: null,
  projects: [],
  openTabs: [],
  activeTab: null,
  output: null,
  generating: false,
  saving: false,
  diagnostics: [],
  metamodelContent: null,
  livePreview: false,
  previousOutput: null,
  outputStatus: 'idle',
  showDiff: false,
  snippets: [],
  autoSaveStatus: 'idle',
  cursorRequest: null,
  executionLog: [],
  traces: [],
  executionTime: null,
  executionStats: null,
};

// ── Reducer ───────────────────────────────────────────────────────────

function ideReducer(state: IDEState, action: IDEAction): IDEState {
  switch (action.type) {
    case 'LOAD_PROJECTS':
      return { ...state, projects: action.projects };

    case 'SELECT_PROJECT':
      return { ...state, project: null, openTabs: [], activeTab: null, output: null };

    case 'LOAD_PROJECT': {
      const project = action.project;
      // Auto-open first file if available
      const firstFile = project.files[0];
      return {
        ...state,
        project,
        openTabs: firstFile ? [firstFile.id] : [],
        activeTab: firstFile ? firstFile.id : null,
        output: null,
        diagnostics: [],
      };
    }

    case 'OPEN_FILE': {
      const tabs = state.openTabs.includes(action.fileId)
        ? state.openTabs
        : [...state.openTabs, action.fileId];
      return { ...state, openTabs: tabs, activeTab: action.fileId };
    }

    case 'CLOSE_TAB': {
      const tabs = state.openTabs.filter((id) => id !== action.fileId);
      let activeTab = state.activeTab;
      if (activeTab === action.fileId) {
        const idx = state.openTabs.indexOf(action.fileId);
        activeTab = tabs[Math.min(idx, tabs.length - 1)] || null;
      }
      return { ...state, openTabs: tabs, activeTab };
    }

    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.fileId };

    case 'UPDATE_FILE_CONTENT': {
      if (!state.project) return state;
      const files = state.project.files.map((f) =>
        f.id === action.fileId ? { ...f, content: action.content, isDirty: true } : f,
      );
      return { ...state, project: { ...state.project, files } };
    }

    case 'MARK_SAVED': {
      if (!state.project) return state;
      const savedIds = action.fileIds;
      const files = state.project.files.map((f) =>
        !savedIds || savedIds.includes(f.id) ? { ...f, isDirty: false } : f,
      );
      return { ...state, project: { ...state.project, files } };
    }

    case 'ADD_FILE': {
      if (!state.project) return state;
      const uniqueFilename = generateUniqueFilename(state.project.files, action.file.filename);
      const fileToAdd = uniqueFilename !== action.file.filename
        ? { ...action.file, filename: uniqueFilename }
        : action.file;
      const files = [...state.project.files, fileToAdd];
      const tabs = [...state.openTabs, fileToAdd.id];
      return {
        ...state,
        project: { ...state.project, files },
        openTabs: tabs,
        activeTab: fileToAdd.id,
      };
    }

    case 'REMOVE_FILE': {
      if (!state.project) return state;
      const files = state.project.files.filter((f) => f.id !== action.fileId);
      const tabs = state.openTabs.filter((id) => id !== action.fileId);
      let activeTab = state.activeTab;
      if (activeTab === action.fileId) {
        activeTab = tabs[tabs.length - 1] || null;
      }
      return {
        ...state,
        project: { ...state.project, files },
        openTabs: tabs,
        activeTab,
      };
    }

    case 'RENAME_FILE': {
      if (!state.project) return state;
      // Block rename if another file already has this filename
      if (isFilenameDuplicate(state.project.files, action.filename, action.fileId)) {
        return state;
      }
      const files = state.project.files.map((f) =>
        f.id === action.fileId ? { ...f, filename: action.filename } : f,
      );
      return { ...state, project: { ...state.project, files } };
    }

    case 'MOVE_FILE': {
      if (!state.project) return state;
      // Block move if another file already has this path
      if (isFilenameDuplicate(state.project.files, action.newPath, action.fileId)) {
        return state;
      }
      const files = state.project.files.map((f) =>
        f.id === action.fileId ? { ...f, filename: action.newPath } : f,
      );
      return { ...state, project: { ...state.project, files } };
    }

    case 'DELETE_FOLDER': {
      if (!state.project) return state;
      const prefix = action.folderPath + '/';
      const removedIds = new Set(
        state.project.files.filter((f) => f.filename.startsWith(prefix)).map((f) => f.id),
      );
      if (removedIds.size === 0) return state;
      const files = state.project.files.filter((f) => !removedIds.has(f.id));
      const tabs = state.openTabs.filter((id) => !removedIds.has(id));
      let activeTab = state.activeTab;
      if (activeTab && removedIds.has(activeTab)) {
        activeTab = tabs[tabs.length - 1] || null;
      }
      return {
        ...state,
        project: { ...state.project, files },
        openTabs: tabs,
        activeTab,
      };
    }

    case 'REORDER_FILES': {
      if (!state.project) return state;
      const fileMap = new Map(state.project.files.map((f) => [f.id, f]));
      const files = action.fileIds
        .map((id) => fileMap.get(id))
        .filter((f): f is IDEFile => f !== undefined);
      return { ...state, project: { ...state.project, files } };
    }

    case 'SET_OUTPUT':
      return { ...state, previousOutput: state.output, output: action.output, outputStatus: 'up-to-date' };

    case 'SET_GENERATING':
      return { ...state, generating: action.generating };

    case 'SET_SAVING':
      return { ...state, saving: action.saving };

    case 'SET_DIAGNOSTICS': {
      if (!state.project) return { ...state, diagnostics: action.diagnostics };
      const errorFileIds = new Set(
        action.diagnostics.filter((d) => d.severity === 'error').map((d) => d.fileId),
      );
      const files = state.project.files.map((f) => ({
        ...f,
        hasErrors: errorFileIds.has(f.id),
      }));
      return { ...state, diagnostics: action.diagnostics, project: { ...state.project, files } };
    }

    case 'SET_METAMODEL_CONTENT':
      return { ...state, metamodelContent: action.content };

    case 'TOGGLE_LIVE_PREVIEW':
      return { ...state, livePreview: !state.livePreview };

    case 'TOGGLE_DIFF_VIEW':
      return { ...state, showDiff: !state.showDiff };

    case 'SET_OUTPUT_STATUS':
      return { ...state, outputStatus: action.status };

    case 'ADD_SNIPPET':
      return { ...state, snippets: [...state.snippets, action.snippet] };

    case 'UPDATE_SNIPPET':
      return {
        ...state,
        snippets: state.snippets.map((s) =>
          s.id === action.snippet.id ? action.snippet : s,
        ),
      };

    case 'REMOVE_SNIPPET':
      return {
        ...state,
        snippets: state.snippets.filter((s) => s.id !== action.snippetId),
      };

    case 'SET_AUTO_SAVE_STATUS':
      return { ...state, autoSaveStatus: action.status };

    case 'FILE_PERSISTED': {
      if (!state.project) return state;
      const files = state.project.files.map((f) =>
        f.id === action.localId ? { ...f, id: action.serverId, isNew: false, isDirty: false } : f,
      );
      const openTabs = state.openTabs.map((id) => (id === action.localId ? action.serverId : id));
      const activeTab = state.activeTab === action.localId ? action.serverId : state.activeTab;
      return {
        ...state,
        project: { ...state.project, files },
        openTabs,
        activeTab,
      };
    }

    case 'SET_CURSOR':
      return { ...state, cursorRequest: { line: action.line, col: action.col } };

    case 'CLEAR_CURSOR_REQUEST':
      return { ...state, cursorRequest: null };

    case 'SET_EXECUTION_META':
      return { ...state, executionLog: action.log, traces: action.traces, executionTime: action.executionTime, executionStats: action.stats };

    default:
      return state;
  }
}

// ── Context ───────────────────────────────────────────────────────────

export interface IDEContextValue {
  state: IDEState;
  dispatch: React.Dispatch<IDEAction>;
  importResolver: ImportResolver;
  // Convenience methods
  openFile: (fileId: string) => void;
  closeTab: (fileId: string) => void;
  setActiveTab: (fileId: string | null) => void;
  updateContent: (fileId: string, content: string) => void;
  addFile: (file: IDEFile) => void;
  removeFile: (fileId: string) => void;
  renameFile: (fileId: string, filename: string) => void;
  moveFile: (fileId: string, newPath: string) => void;
  deleteFolder: (folderPath: string) => void;
}

export const IDEContext = createContext<IDEContextValue | null>(null);

// ── Hook ──────────────────────────────────────────────────────────────

export function useIDEStore(): IDEContextValue {
  const ctx = useContext(IDEContext);
  if (!ctx) {
    throw new Error('useIDEStore must be used within an IDEProvider');
  }
  return ctx;
}

// ── Provider hook (used inside IDEProvider component) ──────────────────

export function useIDEReducer() {
  const [state, dispatch] = useReducer(ideReducer, initialIDEState);
  const importResolverRef = useRef(new ImportResolver());
  const importResolver = importResolverRef.current;

  // Update import resolver index when project files change
  useEffect(() => {
    if (state.project?.files) {
      importResolver.updateIndex(
        state.project.files.map((f) => ({ id: f.id, filename: f.filename, content: f.content })),
      );
    }
  }, [state.project?.files, importResolver]);

  const openFile = useCallback((fileId: string) => {
    dispatch({ type: 'OPEN_FILE', fileId });
  }, []);

  const closeTab = useCallback((fileId: string) => {
    dispatch({ type: 'CLOSE_TAB', fileId });
  }, []);

  const setActiveTab = useCallback((fileId: string | null) => {
    dispatch({ type: 'SET_ACTIVE_TAB', fileId });
  }, []);

  const updateContent = useCallback((fileId: string, content: string) => {
    dispatch({ type: 'UPDATE_FILE_CONTENT', fileId, content });
  }, []);

  const addFile = useCallback((file: IDEFile) => {
    dispatch({ type: 'ADD_FILE', file });
  }, []);

  const removeFile = useCallback((fileId: string) => {
    dispatch({ type: 'REMOVE_FILE', fileId });
  }, []);

  const renameFile = useCallback((fileId: string, filename: string) => {
    dispatch({ type: 'RENAME_FILE', fileId, filename });
  }, []);

  const moveFile = useCallback((fileId: string, newPath: string) => {
    dispatch({ type: 'MOVE_FILE', fileId, newPath });
  }, []);

  const deleteFolder = useCallback((folderPath: string) => {
    dispatch({ type: 'DELETE_FOLDER', folderPath });
  }, []);

  const value: IDEContextValue = useMemo(
    () => ({
      state,
      dispatch,
      importResolver,
      openFile,
      closeTab,
      setActiveTab,
      updateContent,
      addFile,
      removeFile,
      renameFile,
      moveFile,
      deleteFolder,
    }),
    [state, dispatch, importResolver, openFile, closeTab, setActiveTab, updateContent, addFile, removeFile, renameFile, moveFile, deleteFolder],
  );

  return value;
}
