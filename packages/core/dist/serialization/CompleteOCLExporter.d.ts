/**
 * @emf-webapp/core — CompleteOCLExporter
 *
 * Generates Eclipse Complete OCL (.ocl) files from stored constraints.
 * Complete OCL is the standard format for standalone OCL constraint files
 * that can be loaded alongside .ecore models in Eclipse.
 *
 * Format reference: Eclipse OCL Complete OCL specification
 * https://wiki.eclipse.org/OCL/CompleteOCL
 *
 * Structure:
 *   import <nsURI>
 *   package <packageName>
 *     context <ClassName>
 *       inv <constraintName>: <expression>
 *       def: <helperName>(...) : <Type> = <body>
 *   endpackage
 */
export interface OCLConstraintInput {
    /** Constraint name (e.g., "positiveAge") */
    name: string;
    /** Context EClass name (e.g., "Person") */
    context: string;
    /** OCL expression body */
    expression: string;
    /** Severity level */
    severity: 'error' | 'warning' | 'info';
    /** Optional message template */
    message?: string;
}
export interface CompleteOCLOptions {
    /** Package name (e.g., "library") */
    packageName: string;
    /** Namespace URI (e.g., "http://www.example.org/library") */
    nsURI: string;
    /** Optional imports (additional nsURIs to import) */
    imports?: string[];
    /** Optional header comment */
    headerComment?: string;
}
/**
 * Generates a Complete OCL (.ocl) document from a list of constraints.
 *
 * @param constraints - Array of OCL constraints
 * @param options - Export options (package name, nsURI, etc.)
 * @returns Complete OCL document as string
 */
export declare function generateCompleteOCL(constraints: OCLConstraintInput[], options: CompleteOCLOptions): string;
/**
 * Generates OCL constraints as EAnnotations for embedding in .ecore files.
 * This is the inline format used by Eclipse EMF Validation Framework.
 *
 * Returns annotation data that should be added to the EClass in the .ecore.
 *
 * Format:
 *   <eAnnotations source="http://www.eclipse.org/emf/2002/Ecore">
 *     <details key="constraints" value="constraintName1 constraintName2"/>
 *   </eAnnotations>
 *   <eAnnotations source="http://www.eclipse.org/emf/2002/Ecore/OCL/Pivot">
 *     <details key="constraintName1" value="self.age > 0"/>
 *   </eAnnotations>
 */
export interface InlineOCLAnnotation {
    /** The context EClass name */
    context: string;
    /** Constraint names list (space-separated for Ecore annotation) */
    constraintNames: string;
    /** Map of constraint name → OCL expression */
    constraintBodies: Record<string, string>;
}
/**
 * Groups constraints by context and returns inline annotation data
 * suitable for embedding in .ecore EAnnotations.
 */
export declare function generateInlineOCLAnnotations(constraints: OCLConstraintInput[]): InlineOCLAnnotation[];
/**
 * Generates the OCL delegation annotations that go on the EPackage.
 * These tell Eclipse which OCL evaluator to use.
 *
 * Returns annotations array for the package level:
 *   source="http://www.eclipse.org/emf/2002/Ecore"
 *     details: invocationDelegates, settingDelegates, validationDelegates
 */
export interface PackageOCLDelegation {
    source: string;
    details: Record<string, string>;
}
export declare function generateOCLDelegationAnnotations(): PackageOCLDelegation[];
//# sourceMappingURL=CompleteOCLExporter.d.ts.map