import React, { useState, useEffect } from 'react';
import JSZip from 'jszip';

interface ZipPreviewModalProps {
  open: boolean;
  file: File | null;
  onClose: () => void;
  onConfirm: () => void;
}

interface FileEntry {
  name: string;
  path: string;
  size: number;
  isDirectory: boolean;
}

interface TreeNode {
  name: string;
  path: string;
  size: number;
  isDirectory: boolean;
  children: TreeNode[];
}

const EXTENSION_BADGES: Record<string, { label: string; color: string }> = {
  '.ecore': { label: '.ecore', color: '#3b82f6' },
  '.ocl': { label: '.ocl', color: '#22c55e' },
  '.odesign': { label: '.odesign', color: '#a855f7' },
  '.genmodel': { label: '.genmodel', color: '#f97316' },
  '.emf': { label: '.emf', color: '#14b8a6' },
  '.mtl': { label: '.mtl', color: '#ef4444' },
  '.xmi': { label: '.xmi', color: '#eab308' },
};

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return '';
  return filename.substring(lastDot).toLowerCase();
}

function buildTree(entries: FileEntry[]): TreeNode[] {
  const root: TreeNode[] = [];

  const sorted = [...entries].sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.path.localeCompare(b.path);
  });

  for (const entry of sorted) {
    const parts = entry.path.split('/').filter(Boolean);
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;

      let existing = current.find((n) => n.name === part);
      if (!existing) {
        existing = {
          name: part,
          path: parts.slice(0, i + 1).join('/'),
          size: isLast ? entry.size : 0,
          isDirectory: isLast ? entry.isDirectory : true,
          children: [],
        };
        current.push(existing);
      }
      current = existing.children;
    }
  }

  return root;
}

function sortTree(nodes: TreeNode[]): TreeNode[] {
  return nodes
    .map((node) => ({ ...node, children: sortTree(node.children) }))
    .sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
}

const FolderIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    style={{ flexShrink: 0 }}
    aria-hidden="true"
  >
    <path
      d="M1.5 3C1.5 2.44772 1.94772 2 2.5 2H6.29289C6.4255 2 6.55268 2.05268 6.64645 2.14645L7.85355 3.35355C7.94732 3.44732 8.0745 3.5 8.20711 3.5H13.5C14.0523 3.5 14.5 3.94772 14.5 4.5V12.5C14.5 13.0523 14.0523 13.5 13.5 13.5H2.5C1.94772 13.5 1.5 13.0523 1.5 12.5V3Z"
      fill="var(--primary)"
      opacity="0.7"
    />
  </svg>
);

const FileIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    style={{ flexShrink: 0 }}
    aria-hidden="true"
  >
    <path
      d="M3 1.5C3 1.22386 3.22386 1 3.5 1H9.29289L13 4.70711V14.5C13 14.7761 12.7761 15 12.5 15H3.5C3.22386 15 3 14.7761 3 14.5V1.5Z"
      fill="var(--text-secondary)"
      opacity="0.5"
    />
    <path d="M9 1V4.5C9 4.77614 9.22386 5 9.5 5H13L9 1Z" fill="var(--text-secondary)" opacity="0.7" />
  </svg>
);

function TreeNodeRow({ node, depth }: { node: TreeNode; depth: number }) {
  const [expanded, setExpanded] = useState(true);
  const ext = getExtension(node.name);
  const badge = EXTENSION_BADGES[ext];

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '3px 8px',
          paddingLeft: `${depth * 20 + 8}px`,
          borderRadius: '4px',
          cursor: node.isDirectory ? 'pointer' : 'default',
          userSelect: 'none',
        }}
        onClick={node.isDirectory ? () => setExpanded(!expanded) : undefined}
        onKeyDown={
          node.isDirectory
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setExpanded(!expanded);
                }
              }
            : undefined
        }
        role={node.isDirectory ? 'button' : undefined}
        tabIndex={node.isDirectory ? 0 : undefined}
        aria-expanded={node.isDirectory ? expanded : undefined}
      >
        {node.isDirectory && (
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            style={{
              flexShrink: 0,
              transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.15s ease',
            }}
            aria-hidden="true"
          >
            <path d="M3 1L7 5L3 9" stroke="var(--text-secondary)" strokeWidth="1.5" fill="none" />
          </svg>
        )}
        {!node.isDirectory && <span style={{ width: '10px', flexShrink: 0 }} />}
        {node.isDirectory ? <FolderIcon /> : <FileIcon />}
        <span
          style={{
            color: 'var(--text)',
            fontSize: '13px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}
        >
          {node.name}
        </span>
        {badge && (
          <span
            style={{
              fontSize: '10px',
              fontWeight: 600,
              padding: '1px 6px',
              borderRadius: '8px',
              backgroundColor: badge.color + '22',
              color: badge.color,
              flexShrink: 0,
            }}
          >
            {badge.label}
          </span>
        )}
        {!node.isDirectory && node.size > 0 && (
          <span
            style={{
              fontSize: '11px',
              color: 'var(--text-secondary)',
              flexShrink: 0,
              marginLeft: '4px',
            }}
          >
            {formatSize(node.size)}
          </span>
        )}
      </div>
      {node.isDirectory && expanded && node.children.map((child) => (
        <TreeNodeRow key={child.path} node={child} depth={depth + 1} />
      ))}
    </>
  );
}

