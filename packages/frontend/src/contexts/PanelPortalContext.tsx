/**
 * PanelPortalContext — Allows child components (like EcoreEditor) to render
 * content into workspace panel slots (left sidebar, right panel) via React portals.
 *
 * The workspace layout creates DOM targets and provides refs here.
 * The editor uses createPortal to render Toolbox/TreeView into the sidebar
 * and PropertyInspector/OCL into the right panel.
 */
import React, { createContext, useContext, useRef, useState, useCallback } from 'react';

interface PanelPortalContextValue {
  /** DOM element for the left sidebar content area (below project tree) */
  leftPanelRef: React.RefObject<HTMLDivElement | null>;
  /** DOM element for the right panel */
  rightPanelRef: React.RefObject<HTMLDivElement | null>;
  /** Whether the right panel should be visible */
  rightPanelVisible: boolean;
  /** Show/hide the right panel */
  setRightPanelVisible: (visible: boolean) => void;
}

const PanelPortalContext = createContext<PanelPortalContextValue>({
  leftPanelRef: { current: null },
  rightPanelRef: { current: null },
  rightPanelVisible: false,
  setRightPanelVisible: () => {},
});

export function PanelPortalProvider({ children }: { children: React.ReactNode }) {
  const leftPanelRef = useRef<HTMLDivElement | null>(null);
  const rightPanelRef = useRef<HTMLDivElement | null>(null);
  const [rightPanelVisible, setRightPanelVisible] = useState(false);

  return (
    <PanelPortalContext.Provider
      value={{ leftPanelRef, rightPanelRef, rightPanelVisible, setRightPanelVisible }}
    >
      {children}
    </PanelPortalContext.Provider>
  );
}

export function usePanelPortals() {
  return useContext(PanelPortalContext);
}
