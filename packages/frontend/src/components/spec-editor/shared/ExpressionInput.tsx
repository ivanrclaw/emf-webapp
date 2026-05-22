/**
 * ExpressionInput — Text input with autocomplete for OCL-like expressions.
 *
 * Provides suggestions based on the metamodel's EClass attributes and references.
 * Triggers on typing "self." or after any "." following a known reference.
 *
 * Suggestions include:
 * - self.attributeName (EString, EInt, etc.)
 * - self.referenceName (→ TargetClass)
 * - Built-in operations: eClass().name, oclIsKindOf(), etc.
 * - String operations after attribute: .size(), .substring(), .toUpperCase(), etc.
 */
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface EClassInfo {
  name: string;
  abstract?: boolean;
  interface?: boolean;
  eAttributes?: { name: string; eType?: string }[];
  eReferences?: { name: string; eType?: string; containment?: boolean; upperBound?: number }[];
}

interface Suggestion {
  label: string;
  detail: string;
  insertText: string;
  kind: 'attribute' | 'reference' | 'operation' | 'keyword';
}

interface ExpressionInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** The domain class name for the current mapping */
  domainClass?: string;
  /** All EClasses from the metamodel */
  eclasses?: EClassInfo[];
}

// ─── Built-in suggestions ────────────────────────────────────────────────────

const SELF_OPERATIONS: Suggestion[] = [
  { label: 'eClass()', detail: 'EClass', insertText: 'eClass()', kind: 'operation' },
  { label: 'eContainer()', detail: 'EObject', insertText: 'eContainer()', kind: 'operation' },
  { label: 'eContents()', detail: 'Collection', insertText: 'eContents()', kind: 'operation' },
  { label: 'eAllContents()', detail: 'Collection', insertText: 'eAllContents()', kind: 'operation' },
  { label: 'oclIsKindOf()', detail: 'Boolean', insertText: 'oclIsKindOf()', kind: 'operation' },
  { label: 'oclIsTypeOf()', detail: 'Boolean', insertText: 'oclIsTypeOf()', kind: 'operation' },
  { label: 'oclAsType()', detail: 'T', insertText: 'oclAsType()', kind: 'operation' },
];

const STRING_OPERATIONS: Suggestion[] = [
  { label: 'size()', detail: 'Integer', insertText: 'size()', kind: 'operation' },
  { label: 'substring()', detail: 'String', insertText: 'substring()', kind: 'operation' },
  { label: 'toUpperCase()', detail: 'String', insertText: 'toUpperCase()', kind: 'operation' },
  { label: 'toLowerCase()', detail: 'String', insertText: 'toLowerCase()', kind: 'operation' },
  { label: 'concat()', detail: 'String', insertText: 'concat()', kind: 'operation' },
  { label: 'trim()', detail: 'String', insertText: 'trim()', kind: 'operation' },
];

const COLLECTION_OPERATIONS: Suggestion[] = [
  { label: 'size()', detail: 'Integer', insertText: 'size()', kind: 'operation' },
  { label: 'isEmpty()', detail: 'Boolean', insertText: 'isEmpty()', kind: 'operation' },
  { label: 'notEmpty()', detail: 'Boolean', insertText: 'notEmpty()', kind: 'operation' },
  { label: 'first()', detail: 'T', insertText: 'first()', kind: 'operation' },
  { label: 'last()', detail: 'T', insertText: 'last()', kind: 'operation' },
  { label: 'select()', detail: 'Collection', insertText: 'select()', kind: 'operation' },
  { label: 'reject()', detail: 'Collection', insertText: 'reject()', kind: 'operation' },
  { label: 'collect()', detail: 'Collection', insertText: 'collect()', kind: 'operation' },
  { label: 'any()', detail: 'T', insertText: 'any()', kind: 'operation' },
  { label: 'exists()', detail: 'Boolean', insertText: 'exists()', kind: 'operation' },
  { label: 'forAll()', detail: 'Boolean', insertText: 'forAll()', kind: 'operation' },
];

