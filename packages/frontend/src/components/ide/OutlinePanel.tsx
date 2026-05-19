import { useState, useMemo } from 'react';
import { useIDEStore } from './useIDEStore';

// ── Types ─────────────────────────────────────────────────────────────

interface ModuleDecl {
  name: string;
  uri: string;
  extends?: string;
  line: number;
}

interface ImportDecl {
  moduleName: string;
  line: number;
}

type Visibility = 'public' | 'protected' | 'private';

interface TemplateDecl {
  name: string;
  visibility: Visibility;
  params: string;
  line: number;
}

interface QueryDecl {
  name: string;
  visibility: Visibility;
  params: string;
  returnType: string;
  line: number;
}

interface ParsedOutline {
  module: ModuleDecl | null;
  imports: ImportDecl[];
  templates: TemplateDecl[];
  queries: QueryDecl[];
}

// ── Parser ────────────────────────────────────────────────────────────

function parseMTLContent(content: string): ParsedOutline {
  const lines = content.split('\n');
  const result: ParsedOutline = {
    module: null,
    imports: [],
    templates: [],
    queries: [],
  };

  // Module: [module name('uri')/] or [module name('uri') extends parent/]
  const moduleRe = /\[module\s+(\w+)\s*\(\s*'([^']+)'\s*\)(?:\s+extends\s+(\w+))?\s*\/\]/;
  // Import: [import moduleName/]
  const importRe = /\[import\s+([\w:.]+)\s*\/\]/;
  // Template: [template public|private|protected name(params)]
  const templateRe = /\[template\s+(public|private|protected)\s+(\w+)\s*\(([^)]*)\)/;
  // Query: [query public|private|protected name(params) : ReturnType
  const queryRe = /\[query\s+(public|private|protected)\s+(\w+)\s*\(([^)]*)\)\s*:\s*([^\s=]+)/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    const moduleMatch = line.match(moduleRe);
    if (moduleMatch && !result.module) {
      result.module = {
        name: moduleMatch[1],
        uri: moduleMatch[2],
        extends: moduleMatch[3] || undefined,
        line: lineNum,
      };
      continue;
    }

    const importMatch = line.match(importRe);
    if (importMatch) {
      result.imports.push({
        moduleName: importMatch[1],
        line: lineNum,
      });
      continue;
    }

    const queryMatch = line.match(queryRe);
    if (queryMatch) {
      result.queries.push({
        visibility: queryMatch[1] as Visibility,
        name: queryMatch[2],
        params: queryMatch[3].trim(),
        returnType: queryMatch[4].trim(),
        line: lineNum,
      });
      continue;
    }

    const templateMatch = line.match(templateRe);
    if (templateMatch) {
      result.templates.push({
        visibility: templateMatch[1] as Visibility,
        name: templateMatch[2],
        params: templateMatch[3].trim(),
        line: lineNum,
      });
    }
  }

  return result;
}

// ── Visibility icon ───────────────────────────────────────────────────

function visibilityIcon(v: Visibility): string {
  switch (v) {
    case 'public': return '🟢';
    case 'protected': return '🟡';
    case 'private': return '🔴';
  }
}

// ── Component ─────────────────────────────────────────────────────────

