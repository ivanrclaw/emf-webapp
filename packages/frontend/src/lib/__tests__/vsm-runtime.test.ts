/**
 * Integration tests for vsm-runtime constraint engine.
 * Tests the full flow: ViewpointSpec → constraints → style resolution → layers.
 */
import { describe, it, expect } from 'vitest';
import {
  canUseTool,
  canCreateEdge,
  canDelete,
  canDirectEdit,
  getDirectEditTool,
  resolveNodeStyle,
  resolveEdgeStyle,
  collectActiveTools,
  collectActiveToolSections,
  collectActiveMappings,
} from '../vsm-runtime';
import type {
  ViewpointSpec,
  Layer,
  NodeMapping,
  ContainerMapping,
  EdgeMapping,
  NodeCreationTool,
  ContainerCreationTool,
  EdgeCreationTool,
  DeleteTool,
  DirectEditTool,
} from '../../components/spec-diagram/types';

/* ------------------------------------------------------------------ */
/*  Fixtures                                                           */
/* ------------------------------------------------------------------ */

const classNodeMapping: NodeMapping = {
  id: 'nm-class',
  domainClass: 'EClass',
  semanticCandidatesExpression: 'self.eClassifiers',
  labelExpression: 'self.name',
  defaultStyle: {
    shape: 'rectangle',
    color: '#4A90D9',
    borderColor: '#2C5F8A',
    borderSize: 2,
    borderLineStyle: 'solid',
    labelExpression: 'self.name',
    labelColor: '#FFFFFF',
    labelSize: 14,
    labelPosition: 'inside',
    labelBold: false,
    labelItalic: false,
    showIcon: false,
    width: 120,
    height: 60,
  },
  conditionalStyles: [
    {
      id: 'cs-abstract',
      predicateExpression: 'self.abstract = true',
      style: {
        color: '#9B59B6',
        borderColor: '#6C3483',
      },
    },
  ],
};

const packageContainerMapping: ContainerMapping = {
  id: 'cm-package',
  domainClass: 'EPackage',
  semanticCandidatesExpression: 'self.eSubpackages',
  labelExpression: 'self.name',
  defaultStyle: {
    shape: 'rectangle',
    color: '#F0F4F8',
    borderColor: '#94A3B8',
    borderSize: 1,
    borderLineStyle: 'solid',
    labelExpression: 'self.name',
    labelColor: '#334155',
    labelSize: 13,
    labelPosition: 'top',
    labelBold: true,
    labelItalic: false,
    showIcon: false,
    width: 200,
    height: 150,
  },
  conditionalStyles: [],
  childrenPresentation: 'FreeForm',
  subNodeMappingIds: ['nm-class'],
  subContainerMappingIds: [],
};

const inheritanceEdgeMapping: EdgeMapping = {
  id: 'em-inheritance',
  type: 'relation-based',
  sourceReference: 'eSuperTypes',
  sourceMappingIds: ['nm-class'],
  targetMappingIds: ['nm-class'],
  targetFinderExpression: 'self.eSuperTypes',
  defaultStyle: {
    lineStyle: 'solid',
    lineWidth: 2,
    color: '#2C5F8A',
    sourceDecoration: 'none',
    targetDecoration: 'triangle',
    routingStyle: 'manhattan',
    labelColor: '#666666',
    labelSize: 11,
  },
  conditionalStyles: [
    {
      id: 'cs-edge-abstract',
      predicateExpression: 'self.abstract = true',
      style: {
        lineStyle: 'dash',
        color: '#9B59B6',
      },
    },
  ],
};

const createClassTool: NodeCreationTool = {
  id: 'tool-create-class',
  type: 'nodeCreation',
  label: 'Create Class',
  mappingId: 'nm-class',
  createType: 'EClass',
  containmentReference: 'eClassifiers',
  initialAttributes: { name: '"NewClass"', abstract: 'false' },
};

const createPackageTool: ContainerCreationTool = {
  id: 'tool-create-package',
  type: 'containerCreation',
  label: 'Create Package',
  mappingId: 'cm-package',
  createType: 'EPackage',
  containmentReference: 'eSubpackages',
  initialAttributes: { name: '"NewPackage"' },
};

