import { useEffect, useRef, useState, useMemo, useCallback } from 'react';

// ─── Local types (no @emf-webapp/core import) ────────────────────────────────

export interface ExecutionLogEntry {
  type: 'template-start' | 'template-end' | 'query-call' | 'file-write' | 'error' | 'warning' | 'info';
  timestamp: number;
  templateName?: string;
  moduleName?: string;
  sourceLine?: number;
  args?: string;
  duration?: number;
  outputLength?: number;
  fileName?: string;
  message?: string;
}

export interface ConsolePanelProps {
  log: ExecutionLogEntry[];
  executionTime?: number;
  stats?: { generated: number; skipped: number; lost: number };
}

// ─── Filter type ─────────────────────────────────────────────────────────────

type FilterMode = 'all' | 'files' | 'errors' | 'templates';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRelativeMs(timestamp: number, startTime: number): string {
  const delta = timestamp - startTime;
  if (delta < 1000) return `+${delta}ms`;
  return `+${(delta / 1000).toFixed(2)}s`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ConsolePanel({ log, executionTime, stats }: ConsolePanelProps) {
  const [filter, setFilter] = useState<FilterMode>('all');
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevLogLenRef = useRef(0);

  // Auto-scroll to bottom on new entries
  useEffect(() => {
    if (autoScroll && log.length > prevLogLenRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    prevLogLenRef.current = log.length;
  }, [log.length, autoScroll]);

  // Detect manual scroll to disable auto-scroll
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 30;
    setAutoScroll(atBottom);
  }, []);

  // Compute start time
  const startTime = useMemo(() => {
    if (log.length === 0) return 0;
    return log[0].timestamp;
  }, [log]);

  // Compute nesting levels and template-start/end pairs
  const nestingMap = useMemo(() => {
    const levels: number[] = [];
    let depth = 0;
    for (const entry of log) {
      if (entry.type === 'template-start') {
        levels.push(depth);
        depth++;
      } else if (entry.type === 'template-end') {
        depth = Math.max(0, depth - 1);
        levels.push(depth);
      } else {
        levels.push(depth);
      }
    }
    return levels;
  }, [log]);

  // Build pairs map: template-start index -> template-end index
  const pairsMap = useMemo(() => {
    const pairs = new Map<number, number>();
    const stack: number[] = [];
    for (let i = 0; i < log.length; i++) {
      if (log[i].type === 'template-start') {
        stack.push(i);
      } else if (log[i].type === 'template-end') {
        const startIdx = stack.pop();
        if (startIdx !== undefined) {
          pairs.set(startIdx, i);
        }
      }
    }
    return pairs;
  }, [log]);

  // Filter entries
  const filteredEntries = useMemo(() => {
    const entries: Array<{ entry: ExecutionLogEntry; idx: number }> = [];

    for (let i = 0; i < log.length; i++) {
      const entry = log[i];

      // Check if this entry is inside a collapsed template
      let isHidden = false;
      if (collapsed.size > 0) {
        const entries = Array.from(pairsMap.entries());
        for (let j = 0; j < entries.length; j++) {
          const [startIdx, endIdx] = entries[j];
          if (collapsed.has(startIdx) && i > startIdx && i < endIdx) {
            isHidden = true;
            break;
          }
        }
      }
      if (isHidden) continue;

      // Apply filter
      switch (filter) {
        case 'files':
          if (entry.type !== 'file-write') continue;
          break;
        case 'errors':
          if (entry.type !== 'error' && entry.type !== 'warning') continue;
          break;
        case 'templates':
          if (entry.type !== 'template-start' && entry.type !== 'template-end') continue;
          break;
      }

      entries.push({ entry, idx: i });
    }

    return entries;
  }, [log, filter, collapsed, pairsMap]);

  // Stats computation
  const errorCount = useMemo(() => log.filter(e => e.type === 'error').length, [log]);
  const warningCount = useMemo(() => log.filter(e => e.type === 'warning').length, [log]);
  const fileCount = useMemo(() => log.filter(e => e.type === 'file-write').length, [log]);

  // Toggle collapse for a template-start entry
  const toggleCollapse = (idx: number) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  // Clear (local state only — parent controls log data)
  const handleClear = () => {
    setCollapsed(new Set());
    setFilter('all');
  };

  // ─── Render entry ──────────────────────────────────────────────────────────

  function renderEntry(entry: ExecutionLogEntry, idx: number) {
    const level = nestingMap[idx] || 0;
    const indent = level * 16;
    const relTime = formatRelativeMs(entry.timestamp, startTime);

    const baseStyle: React.CSSProperties = {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 8,
      padding: '2px 8px 2px',
      paddingLeft: 8 + indent,
      fontSize: 12,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      lineHeight: '18px',
      borderBottom: '1px solid var(--border, #2a2a2a)',
    };

    switch (entry.type) {
      case 'template-start': {
        const hasPair = pairsMap.has(idx);
        const isCollapsed = collapsed.has(idx);
        return (
          <div
            key={idx}
            style={{ ...baseStyle, color: 'var(--text-muted, #666)', cursor: hasPair ? 'pointer' : 'default' }}
            onClick={() => hasPair && toggleCollapse(idx)}
            role={hasPair ? 'button' : undefined}
            aria-expanded={hasPair ? !isCollapsed : undefined}
            aria-label={`Template ${entry.templateName || 'unknown'}`}
            tabIndex={hasPair ? 0 : undefined}
            onKeyDown={(e) => { if (hasPair && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggleCollapse(idx); } }}
          >
            <span style={{ color: 'var(--text-muted, #555)', minWidth: 60, textAlign: 'right', flexShrink: 0 }}>{relTime}</span>
            <span style={{ flexShrink: 0 }}>{hasPair ? (isCollapsed ? '▶' : '▼') : '○'}</span>
            <span>
              <span style={{ color: 'var(--primary, #7c8aff)' }}>{entry.moduleName ? `${entry.moduleName}.` : ''}</span>
              <span style={{ color: 'var(--text-muted, #888)' }}>{entry.templateName || 'template'}</span>
              {entry.args && <span style={{ color: 'var(--text-muted, #555)' }}>{` (${entry.args})`}</span>}
            </span>
          </div>
        );
      }

      case 'template-end':
        return (
          <div key={idx} style={{ ...baseStyle, color: 'var(--text-muted, #555)' }}>
            <span style={{ minWidth: 60, textAlign: 'right', flexShrink: 0 }}>{relTime}</span>
            <span>└</span>
            <span>
              {entry.templateName && <span>{entry.templateName} </span>}
              {entry.duration != null && (
                <span style={{ color: entry.duration > 100 ? 'var(--warning, #ff9800)' : 'var(--text-muted, #666)' }}>
                  {entry.duration}ms
                </span>
              )}
              {entry.outputLength != null && (
                <span style={{ color: 'var(--text-muted, #555)', marginLeft: 8 }}>
                  → {formatBytes(entry.outputLength)}
                </span>
              )}
            </span>
          </div>
        );

      case 'file-write':
        return (
          <div key={idx} style={{ ...baseStyle, color: 'var(--success, #4caf50)' }}>
            <span style={{ color: 'var(--text-muted, #555)', minWidth: 60, textAlign: 'right', flexShrink: 0 }}>{relTime}</span>
            <span>📄</span>
            <span>
              <span style={{ fontWeight: 500 }}>{entry.fileName || 'unknown'}</span>
              {entry.outputLength != null && (
                <span style={{ color: 'var(--text-muted, #666)', marginLeft: 8 }}>
                  ({formatBytes(entry.outputLength)})
                </span>
              )}
            </span>
          </div>
        );

      case 'error':
        return (
          <div key={idx} style={{ ...baseStyle, background: 'rgba(244, 67, 54, 0.1)', color: 'var(--error, #f44336)' }}>
            <span style={{ color: 'var(--text-muted, #555)', minWidth: 60, textAlign: 'right', flexShrink: 0 }}>{relTime}</span>
            <span>❌</span>
            <span style={{ flex: 1 }}>
              {entry.message || 'Unknown error'}
              {entry.sourceLine != null && (
                <span style={{ color: 'var(--text-muted, #666)', marginLeft: 8 }}>
                  (line {entry.sourceLine})
                </span>
              )}
            </span>
          </div>
        );

      case 'warning':
        return (
          <div key={idx} style={{ ...baseStyle, color: 'var(--warning, #ff9800)' }}>
            <span style={{ color: 'var(--text-muted, #555)', minWidth: 60, textAlign: 'right', flexShrink: 0 }}>{relTime}</span>
            <span>⚠️</span>
            <span style={{ flex: 1 }}>
              {entry.message || 'Warning'}
              {entry.sourceLine != null && (
                <span style={{ color: 'var(--text-muted, #666)', marginLeft: 8 }}>
                  (line {entry.sourceLine})
                </span>
              )}
            </span>
          </div>
        );

      case 'info':
        return (
          <div key={idx} style={{ ...baseStyle, color: 'var(--primary, #64b5f6)' }}>
            <span style={{ color: 'var(--text-muted, #555)', minWidth: 60, textAlign: 'right', flexShrink: 0 }}>{relTime}</span>
            <span>ℹ️</span>
            <span style={{ flex: 1 }}>{entry.message || ''}</span>
          </div>
        );

      case 'query-call':
        return (
          <div key={idx} style={{ ...baseStyle, color: 'var(--text-muted, #888)' }}>
            <span style={{ minWidth: 60, textAlign: 'right', flexShrink: 0 }}>{relTime}</span>
            <span>🔍</span>
            <span>
              <span style={{ color: 'var(--primary, #7c8aff)' }}>{entry.templateName || 'query'}</span>
              {entry.args && <span style={{ color: 'var(--text-muted, #555)' }}>{` (${entry.args})`}</span>}
              {entry.duration != null && (
                <span style={{ marginLeft: 8, color: 'var(--text-muted, #666)' }}>{entry.duration}ms</span>
              )}
            </span>
          </div>
        );

      default:
        return null;
    }
  }

  // ─── Main render ───────────────────────────────────────────────────────────

  return (
    <div
      role="region"
      aria-label="Console panel"
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg, #1e1e1e)',
        color: 'var(--text, #e0e0e0)',
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        fontSize: 12,
      }}
    >
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 12px',
          borderBottom: '1px solid var(--border, #333)',
          minHeight: 32,
          background: 'var(--bg-secondary, #252525)',
          flexShrink: 0,
        }}
      >
        {/* Left: title + stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted, #999)' }}>
            Console
          </span>

          {stats && (
            <span style={{ fontSize: 10, color: 'var(--text-muted, #777)', display: 'flex', gap: 8 }}>
              <span style={{ color: 'var(--success, #4caf50)' }}>
                {stats.generated} generated
              </span>
              {stats.skipped > 0 && <span>{stats.skipped} skipped</span>}
              {stats.lost > 0 && <span style={{ color: 'var(--error, #f44336)' }}>{stats.lost} lost</span>}
            </span>
          )}

          {executionTime != null && (
            <span style={{ fontSize: 10, color: 'var(--text-muted, #666)' }}>
              {executionTime < 1000 ? `${executionTime}ms` : `${(executionTime / 1000).toFixed(2)}s`}
            </span>
          )}

          {errorCount > 0 && (
            <span style={{ fontSize: 10, color: 'var(--error, #f44336)', fontWeight: 600 }}>
              ❌ {errorCount}
            </span>
          )}
          {warningCount > 0 && (
            <span style={{ fontSize: 10, color: 'var(--warning, #ff9800)' }}>
              ⚠️ {warningCount}
            </span>
          )}
        </div>

        {/* Right: filters + clear */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {(['all', 'files', 'errors', 'templates'] as FilterMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setFilter(mode)}
              aria-pressed={filter === mode}
              style={{
                background: filter === mode ? 'var(--primary, #7c8aff)' : 'transparent',
                color: filter === mode ? '#fff' : 'var(--text-muted, #888)',
                border: 'none',
                cursor: 'pointer',
                padding: '2px 8px',
                borderRadius: 4,
                fontSize: 10,
                textTransform: 'capitalize',
                fontFamily: 'inherit',
              }}
            >
              {mode}
            </button>
          ))}

          <div style={{ width: 1, height: 14, background: 'var(--border, #333)', margin: '0 6px' }} />

          <button
            onClick={handleClear}
            title="Clear console"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '2px 6px',
              borderRadius: 4,
              color: 'var(--text-muted, #888)',
              fontSize: 10,
              fontFamily: 'inherit',
            }}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Log list */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        role="log"
        aria-live="polite"
        aria-label="Execution log"
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '2px 0',
        }}
      >
        {filteredEntries.length === 0 ? (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted, #666)', fontSize: 11 }}>
            {log.length === 0
              ? 'Run generation to see execution logs here'
              : `No ${filter === 'all' ? '' : filter + ' '}entries to display`}
          </div>
        ) : (
          filteredEntries.map(({ entry, idx }) => renderEntry(entry, idx))
        )}
      </div>

      {/* Footer: file count + auto-scroll indicator */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '2px 12px',
          borderTop: '1px solid var(--border, #333)',
          minHeight: 22,
          fontSize: 10,
          color: 'var(--text-muted, #666)',
          background: 'var(--bg-secondary, #252525)',
          flexShrink: 0,
        }}
      >
        <span>
          {fileCount} file{fileCount !== 1 ? 's' : ''} written · {log.length} log entries
        </span>
        <span
          style={{ cursor: 'pointer', opacity: autoScroll ? 1 : 0.5 }}
          onClick={() => {
            setAutoScroll(true);
            if (scrollRef.current) {
              scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
          }}
          title={autoScroll ? 'Auto-scroll enabled' : 'Click to re-enable auto-scroll'}
        >
          {autoScroll ? '⬇ Auto-scroll' : '⬇ Scroll to bottom'}
        </span>
      </div>
    </div>
  );
}
