import { useState, useMemo } from 'react';

// ── Types ─────────────────────────────────────────────────────────────

interface TraceEntry {
  outputStart: number;
  outputEnd: number;
  templateName: string;
  moduleName: string;
  sourceLine: number;
  modelElementType?: string;
  modelElementName?: string;
}

interface TraceabilityPanelProps {
  traces: TraceEntry[];
  outputContent: string;
  onNavigateToTemplate?: (templateName: string, moduleName: string) => void;
  onHighlightOutput?: (start: number, end: number) => void;
}

// ── Color palette for template grouping ──────────────────────────────

const TEMPLATE_COLORS = [
  '#4fc1ff', // cyan
  '#c586c0', // purple
  '#dcdcaa', // yellow
  '#4ec9b0', // teal
  '#ce9178', // orange
  '#9cdcfe', // light blue
  '#b5cea8', // green
  '#d7ba7d', // gold
  '#f48771', // coral
  '#d4d4d4', // silver
];

function getTemplateColor(templateName: string, allTemplates: string[]): string {
  const index = allTemplates.indexOf(templateName);
  return TEMPLATE_COLORS[index % TEMPLATE_COLORS.length];
}

// ── Component ─────────────────────────────────────────────────────────

export function TraceabilityPanel({
  traces,
  outputContent,
  onNavigateToTemplate,
  onHighlightOutput,
}: TraceabilityPanelProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // Group traces by template name
  const grouped = useMemo(() => {
    const map = new Map<string, TraceEntry[]>();
    for (const trace of traces) {
      const key = `${trace.moduleName}::${trace.templateName}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(trace);
    }
    return map;
  }, [traces]);

  // Unique template names for color assignment
  const uniqueTemplates = useMemo(() => {
    return Array.from(new Set(traces.map((t) => t.templateName)));
  }, [traces]);

  // Summary stats
  const summary = useMemo(() => {
    const templates = new Set(traces.map((t) => t.templateName));
    const modelElements = new Set(
      traces
        .filter((t) => t.modelElementName)
        .map((t) => `${t.modelElementType}:${t.modelElementName}`)
    );
    return {
      templateCount: templates.size,
      modelElementCount: modelElements.size,
      totalChars: outputContent.length,
    };
  }, [traces, outputContent]);

  const toggleGroup = (key: string) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleEntryClick = (trace: TraceEntry) => {
    onNavigateToTemplate?.(trace.templateName, trace.moduleName);
  };

  const handleEntryHover = (trace: TraceEntry) => {
    onHighlightOutput?.(trace.outputStart, trace.outputEnd);
  };

  const handleEntryLeave = () => {
    onHighlightOutput?.(0, 0);
  };

  // ── Empty state ──────────────────────────────────────────────────────

  if (traces.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <span>Traceability</span>
          <span style={styles.headerBadge}>0</span>
        </div>
        <div style={styles.empty}>
          Run generation with logging enabled to see traceability data
        </div>
      </div>
    );
  }

  // ── Main render ──────────────────────────────────────────────────────

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <span>Traceability</span>
        <span style={styles.headerBadge}>{traces.length}</span>
      </div>

      {/* Summary */}
      <div style={styles.summary}>
        <div style={styles.summaryItem}>
          <span style={styles.summaryLabel}>Templates</span>
          <span style={styles.summaryValue}>{summary.templateCount}</span>
        </div>
        <div style={styles.summaryItem}>
          <span style={styles.summaryLabel}>Model Elements</span>
          <span style={styles.summaryValue}>{summary.modelElementCount}</span>
        </div>
        <div style={styles.summaryItem}>
          <span style={styles.summaryLabel}>Output</span>
          <span style={styles.summaryValue}>{summary.totalChars} chars</span>
        </div>
      </div>

      {/* Trace groups */}
      <div style={styles.scrollArea}>
        {Array.from(grouped.entries()).map(([groupKey, entries]) => {
          const firstEntry = entries[0];
          const color = getTemplateColor(firstEntry.templateName, uniqueTemplates);
          const isCollapsed = collapsed[groupKey];

          return (
            <div key={groupKey} style={styles.section}>
              {/* Group header */}
              <button
                style={styles.sectionHeader}
                onClick={() => toggleGroup(groupKey)}
                aria-expanded={!isCollapsed}
              >
                <span style={styles.chevron}>{isCollapsed ? '▶' : '▼'}</span>
                <span
                  style={{
                    ...styles.colorDot,
                    backgroundColor: color,
                  }}
                />
                <span style={styles.groupName}>{firstEntry.templateName}</span>
                <span style={styles.groupModule}>{firstEntry.moduleName}</span>
                <span style={styles.badge}>{entries.length}</span>
              </button>

              {/* Group entries */}
              {!isCollapsed && (
                <div style={styles.sectionBody}>
                  {entries.map((trace, i) => (
                    <button
                      key={i}
                      style={styles.entryRow}
                      onClick={() => handleEntryClick(trace)}
                      onMouseEnter={() => handleEntryHover(trace)}
                      onMouseLeave={handleEntryLeave}
                      title={`Template: ${trace.templateName} (line ${trace.sourceLine})\nOutput: chars ${trace.outputStart}–${trace.outputEnd}`}
                    >
                      <span
                        style={{
                          ...styles.entryColorBar,
                          backgroundColor: color,
                        }}
                      />
                      <div style={styles.entryContent}>
                        <div style={styles.entryTop}>
                          {trace.modelElementType && trace.modelElementName && (
                            <span style={styles.modelElement}>
                              {trace.modelElementType}:{trace.modelElementName}
                            </span>
                          )}
                          {(!trace.modelElementType || !trace.modelElementName) && (
                            <span style={styles.entryTemplate}>
                              {trace.templateName}
                            </span>
                          )}
                          <span style={styles.sourceLine}>L{trace.sourceLine}</span>
                        </div>
                        <div style={styles.entryBottom}>
                          <span style={styles.outputRange}>
                            chars {trace.outputStart}–{trace.outputEnd}
                          </span>
                          <span style={styles.outputLength}>
                            ({trace.outputEnd - trace.outputStart} chars)
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: 'var(--bg)',
    borderLeft: '1px solid var(--border)',
    fontSize: '12px',
    fontFamily: 'monospace',
    color: 'var(--text)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    fontWeight: 600,
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: 'var(--text-muted)',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  headerBadge: {
    marginLeft: 'auto',
    fontSize: '10px',
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-muted)',
    padding: '1px 6px',
    borderRadius: '8px',
  },
  summary: {
    display: 'flex',
    gap: '12px',
    padding: '8px 12px',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  summaryItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  summaryLabel: {
    fontSize: '10px',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  },
  summaryValue: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text)',
  },
  scrollArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '4px 0',
  },
  section: {
    marginBottom: '2px',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    width: '100%',
    padding: '5px 8px',
    border: 'none',
    background: 'none',
    color: 'var(--text)',
    fontSize: '12px',
    fontFamily: 'monospace',
    cursor: 'pointer',
    textAlign: 'left',
    fontWeight: 600,
  },
  sectionBody: {
    paddingLeft: '4px',
  },
  chevron: {
    fontSize: '9px',
    width: '12px',
    flexShrink: 0,
  },
  colorDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  groupName: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  groupModule: {
    color: 'var(--text-muted)',
    fontSize: '11px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  badge: {
    marginLeft: 'auto',
    color: 'var(--text-muted)',
    fontSize: '10px',
    backgroundColor: 'var(--bg-secondary)',
    padding: '1px 5px',
    borderRadius: '8px',
    flexShrink: 0,
  },
  entryRow: {
    display: 'flex',
    alignItems: 'stretch',
    gap: '8px',
    width: '100%',
    padding: '4px 12px',
    border: 'none',
    background: 'none',
    color: 'var(--text)',
    fontSize: '11px',
    fontFamily: 'monospace',
    cursor: 'pointer',
    textAlign: 'left',
  },
  entryColorBar: {
    width: '3px',
    borderRadius: '2px',
    flexShrink: 0,
  },
  entryContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    overflow: 'hidden',
    flex: 1,
  },
  entryTop: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  entryBottom: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  modelElement: {
    color: 'var(--primary)',
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  entryTemplate: {
    color: 'var(--text)',
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  sourceLine: {
    marginLeft: 'auto',
    color: 'var(--text-muted)',
    fontSize: '10px',
    flexShrink: 0,
  },
  outputRange: {
    color: 'var(--text-muted)',
    fontSize: '10px',
  },
  outputLength: {
    color: 'var(--text-muted)',
    fontSize: '10px',
    opacity: 0.7,
  },
  empty: {
    padding: '24px 16px',
    color: 'var(--text-muted)',
    textAlign: 'center',
    fontSize: '12px',
    lineHeight: '1.5',
  },
};
