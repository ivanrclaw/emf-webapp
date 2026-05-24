/**
 * @emf-webapp/core — EuGENiaAnnotationGenerator
 *
 * Generates EuGENia-compatible EAnnotations for .ecore metamodels.
 * EuGENia uses special annotations on EPackage, EClass, EAttribute,
 * and EReference to define graphical syntax without a separate .odesign.
 *
 * Annotation sources:
 *   - "gmf.diagram"     → on EPackage (diagram-level settings)
 *   - "gmf.node"        → on EClass (node representation)
 *   - "gmf.compartment" → on EReference with containment (compartment)
 *   - "gmf.link"        → on EClass or EReference (edge representation)
 *   - "gmf.label"       → on EAttribute (label configuration)
 *   - "gmf.affixed"     → on EReference (border node)
 *
 * Reference: https://www.eclipse.org/epsilon/doc/eugenia/
 */

import type {
  SerializableEPackage,
  SerializableEClass,
  SerializableEReference,
} from './SerializableToEcoreConverter.js';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface EuGENiaAnnotation {
  source: string;
  details: Record<string, string>;
}

export interface EuGENiaNodeConfig {
  /** EClass name this applies to */
  className: string;
  /** Node label attribute name */
  label?: string;
  /** Node figure shape */
  figure?: 'rectangle' | 'rounded' | 'ellipse' | 'polygon' | 'svg';
  /** Node color (R,G,B format) */
  color?: string;
  /** Border color */
  borderColor?: string;
  /** Border width */
  borderWidth?: number;
  /** Label placement */
  labelPlacement?: 'internal' | 'external';
  /** Icon */
  icon?: string;
  /** Size (width,height) */
  size?: string;
  /** Resizable */
  resizable?: boolean;
  /** Phantom (not directly creatable) */
  phantom?: boolean;
  /** Label icon */
  labelIcon?: boolean;
  /** Margin */
  margin?: number;
}

export interface EuGENiaLinkConfig {
  /** EClass or EReference name */
  name: string;
  /** Whether this is on an EClass (element-based) or EReference (relation-based) */
  type: 'class' | 'reference';
  /** Source class (for class-based links) */
  source?: string;
  /** Target class or reference (for class-based links) */
  target?: string;
  /** Label attribute */
  label?: string;
  /** Line style */
  style?: 'solid' | 'dash' | 'dot';
  /** Line width */
  width?: number;
  /** Line color */
  color?: string;
  /** Source decoration */
  sourceDecoration?: 'none' | 'arrow' | 'diamond' | 'filledDiamond' | 'triangle' | 'filledTriangle';
  /** Target decoration */
  targetDecoration?: 'none' | 'arrow' | 'diamond' | 'filledDiamond' | 'triangle' | 'filledTriangle';
  /** Incoming (for reference-based) */
  incoming?: boolean;
}

export interface EuGENiaCompartmentConfig {
  /** EClass that owns the compartment */
  className: string;
  /** EReference name (containment) */
  referenceName: string;
  /** Layout */
  layout?: 'list' | 'free';
}

export interface EuGENiaDiagramConfig {
  /** Diagram name */
  name?: string;
  /** Diagram figure (canvas) */
  figure?: string;
  /** Units */
  units?: string;
}

export interface EuGENiaSpec {
  diagram: EuGENiaDiagramConfig;
  nodes: EuGENiaNodeConfig[];
  links: EuGENiaLinkConfig[];
  compartments: EuGENiaCompartmentConfig[];
}

// ═══════════════════════════════════════════════════════════════
// Main Generator
// ═══════════════════════════════════════════════════════════════

/**
 * Generates EuGENia annotations for a metamodel based on a graphical spec.
 * Returns a map of element path → annotations to add.
 *
 * The annotations should be embedded in the .ecore file as EAnnotations.
 */
