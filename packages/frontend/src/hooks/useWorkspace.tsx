import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react';

// --- Types ---

export type TabType =
  | 'welcome'
  | 'diagram'
  | 'ocl'
  | 'codegen'
  | 'models'
  | 'model-editor'
  | 'spec'
  | 'project-info';

export interface WorkspaceTab {
  id: string;
  type: TabType;
  title: string;
  projectId: string | null;
  metamodelId: string | null;
  modelId?: string | null;
  dirty: boolean;
  closable: boolean;
}

interface WorkspaceState {
  tabs: WorkspaceTab[];
  activeTabId: string | null;
  sidebarOpen: boolean;
  currentProjectId: string | null;
  currentMetamodelId: string | null;
}

interface WorkspaceActions {
  openTab: (tab: Omit<WorkspaceTab, 'id'>) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  toggleSidebar: () => void;
  setDirty: (tabId: string, dirty: boolean) => void;
  setContext: (projectId: string, metamodelId?: string) => void;
}

type WorkspaceContextValue = WorkspaceState & WorkspaceActions;

// --- Constants ---

const STORAGE_KEY = 'emf-workspace-state';

const DEFAULT_WELCOME_TAB: WorkspaceTab = {
  id: 'welcome',
  type: 'welcome',
  title: 'Welcome',
  projectId: null,
  metamodelId: null,
  dirty: false,
  closable: true,
};

// --- Reducer ---

type WorkspaceAction =
  | { type: 'OPEN_TAB'; payload: Omit<WorkspaceTab, 'id'> }
  | { type: 'CLOSE_TAB'; payload: string }
  | { type: 'SET_ACTIVE_TAB'; payload: string }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_DIRTY'; payload: { tabId: string; dirty: boolean } }
  | { type: 'SET_CONTEXT'; payload: { projectId: string; metamodelId?: string } }
  | { type: 'RESTORE'; payload: WorkspaceState };

function generateTabId(): string {
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function workspaceReducer(
  state: WorkspaceState,
  action: WorkspaceAction
): WorkspaceState {
  switch (action.type) {
    case 'OPEN_TAB': {
      const tabData = action.payload;

      // Check if a tab with same type + projectId + metamodelId already exists
      const existing = state.tabs.find(
        (t) => t.type === tabData.type && t.projectId === tabData.projectId && t.metamodelId === tabData.metamodelId
      );

      if (existing) {
        return { ...state, activeTabId: existing.id };
      }

      const newTab: WorkspaceTab = {
        ...tabData,
        id: generateTabId(),
      };

      return {
        ...state,
        tabs: [...state.tabs, newTab],
        activeTabId: newTab.id,
      };
    }

    case 'CLOSE_TAB': {
      const tabId = action.payload;
      const tabIndex = state.tabs.findIndex((t) => t.id === tabId);

      if (tabIndex === -1) return state;

      const tab = state.tabs[tabIndex];
      if (!tab.closable) return state;

      const newTabs = state.tabs.filter((t) => t.id !== tabId);

      let newActiveTabId = state.activeTabId;
      if (state.activeTabId === tabId) {
        if (newTabs.length === 0) {
          newActiveTabId = null;
        } else if (tabIndex >= newTabs.length) {
          // Was last tab, activate the new last
          newActiveTabId = newTabs[newTabs.length - 1].id;
        } else {
          // Activate the tab now at the same index (adjacent right)
          newActiveTabId = newTabs[tabIndex].id;
        }
      }

      return {
        ...state,
        tabs: newTabs,
        activeTabId: newActiveTabId,
      };
    }

    case 'SET_ACTIVE_TAB': {
      const tabExists = state.tabs.some((t) => t.id === action.payload);
      if (!tabExists) return state;
      return { ...state, activeTabId: action.payload };
    }

    case 'TOGGLE_SIDEBAR': {
      return { ...state, sidebarOpen: !state.sidebarOpen };
    }

    case 'SET_DIRTY': {
      const { tabId, dirty } = action.payload;
      return {
        ...state,
        tabs: state.tabs.map((t) =>
          t.id === tabId ? { ...t, dirty } : t
        ),
      };
    }

    case 'SET_CONTEXT': {
      const { projectId, metamodelId } = action.payload;
      return {
        ...state,
        currentProjectId: projectId,
        currentMetamodelId: metamodelId ?? state.currentMetamodelId,
      };
    }

    case 'RESTORE': {
      return action.payload;
    }

    default:
      return state;
  }
}

// --- Persistence ---

function loadState(): WorkspaceState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WorkspaceState;
    // Basic validation
    if (!Array.isArray(parsed.tabs)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveState(state: WorkspaceState): void {
  try {
    const toSave: WorkspaceState = {
      tabs: state.tabs,
      activeTabId: state.activeTabId,
      sidebarOpen: state.sidebarOpen,
      currentProjectId: state.currentProjectId,
      currentMetamodelId: state.currentMetamodelId,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch {
    // Silently fail on storage errors
  }
}

// --- Context ---

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

// --- Provider ---

interface WorkspaceProviderProps {
  children: React.ReactNode;
}

function getInitialState(): WorkspaceState {
  const restored = loadState();
  if (restored && restored.tabs.length > 0) {
    return restored;
  }
  return {
    tabs: [DEFAULT_WELCOME_TAB],
    activeTabId: DEFAULT_WELCOME_TAB.id,
    sidebarOpen: true,
    currentProjectId: null,
    currentMetamodelId: null,
  };
}

export function WorkspaceProvider({ children }: WorkspaceProviderProps) {
  const [state, dispatch] = useReducer(workspaceReducer, undefined, getInitialState);

  // Persist state changes to localStorage
  useEffect(() => {
    saveState(state);
  }, [state]);

  const openTab = useCallback((tab: Omit<WorkspaceTab, 'id'>) => {
    dispatch({ type: 'OPEN_TAB', payload: tab });
  }, []);

  const closeTab = useCallback((tabId: string) => {
    dispatch({ type: 'CLOSE_TAB', payload: tabId });
  }, []);

  const setActiveTab = useCallback((tabId: string) => {
    dispatch({ type: 'SET_ACTIVE_TAB', payload: tabId });
  }, []);

  const toggleSidebar = useCallback(() => {
    dispatch({ type: 'TOGGLE_SIDEBAR' });
  }, []);

  const setDirty = useCallback((tabId: string, dirty: boolean) => {
    dispatch({ type: 'SET_DIRTY', payload: { tabId, dirty } });
  }, []);

  const setContext = useCallback((projectId: string, metamodelId?: string) => {
    dispatch({ type: 'SET_CONTEXT', payload: { projectId, metamodelId } });
  }, []);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      ...state,
      openTab,
      closeTab,
      setActiveTab,
      toggleSidebar,
      setDirty,
      setContext,
    }),
    [state, openTab, closeTab, setActiveTab, toggleSidebar, setDirty, setContext]
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

// --- Hook ---

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
