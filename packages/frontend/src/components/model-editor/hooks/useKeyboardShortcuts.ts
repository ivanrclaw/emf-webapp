/**
 * @emf-webapp/frontend — useKeyboardShortcuts
 *
 * Centralized keyboard shortcut handler for the model editor.
 * Handles all shortcuts in one place with proper input field detection.
 */
import { useEffect, useCallback } from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ShortcutActions {
  onDelete: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onDuplicate: () => void;
  onSelectAll: () => void;
  onSave: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onRename: () => void;
  onEscape: () => void;
  onFitView: () => void;
}

interface ShortcutOptions {
  hasSelection: boolean;
  isEditing: boolean;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useKeyboardShortcuts(
  actions: ShortcutActions,
  options: ShortcutOptions,
) {
  const { hasSelection, isEditing } = options;

  const handler = useCallback((e: KeyboardEvent) => {
    // Skip when editing inline or in input fields
    if (isEditing) return;
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if ((e.target as HTMLElement)?.isContentEditable) return;

    const ctrl = e.ctrlKey || e.metaKey;

    // Delete / Backspace
    if ((e.key === 'Delete' || e.key === 'Backspace') && hasSelection) {
      e.preventDefault();
      actions.onDelete();
      return;
    }

    // Escape
    if (e.key === 'Escape') {
      e.preventDefault();
      actions.onEscape();
      return;
    }

    // F2 — Rename
    if (e.key === 'F2' && hasSelection) {
      e.preventDefault();
      actions.onRename();
      return;
    }

    // Ctrl/Cmd shortcuts
    if (ctrl) {
      switch (e.key.toLowerCase()) {
        case 'z':
          e.preventDefault();
          if (e.shiftKey) actions.onRedo();
          else actions.onUndo();
          break;
        case 'd':
          e.preventDefault();
          actions.onDuplicate();
          break;
        case 'a':
          e.preventDefault();
          actions.onSelectAll();
          break;
        case 's':
          e.preventDefault();
          actions.onSave();
          break;
        case 'c':
          if (hasSelection) {
            e.preventDefault();
            actions.onCopy();
          }
          break;
        case 'v':
          e.preventDefault();
          actions.onPaste();
          break;
        case '1':
          e.preventDefault();
          actions.onFitView();
          break;
      }
    }
  }, [actions, hasSelection, isEditing]);

  useEffect(() => {
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handler]);
}