const createInheritanceTool: EdgeCreationTool = {
  id: 'tool-create-inheritance',
  type: 'edgeCreation',
  label: 'Inheritance',
  edgeMappingId: 'em-inheritance',
  referenceToSet: 'eSuperTypes',
};

const deleteClassTool: DeleteTool = {
  id: 'tool-delete-class',
  type: 'delete',
  label: 'Delete',
  mappingIds: ['nm-class'],
};

const directEditTool: DirectEditTool = {
  id: 'tool-direct-edit',
  type: 'directEdit',
  label: 'Edit Name',
  mappingIds: ['nm-class', 'cm-package'],
  inputLabelExpression: 'self.name',
  featureToSet: 'name',
};

const conditionalCreateTool: NodeCreationTool = {
  id: 'tool-create-abstract',
  type: 'nodeCreation',
  label: 'Create Abstract Class',
  mappingId: 'nm-class',
  createType: 'EClass',
  containmentReference: 'eClassifiers',
  initialAttributes: { name: '"NewAbstract"', abstract: 'true' },
  preconditionExpression: 'self.isDesigner = true',
};

const defaultLayer: Layer = {
  id: 'layer-default',
  name: 'Default',
  isDefault: true,
  activeByDefault: true,
  nodeMappings: [classNodeMapping],
  containerMappings: [packageContainerMapping],
  edgeMappings: [inheritanceEdgeMapping],
  toolSections: [
    {
      id: 'ts-creation',
      label: 'Creation Tools',
      tools: [createClassTool, createPackageTool, createInheritanceTool, deleteClassTool, directEditTool],
    },
  ],
};

const debugNodeMapping: NodeMapping = {
  id: 'nm-debug',
  domainClass: 'DebugAnnotation',
  semanticCandidatesExpression: 'self.annotations',
  labelExpression: '"[DEBUG] " + self.message',
  defaultStyle: {
    shape: 'ellipse',
    color: '#FF6B6B',
    borderColor: '#C0392B',
    borderSize: 1,
    borderLineStyle: 'solid',
    labelExpression: 'self.message',
    labelColor: '#FFFFFF',
    labelSize: 11,
    labelPosition: 'inside',
    labelBold: false,
    labelItalic: true,
    showIcon: false,
    width: 80,
    height: 40,
  },
  conditionalStyles: [],
};

const debugLayer: Layer = {
  id: 'layer-debug',
  name: 'Debug',
  isDefault: false,
  activeByDefault: false,
  nodeMappings: [debugNodeMapping],
  containerMappings: [],
  edgeMappings: [],
  toolSections: [
    {
      id: 'ts-debug',
      label: 'Debug Tools',
      tools: [conditionalCreateTool],
    },
  ],
};

