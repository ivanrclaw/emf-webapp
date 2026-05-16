/**
 * @emf-webapp/frontend — OCLValidationPanel
 *
 * Panel lateral que muestra el estado de validación OCL en vivo.
 * Se sitúa debajo del PropertyInspector en el editor Ecore.
 */
import React from 'react';
import { CircleCheck, CircleX, RefreshCw } from '../icons';

interface OCLValidationPanelProps {
  enabled: boolean;
  loading: boolean;
  totalViolations: number;
  totalConstraints: number;
  allResults: Array<{
    constraintId: string;
    constraintName: string;
    context: string;
    passed: boolean;
    error?: string;
  }>;
  onToggle: () => void;
  onRefresh: () => void;
}

const SEVERITY_COLORS: Record<string, string> = {
  error: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',
};

export default function OCLValidationPanel({
  enabled,
  loading,
  totalViolations,
  totalConstraints,
  allResults,
  onToggle,
  onRefresh,
}: OCLValidationPanelProps) {
  const hasIssues = totalViolations > 0;

  return (
    <div style={{
      padding: '10px 14px',
      borderTop: '1px solid var(--border)',
      fontSize: 12,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      maxHeight: 240,
      overflow: 'auto',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
        letterSpacing: '0.5px', color: 'var(--text-secondary)',
      }}>
        <span>OCL Validation</span>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button
            onClick={onRefresh}
            title="Refresh constraints"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-secondary)', padding: '2px 4px',
              display: 'flex', alignItems: 'center',
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
          </button>
          <button
            onClick={onToggle}
            title={enabled ? 'Disable OCL validation' : 'Enable OCL validation'}
            style={{
              padding: '2px 8px', borderRadius: 4, fontSize: 10,
              fontWeight: 600, border: '1px solid var(--border)',
              background: enabled ? 'var(--primary)' : 'var(--surface)',
              color: enabled ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            {enabled ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 11, textAlign: 'center', padding: 8 }}>
          Checking constraints…
        </div>
      ) : hasIssues ? (
        <>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 8px', borderRadius: 6,
            background: 'var(--danger-bg)', color: 'var(--danger)',
            fontSize: 11, fontWeight: 600,
          }}>
            <CircleX size={14} />
            {totalViolations} violation{totalViolations !== 1 ? 's' : ''} found
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {allResults.map((r, i) => (
              <div
                key={r.constraintId || i}
                style={{
                  padding: '4px 8px', borderRadius: 4,
                  fontSize: 11,
                  background: r.passed ? 'transparent' : 'var(--danger-bg)',
                  color: r.passed ? 'var(--text-secondary)' : 'var(--danger)',
                  borderLeft: `3px solid ${r.passed ? 'var(--success)' : 'var(--danger)'}`,
                }}
              >
                <div style={{ fontWeight: 600 }}>{r.constraintName || r.constraintId}</div>
                {r.error && (
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                    {r.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      ) : totalConstraints > 0 ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 8px', borderRadius: 6,
          background: 'var(--success-bg)', color: 'var(--success)',
          fontSize: 11, fontWeight: 600,
        }}>
          <CircleCheck size={14} />
          {totalConstraints} constraint{totalConstraints !== 1 ? 's' : ''} passed
        </div>
      ) : (
        <div style={{ color: 'var(--text-muted)', fontSize: 11, textAlign: 'center', padding: 8 }}>
          No OCL constraints defined
        </div>
      )}
    </div>
  );
}
