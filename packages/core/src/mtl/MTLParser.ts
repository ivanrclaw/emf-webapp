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

import type {
  MTLNode,
  MTLModule,
  MTLTemplate,
  MTLQuery,
  MTLFile,
  MTLText,
  MTLExpression,
  MTLFor,
  MTLIf,
  MTLElseIf,
  MTLLet,
  MTLProtectedArea,
  MTLComment,
  MTLTrace,
  MTLParam,
  Visibility,
} from './MTLTypes.js';

/* ─── Internal tag types ───────────────────────────────────────────────────── */

const enum TagType {
  Module,
  Import,
  Template,
  Query,
  File,
  For,
  If,
  ElseIf,
  Else,
  Let,
  Trace,
  Protected,
  Comment,
  Expression,
  End,
}

interface ParsedTag {
  type: TagType;
  raw: string;
  // Module
  moduleName?: string;
  nsURIs?: string[];
  // Import
  importPath?: string;
  // Template
  templateName?: string;
  visibility?: Visibility;
  params?: MTLParam[];
  guard?: string;
  overrides?: string;
  post?: string;
  isMain?: boolean;
  // Query
  queryName?: string;
  returnType?: string;
  queryExpression?: string;
  // File
  fileName?: string;
  openMode?: string;
  encoding?: string;
  // For
  iterator?: string;
  iteratedType?: string;
  collection?: string;
  separator?: string;
  before?: string;
  after?: string;
  // If / ElseIf
  condition?: string;
  // Let
  letVar?: string;
  letType?: string;
  letExpression?: string;
  // Trace
  traceExpression?: string;
  // Protected
  protectedId?: string;
  // Comment
  commentText?: string;
  // Expression
  expression?: string;
  // End
  endTag?: string;
}

/* ─── Parser ───────────────────────────────────────────────────────────────── */

export class MTLParser {
  /**
   * Parse an MTL template string into an array of MTL nodes.
   */
  static parse(template: string): MTLNode[] {
    const tokens = MTLParser.tokenize(template);
    const parser = new MTLParser(tokens);
    return parser.parseTopLevel();
  }

  /**
   * Tokenize: split into bracket-delimited tags and plain text.
   * Handles nested brackets in expressions like [c.name.concat('[')]
   */
  private static tokenize(input: string): string[] {
    const tokens: string[] = [];
    let i = 0;
    let textStart = 0;

    while (i < input.length) {
      if (input[i] === '[') {
        // Flush preceding text
        if (i > textStart) {
          tokens.push(input.slice(textStart, i));
        }
        // Find matching close bracket (handle strings inside)
        const start = i;
        i++; // skip opening [
        let depth = 1;
        while (i < input.length && depth > 0) {
          if (input[i] === '\'' || input[i] === '"') {
            // Skip string literal
            const quote = input[i];
            i++;
            while (i < input.length && input[i] !== quote) {
              if (input[i] === '\\') i++; // skip escaped char
              i++;
            }
            if (i < input.length) i++; // skip closing quote
          } else if (input[i] === '[') {
            depth++;
            i++;
          } else if (input[i] === ']') {
            depth--;
            i++;
          } else {
            i++;
          }
        }
        tokens.push(input.slice(start, i));
        textStart = i;
      } else {
        i++;
      }
    }
    // Flush remaining text
    if (textStart < input.length) {
      tokens.push(input.slice(textStart));
    }

    return tokens.filter(t => t.length > 0);
  }

  private tokens: string[];
  private pos: number;

  private constructor(tokens: string[]) {
    this.tokens = tokens;
    this.pos = 0;
  }

  private peek(): string | undefined {
    return this.tokens[this.pos];
  }

  private consume(): string | undefined {
    return this.tokens[this.pos++];
  }

  /* ─── Top-level parsing ────────────────────────────────────────────────── */

