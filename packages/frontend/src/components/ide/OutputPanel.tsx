import { useEffect, useState, useMemo } from 'react';
import Editor, { DiffEditor } from '@monaco-editor/react';
import {
  Copy, Check, Download, Eye, EyeOff, GitCompare, ExternalLink,
  Archive, FileCode, FolderTree, Circle, Terminal, GitBranch,
} from 'lucide-react';
import { useIDEStore } from './useIDEStore';
import { ConsolePanel } from './ConsolePanel';
import { TraceabilityPanel } from './TraceabilityPanel';

// ─── Language detection ──────────────────────────────────────────────────────

const EXT_LANGUAGE_MAP: Record<string, string> = {
  '.html': 'html', '.htm': 'html', '.sql': 'sql',
  '.ts': 'typescript', '.tsx': 'typescriptreact',
  '.js': 'javascript', '.jsx': 'javascriptreact',
  '.java': 'java', '.py': 'python', '.json': 'json',
  '.xml': 'xml', '.css': 'css', '.scss': 'scss',
  '.md': 'markdown', '.yaml': 'yaml', '.yml': 'yaml',
  '.txt': 'plaintext', '.svg': 'xml', '.properties': 'ini',
};

function detectLanguage(filename: string): string {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  return EXT_LANGUAGE_MAP[ext] || 'plaintext';
}

type PreviewType = 'html' | 'svg' | 'markdown' | 'json' | 'image' | 'none';

function detectPreviewType(filename: string): PreviewType {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  if (ext === '.html' || ext === '.htm') return 'html';
  if (ext === '.svg') return 'svg';
  if (ext === '.md' || ext === '.markdown') return 'markdown';
  if (ext === '.json') return 'json';
  return 'none';
}

// ─── Simple Markdown renderer (no external deps) ────────────────────────────

function renderMarkdown(md: string): string {
  let html = md
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="lang-$1">$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold & italic
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
    // Unordered lists
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    // Paragraphs (double newline)
    .replace(/\n\n/g, '</p><p>')
    // Single newlines to <br>
    .replace(/\n/g, '<br>');

  // Wrap lists
  html = html.replace(/(<li>.*?<\/li>)/gs, '<ul>$1</ul>');
  // Remove duplicate ul tags
  html = html.replace(/<\/ul>\s*<ul>/g, '');

  return `<div style="font-family: system-ui; padding: 16px; line-height: 1.6; color: var(--text, #e0e0e0);">${html}</div>`;
}

// ─── JSON Tree renderer ─────────────────────────────────────────────────────

