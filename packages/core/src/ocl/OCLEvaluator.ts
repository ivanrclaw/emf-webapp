/**
 * OCLEvaluator — Recorre un AST OCL y lo evalúa contra un modelo EMF.
 *
 * Soporta:
 * - Navegación por atributos y referencias
 * - Operaciones de colección (forAll, exists, select, etc.)
 * - Operadores aritméticos, comparación, lógicos
 * - String operations
 * - Type operations (oclIsTypeOf, oclIsKindOf, etc.)
 */

import {
  ASTNode,
  LiteralNode,
  IdentifierNode,
  SelfNode,
  UnaryOpNode,
  BinaryOpNode,
  MethodCallNode,
  CollectionOpNode,
} from './OCLParser.js';

export type EValue = string | number | boolean | null | undefined | OCLEObject | OCLEObject[] | Map<string, EValue>;

export interface OCLEObject {
  eClass: string;
  attributes: Record<string, EValue>;
  references: Record<string, EValue>;
}

export interface OCLEClassInfo {
  name: string;
  abstract?: boolean;
  eStructuralFeatures: OCLStructuralFeature[];
}

export interface OCLStructuralFeature {
  name: string;
  type: string;
  kind: 'attribute' | 'reference';
  many: boolean;
  containment?: boolean;
}

export type OCLResult =
  | { success: true; value: EValue }
  | { success: false; error: string };

export class OCLEvaluator {
  constructor(
    private readonly eclassMap: Map<string, OCLEClassInfo>,
  ) {}