  private parseTopLevel(): MTLNode[] {
    const nodes: MTLNode[] = [];
    let moduleNode: MTLModule | null = null;
    const imports: string[] = [];

    while (this.pos < this.tokens.length) {
      const token = this.peek()!;

      if (this.isTag(token)) {
        const tag = this.parseTag(token);
        if (!tag) { this.consume(); continue; }

        switch (tag.type) {
          case TagType.Module: {
            this.consume();
            moduleNode = {
              type: 'module',
              name: tag.moduleName ?? '',
              nsURIs: tag.nsURIs ?? [],
              imports: [],
              templates: [],
              queries: [],
            };
            break;
          }
          case TagType.Import: {
            this.consume();
            imports.push(tag.importPath ?? '');
            break;
          }
          case TagType.Template: {
            const tmpl = this.parseTemplateBlock(tag);
            if (tmpl) {
              if (moduleNode) moduleNode.templates.push(tmpl);
              else nodes.push(tmpl);
            }
            break;
          }
          case TagType.Query: {
            this.consume();
            const query: MTLQuery = {
              type: 'query',
              name: tag.queryName ?? '',
              visibility: tag.visibility ?? 'public',
              params: tag.params ?? [],
              returnType: tag.returnType ?? 'String',
              expression: tag.queryExpression ?? '',
            };
            if (moduleNode) moduleNode.queries.push(query);
            else nodes.push(query);
            break;
          }
          case TagType.Comment: {
            this.consume();
            // Skip encoding comments and @main markers at top level
            break;
          }
          default:
            this.consume();
            break;
        }
      } else {
        // Plain text at top level (usually whitespace between templates)
        this.consume();
      }
    }

    if (moduleNode) {
      moduleNode.imports = imports;
      return [moduleNode];
    }

    return nodes;
  }

  /* ─── Template block ───────────────────────────────────────────────────── */

  private parseTemplateBlock(tag: ParsedTag): MTLTemplate | null {
    this.consume(); // consume opening [template ...] tag

    const body = this.parseBody(['template']);

    // Detect @main in body
    let isMain = tag.isMain ?? false;
    for (const node of body) {
      if (node.type === 'comment' && node.text.trim() === '@main') {
        isMain = true;
      }
    }

    // Filter out @main comments
    const filteredBody = body.filter(
      n => !(n.type === 'comment' && n.text.trim() === '@main'),
    );

    return {
      type: 'template',
      name: tag.templateName ?? '',
      visibility: tag.visibility ?? 'public',
      params: tag.params ?? [],
      guard: tag.guard,
      overrides: tag.overrides,
      post: tag.post,
      isMain,
      body: filteredBody,
    };
  }

  /* ─── Body parsing (recursive) ─────────────────────────────────────────── */

