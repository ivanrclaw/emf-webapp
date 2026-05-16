import { useCallback } from 'react';
import type { WorkspaceTab, TabType } from './useWorkspace';

interface UseTabManagerOptions {
  tabs: WorkspaceTab[];
  activeTabId: string | null;
  onTabsChange: (tabs: WorkspaceTab[], activeTabId: string | null) => void;
}

interface UseTabManagerReturn {
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  closeOtherTabs: (tabId: string) => void;
  closeTabsToRight: (tabId: string) => void;
  findTab: (type: TabType, metamodelId: string | null) => WorkspaceTab | undefined;
}

/**
 * Pure logic hook for advanced tab management operations.
 * Does not use context — receives tabs and a callback to apply changes.
 */
export function useTabManager({
  tabs,
  activeTabId,
  onTabsChange,
}: UseTabManagerOptions): UseTabManagerReturn {
  const reorderTabs = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (
        fromIndex < 0 ||
        fromIndex >= tabs.length ||
        toIndex < 0 ||
        toIndex >= tabs.length ||
        fromIndex === toIndex
      ) {
        return;
      }

      const reordered = [...tabs];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, moved);

      onTabsChange(reordered, activeTabId);
    },
    [tabs, activeTabId, onTabsChange]
  );

  const closeOtherTabs = useCallback(
    (tabId: string) => {
      const kept = tabs.filter((t) => t.id === tabId || !t.closable);
      const newActiveId = kept.some((t) => t.id === activeTabId)
        ? activeTabId
        : tabId;

      onTabsChange(kept, newActiveId);
    },
    [tabs, activeTabId, onTabsChange]
  );

  const closeTabsToRight = useCallback(
    (tabId: string) => {
      const tabIndex = tabs.findIndex((t) => t.id === tabId);
      if (tabIndex === -1) return;

      const kept = tabs.filter(
        (t, index) => index <= tabIndex || !t.closable
      );

      const newActiveId = kept.some((t) => t.id === activeTabId)
        ? activeTabId
        : tabId;

      onTabsChange(kept, newActiveId);
    },
    [tabs, activeTabId, onTabsChange]
  );

  const findTab = useCallback(
    (type: TabType, metamodelId: string | null): WorkspaceTab | undefined => {
      return tabs.find(
        (t) => t.type === type && t.metamodelId === metamodelId
      );
    },
    [tabs]
  );

  return {
    reorderTabs,
    closeOtherTabs,
    closeTabsToRight,
    findTab,
  };
}
