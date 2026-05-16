import { useEffect, useCallback, useRef } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────

export type ShortcutAction =
  | 'save'
  | 'undo'
  | 'redo'
  | 'toggle-command-palette'
  | 'toggle-sidebar'
  | 'close-tab'
  | 'next-tab'
  | 'previous-tab'
  | 'delete-selected'
  | 'rename'
  | 'escape';

export interface KeyboardShortcutsConfig {
  /** Called when an action is dispatched to the active tab (save, undo, redo, delete-selected, rename) */
  onAction?: (action: string) => void;
  /** Toggle command palette visibility */
  onToggleCommandPalette?: () => void;
  /** Toggle sidebar visibility */
  onToggleSidebar?: () => void;
  /** Close the currently active tab */
  onCloseTab?: () => void;
  /** Switch to the next tab */
  onNextTab?: () => void;
  /** Switch to the previous tab */
  onPreviousTab?: () => void;
  /** Close command palette (Escape) — only fires if returns true from isCommandPaletteOpen */
  onEscape?: () => void;
  /** Whether the command palette is currently open (used for Escape handling) */
  isCommandPaletteOpen?: boolean;
  /** Whether shortcuts are enabled (default: true) */
  enabled?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Returns true if the currently focused element is an input, textarea,
 * or contenteditable element where typing shortcuts should not fire.
 */
function isEditableElement(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea') return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

// ─── Hook ─────────────────────────────────────────────────────────────────

/**
 * Centralized keyboard shortcuts hook for the EMF workspace.
 *
 * Registers global keydown listeners for all workspace shortcuts and
 * dispatches to the appropriate callbacks. Prevents default browser
 * behavior for all handled shortcuts.
 */
export function useKeyboardShortcuts(config: KeyboardShortcutsConfig): void {
  // Use a ref to always have the latest config without re-registering the listener
  const configRef = useRef(config);
  configRef.current = config;

  const handler = useCallback((e: KeyboardEvent) => {
    const cfg = configRef.current;
    if (cfg.enabled === false) return;

    const ctrl = e.ctrlKey || e.metaKey;

    // ── Ctrl+S: save ──────────────────────────────────────────────────
    if (ctrl && !e.shiftKey && e.key === 's') {
      e.preventDefault();
      cfg.onAction?.('save');
      return;
    }

    // ── Ctrl+Shift+Z or Ctrl+Y: redo ─────────────────────────────────
    if (ctrl && e.shiftKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      cfg.onAction?.('redo');
      return;
    }
    if (ctrl && !e.shiftKey && e.key === 'y') {
      e.preventDefault();
      cfg.onAction?.('redo');
      return;
    }

    // ── Ctrl+Z: undo (must come after Ctrl+Shift+Z check) ────────────
    if (ctrl && !e.shiftKey && e.key === 'z') {
      e.preventDefault();
      cfg.onAction?.('undo');
      return;
    }

    // ── Ctrl+P: toggle command palette ────────────────────────────────
    if (ctrl && !e.shiftKey && e.key === 'p') {
      e.preventDefault();
      cfg.onToggleCommandPalette?.();
      return;
    }

    // ── Ctrl+B: toggle sidebar ────────────────────────────────────────
    if (ctrl && !e.shiftKey && e.key === 'b') {
      e.preventDefault();
      cfg.onToggleSidebar?.();
      return;
    }

    // ── Ctrl+W: close active tab ──────────────────────────────────────
    if (ctrl && !e.shiftKey && e.key === 'w') {
      e.preventDefault();
      cfg.onCloseTab?.();
      return;
    }

    // ── Ctrl+Tab / Ctrl+PageDown: next tab ────────────────────────────
    if (ctrl && !e.shiftKey && (e.key === 'Tab' || e.key === 'PageDown')) {
      e.preventDefault();
      cfg.onNextTab?.();
      return;
    }

    // ── Ctrl+Shift+Tab / Ctrl+PageUp: previous tab ───────────────────
    if (ctrl && e.shiftKey && e.key === 'Tab') {
      e.preventDefault();
      cfg.onPreviousTab?.();
      return;
    }
    if (ctrl && e.key === 'PageUp') {
      e.preventDefault();
      cfg.onPreviousTab?.();
      return;
    }

    // ── Delete: delete selected (only outside editable elements) ──────
    if (e.key === 'Delete' && !ctrl && !e.shiftKey && !e.altKey) {
      if (!isEditableElement()) {
        e.preventDefault();
        cfg.onAction?.('delete-selected');
        return;
      }
    }

    // ── F2: rename (only outside editable elements) ───────────────────
    if (e.key === 'F2' && !ctrl && !e.shiftKey && !e.altKey) {
      if (!isEditableElement()) {
        e.preventDefault();
        cfg.onAction?.('rename');
        return;
      }
    }

    // ── Escape: close command palette if open ─────────────────────────
    if (e.key === 'Escape') {
      if (cfg.isCommandPaletteOpen) {
        e.preventDefault();
        cfg.onEscape?.();
        return;
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handler]);
}

export default useKeyboardShortcuts;
