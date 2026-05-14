/**
 * @emf-webapp/core — MTL Parser
 *
 * Parses Acceleo/MTL-like template syntax into an AST.
 *
 * MTL syntax supported:
 *   [module('nsURI')/]                    — module declaration
 *   [template public name(param : Type)]  — template definition
 *   [/template]                           — end template
 *   [comment @main/]                      — marks template as main
 *   [file('name', false, 'UTF-8')]        — file output block
 *   [/file]                               — end file
 *   [obj.attribute/]                      — expression output
 *   [for (iter : Type | collection)]      — for loop
 *   [/for]                                — end for
 *   [if (condition)]                      — conditional
 *   [else]                                — else branch
 *   [/if]                                 — end if
 *   [protected id('area')]                — protected area
 *   [/protected]                          — end protected
 *   [comment text /]                      — comment
 *   Plain text outside brackets           — literal output
 */
import type { MTLNode } from './MTLTypes.js';
export declare class MTLParser {
    /**
     * Parse an MTL template string into an array of MTL nodes.
     * If the template contains a module declaration, the result will
     * contain a single MTLModule node wrapping all templates.
     */
    static parse(template: string): MTLNode[];
    private tokens;
    private pos;
    private constructor();
    private peek;
    private consume;
    private parseTopLevel;
    private parseTemplateList;
    private parseTemplate;
    /**
     * Parse nodes until one of endTags is encountered.
     * Returns the array of parsed nodes.
     */
    private parseNodes;
    /**
     * Parse a bracket token into a structured tag.
     */
    private parseTag;
}
//# sourceMappingURL=MTLParser.d.ts.map