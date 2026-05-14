/**
 * @emf-webapp/core — MTL Types
 *
 * AST node types for Acceleo/MTL-like template language.
 */

export type MTLNode =
  | MTLModule
  | MTLTemplate
  | MTLFile
  | MTLText
  | MTLExpression
  | MTLFor
  | MTLIf
  | MTLProtectedArea
  | MTLComment;

export interface MTLModule {
  type: 'module';
  nsURI: string;
  templates: MTLTemplate[];
}

export interface MTLTemplate {
  type: 'template';
  name: string;
  paramName: string;
  paramType: string;
  isMain: boolean;
  body: MTLNode[];
}

export interface MTLFile {
  type: 'file';
  fileName: string;    // expression like 'output.html'
  openMode: string;    // 'false' for overwrite
  encoding: string;
  body: MTLNode[];
}

export interface MTLText {
  type: 'text';
  value: string;
}

export interface MTLExpression {
  type: 'expression';
  expression: string;  // e.g., 'aRoot.name' or 'aRoot.children'
}

export interface MTLFor {
  type: 'for';
  iterator: string;
  iteratedType: string;
  collection: string;
  body: MTLNode[];
}

export interface MTLIf {
  type: 'if';
  condition: string;
  thenBody: MTLNode[];
  elseBody: MTLNode[];
}

export interface MTLProtectedArea {
  type: 'protected';
  id: string;
  body: MTLNode[];
}

export interface MTLComment {
  type: 'comment';
  text: string;
}