const TOP_LEVEL_KEYWORDS: Suggestion[] = [
  { label: 'self', detail: 'Current instance', insertText: 'self', kind: 'keyword' },
  { label: 'true', detail: 'Boolean', insertText: 'true', kind: 'keyword' },
  { label: 'false', detail: 'Boolean', insertText: 'false', kind: 'keyword' },
  { label: 'null', detail: 'Null', insertText: 'null', kind: 'keyword' },
  { label: 'not', detail: 'Boolean negation', insertText: 'not ', kind: 'keyword' },
  { label: 'if', detail: 'Conditional', insertText: 'if ', kind: 'keyword' },
  { label: 'let', detail: 'Variable binding', insertText: 'let ', kind: 'keyword' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isStringType(eType?: string): boolean {
  return eType === 'EString' || eType === 'String' || eType === 'string';
}

function isCollectionRef(upperBound?: number): boolean {
  return upperBound === -1 || (upperBound !== undefined && upperBound > 1);
}

function findEClass(eclasses: EClassInfo[], name: string): EClassInfo | undefined {
  return eclasses.find((ec) => ec.name === name);
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ExpressionInput({
  value,
  onChange,
  placeholder,
  domainClass,
  eclasses = [],
}: ExpressionInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [cursorPos, setCursorPos] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Find the current EClass
  const currentEClass = useMemo(
    () => (domainClass ? findEClass(eclasses, domainClass) : undefined),
    [domainClass, eclasses]
  );

  // Compute suggestions based on cursor position and text
  const suggestions = useMemo(() => {
    const textBeforeCursor = value.slice(0, cursorPos);

    // Find the last token segment (after space, +, (, etc.)
    const tokenMatch = textBeforeCursor.match(/([a-zA-Z_][\w.()]*\.?)$/);
    if (!tokenMatch) {
      // Top-level: suggest keywords
      const prefix = textBeforeCursor.match(/(\w*)$/)?.[1] || '';
      if (!prefix) return [];
      return TOP_LEVEL_KEYWORDS.filter((s) =>
        s.label.toLowerCase().startsWith(prefix.toLowerCase())
      );
    }

    const token = tokenMatch[1];

    // "self." → suggest attributes + references + operations of domainClass
    if (token === 'self.' || token.match(/^self\.$/)) {
      const items: Suggestion[] = [];
      if (currentEClass) {
        for (const attr of currentEClass.eAttributes || []) {
          items.push({
            label: attr.name,
            detail: attr.eType || 'EString',
            insertText: attr.name,
            kind: 'attribute',
          });
        }
        for (const ref of currentEClass.eReferences || []) {
          items.push({
            label: ref.name,
            detail: `→ ${ref.eType || 'EObject'}${isCollectionRef(ref.upperBound) ? ' [*]' : ''}`,
            insertText: ref.name,
            kind: 'reference',
          });
        }
      }
      items.push(...SELF_OPERATIONS);
      return items;
    }

    // "self.xxx" (partial) → filter attributes/references/operations
    const selfDotMatch = token.match(/^self\.([^.]+)$/);
    if (selfDotMatch) {
      const partial = selfDotMatch[1];
      const items: Suggestion[] = [];
      if (currentEClass) {
        for (const attr of currentEClass.eAttributes || []) {
          items.push({
            label: attr.name,
            detail: attr.eType || 'EString',
            insertText: attr.name,
            kind: 'attribute',
          });
        }
        for (const ref of currentEClass.eReferences || []) {
          items.push({
            label: ref.name,
            detail: `→ ${ref.eType || 'EObject'}${isCollectionRef(ref.upperBound) ? ' [*]' : ''}`,
            insertText: ref.name,
            kind: 'reference',
          });
        }
      }
      items.push(...SELF_OPERATIONS);
      return items.filter((s) =>
        s.label.toLowerCase().startsWith(partial.toLowerCase())
      );
    }

    // "self.attrName." → suggest operations based on type
    const afterAttrMatch = token.match(/^self\.(\w+)\.([^.]*)$/);
    if (afterAttrMatch && currentEClass) {
      const memberName = afterAttrMatch[1];
      const partial = afterAttrMatch[2];

      // Check if it's an attribute
      const attr = (currentEClass.eAttributes || []).find((a) => a.name === memberName);
      if (attr && isStringType(attr.eType)) {
        return STRING_OPERATIONS.filter((s) =>
          !partial || s.label.toLowerCase().startsWith(partial.toLowerCase())
        );
      }

      // Check if it's a reference
      const ref = (currentEClass.eReferences || []).find((r) => r.name === memberName);
      if (ref) {
        if (isCollectionRef(ref.upperBound)) {
          // Collection operations + target class attributes
          const ops = [...COLLECTION_OPERATIONS];
          const targetClass = findEClass(eclasses, ref.eType || '');
          if (targetClass) {
            for (const a of targetClass.eAttributes || []) {
              ops.push({
                label: a.name,
                detail: `${a.eType || 'EString'} (via ${ref.name})`,
                insertText: a.name,
                kind: 'attribute',
              });
            }
          }
          return ops.filter((s) =>
            !partial || s.label.toLowerCase().startsWith(partial.toLowerCase())
          );
        } else {
          // Single reference → suggest target class attributes
          const targetClass = findEClass(eclasses, ref.eType || '');
          const items: Suggestion[] = [];
          if (targetClass) {
            for (const a of targetClass.eAttributes || []) {
              items.push({
                label: a.name,
                detail: a.eType || 'EString',
                insertText: a.name,
                kind: 'attribute',
              });
            }
            for (const r of targetClass.eReferences || []) {
              items.push({
                label: r.name,
                detail: `→ ${r.eType || 'EObject'}`,
                insertText: r.name,
                kind: 'reference',
              });
            }
          }
          return items.filter((s) =>
            !partial || s.label.toLowerCase().startsWith(partial.toLowerCase())
          );
        }
      }
    }

    // Partial "sel" → suggest "self"
    if (!token.includes('.')) {
      return TOP_LEVEL_KEYWORDS.filter((s) =>
        s.label.toLowerCase().startsWith(token.toLowerCase())
      );
    }

    return [];
  }, [value, cursorPos, currentEClass, eclasses]);

  // Reset selection when suggestions change
  useEffect(() => {
    setSelectedIdx(0);
  }, [suggestions.length]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Apply a suggestion
  const applySuggestion = useCallback(
    (suggestion: Suggestion) => {
      const textBeforeCursor = value.slice(0, cursorPos);
      const textAfterCursor = value.slice(cursorPos);

      // Find what to replace: the partial after the last dot (or the whole token if no dot in partial)
      const tokenMatch = textBeforeCursor.match(/([a-zA-Z_][\w.()]*\.?)$/);
      if (!tokenMatch) return;

      const token = tokenMatch[1];
      const tokenStart = textBeforeCursor.length - token.length;

      // Determine the prefix to keep (everything up to and including the last dot)
      const lastDotIdx = token.lastIndexOf('.');
      let prefix: string;
      if (lastDotIdx >= 0) {
        prefix = token.slice(0, lastDotIdx + 1);
      } else {
        prefix = '';
      }

      const newValue =
        textBeforeCursor.slice(0, tokenStart) +
        prefix +
        suggestion.insertText +
        textAfterCursor;

      onChange(newValue);
      setShowSuggestions(false);

      // Move cursor after inserted text
      const newCursorPos = tokenStart + prefix.length + suggestion.insertText.length;
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
          inputRef.current.focus();
        }
      }, 0);
    },
    [value, cursorPos, onChange]
  );

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIdx((prev) => (prev + 1) % suggestions.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIdx((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        break;
      case 'Enter':
      case 'Tab':
        e.preventDefault();
        applySuggestion(suggestions[selectedIdx]);
        break;
      case 'Escape':
        e.preventDefault();
        setShowSuggestions(false);
        break;
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const newPos = e.target.selectionStart || 0;
    onChange(newValue);
    setCursorPos(newPos);
    setShowSuggestions(true);
  };

  const handleClick = (e: React.MouseEvent<HTMLInputElement>) => {
    setCursorPos((e.target as HTMLInputElement).selectionStart || 0);
  };

  const handleFocus = () => {
    setCursorPos(inputRef.current?.selectionStart || value.length);
    if (suggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    if (showSuggestions && dropdownRef.current) {
      const item = dropdownRef.current.children[selectedIdx] as HTMLElement;
      if (item) {
        item.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIdx, showSuggestions]);

  const kindIcon = (kind: Suggestion['kind']) => {
    switch (kind) {
      case 'attribute': return '𝑎';
      case 'reference': return '→';
      case 'operation': return 'ƒ';
      case 'keyword': return '⌘';
    }
  };

  const kindColor = (kind: Suggestion['kind']) => {
    switch (kind) {
      case 'attribute': return '#60a5fa';
      case 'reference': return '#a78bfa';
      case 'operation': return '#fbbf24';
      case 'keyword': return '#f472b6';
    }
  };

  return (
    <div style={styles.wrapper}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onClick={handleClick}
        onFocus={handleFocus}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        style={styles.input}
        spellCheck={false}
        autoComplete="off"
      />
      {showSuggestions && suggestions.length > 0 && (
        <div ref={dropdownRef} style={styles.dropdown}>
          {suggestions.map((s, i) => (
            <div
              key={`${s.label}-${i}`}
              onMouseDown={(e) => {
                e.preventDefault();
                applySuggestion(s);
              }}
              onMouseEnter={() => setSelectedIdx(i)}
              style={{
                ...styles.item,
                background: i === selectedIdx ? 'var(--primary-bg, rgba(99, 102, 241, 0.15))' : 'transparent',
              }}
            >
              <span style={{ ...styles.kindBadge, color: kindColor(s.kind) }}>
                {kindIcon(s.kind)}
              </span>
              <span style={styles.itemLabel}>{s.label}</span>
              <span style={styles.itemDetail}>{s.detail}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    position: 'relative',
    width: '100%',
  },
  input: {
    width: '100%',
    padding: '7px 10px',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    background: 'var(--bg-input, var(--background))',
    color: 'var(--text)',
    fontSize: '12px',
    fontFamily: 'monospace',
    outline: 'none',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: '2px',
    maxHeight: '200px',
    overflowY: 'auto',
    background: 'var(--surface, #1e1e2e)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    zIndex: 1000,
    padding: '4px',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '5px 8px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    transition: 'background 0.1s',
  },
  kindBadge: {
    fontSize: '11px',
    fontWeight: 700,
    width: '14px',
    textAlign: 'center' as const,
    flexShrink: 0,
  },
  itemLabel: {
    color: 'var(--text)',
    fontFamily: 'monospace',
    fontSize: '11px',
    fontWeight: 500,
  },
  itemDetail: {
    marginLeft: 'auto',
    color: 'var(--text-muted)',
    fontSize: '10px',
    flexShrink: 0,
  },
};

export default ExpressionInput;