export function ZipPreviewModal({ open, file, onClose, onConfirm }: ZipPreviewModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [summary, setSummary] = useState({ metamodels: 0, constraints: 0, specs: 0 });

  useEffect(() => {
    if (!open || !file) {
      setTree([]);
      setSummary({ metamodels: 0, constraints: 0, specs: 0 });
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    async function parseZip() {
      try {
        const zip = await JSZip.loadAsync(file!);
        const entries: FileEntry[] = [];
        let metamodels = 0;
        let constraints = 0;
        let specs = 0;

        zip.forEach((relativePath: string, zipEntry: JSZip.JSZipObject) => {
          entries.push({
            name: zipEntry.name.split('/').filter(Boolean).pop() || zipEntry.name,
            path: relativePath,
            size: (zipEntry as any)._data?.uncompressedSize ?? 0,
            isDirectory: zipEntry.dir,
          });

          const ext = getExtension(relativePath);
          if (ext === '.ecore' || ext === '.genmodel' || ext === '.xmi') {
            metamodels++;
          } else if (ext === '.ocl') {
            constraints++;
          } else if (ext === '.odesign' || ext === '.mtl' || ext === '.emf') {
            specs++;
          }
        });

        if (cancelled) return;

        const builtTree = sortTree(buildTree(entries));
        setTree(builtTree);
        setSummary({ metamodels, constraints, specs });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to read ZIP file');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    parseZip();
    return () => {
      cancelled = true;
    };
  }, [open, file]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal={true}
      aria-label="ZIP file preview"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '560px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          margin: '16px',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: '16px',
              fontWeight: 600,
              color: 'var(--text)',
            }}
          >
            Import Project
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              color: 'var(--text-secondary)',
              fontSize: '18px',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '12px 8px',
            minHeight: 0,
          }}
        >
          {loading && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px 20px',
                color: 'var(--text-secondary)',
                fontSize: '14px',
                gap: '10px',
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                style={{ animation: 'spin 1s linear infinite' }}
                aria-hidden="true"
              >
                <circle
                  cx="10"
                  cy="10"
                  r="8"
                  stroke="var(--border)"
                  strokeWidth="2"
                  fill="none"
                />
                <path
                  d="M10 2a8 8 0 0 1 8 8"
                  stroke="var(--primary)"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                />
              </svg>
              Parsing ZIP file…
            </div>
          )}

          {error && (
            <div
              style={{
                padding: '16px 20px',
                color: 'var(--danger)',
                fontSize: '13px',
                textAlign: 'center',
              }}
            >
              {error}
            </div>
          )}

          {!loading && !error && tree.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
              {tree.map((node) => (
                <TreeNodeRow key={node.path} node={node} depth={0} />
              ))}
            </div>
          )}

          {!loading && !error && tree.length === 0 && file && (
            <div
              style={{
                padding: '40px 20px',
                color: 'var(--text-secondary)',
                fontSize: '13px',
                textAlign: 'center',
              }}
            >
              No files found in ZIP archive
            </div>
          )}
        </div>

        {/* Summary */}
        {!loading && !error && tree.length > 0 && (
          <div
            style={{
              padding: '10px 20px',
              borderTop: '1px solid var(--border)',
              fontSize: '12px',
              color: 'var(--text-secondary)',
              backgroundColor: 'var(--primary-bg)',
            }}
          >
            Found: {summary.metamodels} metamodel{summary.metamodels !== 1 ? 's' : ''},{' '}
            {summary.constraints} constraint{summary.constraints !== 1 ? 's' : ''},{' '}
            {summary.specs} spec{summary.specs !== 1 ? 's' : ''}
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--surface)',
              color: 'var(--text)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading || !!error}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: loading || error ? 'var(--border)' : 'var(--primary)',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 500,
              cursor: loading || error ? 'not-allowed' : 'pointer',
              opacity: loading || error ? 0.6 : 1,
            }}
          >
            Import Project
          </button>
        </div>
      </div>

      {/* Spinner keyframes */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
