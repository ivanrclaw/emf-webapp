/**
 * EditorContext — Bridge between the active editor (EcoreEditor) and the workspace shell.
 *
 * The editor registers its actions and state here; the Toolbar and StatusBar read from it.
 * This decouples the editor from the workspace chrome so neither knows about the other's internals.
 */
import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

export interface EditorActions {
  save: () => void;
  exportEcore: () => void;
  exportZip: () => void;
  exportGenmodel: () => void;
  importEcore: () => void;
  importEclipseZip: () => void;
  undo: () => void;
  redo: () => void;
  validate: () => void;
}

export interface EditorState {
  dirty: boolean;
  loading: boolean;
  canUndo: boolean;
  canRedo: boolean;
  validationStatus: 'valid' | 'invalid' | 'unknown';
  totalViolations: number;
  nodeCount: number;
  edgeCount: number;
  packageName: string;
  connected: boolean;
  collaborators: number;
}

const defaultState: EditorState = {
  dirty: false,
  loading: false,
  canUndo: false,
  canRedo: false,
  validationStatus: 'unknown',
  totalViolations: 0,
  nodeCount: 0,
  edgeCount: 0,
  packageName: '',
  connected: false,
  collaborators: 0,
};

const noop = () => {};
const defaultActions: EditorActions = {
  save: noop,
  exportEcore: noop,
  exportZip: noop,
  exportGenmodel: noop,
  importEcore: noop,
  importEclipseZip: noop,
  undo: noop,
  redo: noop,
  validate: noop,
};

interface EditorContextValue {
  /** Current editor state (read by Toolbar/StatusBar) */
  state: EditorState;
  /** Current editor actions (invoked by Toolbar) */
  actions: EditorActions;
  /** Called by the active editor to register itself */
  register: (actions: EditorActions, state: EditorState) => void;
  /** Called by the active editor to update state */
  updateState: (patch: Partial<EditorState>) => void;
  /** Called when editor unmounts */
  unregister: () => void;
}

const EditorContext = createContext<EditorContextValue>({
  state: defaultState,
  actions: defaultActions,
  register: noop,
  updateState: noop,
  unregister: noop,
});

export function EditorProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<EditorState>(defaultState);
  const actionsRef = useRef<EditorActions>(defaultActions);

  const register = useCallback((actions: EditorActions, initialState: EditorState) => {
    actionsRef.current = actions;
    setState(initialState);
  }, []);

  const updateState = useCallback((patch: Partial<EditorState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  const unregister = useCallback(() => {
    actionsRef.current = defaultActions;
    setState(defaultState);
  }, []);

  return (
    <EditorContext.Provider
      value={{
        state,
        actions: actionsRef.current,
        register,
        updateState,
        unregister,
      }}
    >
      {children}
    </EditorContext.Provider>
  );
}

export function useEditorContext() {
  return useContext(EditorContext);
}
