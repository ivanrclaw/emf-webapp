/**
 * @emf-webapp/core — MTL Parser (Full Acceleo-compatible)
 *
 * Parses Acceleo/MTL template syntax into an AST.
 *
 * Supported syntax:
 *   [comment encoding = UTF-8 /]
 *   [module name('nsURI1', 'nsURI2')/]
 *   [import qualified::module::name/]
 *   [query public name(p1 : T1, p2 : T2) : ReturnType = expression /]
 *   [template public name(p : Type) ? (guard)]...[/template]
 *   [template public name(p : Type) overrides other]...[/template]
 *   [template public name(p : Type) post(expr)]...[/template]
 *   [file (expression, openMode, 'encoding')]...[/file]
 *   [for (iter : Type | collection) separator(', ') before('(') after(')')]...[/for]
 *   [if (condition)]...[elseif (cond)]...[else]...[/if]
 *   [let x : Type = expression]...[/let]
 *   [trace (expression)]...[/trace]
 *   [protected ('id')]...[/protected]
 *   [expression/]  — inline output (full OCL expressions)
 *   Plain text outside brackets — literal output
 */
import type { MTLNode } from './MTLTypes.js';
export declare class MTLParser {
    /**
     * Parse an MTL template string into an array of MTL nodes.
     */
    static parse(template: string): MTLNode[];
    /**
     * Tokenize: split into bracket-delimited tags and plain text.
     * Handles nested brackets in expressions like [c.name.concat('[')]
     */
    private static tokenize;
    private tokens;
    private pos;
    private constructor();
    private peek;
    private consume;
    private parseTopLevel;
    private parseTemplateBlock;
    private parseBody;
    private isTag;
    private parseTag;
    private parseParams;
}
//# sourceMappingURL=MTLParser.d.ts.map