  private parseBody(endTags: string[]): MTLNode[] {
    const nodes: MTLNode[] = [];

    while (this.pos < this.tokens.length) {
      const token = this.peek()!;

      if (!this.isTag(token)) {
        // Plain text
        if (token.length > 0) {
          nodes.push({ type: 'text', value: token });
        }
        this.consume();
        continue;
      }

      const tag = this.parseTag(token);
      if (!tag) { this.consume(); continue; }

      // End tag?
      if (tag.type === TagType.End && tag.endTag && endTags.includes(tag.endTag)) {
        this.consume();
        return nodes;
      }

      // ElseIf / Else signal end of if-then body
      if ((tag.type === TagType.ElseIf || tag.type === TagType.Else) && endTags.includes('if')) {
        return nodes;
      }

      switch (tag.type) {
        case TagType.File: {
          this.consume();
          const fileBody = this.parseBody(['file']);
          nodes.push({
            type: 'file',
            fileName: tag.fileName ?? '',
            openMode: tag.openMode ?? 'overwrite',
            encoding: tag.encoding ?? 'UTF-8',
            body: fileBody,
          } satisfies MTLFile);
          break;
        }
        case TagType.For: {
          this.consume();
          const forBody = this.parseBody(['for']);
          nodes.push({
            type: 'for',
            iterator: tag.iterator ?? '',
            iteratedType: tag.iteratedType ?? '',
            collection: tag.collection ?? '',
            separator: tag.separator,
            before: tag.before,
            after: tag.after,
            body: forBody,
          } satisfies MTLFor);
          break;
        }
        case TagType.If: {
          this.consume();
          const thenBody = this.parseBody(['if']);
          const elseIfClauses: MTLElseIf[] = [];
          let elseBody: MTLNode[] = [];

          // Consume elseif / else chains
          while (this.pos < this.tokens.length) {
            const nextToken = this.peek();
            if (!nextToken) break;
            const nextTag = this.parseTag(nextToken);
            if (!nextTag) break;

            if (nextTag.type === TagType.ElseIf) {
              this.consume();
              const elseIfBody = this.parseBody(['if']);
              elseIfClauses.push({
                condition: nextTag.condition ?? '',
                body: elseIfBody,
              });
            } else if (nextTag.type === TagType.Else) {
              this.consume();
              elseBody = this.parseBody(['if']);
              break;
            } else if (nextTag.type === TagType.End && nextTag.endTag === 'if') {
              this.consume();
              break;
            } else {
              break;
            }
          }

          nodes.push({
            type: 'if',
            condition: tag.condition ?? '',
            thenBody,
            elseIfClauses,
            elseBody,
          } satisfies MTLIf);
          break;
        }
        case TagType.Let: {
          this.consume();
          const letBody = this.parseBody(['let']);
          nodes.push({
            type: 'let',
            variable: tag.letVar ?? '',
            varType: tag.letType,
            expression: tag.letExpression ?? '',
            body: letBody,
          } satisfies MTLLet);
          break;
        }
        case TagType.Trace: {
          this.consume();
          const traceBody = this.parseBody(['trace']);
          nodes.push({
            type: 'trace',
            expression: tag.traceExpression ?? '',
            body: traceBody,
          } satisfies MTLTrace);
          break;
        }
        case TagType.Protected: {
          this.consume();
          const protBody = this.parseBody(['protected']);
          nodes.push({
            type: 'protected',
            id: tag.protectedId ?? '',
            body: protBody,
          } satisfies MTLProtectedArea);
          break;
        }
        case TagType.Template: {
          // Nested template
          const tmpl = this.parseTemplateBlock(tag);
          if (tmpl) nodes.push(tmpl);
          break;
        }
        case TagType.Comment: {
          this.consume();
          nodes.push({
            type: 'comment',
            text: tag.commentText ?? '',
          } satisfies MTLComment);
          break;
        }
        case TagType.Expression: {
          this.consume();
          nodes.push({
            type: 'expression',
            expression: tag.expression ?? '',
          } satisfies MTLExpression);
          break;
        }
        default:
          this.consume();
          break;
      }
    }

    return nodes;
  }

  /* ─── Tag parsing ──────────────────────────────────────────────────────── */

  private isTag(token: string): boolean {
    return token.startsWith('[') && token.endsWith(']');
  }

