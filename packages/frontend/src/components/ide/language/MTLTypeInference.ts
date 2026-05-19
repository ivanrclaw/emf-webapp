/**
 * MTLTypeInference — Determines the type of variables and expressions
 * in an MTL template based on cursor position and template structure.
 * Uses regex-based parsing for speed (runs on every keystroke).
 */

import { MetamodelSchemaProvider } from './MetamodelSchemaProvider';

export interface TypeInfo {
  typeName: string;
  isCollection: boolean;
}

export interface ScopeVariable {
  name: string;
  type: TypeInfo;
  source: 'param' | 'for' | 'let' | 'self';
}

export type CompletionTrigger = 'dot' | 'arrow' | 'type_position' | 'keyword_position' | 'general' | 'import';

export interface CompletionContext {
  trigger: CompletionTrigger;
  expressionPrefix?: string;
  resolvedType?: TypeInfo;
  variablesInScope: ScopeVariable[];
}

// Regex patterns for scope analysis
const TEMPLATE_PARAM_RE = /\[template\s+(?:public|private|protected)\s+\w+\(([^)]+)\)/g;
const FOR_RE = /\[for\s*\(\s*(\w+)\s*:\s*(\w+)\s*\|/g;
const LET_RE = /\[let\s+(\w+)\s*:\s*(\w+)\s*=/g;
const END_FOR_RE = /\[\/for\]/g;
const END_LET_RE = /\[\/let\]/g;
const END_TEMPLATE_RE = /\[\/template\]/g;

/** Built-in string operations that return specific types */
const STRING_METHODS: Record<string, string> = {
  toUpper: 'EString',
  toLower: 'EString',
  toUpperFirst: 'EString',
  toLowerFirst: 'EString',
  trim: 'EString',
  size: 'EInt',
  substring: 'EString',
  startsWith: 'EBoolean',
  endsWith: 'EBoolean',
  contains: 'EBoolean',
  replaceAll: 'EString',
  concat: 'EString',
  indexOf: 'EInt',
  matches: 'EBoolean',
  tokenize: 'EString', // returns Collection actually, but simplified
  charAt: 'EString',
  toInteger: 'EInt',
  toReal: 'EFloat',
  toBoolean: 'EBoolean',
  isAlpha: 'EBoolean',
  isAlphaNum: 'EBoolean',
  equalsIgnoreCase: 'EBoolean',
  substituteAll: 'EString',
  prefix: 'EString',
  suffix: 'EString',
  lastIndexOf: 'EInt',
  split: 'EString',
};

/** Built-in numeric operations */
const NUMERIC_METHODS: Record<string, string> = {
  abs: 'EInt',
  floor: 'EInt',
  round: 'EInt',
  toString: 'EString',
  div: 'EInt',
  mod: 'EInt',
  max: 'EInt',
  min: 'EInt',
  toInteger: 'EInt',
  toReal: 'EFloat',
};

/** Built-in boolean operations */
const BOOLEAN_METHODS: Record<string, string> = {
  toString: 'EString',
  implies: 'EBoolean',
  xor: 'EBoolean',
};

/** Collection operations that return a specific type */
const COLLECTION_OPS_RETURNING_COLLECTION = new Set([
  'select',
  'reject',
  'sortedBy',
  'closure',
  'asSet',
  'asSequence',
  'flatten',
  'append',
  'prepend',
  'union',
  'intersection',
  'including',
  'excluding',
  'asBag',
  'asOrderedSet',
  'product',
  'subSequence',
  'subOrderedSet',
  'insertAt',
  'reverse',
]);

const COLLECTION_OPS_RETURNING_ELEMENT = new Set(['first', 'last', 'at', 'any']);

const COLLECTION_OPS_RETURNING_INT = new Set(['size', 'sum', 'count', 'indexOf']);

const COLLECTION_OPS_RETURNING_BOOLEAN = new Set([
  'isEmpty',
  'notEmpty',
  'includes',
  'excludes',
  'forAll',
  'exists',
  'one',
  'isUnique',
  'includesAll',
  'excludesAll',
]);

const PRIMITIVE_TYPES = new Set(['EString', 'EInt', 'EBoolean', 'EFloat', 'EDouble', 'EDate', 'String', 'Integer', 'Boolean', 'Real']);

/** Universal/OCL operations available on all types */
const UNIVERSAL_TYPE_OPS: Record<string, string> = {
  oclIsUndefined: 'EBoolean',
  oclIsInvalid: 'EBoolean',
  oclType: 'EString',
  allInstances: 'EObject',
  oclIsKindOf: 'EBoolean',
  oclIsTypeOf: 'EBoolean',
  oclAsType: 'EObject',
  toString: 'EString',
};

/** EMF navigation operations available on any EObject */
const EMF_NAVIGATION_OPS: Record<string, string> = {
  eContainer: 'EObject',
  eContainingFeature: 'EString',
  eContents: 'EObject',
  eAllContents: 'EObject',
  ancestors: 'EObject',
  siblings: 'EObject',
};

function isStringType(t: string): boolean {
  return t === 'EString' || t === 'String';
}

function isNumericType(t: string): boolean {
  return t === 'EInt' || t === 'EFloat' || t === 'EDouble' || t === 'Integer' || t === 'Real';
}

export class MTLTypeInference {
  /**
   * Get all variables in scope at the given line/column.
   * Scans backwards from cursor to find enclosing template/for/let blocks.
   */
  getVariablesInScope(text: string, line: number, _col: number): ScopeVariable[] {
    const lines = text.split('\n');
    // Get text up to cursor position
    const textUpToCursor = lines.slice(0, line).join('\n');
    const variables: ScopeVariable[] = [];

    // Track block nesting to determine what's still in scope
    // We scan forward through the text up to cursor, tracking opens/closes
    let templateParams: ScopeVariable[] = [];
    let forStack: ScopeVariable[] = [];
    let letStack: ScopeVariable[] = [];

    // Find the enclosing template
    let lastTemplateMatch: RegExpExecArray | null = null;
    const templateRe = new RegExp(TEMPLATE_PARAM_RE.source, 'g');
    const endTemplateRe = new RegExp(END_TEMPLATE_RE.source, 'g');

    let match: RegExpExecArray | null;
    const templateStarts: Array<{ index: number; params: string }> = [];
    const templateEnds: number[] = [];

    while ((match = templateRe.exec(textUpToCursor)) !== null) {
      templateStarts.push({ index: match.index, params: match[1] });
    }
    while ((match = endTemplateRe.exec(textUpToCursor)) !== null) {
      templateEnds.push(match.index);
    }

    // Find the innermost unclosed template
    let openTemplates = 0;
    const allEvents: Array<{ index: number; type: 'open' | 'close'; params?: string }> = [];
    for (const ts of templateStarts) {
      allEvents.push({ index: ts.index, type: 'open', params: ts.params });
    }
    for (const te of templateEnds) {
      allEvents.push({ index: te, type: 'close' });
    }
    allEvents.sort((a, b) => a.index - b.index);

    for (const evt of allEvents) {
      if (evt.type === 'open') {
        openTemplates++;
        lastTemplateMatch = null;
        // Store params for the current open template
        templateParams = [];
        if (evt.params) {
          lastTemplateMatch = { index: evt.index, params: evt.params } as unknown as RegExpExecArray;
          const params = evt.params.split(',');
          for (const p of params) {
            const parts = p.trim().split(/\s*:\s*/);
            if (parts.length === 2) {
              templateParams.push({
                name: parts[0].trim(),
                type: { typeName: parts[1].trim(), isCollection: false },
                source: 'param',
              });
            }
          }
        }
        // Reset for/let stacks for new template
        forStack = [];
        letStack = [];
      } else {
        openTemplates--;
        if (openTemplates <= 0) {
          templateParams = [];
          forStack = [];
          letStack = [];
        }
      }
    }

    // Add template params to variables
    variables.push(...templateParams);

    // Add 'self' as alias for first template param type
    if (templateParams.length > 0) {
      variables.push({
        name: 'self',
        type: templateParams[0].type,
        source: 'self',
      });
    }

    // Now scan for for/let blocks within the current template scope
    const forRe = new RegExp(FOR_RE.source, 'g');
    const letRe = new RegExp(LET_RE.source, 'g');
    const endForRe = new RegExp(END_FOR_RE.source, 'g');
    const endLetRe = new RegExp(END_LET_RE.source, 'g');

    interface BlockEvent {
      index: number;
      type: 'for_open' | 'for_close' | 'let_open' | 'let_close';
      name?: string;
      varType?: string;
    }

    const blockEvents: BlockEvent[] = [];

    while ((match = forRe.exec(textUpToCursor)) !== null) {
      blockEvents.push({ index: match.index, type: 'for_open', name: match[1], varType: match[2] });
    }
    while ((match = endForRe.exec(textUpToCursor)) !== null) {
      blockEvents.push({ index: match.index, type: 'for_close' });
    }
    while ((match = letRe.exec(textUpToCursor)) !== null) {
      blockEvents.push({ index: match.index, type: 'let_open', name: match[1], varType: match[2] });
    }
    while ((match = endLetRe.exec(textUpToCursor)) !== null) {
      blockEvents.push({ index: match.index, type: 'let_close' });
    }

    blockEvents.sort((a, b) => a.index - b.index);

    forStack = [];
    letStack = [];

    for (const evt of blockEvents) {
      switch (evt.type) {
        case 'for_open':
          forStack.push({
            name: evt.name!,
            type: { typeName: evt.varType!, isCollection: false },
            source: 'for',
          });
          break;
        case 'for_close':
          forStack.pop();
          break;
        case 'let_open':
          letStack.push({
            name: evt.name!,
            type: { typeName: evt.varType!, isCollection: false },
            source: 'let',
          });
          break;
        case 'let_close':
          letStack.pop();
          break;
      }
    }

    variables.push(...forStack);
    variables.push(...letStack);

    return variables;
  }

  /**
   * Given an expression like "self.departamentos" or "dept.nombre",
   * resolve the type of the full expression using the schema.
   */
  resolveExpressionType(
    expression: string,
    scope: ScopeVariable[],
    schema: MetamodelSchemaProvider,
  ): TypeInfo | null {
    if (!expression || expression.trim() === '') return null;

    // Split by '.' and '->' preserving the separators
    const segments = this.splitExpression(expression);
    if (segments.length === 0) return null;

    // Resolve the first segment (must be a variable in scope)
    const firstSeg = segments[0].name;
    const scopeVar = scope.find((v) => v.name === firstSeg);
    if (!scopeVar) return null;

    let currentType: TypeInfo = { ...scopeVar.type };

    // Resolve subsequent segments
    for (let i = 1; i < segments.length; i++) {
      const seg = segments[i];

      if (seg.isArrow) {
        // Collection operation
        currentType = this.resolveCollectionOp(seg.name, currentType);
      } else {
        // Dot access — attribute or reference
        currentType = this.resolveDotAccess(seg.name, currentType, schema);
      }
    }

    return currentType;
  }

  private splitExpression(expr: string): Array<{ name: string; isArrow: boolean }> {
    const result: Array<{ name: string; isArrow: boolean }> = [];
    // Remove trailing dot or arrow for prefix resolution
    const cleaned = expr.replace(/(\.|->)$/, '');

    // Split by -> and .
    let current = '';
    let i = 0;
    let isFirst = true;

    while (i < cleaned.length) {
      if (cleaned[i] === '-' && cleaned[i + 1] === '>') {
        if (current) {
          result.push({ name: this.cleanSegment(current), isArrow: !isFirst && false });
          if (isFirst) isFirst = false;
        }
        current = '';
        i += 2;
        // Read the next segment as arrow
        while (i < cleaned.length && cleaned[i] !== '.' && !(cleaned[i] === '-' && cleaned[i + 1] === '>')) {
          current += cleaned[i];
          i++;
        }
        if (current) {
          result.push({ name: this.cleanSegment(current), isArrow: true });
          current = '';
        }
      } else if (cleaned[i] === '.') {
        if (current) {
          result.push({ name: this.cleanSegment(current), isArrow: false });
          if (isFirst) isFirst = false;
        }
        current = '';
        i++;
      } else {
        current += cleaned[i];
        i++;
      }
    }

    if (current) {
      result.push({ name: this.cleanSegment(current), isArrow: false });
    }

    return result;
  }

  private cleanSegment(seg: string): string {
    // Remove parentheses and arguments: "select(x | ...)" → "select"
    const parenIdx = seg.indexOf('(');
    if (parenIdx !== -1) {
      return seg.substring(0, parenIdx).trim();
    }
    return seg.trim();
  }

  private resolveCollectionOp(opName: string, currentType: TypeInfo): TypeInfo {
    if (COLLECTION_OPS_RETURNING_COLLECTION.has(opName)) {
      return { typeName: currentType.typeName, isCollection: true };
    }
    if (COLLECTION_OPS_RETURNING_ELEMENT.has(opName)) {
      return { typeName: currentType.typeName, isCollection: false };
    }
    if (COLLECTION_OPS_RETURNING_INT.has(opName)) {
      return { typeName: 'EInt', isCollection: false };
    }
    if (COLLECTION_OPS_RETURNING_BOOLEAN.has(opName)) {
      return { typeName: 'EBoolean', isCollection: false };
    }
    if (opName === 'collect' || opName === 'collectNested') {
      // collect changes the element type — we can't know without analyzing the body
      return { typeName: 'EObject', isCollection: true };
    }
    // Default: return same type
    return currentType;
  }

  /**
   * Check if an operation is valid for a given type.
   * Returns null if valid, or an error message if invalid.
   */
  validateOperation(
    typeName: string,
    opName: string,
    isCollection: boolean,
    isArrow: boolean,
  ): string | null {
    // Arrow operations are only valid on collections
    if (isArrow) {
      if (!isCollection) {
        return `Arrow operator '->' can only be used on collections, but '${typeName}' is not a collection`;
      }
      const allCollectionOps = new Set(
        Array.from(COLLECTION_OPS_RETURNING_COLLECTION)
          .concat(Array.from(COLLECTION_OPS_RETURNING_ELEMENT))
          .concat(Array.from(COLLECTION_OPS_RETURNING_INT))
          .concat(Array.from(COLLECTION_OPS_RETURNING_BOOLEAN))
          .concat(['collect', 'collectNested']),
      );
      if (!allCollectionOps.has(opName)) {
        return `'${opName}' is not a valid collection operation. Valid: select, reject, collect, sortedBy, first, last, size, isEmpty, notEmpty, exists, forAll, any, one, isUnique, closure, flatten, union, intersection, including, excluding, append, prepend, asSet, asSequence, asBag, asOrderedSet, sum, count, at, includes, excludes, includesAll, excludesAll, indexOf, collectNested, product, subSequence, subOrderedSet, insertAt, reverse`;
      }
      return null;
    }

    // Dot operations — check type compatibility
    if (isStringType(typeName)) {
      if (STRING_METHODS[opName]) return null; // valid string op
      if (UNIVERSAL_TYPE_OPS[opName]) return null; // universal OCL ops
      if (EMF_NAVIGATION_OPS[opName]) return null; // EMF navigation ops
      // Not a string method — could be a metamodel feature, let caller handle
      return null;
    }
    if (isNumericType(typeName)) {
      if (NUMERIC_METHODS[opName]) return null; // valid numeric op
      if (UNIVERSAL_TYPE_OPS[opName]) return null; // universal OCL ops
      if (EMF_NAVIGATION_OPS[opName]) return null; // EMF navigation ops
      if (STRING_METHODS[opName]) {
        return `'${opName}' is a String operation but '${typeName}' is numeric. Use .toString() first`;
      }
      return null;
    }
    // For EBoolean, check boolean ops and universal ops
    if (typeName === 'EBoolean' || typeName === 'Boolean') {
      if (BOOLEAN_METHODS[opName]) return null; // valid boolean op
      if (UNIVERSAL_TYPE_OPS[opName]) return null; // universal OCL ops
      if (EMF_NAVIGATION_OPS[opName]) return null; // EMF navigation ops
      if (STRING_METHODS[opName]) {
        return `'${opName}' is a String operation but type is Boolean`;
      }
      if (NUMERIC_METHODS[opName]) {
        return `'${opName}' is a numeric operation but type is Boolean`;
      }
    }

    return null; // default: allow (metamodel features handled elsewhere)
  }

  /**
   * Check if a method name is a known built-in (string, numeric, collection, or OCL).
   */
  isBuiltinOperation(name: string): boolean {
    if (STRING_METHODS[name]) return true;
    if (NUMERIC_METHODS[name]) return true;
    if (BOOLEAN_METHODS[name]) return true;
    if (UNIVERSAL_TYPE_OPS[name]) return true;
    if (EMF_NAVIGATION_OPS[name]) return true;
    if (COLLECTION_OPS_RETURNING_COLLECTION.has(name)) return true;
    if (COLLECTION_OPS_RETURNING_ELEMENT.has(name)) return true;
    if (COLLECTION_OPS_RETURNING_INT.has(name)) return true;
    if (COLLECTION_OPS_RETURNING_BOOLEAN.has(name)) return true;
    if (name === 'collect' || name === 'collectNested') return true;
    return false;
  }

  /**
   * Get the return type of a built-in operation given the receiver type.
   */
  getBuiltinReturnType(opName: string, receiverType: TypeInfo): TypeInfo | null {
    // Universal type ops (available on all types)
    if (opName === 'toString') return { typeName: 'EString', isCollection: false };
    if (opName === 'oclIsUndefined') return { typeName: 'EBoolean', isCollection: false };
    if (opName === 'oclIsInvalid') return { typeName: 'EBoolean', isCollection: false };
    if (opName === 'oclIsKindOf') return { typeName: 'EBoolean', isCollection: false };
    if (opName === 'oclIsTypeOf') return { typeName: 'EBoolean', isCollection: false };
    if (opName === 'oclType') return { typeName: 'EString', isCollection: false };
    if (opName === 'allInstances') return { typeName: 'EObject', isCollection: true };
    if (opName === 'oclAsType') return { typeName: 'EObject', isCollection: false };
    // EMF navigation ops
    if (opName === 'eContainer') return { typeName: 'EObject', isCollection: false };
    if (opName === 'eContainingFeature') return { typeName: 'EString', isCollection: false };
    if (opName === 'eContents') return { typeName: 'EObject', isCollection: true };
    if (opName === 'eAllContents') return { typeName: 'EObject', isCollection: true };
    if (opName === 'ancestors') return { typeName: 'EObject', isCollection: true };
    if (opName === 'siblings') return { typeName: 'EObject', isCollection: true };
    // String method return types
    if (STRING_METHODS[opName]) return { typeName: STRING_METHODS[opName], isCollection: false };
    // Numeric method return types
    if (NUMERIC_METHODS[opName]) return { typeName: NUMERIC_METHODS[opName], isCollection: false };
    // Boolean method return types
    if (BOOLEAN_METHODS[opName]) return { typeName: BOOLEAN_METHODS[opName], isCollection: false };
    // Collection operations
    if (COLLECTION_OPS_RETURNING_COLLECTION.has(opName)) {
      return { typeName: receiverType.typeName, isCollection: true };
    }
    if (COLLECTION_OPS_RETURNING_ELEMENT.has(opName)) {
      return { typeName: receiverType.typeName, isCollection: false };
    }
    if (COLLECTION_OPS_RETURNING_INT.has(opName)) {
      return { typeName: 'EInt', isCollection: false };
    }
    if (COLLECTION_OPS_RETURNING_BOOLEAN.has(opName)) {
      return { typeName: 'EBoolean', isCollection: false };
    }
    if (opName === 'collect' || opName === 'collectNested') {
      return { typeName: 'EObject', isCollection: true };
    }
    return null;
  }

  private resolveDotAccess(
    memberName: string,
    currentType: TypeInfo,
    schema: MetamodelSchemaProvider,
  ): TypeInfo {
    const typeName = currentType.typeName;

    // Check if it's a string method
    if (isStringType(typeName) && STRING_METHODS[memberName]) {
      return { typeName: STRING_METHODS[memberName], isCollection: false };
    }

    // Check if it's a numeric method
    if (isNumericType(typeName) && NUMERIC_METHODS[memberName]) {
      return { typeName: NUMERIC_METHODS[memberName], isCollection: false };
    }

    // Check if it's a boolean method
    if ((typeName === 'EBoolean' || typeName === 'Boolean') && BOOLEAN_METHODS[memberName]) {
      return { typeName: BOOLEAN_METHODS[memberName], isCollection: false };
    }

    // Check universal OCL ops (available on all types)
    if (UNIVERSAL_TYPE_OPS[memberName]) {
      const retType = UNIVERSAL_TYPE_OPS[memberName];
      if (memberName === 'allInstances') {
        return { typeName: retType, isCollection: true };
      }
      return { typeName: retType, isCollection: false };
    }

    // Check EMF navigation ops (available on EObject types)
    if (EMF_NAVIGATION_OPS[memberName]) {
      const retType = EMF_NAVIGATION_OPS[memberName];
      if (memberName === 'eContents' || memberName === 'eAllContents' || memberName === 'ancestors' || memberName === 'siblings') {
        return { typeName: retType, isCollection: true };
      }
      return { typeName: retType, isCollection: false };
    }

    // Look up in schema
    const features = schema.getFeaturesOf(typeName);

    // Check attributes
    const attr = features.attributes.find((a) => a.name === memberName);
    if (attr) {
      return { typeName: attr.type, isCollection: false };
    }

    // Check references
    const ref = features.references.find((r) => r.name === memberName);
    if (ref) {
      return { typeName: ref.targetClass, isCollection: ref.isMany };
    }

    // Unknown member
    return { typeName: 'EObject', isCollection: false };
  }

  /**
   * Determine what triggered completion based on cursor context.
   */
  getCompletionContext(
    text: string,
    line: number,
    col: number,
    schema: MetamodelSchemaProvider | null,
  ): CompletionContext {
    const lines = text.split('\n');
    const currentLine = lines[line - 1] || '';
    const textBeforeCursor = currentLine.substring(0, col - 1);

    const variablesInScope = this.getVariablesInScope(text, line, col);

    // Check for arrow trigger: ends with '->'
    if (textBeforeCursor.endsWith('->')) {
      const prefix = this.extractExpressionPrefix(textBeforeCursor, 2);
      let resolvedType: TypeInfo | undefined;
      if (prefix && schema) {
        const resolved = this.resolveExpressionType(prefix, variablesInScope, schema);
        if (resolved) resolvedType = resolved;
      }
      return {
        trigger: 'arrow',
        expressionPrefix: prefix,
        resolvedType,
        variablesInScope,
      };
    }

    // Check for dot trigger: ends with '.'
    if (textBeforeCursor.endsWith('.')) {
      const prefix = this.extractExpressionPrefix(textBeforeCursor, 1);
      let resolvedType: TypeInfo | undefined;
      if (prefix && schema) {
        const resolved = this.resolveExpressionType(prefix, variablesInScope, schema);
        if (resolved) resolvedType = resolved;
      }
      return {
        trigger: 'dot',
        expressionPrefix: prefix,
        resolvedType,
        variablesInScope,
      };
    }

    // Check for type position: after ':' in template/for/let params
    const typePositionRe = /:\s*\w*$/;
    if (typePositionRe.test(textBeforeCursor)) {
      // Verify we're inside a template/for/let declaration
      const declRe = /\[(template|for|let|query)\b/;
      if (declRe.test(textBeforeCursor) || declRe.test(currentLine)) {
        return { trigger: 'type_position', variablesInScope };
      }
    }

    // Check for keyword position: after '[' at start of expression
    const keywordRe = /\[\s*\w*$/;
    if (keywordRe.test(textBeforeCursor)) {
      return { trigger: 'keyword_position', variablesInScope };
    }

    // Check for import
    const importRe = /\[import\s+\w*$/;
    if (importRe.test(textBeforeCursor)) {
      return { trigger: 'import', variablesInScope };
    }

    // General completion
    return { trigger: 'general', variablesInScope };
  }

  /**
   * Extract the expression prefix before a dot or arrow.
   * E.g., from "  [for (d : Dept | self.departamentos." → "self.departamentos"
   */
  private extractExpressionPrefix(textBeforeCursor: string, trimEnd: number): string {
    const text = textBeforeCursor.substring(0, textBeforeCursor.length - trimEnd);
    // Walk backwards to find the start of the expression
    // An expression can contain: word chars, dots, arrows, parens (for method calls)
    let i = text.length - 1;
    let parenDepth = 0;

    while (i >= 0) {
      const ch = text[i];
      if (ch === ')') {
        parenDepth++;
        i--;
      } else if (ch === '(') {
        if (parenDepth > 0) {
          parenDepth--;
          i--;
        } else {
          break;
        }
      } else if (parenDepth > 0) {
        i--;
      } else if (/[\w.]/.test(ch)) {
        i--;
      } else if (ch === '>' && i > 0 && text[i - 1] === '-') {
        i -= 2;
      } else {
        break;
      }
    }

    return text.substring(i + 1);
  }
}