const spec: ViewpointSpec = {
  id: 'vsp-test',
  name: 'Test Viewpoint',
  metamodelId: 'mm-test',
  diagram: { id: 'diag-test', label: 'Test Diagram', domainClass: 'EPackage' },
  defaultLayer,
  additionalLayers: [debugLayer],
};

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('vsm-runtime', () => {
  describe('canUseTool', () => {
    it('allows tools without precondition', () => {
      expect(canUseTool(createClassTool, { self: {} })).toBe(true);
    });

    it('blocks tools when precondition fails', () => {
      expect(canUseTool(conditionalCreateTool, { self: { isDesigner: false } })).toBe(false);
    });

    it('allows tools when precondition passes', () => {
      expect(canUseTool(conditionalCreateTool, { self: { isDesigner: true } })).toBe(true);
    });
  });

  describe('canCreateEdge', () => {
    it('allows valid edge creation', () => {
      expect(canCreateEdge(createInheritanceTool, inheritanceEdgeMapping, 'nm-class', 'nm-class')).toBe(true);
    });

    it('rejects edge when tool references wrong mapping', () => {
      const wrongTool: EdgeCreationTool = { ...createInheritanceTool, edgeMappingId: 'em-other' };
      expect(canCreateEdge(wrongTool, inheritanceEdgeMapping, 'nm-class', 'nm-class')).toBe(false);
    });

    it('rejects edge when source mapping not allowed', () => {
      expect(canCreateEdge(createInheritanceTool, inheritanceEdgeMapping, 'nm-debug', 'nm-class')).toBe(false);
    });

    it('rejects edge when target mapping not allowed', () => {
      expect(canCreateEdge(createInheritanceTool, inheritanceEdgeMapping, 'nm-class', 'cm-package')).toBe(false);
    });
  });

  describe('canDelete', () => {
    it('returns true when delete tool exists for mapping', () => {
      const tools = defaultLayer.toolSections[0].tools;
      expect(canDelete('nm-class', tools)).toBe(true);
    });

    it('returns false when no delete tool for mapping', () => {
      const tools = defaultLayer.toolSections[0].tools;
      expect(canDelete('cm-package', tools)).toBe(false);
    });

    it('returns false with empty tools', () => {
      expect(canDelete('nm-class', [])).toBe(false);
    });
  });

  describe('canDirectEdit', () => {
    it('returns true when direct edit tool exists', () => {
      const tools = defaultLayer.toolSections[0].tools;
      expect(canDirectEdit('nm-class', tools)).toBe(true);
      expect(canDirectEdit('cm-package', tools)).toBe(true);
    });

    it('returns false when no direct edit tool', () => {
      const tools = defaultLayer.toolSections[0].tools;
      expect(canDirectEdit('nm-debug', tools)).toBe(false);
    });
  });

  describe('getDirectEditTool', () => {
    it('returns the tool when found', () => {
      const tools = defaultLayer.toolSections[0].tools;
      const tool = getDirectEditTool('nm-class', tools);
      expect(tool).toBeDefined();
      expect(tool!.id).toBe('tool-direct-edit');
      expect(tool!.inputLabelExpression).toBe('self.name');
    });

    it('returns undefined when not found', () => {
      const tools = defaultLayer.toolSections[0].tools;
      expect(getDirectEditTool('nm-debug', tools)).toBeUndefined();
    });
  });

  describe('resolveNodeStyle', () => {
    it('returns default style when no conditional matches', () => {
      const style = resolveNodeStyle(classNodeMapping, { name: 'Foo', abstract: false });
      expect(style.color).toBe('#4A90D9');
      expect(style.borderColor).toBe('#2C5F8A');
    });

    it('applies conditional style when predicate matches', () => {
      const style = resolveNodeStyle(classNodeMapping, { name: 'Foo', abstract: true });
      expect(style.color).toBe('#9B59B6');
      expect(style.borderColor).toBe('#6C3483');
      // Non-overridden properties remain from default
      expect(style.labelColor).toBe('#FFFFFF');
      expect(style.shape).toBe('rectangle');
    });

    it('handles mapping with no conditional styles', () => {
      const style = resolveNodeStyle(debugNodeMapping, { message: 'test' });
      expect(style.color).toBe('#FF6B6B');
    });
  });

  describe('resolveEdgeStyle', () => {
    it('returns default style when no conditional matches', () => {
      const style = resolveEdgeStyle(inheritanceEdgeMapping, {
        source: { name: 'Child', abstract: false },
        target: { name: 'Parent' },
      });
      expect(style.color).toBe('#2C5F8A');
      expect(style.lineStyle).toBe('solid');
    });

    it('applies conditional style when predicate matches', () => {
      const style = resolveEdgeStyle(inheritanceEdgeMapping, {
        source: { name: 'AbstractChild', abstract: true },
        target: { name: 'Parent' },
      });
      expect(style.lineStyle).toBe('dash');
      expect(style.color).toBe('#9B59B6');
      // Non-overridden
      expect(style.lineWidth).toBe(2);
      expect(style.targetDecoration).toBe('triangle');
    });
  });

  describe('collectActiveTools', () => {
    it('collects only default layer tools when no additional layers active', () => {
      const tools = collectActiveTools(spec, new Set(['layer-default']));
      expect(tools).toHaveLength(5);
      expect(tools.map((t) => t.id)).toContain('tool-create-class');
      expect(tools.map((t) => t.id)).not.toContain('tool-create-abstract');
    });

    it('includes additional layer tools when active', () => {
      const tools = collectActiveTools(spec, new Set(['layer-default', 'layer-debug']));
      expect(tools).toHaveLength(6);
      expect(tools.map((t) => t.id)).toContain('tool-create-abstract');
    });
  });

  describe('collectActiveToolSections', () => {
    it('collects only default layer sections by default', () => {
      const sections = collectActiveToolSections(spec, new Set(['layer-default']));
      expect(sections).toHaveLength(1);
      expect(sections[0].label).toBe('Creation Tools');
    });

    it('includes additional layer sections when active', () => {
      const sections = collectActiveToolSections(spec, new Set(['layer-default', 'layer-debug']));
      expect(sections).toHaveLength(2);
      expect(sections[1].label).toBe('Debug Tools');
    });
  });

  describe('collectActiveMappings', () => {
    it('collects only default layer mappings', () => {
      const m = collectActiveMappings(spec, new Set(['layer-default']));
      expect(m.nodeMappings).toHaveLength(1);
      expect(m.nodeMappings[0].id).toBe('nm-class');
      expect(m.containerMappings).toHaveLength(1);
      expect(m.containerMappings[0].id).toBe('cm-package');
      expect(m.edgeMappings).toHaveLength(1);
      expect(m.edgeMappings[0].id).toBe('em-inheritance');
    });

    it('includes additional layer mappings when active', () => {
      const m = collectActiveMappings(spec, new Set(['layer-default', 'layer-debug']));
      expect(m.nodeMappings).toHaveLength(2);
      expect(m.nodeMappings[1].id).toBe('nm-debug');
    });

    it('excludes inactive additional layers', () => {
      const m = collectActiveMappings(spec, new Set(['layer-default']));
      expect(m.nodeMappings.find((n) => n.id === 'nm-debug')).toBeUndefined();
    });
  });

  describe('full flow: spec → constraints → style', () => {
    it('enforces strict constraint: no tool = no creation', () => {
      // Only default layer active — no debug tools
      const tools = collectActiveTools(spec, new Set(['layer-default']));
      const nodeCreationTools = tools.filter((t) => t.type === 'nodeCreation') as NodeCreationTool[];

      // Only EClass can be created (no DebugAnnotation tool in default layer)
      const creatableTypes = nodeCreationTools.map((t) => t.createType);
      expect(creatableTypes).toContain('EClass');
      expect(creatableTypes).not.toContain('DebugAnnotation');
    });

    it('activating a layer expands available tools', () => {
      const tools = collectActiveTools(spec, new Set(['layer-default', 'layer-debug']));
      const nodeCreationTools = tools.filter((t) => t.type === 'nodeCreation') as NodeCreationTool[];
      const creatableTypes = nodeCreationTools.map((t) => t.createType);
      expect(creatableTypes).toContain('EClass');
      // The conditional tool creates EClass too, but with abstract=true
      expect(nodeCreationTools).toHaveLength(2);
    });

    it('style changes based on semantic data', () => {
      // Concrete class
      const concreteStyle = resolveNodeStyle(classNodeMapping, { name: 'Person', abstract: false });
      expect(concreteStyle.color).toBe('#4A90D9');

      // Abstract class — different style
      const abstractStyle = resolveNodeStyle(classNodeMapping, { name: 'Shape', abstract: true });
      expect(abstractStyle.color).toBe('#9B59B6');
    });

    it('edge constraints prevent invalid connections', () => {
      // Class → Class: valid
      expect(canCreateEdge(createInheritanceTool, inheritanceEdgeMapping, 'nm-class', 'nm-class')).toBe(true);

      // Package → Class: invalid source
      expect(canCreateEdge(createInheritanceTool, inheritanceEdgeMapping, 'cm-package', 'nm-class')).toBe(false);

      // Class → Package: invalid target
      expect(canCreateEdge(createInheritanceTool, inheritanceEdgeMapping, 'nm-class', 'cm-package')).toBe(false);
    });

    it('delete is only allowed when a DeleteTool covers the mapping', () => {
      const tools = collectActiveTools(spec, new Set(['layer-default']));
      // EClass nodes can be deleted
      expect(canDelete('nm-class', tools)).toBe(true);
      // EPackage containers cannot (no delete tool for them)
      expect(canDelete('cm-package', tools)).toBe(false);
    });
  });
});