  private parseTag(token: string): ParsedTag | null {
    if (!this.isTag(token)) return null;

    const inner = token.slice(1, -1).trim();
    if (!inner) return null;

    // ─── Closing tag: [/name] ───────────────────────────────────────────
    if (inner.startsWith('/')) {
      const name = inner.slice(1).trim();
      return { type: TagType.End, raw: token, endTag: name };
    }

    // ─── [else] ─────────────────────────────────────────────────────────
    if (inner === 'else') {
      return { type: TagType.Else, raw: token };
    }

    // ─── [elseif (condition)] ───────────────────────────────────────────
    const elseifMatch = inner.match(/^elseif\s*\(\s*(.+)\s*\)\s*$/);
    if (elseifMatch) {
      return { type: TagType.ElseIf, raw: token, condition: elseifMatch[1].trim() };
    }

    // Self-closing detection
    const isSelfClosing = inner.endsWith('/');
    const content = isSelfClosing ? inner.slice(0, -1).trim() : inner;

    // ─── [comment ...] ──────────────────────────────────────────────────
    if (content.startsWith('comment')) {
      const text = content.slice(7).trim();
      return { type: TagType.Comment, raw: token, commentText: text };
    }

    // ─── [module name('uri1', 'uri2')/] ─────────────────────────────────
    const moduleMatch = content.match(
      /^module\s+(\w+)\s*\(\s*(.+)\s*\)\s*$/,
    );
    if (moduleMatch) {
      const name = moduleMatch[1];
      const uriStr = moduleMatch[2];
      const nsURIs: string[] = [];
      let uriMatch: RegExpExecArray | null;
      const uriRe = /'([^']*)'/g;
      while ((uriMatch = uriRe.exec(uriStr)) !== null) {
        nsURIs.push(uriMatch[1]);
      }
      return { type: TagType.Module, raw: token, moduleName: name, nsURIs };
    }
    // Legacy: [module('uri')/]
    const moduleLegacy = content.match(/^module\s*\(\s*'([^']*)'\s*\)\s*$/);
    if (moduleLegacy) {
      return { type: TagType.Module, raw: token, moduleName: '', nsURIs: [moduleLegacy[1]] };
    }

    // ─── [import path/] ─────────────────────────────────────────────────
    const importMatch = content.match(/^import\s+(.+)$/);
    if (importMatch) {
      return { type: TagType.Import, raw: token, importPath: importMatch[1].trim() };
    }

    // ─── [query visibility name(params) : ReturnType = expr /] ──────────
    const queryMatch = content.match(
      /^query\s+(public|private|protected)\s+(\w+)\s*\(([^)]*)\)\s*:\s*(\w+(?:\.\w+)*)\s*=\s*(.+)$/,
    );
    if (queryMatch) {
      return {
        type: TagType.Query,
        raw: token,
        visibility: queryMatch[1] as Visibility,
        queryName: queryMatch[2],
        params: this.parseParams(queryMatch[3]),
        returnType: queryMatch[4],
        queryExpression: queryMatch[5].trim(),
      };
    }

    // ─── [template visibility name(params) ? (guard) overrides X post(Y)] ─
    const templateMatch = content.match(
      /^template\s+(public|private|protected)\s+(\w+)\s*\(([^)]*)\)\s*(.*)$/,
    );
    if (templateMatch) {
      const visibility = templateMatch[1] as Visibility;
      const name = templateMatch[2];
      const params = this.parseParams(templateMatch[3]);
      const rest = templateMatch[4].trim();

      let guard: string | undefined;
      let overrides: string | undefined;
      let post: string | undefined;

      // Parse optional clauses from rest
      const guardMatch = rest.match(/\?\s*\((.+?)\)/);
      if (guardMatch) guard = guardMatch[1].trim();

      const overridesMatch = rest.match(/overrides\s+(\w+)/);
      if (overridesMatch) overrides = overridesMatch[1];

      const postMatch = rest.match(/post\s*\((.+?)\)/);
      if (postMatch) post = postMatch[1].trim();

      return {
        type: TagType.Template,
        raw: token,
        templateName: name,
        visibility,
        params,
        guard,
        overrides,
        post,
      };
    }

    // ─── [file (expression, mode, 'encoding')] ──────────────────────────
    const fileMatch = content.match(
      /^file\s*\(\s*(.+?)\s*,\s*(\w+)\s*,\s*'([^']*)'\s*\)\s*$/,
    );
    if (fileMatch) {
      let fileName = fileMatch[1].trim();
      // Strip surrounding quotes if literal
      if ((fileName.startsWith("'") && fileName.endsWith("'")) ||
          (fileName.startsWith('"') && fileName.endsWith('"'))) {
        fileName = fileName.slice(1, -1);
      }
      return {
        type: TagType.File,
        raw: token,
        fileName,
        openMode: fileMatch[2],
        encoding: fileMatch[3],
      };
    }

    // ─── [for (iter : Type | collection) separator(...) before(...) after(...)] ─
    const forMatch = content.match(
      /^for\s*\(\s*(\w+)\s*(?::\s*(\w+(?:\.\w+)*))?\s*\|\s*(.+?)\s*\)\s*(.*)$/,
    );
    if (forMatch) {
      const rest = forMatch[4].trim();
      let separator: string | undefined;
      let before: string | undefined;
      let after: string | undefined;

      const sepMatch = rest.match(/separator\s*\(\s*(.+?)\s*\)/);
      if (sepMatch) separator = sepMatch[1].trim();

      const beforeMatch = rest.match(/before\s*\(\s*(.+?)\s*\)/);
      if (beforeMatch) before = beforeMatch[1].trim();

      const afterMatch = rest.match(/after\s*\(\s*(.+?)\s*\)/);
      if (afterMatch) after = afterMatch[1].trim();

      return {
        type: TagType.For,
        raw: token,
        iterator: forMatch[1],
        iteratedType: forMatch[2] ?? '',
        collection: forMatch[3].trim(),
        separator,
        before,
        after,
      };
    }

    // ─── [if (condition)] ───────────────────────────────────────────────
    const ifMatch = content.match(/^if\s*\(\s*(.+)\s*\)\s*$/);
    if (ifMatch) {
      return { type: TagType.If, raw: token, condition: ifMatch[1].trim() };
    }

    // ─── [let var : Type = expression] ──────────────────────────────────
    const letMatch = content.match(
      /^let\s+(\w+)\s*(?::\s*(\w+(?:\.\w+)*))?\s*=\s*(.+)$/,
    );
    if (letMatch) {
      return {
        type: TagType.Let,
        raw: token,
        letVar: letMatch[1],
        letType: letMatch[2],
        letExpression: letMatch[3].trim(),
      };
    }

    // ─── [trace (expression)] ───────────────────────────────────────────
    const traceMatch = content.match(/^trace\s*\(\s*(.+)\s*\)\s*$/);
    if (traceMatch) {
      return { type: TagType.Trace, raw: token, traceExpression: traceMatch[1].trim() };
    }

    // ─── [protected ('id')] ─────────────────────────────────────────────
    const protMatch = content.match(/^protected\s*\(\s*'([^']*)'\s*\)\s*$/);
    if (protMatch) {
      return { type: TagType.Protected, raw: token, protectedId: protMatch[1] };
    }
    // Legacy: [protected id('area')]
    const protLegacy = content.match(/^protected\s+id\s*\(\s*'([^']*)'\s*\)\s*$/);
    if (protLegacy) {
      return { type: TagType.Protected, raw: token, protectedId: protLegacy[1] };
    }

    // ─── Expression (fallback for self-closing tags) ────────────────────
    if (isSelfClosing && content.length > 0) {
      return { type: TagType.Expression, raw: token, expression: content };
    }

    // Non-self-closing expression-like content (rare but possible)
    if (content.match(/^[a-zA-Z_][\w.]*(?:\s*\(.*\))?(?:\s*->.*)?$/)) {
      return { type: TagType.Expression, raw: token, expression: content };
    }

    // Unknown — treat as expression if it has content
    if (content.length > 0) {
      return { type: TagType.Expression, raw: token, expression: content };
    }

    return null;
  }

  /* ─── Helpers ──────────────────────────────────────────────────────────── */

  private parseParams(paramStr: string): MTLParam[] {
    if (!paramStr.trim()) return [];
    return paramStr.split(',').map(p => {
      const parts = p.trim().split(/\s*:\s*/);
      return {
        name: parts[0]?.trim() ?? '',
        type: parts[1]?.trim() ?? 'OclAny',
      };
    });
  }
}
