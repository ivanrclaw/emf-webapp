/**
 * @emf-webapp/frontend — ModelEditor (Rewritten for Sirius VSM)
 *
 * Runtime model editor strictly constrained by the ViewpointSpec.
 * - Palette generated ONLY from VSM ToolSections
 * - Nodes rendered according to NodeMapping styles
 * - Edges rendered according to EdgeMapping styles
 * - Layers toggleable, constraints enforced
 */
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  Connection,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  Panel,
  MarkerType,
  ConnectionMode,
  useReactFlow,
  SelectionMode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  getMetamodel,
  getM1Model,
  updateM1Model,
  getGraphicalSpecs,
  Metamodel,
  M1Model,
  GraphicalSpec,
} from '../api/client';
import ErrorPanel from '../components/feedback/ErrorPanel';
import type { ViewpointSpec, NodeCreationTool, ContainerCreationTool, EdgeCreationTool, NodeMapping, Tool } from '../components/spec-diagram/types';
import VsmNode, { type VsmNodeData } from '../components/model-editor/VsmNode';
import VsmContainerNode, { type VsmContainerNodeData } from '../components/model-editor/VsmContainerNode';
import VsmEdge, { type VsmEdgeData } from '../components/model-editor/VsmEdge';
import { VsmPalette } from '../components/model-editor/VsmPalette';
import { VsmPropertyInspector } from '../components/model-editor/VsmPropertyInspector';
import { EditorToolbar } from '../components/model-editor/EditorToolbar';
import { EditorStatusBar } from '../components/model-editor/EditorStatusBar';
import { InlineEditor, type InlineEditorState } from '../components/model-editor/InlineEditor';
import { ContextMenu, type ContextMenuTarget } from '../components/model-editor/ContextMenu';
import { QuickCreate } from '../components/model-editor/QuickCreate';
import { ObjectExplorer } from '../components/model-editor/ObjectExplorer';
import { ProblemsPanel } from '../components/model-editor/ProblemsPanel';
import { EmptyState } from '../components/model-editor/EmptyState';
import { useModelHistory } from '../components/model-editor/hooks/useModelHistory';
import { useClipboard } from '../components/model-editor/hooks/useClipboard';
import { useKeyboardShortcuts } from '../components/model-editor/hooks/useKeyboardShortcuts';
import { useDragCreate } from '../components/model-editor/hooks/useDragCreate';
import { useModelValidation } from '../components/model-editor/hooks/useModelValidation';
import { exportJSON, exportXMI, exportSVG, exportPNG, downloadBlob } from '../lib/model-export';
import { importJSON, importXMI, readFileAsText, detectFormat } from '../lib/model-import';
import {
  collectActiveToolSections,
  collectActiveMappings,
  collectActiveTools,
  canCreateEdge,
  canDelete,
} from '../lib/vsm-runtime';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SemanticObject {
  id: string;
  eClass: string;
  attributes: Record<string, unknown>;
  references: Record<string, string[]>;
}

interface ModelContent {
  objects: SemanticObject[];
  positions: Record<string, { x: number; y: number }>;
  activeLayers: string[];
}

/* ------------------------------------------------------------------ */
/*  Node/Edge type registries                                          */
/* ------------------------------------------------------------------ */

const nodeTypes = {
  vsmNode: VsmNode,
  vsmContainerNode: VsmContainerNode,
} as any;
const edgeTypes = { vsmEdge: VsmEdge } as any;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function uid(): string {
  return `obj_${Math.random().toString(36).slice(2, 10)}`;
}

/* ------------------------------------------------------------------ */
/*  ModelEditorInner                                                    */
/* ------------------------------------------------------------------ */

