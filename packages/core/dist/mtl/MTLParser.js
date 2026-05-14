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
/**
 * Tag types used internally during parsing.
 */
var TagType;
(function (TagType) {
    TagType[TagType["Module"] = 0] = "Module";
    TagType[TagType["Template"] = 1] = "Template";
    TagType[TagType["File"] = 2] = "File";
    TagType[TagType["For"] = 3] = "For";
    TagType[TagType["If"] = 4] = "If";
    TagType[TagType["Else"] = 5] = "Else";
    TagType[TagType["Protected"] = 6] = "Protected";
    TagType[TagType["Comment"] = 7] = "Comment";
    TagType[TagType["Expression"] = 8] = "Expression";
    TagType[TagType["End"] = 9] = "End";
})(TagType || (TagType = {}));
export class MTLParser {
    /**
     * Parse an MTL template string into an array of MTL nodes.
     * If the template contains a module declaration, the result will
     * contain a single MTLModule node wrapping all templates.
     */
    static parse(template) {
        const tokens = template.split(/(\[[^\]]*\])/).filter(t => t.length > 0);
        const parser = new MTLParser(tokens);
        return parser.parseTopLevel();
    }
    tokens;
    pos;
    constructor(tokens) {
        this.tokens = tokens;
        this.pos = 0;
    }
    peek() {
        return this.tokens[this.pos];
    }
    consume() {
        return this.tokens[this.pos++];
    }
    parseTopLevel() {
        const nodes = [];
        let moduleNode = null;
        while (this.pos < this.tokens.length) {
            const token = this.peek();
            if (token.startsWith('[') && token.endsWith(']')) {
                const tag = this.parseTag(token);
                if (!tag) {
                    this.consume();
                    continue;
                }
                switch (tag.type) {
                    case TagType.Module: {
                        this.consume();
                        const templates = this.parseTemplateList();
                        moduleNode = {
                            type: 'module',
                            nsURI: tag.moduleNsUri ?? '',
                            templates,
                        };
                        break;
                    }
                    case TagType.Template: {
                        const tmpl = this.parseTemplate(token);
                        if (tmpl)
                            nodes.push(tmpl);
                        break;
                    }
                    default:
                        this.consume();
                        break;
                }
            }
            else {
                // Plain text
                if (token.length > 0) {
                    nodes.push({ type: 'text', value: token });
                }
                this.consume();
            }
        }
        if (moduleNode) {
            // Merge standalone templates into module
            for (const node of nodes) {
                if (node.type === 'template') {
                    moduleNode.templates.push(node);
                }
            }
            return [moduleNode];
        }
        return nodes;
    }
    parseTemplateList() {
        const templates = [];
        while (this.pos < this.tokens.length) {
            const token = this.peek();
            if (token.startsWith('[') && token.endsWith(']')) {
                const tag = this.parseTag(token);
                if (tag?.type === TagType.Template) {
                    const tmpl = this.parseTemplate(token);
                    if (tmpl)
                        templates.push(tmpl);
                    continue;
                }
            }
            break;
        }
        return templates;
    }
    parseTemplate(openToken) {
        this.pos = this.tokens.indexOf(openToken, this.pos);
        if (this.pos === -1)
            return null;
        const tag = this.parseTag(openToken);
        if (!tag || tag.type !== TagType.Template)
            return null;
        this.consume(); // consume the opening tag
        const body = this.parseNodes(['template']);
        const templates = body.filter(n => n.type === 'template');
        // Find @main comment in body
        let isMain = false;
        for (const node of body) {
            if (node.type === 'comment' && node.text.trim() === '@main') {
                isMain = true;
            }
        }
        // Filter out @main comment and nested templates from body
        const filteredBody = body.filter(n => !(n.type === 'comment' && n.text.trim() === '@main') && n.type !== 'template');
        return {
            type: 'template',
            name: tag.templateName ?? '',
            paramName: tag.paramName ?? '',
            paramType: tag.paramType ?? '',
            isMain,
            body: filteredBody,
        };
    }
    /**
     * Parse nodes until one of endTags is encountered.
     * Returns the array of parsed nodes.
     */
    parseNodes(endTags = []) {
        const nodes = [];
        while (this.pos < this.tokens.length) {
            const token = this.peek();
            if (!token.startsWith('[') || !token.endsWith(']')) {
                // Plain text
                if (token.length > 0) {
                    nodes.push({ type: 'text', value: token });
                }
                this.consume();
                continue;
            }
            // It's a bracket token — parse tag
            const tag = this.parseTag(token);
            if (!tag) {
                this.consume();
                continue;
            }
            // Check for end tags
            if (tag.type === TagType.End && tag.endTag && endTags.includes(tag.endTag)) {
                this.consume();
                return nodes;
            }
            // Check for else (signals end of if-then)
            if (tag.type === TagType.Else && endTags.includes('if')) {
                return nodes;
            }
            // Process the tag
            switch (tag.type) {
                case TagType.File: {
                    this.consume();
                    const fileBody = this.parseNodes(['file']);
                    nodes.push({
                        type: 'file',
                        fileName: tag.fileName ?? '',
                        openMode: tag.openMode ?? 'false',
                        encoding: tag.encoding ?? 'UTF-8',
                        body: fileBody,
                    });
                    break;
                }
                case TagType.For: {
                    this.consume();
                    const forBody = this.parseNodes(['for']);
                    nodes.push({
                        type: 'for',
                        iterator: tag.iterator ?? '',
                        iteratedType: tag.iteratedType ?? '',
                        collection: tag.collection ?? '',
                        body: forBody,
                    });
                    break;
                }
                case TagType.If: {
                    this.consume();
                    const thenBody = this.parseNodes(['if']);
                    let elseBody = [];
                    // Check if next token is [else]
                    const nextToken = this.peek();
                    if (nextToken) {
                        const nextTag = this.parseTag(nextToken);
                        if (nextTag?.type === TagType.Else) {
                            this.consume(); // consume [else]
                            elseBody = this.parseNodes(['if']);
                        }
                    }
                    nodes.push({
                        type: 'if',
                        condition: tag.condition ?? '',
                        thenBody,
                        elseBody,
                    });
                    break;
                }
                case TagType.Protected: {
                    this.consume();
                    const protBody = this.parseNodes(['protected']);
                    nodes.push({
                        type: 'protected',
                        id: tag.protectedId ?? '',
                        body: protBody,
                    });
                    break;
                }
                case TagType.Comment: {
                    this.consume();
                    nodes.push({
                        type: 'comment',
                        text: tag.commentText ?? '',
                    });
                    break;
                }
                case TagType.Expression: {
                    this.consume();
                    nodes.push({
                        type: 'expression',
                        expression: tag.expression ?? '',
                    });
                    break;
                }
                case TagType.Template: {
                    // Nested template — parse it and add to nodes
                    const tmpl = this.parseTemplate(token);
                    if (tmpl)
                        nodes.push(tmpl);
                    break;
                }
                default:
                    this.consume();
                    break;
            }
        }
        return nodes;
    }
    /**
     * Parse a bracket token into a structured tag.
     */
    parseTag(token) {
        if (!token.startsWith('[') || !token.endsWith(']'))
            return null;
        const inner = token.slice(1, -1).trim();
        if (!inner)
            return null;
        // Closing tag: [/name]
        if (inner.startsWith('/')) {
            const name = inner.slice(1).trim();
            return { type: TagType.End, raw: token, endTag: name };
        }
        // [else]
        if (inner === 'else') {
            return { type: TagType.Else, raw: token };
        }
        // Self-closing: ends with /
        const isSelfClosing = inner.endsWith('/');
        const content = isSelfClosing ? inner.slice(0, -1).trim() : inner;
        // [module('nsURI')/]
        const moduleMatch = content.match(/^module\s*\(\s*'([^']*)'\s*\)\s*$/);
        if (moduleMatch) {
            return { type: TagType.Module, raw: token, moduleNsUri: moduleMatch[1] };
        }
        // [comment text /]  or  [comment @main/]
        const commentMatch = content.match(/^comment\s+(.+)$/);
        if (commentMatch) {
            return { type: TagType.Comment, raw: token, commentText: commentMatch[1].trim() };
        }
        // [template public name(param : Type)]
        const templateMatch = content.match(/^template\s+public\s+(\w+)\s*\(\s*(\w+)\s*:\s*(\w+(?:\.\w+)*)\s*\)\s*$/);
        if (templateMatch) {
            return {
                type: TagType.Template,
                raw: token,
                templateName: templateMatch[1],
                paramName: templateMatch[2],
                paramType: templateMatch[3],
            };
        }
        // [file('name', openMode, 'encoding')]
        const fileMatch = content.match(/^file\s*\(\s*'([^']*)'\s*,\s*(\w+)\s*,\s*'([^']*)'\s*\)\s*$/);
        if (fileMatch) {
            return {
                type: TagType.File,
                raw: token,
                fileName: fileMatch[1],
                openMode: fileMatch[2],
                encoding: fileMatch[3],
            };
        }
        // [for (iter : Type | collection)]
        const forMatch = content.match(/^for\s*\(\s*(\w+)\s*:\s*(\w+(?:\.\w+)*)\s*\|\s*(.+)\s*\)\s*$/);
        if (forMatch) {
            return {
                type: TagType.For,
                raw: token,
                iterator: forMatch[1],
                iteratedType: forMatch[2],
                collection: forMatch[3].trim(),
            };
        }
        // [if (condition)]
        const ifMatch = content.match(/^if\s*\(\s*(.+)\s*\)\s*$/);
        if (ifMatch) {
            return { type: TagType.If, raw: token, condition: ifMatch[1] };
        }
        // [protected id('area')]
        const protectedMatch = content.match(/^protected\s+id\s*\(\s*'([^']*)'\s*\)\s*$/);
        if (protectedMatch) {
            return { type: TagType.Protected, raw: token, protectedId: protectedMatch[1] };
        }
        // Fallback: expression (must be self-closing with /, or just a path expression)
        // Pattern: path-like expression ending with / (or without / for simplicity)
        if (isSelfClosing || content.match(/^[a-zA-Z_]\w*(?:\.[a-zA-Z_]\w*)*$/)) {
            return { type: TagType.Expression, raw: token, expression: content };
        }
        // Unknown tag — return expression if it looks like one
        if (content.match(/^[a-zA-Z_][\w.]*$/)) {
            return { type: TagType.Expression, raw: token, expression: content };
        }
        return null;
    }
}
//# sourceMappingURL=MTLParser.js.map