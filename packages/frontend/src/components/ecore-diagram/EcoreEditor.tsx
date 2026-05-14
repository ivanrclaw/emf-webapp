/**
 * @emf-webapp/frontend — EcoreEditor Page Component
 *
 * Página principal del editor visual de metamodelos EMF.
 * Integra React Flow, Toolbox, TreeView, PropertyInspector y EAnnotationsPanel.
 * Se comunica con el backend para cargar/guardar el content del metamodelo.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { ReactFlow, Background, Controls, MiniMap, ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useEcoreModel } from './useEcoreModel';
import { edgeTypes } from './edges/CustomEdges';
import Toolbox from './Toolbox';
import TreeView from './TreeView';
import PropertyInspector from './PropertyInspector';
import EAnnotationsPanel from './EAnnotationsPanel';
import { validateModel } from './validation';
import { getMetamodel, updateMetamodelContent } from '../../api/client';
import type { SerializableEPackage, AppNode, AppEdge } from './types';

// Default empty package
const DEFAULT_PKG: SerializableEPackage = {
  name: 'MyMetamodel',
  nsURI: 'http://example.com/1.0',
  nsPrefix: 'example',
  eClassifiers: [],
};

export default function EcoreEditor() {
  const { pid, mmid } = useParams<{ pid: string; mmid: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setLocalSaving] = useState(false);
  const [error, setError] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  const [validationResults, setValidationResults] = useState<any>(null);
  const [pkg, setPkg] = useState<SerializableEPackage>(DEFAULT_PKG);
  const [showAnnotations, setShowAnnotations] = useState(false);

  const model = useEcoreModel(pkg);

  // Load metamodel on mount
  useEffect(() => {
    if (!pid || !mmid) return;
    (async () => {
      try {
        const mm = await getMetamodel(pid, mmid);
        const content = mm.content || DEFAULT_PKG;
        setPkg(content as SerializableEPackage);
        model.updateFromExternal(content as SerializableEPackage);
      } catch (e: any) {
        setError(e.message || 'Failed to load metamodel');
      } finally {
        setLoading(false);
      }
    })();
  }, [pid, mmid]);

  const handleSave = useCallback(async () => {
    if (!pid || !mmid) return;
    setLocalSaving(true);
    setSaveMsg('');
    try {
      await updateMetamodelContent(pid, mmid, model.pkg);
      setSaveMsg('✅ Saved!');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (e: any) {
      setSaveMsg('❌ ' + (e.message || 'Save failed'));
    } finally {
      setLocalSaving(false);
    }
  }, [pid, mmid, model.pkg]);

  const handleValidate = useCallback(() => {
    const result = validateModel(model.pkg);
    setValidationResults(result);
  }, [model.pkg]);

  const handleAdd = useCallback((type: 'class' | 'enum' | 'dataType') => {
    model.addClassifier(type);
  }, [model.addClassifier]);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('application/x-emf-classifier-type');
    if (type) {
      model.addClassifier(type as 'class' | 'enum' | 'dataType');
    }
  }, [model.addClassifier]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-screen"><p className="text-lg">Loading metamodel...</p></div>;
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-gray-50">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b shadow-sm">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-indigo-700">
            {model.pkg.name || 'Metamodel Editor'}
          </h1>
          {model.dirty && (
            <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full">
              Unsaved changes
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {saveMsg && (
            <span className={`text-sm ${saveMsg.startsWith('✅') ? 'text-green-600' : 'text-red-600'}`}>
              {saveMsg}
            </span>
          )}
          <button
            onClick={model.undo}
            disabled={model.undoCount === 0}
            className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50 disabled:opacity-30"
            title="Undo (Ctrl+Z)"
          >
            ↩️ Undo
          </button>
          <button
            onClick={model.redo}
            disabled={model.redoCount === 0}
            className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50 disabled:opacity-30"
            title="Redo (Ctrl+Shift+Z)"
          >
            ↪️ Redo
          </button>
          <button
            onClick={handleValidate}
            className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50"
            title="Validate metamodel"
          >
            ✅ Validate
          </button>
          <button
            onClick={() => setShowAnnotations(!showAnnotations)}
            className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50"
          >
            📝 Annotations
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : '💾 Save'}
          </button>
        </div>
      </div>

      {/* Validation results */}
      {validationResults && !validationResults.valid && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-200">
          <span className="text-sm font-medium text-red-700">
            {validationResults.errors.length} error(s), {validationResults.warnings.length} warning(s)
          </span>
          <ul className="text-xs text-red-600 mt-1 ml-4 list-disc">
            {validationResults.errors.slice(0, 5).map((e: any, i: number) => (
              <li key={i}>{e.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel: Toolbox + TreeView */}
        <div className="w-64 flex flex-col border-r bg-white">
          <Toolbox onAdd={handleAdd} />
          <div className="flex-1 overflow-auto border-t">
            <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Model Explorer
            </div>
            <TreeView
              pkg={model.pkg}
              selectedId={model.selectedId}
              onSelect={(id) => {
                model.setSelectedId(id);
                if (id) {
                  const cls = model.pkg.eClassifiers.find(c => c.id === id);
                  if (cls) {
                    if ('eAttributes' in cls) model.setSelectedType('class');
                    else if ('eLiterals' in cls) model.setSelectedType('enum');
                    else model.setSelectedType('dataType');
                  }
                }
              }}
            />
          </div>
        </div>

        {/* Center: Canvas */}
        <div className="flex-1" onDrop={handleDrop} onDragOver={handleDragOver}>
          <ReactFlowProvider>
            <ReactFlow
              nodes={model.nodes}
              edges={model.edges as any}
              onNodesChange={model.onNodesChange}
              onEdgesChange={model.onEdgesChange}
              onConnect={model.onConnect}
              onNodeClick={model.onNodeClick as any}
              onEdgeClick={model.onEdgeClick as any}
              onPaneClick={model.onPaneClick}
              edgeTypes={edgeTypes}
              fitView
              deleteKeyCode="Delete"
              multiSelectionKeyCode="Shift"
              panOnDrag={true}
              selectNodesOnDrag={false}
              className="bg-dot-pattern"
            >
              <Background />
              <Controls />
              <MiniMap
                nodeStrokeColor="#6366f1"
                nodeColor={(node) => {
                  const t = (node as AppNode).type;
                  if (t === 'ecoreClass') return '#dbeafe';
                  if (t === 'ecoreEnum') return '#fff7ed';
                  return '#f3f4f6';
                }}
                maskColor="rgba(0,0,0,0.1)"
              />
            </ReactFlow>
          </ReactFlowProvider>
        </div>

        {/* Right panel: Properties */}
        <div className="w-80 border-l bg-white overflow-y-auto">
          <PropertyInspector
            selectedId={model.selectedId}
            selectedType={model.selectedType as any}
            pkg={model.pkg}
            onClassifierChange={model.onClassifierChange}
            onAddAttribute={model.onAddAttribute}
            onAddReference={model.onAddReference}
          />
          
          {/* Annotations panel (conditional) */}
          {showAnnotations && model.selectedId && (
            <div className="border-t">
              <EAnnotationsPanel
                annotations={
                  (() => {
                    const cls = model.pkg.eClassifiers.find(c => c.id === model.selectedId);
                    return (cls as any)?.annotations;
                  })()
                }
                onAnnotationsChange={(anns) => {
                  if (model.selectedId) {
                    model.onClassifierChange(model.selectedId, { annotations: anns } as any);
                  }
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