export function OutlinePanel() {
  const { state, dispatch } = useIDEStore();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const activeFile = useMemo(() => {
    if (!state.project || !state.activeTab) return null;
    return state.project.files.find((f) => f.id === state.activeTab) ?? null;
  }, [state.project, state.activeTab]);

  const outline = useMemo(() => {
    if (!activeFile) return null;
    return parseMTLContent(activeFile.content);
  }, [activeFile]);

  const toggleSection = (section: string) => {
    setCollapsed((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const goToLine = (line: number) => {
    dispatch({ type: 'SET_CURSOR', line, col: 1 });
  };

  if (!activeFile) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>Outline</div>
        <div style={styles.empty}>No file open</div>
      </div>
    );
  }

  if (!outline) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>Outline</div>
        <div style={styles.empty}>Unable to parse file</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>Outline</div>
      <div style={styles.scrollArea}>
        {/* Module declaration */}
        {outline.module && (
          <div style={styles.section}>
            <button
              style={styles.symbolRow}
              onClick={() => goToLine(outline.module!.line)}
              title={`Line ${outline.module.line}`}
            >
              <span style={styles.icon}>📦</span>
              <span style={styles.symbolName}>{outline.module.name}</span>
              <span style={styles.paramText}>
                {outline.module.extends ? ` extends ${outline.module.extends}` : ''}
              </span>
            </button>
          </div>
        )}

        {/* Imports section */}
        {outline.imports.length > 0 && (
          <div style={styles.section}>
            <button
              style={styles.sectionHeader}
              onClick={() => toggleSection('imports')}
              aria-expanded={!collapsed['imports']}
            >
              <span style={styles.chevron}>{collapsed['imports'] ? '▶' : '▼'}</span>
              <span>Imports</span>
              <span style={styles.badge}>{outline.imports.length}</span>
            </button>
            {!collapsed['imports'] && (
              <div style={styles.sectionBody}>
                {outline.imports.map((imp, i) => (
                  <button
                    key={i}
                    style={styles.symbolRow}
                    onClick={() => goToLine(imp.line)}
                    title={`Line ${imp.line}`}
                  >
                    <span style={styles.icon}>📥</span>
                    <span style={styles.symbolName}>{imp.moduleName}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Templates section */}
        {outline.templates.length > 0 && (
          <div style={styles.section}>
            <button
              style={styles.sectionHeader}
              onClick={() => toggleSection('templates')}
              aria-expanded={!collapsed['templates']}
            >
              <span style={styles.chevron}>{collapsed['templates'] ? '▶' : '▼'}</span>
              <span>Templates</span>
              <span style={styles.badge}>{outline.templates.length}</span>
            </button>
            {!collapsed['templates'] && (
              <div style={styles.sectionBody}>
                {outline.templates.map((tmpl, i) => (
                  <button
                    key={i}
                    style={styles.symbolRow}
                    onClick={() => goToLine(tmpl.line)}
                    title={`${tmpl.visibility} — Line ${tmpl.line}`}
                  >
                    <span style={styles.icon}>{visibilityIcon(tmpl.visibility)}</span>
                    <span style={styles.symbolName}>{tmpl.name}</span>
                    {tmpl.params && (
                      <span style={styles.paramText}>({tmpl.params})</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Queries section */}
        {outline.queries.length > 0 && (
          <div style={styles.section}>
            <button
              style={styles.sectionHeader}
              onClick={() => toggleSection('queries')}
              aria-expanded={!collapsed['queries']}
            >
              <span style={styles.chevron}>{collapsed['queries'] ? '▶' : '▼'}</span>
              <span>Queries</span>
              <span style={styles.badge}>{outline.queries.length}</span>
            </button>
            {!collapsed['queries'] && (
              <div style={styles.sectionBody}>
                {outline.queries.map((q, i) => (
                  <button
                    key={i}
                    style={styles.symbolRow}
                    onClick={() => goToLine(q.line)}
                    title={`${q.visibility} — Line ${q.line}`}
                  >
                    <span style={styles.icon}>{visibilityIcon(q.visibility)}</span>
                    <span style={styles.symbolName}>{q.name}</span>
                    {q.params && (
                      <span style={styles.paramText}>({q.params})</span>
                    )}
                    <span style={styles.returnType}>: {q.returnType}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Empty state when file has no recognizable symbols */}
        {!outline.module && outline.imports.length === 0 &&
          outline.templates.length === 0 && outline.queries.length === 0 && (
          <div style={styles.empty}>No symbols found</div>
        )}
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
    padding: '8px 12px',
    fontWeight: 600,
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: 'var(--text-muted)',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
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
    gap: '4px',
    width: '100%',
    padding: '4px 8px',
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
    paddingLeft: '8px',
  },
  symbolRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    width: '100%',
    padding: '3px 12px',
    border: 'none',
    background: 'none',
    color: 'var(--text)',
    fontSize: '12px',
    fontFamily: 'monospace',
    cursor: 'pointer',
    textAlign: 'left',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  icon: {
    flexShrink: 0,
    fontSize: '10px',
  },
  symbolName: {
    fontWeight: 500,
  },
  paramText: {
    color: 'var(--text-muted)',
    fontSize: '11px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  returnType: {
    color: 'var(--text-muted)',
    fontSize: '11px',
    marginLeft: '4px',
  },
  chevron: {
    fontSize: '9px',
    width: '12px',
    flexShrink: 0,
  },
  badge: {
    marginLeft: 'auto',
    color: 'var(--text-muted)',
    fontSize: '10px',
    backgroundColor: 'var(--bg-secondary)',
    padding: '1px 5px',
    borderRadius: '8px',
  },
  empty: {
    padding: '16px 12px',
    color: 'var(--text-muted)',
    textAlign: 'center',
    fontSize: '12px',
  },
};
