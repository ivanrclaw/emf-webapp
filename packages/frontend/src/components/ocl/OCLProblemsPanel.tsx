import { useMemo, useState } from 'react';
import { CircleX, CircleAlert, Info, Filter, X } from '../icons';
import type { OCLConstraint, OCLValidationResult } from '../../api/client';
import type { AggregatedProblem, DiagnosticsMap, Severity } from './types';

interface OCLProblemsPanelProps {
  constraints: OCLConstraint[];
  diagnosticsMap: DiagnosticsMap;
  validationResults: OCLValidationResult[] | null;
  onJumpTo: (constraintId: string, offset: number) => void;
  onClose?: () => void;
}

type Tab = 'problems' | 'output';

export function OCLProblemsPanel({
  constraints,
  diagnosticsMap,
  validationResults,
  onJumpTo,
  onClose,
}: OCLProblemsPanelProps) {
  const [tab, setTab] = useState<Tab>('problems');
  const [showError, setShowError] = useState(true);
  const [showWarn, setShowWarn] = useState(true);
  const [showInfo, setShowInfo] = useState(true);

  const aggregated = useMemo<AggregatedProblem[]>(() => {
    const list: AggregatedProblem[] = [];
    for (const c of constraints) {
      const diags = diagnosticsMap[c.id] || [];
      for (const d of diags) {
        list.push({
          ...d,
          constraintId: c.id,
          constraintName: c.name,
          context: c.context,
        });
      }
    }
    // Sort: errors first, then warnings, then infos; alphabetical by constraint
    const order: Record<Severity, number> = { error: 0, warning: 1, info: 2 };
    list.sort((a, b) => {
      const sa = order[a.severity] - order[b.severity];
      if (sa !== 0) return sa;
      return a.constraintName.localeCompare(b.constraintName);
    });
    return list;
  }, [constraints, diagnosticsMap]);

  const filtered = aggregated.filter((p) => {
    if (p.severity === 'error') return showError;
    if (p.severity === 'warning') return showWarn;
    if (p.severity === 'info') return showInfo;
    return true;
  });

  const totals = useMemo(() => {
    let e = 0;
    let w = 0;
    let i = 0;
    for (const p of aggregated) {
      if (p.severity === 'error') e++;
      else if (p.severity === 'warning') w++;
      else i++;
    }
    return { e, w, i };
  }, [aggregated]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        background: 'var(--bg)',
        borderTop: '1px solid var(--border)',
        minHeight: 0,
      }}
    >
      {/* Header / tab strip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 32,
          padding: '0 8px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
          gap: 4,
        }}
      >
        <TabBtn
          label="Problems"
          badge={totals.e + totals.w + totals.i}
          active={tab === 'problems'}
          onClick={() => setTab('problems')}
        />
        <TabBtn
          label="Output"
          badge={validationResults?.length ?? null}
          active={tab === 'output'}
          onClick={() => setTab('output')}
        />

        <div style={{ flex: 1 }} />

        {tab === 'problems' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginRight: 4 }}>
            <Filter size={12} style={{ color: 'var(--text-muted)' }} />
            <SeverityToggle
              icon={<CircleX size={12} style={{ color: 'var(--danger)' }} />}
              count={totals.e}
              active={showError}
              onClick={() => setShowError((v) => !v)}
              label="errors"
            />
            <SeverityToggle
              icon={<CircleAlert size={12} style={{ color: '#fbbf24' }} />}
              count={totals.w}
              active={showWarn}
              onClick={() => setShowWarn((v) => !v)}
              label="warnings"
            />
            <SeverityToggle
              icon={<Info size={12} style={{ color: '#60a5fa' }} />}
              count={totals.i}
              active={showInfo}
              onClick={() => setShowInfo((v) => !v)}
              label="infos"
            />
          </div>
        )}

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            title="Hide panel"
            aria-label="Hide panel"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 22,
              height: 22,
              border: 'none',
              borderRadius: 4,
              background: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {tab === 'problems' ? (
          filtered.length === 0 ? (
            <EmptyState
              text={
                aggregated.length === 0
                  ? 'No problems detected.'
                  : 'No problems match current filters.'
              }
            />
          ) : (
            filtered.map((p, idx) => (
              <ProblemRow key={`${p.constraintId}-${idx}`} problem={p} onJump={onJumpTo} />
            ))
          )
        ) : (
          <OutputTab results={validationResults} />
        )}
      </div>
    </div>
  );
}

function TabBtn({
  label,
  active,
  onClick,
  badge,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  badge: number | null;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 28,
        padding: '0 10px',
        background: 'transparent',
        border: 'none',
        borderBottom: active ? '2px solid var(--primary)' : '2px solid transparent',
        color: active ? 'var(--text)' : 'var(--text-muted)',
        fontSize: 11,
        fontWeight: active ? 600 : 500,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        cursor: 'pointer',
      }}
    >
      {label}
      {badge !== null && badge > 0 && (
        <span
          style={{
            background: 'var(--surface)',
            color: 'var(--text-secondary)',
            fontSize: 10,
            padding: '1px 6px',
            borderRadius: 8,
            minWidth: 16,
            textAlign: 'center',
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function SeverityToggle({
  icon,
  count,
  active,
  onClick,
  label,
}: {
  icon: React.ReactNode;
  count: number;
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Toggle ${label}`}
      aria-label={`Toggle ${label}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        height: 22,
        padding: '0 6px',
        background: active ? 'var(--surface)' : 'transparent',
        border: '1px solid',
        borderColor: active ? 'var(--border)' : 'transparent',
        borderRadius: 4,
        color: active ? 'var(--text)' : 'var(--text-muted)',
        fontSize: 11,
        cursor: 'pointer',
        opacity: active ? 1 : 0.55,
      }}
    >
      {icon}
      <span>{count}</span>
    </button>
  );
}

function ProblemRow({
  problem,
  onJump,
}: {
  problem: AggregatedProblem;
  onJump: (id: string, offset: number) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const sevIcon =
    problem.severity === 'error' ? (
      <CircleX size={12} style={{ color: 'var(--danger)' }} />
    ) : problem.severity === 'warning' ? (
      <CircleAlert size={12} style={{ color: '#fbbf24' }} />
    ) : (
      <Info size={12} style={{ color: '#60a5fa' }} />
    );

  return (
    <div
      onClick={() => onJump(problem.constraintId, problem.offset)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 12px',
        cursor: 'pointer',
        background: hovered ? 'var(--surface)' : 'transparent',
        borderBottom: '1px solid var(--border-light)',
        fontSize: 12,
      }}
    >
      <span style={{ display: 'inline-flex', width: 14 }}>{sevIcon}</span>
      <span
        style={{
          color: 'var(--text)',
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {problem.message}
      </span>
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          color: 'var(--text-muted)',
        }}
      >
        {problem.constraintName}
      </span>
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          color: 'var(--text-muted)',
          minWidth: 60,
          textAlign: 'right',
        }}
      >
        {problem.line && problem.column
          ? `[Ln ${problem.line}, Col ${problem.column}]`
          : `[+${problem.offset}]`}
      </span>
    </div>
  );
}

function OutputTab({ results }: { results: OCLValidationResult[] | null }) {
  if (!results) {
    return <EmptyState text="Run “Validate All” to see results here." />;
  }
  if (results.length === 0) {
    return <EmptyState text="No constraints to validate." />;
  }
  const passed = results.filter((r) => r.passed).length;
  return (
    <div>
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--border)',
          fontSize: 11,
          color: 'var(--text-muted)',
        }}
      >
        {passed} of {results.length} passed
      </div>
      {results.map((r) => (
        <div
          key={r.constraintId}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            padding: '6px 12px',
            borderBottom: '1px solid var(--border-light)',
            fontSize: 12,
          }}
        >
          <span style={{ marginTop: 1 }}>
            {r.passed ? (
              <span style={{ color: 'var(--success)' }}>✓</span>
            ) : (
              <span style={{ color: 'var(--danger)' }}>✗</span>
            )}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: 'var(--text)', fontWeight: 500 }}>{r.name}</div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                color: 'var(--text-muted)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              context {r.context}: {r.expression}
            </div>
            {r.error && (
              <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 2 }}>{r.error}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div
      style={{
        padding: '24px 16px',
        textAlign: 'center',
        fontSize: 12,
        color: 'var(--text-muted)',
      }}
    >
      {text}
    </div>
  );
}

export default OCLProblemsPanel;
