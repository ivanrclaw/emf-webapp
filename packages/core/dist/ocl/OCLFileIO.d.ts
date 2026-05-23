/**
 * OCLFileIO — Import/Export of standalone .ocl files (Complete OCL format).
 *
 * Supports parsing and generating Eclipse-compatible .ocl files with
 * package declarations, context blocks, and constraint definitions.
 */
export interface OCLFileImportResult {
    constraints: ImportedConstraint[];
    errors: ImportError[];
    packages: string[];
}
export interface ImportedConstraint {
    name: string;
    context: string;
    kind: 'inv' | 'pre' | 'post' | 'def' | 'init' | 'derive' | 'body';
    expression: string;
    /** Original line number in the .ocl file */
    sourceLine: number;
}
export interface ImportError {
    line: number;
    message: string;
}
export interface ExportableConstraint {
    name: string;
    context: string;
    kind: 'inv' | 'pre' | 'post' | 'def' | 'init' | 'derive' | 'body';
    expression: string;
}
export interface ExportOptions {
    /** Group constraints by package */
    packageName?: string;
    /** Add header comment */
    header?: string;
    /** Indent style */
    indent?: string;
}
/** Parse a .ocl file string into structured constraints */
export declare function importOCLFile(content: string): OCLFileImportResult;
/** Export constraints to a .ocl file string */
export declare function exportOCLFile(constraints: ExportableConstraint[], options?: ExportOptions): string;
//# sourceMappingURL=OCLFileIO.d.ts.map