/**
 * @emf-webapp/frontend — LayerToggle
 *
 * Toolbar component for toggling additional layers on/off in the runtime model editor.
 * The default layer is always active and cannot be toggled.
 */
import React, { useCallback } from 'react';
import type { Layer } from '../spec-diagram/types';
import { Eye, EyeOff, Layers } from '../icons';

interface LayerToggleProps {
  layers: Layer[];
  activeLayers: Set<string>;
  onToggleLayer: (layerId: string) => void;
}

export function LayerToggle({ layers, activeLayers, onToggleLayer }: LayerToggleProps) {
  const additionalLayers = layers.filter((l) => !l.isDefault);

  if (additionalLayers.length === 0) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4,
      padding: '4px 8px', background: 'var(--surface)',
      borderRadius: 6, border: '1px solid var(--border)',
    }}>
      <Layers size={13} />
      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 4 }}>Layers:</span>
      {additionalLayers.map((layer) => {
        const isActive = activeLayers.has(layer.id);
        return (
          <button
            key={layer.id}
            onClick={() => onToggleLayer(layer.id)}
            title={`${isActive ? 'Hide' : 'Show'} ${layer.name}`}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '2px 8px', borderRadius: 4, border: 'none',
              background: isActive ? 'var(--primary)' : 'var(--border)',
              color: isActive ? '#fff' : 'var(--text-muted)',
              fontSize: 11, cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {isActive ? <Eye size={11} /> : <EyeOff size={11} />}
            {layer.name}
          </button>
        );
      })}
    </div>
  );
}

export default React.memo(LayerToggle);
