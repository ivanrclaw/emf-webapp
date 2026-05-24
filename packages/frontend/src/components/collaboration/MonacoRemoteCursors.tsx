/**
 * @emf-webapp/frontend — MonacoRemoteCursors
 *
 * Renders remote user cursors and selections inside a Monaco editor instance.
 * Uses Monaco's deltaDecorations API for cursor lines and content widgets for name labels.
 *
 * Features:
 * - Colored cursor line decorations with pulse animation
 * - Name label widgets positioned above cursors
 * - Selection range highlights
 * - Smooth cleanup when users leave
 */
import { useEffect, useRef, useCallback } from 'react';
import type * as monacoTypes from 'monaco-editor';

// ─── Types ───────────────────────────────────────────────────────────────

export interface PresenceState {
  user: { name: string; color: string };
  cursor: { line: number; column: number } | { x: number; y: number } | null;
  activeElementId: string | null;
  editingField: string | null;
}

interface MonacoRemoteCursorsProps {
  /** Monaco editor instance (from onMount callback) */
  monacoEditor: monacoTypes.editor.IStandaloneCodeEditor | null;
  /** Remote user presence states keyed by user/client ID */
  remoteStates: Map<number, PresenceState>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────

/** Type guard: is cursor a Monaco line/column cursor? */
function isMonacoCursor(
  cursor: PresenceState['cursor']
): cursor is { line: number; column: number } {
  return cursor !== null && 'line' in cursor && 'column' in cursor;
}

/** Generate a unique CSS class name for a user's cursor decoration */
function cursorClassName(userId: number): string {
  return `remote-cursor-${userId}`;
}

/** Generate a unique CSS class name for a user's selection decoration */
function selectionClassName(userId: number): string {
  return `remote-selection-${userId}`;
}

/** Unique widget ID for a user's name label */
function widgetId(userId: number): string {
  return `remote-cursor-label-${userId}`;
}

// ─── Style Injection ─────────────────────────────────────────────────────

const STYLE_ID = 'monaco-remote-cursors-styles';

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes remote-cursor-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    .remote-cursor-decoration {
      width: 2px !important;
      margin-left: -1px;
      animation: remote-cursor-pulse 1.2s ease-in-out infinite;
    }

    .remote-cursor-label {
      position: absolute;
      top: -18px;
      left: 0;
      font-size: 10px;
      font-weight: 600;
      color: #fff;
      padding: 1px 5px;
      border-radius: 3px;
      white-space: nowrap;
      line-height: 14px;
      pointer-events: none;
      user-select: none;
      box-shadow: 0 1px 3px rgba(0,0,0,0.15);
      z-index: 100;
    }

