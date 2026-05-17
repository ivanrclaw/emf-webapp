# Sirius VSM Remodel — Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Remodel the graphical syntax editor and model editor to follow Eclipse Sirius's strict 3-layer architecture: Metamodel → VSM (Viewpoint Specification) → Constrained Runtime Editor.

**Architecture:** The VSM defines what's visible and editable. The runtime model editor generates its palette, node rendering, and edge rendering EXCLUSIVELY from the VSM. No tool in the VSM = no capability in the editor. A lightweight expression engine evaluates label expressions and predicates.

**Tech Stack:** React 19, ReactFlow, TypeScript, NestJS, TypeORM, SQLite

---

## Sprint 18: Graphical Syntax Definition (VSM Web)

### Task 18.1: Redesign SpecData Type System

**Objective:** Replace the current simplistic types with a full Sirius-compatible type system supporting node mappings, container mappings, edge mappings, tool sections, layers, and conditional styles.

**Files:**
- Rewrite: `packages/frontend/src/components/spec-diagram/types.ts`

**New type system:**

```typescript
// ─── Expression Engine Types ───────────────────────────────────────
export type Expression = string; // e.g. "self.name", "self.children->size() > 0"

// ─── Style Types ───────────────────────────────────────────────────
export type ShapeType = 'rectangle' | 'ellipse' | 'diamond' | 'note' | 'image';
export type LineStyleType = 'solid' | 'dash' | 'dot' | 'dash-dot';
export type DecorationArrow = 'none' | 'arrow' | 'open-arrow' | 'diamond' | 'filled-diamond' | 'triangle' | 'filled-triangle';
export type LabelPosition = 'inside' | 'top' | 'bottom' | 'border';
export type ChildrenPresentation = 'FreeForm' | 'List' | 'HorizontalStack' | 'VerticalStack';
export type RoutingStyle = 'straight' | 'manhattan' | 'tree';

export interface NodeStyle {
  shape: ShapeType;
  color: string;
  borderColor: string;
  borderSize: number;
  borderLineStyle: LineStyleType;
  width?: number;
  height?: number;
  labelExpression: Expression;
  labelColor: string;
  labelSize: number;
  labelPosition: LabelPosition;
  labelBold: boolean;
  labelItalic: boolean;
  showIcon: boolean;
  iconPath?: string;
  tooltipExpression?: Expression;
}

export interface ConditionalStyle<T> {
  predicateExpression: Expression;
  style: Partial<T>;
}

export interface EdgeStyleSpec {
  lineStyle: LineStyleType;
  lineWidth: number;
  color: string;
  sourceDecoration: DecorationArrow;
  targetDecoration: DecorationArrow;
  routingStyle: RoutingStyle;
  centerLabelExpression?: Expression;
  beginLabelExpression?: Expression;
  endLabelExpression?: Expression;
  labelColor: string;
  labelSize: number;
}

// ─── Mapping Types ─────────────────────────────────────────────────
export interface NodeMapping {
  id: string;
  domainClass: string;
  semanticCandidatesExpression: Expression;
  preconditionExpression?: Expression;
  labelExpression: Expression;
  defaultStyle: NodeStyle;
  conditionalStyles: ConditionalStyle<NodeStyle>[];
}

export interface ContainerMapping extends NodeMapping {
  childrenPresentation: ChildrenPresentation;
  subNodeMappings: string[]; // IDs of NodeMappings that can be children
  subContainerMappings: string[]; // IDs of ContainerMappings that can be children
}

export interface EdgeMapping {
  id: string;
  type: 'relation-based' | 'element-based';
  domainClass?: string; // only for element-based
  sourceReference?: string; // reference name on source class (relation-based)
  targetReference?: string; // reference name for target resolution
  semanticCandidatesExpression?: Expression; // only for element-based
  sourceMappingIds: string[]; // which node mappings can be source
  targetMappingIds: string[]; // which node mappings can be target
  sourceFinderExpression?: Expression;
  targetFinderExpression: Expression;
  preconditionExpression?: Expression;
  defaultStyle: EdgeStyleSpec;
  conditionalStyles: ConditionalStyle<EdgeStyleSpec>[];
}

// ─── Tool Types ────────────────────────────────────────────────────
export type ToolType = 'nodeCreation' | 'containerCreation' | 'edgeCreation' | 'delete' | 'directEdit';

export interface NodeCreationTool {
  id: string;
  type: 'nodeCreation';
  label: string;
  iconPath?: string;
  iconColor?: string;
  mappingId: string; // which NodeMapping this creates
  preconditionExpression?: Expression;
  // What to create:
  createType: string; // EClass name to instantiate
  containmentReference: string; // reference on parent to add to
  initialAttributes?: Record<string, Expression>; // initial values
}

export interface ContainerCreationTool {
  id: string;
  type: 'containerCreation';
  label: string;
  iconPath?: string;
  iconColor?: string;
  mappingId: string;
  preconditionExpression?: Expression;
  createType: string;
  containmentReference: string;
  initialAttributes?: Record<string, Expression>;
}

export interface EdgeCreationTool {
  id: string;
  type: 'edgeCreation';
  label: string;
  iconPath?: string;
  iconColor?: string;
  edgeMappingId: string;
  preconditionExpression?: Expression;
  // For relation-based: which reference to set
  referenceToSet?: string;
  // For element-based: what class to create
  createType?: string;
  containmentReference?: string;
}

export interface DeleteTool {
  id: string;
  type: 'delete';
  label: string;
  mappingIds: string[]; // which mappings this applies to
}

export interface DirectEditTool {
  id: string;
  type: 'directEdit';
  label: string;
  mappingIds: string[];
  inputLabelExpression?: Expression;
  featureToSet: string; // which attribute to update
}

export type Tool = NodeCreationTool | ContainerCreationTool | EdgeCreationTool | DeleteTool | DirectEditTool;

export interface ToolSection {
  id: string;
  label: string;
  tools: Tool[];
}

// ─── Layer ─────────────────────────────────────────────────────────
export interface Layer {
  id: string;
  name: string;
  isDefault: boolean;
  activeByDefault: boolean;
  nodeMappings: NodeMapping[];
  containerMappings: ContainerMapping[];
  edgeMappings: EdgeMapping[];
  toolSections: ToolSection[];
}

// ─── Top-Level Spec ────────────────────────────────────────────────
export interface DiagramDescription {
  id: string;
  label: string;
  domainClass: string; // root type for the diagram
  titleExpression?: Expression;
  preconditionExpression?: Expression;
}

export interface ViewpointSpec {
  id: string;
  name: string;
  metamodelId: string;
  diagram: DiagramDescription;
  defaultLayer: Layer;
  additionalLayers: Layer[];
}

// ─── Legacy compat alias ───────────────────────────────────────────
export type ShapeStyle = NodeStyle;
export type EdgeStyle = EdgeStyleSpec;
export type SpecData = ViewpointSpec;
```

