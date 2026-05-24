/**
 * @emf-webapp/core — SiriusAirdGenerator
 *
 * Generates Eclipse Sirius .aird (Analysis/Representation) files.
 * The .aird file stores:
 *   - References to semantic resources (.ecore, .xmi)
 *   - Viewpoint activations
 *   - Diagram representations (layout, visibility state)
 *
 * This generates a minimal .aird that references the model and activates
 * the viewpoint defined in the .odesign file.
 *
 * Namespace: http://www.eclipse.org/sirius/1.1.0
 */
export interface AirdOptions {
    /** Path to the .odesign file (relative, e.g., "description/model.odesign") */
    odesignPath: string;
    /** Path to the semantic model file (e.g., "model/example.xmi") */
    semanticModelPath: string;
    /** Path to the .ecore metamodel file (e.g., "model/library.ecore") */
    ecorePath: string;
    /** Viewpoint name (must match the name in .odesign) */
    viewpointName: string;
    /** Diagram description name (must match DiagramDescription name in .odesign) */
    diagramName: string;
    /** Representation name (user-visible name for this diagram instance) */
    representationName?: string;
    /** Root element domain class */
    rootDomainClass?: string;
    /** Plugin ID */
    pluginId?: string;
}
/**
 * Generates a minimal Sirius .aird file.
 *
 * This creates a valid .aird that:
 * 1. References the semantic model (.xmi or .ecore)
 * 2. Activates the specified viewpoint
 * 3. Contains a blank diagram representation ready to be opened in Sirius
 */
export declare function generateAird(options: AirdOptions): string;
//# sourceMappingURL=SiriusAirdGenerator.d.ts.map