export function generateEuGENiaAnnotations(
  spec: EuGENiaSpec,
): Map<string, EuGENiaAnnotation[]> {
  const result = new Map<string, EuGENiaAnnotation[]>();

  // Package-level @gmf.diagram
  const diagramDetails: Record<string, string> = {};
  if (spec.diagram.name) diagramDetails['foo'] = 'bar'; // EuGENia requires at least empty
  // Actually gmf.diagram just needs to exist on the package
  result.set('__package__', [{
    source: 'gmf.diagram',
    details: spec.diagram.name ? { model: spec.diagram.name } : {},
  }]);

  // Node annotations
  for (const node of spec.nodes) {
    const annotations: EuGENiaAnnotation[] = [];
    const details: Record<string, string> = {};

    if (node.label) details['label'] = node.label;
    if (node.figure) details['figure'] = node.figure;
    if (node.color) details['color'] = node.color;
    if (node.borderColor) details['border.color'] = node.borderColor;
    if (node.borderWidth !== undefined) details['border.width'] = String(node.borderWidth);
    if (node.labelPlacement) details['label.placement'] = node.labelPlacement;
    if (node.icon) details['label.icon'] = node.icon;
    if (node.size) details['size'] = node.size;
    if (node.resizable === false) details['resizable'] = 'false';
    if (node.phantom) details['phantom'] = 'true';
    if (node.labelIcon !== undefined) details['label.icon'] = String(node.labelIcon);
    if (node.margin !== undefined) details['margin'] = String(node.margin);

    annotations.push({ source: 'gmf.node', details });
    result.set(node.className, annotations);
  }

  // Link annotations
  for (const link of spec.links) {
    const annotations: EuGENiaAnnotation[] = [];
    const details: Record<string, string> = {};

    if (link.type === 'class') {
      if (link.source) details['source'] = link.source;
      if (link.target) details['target'] = link.target;
    }
    if (link.label) details['label'] = link.label;
    if (link.style) details['style'] = link.style;
    if (link.width !== undefined) details['width'] = String(link.width);
    if (link.color) details['color'] = link.color;
    if (link.sourceDecoration) details['source.decoration'] = link.sourceDecoration;
    if (link.targetDecoration) details['target.decoration'] = link.targetDecoration;
    if (link.incoming) details['incoming'] = 'true';

    annotations.push({ source: 'gmf.link', details });

    const key = link.type === 'class' ? link.name : `__ref__${link.name}`;
    result.set(key, annotations);
  }

  // Compartment annotations
  for (const comp of spec.compartments) {
    const annotations: EuGENiaAnnotation[] = [];
    const details: Record<string, string> = {};

    if (comp.layout) details['layout'] = comp.layout;

    annotations.push({ source: 'gmf.compartment', details });
    result.set(`__ref__${comp.className}__${comp.referenceName}`, annotations);
  }

  return result;
}

/**
 * Converts a ViewpointSpec-like structure to EuGENia annotations.
 * This bridges the webapp's graphical spec format to EuGENia.
 */
