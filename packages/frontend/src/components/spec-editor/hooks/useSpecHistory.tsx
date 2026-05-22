/**
 * useSpecHistory — Undo/Redo history stack for ViewpointSpec.
 *
 * Maintains a stack of serialized states with configurable max depth.
 * Provides undo, redo, and push operations.
 */
import { useState, useCallback, useRef } from 'react';
import type { ViewpointSpec } from '../../spec-diagram/types';

const MAX_HISTORY = 50;

interface HistoryState {
  past: string[];
  present: string;
  future: string[];
}

export function useSpecHistory(initial: ViewpointSpec | null) {
  const [history, setHistory] = useState<HistoryState>(() => ({
    past: [],
    present: initial ? JSON.stringify(initial) : '',
    future: [],
  }));

  // Debounce: don't push if last push was < 300ms ago
  const lastPushRef = useRef(0);

  const push = useCallback((spec: ViewpointSpec) => {
    const now = Date.now();
    const serialized = JSON.stringify(spec);

    setHistory((prev) => {
      // Don't push if identical to present
      if (serialized === prev.present) return prev;

      // Debounce rapid changes (typing) — merge into present
      if (now - lastPushRef.current < 300) {
        return { ...prev, present: serialized };
      }

      lastPushRef.current = now;
      const newPast = [...prev.past, prev.present].slice(-MAX_HISTORY);
      return {
        past: newPast,
        present: serialized,
        future: [],
      };
    });
  }, []);

  const undo = useCallback((): ViewpointSpec | null => {
    let result: ViewpointSpec | null = null;
    setHistory((prev) => {
      if (prev.past.length === 0) return prev;
      const newPast = [...prev.past];
      const previous = newPast.pop()!;
      result = JSON.parse(previous);
      return {
        past: newPast,
        present: previous,
        future: [prev.present, ...prev.future].slice(0, MAX_HISTORY),
      };
    });
    return result;
  }, []);

  const redo = useCallback((): ViewpointSpec | null => {
    let result: ViewpointSpec | null = null;
    setHistory((prev) => {
      if (prev.future.length === 0) return prev;
      const newFuture = [...prev.future];
      const next = newFuture.shift()!;
      result = JSON.parse(next);
      return {
        past: [...prev.past, prev.present].slice(-MAX_HISTORY),
        present: next,
        future: newFuture,
      };
    });
    return result;
  }, []);

  const reset = useCallback((spec: ViewpointSpec) => {
    setHistory({
      past: [],
      present: JSON.stringify(spec),
      future: [],
    });
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