  evaluate(ast: ASTNode, context: OCLEObject): OCLResult {
    try {
      const value = this.evalNode(ast, context, new Map());
      return { success: true, value };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  private evalNode(
    node: ASTNode,
    context: OCLEObject,
    scope: Map<string, EValue>,
  ): EValue {
    switch (node.type) {
      case 'literal':
        return (node as LiteralNode).value;
      case 'self':
        return context;
      case 'identifier':
        return this.evalIdentifier(node as IdentifierNode, context, scope);
      case 'unary':
        return this.evalUnary(node as UnaryOpNode, context, scope);
      case 'binary':
        return this.evalBinary(node as BinaryOpNode, context, scope);
      case 'methodcall':
        return this.evalMethodCall(node as MethodCallNode, context, scope);
      case 'collectionop':
        return this.evalCollectionOp(node as CollectionOpNode, context, scope);
      default:
        throw new Error(`Unknown node type: ${(node as any).type}`);
    }
  }

  private evalIdentifier(
    node: IdentifierNode,
    context: OCLEObject,
    scope: Map<string, EValue>,
  ): EValue {
    // Check local scope first (iterator variables)
    if (scope.has(node.name)) {
      return scope.get(node.name)!;
    }
    // Fall through: treat as feature access on context
    if (node.name in context.attributes) {
      return context.attributes[node.name];
    }
    if (node.name in context.references) {
      return context.references[node.name];
    }
    throw new Error(`Undefined identifier '${node.name}' in context`);
  }

  private evalUnary(
    node: UnaryOpNode,
    context: OCLEObject,
    scope: Map<string, EValue>,
  ): EValue {
    const operand = this.evalNode(node.operand, context, scope);
    if (node.operator === '-') {
      if (typeof operand !== 'number') {
        throw new Error(`Cannot apply '-' to non-numeric value: ${operand}`);
      }
      return -operand;
    }
    if (node.operator === 'not') {
      return !this.toBoolean(operand);
    }
    throw new Error(`Unknown unary operator: ${node.operator}`);
  }

  private evalBinary(
    node: BinaryOpNode,
    context: OCLEObject,
    scope: Map<string, EValue>,
  ): EValue {
    const left = this.evalNode(node.left, context, scope);
    const right = this.evalNode(node.right, context, scope);

    switch (node.operator) {
      // Arithmetic
      case '+': {
        if (typeof left === 'string' || typeof right === 'string') {
          return String(left) + String(right);
        }
        return this.toNumber(left) + this.toNumber(right);
      }
      case '-': return this.toNumber(left) - this.toNumber(right);
      case '*': return this.toNumber(left) * this.toNumber(right);
      case '/': {
        const r = this.toNumber(right);
        if (r === 0) throw new Error('Division by zero');
        return this.toNumber(left) / r;
      }

      // Comparison
      case '=': return this.isEqual(left, right);
      case '<>': return !this.isEqual(left, right);
      case '>': return this.toNumber(left) > this.toNumber(right);
      case '<': return this.toNumber(left) < this.toNumber(right);
      case '>=': return this.toNumber(left) >= this.toNumber(right);
      case '<=': return this.toNumber(left) <= this.toNumber(right);

      // Logical
      case 'and': return this.toBoolean(left) && this.toBoolean(right);
      case 'or': return this.toBoolean(left) || this.toBoolean(right);
      case 'xor': return this.toBoolean(left) !== this.toBoolean(right);
      case 'implies': return !this.toBoolean(left) || this.toBoolean(right);

      default:
        throw new Error(`Unknown binary operator: ${node.operator}`);
    }
  }

  private evalMethodCall(
    node: MethodCallNode,
    context: OCLEObject,
    scope: Map<string, EValue>,
  ): EValue {
    const obj = this.evalNode(node.object, context, scope);
    const method = node.method;
    const args = node.args.map((a) => this.evalNode(a, context, scope));

    switch (method) {
      // String operations
      case 'concat':
        return String(obj) + (args[0] !== undefined ? String(args[0]) : '');
      case 'size':
        if (typeof obj === 'string') return obj.length;
        if (Array.isArray(obj)) return obj.length;
        throw new Error(`size() called on non-collection/string`);
      case 'substring':
        return typeof obj === 'string'
          ? obj.substring(Number(args[0]), Number(args[1]))
          : '';
      case 'toUpper':
        return typeof obj === 'string' ? obj.toUpperCase() : String(obj).toUpperCase();
      case 'toLower':
        return typeof obj === 'string' ? obj.toLowerCase() : String(obj).toLowerCase();
      case 'startsWith':
        return typeof obj === 'string' && typeof args[0] === 'string'
          ? obj.startsWith(args[0])
          : false;
      case 'endsWith':
        return typeof obj === 'string' && typeof args[0] === 'string'
          ? obj.endsWith(args[0])
          : false;

      // Numeric
      case 'abs':
        return Math.abs(this.toNumber(obj));
      case 'floor':
        return Math.floor(this.toNumber(obj));
      case 'round':
        return Math.round(this.toNumber(obj));

      // Type operations
      case 'oclIsTypeOf':
        return this.isTypeOf(obj, String(args[0]));
      case 'oclIsKindOf':
        return this.isKindOf(obj, String(args[0]));
      case 'oclAsType':
        return obj; // No actual cast in JS runtime
      case 'oclIsUndefined':
        return obj === null || obj === undefined;

      // Collection as property
      default: {
        // Treat unknown method as property navigation
        if (this.isEObject(obj)) {
          const eo = obj as OCLEObject;
          if (method in eo.attributes) return eo.attributes[method];
          if (method in eo.references) return eo.references[method];
        }
        // If obj is array, map the property across
        if (Array.isArray(obj)) {
          return (obj as OCLEObject[]).map((item) => {
            if (this.isEObject(item)) {
              const eo = item as OCLEObject;
              if (method in eo.attributes) return eo.attributes[method];
              if (method in eo.references) return eo.references[method];
            }
            return null;
          }).flat() as EValue;
        }
        throw new Error(`Cannot resolve method/property '${method}' on ${typeof obj}`);
      }
    }
  }

  private evalCollectionOp(
    node: CollectionOpNode,
    context: OCLEObject,
    scope: Map<string, EValue>,
  ): EValue {
    const source = this.evalNode(node.source, context, scope);
    if (!Array.isArray(source)) {
      throw new Error(`Collection operation '${node.operation}' called on non-collection`);
    }

    const col = source;

    switch (node.operation) {
      case 'size':
        return col.length;
      case 'isEmpty':
        return col.length === 0;
      case 'notEmpty':
        return col.length > 0;
      case 'includes': {
        const val = node.args?.[0]
          ? this.evalNode(node.args[0], context, scope)
          : undefined;
        return col.some((item) => this.isEqual(item, val));
      }
      case 'excludes': {
        const val2 = node.args?.[0]
          ? this.evalNode(node.args[0], context, scope)
          : undefined;
        return !col.some((item) => this.isEqual(item, val2));
      }
      case 'includesAll': {
        const coll = node.args?.[0]
          ? this.evalNode(node.args[0], context, scope)
          : [];
        const target = Array.isArray(coll) ? coll : [];
        return target.every((t) => col.some((c) => this.isEqual(c, t)));
      }
      case 'first':
        return col.length > 0 ? col[0] : null;
      case 'last':
        return col.length > 0 ? col[col.length - 1] : null;
      case 'at':
        return node.args?.[0] ? col[Number(this.evalNode(node.args[0], context, scope)) - 1] : null;

      // Lambda-based operations
      case 'forAll': {
        if (!node.body || !node.iterator) {
          return col.every(() => true);
        }
        for (const item of col) {
          const newScope = new Map(scope);
          newScope.set(node.iterator, item);
          const result = this.evalNode(node.body, context, newScope);
          if (!this.toBoolean(result)) return false;
        }
        return true;
      }
      case 'exists': {
        if (!node.body) return col.length > 0;
        for (const item of col) {
          const newScope = new Map(scope);
          newScope.set(node.iterator!, item);
          if (this.toBoolean(this.evalNode(node.body, context, newScope))) return true;
        }
        return false;
      }
      case 'select': {
        if (!node.body) return col;
        const result: OCLEObject[] = [];
        for (const item of col) {
          const newScope = new Map(scope);
          newScope.set(node.iterator!, item);
          if (this.toBoolean(this.evalNode(node.body, context, newScope))) {
            result.push(item as OCLEObject);
          }
        }
        return result;
      }
      case 'collect': {
        if (!node.body) return col;
        return col.map((item) => {
          const newScope = new Map(scope);
          newScope.set(node.iterator!, item);
          return this.evalNode(node.body!, context, newScope);
        }) as unknown as EValue;
      }
      case 'one': {
        if (!node.body) return col.length === 1;
        let count = 0;
        for (const item of col) {
          const newScope = new Map(scope);
          newScope.set(node.iterator!, item);
          if (this.toBoolean(this.evalNode(node.body, context, newScope))) {
            count++;
            if (count > 1) return false;
          }
        }
        return count === 1;
      }
      case 'isUnique': {
        if (!node.body) return true;
        const seen = new Set<string>();
        for (const item of col) {
          const newScope = new Map(scope);
          newScope.set(node.iterator!, item);
          const val = this.evalNode(node.body, context, newScope);
          const key = JSON.stringify(val);
          if (seen.has(key)) return false;
          seen.add(key);
        }
        return true;
      }
      case 'sortedBy': {
        if (!node.body) return col;
        return [...col].sort((a, b) => {
          const scopeA = new Map(scope);
          scopeA.set(node.iterator!, a);
          const scopeB = new Map(scope);
          scopeB.set(node.iterator!, b);
          const valA = this.evalNode(node.body!, context, scopeA);
          const valB = this.evalNode(node.body!, context, scopeB);
          if (typeof valA === 'number' && typeof valB === 'number') {
            return valA - valB;
          }
          return String(valA).localeCompare(String(valB));
        });
      }
      case 'any': {
        if (!node.body) return col.length > 0 ? col[0] : null;
        for (const item of col) {
          const newScope = new Map(scope);
          newScope.set(node.iterator!, item);
          if (this.toBoolean(this.evalNode(node.body, context, newScope))) {
            return item;
          }
        }
        return null;
      }

      default:
        throw new Error(`Unknown collection operation: ${node.operation}`);
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────

  private toBoolean(val: EValue): boolean {
    if (typeof val === 'boolean') return val;
    if (typeof val === 'number') return val !== 0;
    if (typeof val === 'string') return val.length > 0;
    if (val === null || val === undefined) return false;
    if (Array.isArray(val)) return val.length > 0;
    return true;
  }

  private toNumber(val: EValue): number {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') return parseFloat(val) || 0;
    if (typeof val === 'boolean') return val ? 1 : 0;
    return 0;
  }

  private isEqual(a: EValue, b: EValue): boolean {
    if (a === b) return true;
    if (a === null || a === undefined) return b === null || b === undefined;
    if (typeof a !== typeof b) return false;
    return JSON.stringify(a) === JSON.stringify(b);
  }

  private isEObject(val: EValue): val is OCLEObject {
    return (
      val !== null &&
      val !== undefined &&
      typeof val === 'object' &&
      !Array.isArray(val) &&
      'eClass' in (val as any)
    );
  }

  private isTypeOf(obj: EValue, className: string): boolean {
    if (this.isEObject(obj)) {
      return obj.eClass === className;
    }
    return false;
  }

  private isKindOf(obj: EValue, className: string): boolean {
    if (this.isEObject(obj)) {
      return obj.eClass === className;
    }
    return false;
  }
}
