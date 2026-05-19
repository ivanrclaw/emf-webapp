import { useState } from 'react';
import type { ConstraintFormState } from './types';

interface OCLInspectorProps {
  form: ConstraintFormState;
  eclassNames: string[];
  metamodelContent: any;
  contextClass: string;
  models: Array<{ id: string; name: string }>;
  selectedModelId: string;
  onChange: (patch: Partial<ConstraintFormState>) => void;
  onSelectModel: (id: string) => void;
}

type Tab = 'properties' | 'type' | 'ast';

const SEVERITY_OPTIONS = ['error', 'warning', 'info'] as const;

export function OCLInspector({
  form,
  eclassNames,
  metamodelContent,
  contextClass,
  models,
  selectedModelId,
  onChange,
  onSelectModel,
}: OCLInspectorProps) {
  const [tab, setTab] = useState<Tab>('properties');

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        background: 'var(--bg)',
        borderLeft: '1px solid var(--border)',
        minWidth: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 32,
          padding: '0 12px',
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--text-muted)',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        Inspector
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          height: 32,
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <TabBtn label="Properties" active={tab === 'properties'} onClick={() => setTab('properties')} />
        <TabBtn label="Type Info" active={tab === 'type'} onClick={() => setTab('type')} />
        <TabBtn label="AST" active={tab === 'ast'} onClick={() => setTab('ast')} />
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {tab === 'properties' && (
          <PropertiesTab
            form={form}
            eclassNames={eclassNames}
            models={models}
            selectedModelId={selectedModelId}
            onChange={onChange}
            onSelectModel={onSelectModel}
          />
        )}
        {tab === 'type' && (
          <TypeInfoTab metamodelContent={metamodelContent} contextClass={contextClass} />
        )}
        {tab === 'ast' && <ASTTab expression={form.expression} />}
      </div>
    </div>
  );
}

function TabBtn({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        height: '100%',
        background: 'transparent',
        border: 'none',
        borderBottom: active ? '2px solid var(--primary)' : '2px solid transparent',
        color: active ? 'var(--text)' : 'var(--text-muted)',
        fontSize: 12,
        fontWeight: active ? 600 : 500,
        cursor: 'pointer',
        padding: 0,
      }}
    >
      {label}
    </button>
  );
}

