import { useIDEStore } from './useIDEStore';

/**
 * Breadcrumbs — Shows the path hierarchy of the active file.
 * Clicking a segment navigates to the folder in the file explorer.
 */
export function Breadcrumbs() {
  const { state } = useIDEStore();
  const { project, activeTab } = state;

  const activeFile = project?.files.find((f) => f.id === activeTab);
  if (!activeFile) return null;

  const parts = activeFile.filename.split('/');

  return (
    <nav
      aria-label="File breadcrumb"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: '2px 12px',
        fontSize: 11,
        fontFamily: "'JetBrains Mono', monospace",
        color: 'var(--text-muted)',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        minHeight: 22,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
      }}
    >
      {/* Project name */}
      <span style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
        {project?.name || 'project'}
      </span>
      <Separator />

      {/* Path segments */}
      {parts.map((part, idx) => {
        const isLast = idx === parts.length - 1;
        return (
          <span key={idx} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <span
              style={{
                color: isLast ? 'var(--text)' : 'var(--text-muted)',
                fontWeight: isLast ? 500 : 400,
              }}
            >
              {isLast ? (
                <>
                  <FileIcon language={activeFile.language} /> {part}
                </>
              ) : (
                <>📁 {part}</>
              )}
            </span>
            {!isLast && <Separator />}
          </span>
        );
      })}
    </nav>
  );
}

function Separator() {
  return (
    <span style={{ color: 'var(--text-muted)', opacity: 0.4, margin: '0 2px' }}>
      ›
    </span>
  );
}

function FileIcon({ language }: { language: string }) {
  switch (language) {
    case 'mtl':
      return <span>📄</span>;
    case 'properties':
      return <span>⚙️</span>;
    default:
      return <span>📄</span>;
  }
}