---

### Task 18.2: Expression Engine (Lightweight)

**Objective:** Create a safe expression evaluator that handles `self.name`, `self.attr`, `self.ref->size()`, and boolean predicates for conditional styles and preconditions.

**Files:**
- Create: `packages/frontend/src/lib/expression-engine.ts`
- Create: `packages/frontend/src/lib/__tests__/expression-engine.test.ts`

**Supported expressions:**
- `self.propertyName` → attribute access
- `self.ref->size()` → collection size
- `self.ref->notEmpty()` → boolean
- `self.ref->isEmpty()` → boolean
- `self.property = 'value'` → equality check
- `self.property != 'value'` → inequality
- `self.property > N` → comparison
- `not self.abstract` → negation
- `self.name + ':' + self.type` → string concatenation

---

### Task 18.3: Rewrite SpecEditor — Left Panel (Metamodel Browser + Tool Builder)

**Objective:** Replace the simple palette with a full metamodel browser showing all EClasses/EReferences, and a tool builder where you define creation tools, edge tools, etc.

**Files:**
- Rewrite: `packages/frontend/src/pages/SpecEditor.tsx` (complete rewrite)
- Create: `packages/frontend/src/components/spec-editor/MetamodelBrowser.tsx`
- Create: `packages/frontend/src/components/spec-editor/ToolBuilder.tsx`
- Create: `packages/frontend/src/components/spec-editor/LayerPanel.tsx`

**Layout:**
```
┌─────────────────────────────────────────────────────────────────┐
│ Header: Spec name | Save | Delete                               │
├──────────┬──────────────────────────────────┬───────────────────┤
│ Left     │ Center (Canvas)                  │ Right             │
│          │                                  │                   │
│ Metamodel│ Visual preview of all mappings   │ Style Editor      │
│ Browser  │ (nodes as shapes, edges as lines)│ (selected element)│
│ ─────── │                                  │                   │
│ Layers   │                                  │ Conditional Styles│
│ ─────── │                                  │                   │
│ Tools    │                                  │ Tool Config       │
│          │                                  │                   │
└──────────┴──────────────────────────────────┴───────────────────┘
```

---

### Task 18.4: Rewrite SpecEditor — Center Canvas (Mapping Preview)

**Objective:** The canvas shows a live preview of how each mapping will render. Nodes show their configured shape/style, edges show their line style and decorators.

**Files:**
- Rewrite: `packages/frontend/src/components/spec-diagram/SpecNode.tsx`
- Rewrite: `packages/frontend/src/components/spec-diagram/SpecEdge.tsx`
- Create: `packages/frontend/src/components/spec-diagram/SpecContainerNode.tsx`

---

### Task 18.5: Rewrite SpecEditor — Right Panel (Style + Tool Config)

**Objective:** Full style editor with all Sirius properties: shape, colors, borders, label config, conditional styles, and tool configuration.

**Files:**
- Rewrite: `packages/frontend/src/components/spec-diagram/SpecStylePanel.tsx`
- Create: `packages/frontend/src/components/spec-editor/ConditionalStyleEditor.tsx`
- Create: `packages/frontend/src/components/spec-editor/EdgeMappingEditor.tsx`
- Create: `packages/frontend/src/components/spec-editor/ToolConfigPanel.tsx`

