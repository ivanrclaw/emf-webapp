/**
 * @emf-webapp/core — CompleteOCLParser
 *
 * Parses Eclipse Complete OCL (.ocl) files into structured constraint objects.
 * Handles the standard Complete OCL format including imports, packages,
 * context declarations, invariants, and annotations.
 *
 * Format reference: Eclipse OCL Complete OCL specification
 * https://wiki.eclipse.org/OCL/CompleteOCL
 */
import type { OCLConstraintInput } from './CompleteOCLExporter.js';
export interface CompleteOCLParseResult {
    /** Package name extracted from the package declaration */
    packageName: string;
    /** List of imported namespace URIs */
    imports: string[];
    /** Parsed constraint definitions */
    constraints: OCLConstraintInput[];
}
/**
 * Parses a Complete OCL text into structured constraint objects.
 *
 * Handles:
 * - import declarations (import 'nsURI')
 * - package/endpackage blocks
 * - context declarations
 * - inv constraints with name and expression (single and multi-line)
 * - -- @severity: annotations
 * - -- @message: annotations
 * - Comments (-- line comments)
 * - Nested expressions with parentheses, let/in, if/then/else/endif
 */
export declare function parseCompleteOCL(oclText: string): CompleteOCLParseResult;
//# sourceMappingURL=CompleteOCLParser.d.ts.map