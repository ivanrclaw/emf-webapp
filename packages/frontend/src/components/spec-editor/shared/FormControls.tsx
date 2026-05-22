/**
 * Shared form controls for the spec editor panels.
 */
import React from 'react';

// ─── Form Field ───────────────────────────────────────────────────────────────

export function FormField({ label, children, inline }: { label: string; children: React.ReactNode; inline?: boolean }) {
  return (
    <div style={inline ? styles.fieldInline : styles.field}>
      <label style={styles.fieldLabel}>{label}</label>
      {children}
    </div>
  );
}

// ─── Color Picker ─────────────────────────────────────────────────────────────

export function ColorPicker({ value, onChange, label }: { value: string; onChange: (v: string) => void; label?: string }) {
  return (
    <div style={styles.colorPickerWrap}>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={styles.colorInput}
        title={label}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={styles.colorText}
        spellCheck={false}
      />
    </div>
  );
}

// ─── Slider ───────────────────────────────────────────────────────────────────

export function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <div style={styles.sliderWrap}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={styles.slider}
      />
      <span style={styles.sliderValue}>
        {value}{suffix}
      </span>
    </div>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label style={styles.toggleWrap}>
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        style={styles.toggleInput}
      />
      <span style={styles.toggleLabel}>{label}</span>
    </label>
  );
}

// ─── Select ───────────────────────────────────────────────────────────────────

export function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={styles.select}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}

// ─── Number Input ─────────────────────────────────────────────────────────────

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <div style={styles.numberWrap}>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        style={styles.numberInput}
      />
      {suffix && <span style={styles.numberSuffix}>{suffix}</span>}
    </div>
  );
}

// ─── Text Input ───────────────────────────────────────────────────────────────

export function TextInput({
  value,
  onChange,
  placeholder,
  readOnly,
  monospace,
}: {
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  monospace?: boolean;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      placeholder={placeholder}
      readOnly={readOnly}
      style={{ ...styles.textInput, ...(monospace ? { fontFamily: 'monospace', fontSize: '11px' } : {}) }}
    />
  );
}

// ─── Section Divider ──────────────────────────────────────────────────────────

export function SectionDivider({ label }: { label: string }) {
  return (
    <div style={styles.divider}>
      <span style={styles.dividerLabel}>{label}</span>
      <div style={styles.dividerLine} />
    </div>
  );
}

// ─── Multi-Select (checkbox list) ─────────────────────────────────────────────

export function MultiSelect({
  options,
  selected,
  onChange,
  emptyText,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
  emptyText?: string;
}) {
  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  if (options.length === 0) {
    return <div style={styles.multiEmpty}>{emptyText || 'No options available'}</div>;
  }

  return (
    <div style={styles.multiContainer}>
      {options.map((opt) => (
        <label key={opt.value} style={styles.multiItem}>
          <input
            type="checkbox"
            checked={selected.includes(opt.value)}
            onChange={() => toggle(opt.value)}
            style={styles.multiCheckbox}
          />
          <span style={styles.multiLabel}>{opt.label}</span>
        </label>
      ))}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  fieldInline: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
  },
  fieldLabel: {
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  },
  colorPickerWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  colorInput: {
    width: '28px',
    height: '28px',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    padding: '2px',
    cursor: 'pointer',
    background: 'none',
  },
  colorText: {
    flex: 1,
    padding: '5px 8px',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    background: 'var(--bg-input, var(--background))',
    color: 'var(--text)',
    fontSize: '11px',
    fontFamily: 'monospace',
    outline: 'none',
  },
  sliderWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  slider: {
    flex: 1,
    height: '4px',
    cursor: 'pointer',
    accentColor: 'var(--primary)',
  },
  sliderValue: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    minWidth: '32px',
    textAlign: 'right',
  },
  toggleWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  toggleInput: {
    width: '14px',
    height: '14px',
    accentColor: 'var(--primary)',
    cursor: 'pointer',
  },
  toggleLabel: {
    color: 'var(--text)',
  },
  select: {
    width: '100%',
    padding: '7px 10px',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    background: 'var(--bg-input, var(--background))',
    color: 'var(--text)',
    fontSize: '12px',
    outline: 'none',
    cursor: 'pointer',
  },
  numberWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  numberInput: {
    width: '70px',
    padding: '5px 8px',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    background: 'var(--bg-input, var(--background))',
    color: 'var(--text)',
    fontSize: '12px',
    outline: 'none',
  },
  numberSuffix: {
    fontSize: '11px',
    color: 'var(--text-muted)',
  },
  textInput: {
    width: '100%',
    padding: '7px 10px',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    background: 'var(--bg-input, var(--background))',
    color: 'var(--text)',
    fontSize: '12px',
    outline: 'none',
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    margin: '4px 0',
  },
  dividerLabel: {
    fontSize: '10px',
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    whiteSpace: 'nowrap',
  },
  dividerLine: {
    flex: 1,
    height: '1px',
    background: 'var(--border)',
  },
  multiContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    maxHeight: '160px',
    overflowY: 'auto',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    padding: '4px',
  },
  multiItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 6px',
    borderRadius: '3px',
    cursor: 'pointer',
    fontSize: '11px',
  },
  multiCheckbox: {
    width: '13px',
    height: '13px',
    accentColor: 'var(--primary)',
    cursor: 'pointer',
    flexShrink: 0,
  },
  multiLabel: {
    color: 'var(--text)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  multiEmpty: {
    padding: '8px',
    fontSize: '11px',
    color: 'var(--text-muted)',
    textAlign: 'center',
    border: '1px dashed var(--border)',
    borderRadius: '4px',
  },
};
