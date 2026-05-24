/**
 * @emf-webapp/core — AcceleoMtlGenerator
 *
 * Converts webapp code templates to Acceleo .mtl module files.
 * Acceleo is Eclipse's standard M2T (Model-to-Text) transformation engine.
 *
 * Format: Acceleo 3.x module syntax
 *   [comment encoding = UTF-8 /]
 *   [module moduleName('nsURI')]
 *   [template public templateName(arg : EClass)]
 *     ... template body ...
 *   [/template]
 *
 * Reference: https://wiki.eclipse.org/Acceleo
 */
export interface CodeTemplateInput {
    /** Template name (e.g., "generateClass") */
    name: string;
    /** Target EClass context (e.g., "EClass", "Person") */
    context: string;
    /** Template body (may use webapp expression syntax) */
    body: string;
    /** Output file expression (e.g., "self.name + '.java'") */
    outputFile?: string;
    /** Whether this is the main/entry template */
    isMain?: boolean;
    /** Visibility: public, protected, private */
    visibility?: 'public' | 'protected' | 'private';
    /** Description/documentation */
    description?: string;
}
export interface AcceleoModuleOptions {
    /** Module name (e.g., "generate") */
    moduleName: string;
    /** Metamodel namespace URI */
    nsURI: string;
    /** Package name for qualified references */
    packageName?: string;
    /** Author name */
    author?: string;
    /** Module description */
    description?: string;
}
/**
 * Generates an Acceleo .mtl module from a list of code templates.
 *
 * @param templates - Array of code templates to convert
 * @param options - Module-level options
 * @returns Complete .mtl file content
 */
export declare function generateAcceleoModule(templates: CodeTemplateInput[], options: AcceleoModuleOptions): string;
/**
 * Generates a standalone Acceleo .mtl for a single template.
 * Useful when each code template maps to its own .mtl file.
 */
export declare function generateAcceleoSingleTemplate(template: CodeTemplateInput, options: AcceleoModuleOptions): string;
//# sourceMappingURL=AcceleoMtlGenerator.d.ts.map