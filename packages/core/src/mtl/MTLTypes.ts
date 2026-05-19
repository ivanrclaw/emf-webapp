/**
 * @emf-webapp/core — MTL Types (Full Acceleo-compatible AST)
 *
 * Complete AST node types for the Acceleo/MTL template language.
 * Supports: module, import, template (with guards, visibility, overrides,
 * multi-params), query, for (with separator/before/after), if/elseif/else,
 * let, file (dynamic names), protected areas, expressions with full OCL.
 */

// ─── Top-level ────────────────────────────────────────────────────────────────

export type MTLNode =
  | MTLModule
  | MTLTemplate
  | MTLQuery
  | MTLFile
  | MTLText
  | MTLExpression
  | MTLFor
  | MTLIf
  | MTLLet
  | MTLProtectedArea
  | MTLComment
  | MTLTrace;

export type Visibility = 'public' | 'private' | 'protected';

export interface MTLParam {
  name: string;
  type: string;
}

export interface MTLModule {
  type: 'module';
  name: string;
  extends?: string;
  nsURIs: string[];
  imports: string[];
  templates: MTLTemplate[];
  queries: MTLQuery[];
}

export interface MTLTemplate {
  type: 'template';
  name: string;
  visibility: Visibility;
  params: MTLParam[];
  /** Guard expression — template only applies when guard is true */
  guard?: string;
  /** Template this one overrides */
  overrides?: string;
  /** Post-condition expression */
  post?: string;
  isMain: boolean;
  body: MTLNode[];
}

export interface MTLQuery {
  type: 'query';
  name: string;
  visibility: Visibility;
  params: MTLParam[];
  returnType: string;
  expression: string;
}

// ─── Block nodes ──────────────────────────────────────────────────────────────

export interface MTLFile {
  type: 'file';
  fileName: string;    // expression (can be dynamic)
  openMode: string;    // 'overwrite' | 'append' | 'false' | 'true'
  encoding: string;
  body: MTLNode[];
}

export interface MTLFor {
  type: 'for';
  iterator: string;
  iteratedType: string;
  collection: string;
  separator?: string;  // expression for separator between iterations
  before?: string;     // expression output before first iteration
  after?: string;      // expression output after last iteration
  body: MTLNode[];
}

export interface MTLIf {
  type: 'if';
  condition: string;
  thenBody: MTLNode[];
  elseIfClauses: MTLElseIf[];
  elseBody: MTLNode[];
}

export interface MTLElseIf {
  condition: string;
  body: MTLNode[];
}

export interface MTLLet {
  type: 'let';
  variable: string;
  varType?: string;
  expression: string;
  body: MTLNode[];
}

export interface MTLProtectedArea {
  type: 'protected';
  id: string;
  body: MTLNode[];
}

// ─── Leaf nodes ───────────────────────────────────────────────────────────────

export interface MTLText {
  type: 'text';
  value: string;
}

export interface MTLExpression {
  type: 'expression';
  expression: string;  // Full OCL expression: 'aClass.name.toUpperFirst()'
}

export interface MTLComment {
  type: 'comment';
  text: string;
}

export interface MTLTrace {
  type: 'trace';
  expression: string;
  body: MTLNode[];
}

// ─── Execution result ─────────────────────────────────────────────────────────

export interface ExecutionLogEntry {
  type: 'template-start' | 'template-end' | 'query-call' | 'file-write' | 'error' | 'warning' | 'info';
  timestamp: number; // ms since execution start
  templateName?: string;
  moduleName?: string;
  /** Line in the source template file */
  sourceLine?: number;
  /** Arguments passed (serialized) */
  args?: string;
  /** Duration in ms (for template-end) */
  duration?: number;
  /** Output produced by this template call */
  outputLength?: number;
  /** File name (for file-write) */
  fileName?: string;
  /** Message (for error/warning/info) */
  message?: string;
}

export interface TraceEntry {
  /** Range in the generated output: [startOffset, endOffset) */
  outputStart: number;
  outputEnd: number;
  /** Source template info */
  templateName: string;
  moduleName: string;
  sourceLine: number;
  /** Model element that produced this output */
  modelElementType?: string;
  modelElementName?: string;
}

export interface MTLExecutionResult {
  output: string;
  files: Array<{ name: string; content: string; encoding?: string; skipped?: boolean }>;
  /** Files that existed in previous output but are no longer generated */
  lostFiles?: string[];
  /** Generation statistics */
  stats?: { generated: number; skipped: number; lost: number };
  error?: string;
  /** Execution log for the console panel */
  log?: ExecutionLogEntry[];
  /** Traceability: maps output regions to source templates */
  traces?: TraceEntry[];
  /** Total execution time in ms */
  executionTime?: number;
}