export function viewpointSpecToEuGENia(
  metamodel: SerializableEPackage,
  nodeMappings: Array<{ domainClass: string; defaultStyle: any }>,
  edgeMappings: Array<{ id: string; type: string; domainClass?: string; sourceReference?: string; defaultStyle: any; sourceMappingIds: string[]; targetMappingIds: string[] }>,
  containerMappings: Array<{ domainClass: string; defaultStyle: any; subNodeMappingIds: string[] }>,
): EuGENiaSpec {
  const spec: EuGENiaSpec = {
    diagram: { name: metamodel.name },
    nodes: [],
    links: [],
    compartments: [],
  };

  // Convert node mappings to EuGENia nodes
  for (const nm of nodeMappings) {
    const style = nm.defaultStyle;
    const node: EuGENiaNodeConfig = {
      className: nm.domainClass,
      label: 'name', // Default label attribute
    };

    if (style) {
      if (style.shape) {
        node.figure = mapShapeToEuGENia(style.shape);
      }
      if (style.color) {
        node.color = hexToRGB(style.color);
      }
      if (style.borderColor) {
        node.borderColor = hexToRGB(style.borderColor);
      }
      if (style.borderSize) {
        node.borderWidth = style.borderSize;
      }
    }

    spec.nodes.push(node);
  }

  // Convert container mappings
  for (const cm of containerMappings) {
    const style = cm.defaultStyle;
    const node: EuGENiaNodeConfig = {
      className: cm.domainClass,
      label: 'name',
    };

    if (style) {
      node.figure = 'rectangle';
      if (style.color) node.color = hexToRGB(style.color);
    }

    spec.nodes.push(node);

    // Find containment references for compartments
    const eClass = metamodel.eClassifiers.find(
      c => 'eAttributes' in c && c.name === cm.domainClass
    ) as SerializableEClass | undefined;

    if (eClass) {
      for (const ref of eClass.eReferences) {
        if (ref.containment) {
          spec.compartments.push({
            className: cm.domainClass,
            referenceName: ref.name,
            layout: 'list',
          });
        }
      }
    }
  }

  // Convert edge mappings
  for (const em of edgeMappings) {
    const style = em.defaultStyle;
    const link: EuGENiaLinkConfig = {
      name: em.domainClass || em.sourceReference || em.id,
      type: em.type === 'element-based' ? 'class' : 'reference',
    };

    if (em.type === 'element-based' && em.domainClass) {
      // Find source/target references on the edge class
      const edgeClass = metamodel.eClassifiers.find(
        c => 'eAttributes' in c && c.name === em.domainClass
      ) as SerializableEClass | undefined;

      if (edgeClass) {
        const srcRef = edgeClass.eReferences.find(r => !r.containment);
        const tgtRef = edgeClass.eReferences.find(r => !r.containment && r !== srcRef);
        if (srcRef) link.source = srcRef.name;
        if (tgtRef) link.target = tgtRef.name;
      }
    }

    if (style) {
      if (style.lineStyle && style.lineStyle !== 'solid') {
        link.style = style.lineStyle as any;
      }
      if (style.lineWidth) link.width = style.lineWidth;
      if (style.color) link.color = hexToRGB(style.color);
      if (style.targetDecoration && style.targetDecoration !== 'none') {
        link.targetDecoration = mapDecorationToEuGENia(style.targetDecoration);
      }
      if (style.sourceDecoration && style.sourceDecoration !== 'none') {
        link.sourceDecoration = mapDecorationToEuGENia(style.sourceDecoration);
      }
    }

    spec.links.push(link);
  }

  return spec;
}

/**
 * Serializes EuGENia annotations as EAnnotation XML elements
 * for embedding in a .ecore file.
 */
export function serializeEuGENiaAnnotationXml(
  annotation: EuGENiaAnnotation,
  indent: string = '',
): string {
  const lines: string[] = [];

  if (Object.keys(annotation.details).length === 0) {
    lines.push(`${indent}<eAnnotations source="${escapeXml(annotation.source)}"/>`);
  } else {
    lines.push(`${indent}<eAnnotations source="${escapeXml(annotation.source)}">`);
    for (const [key, value] of Object.entries(annotation.details)) {
      lines.push(`${indent}  <details key="${escapeXml(key)}" value="${escapeXml(value)}"/>`);
    }
    lines.push(`${indent}</eAnnotations>`);
  }

  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function mapShapeToEuGENia(shape: string): EuGENiaNodeConfig['figure'] {
  switch (shape) {
    case 'rectangle': return 'rectangle';
    case 'rounded-rectangle': return 'rounded';
    case 'ellipse': return 'ellipse';
    case 'diamond': return 'polygon';
    default: return 'rectangle';
  }
}

function mapDecorationToEuGENia(decoration: string): EuGENiaLinkConfig['targetDecoration'] {
  switch (decoration) {
    case 'arrow':
    case 'open-arrow': return 'arrow';
    case 'diamond': return 'diamond';
    case 'filled-diamond': return 'filledDiamond';
    case 'triangle': return 'triangle';
    case 'filled-triangle': return 'filledTriangle';
    default: return 'none';
  }
}

/**
 * Converts hex color (#RRGGBB) to EuGENia RGB format (R,G,B).
 */
function hexToRGB(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) || 0;
  const g = parseInt(clean.substring(2, 4), 16) || 0;
  const b = parseInt(clean.substring(4, 6), 16) || 0;
  return `${r},${g},${b}`;
}
