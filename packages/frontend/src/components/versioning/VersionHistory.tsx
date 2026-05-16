/**
 * @emf-webapp/frontend — VersionHistory
 *
 * Panel de historial de versiones con timeline, diff y revert.
 * Se abre desde la barra lateral del editor.
 */
import React, { useCallback, useEffect, useState } from 'react';
import type { VersionSummary, VersionDetail, VersionDiff } from '../../types/versions';
import { getVersions, getVersion, getDiff, revertToVersion } from '../../api/versions';
import { History, FileText, GitCompare, Eye, Pencil } from '../icons';

interface VersionHistoryProps {
  metamodelId: string;
  onRevert: (snapshot: Record<string, any>) => void;
  onClose: () => void;
}

type View = 'list' | 'detail' | 'diff';

export const VersionHistory: React.FC<VersionHistoryProps> = ({ metamodelId, onRevert, onClose }) => {
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('list');
  const [selected, setSelected] = useState<VersionDetail | null>(null);
  const [diffData, setDiffData] = useState<{ v1: VersionDetail; v2: VersionDetail | null; diff: VersionDiff } | null>(null);
  const [reverting, setReverting] = useState<string | null>(null);

  const fetchVersions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getVersions(metamodelId);
      setVersions(data);
    } finally {
      setLoading(false);
    }
  }, [metamodelId]);

  useEffect(() => { fetchVersions(); }, [fetchVersions]);

  const openDetail = async (vid: string) => {
    const detail = await getVersion(vid);
    setSelected(detail);
    setView('detail');
  };

  const openDiff = async (vid: string, prevVid?: string) => {
    const v1 = await getVersion(vid);
    let diff: VersionDiff;
    let v2: VersionDetail | null = null;
    if (prevVid) {
      diff = await getDiff(metamodelId, vid, prevVid);
      v2 = await getVersion(prevVid);
    } else {
      const idx = versions.findIndex(v => v.id === vid);
      const prevId = idx < versions.length - 1 ? versions[idx + 1].id : undefined;
      diff = await getDiff(metamodelId, vid, prevId || '');
      if (prevId) v2 = await getVersion(prevId);
    }
    setDiffData({ v1, v2, diff });
    setView('diff');
  };

  const handleRevert = async (vid: string) => {
    setReverting(vid);
    try {
      const result = await revertToVersion(vid);
      onRevert(result.snapshot);
      onClose();
    } finally {
      setReverting(null);
    }
  };

  const formatDate = (d: string | Date) => new Date(d).toLocaleString('es-ES', {
    dateStyle: 'short', timeStyle: 'short',
  });

  return (
    <div className="version-history" style={{ padding: 16, height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
          {view === 'list' && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><History size={14} /> Historial de versiones</span>}
          {view === 'detail' && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><FileText size={14} /> Detalle de versión</span>}
          {view === 'diff' && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><GitCompare size={14} /> Comparar cambios</span>}
        </h3>
        <div style={{ display: 'flex', gap: 4 }}>
          {view !== 'list' && (
            <button
              onClick={() => { setView('list'); setSelected(null); setDiffData(null); }}
              className="btn btn-ghost btn-sm"
            >
              ← Volver
            </button>
          )}
          <button
            onClick={onClose}
            className="btn btn-ghost btn-sm"
            title="Cerrar"
          >
            ✕
          </button>
        </div>
      </div>

      {view === 'list' && (
        <div>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
            Se crea una versión automáticamente al guardar el modelo.
          </p>
          {loading ? (
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Cargando...</p>
          ) : versions.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              No hay versiones guardadas. Guarda el modelo para crear la primera versión.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {versions.map((v, i) => (
                <div key={v.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
                  borderRadius: 6, fontSize: 12, background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 22, height: 22, borderRadius: '50%',
                    fontSize: 10, fontWeight: 700, color: '#fff',
                    background: i === 0 ? 'var(--accent)' : 'var(--text-tertiary)',
                  }}>
                    v{v.versionNumber}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>
                      {v.description || `Versión ${v.versionNumber}`}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                      {formatDate(v.createdAt)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                   <button className="btn btn-ghost btn-xs" onClick={() => openDetail(v.id)} title="Ver detalle">
                      <Eye size={14} />
                   </button>
                    <button className="btn btn-ghost btn-xs" onClick={() => openDiff(v.id, versions[i + 1]?.id)} title="Comparar">
                      ↔
                    </button>
                    <button
                      className="btn btn-ghost btn-xs"
                      onClick={() => handleRevert(v.id)}
                      disabled={reverting === v.id}
                      title="Restaurar esta versión"
                      style={{ color: '#e06c75' }}
                    >
                      {reverting === v.id ? '...' : '⏪'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === 'detail' && selected && (
        <div style={{ fontSize: 12 }}>
          <div style={{ marginBottom: 8 }}>
            <strong>Versión:</strong> v{selected.versionNumber}<br />
            <strong>Descripción:</strong> {selected.description || '-'}<br />
            <strong>Fecha:</strong> {formatDate(selected.createdAt)}
          </div>
          <pre style={{
            fontSize: 11, padding: 8, borderRadius: 6, background: 'var(--bg-code, #1e1e1e)',
            color: '#d4d4d4', overflow: 'auto', maxHeight: 400, whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}>
            {JSON.stringify(selected.snapshot, null, 2)}
          </pre>
        </div>
      )}

      {view === 'diff' && diffData && (
        <div style={{ fontSize: 12 }}>
          <div style={{ marginBottom: 8, color: 'var(--text-secondary)' }}>
            Comparando <strong>v{diffData.v1.versionNumber}</strong> vs{' '}
            <strong>{diffData.v2 ? `v${diffData.v2.versionNumber}` : 'versión anterior'}</strong>
          </div>
          <div style={{ marginBottom: 6, fontSize: 11, color: 'var(--text-tertiary)' }}>
            {diffData.diff.changes.filter(c => c.type === 'modified').length} modificados ·{' '}
            {diffData.diff.changes.filter(c => c.type === 'added').length} añadidos ·{' '}
            {diffData.diff.changes.filter(c => c.type === 'removed').length} eliminados
          </div>
          {diffData.diff.changes.length === 0 ? (
            <p style={{ color: 'var(--text-tertiary)' }}>Sin cambios entre estas versiones</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {diffData.diff.changes.map((c, i) => (
                <div key={i} style={{
                  padding: '6px 8px', borderRadius: 4, fontSize: 11,
                  fontFamily: 'monospace', background: 'var(--bg-secondary)',
                  borderLeft: `3px solid ${
                    c.type === 'added' ? '#4caf50' : c.type === 'removed' ? '#f44336' : '#ff9800'
                  }`,
                }}>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>
                    {c.type === 'added' && '+ '}
                    {c.type === 'removed' && '- '}
                    {c.type === 'modified' && <><Pencil size={14} />{' '}</>}
                    {c.path}
                  </div>
                  {c.type === 'modified' && (
                    <div>
                      <span style={{ color: '#f44336' }}>- {JSON.stringify(c.oldValue)}</span><br />
                      <span style={{ color: '#4caf50' }}>+ {JSON.stringify(c.newValue)}</span>
                    </div>
                  )}
                  {c.type === 'added' && (
                    <div style={{ color: '#4caf50' }}>+ {JSON.stringify(c.newValue)}</div>
                  )}
                  {c.type === 'removed' && (
                    <div style={{ color: '#f44336' }}>- {JSON.stringify(c.oldValue)}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
