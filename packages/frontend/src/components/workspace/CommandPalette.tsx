import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  Workflow,
  Box,
  Save,
  Download,
  CircleCheck,
  Sun,
  Layers,
  X,
  Folder,
  Plus,
  Code,
  AlertTriangle,
  Play,
  Eye,
  Filter,
} from '../icons';
import { getProjects, getMetamodels } from '../../api/client';
import { useWorkspace } from '../../hooks/useWorkspace';

// --- Types ---

export interface CommandAction {
  type: 'open-tab' | 'switch-tab' | 'action';
  payload: any;
}

interface CommandItem {
  id: string;
  label: string;
  category: 'Tabs' | 'Metamodels' | 'Actions';
  icon: React.ReactNode;
  action: CommandAction;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onAction: (action: CommandAction) => void;
}

// --- Predefined actions ---

const PREDEFINED_ACTIONS: Omit<CommandItem, 'id'>[] = [
  {
    label: 'Save',
    category: 'Actions',
    icon: <Save size={16} />,
    action: { type: 'action', payload: 'save' },
  },
  {
    label: 'Export .ecore',
    category: 'Actions',
    icon: <Download size={16} />,
    action: { type: 'action', payload: 'export-ecore' },
  },
  {
    label: 'Export ZIP',
    category: 'Actions',
    icon: <Download size={16} />,
    action: { type: 'action', payload: 'export-zip' },
  },
  {
    label: 'Validate',
    category: 'Actions',
    icon: <CircleCheck size={16} />,
    action: { type: 'action', payload: 'validate' },
  },
  {
    label: 'Toggle Theme',
    category: 'Actions',
    icon: <Sun size={16} />,
    action: { type: 'action', payload: 'toggle-theme' },
  },
  {
    label: 'Toggle Sidebar',
    category: 'Actions',
    icon: <Layers size={16} />,
    action: { type: 'action', payload: 'toggle-sidebar' },
  },
  {
    label: 'Close Tab',
    category: 'Actions',
    icon: <X size={16} />,
    action: { type: 'action', payload: 'close-tab' },
  },
  {
    label: 'Close All Tabs',
    category: 'Actions',
    icon: <X size={16} />,
    action: { type: 'action', payload: 'close-all-tabs' },
  },
  // OCL IDE commands
  {
    label: 'OCL: New Constraint',
    category: 'Actions',
    icon: <Plus size={16} />,
    action: { type: 'action', payload: 'ocl-new-constraint' },
  },
  {
    label: 'OCL: Validate All',
    category: 'Actions',
    icon: <CircleCheck size={16} />,
    action: { type: 'action', payload: 'ocl-validate-all' },
  },
  {
    label: 'OCL: Format',
    category: 'Actions',
    icon: <Code size={16} />,
    action: { type: 'action', payload: 'ocl-format' },
  },
  {
    label: 'OCL: Toggle Problems Panel',
    category: 'Actions',
    icon: <AlertTriangle size={16} />,
    action: { type: 'action', payload: 'ocl-toggle-problems' },
  },
  {
    label: 'OCL: Toggle Inspector',
    category: 'Actions',
    icon: <Eye size={16} />,
    action: { type: 'action', payload: 'ocl-toggle-inspector' },
  },
  {
    label: 'OCL: Go to Next Problem',
    category: 'Actions',
    icon: <Filter size={16} />,
    action: { type: 'action', payload: 'ocl-next-problem' },
  },
  {
    label: 'OCL: Run on Selected M1 Model',
    category: 'Actions',
    icon: <Play size={16} />,
    action: { type: 'action', payload: 'ocl-run-m1' },
  },
];

// --- Component ---