function PropertiesTab({
  form,
  eclassNames,
  models,
  selectedModelId,
  onChange,
  onSelectModel,
}: {
  form: ConstraintFormState;
  eclassNames: string[];
  models: Array<{ id: string; name: string }>;
  selectedModelId: string;
  onChange: (patch: Partial<ConstraintFormState>) => void;
  onSelectModel: (id: string) => void;
}) {
  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Field label="Name">
        <input
          value={form.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="e.g. UniqueName"
          style={inputStyle(form.name === '')}
        />
      </Field>

      <Field label="Context">
        <select
          value={form.context}
          onChange={(e) => onChange({ context: e.target.value })}
          style={inputStyle(form.context === '')}
        >
          <option value="">— Select EClass —</option>
          {eclassNames.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Severity">
        <select
          value={form.severity}
          onChange={(e) => onChange({ severity: e.target.value })}
          style={inputStyle(false)}
        >
          {SEVERITY_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </Field>

      <SectionDivider />

      <Field label="Validate against (M1)">
        <select
          value={selectedModelId}
          onChange={(e) => onSelectModel(e.target.value)}
          style={inputStyle(false)}
        >
          <option value="">Metamodel structure</option>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <div
          style={{
            fontSize: 10,
            color: 'var(--text-muted)',
            marginTop: 4,
          }}
        >
          Choose an M1 instance for "Validate All"
        </div>
      </Field>
    </div>
  );
}

function TypeInfoTab({
  metamodelContent,
  contextClass,
}: {
  metamodelContent: any;
  contextClass: string;
}) {
  if (!contextClass) {
    return (
      <div style={{ padding: 12, fontSize: 12, color: 'var(--text-muted)' }}>
        Select a context class to inspect its features.
      </div>
    );
  }
  const classifiers: any[] = metamodelContent?.eClassifiers || [];
  const cls = classifiers.find((c: any) => c.name === contextClass);
  if (!cls) {
    return (
      <div style={{ padding: 12, fontSize: 12, color: 'var(--text-muted)' }}>
        Class <code>{contextClass}</code> not found in metamodel.
      </div>
    );
  }

  const idToName: Record<string, string> = {};
  for (const c of classifiers) {
    if (c.id) idToName[c.id] = c.name;
    idToName[c.name] = c.name;
  }
  const supers = (cls.eSuperTypes || []).map((s: string) => idToName[s] || s);

  return (
    <div style={{ padding: 12, fontSize: 12 }}>
      <ContextHeader cls={cls} supers={supers} />
      <SectionDivider />
      <Subheading>Attributes ({(cls.eAttributes || []).length})</Subheading>
      <ul style={listStyle()}>
        {(cls.eAttributes || []).map((a: any) => (
          <li key={a.name} style={listItemStyle()}>
            <code style={codeStyle()}>{a.name}</code>
            <span style={typeStyle()}>: {a.eType || 'EString'}{cardinality(a)}</span>
          </li>
        ))}
        {(cls.eAttributes || []).length === 0 && <li style={emptyHint()}>None</li>}
      </ul>

      <Subheading>References ({(cls.eReferences || []).length})</Subheading>
      <ul style={listStyle()}>
        {(cls.eReferences || []).map((r: any) => (
          <li key={r.name} style={listItemStyle()}>
            <code style={codeStyle()}>{r.name}</code>
            <span style={typeStyle()}>
              : {idToName[r.targetId || ''] || r.targetId || '?'}
              {cardinality(r)}
            </span>
            {r.containment && (
              <span
                style={{
                  marginLeft: 6,
                  fontSize: 9,
                  padding: '1px 5px',
                  background: 'var(--primary-bg)',
                  borderRadius: 3,
                  color: 'var(--primary-light)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                cont.
              </span>
            )}
          </li>
        ))}
        {(cls.eReferences || []).length === 0 && <li style={emptyHint()}>None</li>}
      </ul>

      {(cls.eOperations || []).length > 0 && (
        <>
          <Subheading>Operations ({(cls.eOperations || []).length})</Subheading>
          <ul style={listStyle()}>
            {(cls.eOperations || []).map((op: any) => (
              <li key={op.name} style={listItemStyle()}>
                <code style={codeStyle()}>
                  {op.name}({(op.eParameters || [])
                    .map((p: any) => `${p.name}: ${p.eType || 'EString'}`)
                    .join(', ')})
                </code>
                <span style={typeStyle()}>: {op.eType || 'EString'}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function ContextHeader({ cls, supers }: { cls: any; supers: string[] }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text)',
        }}
      >
        {cls.name}
        {cls.abstract && (
          <span
            style={{
              fontSize: 9,
              padding: '1px 5px',
              background: 'var(--warning-bg)',
              borderRadius: 3,
              color: '#fbbf24',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            abstract
          </span>
        )}
      </div>
      {supers.length > 0 && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            fontFamily: "'JetBrains Mono', monospace",
            marginTop: 2,
          }}
        >
          extends {supers.join(', ')}
        </div>
      )}
    </div>
  );
}

function ASTTab({ expression }: { expression: string }) {
  if (!expression.trim()) {
    return (
      <div style={{ padding: 12, fontSize: 12, color: 'var(--text-muted)' }}>
        Type an expression to see its AST.
      </div>
    );
  }
  return (
    <div style={{ padding: 12 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
        AST viewer (placeholder)
      </div>
      <pre
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          color: 'var(--text-secondary)',
          background: 'var(--surface)',
          padding: 8,
          borderRadius: 4,
          border: '1px solid var(--border)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {expression}
      </pre>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        style={{
          display: 'block',
          fontSize: 10,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--text-muted)',
          marginBottom: 4,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function SectionDivider() {
  return (
    <div
      style={{
        height: 1,
        background: 'var(--border)',
        margin: '4px 0 0',
      }}
    />
  );
}

function Subheading({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: 'var(--text-muted)',
        margin: '8px 0 4px',
      }}
    >
      {children}
    </div>
  );
}

function inputStyle(invalid: boolean): React.CSSProperties {
  return {
    width: '100%',
    height: 28,
    padding: '0 8px',
    borderRadius: 4,
    border: `1px solid ${invalid ? 'var(--danger)' : 'var(--border)'}`,
    background: 'var(--surface)',
    color: 'var(--text)',
    fontSize: 12,
    fontFamily: 'inherit',
  };
}

function listStyle(): React.CSSProperties {
  return {
    listStyle: 'none',
    margin: 0,
    padding: 0,
  };
}

function listItemStyle(): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    fontSize: 11,
    padding: '3px 0',
    borderBottom: '1px solid var(--border-light)',
  };
}

function codeStyle(): React.CSSProperties {
  return {
    fontFamily: "'JetBrains Mono', monospace",
    color: 'var(--text)',
  };
}

function typeStyle(): React.CSSProperties {
  return {
    fontFamily: "'JetBrains Mono', monospace",
    color: 'var(--text-muted)',
  };
}

function emptyHint(): React.CSSProperties {
  return {
    fontSize: 11,
    color: 'var(--text-muted)',
    fontStyle: 'italic',
    padding: '3px 0',
  };
}

function cardinality(feature: { lowerBound?: number; upperBound?: number }): string {
  const lb = feature.lowerBound ?? 0;
  const ub = feature.upperBound ?? 1;
  if (lb === 0 && ub === 1) return ' [0..1]';
  if (lb === 1 && ub === 1) return '';
  if (ub === -1) return lb === 0 ? ' [*]' : ` [${lb}..*]`;
  return ` [${lb}..${ub}]`;
}

export default OCLInspector;
