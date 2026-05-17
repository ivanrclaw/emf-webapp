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

export interface MTLExecutionResult {
  output: string;
  files: Array<{ name: string; content: string }>;
  error?: string;
}
