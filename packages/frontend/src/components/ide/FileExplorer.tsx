import React, { useState, useRef, useCallback, useMemo } from 'react';
import { FileCode, FolderOpen, FolderClosed, Plus, FolderPlus, ChevronRight, ChevronDown } from 'lucide-react';
import { useIDEStore, type IDEFile } from './useIDEStore';

// ── Utilities ──────────────────────────────────────────────────────────

export function getFileName(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1];
}

export function getFolderPath(path: string): string {
  const parts = path.split('/');
  return parts.length > 1 ? parts.slice(0, -1).join('/') : '';
}

// ── Tree building ──────────────────────────────────────────────────────

interface TreeNode {
  type: 'folder' | 'file';
  name: string;
  path: string; // full path
  file?: IDEFile;
  children?: TreeNode[];
}

function buildTree(files: IDEFile[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const file of files) {
    const parts = file.filename.split('/');
    let current = root;

    for (let i = 0; i < parts.length - 1; i++) {
      const folderName = parts[i];
      const folderPath = parts.slice(0, i + 1).join('/');
      let folder = current.find((n) => n.type === 'folder' && n.name === folderName);
      if (!folder) {
        folder = { type: 'folder', name: folderName, path: folderPath, children: [] };
        current.push(folder);
      }
      current = folder.children!;
    }

    current.push({
      type: 'file',
      name: parts[parts.length - 1],
      path: file.filename,
      file,
    });
  }

  // Sort: folders first (alphabetically), then files (alphabetically)
  function sortNodes(nodes: TreeNode[]): TreeNode[] {
    const folders = nodes.filter((n) => n.type === 'folder').sort((a, b) => a.name.localeCompare(b.name));
    const fileNodes = nodes.filter((n) => n.type === 'file').sort((a, b) => a.name.localeCompare(b.name));
    for (const folder of folders) {
      if (folder.children) folder.children = sortNodes(folder.children);
    }
    return [...folders, ...fileNodes];
  }

  return sortNodes(root);
}

// Flatten tree into a list for keyboard navigation
interface FlatNode {
  node: TreeNode;
  depth: number;
  isExpanded?: boolean;
}

function flattenTree(nodes: TreeNode[], expandedFolders: Set<string>, depth = 0): FlatNode[] {
  const result: FlatNode[] = [];
  for (const node of nodes) {
    if (node.type === 'folder') {
      const isExpanded = expandedFolders.has(node.path);
      result.push({ node, depth, isExpanded });
      if (isExpanded && node.children) {
        result.push(...flattenTree(node.children, expandedFolders, depth + 1));
      }
    } else {
      result.push({ node, depth });
    }
  }
  return result;
}

// ── Component ──────────────────────────────────────────────────────────