    .remote-selection-decoration {
      opacity: 0.2;
      min-width: 4px;
    }
  `;
  document.head.appendChild(style);
}

// ─── Component ───────────────────────────────────────────────────────────

export function MonacoRemoteCursors({ monacoEditor, remoteStates }: MonacoRemoteCursorsProps) {
  // Track current decoration IDs for delta updates
  const decorationIdsRef = useRef<string[]>([]);
  // Track active content widgets by user ID
  const widgetsRef = useRef<Map<number, monacoTypes.editor.IContentWidget>>(new Map());
  // Track injected per-user style rules
  const userStylesRef = useRef<Set<number>>(new Set());

  // Inject base styles on mount
  useEffect(() => {
    ensureStyles();
  }, []);

  // Inject per-user color styles dynamically
  const ensureUserStyle = useCallback((userId: number, color: string) => {
    if (userStylesRef.current.has(userId)) return;
    userStylesRef.current.add(userId);

    const styleEl = document.getElementById(STYLE_ID);
    if (!styleEl) return;

    styleEl.textContent += `
      .${cursorClassName(userId)} {
        background: ${color} !important;
      }
      .${selectionClassName(userId)} {
        background: ${color} !important;
      }
    `;
  }, []);

  // Main effect: sync decorations and widgets with remote states
  useEffect(() => {
    if (!monacoEditor) return;

    const model = monacoEditor.getModel();
    if (!model) return;

    // Build new decorations array
    const newDecorations: monacoTypes.editor.IModelDeltaDecoration[] = [];
    const activeUserIds = new Set<number>();

    remoteStates.forEach((state, userId) => {
      if (!isMonacoCursor(state.cursor)) return;

      activeUserIds.add(userId);
      ensureUserStyle(userId, state.user.color);

      const { line, column } = state.cursor;

      // Clamp to valid model range
      const maxLine = model.getLineCount();
      const clampedLine = Math.min(Math.max(1, line), maxLine);
      const maxColumn = model.getLineMaxColumn(clampedLine);
      const clampedColumn = Math.min(Math.max(1, column), maxColumn);

      // Cursor line decoration (thin vertical bar)
      newDecorations.push({
        range: {
          startLineNumber: clampedLine,
          startColumn: clampedColumn,
          endLineNumber: clampedLine,
          endColumn: clampedColumn,
        },
        options: {
          className: `remote-cursor-decoration ${cursorClassName(userId)}`,
          stickiness: 1, // NeverGrowsWhenTypingAtEdges
        },
      });

      // Selection highlight (if user has a selection — future extension)
      // For now we highlight the character at cursor position as a subtle indicator
      if (clampedColumn < maxColumn) {
        newDecorations.push({
          range: {
            startLineNumber: clampedLine,
            startColumn: clampedColumn,
            endLineNumber: clampedLine,
            endColumn: clampedColumn + 1,
          },
          options: {
            className: `remote-selection-decoration ${selectionClassName(userId)}`,
            stickiness: 1,
          },
        });
      }
    });

    // Apply delta decorations (smooth update, no flicker)
    decorationIdsRef.current = monacoEditor.deltaDecorations(
      decorationIdsRef.current,
      newDecorations
    );

    // Update content widgets (name labels)
    const currentWidgets = widgetsRef.current;

    // Remove widgets for users who left or have no cursor
    currentWidgets.forEach((widget, userId) => {
      if (!activeUserIds.has(userId)) {
        monacoEditor.removeContentWidget(widget);
        currentWidgets.delete(userId);
      }
    });

    // Add or update widgets for active users
    remoteStates.forEach((state, userId) => {
      if (!isMonacoCursor(state.cursor)) return;

      const { line, column } = state.cursor;
      const maxLine = model.getLineCount();
      const clampedLine = Math.min(Math.max(1, line), maxLine);
      const clampedColumn = Math.min(Math.max(1, column), model.getLineMaxColumn(clampedLine));

      const existingWidget = currentWidgets.get(userId);

      if (existingWidget) {
        // Update position by re-layouting
        (existingWidget as any)._position = {
          lineNumber: clampedLine,
          column: clampedColumn,
        };
        monacoEditor.layoutContentWidget(existingWidget);
      } else {
        // Create new widget
        const domNode = document.createElement('div');
        domNode.className = 'remote-cursor-label';
        domNode.style.background = state.user.color;
        domNode.textContent = state.user.name;

        const widget: monacoTypes.editor.IContentWidget = {
          getId: () => widgetId(userId),
          getDomNode: () => domNode,
          getPosition: () => ({
            position: {
              lineNumber: clampedLine,
              column: clampedColumn,
            },
            preference: [1], // ABOVE
          }),
        };

        // Store mutable position for updates
        (widget as any)._position = { lineNumber: clampedLine, column: clampedColumn };

        // Override getPosition to use mutable position
        widget.getPosition = () => ({
          position: (widget as any)._position,
          preference: [1], // ABOVE
        });

        monacoEditor.addContentWidget(widget);
        currentWidgets.set(userId, widget);
      }
    });
  }, [monacoEditor, remoteStates, ensureUserStyle]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (!monacoEditor) return;

      // Remove all decorations
      if (decorationIdsRef.current.length > 0) {
        monacoEditor.deltaDecorations(decorationIdsRef.current, []);
        decorationIdsRef.current = [];
      }

      // Remove all widgets
      widgetsRef.current.forEach((widget) => {
        monacoEditor.removeContentWidget(widget);
      });
      widgetsRef.current.clear();
    };
  }, [monacoEditor]);

  // This component is side-effect only — no DOM output
  return null;
}

export default MonacoRemoteCursors;