function ModelEditorInner(props: { projectId?: string; metamodelId?: string; modelId?: string }) {
  const params = useParams<{ pid: string; mmid: string; modelId: string }>();
  const pid = props.projectId || params.pid;
  const mmid = props.metamodelId || params.mmid;
  const modelId = props.modelId || params.modelId;

  // ─── State ───────────────────────────────────────────────────────
  const [metamodel, setMetamodel] = useState<Metamodel | null>(null);
  const [m1Model, setM1Model] = useState<M1Model | null>(null);
  const [spec, setSpec] = useState<ViewpointSpec | null>(null);
  const [objects, setObjects] = useState<SemanticObject[]>([]);
  const [activeLayers, setActiveLayers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'unsaved' | ''>('');

  // Selection & tools
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [connectMode, setConnectMode] = useState(false);

  // Inline editing
  const [inlineEditState, setInlineEditState] = useState<InlineEditorState | null>(null);

  // Context menu
  const [contextMenuTarget, setContextMenuTarget] = useState<ContextMenuTarget | null>(null);

  // View state
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [showMinimap, setShowMinimap] = useState(true);
  const [gridSize] = useState(20);

  // Panel visibility
  const [showExplorer, setShowExplorer] = useState(true);
  const [showPalette, setShowPalette] = useState(true);
  const [showInspector, setShowInspector] = useState(true);
  const [problemsCollapsed, setProblemsCollapsed] = useState(true);

  // History (undo/redo)
  const history = useModelHistory(null);

  // Clipboard
  const clipboard = useClipboard();

  // Drag-to-canvas
  const dragCreate = useDragCreate();

  // ReactFlow instance
  const reactFlowInstance = useReactFlow();

  const lastSavedRef = useRef('');
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  // Stores loaded positions so nodes keep their place on re-render
  const savedPositionsRef = useRef<Record<string, { x: number; y: number }>>({}); 

  // ─── Derived from spec + active layers ───────────────────────────
  const toolSections = useMemo(() => {
    if (!spec) return [];
    return collectActiveToolSections(spec, activeLayers);
  }, [spec, activeLayers]);

  const allTools = useMemo(() => {
    if (!spec) return [];
    return collectActiveTools(spec, activeLayers);
  }, [spec, activeLayers]);

  const mappings = useMemo(() => {
    if (!spec) return { nodeMappings: [], containerMappings: [], edgeMappings: [] };
    return collectActiveMappings(spec, activeLayers);
  }, [spec, activeLayers]);

  const allLayers = useMemo(() => {
    if (!spec) return [];
    return [spec.defaultLayer, ...spec.additionalLayers];
  }, [spec]);

  // EClasses from metamodel
  const eclasses = useMemo(() => {
    if (!metamodel?.content?.eClassifiers) return [];
    return metamodel.content.eClassifiers as Array<{
      name: string;
      abstract?: boolean;
      interface?: boolean;
      eAttributes?: { name: string; eType?: string; lowerBound?: number; upperBound?: number }[];
      eReferences?: { name: string; eType?: string; containment?: boolean; lowerBound?: number; upperBound?: number }[];
    }>;
  }, [metamodel]);

  // Instance counts per eClass (for palette)
  const instanceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const obj of objects) {
      counts[obj.eClass] = (counts[obj.eClass] || 0) + 1;
    }
    return counts;
  }, [objects]);

  // Model validation (must be after eclasses)
  const validation = useModelValidation(objects, eclasses);

  // Selected object
  const selectedObject = useMemo(() => {
    if (!selectedNodeId) return null;
    return objects.find((o) => o.id === selectedNodeId) || null;
  }, [selectedNodeId, objects]);

  const selectedMapping = useMemo(() => {
    if (!selectedObject) return null;
    return mappings.nodeMappings.find((m) => m.domainClass === selectedObject.eClass)
      || mappings.containerMappings.find((m) => m.domainClass === selectedObject.eClass)
      || null;
  }, [selectedObject, mappings]);

  // ─── Load ────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      if (!pid || !mmid || !modelId) return;
      setLoading(true);
      try {
        const [mm, m] = await Promise.all([
          getMetamodel(pid, mmid),
          getM1Model(pid, mmid, modelId),
        ]);
        setMetamodel(mm);
        setM1Model(m);

        // Load ViewpointSpec
        try {
          const specs = await getGraphicalSpecs(mmid);
          if (specs.length > 0) {
            const parsed = JSON.parse(specs[0].spec || '{}') as ViewpointSpec;
            setSpec(parsed);
            // Initialize active layers
            const active = new Set<string>();
            active.add(parsed.defaultLayer.id);
            for (const layer of parsed.additionalLayers) {
              if (layer.activeByDefault) active.add(layer.id);
            }
            setActiveLayers(active);
          }
        } catch {
          // No spec — editor will show empty palette
        }

        // Load model content
        if (m.content) {
          try {
            const saved: ModelContent = typeof m.content === 'string'
              ? JSON.parse(m.content)
              : m.content;
            if (saved.objects) setObjects(saved.objects);
            if (saved.positions) savedPositionsRef.current = saved.positions;
            if (saved.activeLayers) {
              setActiveLayers(new Set(saved.activeLayers));
            }
          } catch {
            // Start fresh
          }
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [pid, mmid, modelId]);

  // ─── Build ReactFlow nodes/edges from objects + mappings ─────────
  useEffect(() => {
    if (!spec) return;

    // Preserve current ReactFlow node positions before rebuilding
    for (const node of nodes) {
      savedPositionsRef.current[node.id] = node.position;
    }

    const newNodes: Node[] = objects.map((obj) => {
      const mapping = mappings.nodeMappings.find((m) => m.domainClass === obj.eClass)
        || mappings.containerMappings.find((m) => m.domainClass === obj.eClass);

      if (!mapping) {
        // No mapping for this class — render as default
        return {
          id: obj.id,
          type: 'default',
          position: { x: 100, y: 100 },
          data: { label: `${obj.eClass} (unmapped)` },
        };
      }

      const isContainer = 'childrenPresentation' in mapping;
      const savedPos = savedPositionsRef.current[obj.id];
      return {
        id: obj.id,
        type: isContainer ? 'vsmContainerNode' : 'vsmNode',
        position: savedPos ?? { x: 100 + Math.random() * 300, y: 100 + Math.random() * 300 },
        data: {
          mapping,
          semanticData: { ...obj.attributes, name: obj.attributes.name || obj.id, eClass: obj.eClass },
          selected: obj.id === selectedNodeId,
          hasError: validation.hasErrors(obj.id),
          hasWarning: validation.hasWarnings(obj.id),
        },
      };
    });

    // Build edges from references + edge mappings
    const newEdges: Edge[] = [];
    for (const obj of objects) {
      for (const [refName, targetIds] of Object.entries(obj.references)) {
        for (const targetId of targetIds) {
          // Find matching edge mapping
          const edgeMapping = mappings.edgeMappings.find(
            (em) => em.sourceReference === refName,
          );
          if (edgeMapping) {
            newEdges.push({
              id: `${obj.id}-${refName}-${targetId}`,
              source: obj.id,
              target: targetId,
              type: 'vsmEdge',
              data: {
                edgeMapping,
                sourceData: obj.attributes,
                selected: false,
              } as VsmEdgeData,
            });
          } else {
            // No edge mapping — render as simple arrow
            newEdges.push({
              id: `${obj.id}-${refName}-${targetId}`,
              source: obj.id,
              target: targetId,
              markerEnd: { type: MarkerType.ArrowClosed },
              label: refName,
              style: { stroke: 'var(--text-muted)', strokeWidth: 1.5 },
            });
          }
        }
      }
    }

    setNodes(newNodes as any);
    setEdges(newEdges as any);
  }, [objects, mappings, spec, setNodes, setEdges]);

  // ─── Update selection independently (without rebuilding all nodes) ─
  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: { ...n.data, selected: n.id === selectedNodeId },
      })),
    );
  }, [selectedNodeId, setNodes]);

  // ─── Save ────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!pid || !mmid || !modelId) return;
    setSaving(true);
    try {
      // Collect positions from current nodes
      const positions: Record<string, { x: number; y: number }> = {};
      for (const node of nodes) {
        positions[node.id] = node.position;
      }

      const content: ModelContent = {
        objects,
        positions,
        activeLayers: Array.from(activeLayers),
      };
      const payload = JSON.stringify(content);
      await updateM1Model(pid, mmid, modelId, { content: payload });
      lastSavedRef.current = payload;
      setSaveStatus('saved');
      setError('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [pid, mmid, modelId, nodes, objects, activeLayers]);

  // Auto-save
  useEffect(() => {
    const interval = setInterval(() => {
      const current = JSON.stringify({ objects, activeLayers: Array.from(activeLayers) });
      if (current !== lastSavedRef.current) {
        handleSave();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [handleSave, objects, activeLayers]);

  // ─── Create node from tool ───────────────────────────────────────
  const handleCreateNode = useCallback((tool: NodeCreationTool | ContainerCreationTool, position?: { x: number; y: number }) => {
    const newObj: SemanticObject = {
      id: uid(),
      eClass: tool.createType,
      attributes: { name: `${tool.createType}` },
      references: {},
    };
    // Apply initial attributes from tool
    if (tool.initialAttributes) {
      for (const [key, expr] of Object.entries(tool.initialAttributes)) {
        // Simple: strip quotes from string literals
        const val = expr.replace(/^["']|["']$/g, '');
        newObj.attributes[key] = val;
      }
    }
    // Set position if provided (from drag-drop or quick-create)
    if (position) {
      savedPositionsRef.current[newObj.id] = position;
    }
    setObjects((prev) => [...prev, newObj]);
    setSelectedNodeId(newObj.id);
    setSelectedNodeIds(new Set());
    setSaveStatus('unsaved');
  }, []);

  // ─── Connect (edge creation) ─────────────────────────────────────
  const onConnect = useCallback((conn: Connection) => {
    if (!conn.source || !conn.target) return;

    // Find the active edge creation tool
    const edgeTool = allTools.find(
      (t) => t.id === activeTool && t.type === 'edgeCreation',
    ) as EdgeCreationTool | undefined;

    if (!edgeTool || !edgeTool.referenceToSet) {
      // No edge tool active — ignore
      return;
    }

    // Add reference to source object
    setObjects((prev) => prev.map((obj) => {
      if (obj.id !== conn.source) return obj;
      const refs = { ...obj.references };
      const existing = refs[edgeTool.referenceToSet!] || [];
      if (!existing.includes(conn.target!)) {
        refs[edgeTool.referenceToSet!] = [...existing, conn.target!];
      }
      return { ...obj, references: refs };
    }));
    setSaveStatus('unsaved');
    setActiveTool(null);
    setConnectMode(false);
  }, [activeTool, allTools]);

  // ─── Delete selected ─────────────────────────────────────────────
  const handleDelete = useCallback(() => {
    const idsToDelete = selectedNodeIds.size > 0
      ? Array.from(selectedNodeIds)
      : selectedNodeId ? [selectedNodeId] : [];
    if (idsToDelete.length === 0) return;

    // Check delete permission for each
    for (const id of idsToDelete) {
      const obj = objects.find((o) => o.id === id);
      if (!obj) continue;
      const mapping = mappings.nodeMappings.find((m) => m.domainClass === obj.eClass);
      if (mapping && !canDelete(mapping.id, allTools)) return;
    }

    setObjects((prev) => prev.filter((o) => !idsToDelete.includes(o.id)));
    // Also remove references pointing to deleted objects
    setObjects((prev) => prev.map((o) => {
      const refs = { ...o.references };
      for (const [key, targets] of Object.entries(refs)) {
        refs[key] = targets.filter((t) => !idsToDelete.includes(t));
      }
      return { ...o, references: refs };
    }));
    setSelectedNodeId(null);
    setSelectedNodeIds(new Set());
    setSaveStatus('unsaved');
  }, [selectedNodeId, selectedNodeIds, objects, mappings, allTools]);

  // ─── Update attribute ────────────────────────────────────────────
  const handleUpdateAttribute = useCallback((key: string, value: unknown) => {
    if (!selectedNodeId) return;
    setObjects((prev) => prev.map((obj) =>
      obj.id === selectedNodeId
        ? { ...obj, attributes: { ...obj.attributes, [key]: value } }
        : obj,
    ));
    setSaveStatus('unsaved');
  }, [selectedNodeId]);

  const handleDirectEdit = useCallback((value: string) => {
    // Direct edit updates the label — handled via handleUpdateAttribute
  }, []);

  // ─── Reference management ───────────────────────────────────────
  const handleAddReference = useCallback((refName: string, targetId: string) => {
    if (!selectedNodeId) return;
    setObjects((prev) => prev.map((obj) => {
      if (obj.id !== selectedNodeId) return obj;
      const refs = { ...obj.references };
      const existing = refs[refName] || [];
      if (!existing.includes(targetId)) {
        refs[refName] = [...existing, targetId];
      }
      return { ...obj, references: refs };
    }));
    setSaveStatus('unsaved');
  }, [selectedNodeId]);

  const handleRemoveReference = useCallback((refName: string, targetId: string) => {
    if (!selectedNodeId) return;
    setObjects((prev) => prev.map((obj) => {
      if (obj.id !== selectedNodeId) return obj;
      const refs = { ...obj.references };
      refs[refName] = (refs[refName] || []).filter((id) => id !== targetId);
      if (refs[refName].length === 0) delete refs[refName];
      return { ...obj, references: refs };
    }));
    setSaveStatus('unsaved');
  }, [selectedNodeId]);

  const handleNavigateToObject = useCallback((objectId: string) => {
    setSelectedNodeId(objectId);
    // Center view on the node
    const node = nodes.find((n) => n.id === objectId);
    if (node && reactFlowInstance) {
      reactFlowInstance.setCenter(
        node.position.x + 80,
        node.position.y + 30,
        { zoom: 1.2, duration: 300 },
      );
    }
  }, [nodes, reactFlowInstance]);

  // ─── Undo/Redo ──────────────────────────────────────────────────
  const handleUndo = useCallback(() => {
    const prev = history.undo();
    if (prev) {
      setObjects(prev as SemanticObject[]);
      setSaveStatus('unsaved');
    }
  }, [history]);

  const handleRedo = useCallback(() => {
    const next = history.redo();
    if (next) {
      setObjects(next as SemanticObject[]);
      setSaveStatus('unsaved');
    }
  }, [history]);

  // Push to history whenever objects change (debounced inside hook)
  useEffect(() => {
    if (objects.length > 0 || history.historySize > 0) {
      history.push(objects);
    }
  }, [objects]);

  // ─── Duplicate selected ─────────────────────────────────────────
  const handleDuplicate = useCallback(() => {
    const ids = selectedNodeIds.size > 0
      ? Array.from(selectedNodeIds)
      : selectedNodeId ? [selectedNodeId] : [];
    if (ids.length === 0) return;

    const newObjs: SemanticObject[] = [];
    for (const id of ids) {
      const obj = objects.find((o) => o.id === id);
      if (!obj) continue;
      const newObj: SemanticObject = {
        id: uid(),
        eClass: obj.eClass,
        attributes: { ...obj.attributes, name: `${obj.attributes.name || obj.eClass}_copy` },
        references: { ...obj.references },
      };
      // Offset position for the duplicate
      const pos = savedPositionsRef.current[id];
      if (pos) {
        savedPositionsRef.current[newObj.id] = { x: pos.x + 30, y: pos.y + 30 };
      }
      newObjs.push(newObj);
    }
    setObjects((prev) => [...prev, ...newObjs]);
    if (newObjs.length === 1) {
      setSelectedNodeId(newObjs[0].id);
      setSelectedNodeIds(new Set());
    } else {
      setSelectedNodeId(newObjs[0].id);
      setSelectedNodeIds(new Set(newObjs.map((o) => o.id)));
    }
    setSaveStatus('unsaved');
  }, [selectedNodeId, selectedNodeIds, objects]);

  // ─── Select all ─────────────────────────────────────────────────
  const handleSelectAll = useCallback(() => {
    if (objects.length === 0) return;
    const allIds = new Set(objects.map((o) => o.id));
    setSelectedNodeIds(allIds);
    setSelectedNodeId(objects[0].id);
  }, [objects]);

  // ─── Copy / Paste ───────────────────────────────────────────────
  const handleCopy = useCallback(() => {
    const ids = selectedNodeIds.size > 0
      ? Array.from(selectedNodeIds)
      : selectedNodeId ? [selectedNodeId] : [];
    if (ids.length === 0) return;
    clipboard.copy(ids, objects, savedPositionsRef.current);
  }, [selectedNodeId, selectedNodeIds, objects, clipboard]);

  const handlePaste = useCallback(() => {
    const result = clipboard.paste();
    if (!result) return;
    // Add pasted objects
    for (const [id, pos] of Object.entries(result.positions)) {
      savedPositionsRef.current[id] = pos;
    }
    setObjects((prev) => [...prev, ...result.objects]);
    // Select pasted objects
    const pastedIds = new Set(result.objects.map((o) => o.id));
    setSelectedNodeIds(pastedIds);
    setSelectedNodeId(result.objects[0]?.id || null);
    setSaveStatus('unsaved');
  }, [clipboard]);

  // ─── Inline editing ─────────────────────────────────────────────
  const handleStartInlineEdit = useCallback((nodeId?: string) => {
    const targetId = nodeId || selectedNodeId;
    if (!targetId) return;
    const obj = objects.find((o) => o.id === targetId);
    if (!obj) return;

    // Find the node's screen position
    const node = nodes.find((n) => n.id === targetId);
    if (!node) return;

    // Get the DOM element for the node to position the editor
    const nodeEl = document.querySelector(`[data-id="${targetId}"]`);
    if (nodeEl) {
      const rect = nodeEl.getBoundingClientRect();
      const canvasEl = nodeEl.closest('.react-flow');
      const canvasRect = canvasEl?.getBoundingClientRect() || { left: 0, top: 0 };
      setInlineEditState({
        nodeId: targetId,
        initialValue: (obj.attributes.name as string) || '',
        position: {
          x: rect.left - canvasRect.left + rect.width / 2 - 60,
          y: rect.top - canvasRect.top + rect.height / 2 - 15,
        },
        width: Math.max(rect.width, 120),
      });
    }
  }, [selectedNodeId, objects, nodes]);

  const handleConfirmInlineEdit = useCallback((nodeId: string, value: string) => {
    setObjects((prev) => prev.map((obj) =>
      obj.id === nodeId
        ? { ...obj, attributes: { ...obj.attributes, name: value } }
        : obj,
    ));
    setInlineEditState(null);
    setSaveStatus('unsaved');
  }, []);

  const handleCancelInlineEdit = useCallback(() => {
    setInlineEditState(null);
  }, []);

  // ─── Context menu ───────────────────────────────────────────────
  const handleContextMenuAction = useCallback((actionId: string, target: ContextMenuTarget) => {
    switch (actionId) {
      case 'rename':
        if (target.type === 'node') handleStartInlineEdit(target.nodeId);
        break;
      case 'delete':
      case 'delete-all':
        handleDelete();
        break;
      case 'duplicate':
        handleDuplicate();
        break;
      case 'copy':
        handleCopy();
        break;
      case 'paste':
        handlePaste();
        break;
      case 'select-all':
        handleSelectAll();
        break;
      case 'fit-view':
        reactFlowInstance.fitView();
        break;
      case 'toggle-grid':
        setShowGrid((v) => !v);
        break;
      case 'toggle-minimap':
        setShowMinimap((v) => !v);
        break;
      case 'reverse-edge':
        if (target.type === 'edge') {
          // Reverse the edge direction
          const edgeId = target.edgeId;
          const parts = edgeId.split('-');
          // Edge id format: sourceId-refName-targetId
          if (parts.length >= 3) {
            const sourceId = parts[0];
            const refName = parts.slice(1, -1).join('-');
            const targetId = parts[parts.length - 1];
            // Remove from source, add to target
            setObjects((prev) => prev.map((obj) => {
              if (obj.id === sourceId) {
                const refs = { ...obj.references };
                refs[refName] = (refs[refName] || []).filter((t) => t !== targetId);
                if (refs[refName].length === 0) delete refs[refName];
                return { ...obj, references: refs };
              }
              if (obj.id === targetId) {
                const refs = { ...obj.references };
                refs[refName] = [...(refs[refName] || []), sourceId];
                return { ...obj, references: refs };
              }
              return obj;
            }));
            setSaveStatus('unsaved');
          }
        }
        break;
    }
    setContextMenuTarget(null);
  }, [handleDelete, handleDuplicate, handleCopy, handlePaste, handleSelectAll, handleStartInlineEdit, reactFlowInstance]);

  // ─── Explorer rename handler ─────────────────────────────────────
  const handleExplorerRename = useCallback((objectId: string, newName: string) => {
    setObjects((prev) => prev.map((obj) =>
      obj.id === objectId
        ? { ...obj, attributes: { ...obj.attributes, name: newName } }
        : obj,
    ));
    setSaveStatus('unsaved');
  }, []);

  const handleExplorerDelete = useCallback((objectId: string) => {
    setSelectedNodeId(objectId);
    setSelectedNodeIds(new Set());
    // Defer to allow state to update
    setTimeout(() => {
      setObjects((prev) => prev.filter((o) => o.id !== objectId));
      setObjects((prev) => prev.map((o) => {
        const refs = { ...o.references };
        for (const [key, targets] of Object.entries(refs)) {
          refs[key] = targets.filter((t) => t !== objectId);
        }
        return { ...o, references: refs };
      }));
      setSelectedNodeId(null);
      setSaveStatus('unsaved');
    }, 0);
  }, []);

  const handleExplorerDuplicate = useCallback((objectId: string) => {
    const obj = objects.find((o) => o.id === objectId);
    if (!obj) return;
    const newObj: SemanticObject = {
      id: uid(),
      eClass: obj.eClass,
      attributes: { ...obj.attributes, name: `${obj.attributes.name || obj.eClass}_copy` },
      references: { ...obj.references },
    };
    const pos = savedPositionsRef.current[objectId];
    if (pos) {
      savedPositionsRef.current[newObj.id] = { x: pos.x + 30, y: pos.y + 30 };
    }
    setObjects((prev) => [...prev, newObj]);
    setSelectedNodeId(newObj.id);
    setSelectedNodeIds(new Set());
    setSaveStatus('unsaved');
  }, [objects]);

  // ─── Layer toggle ────────────────────────────────────────────────
  const handleToggleLayer = useCallback((layerId: string) => {
    setActiveLayers((prev) => {
      const next = new Set(prev);
      if (next.has(layerId)) next.delete(layerId);
      else next.add(layerId);
      return next;
    });
  }, []);

  // ─── Tool selection ──────────────────────────────────────────────
  const handleSelectTool = useCallback((toolId: string | null) => {
    setActiveTool(toolId);
    const tool = allTools.find((t) => t.id === toolId);
    setConnectMode(tool?.type === 'edgeCreation');
  }, [allTools]);

  // ─── Canvas interactions ─────────────────────────────────────────
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    // Shift+click for multi-select
    if (_.shiftKey) {
      setSelectedNodeIds((prev) => {
        const next = new Set(prev);
        if (next.has(node.id)) {
          next.delete(node.id);
        } else {
          next.add(node.id);
        }
        return next;
      });
      setSelectedNodeId(node.id);
    } else {
      setSelectedNodeId(node.id);
      setSelectedNodeIds(new Set());
    }
    setContextMenuTarget(null);
  }, []);

  const onNodeDoubleClick = useCallback((_: React.MouseEvent, node: Node) => {
    handleStartInlineEdit(node.id);
  }, [handleStartInlineEdit]);

  const onNodeContextMenu = useCallback((e: React.MouseEvent, node: Node) => {
    e.preventDefault();
    e.stopPropagation();
    // Select the node if not already selected
    if (!selectedNodeIds.has(node.id)) {
      setSelectedNodeId(node.id);
      setSelectedNodeIds(new Set());
    }
    setContextMenuTarget({
      type: 'node',
      nodeId: node.id,
      position: { x: e.clientX, y: e.clientY },
    });
  }, [selectedNodeIds]);

  const onEdgeContextMenu = useCallback((e: React.MouseEvent, edge: Edge) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuTarget({
      type: 'edge',
      edgeId: edge.id,
      position: { x: e.clientX, y: e.clientY },
    });
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedNodeIds(new Set());
    setContextMenuTarget(null);
    setInlineEditState(null);
  }, []);

  const onPaneContextMenu = useCallback((e: React.MouseEvent | MouseEvent) => {
    e.preventDefault();
    // Get flow position for potential paste
    const bounds = (e.target as HTMLElement).closest('.react-flow')?.getBoundingClientRect();
    const flowPos = reactFlowInstance.screenToFlowPosition({
      x: (e as React.MouseEvent).clientX - (bounds?.left || 0),
      y: (e as React.MouseEvent).clientY - (bounds?.top || 0),
    });
    setContextMenuTarget({
      type: 'canvas',
      position: { x: (e as React.MouseEvent).clientX, y: (e as React.MouseEvent).clientY },
      flowPosition: flowPos || { x: 0, y: 0 },
    });
  }, [reactFlowInstance]);

  // Multi-select via selection box (rubber-band)
  const onSelectionChange = useCallback(({ nodes: selectedNodes }: { nodes: Node[]; edges: Edge[] }) => {
    if (selectedNodes.length > 1) {
      setSelectedNodeIds(new Set(selectedNodes.map((n) => n.id)));
      setSelectedNodeId(selectedNodes[0]?.id || null);
    }
  }, []);

  // ─── Drag-to-canvas drop ────────────────────────────────────────
  const handleCanvasDragOver = useCallback((e: React.DragEvent) => {
    dragCreate.onDragOver(e);
  }, [dragCreate]);

  const handleCanvasDrop = useCallback((e: React.DragEvent) => {
    const result = dragCreate.onDrop(e, reactFlowInstance.screenToFlowPosition);
    if (result) {
      handleCreateNode(result.tool, result.position);
    }
  }, [dragCreate, reactFlowInstance, handleCreateNode]);

  // ─── Active tool cursor + banner ────────────────────────────────
  const canvasCursor = useMemo(() => {
    if (dragCreate.dragState?.active) return 'grabbing';
    if (connectMode) return 'crosshair';
    if (activeTool) {
      const tool = allTools.find((t) => t.id === activeTool);
      if (tool?.type === 'nodeCreation' || tool?.type === 'containerCreation') return 'cell';
      if (tool?.type === 'delete') return 'not-allowed';
    }
    return undefined;
  }, [activeTool, connectMode, allTools, dragCreate.dragState]);

  const toolBannerText = useMemo(() => {
    if (!activeTool) return null;
    const tool = allTools.find((t) => t.id === activeTool);
    if (!tool) return null;
    if (tool.type === 'edgeCreation') return `🔗 Connect mode: drag from source to target · Esc to cancel`;
    return null;
  }, [activeTool, allTools]);

  // ─── Keyboard shortcuts (centralized hook) ─────────────────────
  useKeyboardShortcuts(
    {
      onDelete: handleDelete,
      onUndo: handleUndo,
      onRedo: handleRedo,
      onDuplicate: handleDuplicate,
      onSelectAll: handleSelectAll,
      onSave: handleSave,
      onCopy: handleCopy,
      onPaste: handlePaste,
      onRename: () => handleStartInlineEdit(),
      onEscape: () => {
        setSelectedNodeId(null);
        setSelectedNodeIds(new Set());
        setInlineEditState(null);
        setContextMenuTarget(null);
      },
      onFitView: () => reactFlowInstance.fitView(),
    },
    {
      hasSelection: !!selectedNodeId || selectedNodeIds.size > 0,
      isEditing: !!inlineEditState,
    },
  );

  // ─── Export ──────────────────────────────────────────────────────
  const handleExport = useCallback((format: 'json' | 'xmi' | 'svg' | 'png') => {
    const positions: Record<string, { x: number; y: number }> = {};
    for (const node of nodes) {
      positions[node.id] = node.position;
    }

    const options = {
      objects,
      positions,
      metamodelName: metamodel?.name,
      metamodelNsUri: metamodel?.content?.nsUri,
      modelName: m1Model?.name,
    };

    switch (format) {
      case 'json': {
        const content = exportJSON(options);
        downloadBlob(content, `${m1Model?.name || 'model'}.json`, 'application/json');
        break;
      }
      case 'xmi': {
        const content = exportXMI(options);
        downloadBlob(content, `${m1Model?.name || 'model'}.xmi`, 'application/xml');
        break;
      }
      case 'svg': {
        const content = exportSVG();
        if (content) downloadBlob(content, `${m1Model?.name || 'model'}.svg`, 'image/svg+xml');
        break;
      }
      case 'png': {
        exportPNG().then((blob) => {
          if (blob) downloadBlob(blob, `${m1Model?.name || 'model'}.png`, 'image/png');
        });
        break;
      }
    }
  }, [nodes, objects, metamodel, m1Model]);

  // ─── Import ─────────────────────────────────────────────────────
  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.xmi,.xml';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const content = await readFileAsText(file);
      const format = detectFormat(file.name, content);

      let result;
      if (format === 'json') {
        result = importJSON(content);
      } else if (format === 'xmi') {
        result = importXMI(content);
      } else {
        setError('Unknown file format. Supported: .json, .xmi, .xml');
        return;
      }

      if (result.error) {
        setError(result.error);
        return;
      }

      if (result.objects.length > 0) {
        setObjects(result.objects);
        for (const [id, pos] of Object.entries(result.positions)) {
          savedPositionsRef.current[id] = pos;
        }
        setSaveStatus('unsaved');
        setError('');
      }
    };
    input.click();
  }, []);

  // ─── Loading ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <div className="skeleton" style={{ height: 32, width: 200, marginBottom: 24 }} />
        <div className="skeleton" style={{ height: 400, borderRadius: 'var(--radius)' }} />
      </div>
    );
  }

  if (error && !metamodel) {
    return <ErrorPanel title="Error" message={error} compact />;
  }

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      {/* Toolbar */}
      <EditorToolbar
        projectId={pid || ''}
        metamodelId={mmid || ''}
        modelName={m1Model?.name || 'Model Editor'}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        hasSelection={!!selectedNodeId || selectedNodeIds.size > 0}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
        onSelectAll={handleSelectAll}
        zoomLevel={zoomLevel}
        onZoomIn={() => reactFlowInstance.zoomIn()}
        onZoomOut={() => reactFlowInstance.zoomOut()}
        onFitView={() => reactFlowInstance.fitView()}
        showGrid={showGrid}
        onToggleGrid={() => setShowGrid((v) => !v)}
        showMinimap={showMinimap}
        onToggleMinimap={() => setShowMinimap((v) => !v)}
        layers={allLayers}
        activeLayers={activeLayers}
        onToggleLayer={handleToggleLayer}
        saving={saving}
        saveStatus={saveStatus}
        onSave={handleSave}
        onExport={handleExport}
        onImport={handleImport}
      />

      {error && (
        <div style={{ padding: '6px 20px' }}>
          <ErrorPanel title="Error" message={error} compact />
        </div>
      )}

      {/* Main layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left panels — Explorer + Palette */}
        {(showExplorer || showPalette) && (
          <div style={{
            display: 'flex', flexDirection: 'column',
            width: 240, background: 'var(--surface)', borderRight: '1px solid var(--border)',
            flexShrink: 0, overflow: 'hidden',
          }}>
            {/* Panel toggle tabs */}
            <div style={{
              display: 'flex', borderBottom: '1px solid var(--border, #27272a)',
              background: 'var(--bg, #0f0f14)',
            }}>
              <button
                onClick={() => setShowExplorer((v) => !v)}
                style={{
                  flex: 1, padding: '5px 8px', border: 'none',
                  background: showExplorer ? 'var(--surface, #1e1e2e)' : 'transparent',
                  color: showExplorer ? 'var(--text, #e4e4e7)' : 'var(--text-muted, #71717a)',
                  fontSize: 10, fontWeight: 600, cursor: 'pointer',
                  textTransform: 'uppercase', letterSpacing: '0.03em',
                  borderBottom: showExplorer ? '2px solid var(--primary, #6366f1)' : '2px solid transparent',
                  fontFamily: 'inherit',
                }}
              >
                Explorer
              </button>
              <button
                onClick={() => setShowPalette((v) => !v)}
                style={{
                  flex: 1, padding: '5px 8px', border: 'none',
                  background: showPalette ? 'var(--surface, #1e1e2e)' : 'transparent',
                  color: showPalette ? 'var(--text, #e4e4e7)' : 'var(--text-muted, #71717a)',
                  fontSize: 10, fontWeight: 600, cursor: 'pointer',
                  textTransform: 'uppercase', letterSpacing: '0.03em',
                  borderBottom: showPalette ? '2px solid var(--primary, #6366f1)' : '2px solid transparent',
                  fontFamily: 'inherit',
                }}
              >
                Palette
              </button>
              <button
                onClick={() => setShowInspector((v) => !v)}
                style={{
                  flex: 1, padding: '5px 8px', border: 'none',
                  background: showInspector ? 'var(--surface, #1e1e2e)' : 'transparent',
                  color: showInspector ? 'var(--text, #e4e4e7)' : 'var(--text-muted, #71717a)',
                  fontSize: 10, fontWeight: 600, cursor: 'pointer',
                  textTransform: 'uppercase', letterSpacing: '0.03em',
                  borderBottom: showInspector ? '2px solid var(--primary, #6366f1)' : '2px solid transparent',
                  fontFamily: 'inherit',
                }}
              >
                Inspector
              </button>
            </div>

            {/* Explorer panel */}
            {showExplorer && (
              <div style={{ flex: showPalette ? '0 0 50%' : 1, overflow: 'hidden', borderBottom: showPalette ? '1px solid var(--border, #27272a)' : undefined }}>
                <ObjectExplorer
                  objects={objects}
                  eclasses={eclasses}
                  selectedNodeId={selectedNodeId}
                  selectedNodeIds={selectedNodeIds}
                  nodeMappings={mappings.nodeMappings}
                  containerMappings={mappings.containerMappings}
                  onSelect={(id) => { setSelectedNodeId(id); setSelectedNodeIds(new Set()); }}
                  onNavigate={handleNavigateToObject}
                  onRename={handleExplorerRename}
                  onDelete={handleExplorerDelete}
                  onDuplicate={handleExplorerDuplicate}
                />
              </div>
            )}

            {/* Palette panel */}
            {showPalette && (
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <VsmPalette
                  toolSections={toolSections}
                  activeTool={activeTool}
                  onSelectTool={handleSelectTool}
                  onCreateNode={handleCreateNode}
                  connectMode={connectMode}
                  hasSelection={!!selectedNodeId || selectedNodeIds.size > 0}
                  instanceCounts={instanceCounts}
                  onDragStart={dragCreate.onDragStart}
                />
              </div>
            )}
          </div>
        )}

        {/* Center — Canvas */}
        <div
          style={{ flex: 1, position: 'relative', cursor: canvasCursor }}
          onDragOver={handleCanvasDragOver}
          onDrop={handleCanvasDrop}
        >
          {/* Tool state banner */}
          {toolBannerText && (
            <div style={{
              position: 'absolute',
              top: 8,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 50,
              padding: '6px 14px',
              background: 'var(--surface, #1e1e2e)',
              border: '1px solid var(--primary, #6366f1)',
              borderRadius: 8,
              fontSize: 12,
              color: 'var(--text, #e4e4e7)',
              boxShadow: '0 4px 12px rgba(99,102,241,0.2)',
              pointerEvents: 'none',
              animation: 'fadeIn 0.15s ease-out',
            }}>
              {toolBannerText}
            </div>
          )}

          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onNodeDoubleClick={onNodeDoubleClick}
            onNodeContextMenu={onNodeContextMenu}
            onEdgeContextMenu={onEdgeContextMenu}
            onPaneClick={onPaneClick}
            onPaneContextMenu={onPaneContextMenu}
            onSelectionChange={onSelectionChange}
            onMoveEnd={(_, viewport) => setZoomLevel(viewport.zoom)}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            connectionMode={connectMode ? ConnectionMode.Loose : ConnectionMode.Strict}
            selectionMode={SelectionMode.Partial}
            selectionOnDrag
            panOnDrag={[1]}
            fitView
            minZoom={0.3}
            maxZoom={2}
            snapToGrid={showGrid}
            snapGrid={[gridSize, gridSize]}
          >
            {showGrid && <Background gap={gridSize} size={1} />}
            <Controls position="bottom-left" showZoom={false} showFitView={false} />
            {showMinimap && <MiniMap position="bottom-right" pannable zoomable />}
            {!spec && (
              <Panel position="top-center">
                <div style={{
                  padding: '12px 20px', background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 8, fontSize: 13, color: 'var(--text-muted)',
                }}>
                  No Viewpoint Specification found. Create one in the Spec Editor to enable constrained modeling.
                </div>
              </Panel>
            )}
          </ReactFlow>

          {/* Empty state when no objects */}
          {objects.length === 0 && (
            <EmptyState hasSpec={!!spec} />
          )}

          {/* Inline Editor overlay */}
          <InlineEditor
            state={inlineEditState}
            onConfirm={handleConfirmInlineEdit}
            onCancel={handleCancelInlineEdit}
          />

          {/* Quick Create FAB */}
          <QuickCreate
            tools={allTools}
            onCreateNode={handleCreateNode}
            instanceCounts={instanceCounts}
          />
        </div>

        {/* Right — Property Inspector */}
        {showInspector && (
          <div style={{
            width: 280, background: 'var(--surface)', borderLeft: '1px solid var(--border)',
            overflow: 'hidden', flexShrink: 0,
          }}>
            <VsmPropertyInspector
              semanticData={selectedObject?.attributes || null}
              selectedObject={selectedObject}
              mapping={selectedMapping}
              tools={allTools}
              allObjects={objects}
              eclasses={eclasses}
              onUpdateAttribute={handleUpdateAttribute}
              onDirectEdit={handleDirectEdit}
              onAddReference={handleAddReference}
              onRemoveReference={handleRemoveReference}
              onNavigateToObject={handleNavigateToObject}
              onDelete={selectedNodeId ? handleDelete : undefined}
            />
          </div>
        )}
      </div>

      {/* Problems Panel */}
      <ProblemsPanel
        diagnostics={validation.diagnostics}
        errorCount={validation.errorCount}
        warningCount={validation.warningCount}
        collapsed={problemsCollapsed}
        onToggleCollapse={() => setProblemsCollapsed((v) => !v)}
        onNavigate={handleNavigateToObject}
      />

      {/* Status Bar */}
      <EditorStatusBar
        zoomLevel={zoomLevel}
        onResetZoom={() => reactFlowInstance.zoomTo(1)}
        nodeCount={objects.length}
        edgeCount={edges.length}
        selectedName={selectedObject?.attributes?.name as string || null}
        selectedType={selectedObject?.eClass || null}
        validationErrors={validation.errorCount}
        validationWarnings={validation.warningCount}
        showGrid={showGrid}
        gridSize={gridSize}
      />

      {/* Context Menu */}
      <ContextMenu
        target={contextMenuTarget}
        onClose={() => setContextMenuTarget(null)}
        onAction={handleContextMenuAction}
        hasClipboard={clipboard.hasClipboard}
        hasSelection={!!selectedNodeId || selectedNodeIds.size > 0}
        multiSelectCount={selectedNodeIds.size}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Wrapper                                                            */
/* ------------------------------------------------------------------ */

export default function ModelEditor(props: { projectId?: string; metamodelId?: string; modelId?: string }) {
  return (
    <ReactFlowProvider>
      <ModelEditorInner {...props} />
    </ReactFlowProvider>
  );
}
