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
import type { SerializableEPackage } from './SerializableToEcoreConverter.js';
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
/**
 * Generates EuGENia annotations for a metamodel based on a graphical spec.
 * Returns a map of element path → annotations to add.
 *
 * The annotations should be embedded in the .ecore file as EAnnotations.
 */
export declare function generateEuGENiaAnnotations(spec: EuGENiaSpec): Map<string, EuGENiaAnnotation[]>;
/**
 * Converts a ViewpointSpec-like structure to EuGENia annotations.
 * This bridges the webapp's graphical spec format to EuGENia.
 */
export declare function viewpointSpecToEuGENia(metamodel: SerializableEPackage, nodeMappings: Array<{
    domainClass: string;
    defaultStyle: any;
}>, edgeMappings: Array<{
    id: string;
    type: string;
    domainClass?: string;
    sourceReference?: string;
    defaultStyle: any;
    sourceMappingIds: string[];
    targetMappingIds: string[];
}>, containerMappings: Array<{
    domainClass: string;
    defaultStyle: any;
    subNodeMappingIds: string[];
}>): EuGENiaSpec;
/**
 * Serializes EuGENia annotations as EAnnotation XML elements
 * for embedding in a .ecore file.
 */
export declare function serializeEuGENiaAnnotationXml(annotation: EuGENiaAnnotation, indent?: string): string;
//# sourceMappingURL=EuGENiaAnnotationGenerator.d.ts.map