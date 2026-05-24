/**
 * @emf-webapp/core — GenmodelGenerator
 *
 * Generates Eclipse .genmodel XML from a SerializableEPackage.
 * The .genmodel is required by Eclipse EMF for Java code generation
 * and is referenced by Sirius, Acceleo, and other Eclipse tools.
 *
 * Format: EMF GenModel XMI (genmodel namespace 2.0)
 * Reference: http://www.eclipse.org/emf/2002/GenModel
 */
import type { SerializableEPackage } from './SerializableToEcoreConverter.js';
export interface GenmodelOptions {
    /** Path to the .ecore file relative to the project (e.g., "model/MyModel.ecore") */
    ecoreFilePath: string;
    /** Base package for generated Java code (e.g., "com.example.mymodel") */
    basePackage?: string;
    /** Model directory for generated code (e.g., "src") */
    modelDirectory?: string;
    /** Plugin ID (e.g., "com.example.mymodel") */
    modelPluginID?: string;
    /** Copyright text */
    copyrightText?: string;
    /** Compliance level (e.g., "8.0", "11.0", "17.0") */
    complianceLevel?: string;
    /** Whether to generate edit code */
    editDirectory?: string;
    /** Whether to generate editor code */
    editorDirectory?: string;
    /** Whether to generate test code */
    testsDirectory?: string;
    /** Import organizing (true by default) */
    importerID?: string;
}
/**
 * Generates a .genmodel XML string from a SerializableEPackage.
 *
 * @param pkg - The serializable EPackage
 * @param options - Generation options
 * @returns Complete .genmodel XML string
 */
export declare function generateGenmodel(pkg: SerializableEPackage, options: GenmodelOptions): string;
//# sourceMappingURL=GenmodelGenerator.d.ts.map