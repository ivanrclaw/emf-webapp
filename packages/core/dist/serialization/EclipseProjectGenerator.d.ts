/**
 * @emf-webapp/core — EclipseProjectGenerator
 *
 * Generates Eclipse project metadata files required for a valid
 * Eclipse EMF/Sirius/EuGENia project that can be imported directly.
 *
 * Generated files:
 *   .project          — Eclipse project descriptor (natures, builders)
 *   .classpath        — Java classpath configuration
 *   META-INF/MANIFEST.MF — OSGi bundle manifest
 *   plugin.xml        — Eclipse plugin descriptor
 *   build.properties  — PDE build configuration
 *
 * References:
 *   - Eclipse PDE: https://www.eclipse.org/pde/
 *   - EMF Project Structure: https://wiki.eclipse.org/EMF/FAQ
 */
export interface EclipseProjectOptions {
    /** Project/plugin ID (e.g., "com.example.library") */
    pluginId: string;
    /** Human-readable project name */
    projectName: string;
    /** Package name (metamodel name, e.g., "library") */
    packageName: string;
    /** Namespace URI */
    nsURI: string;
    /** Namespace prefix */
    nsPrefix: string;
    /** Whether the project uses Sirius */
    hasSirius?: boolean;
    /** Whether the project uses OCL */
    hasOCL?: boolean;
    /** Whether the project uses Acceleo */
    hasAcceleo?: boolean;
    /** Java compliance version (e.g., "17") */
    javaVersion?: string;
    /** EMF version (e.g., "2.38.0") */
    emfVersion?: string;
    /** Vendor name */
    vendor?: string;
    /** .ecore file path relative to project root */
    ecoreFilePath?: string;
    /** .genmodel file path relative to project root */
    genmodelFilePath?: string;
}
export interface EclipseProjectFiles {
    '.project': string;
    '.classpath': string;
    'META-INF/MANIFEST.MF': string;
    'plugin.xml': string;
    'build.properties': string;
}
/**
 * Generates all Eclipse project metadata files.
 */
export declare function generateEclipseProjectFiles(options: EclipseProjectOptions): EclipseProjectFiles;
//# sourceMappingURL=EclipseProjectGenerator.d.ts.map