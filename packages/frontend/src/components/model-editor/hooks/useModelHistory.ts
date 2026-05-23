/**
 * useModelHistory — Undo/Redo history stack for the Model Editor.
 *
 * Tracks changes to the semantic objects array. Provides undo, redo, push, and reset.
 * Debounces rapid changes (300ms) to avoid flooding the stack during typing.
 * Max 50 history entries.
 */
import { useState, useCallback, useRef } from 'react';

const MAX_HISTORY = 50;
const DEBOUNCE_MS = 300;

interface HistoryState {
  past: string[];
  present: string;
  future: string[];
}

export interface ModelHistoryAPI {
  push: (objects: unknown[]) => void;
  undo: () => unknown[] | null;
  redo: () => unknown[] | null;
  reset: (objects: unknown[]) => void;
  canUndo: boolean;
  canRedo: boolean;
  historySize: number;
}

export function useModelHistory(initial: unknown[] | null): ModelHistoryAPI {
  const [history, setHistory] = useState<HistoryState>(() => ({
    past: [],
    present: initial ? JSON.stringify(initial) : '[]',
    future: [],
  }));

  const lastPushRef = useRef(0);

  const push = useCallback((objects: unknown[]) => {
    const now = Date.now();
    const serialized = JSON.stringify(objects);

    setHistory((prev) => {
      // Don't push if identical to present
      if (serialized === prev.present) return prev;

      // Debounce rapid changes — merge into present without creating history entry
      if (now - lastPushRef.current < DEBOUNCE_MS) {
        return { ...prev, present: serialized, future: [] };
      }

      lastPushRef.current = now;
      const newPast = prev.present
        ? [...prev.past, prev.present].slice(-MAX_HISTORY)
        : prev.past;
      return {
        past: newPast,
        present: serialized,
        future: [],
      };
    });
  }, []);

  const undo = useCallback((): unknown[] | null => {
    let result: unknown[] | null = null;
    setHistory((prev) => {
      if (prev.past.length === 0) return prev;
      const newPast = [...prev.past];
      const previous = newPast.pop()!;
      result = JSON.parse(previous);
      return {
        past: newPast,
        present: previous,
        future: [prev.present, ...prev.future].filter(Boolean).slice(0, MAX_HISTORY),
      };
    });
    return result;
  }, []);

  const redo = useCallback((): unknown[] | null => {
    let result: unknown[] | null = null;
    setHistory((prev) => {
      if (prev.future.length === 0) return prev;
      const newFuture = [...prev.future];
      const next = newFuture.shift()!;
      result = JSON.parse(next);
      return {
        past: [...prev.past, prev.present].filter(Boolean).slice(-MAX_HISTORY),
        present: next,
        future: newFuture,
      };
    });
    return result;
  }, []);

  const reset = useCallback((objects: unknown[]) => {
    setHistory({
      past: [],
      present: JSON.stringify(objects),
      future: [],
    });
    lastPushRef.current = 0;
  }, []);

  return {
    push,
    undo,
    redo,
    reset,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    historySize: history.past.length,
  };
}