function renderJsonTree(content: string): string {
  try {
    const obj = JSON.parse(content);
    const formatted = JSON.stringify(obj, null, 2);
    return `<pre style="font-family: 'JetBrains Mono', monospace; font-size: 12px; padding: 12px; margin: 0; color: var(--text, #e0e0e0); overflow: auto;">${escapeHtml(formatted)}</pre>`;
  } catch {
    return `<pre style="color: var(--error, red); padding: 12px;">Invalid JSON</pre>`;
  }
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── File status detection ──────────────────────────────────────────────────

type FileStatus = 'new' | 'modified' | 'unchanged' | 'error';

function getFileStatus(
  file: { name: string; content: string },
  previousOutput?: Array<{ name: string; content: string }> | null,
): FileStatus {
  if (!previousOutput) return 'new';
  const prev = previousOutput.find(p => p.name === file.name);
  if (!prev) return 'new';
  if (prev.content === file.content) return 'unchanged';
  return 'modified';
}

const STATUS_COLORS: Record<FileStatus, string> = {
  new: '#4caf50',
  modified: '#ff9800',
  unchanged: 'var(--text-muted, #666)',
  error: '#f44336',
};

const STATUS_LABELS: Record<FileStatus, string> = {
  new: 'New',
  modified: 'Modified',
  unchanged: 'Unchanged',
  error: 'Error',
};

// ─── View mode type ─────────────────────────────────────────────────────────

type ViewMode = 'code' | 'preview' | 'diff' | 'console' | 'trace';

// ─── Component ──────────────────────────────────────────────────────────────

export function OutputPanel() {
  const { state, dispatch } = useIDEStore();
  const { output, previousOutput, livePreview, outputStatus } = state;

  const [selectedIdx, setSelectedIdx] = useState(0);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('code');
  const [showFileTree, setShowFileTree] = useState(true);

  const [monacoTheme, setMonacoTheme] = useState(() =>
    document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'vs-dark',
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const theme = document.documentElement.getAttribute('data-theme');
      setMonacoTheme(theme === 'light' ? 'light' : 'vs-dark');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setSelectedIdx(0);
  }, [output]);

  const handleCopy = async () => {
    if (!output || !output[selectedIdx]) return;
    await navigator.clipboard.writeText(output[selectedIdx].content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadFile = () => {
    if (!output || !output[selectedIdx]) return;
    const file = output[selectedIdx];
    const blob = new Blob([file.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadAll = async () => {
    if (!output || output.length === 0) return;
    const content = output.map(f => `// ═══ ${f.name} ═══\n${f.content}`).join('\n\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'generated-output.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenInTab = () => {
    if (!output || !output[selectedIdx]) return;
    const file = output[selectedIdx];
    const isHtml = file.name.endsWith('.html') || file.name.endsWith('.htm');
    const blob = new Blob([file.content], { type: isHtml ? 'text/html' : 'text/plain' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const handleToggleLive = () => {
    dispatch({ type: 'TOGGLE_LIVE_PREVIEW' });
  };

  // ─── File tree grouped by directory ─────────────────────────────────────────

  const fileTree = useMemo(() => {
    if (!output) return [];
    const dirs = new Map<string, Array<{ idx: number; name: string; basename: string; status: FileStatus }>>();

    output.forEach((f, i) => {
      const lastSlash = f.name.lastIndexOf('/');
      const dir = lastSlash >= 0 ? f.name.slice(0, lastSlash) : '';
      const basename = lastSlash >= 0 ? f.name.slice(lastSlash + 1) : f.name;
      const status = getFileStatus(f, previousOutput);

      if (!dirs.has(dir)) dirs.set(dir, []);
      dirs.get(dir)!.push({ idx: i, name: f.name, basename, status });
    });

    return Array.from(dirs.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [output, previousOutput]);

  // ─── Empty state ────────────────────────────────────────────────────────────

  if (!output || output.length === 0) {
    return (
      <div role="region" aria-label="Output panel" style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 12px', borderBottom: '1px solid var(--border)', minHeight: 30 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Output</span>
            {outputStatus === 'generating' && <span style={{ fontSize: 10, color: 'var(--warning, orange)' }}>Generating...</span>}
          </div>
          <button onClick={handleToggleLive} title={livePreview ? 'Disable live preview' : 'Enable live preview'} style={{ background: livePreview ? 'var(--accent)' : 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 4, color: livePreview ? '#fff' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3, fontSize: 10 }}>
            {livePreview ? <Eye size={12} /> : <EyeOff size={12} />} Live
          </button>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
          {livePreview ? 'Waiting for changes...' : 'Run generation to see output here'}
        </div>
      </div>
    );
  }

  const selectedFile = output[selectedIdx];
  const language = detectLanguage(selectedFile.name);
  const previousFile = previousOutput?.find(p => p.name === selectedFile.name);
  const previewType = detectPreviewType(selectedFile.name);
  const canPreview = previewType !== 'none';

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div role="region" aria-label="Output panel" style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 12px', borderBottom: '1px solid var(--border)', minHeight: 30 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Output</span>
          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-secondary)' }}>{output.length}</span>
          {outputStatus === 'generating' && <span style={{ fontSize: 10, color: 'var(--warning, orange)' }}>⟳ Generating...</span>}
          {outputStatus === 'up-to-date' && livePreview && <span style={{ fontSize: 10, color: 'var(--success, #4caf50)' }}>✓ Up to date</span>}
          {outputStatus === 'error' && <span style={{ fontSize: 10, color: 'var(--error, #f44336)' }}>✗ Error</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* View mode tabs */}
          {(['code', 'preview', 'diff', 'console', 'trace'] as ViewMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              disabled={mode === 'preview' && !canPreview || mode === 'diff' && !previousFile}
              style={{
                background: viewMode === mode ? 'var(--accent)' : 'none',
                border: 'none', cursor: 'pointer', padding: '2px 8px', borderRadius: 4,
                color: viewMode === mode ? '#fff' : 'var(--text-muted)',
                fontSize: 10, textTransform: 'capitalize',
                opacity: (mode === 'preview' && !canPreview) || (mode === 'diff' && !previousFile) ? 0.4 : 1,
              }}
            >
              {mode === 'code' && <FileCode size={10} style={{ marginRight: 3, verticalAlign: 'middle' }} />}
              {mode === 'preview' && <Eye size={10} style={{ marginRight: 3, verticalAlign: 'middle' }} />}
              {mode === 'diff' && <GitCompare size={10} style={{ marginRight: 3, verticalAlign: 'middle' }} />}
              {mode === 'console' && <Terminal size={10} style={{ marginRight: 3, verticalAlign: 'middle' }} />}
              {mode === 'trace' && <GitBranch size={10} style={{ marginRight: 3, verticalAlign: 'middle' }} />}
              {mode}
            </button>
          ))}
          <div style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 4px' }} />
          {/* Live toggle */}
          <button onClick={handleToggleLive} title={livePreview ? 'Disable live preview' : 'Enable live preview'} style={{ background: livePreview ? 'var(--accent)' : 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 4, color: livePreview ? '#fff' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3, fontSize: 10 }}>
            {livePreview ? <Eye size={12} /> : <EyeOff size={12} />} Live
          </button>
          {/* File tree toggle */}
          {output.length > 1 && (
            <button onClick={() => setShowFileTree(!showFileTree)} title="Toggle file tree" style={{ background: showFileTree ? 'var(--surface)' : 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 4, color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
              <FolderTree size={12} />
            </button>
          )}
          <div style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 4px' }} />
          {/* Actions */}
          <button onClick={handleCopy} title="Copy to clipboard" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 4, color: copied ? 'var(--accent)' : 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </button>
          <button onClick={handleDownloadFile} title="Download file" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 4, color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
            <Download size={13} />
          </button>
          {output.length > 1 && (
            <button onClick={handleDownloadAll} title="Download all files" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 4, color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
              <Archive size={13} />
            </button>
          )}
          {(previewType === 'html' || previewType === 'svg') && (
            <button onClick={handleOpenInTab} title="Open in new tab" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 4, color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
              <ExternalLink size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Body: file tree + content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* File tree sidebar */}
        {showFileTree && output.length > 1 && (
          <div style={{ width: 180, minWidth: 140, borderRight: '1px solid var(--border)', overflow: 'auto', padding: '4px 0' }}>
            {fileTree.map(([dir, files]) => (
              <div key={dir}>
                {dir && (
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', padding: '4px 8px 2px', fontWeight: 600 }}>
                    {dir}/
                  </div>
                )}
                {files.map(f => (
                  <button
                    key={f.idx}
                    onClick={() => setSelectedIdx(f.idx)}
                    title={`${f.name} — ${STATUS_LABELS[f.status]}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      width: '100%', textAlign: 'left',
                      padding: '3px 8px 3px 12px',
                      fontSize: 11, border: 'none', cursor: 'pointer',
                      background: f.idx === selectedIdx ? 'var(--surface)' : 'transparent',
                      color: f.idx === selectedIdx ? 'var(--text)' : 'var(--text-secondary)',
                    }}
                  >
                    <Circle size={6} fill={STATUS_COLORS[f.status]} stroke="none" />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.basename}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Content area */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {viewMode === 'console' ? (
            <ConsolePanel
              log={state.executionLog}
              executionTime={state.executionTime ?? undefined}
              stats={state.executionStats ?? undefined}
            />
          ) : viewMode === 'trace' ? (
            <TraceabilityPanel
              traces={state.traces}
              outputContent={selectedFile?.content ?? ''}
              onNavigateToTemplate={(templateName) => {
                dispatch({ type: 'SET_CURSOR', line: 1, col: 1 });
              }}
            />
          ) : viewMode === 'diff' && previousFile ? (
            <DiffEditor
              height="100%"
              language={language}
              original={previousFile.content}
              modified={selectedFile.content}
              theme={monacoTheme}
              options={{
                readOnly: true, minimap: { enabled: false }, fontSize: 12,
                scrollBeyondLastLine: false, renderSideBySide: true,
                fontFamily: "'JetBrains Mono', monospace",
              }}
            />
          ) : viewMode === 'preview' && canPreview ? (
            <PreviewRenderer content={selectedFile.content} type={previewType} />
          ) : (
            <Editor
              height="100%"
              language={language}
              value={selectedFile.content}
              theme={monacoTheme}
              options={{
                readOnly: true, minimap: { enabled: false }, fontSize: 12,
                lineNumbers: 'on', scrollBeyondLastLine: false, wordWrap: 'on',
                fontFamily: "'JetBrains Mono', monospace",
                padding: { top: 4 }, renderLineHighlight: 'none',
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Preview Renderer ───────────────────────────────────────────────────────

function PreviewRenderer({ content, type }: { content: string; type: PreviewType }) {
  if (type === 'html') {
    return (
      <iframe
        srcDoc={content}
        sandbox="allow-scripts"
        title="HTML Preview"
        style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
      />
    );
  }

  if (type === 'svg') {
    return (
      <div
        style={{ width: '100%', height: '100%', overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'var(--surface)' }}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }

  if (type === 'markdown') {
    const html = renderMarkdown(content);
    return (
      <div
        style={{ width: '100%', height: '100%', overflow: 'auto', background: 'var(--bg)' }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  if (type === 'json') {
    const html = renderJsonTree(content);
    return (
      <div
        style={{ width: '100%', height: '100%', overflow: 'auto', background: 'var(--bg)' }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return <div style={{ padding: 16, color: 'var(--text-muted)' }}>No preview available for this file type.</div>;
}