---

### Task 18.6: Default Spec Generation (Auto-populate from Metamodel)

**Objective:** When creating a new spec, auto-generate sensible defaults: one NodeMapping per concrete EClass, one EdgeMapping per EReference, one NodeCreationTool per concrete class, one EdgeCreationTool per reference.

**Files:**
- Create: `packages/frontend/src/lib/spec-generator.ts`

---

### Task 18.7: Spec Validation

**Objective:** Validate that the spec is consistent: all tool mappingIds reference existing mappings, all edge source/target mappings exist, domain classes exist in metamodel.

**Files:**
- Create: `packages/frontend/src/lib/spec-validator.ts`

---

## Sprint 19: Runtime Model Editor (Strictly Constrained)

### Task 19.1: Rewrite ModelEditor — Palette from VSM Tools Only

**Objective:** The palette is generated EXCLUSIVELY from ToolSections defined in the active layers of the VSM. No tool = no creation capability.

**Files:**
- Rewrite: `packages/frontend/src/pages/ModelEditor.tsx` (complete rewrite)
- Create: `packages/frontend/src/components/model-editor/VsmPalette.tsx`

**Behavior:**
- Load the ViewpointSpec for this metamodel
- Collect all ToolSections from defaultLayer + active additionalLayers
- Render each section as a collapsible group
- Each tool shows its label + icon color
- Clicking a NodeCreationTool creates an instance of `createType`
- EdgeCreationTools activate a "connect mode"

---

### Task 19.2: Custom Node Rendering from VSM Mappings

**Objective:** Each M1 object node renders according to its NodeMapping style (shape, color, label expression evaluated against the object's data).

**Files:**
- Create: `packages/frontend/src/components/model-editor/VsmNode.tsx`
- Create: `packages/frontend/src/components/model-editor/VsmContainerNode.tsx`
- Create: `packages/frontend/src/components/model-editor/VsmEdge.tsx`

**Behavior:**
- VsmNode receives the NodeMapping + semantic data
- Renders the configured shape (rect/ellipse/diamond/note)
- Evaluates labelExpression against the object's attributes
- Applies conditional styles (first matching predicate wins)
- Supports bordered sub-nodes for ports

---

### Task 19.3: Edge Rendering from VSM EdgeMappings

**Objective:** Edges render according to their EdgeMapping style (line style, decorators, routing, labels).

**Files:**
- Modify: `packages/frontend/src/components/model-editor/VsmEdge.tsx`

**Behavior:**
- Relation-based edges: automatically drawn when a reference exists between two displayed objects
- Element-based edges: drawn for each edge semantic element
- Style: line color, width, dash pattern, source/target decorators
- Labels: evaluated from expressions

---

### Task 19.4: Layer Toggle System

**Objective:** Toolbar with layer toggles. Disabling a layer hides its elements AND removes its tools from the palette.

**Files:**
- Create: `packages/frontend/src/components/model-editor/LayerToggle.tsx`

---

### Task 19.5: Strict Constraint Enforcement

**Objective:** The editor enforces that ONLY what's defined in the VSM can be done:
- Can't create elements without a matching NodeCreationTool
- Can't connect elements without a matching EdgeCreationTool
- Can't delete without a DeleteTool
- Preconditions gate tool applicability

**Files:**
- Create: `packages/frontend/src/lib/vsm-runtime.ts` (constraint engine)

---

### Task 19.6: Property Inspector (VSM-Aware)

**Objective:** When selecting a node, show editable attributes. Direct edit uses the DirectEditTool's featureToSet.

**Files:**
- Create: `packages/frontend/src/components/model-editor/VsmPropertyInspector.tsx`

---

### Task 19.7: Model Serialization & Persistence

**Objective:** Save/load M1 models with their semantic data (not just ReactFlow positions). The model stores objects with their EClass, attributes, and references.

**Files:**
- Modify: `packages/frontend/src/pages/ModelEditor.tsx` (save/load logic)

**Data format:**
```json
{
  "objects": [
    { "id": "obj_1", "eClass": "Person", "attributes": {"name": "John"}, "references": {"father": "obj_2"} }
  ],
  "positions": { "obj_1": {"x": 100, "y": 200} },
  "activeLayers": ["layer_default", "layer_debug"]
}
```

---

### Task 19.8: Integration Tests

**Objective:** Verify the full pipeline: create spec → create model → palette matches spec → constraints enforced.

**Files:**
- Create: `packages/frontend/src/lib/__tests__/vsm-runtime.test.ts`
- Create: `packages/frontend/src/lib/__tests__/spec-generator.test.ts`
- Create: `packages/frontend/src/lib/__tests__/spec-validator.test.ts`

---

## Execution Order

Sprint 18: 18.1 → 18.2 → 18.6 → 18.7 → 18.3 → 18.4 → 18.5
Sprint 19: 19.1 → 19.2 → 19.3 → 19.4 → 19.5 → 19.6 → 19.7 → 19.8