export function FileExplorer() {
  const { state, openFile, removeFile, renameFile, addFile, deleteFolder } = useIDEStore();
  const { project, activeTab } = state;
  const [contextMenu, setContextMenu] = useState<{ type: 'file' | 'folder'; path: string; fileId?: string; x: number; y: number } | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [newItemInput, setNewItemInput] = useState<{ type: 'file' | 'folder'; parentPath: string } | null>(null);
  const [newItemValue, setNewItemValue] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const fileListRef = useRef<HTMLDivElement>(null);

  const tree = useMemo(() => buildTree(project?.files || []), [project?.files]);
  const flatNodes = useMemo(() => flattenTree(tree, expandedFolders), [tree, expandedFolders]);

  // ── Folder expand/collapse ─────────────────────────────────────────
  const toggleFolder = useCallback((folderPath: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) next.delete(folderPath);
      else next.add(folderPath);
      return next;
    });
  }, []);

  const expandFolder = useCallback((folderPath: string) => {
    setExpandedFolders((prev) => {
      if (prev.has(folderPath)) return prev;
      const next = new Set(prev);
      next.add(folderPath);
      return next;
    });
  }, []);

  // ── Context menu ───────────────────────────────────────────────────
  const handleContextMenu = (e: React.MouseEvent, type: 'file' | 'folder', path: string, fileId?: string) => {
    e.preventDefault();
    setContextMenu({ type, path, fileId, x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = () => setContextMenu(null);

  // ── Rename ─────────────────────────────────────────────────────────
  const handleRenameStart = (path: string) => {
    setRenamingPath(path);
    setRenameValue(getFileName(path));
    closeContextMenu();
  };

  const handleRenameSubmit = () => {
    if (!renamingPath || !renameValue.trim()) {
      setRenamingPath(null);
      return;
    }

    const trimmed = renameValue.trim();
    const folder = getFolderPath(renamingPath);
    const newPath = folder ? `${folder}/${trimmed}` : trimmed;

    // Check if this is a file or folder rename
    const file = project?.files.find((f) => f.filename === renamingPath);
    if (file) {
      // File rename
      renameFile(file.id, newPath);
    } else {
      // Folder rename — rename all files inside
      const oldPrefix = renamingPath + '/';
      const parentFolder = getFolderPath(renamingPath);
      const newPrefix = (parentFolder ? parentFolder + '/' : '') + trimmed + '/';
      project?.files.forEach((f) => {
        if (f.filename.startsWith(oldPrefix)) {
          renameFile(f.id, newPrefix + f.filename.slice(oldPrefix.length));
        }
      });
      // Update expanded folders
      setExpandedFolders((prev) => {
        const next = new Set<string>();
        for (const p of prev) {
          if (p === renamingPath) next.add((parentFolder ? parentFolder + '/' : '') + trimmed);
          else if (p.startsWith(oldPrefix)) next.add(newPrefix + p.slice(oldPrefix.length));
          else next.add(p);
        }
        return next;
      });
    }

    setRenamingPath(null);
    setRenameValue('');
  };

  // ── Delete ─────────────────────────────────────────────────────────
  const handleDeleteFile = (fileId: string) => {
    if (window.confirm('Delete this file?')) {
      removeFile(fileId);
    }
    closeContextMenu();
  };

  const handleDeleteFolder = (folderPath: string) => {
    const count = project?.files.filter((f) => f.filename.startsWith(folderPath + '/')).length || 0;
    if (window.confirm(`Delete folder "${getFileName(folderPath)}" and its ${count} file(s)?`)) {
      deleteFolder(folderPath);
    }
    closeContextMenu();
  };

  // ── Duplicate ──────────────────────────────────────────────────────
  const handleDuplicate = (fileId: string) => {
    const file = project?.files.find((f) => f.id === fileId);
    if (file) {
      const folder = getFolderPath(file.filename);
      const name = getFileName(file.filename);
      const newName = name.replace(/(\.\w+)$/, '_copy$1');
      const newPath = folder ? `${folder}/${newName}` : newName;
      const newFile: IDEFile = {
        id: crypto.randomUUID(),
        filename: newPath,
        content: file.content,
        language: file.language,
        isDirty: true,
        hasErrors: false,
        isNew: true,
      };
      addFile(newFile);
    }
    closeContextMenu();
  };

  // ── New file/folder ────────────────────────────────────────────────
  const handleNewFile = (parentPath = '') => {
    setNewItemInput({ type: 'file', parentPath });
    setNewItemValue('');
    if (parentPath) expandFolder(parentPath);
    closeContextMenu();
  };

  const handleNewFolder = (parentPath = '') => {
    setNewItemInput({ type: 'folder', parentPath });
    setNewItemValue('');
    if (parentPath) expandFolder(parentPath);
    closeContextMenu();
  };

  const handleNewItemSubmit = () => {
    if (!newItemInput || !newItemValue.trim()) {
      setNewItemInput(null);
      return;
    }

    const trimmed = newItemValue.trim();
    const fullPath = newItemInput.parentPath ? `${newItemInput.parentPath}/${trimmed}` : trimmed;

    if (newItemInput.type === 'file') {
      const filename = trimmed.endsWith('.mtl') ? fullPath : fullPath + '.mtl';
      const newFile: IDEFile = {
        id: crypto.randomUUID(),
        filename,
        content: '',
        language: 'mtl',
        isDirty: true,
        hasErrors: false,
        isNew: true,
      };
      addFile(newFile);
    } else {
      // Create folder by creating a placeholder file inside it
      // Actually, just expand the folder path and let the user create files inside
      const folderPath = fullPath;
      expandFolder(folderPath);
      // Create a placeholder .mtl file so the folder is visible
      const newFile: IDEFile = {
        id: crypto.randomUUID(),
        filename: `${folderPath}/untitled.mtl`,
        content: '',
        language: 'mtl',
        isDirty: true,
        hasErrors: false,
        isNew: true,
      };
      addFile(newFile);
    }

    setNewItemInput(null);
    setNewItemValue('');
  };

  // ── Keyboard navigation ────────────────────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (flatNodes.length === 0) return;

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        setFocusedIndex((prev) => Math.min(prev + 1, flatNodes.length - 1));
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        setFocusedIndex((prev) => Math.max(prev - 1, 0));
        break;
      }
      case 'ArrowRight': {
        e.preventDefault();
        const node = flatNodes[focusedIndex];
        if (node?.node.type === 'folder' && !node.isExpanded) {
          expandFolder(node.node.path);
        }
        break;
      }
      case 'ArrowLeft': {
        e.preventDefault();
        const node = flatNodes[focusedIndex];
        if (node?.node.type === 'folder' && node.isExpanded) {
          toggleFolder(node.node.path);
        }
        break;
      }
      case 'Enter': {
        e.preventDefault();
        const node = flatNodes[focusedIndex];
        if (node?.node.type === 'file' && node.node.file) {
          openFile(node.node.file.id);
        } else if (node?.node.type === 'folder') {
          toggleFolder(node.node.path);
        }
        break;
      }
      case 'Delete': {
        e.preventDefault();
        const node = flatNodes[focusedIndex];
        if (node?.node.type === 'file' && node.node.file) {
          handleDeleteFile(node.node.file.id);
        } else if (node?.node.type === 'folder') {
          handleDeleteFolder(node.node.path);
        }
        break;
      }
      case 'F2': {
        e.preventDefault();
        const node = flatNodes[focusedIndex];
        if (node) handleRenameStart(node.node.path);
        break;
      }
      case 'Home': {
        e.preventDefault();
        setFocusedIndex(0);
        break;
      }
      case 'End': {
        e.preventDefault();
        setFocusedIndex(flatNodes.length - 1);
        break;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flatNodes, focusedIndex, openFile, toggleFolder, expandFolder]);

  // ── Render a tree node ─────────────────────────────────────────────
  const renderNode = (flatNode: FlatNode, index: number) => {
    const { node, depth, isExpanded } = flatNode;
    const isFolder = node.type === 'folder';
    const isActive = !isFolder && node.file && activeTab === node.file.id;
    const isFocused = index === focusedIndex;
    const isRenaming = renamingPath === node.path;

    return (
      <div
        key={node.path}
        role="treeitem"
        aria-selected={isActive || false}
        aria-expanded={isFolder ? isExpanded : undefined}
        aria-label={`${node.name}${!isFolder && node.file?.isDirty ? ' (unsaved)' : ''}${!isFolder && node.file?.hasErrors ? ' (has errors)' : ''}`}
        tabIndex={-1}
        onClick={() => {
          setFocusedIndex(index);
          if (isFolder) toggleFolder(node.path);
          else if (node.file) openFile(node.file.id);
        }}
        onContextMenu={(e) => handleContextMenu(e, isFolder ? 'folder' : 'file', node.path, node.file?.id)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 8px',
          paddingLeft: 8 + depth * 16,
          cursor: 'pointer',
          fontSize: 12,
          color: isActive ? 'var(--text)' : 'var(--text-secondary)',
          background: isActive ? 'var(--surface)' : isFocused ? 'var(--hover)' : 'transparent',
          borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
          outline: isFocused ? '1px solid var(--accent)' : 'none',
          outlineOffset: -1,
        }}
      >
        {/* Expand/collapse icon for folders */}
        {isFolder ? (
          <span style={{ display: 'flex', alignItems: 'center', width: 14, flexShrink: 0 }}>
            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
        ) : (
          <span style={{ width: 14, flexShrink: 0 }} />
        )}

        {/* Icon */}
        {isFolder ? (
          isExpanded ? <FolderOpen size={14} style={{ flexShrink: 0, opacity: 0.8 }} aria-hidden="true" /> : <FolderClosed size={14} style={{ flexShrink: 0, opacity: 0.8 }} aria-hidden="true" />
        ) : (
          <FileCode size={14} style={{ flexShrink: 0, opacity: 0.7 }} aria-hidden="true" />
        )}

        {/* Name or rename input */}
        {isRenaming ? (
          <input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRenameSubmit();
              if (e.key === 'Escape') { setRenamingPath(null); setRenameValue(''); }
            }}
            autoFocus
            aria-label="Rename"
            style={inputStyle}
          />
        ) : (
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {node.name}
          </span>
        )}

        {/* Indicators for files */}
        {!isFolder && node.file?.hasErrors && (
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--danger)', flexShrink: 0 }} aria-hidden="true" />
        )}
        {!isFolder && node.file?.isDirty && !node.file?.hasErrors && (
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-muted)', flexShrink: 0 }} aria-hidden="true" />
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg)',
        borderRight: '1px solid var(--border)',
        userSelect: 'none',
      }}
      onClick={closeContextMenu}
    >
      {/* Header */}
      <div
        style={{
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
          Explorer
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => handleNewFolder('')}
            title="New Folder"
            aria-label="New folder"
            style={headerButtonStyle}
          >
            <FolderPlus size={14} />
          </button>
          <button
            onClick={() => handleNewFile('')}
            title="New File"
            aria-label="New file"
            style={headerButtonStyle}
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Project selector */}
      {state.projects.length > 1 && project && (
        <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--border)' }}>
          <select
            value={project.id}
            onChange={() => {/* handled by parent */}}
            aria-label="Select project"
            style={{
              width: '100%',
              fontSize: 11,
              padding: '4px 6px',
              borderRadius: 4,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
            }}
          >
            {state.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.fileCount})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* File tree */}
      <div
        ref={fileListRef}
        role="tree"
        aria-label="File explorer"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        style={{ flex: 1, overflowY: 'auto', padding: '4px 0', outline: 'none' }}
      >
        {/* New item input at the appropriate level */}
        {newItemInput && newItemInput.parentPath === '' && (
          <div style={{ padding: '4px 8px', paddingLeft: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
            {newItemInput.type === 'folder' ? <FolderClosed size={14} style={{ opacity: 0.7 }} /> : <FileCode size={14} style={{ opacity: 0.7 }} />}
            <input
              value={newItemValue}
              onChange={(e) => setNewItemValue(e.target.value)}
              onBlur={handleNewItemSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNewItemSubmit();
                if (e.key === 'Escape') { setNewItemInput(null); setNewItemValue(''); }
              }}
              autoFocus
              placeholder={newItemInput.type === 'folder' ? 'folder name' : 'filename.mtl'}
              aria-label={newItemInput.type === 'folder' ? 'New folder name' : 'New file name'}
              style={inputStyle}
            />
          </div>
        )}

        {flatNodes.map((flatNode, index) => (
          <React.Fragment key={flatNode.node.path}>
            {renderNode(flatNode, index)}
            {/* Show new item input inside this folder if it's the target */}
            {newItemInput && newItemInput.parentPath === flatNode.node.path && flatNode.node.type === 'folder' && flatNode.isExpanded && (
              <div style={{ padding: '4px 8px', paddingLeft: 8 + (flatNode.depth + 1) * 16, display: 'flex', alignItems: 'center', gap: 4 }}>
                {newItemInput.type === 'folder' ? <FolderClosed size={14} style={{ opacity: 0.7 }} /> : <FileCode size={14} style={{ opacity: 0.7 }} />}
                <input
                  value={newItemValue}
                  onChange={(e) => setNewItemValue(e.target.value)}
                  onBlur={handleNewItemSubmit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleNewItemSubmit();
                    if (e.key === 'Escape') { setNewItemInput(null); setNewItemValue(''); }
                  }}
                  autoFocus
                  placeholder={newItemInput.type === 'folder' ? 'folder name' : 'filename.mtl'}
                  aria-label={newItemInput.type === 'folder' ? 'New folder name' : 'New file name'}
                  style={inputStyle}
                />
              </div>
            )}
          </React.Fragment>
        ))}

        {project && project.files.length === 0 && !newItemInput && (
          <div style={{ padding: '16px 12px', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
            No files yet. Click + to create one.
          </div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          role="menu"
          aria-label={contextMenu.type === 'folder' ? 'Folder actions' : 'File actions'}
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '4px 0',
            zIndex: 1000,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            minWidth: 140,
          }}
        >
          {contextMenu.type === 'folder' ? (
            <>
              <button role="menuitem" onClick={() => handleNewFile(contextMenu.path)} style={contextMenuItemStyle}>
                New File Here
              </button>
              <button role="menuitem" onClick={() => handleNewFolder(contextMenu.path)} style={contextMenuItemStyle}>
                New Folder Here
              </button>
              <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
              <button role="menuitem" onClick={() => handleRenameStart(contextMenu.path)} style={contextMenuItemStyle}>
                Rename Folder
              </button>
              <button role="menuitem" onClick={() => handleDeleteFolder(contextMenu.path)} style={{ ...contextMenuItemStyle, color: 'var(--danger)' }}>
                Delete Folder
              </button>
            </>
          ) : (
            <>
              <button role="menuitem" onClick={() => handleRenameStart(contextMenu.path)} style={contextMenuItemStyle}>
                Rename
              </button>
              {contextMenu.fileId && (
                <button role="menuitem" onClick={() => handleDuplicate(contextMenu.fileId!)} style={contextMenuItemStyle}>
                  Duplicate
                </button>
              )}
              <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
              {contextMenu.fileId && (
                <button role="menuitem" onClick={() => handleDeleteFile(contextMenu.fileId!)} style={{ ...contextMenuItemStyle, color: 'var(--danger)' }}>
                  Delete
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────

const headerButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: 2,
  borderRadius: 4,
  color: 'var(--text-muted)',
  display: 'flex',
  alignItems: 'center',
};

const contextMenuItemStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '6px 12px',
  fontSize: 12,
  textAlign: 'left',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--text)',
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  fontSize: 12,
  padding: '1px 4px',
  border: '1px solid var(--accent)',
  borderRadius: 3,
  background: 'var(--surface)',
  color: 'var(--text)',
  outline: 'none',
};