export function CommandPalette({ open, onClose, onAction }: CommandPaletteProps) {
  const { tabs } = useWorkspace();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [metamodelItems, setMetamodelItems] = useState<CommandItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Fetch metamodels when palette opens
  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function fetchData() {
      try {
        const projectsRes = await getProjects();
        const projects = projectsRes.items;
        const items: CommandItem[] = [];

        // Add projects as items
        for (const project of projects) {
          items.push({
            id: `project-${project.id}`,
            label: project.name,
            category: 'Metamodels',
            icon: <Folder size={16} />,
            action: {
              type: 'open-tab',
              payload: { type: 'project-info', projectId: project.id, title: project.name },
            },
          });

          // Fetch metamodels for each project
          try {
            const metamodels = await getMetamodels(project.id);
            for (const mm of metamodels) {
              items.push({
                id: `mm-${mm.id}`,
                label: mm.name,
                category: 'Metamodels',
                icon: <Workflow size={16} />,
                action: {
                  type: 'open-tab',
                  payload: {
                    type: 'diagram',
                    projectId: project.id,
                    metamodelId: mm.id,
                    title: mm.name,
                  },
                },
              });
            }
          } catch {
            // Skip if metamodels can't be fetched for this project
          }
        }

        if (!cancelled) {
          setMetamodelItems(items);
        }
      } catch {
        // Silently fail — palette still works with tabs and actions
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [open]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      // Small delay to ensure DOM is ready
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [open]);

  // Build all items
  const allItems = useMemo<CommandItem[]>(() => {
    const tabItems: CommandItem[] = tabs.map((tab) => ({
      id: `tab-${tab.id}`,
      label: tab.title,
      category: 'Tabs' as const,
      icon: <Box size={16} />,
      action: { type: 'switch-tab' as const, payload: tab.id },
    }));

    const actionItems: CommandItem[] = PREDEFINED_ACTIONS.map((a, i) => ({
      ...a,
      id: `action-${i}`,
    }));

    return [...tabItems, ...metamodelItems, ...actionItems];
  }, [tabs, metamodelItems]);

  // Filter by query (substring match)
  const filteredItems = useMemo(() => {
    if (!query.trim()) return allItems;
    const lower = query.toLowerCase();
    return allItems.filter((item) => item.label.toLowerCase().includes(lower));
  }, [allItems, query]);

  // Group by category
  const grouped = useMemo(() => {
    const groups: { category: string; items: CommandItem[] }[] = [];
    const categoryOrder: CommandItem['category'][] = ['Tabs', 'Metamodels', 'Actions'];

    for (const cat of categoryOrder) {
      const items = filteredItems.filter((i) => i.category === cat);
      if (items.length > 0) {
        groups.push({ category: cat, items });
      }
    }
    return groups;
  }, [filteredItems]);

  // Flat list for keyboard navigation
  const flatItems = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

  // Clamp selected index
  useEffect(() => {
    if (selectedIndex >= flatItems.length) {
      setSelectedIndex(Math.max(0, flatItems.length - 1));
    }
  }, [flatItems.length, selectedIndex]);

  // Execute selected item
  const executeItem = useCallback(
    (item: CommandItem) => {
      onAction(item.action);
      onClose();
    },
    [onAction, onClose],
  );

  // Keyboard handler
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, flatItems.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (flatItems[selectedIndex]) {
            executeItem(flatItems[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [flatItems, selectedIndex, executeItem, onClose],
  );

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selected = listRef.current.querySelector('[data-selected="true"]');
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!open) return null;

  let flatIndex = 0;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '15vh',
        background: 'rgba(0,0,0,0.5)',
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        style={{
          width: '100%',
          maxWidth: 560,
          maxHeight: 400,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '0 16px',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}
        >
          <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search commands, tabs, metamodels..."
            style={{
              width: '100%',
              height: 44,
              border: 'none',
              background: 'transparent',
              fontSize: 15,
              color: 'var(--text)',
              outline: 'none',
            }}
            aria-label="Search commands"
          />
        </div>

        {/* Results */}
        <div
          ref={listRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '4px 0',
          }}
          role="listbox"
        >
          {grouped.length === 0 && (
            <div
              style={{
                padding: '16px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: 13,
              }}
            >
              No results found
            </div>
          )}

          {grouped.map((group) => (
            <div key={group.category}>
              {/* Category header */}
              <div
                style={{
                  padding: '8px 16px',
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  letterSpacing: '0.5px',
                }}
              >
                {group.category}
              </div>

              {/* Items */}
              {group.items.map((item) => {
                const isSelected = flatIndex === selectedIndex;
                const currentIndex = flatIndex;
                flatIndex++;

                return (
                  <div
                    key={item.id}
                    data-selected={isSelected}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => executeItem(item)}
                    onMouseEnter={() => setSelectedIndex(currentIndex)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      height: 36,
                      padding: '0 16px',
                      cursor: 'pointer',
                      background: isSelected ? 'var(--primary-bg)' : 'transparent',
                      color: 'var(--text)',
                      fontSize: 14,
                      borderRadius: 4,
                      margin: '0 4px',
                      transition: 'background 0.1s',
                    }}
                  >
                    <span style={{ flexShrink: 0, display: 'flex', color: 'var(--text-secondary)' }}>
                      {item.icon}
                    </span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default CommandPalette;
