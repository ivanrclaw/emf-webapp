import { useMemo, useState } from 'react';
import {
  Box,
  ChevronRight,
  ChevronDown,
  Plus,
  Search,
  CircleX,
  CircleAlert,
  Info,
  CircleCheck,
  Trash2,
  Pencil,
} from '../icons';
import type {
  OCLConstraint,
} from '../../api/client';
import type {
  ConstraintRunSummary,
  DiagnosticsMap,
  RunSummaries,
} from './types';
import { classifyDiagnostics } from './types';

interface OCLConstraintBrowserProps {
  constraints: OCLConstraint[];
  eclassNames: string[];
  selectedId: string | null;
  diagnosticsMap: DiagnosticsMap;
  runSummaries: RunSummaries;
  dirtyId: string | null;
  onSelect: (id: string) => void;
  onNew: (contextClass?: string) => void;
  onDelete: (id: string) => void;
  onRename: (c: OCLConstraint) => void;
}

export function OCLConstraintBrowser({
  constraints,
  eclassNames,
  selectedId,
  diagnosticsMap,
  runSummaries,
  dirtyId,
  onSelect,
  onNew,
  onDelete,
  onRename,
}: OCLConstraintBrowserProps) {
  const [filter, setFilter] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const groups = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const filtered = f
      ? constraints.filter(
          (c) =>
            c.name.toLowerCase().includes(f) ||
            c.expression.toLowerCase().includes(f) ||
            c.context.toLowerCase().includes(f),
        )
      : constraints;

    const map = new Map<string, OCLConstraint[]>();
    for (const c of filtered) {
      const arr = map.get(c.context) || [];
      arr.push(c);
      map.set(c.context, arr);
    }
    // Sort entries within each group
    for (const arr of map.values()) {
      arr.sort((a, b) => a.name.localeCompare(b.name));
    }
    // Sort group keys: present in metamodel first (in metamodel order), then leftovers
    const presentOrdered = eclassNames.filter((name) => map.has(name));
    const orphans = Array.from(map.keys())
      .filter((k) => !eclassNames.includes(k))
      .sort();
    return [...presentOrdered, ...orphans].map((k) => [k, map.get(k)!] as const);
  }, [constraints, filter, eclassNames]);

  const totalShown = groups.reduce((sum, [, arr]) => sum + arr.length, 0);

  const toggleGroup = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        background: 'var(--bg)',
        borderRight: '1px solid var(--border)',
        minWidth: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 32,
          padding: '0 10px 0 12px',
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--text-muted)',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <span style={{ flex: 1 }}>Constraints</span>
        <button
          onClick={() => onNew()}
          title="New constraint"
          aria-label="New constraint"
          style={iconBtnStyle()}
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Filter */}
      <div
        style={{
          padding: 8,
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Search
            size={12}
            style={{
              position: 'absolute',
              left: 8,
              color: 'var(--text-muted)',
              pointerEvents: 'none',
            }}
          />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter…"
            style={{
              width: '100%',
              height: 26,
              padding: '0 8px 0 26px',
              borderRadius: 4,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: 12,
              fontFamily: 'inherit',
            }}
          />
        </div>
      </div>

      {/* Tree */}
      <div style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}>
        {totalShown === 0 ? (
          <EmptyState filter={filter} onNew={() => onNew()} />
        ) : (
          groups.map(([context, items]) => {
            const isCollapsed = collapsed.has(context);
            return (
              <div key={context}>
                <GroupRow
                  context={context}
                  count={items.length}
                  collapsed={isCollapsed}
                  onToggle={() => toggleGroup(context)}
                  onAdd={() => onNew(context)}
                />
                {!isCollapsed &&
                  items.map((c) => (
                    <ConstraintRow
                      key={c.id}
                      constraint={c}
                      selected={selectedId === c.id}
                      dirty={dirtyId === c.id}
                      diagSummary={classifyDiagnostics(diagnosticsMap[c.id])}
                      run={runSummaries[c.id]}
                      onSelect={() => onSelect(c.id)}
                      onDelete={() => onDelete(c.id)}
                      onRename={() => onRename(c)}
                    />
                  ))}
              </div>
            );
          })
        )}
      </div>

      {/* Footer counts */}
      <div
        style={{
          height: 26,
          padding: '0 10px',
          display: 'flex',
          alignItems: 'center',
          fontSize: 11,
          color: 'var(--text-muted)',
          borderTop: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        {constraints.length} constraint{constraints.length !== 1 ? 's' : ''}
        {filter && (
          <span style={{ marginLeft: 6 }}>· {totalShown} shown</span>
        )}
      </div>
    </div>
  );
}

function EmptyState({ filter, onNew }: { filter: string; onNew: () => void }) {
  return (
    <div
      style={{
        padding: '24px 16px',
        textAlign: 'center',
        color: 'var(--text-muted)',
      }}
    >
      <div style={{ fontSize: 12, marginBottom: 8 }}>
        {filter ? 'No matches' : 'No constraints yet'}
      </div>
      {!filter && (
        <button
          onClick={onNew}
          style={{
            background: 'transparent',
            border: '1px dashed var(--border)',
            color: 'var(--text-secondary)',
            padding: '6px 10px',
            borderRadius: 6,
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          <Plus size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
          Create constraint
        </button>
      )}
    </div>
  );
}

interface GroupRowProps {
  context: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  onAdd: () => void;
}

function GroupRow({ context, count, collapsed, onToggle, onAdd }: GroupRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: 26,
        padding: '0 6px 0 4px',
        cursor: 'pointer',
        userSelect: 'none',
      }}
      onClick={onToggle}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = 'var(--surface)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = 'transparent';
      }}
    >
      <div style={{ width: 16, display: 'flex', justifyContent: 'center', color: 'var(--text-muted)' }}>
        {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
      </div>
      <Box size={13} style={{ color: 'var(--primary-light)', marginRight: 6 }} />
      <span
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--text)',
          fontFamily: "'JetBrains Mono', monospace",
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
        }}
      >
        {context}
      </span>
      <span
        style={{
          fontSize: 10,
          color: 'var(--text-muted)',
          marginRight: 4,
        }}
      >
        {count}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onAdd();
        }}
        title={`New constraint on ${context}`}
        aria-label={`New constraint on ${context}`}
        style={{ ...iconBtnStyle(), width: 20, height: 20 }}
      >
        <Plus size={11} />
      </button>
    </div>
  );
}

