/**
 * @emf-webapp/frontend — useMonacoCursorSync
 *
 * Side-effect hook that syncs the local Monaco editor cursor position
 * to the collaboration presence system.
 *
 * - Listens to editor.onDidChangeCursorPosition
 * - Throttles updates to ~30fps (33ms)
 * - Sets cursor to null on editor blur
 * - Returns nothing (pure side-effect)
 */
import { useEffect, useRef } from 'react';
import type * as monacoTypes from 'monaco-editor';

type CursorPosition = { line: number; column: number } | null;

/**
 * Syncs local Monaco cursor position to the presence system.
 *
 * @param monacoEditor - The Monaco editor instance (from onMount)
 * @param setCursor - Callback to update cursor in presence (from useRoomPresence)
 */
export function useMonacoCursorSync(
  monacoEditor: monacoTypes.editor.IStandaloneCodeEditor | null,
  setCursor: (cursor: CursorPosition) => void
): void {
  const setCursorRef = useRef(setCursor);
  setCursorRef.current = setCursor;

  useEffect(() => {
    if (!monacoEditor) return;

    let lastSentTime = 0;
    let pendingTimeout: ReturnType<typeof setTimeout> | null = null;
    let lastPosition: CursorPosition = null;

    const THROTTLE_MS = 33; // ~30fps

    function sendPosition(position: CursorPosition): void {
      lastPosition = position;
      const now = Date.now();
      const elapsed = now - lastSentTime;

      if (elapsed >= THROTTLE_MS) {
        // Enough time has passed — send immediately
        lastSentTime = now;
        setCursorRef.current(position);

        // Clear any pending trailing call
        if (pendingTimeout !== null) {
          clearTimeout(pendingTimeout);
          pendingTimeout = null;
        }
      } else {
        // Schedule a trailing call to ensure the final position is sent
        if (pendingTimeout === null) {
          pendingTimeout = setTimeout(() => {
            pendingTimeout = null;
            lastSentTime = Date.now();
            setCursorRef.current(lastPosition);
          }, THROTTLE_MS - elapsed);
        }
      }
    }

    // Listen to cursor position changes
    const cursorDisposable = monacoEditor.onDidChangeCursorPosition((e) => {
      sendPosition({
        line: e.position.lineNumber,
        column: e.position.column,
      });
    });

    // Listen to focus/blur events
    const focusDisposable = monacoEditor.onDidFocusEditorText(() => {
      // On focus, send current position
      const position = monacoEditor.getPosition();
      if (position) {
        sendPosition({
          line: position.lineNumber,
          column: position.column,
        });
      }
    });

    const blurDisposable = monacoEditor.onDidBlurEditorText(() => {
      // On blur, clear cursor
      sendPosition(null);
    });

    return () => {
      cursorDisposable.dispose();
      focusDisposable.dispose();
      blurDisposable.dispose();

      if (pendingTimeout !== null) {
        clearTimeout(pendingTimeout);
      }

      // Clear cursor on unmount
      setCursorRef.current(null);
    };
  }, [monacoEditor]);
}

export default useMonacoCursorSync;
