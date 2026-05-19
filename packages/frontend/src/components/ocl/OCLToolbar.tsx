import React from 'react';
import { Save, Plus, Wand2, CircleCheck, Play, Command } from '../icons';

interface OCLToolbarProps {
  metamodelName: string;
  contextClass?: string;
  dirty: boolean;
  saving: boolean;
  validating: boolean;
  canSave: boolean;
  onNew: () => void;
  onSave: () => void;
  onFormat: () => void;
  onValidateExpression: () => void;
  onValidateAll: () => void;
}

export function OCLToolbar({
  metamodelName,
  contextClass,
  dirty,
  saving,
  validating,
  canSave,
  onNew,
  onSave,
  onFormat,
  onValidateExpression,
  onValidateAll,
}: OCLToolbarProps) {
  return (
    <div
      role="toolbar"
      aria-label="OCL toolbar"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        height: 40,
        minHeight: 40,
        padding: '0 12px',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        fontSize: 12,
        flexShrink: 0,
      }}
    >
      {/* Title */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--text)',
          marginRight: 8,
        }}
      >
        <span style={{ color: 'var(--text-muted)' }}>OCL</span>
        <span style={{ color: 'var(--text-muted)' }}>›</span>
        <span>{metamodelName}</span>
        {contextClass && (
          <>
            <span style={{ color: 'var(--text-muted)' }}>›</span>
            <span
              style={{
                color: 'var(--primary-light)',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
              }}
            >
              {contextClass}
            </span>
          </>
        )}
      </div>

      <ToolbarDivider />

      <ToolbarBtn
        icon={<Plus size={14} />}
        label="New"
        title="New constraint"
        onClick={onNew}
      />
      <ToolbarBtn
        icon={<Save size={14} />}
        label={saving ? 'Saving…' : 'Save'}
        title="Save (Ctrl+S)"
        primary={dirty}
        disabled={!canSave || saving}
        onClick={onSave}
      />
      <ToolbarBtn
        icon={<Wand2 size={14} />}
        label="Format"
        title="Format expression (Shift+Alt+F)"
        onClick={onFormat}
      />

      <ToolbarDivider />

      <ToolbarBtn
        icon={<CircleCheck size={14} />}
        label="Check"
        title="Diagnose current expression"
        onClick={onValidateExpression}
      />
      <ToolbarBtn
        icon={<Play size={14} />}
        label={validating ? 'Validating…' : 'Validate All'}
        title="Validate all constraints (Ctrl+Shift+B)"
        disabled={validating}
        onClick={onValidateAll}
      />

      <div style={{ flex: 1 }} />

      {/* Cmd-K hint */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          color: 'var(--text-muted)',
          fontSize: 11,
        }}
      >
        <Command size={12} />
        <span>K</span>
      </div>
    </div>
  );
}

function ToolbarDivider() {
  return (
    <div
      style={{
        width: 1,
        height: 18,
        background: 'var(--border)',
        margin: '0 2px',
      }}
    />
  );
}

interface ToolbarBtnProps {
  icon: React.ReactNode;
  label: string;
  title?: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}

function ToolbarBtn({ icon, label, title, onClick, disabled, primary }: ToolbarBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 28,
        padding: '0 10px',
        borderRadius: 6,
        border: '1px solid transparent',
        background: primary ? 'var(--primary-bg)' : 'transparent',
        color: primary ? 'var(--primary-light)' : 'var(--text-secondary)',
        fontSize: 12,
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background 120ms, color 120ms',
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          (e.currentTarget as HTMLButtonElement).style.background = primary
            ? 'color-mix(in srgb, var(--primary) 22%, transparent)'
            : 'var(--surface-hover)';
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--text)';
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = primary
          ? 'var(--primary-bg)'
          : 'transparent';
        (e.currentTarget as HTMLButtonElement).style.color = primary
          ? 'var(--primary-light)'
          : 'var(--text-secondary)';
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export default OCLToolbar;