interface ConstraintRowProps {
  constraint: OCLConstraint;
  selected: boolean;
  dirty: boolean;
  diagSummary: { errors: number; warnings: number; infos: number };
  run?: ConstraintRunSummary;
  onSelect: () => void;
  onDelete: () => void;
  onRename: () => void;
}

function ConstraintRow({
  constraint,
  selected,
  dirty,
  diagSummary,
  run,
  onSelect,
  onDelete,
  onRename,
}: ConstraintRowProps) {
  const [hovered, setHovered] = useState(false);

  const sevIcon = diagSummary.errors > 0 ? (
    <CircleX size={11} style={{ color: 'var(--danger)' }} />
  ) : diagSummary.warnings > 0 ? (
    <CircleAlert size={11} style={{ color: '#fbbf24' }} />
  ) : diagSummary.infos > 0 ? (
    <Info size={11} style={{ color: '#60a5fa' }} />
  ) : run?.status === 'passed' ? (
    <CircleCheck size={11} style={{ color: 'var(--success)' }} />
  ) : run?.status === 'failed' ? (
    <CircleX size={11} style={{ color: 'var(--danger)' }} />
  ) : run?.status === 'error' ? (
    <CircleAlert size={11} style={{ color: '#fbbf24' }} />
  ) : (
    <span
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: severityDotColor(constraint.severity),
      }}
    />
  );

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        height: 24,
        padding: '0 6px 0 26px',
        cursor: 'pointer',
        userSelect: 'none',
        background: selected
          ? 'var(--primary-bg)'
          : hovered
            ? 'var(--surface)'
            : 'transparent',
        borderLeft: selected
          ? '2px solid var(--primary)'
          : '2px solid transparent',
        gap: 6,
      }}
    >
      <span style={{ display: 'flex', width: 14, justifyContent: 'center' }}>{sevIcon}</span>
      <span
        style={{
          fontSize: 12,
          color: selected ? 'var(--text)' : 'var(--text-secondary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
        }}
      >
        {constraint.name}
      </span>
      {dirty && (
        <span
          title="Unsaved changes"
          style={{
            color: '#fbbf24',
            fontSize: 14,
            lineHeight: 1,
          }}
        >
          ●
        </span>
      )}
      {hovered && (
        <span style={{ display: 'inline-flex', gap: 2 }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRename();
            }}
            title="Rename"
            aria-label="Rename"
            style={iconBtnStyle()}
          >
            <Pencil size={11} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Delete"
            aria-label="Delete"
            style={{ ...iconBtnStyle(), color: 'var(--danger)' }}
          >
            <Trash2 size={11} />
          </button>
        </span>
      )}
    </div>
  );
}

function iconBtnStyle(): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 22,
    height: 22,
    borderRadius: 4,
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: 0,
  };
}

function severityDotColor(severity: string): string {
  switch (severity) {
    case 'error':
      return 'var(--danger)';
    case 'warning':
      return '#fbbf24';
    case 'info':
      return '#60a5fa';
    default:
      return 'var(--text-muted)';
  }
}

export default OCLConstraintBrowser;
