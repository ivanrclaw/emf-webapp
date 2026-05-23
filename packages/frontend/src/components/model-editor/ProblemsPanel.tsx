/**
 * @emf-webapp/frontend — ProblemsPanel
 *
 * Collapsible bottom panel showing model validation diagnostics.
 * Similar to VS Code's Problems panel — errors/warnings with filters,
 * click-to-navigate, and severity icons.
 */
import { useState, useMemo, useCallback } from 'react';
import { ChevronDown, ChevronRight } from '../../components/icons';
import type { ModelDiagnostic, DiagnosticSeverity } from './hooks/useModelValidation';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ProblemsPanelProps {
  diagnostics: ModelDiagnostic[];
  errorCount: number;
  warningCount: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onNavigate: (objectId: string) => void;
}

type FilterMode = 'all' | 'errors' | 'warnings';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function SeverityIcon({ severity }: { severity: DiagnosticSeverity }) {
  if (severity === 'error') {
    return (
      <span style={{ color: '#ef4444', fontSize: 14, lineHeight: 1 }} aria-label="Error">
        ⊘
      </span>
    );
  }
  return (
    <span style={{ color: '#eab308', fontSize: 14, lineHeight: 1 }} aria-label="Warning">
      ⚠
    </span>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const colors: Record<string, string> = {
    multiplicity: '#8b5cf6',
    type: '#3b82f6',
    containment: '#10b981',
    abstract: '#f97316',
    reference: '#ec4899',
  };
  return (
    <span style={{
      fontSize: 9,
      padding: '1px 5px',
      borderRadius: 3,
      background: `${colors[category] || '#6b7280'}20`,
      color: colors[category] || '#6b7280',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.03em',
    }}>
      {category}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ProblemsPanel({
  diagnostics,
  errorCount,
  warningCount,
  collapsed,
  onToggleCollapse,
  onNavigate,
}: ProblemsPanelProps) {
  const [filter, setFilter] = useState<FilterMode>('all');

  const filteredDiagnostics = useMemo(() => {
    if (filter === 'all') return diagnostics;
    if (filter === 'errors') return diagnostics.filter((d) => d.severity === 'error');
    return diagnostics.filter((d) => d.severity === 'warning');
  }, [diagnostics, filter]);

  // Group by object
  const grouped = useMemo(() => {
    const map = new Map<string, ModelDiagnostic[]>();
    for (const d of filteredDiagnostics) {
      const key = d.objectId;
      const list = map.get(key) || [];
      list.push(d);
      map.set(key, list);
    }
    return map;
  }, [filteredDiagnostics]);

  const handleItemClick = useCallback((objectId: string) => {
    onNavigate(objectId);
  }, [onNavigate]);

  const total = errorCount + warningCount;

  return (
    <div style={{
      borderTop: '1px solid var(--border, #27272a)',
      background: 'var(--surface, #1e1e2e)',
      display: 'flex',
      flexDirection: 'column',
      maxHeight: collapsed ? 32 : 200,
      minHeight: 32,
      transition: 'max-height 0.2s ease',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '5px 12px',
          cursor: 'pointer',
          userSelect: 'none',
          borderBottom: collapsed ? 'none' : '1px solid var(--border, #27272a)',
          flexShrink: 0,
        }}
        onClick={onToggleCollapse}
        role="button"
        aria-expanded={!collapsed}
        aria-label="Problems panel"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary, #a1a1aa)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
          Problems
        </span>

        {/* Counts */}
        {errorCount > 0 && (
          <span style={{
            display: 'flex', alignItems: 'center', gap: 3,
            fontSize: 11, color: '#ef4444', fontWeight: 600,
          }}>
            <span style={{ fontSize: 12 }}>⊘</span> {errorCount}
          </span>
        )}
        {warningCount > 0 && (
          <span style={{
            display: 'flex', alignItems: 'center', gap: 3,
            fontSize: 11, color: '#eab308', fontWeight: 600,
          }}>
            <span style={{ fontSize: 12 }}>⚠</span> {warningCount}
          </span>
        )}
        {total === 0 && (
          <span style={{ fontSize: 11, color: '#10b981', fontWeight: 500 }}>
            ✓ No problems
          </span>
        )}

        {/* Filter buttons (only when expanded) */}
        {!collapsed && total > 0 && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
            {(['all', 'errors', 'warnings'] as FilterMode[]).map((mode) => (
              <button
                key={mode}
                onClick={(e) => { e.stopPropagation(); setFilter(mode); }}
                style={{
                  padding: '2px 6px',
                  fontSize: 10,
                  border: 'none',
                  borderRadius: 3,
                  background: filter === mode ? 'var(--primary, #6366f1)' : 'transparent',
                  color: filter === mode ? '#fff' : 'var(--text-muted, #71717a)',
                  cursor: 'pointer',
                  fontWeight: 500,
                  fontFamily: 'inherit',
                  textTransform: 'capitalize',
                }}
              >
                {mode}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      {!collapsed && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          {filteredDiagnostics.length === 0 ? (
            <div style={{
              padding: '16px 12px',
              textAlign: 'center',
              color: 'var(--text-muted, #71717a)',
              fontSize: 11,
            }}>
              {total === 0 ? 'Model is valid — no problems detected.' : 'No problems match the current filter.'}
            </div>
          ) : (
            Array.from(grouped.entries()).map(([objectId, items]) => (
              <div key={objectId}>
                {items.map((diag) => (
                  <div
                    key={diag.id}
                    onClick={() => handleItemClick(diag.objectId)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '4px 12px',
                      cursor: 'pointer',
                      fontSize: 12,
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hover, rgba(255,255,255,0.04))'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    role="button"
                    aria-label={`${diag.severity}: ${diag.message}`}
                  >
                    <SeverityIcon severity={diag.severity} />
                    <span style={{
                      flex: 1,
                      color: 'var(--text, #e4e4e7)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {diag.message}
                    </span>
                    <CategoryBadge category={diag.category} />
                    <span style={{
                      fontSize: 10,
                      color: 'var(--text-muted, #71717a)',
                      maxWidth: 80,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {diag.objectName}
                    </span>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
