/**
 * OCLTypeInference — Motor de inferencia de tipos OCL 2.4
 *
 * Dado un AST + contexto (EClass) + metamodelo → infiere el tipo de cada nodo.
 * Resuelve cadenas de navegación, implicit collect, y operaciones de colección.
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
  LetInNode,
  IfNode,
  CollectionLiteralNode,
} from './OCLParser.js';

import {
  OCLType,
  OCL,
  CollectionType,
  typeToString,
} from './OCLTypes.js';

import { conformsTo, commonSupertype, ClassHierarchy } from './OCLConformance.js';
import { getOperationsForType, OCLOperationSignature } from './OCLStandardLibrary.js';

// ── Metamodel Info for Type Resolution ──────────────────────────────

export interface MetamodelInfo {
  /** All EClasses with their features */
  classes: MetamodelClass[];
  /** Class hierarchy: className → direct supertype names */
  hierarchy?: ClassHierarchy;
}

export interface MetamodelClass {
  name: string;
  abstract?: boolean;
  attributes: MetamodelFeature[];
  references: MetamodelReference[];
  operations?: MetamodelOperation[];
}

export interface MetamodelFeature {
  name: string;
  type: string; // e.g., 'EString', 'EInt', 'EBoolean', 'EDouble', or EClass name
  many?: boolean;
}

export interface MetamodelReference {
  name: string;
  targetClass: string;
  many?: boolean;
  containment?: boolean;
}

export interface MetamodelOperation {
  name: string;
  returnType: string;
  params?: Array<{ name: string; type: string }>;
}

// ── Type Inference Result ────────────────────────────────────────────

export interface TypeInferenceResult {
  type: OCLType;
  errors: TypeInferenceError[];
}

export interface TypeInferenceError {
  message: string;
  node: ASTNode;
}

// ── Type Inference Engine ────────────────────────────────────────────

export class OCLTypeInferenceEngine {
  private readonly classMap: Map<string, MetamodelClass>;
  private readonly hierarchy: ClassHierarchy;

  constructor(private readonly metamodel: MetamodelInfo) {
    this.classMap = new Map();
    for (const cls of metamodel.classes) {
      this.classMap.set(cls.name, cls);
    }
    this.hierarchy = metamodel.hierarchy ?? new Map();
  }

  /**
   * Infer the type of an AST node given a context EClass name.
   */
  infer(node: ASTNode, contextClassName: string): TypeInferenceResult {
    const errors: TypeInferenceError[] = [];
    const scope = new Map<string, OCLType>();
    const type = this.inferNode(node, contextClassName, scope, errors);
    return { type, errors };
  }

  private inferNode(
    node: ASTNode,
    contextClass: string,
    scope: Map<string, OCLType>,
    errors: TypeInferenceError[],
  ): OCLType {
    switch (node.type) {
      case 'literal':
        return this.inferLiteral(node as LiteralNode);
      case 'self':
        return OCL.Class(contextClass);
      case 'identifier':
        return this.inferIdentifier(node as IdentifierNode, contextClass, scope, errors);
      case 'unary':
        return this.inferUnary(node as UnaryOpNode, contextClass, scope, errors);
      case 'binary':
        return this.inferBinary(node as BinaryOpNode, contextClass, scope, errors);
      case 'methodcall':
        return this.inferMethodCall(node as MethodCallNode, contextClass, scope, errors);
      case 'collectionop':
        return this.inferCollectionOp(node as CollectionOpNode, contextClass, scope, errors);
      case 'letin':
        return this.inferLetIn(node as LetInNode, contextClass, scope, errors);
      case 'if':
        return this.inferIf(node as IfNode, contextClass, scope, errors);
      case 'collectionliteral':
        return this.inferCollectionLiteral(node as CollectionLiteralNode, contextClass, scope, errors);
      default:
        return OCL.Any;
    }
  }

  // ── Literal ─────────────────────────────────────────────────────────

  private inferLiteral(node: LiteralNode): OCLType {
    switch (node.valueType) {
      case 'number':
        return typeof node.value === 'number' && node.value % 1 !== 0
          ? OCL.Real
          : OCL.Integer;
      case 'string':
        return OCL.String;
      case 'boolean':
        return OCL.Boolean;
      case 'null':
        return OCL.Void;
      case 'invalid':
        return OCL.Invalid;
    }
  }

  // ── Identifier ──────────────────────────────────────────────────────

  private inferIdentifier(
    node: IdentifierNode,
    contextClass: string,
    scope: Map<string, OCLType>,
    errors: TypeInferenceError[],
  ): OCLType {
    // Check scope first (let-bound, iterator variables)
    if (scope.has(node.name)) {
      return scope.get(node.name)!;
    }

    // Qualified enum literal (e.g., Status::ACTIVE)
    if (node.name.includes('::')) {
      const [enumName] = node.name.split('::');
      return OCL.Enum(enumName, []);
    }

    // Feature of context class (implicit self)
    return this.resolveFeatureType(contextClass, node.name, errors, node);
  }

  // ── Unary ───────────────────────────────────────────────────────────

  private inferUnary(
    node: UnaryOpNode,
    contextClass: string,
    scope: Map<string, OCLType>,
    errors: TypeInferenceError[],
  ): OCLType {
    const operandType = this.inferNode(node.operand, contextClass, scope, errors);
    if (node.operator === 'not') return OCL.Boolean;
    if (node.operator === '-') {
      if (operandType.kind === 'primitive' && operandType.name === 'Real') return OCL.Real;
      return OCL.Integer;
    }
    return operandType;
  }

  // ── Binary ──────────────────────────────────────────────────────────

  private inferBinary(
    node: BinaryOpNode,
    contextClass: string,
    scope: Map<string, OCLType>,
    errors: TypeInferenceError[],
  ): OCLType {
    const leftType = this.inferNode(node.left, contextClass, scope, errors);
    const rightType = this.inferNode(node.right, contextClass, scope, errors);

    switch (node.operator) {
      // Comparison → Boolean
      case '=':
      case '<>':
      case '>':
      case '<':
      case '>=':
      case '<=':
        return OCL.Boolean;

      // Logical → Boolean
      case 'and':
      case 'or':
      case 'xor':
      case 'implies':
        return OCL.Boolean;

      // Arithmetic
      case '+': {
        // String concatenation
        if (leftType.kind === 'primitive' && leftType.name === 'String') return OCL.String;
        if (rightType.kind === 'primitive' && rightType.name === 'String') return OCL.String;
        return commonSupertype(leftType, rightType, this.hierarchy);
      }
      case '-':
      case '*':
        return commonSupertype(leftType, rightType, this.hierarchy);
      case '/':
        return OCL.Real;
      case 'div':
      case 'mod':
        return OCL.Integer;

      default:
        return OCL.Any;
    }
  }

  // ── Method Call (dot navigation) ────────────────────────────────────

  private inferMethodCall(
    node: MethodCallNode,
    contextClass: string,
    scope: Map<string, OCLType>,
    errors: TypeInferenceError[],
  ): OCLType {
    const objectType = this.inferNode(node.object, contextClass, scope, errors);
    const method = node.method;

    // If object is a collection and method is not a collection op → implicit collect
    if (objectType.kind === 'collection') {
      const elemType = objectType.elementType;

      // Check if it's a standard operation on the collection itself
      const collOps = getOperationsForType(objectType);
      const matchedOp = collOps.find((op) => op.name === method && !op.isIterator);
      if (matchedOp) {
        return this.resolveOperationReturnType(matchedOp, objectType);
      }

      // Otherwise: implicit collect — navigate the feature on element type
      if (elemType.kind === 'class') {
        const featureType = this.resolveFeatureType(elemType.name, method, errors, node);
        // Implicit collect produces Bag (from Set) or Sequence (from ordered)
        if (featureType.kind === 'collection') {
          // Flatten: navigating a multi-valued feature from a collection
          return OCL.BagOf(featureType.elementType);
        }
        const resultKind = objectType.collectionKind === 'Sequence' || objectType.collectionKind === 'OrderedSet'
          ? 'Sequence' : 'Bag';
        return { kind: 'collection', collectionKind: resultKind, elementType: featureType };
      }

      // Primitive element type — check standard ops
      const elemOps = getOperationsForType(elemType);
      const elemOp = elemOps.find((op) => op.name === method);
      if (elemOp) {
        // Implicit collect of operation result
        const retType = this.resolveOperationReturnType(elemOp, elemType);
        return OCL.BagOf(retType);
      }

      return OCL.BagOf(OCL.Any);
    }

    // Object is a class → feature navigation or operation
    if (objectType.kind === 'class') {
      // First check standard library operations (oclIsTypeOf, etc.)
      const stdOps = getOperationsForType(objectType);
      const stdOp = stdOps.find((op) => op.name === method);
      if (stdOp) {
        return this.resolveOperationReturnType(stdOp, objectType);
      }

      // Then check metamodel features
      return this.resolveFeatureType(objectType.name, method, errors, node);
    }

    // Object is a primitive → check standard library
    if (objectType.kind === 'primitive') {
      const ops = getOperationsForType(objectType);
      const op = ops.find((o) => o.name === method);
      if (op) {
        return this.resolveOperationReturnType(op, objectType);
      }
    }

    // Tuple → part access
    if (objectType.kind === 'tuple') {
      const part = objectType.parts.find((p) => p.name === method);
      if (part) return part.type;
      errors.push({ message: `Unknown tuple part '${method}'`, node });
      return OCL.Any;
    }

    return OCL.Any;
  }

  // ── Collection Operation (arrow navigation) ─────────────────────────

  private inferCollectionOp(
    node: CollectionOpNode,
    contextClass: string,
    scope: Map<string, OCLType>,
    errors: TypeInferenceError[],
  ): OCLType {
    const sourceType = this.inferNode(node.source, contextClass, scope, errors);

    // Treat String as a collection (Sequence of characters) as per OCL 2.4
    const isStringCollection = sourceType.kind === 'primitive' && sourceType.name === 'String';

    if (sourceType.kind !== 'collection' && !isStringCollection) {
      errors.push({ message: `Collection operation '${node.operation}' called on non-collection type '${typeToString(sourceType)}'`, node });
      return OCL.Any;
    }

    // Normalize: treat String as a collection type for type inference
    const effectiveType: import('./OCLTypes.js').CollectionType = isStringCollection
      ? { kind: 'collection', collectionKind: 'Sequence', elementType: OCL.String }
      : sourceType as import('./OCLTypes.js').CollectionType;

    const elemType = effectiveType.elementType;
    const op = node.operation;

    // Infer body type if present (with iterator in scope)
    let bodyType: OCLType = OCL.Any;
    if (node.body && node.iterator) {
      const newScope = new Map(scope);
      newScope.set(node.iterator, elemType);
      bodyType = this.inferNode(node.body, contextClass, newScope, errors);
    }

    switch (op) {
      // Boolean result iterators
      case 'forAll':
      case 'exists':
      case 'one':
      case 'isUnique':
        return OCL.Boolean;

      // Same collection type (filter)
      case 'select':
      case 'reject':
        return effectiveType;

      // any → element type
      case 'any':
        return elemType;

      // collect → Bag/Sequence of body type
      case 'collect': {
        const resultKind = effectiveType.collectionKind === 'Sequence' || effectiveType.collectionKind === 'OrderedSet'
          ? 'Sequence' : 'Bag';
        // Flatten if body returns a collection
        const finalElem = bodyType.kind === 'collection' ? bodyType.elementType : bodyType;
        return { kind: 'collection', collectionKind: resultKind, elementType: finalElem };
      }

      // collectNested → same as collect but no flattening
      case 'collectNested': {
        const resultKind = effectiveType.collectionKind === 'Sequence' || effectiveType.collectionKind === 'OrderedSet'
          ? 'Sequence' : 'Bag';
        return { kind: 'collection', collectionKind: resultKind, elementType: bodyType };
      }

      // closure → Set of element type
      case 'closure':
        return OCL.SetOf(elemType);

      // sortedBy → OrderedSet or Sequence
      case 'sortedBy': {
        return effectiveType.collectionKind === 'Set' || effectiveType.collectionKind === 'OrderedSet'
          ? OCL.OrderedSetOf(elemType)
          : OCL.SequenceOf(elemType);
      }

      // iterate → accumulator type (complex, return Any for now)
      case 'iterate':
        return OCL.Any;

      // Simple operations
      case 'size':
      case 'count':
      case 'indexOf':
        return OCL.Integer;
      case 'isEmpty':
      case 'notEmpty':
      case 'includes':
      case 'excludes':
      case 'includesAll':
      case 'excludesAll':
        return OCL.Boolean;
      case 'first':
      case 'last':
      case 'at':
      case 'min':
      case 'max':
      case 'sum':
        return elemType;
      case 'flatten':
        if (elemType.kind === 'collection') return { ...effectiveType, elementType: elemType.elementType } as OCLType;
        return effectiveType;

      // Conversion
      case 'asSet':
        return OCL.SetOf(elemType);
      case 'asBag':
        return OCL.BagOf(elemType);
      case 'asSequence':
        return OCL.SequenceOf(elemType);
      case 'asOrderedSet':
        return OCL.OrderedSetOf(elemType);

      // Preserving operations
      case 'including':
      case 'excluding':
      case 'includingAll':
      case 'excludingAll':
      case 'union':
      case 'intersection':
      case 'append':
      case 'prepend':
      case 'appendAll':
      case 'prependAll':
      case 'insertAt':
      case 'reverse':
      case 'subSequence':
      case 'subOrderedSet':
        return sourceType;

      case 'symmetricDifference':
      case '-':
        return sourceType;

      case 'selectByKind':
      case 'selectByType':
        return sourceType;

      case 'product':
        return OCL.SetOf(OCL.Tuple([
          { name: 'first', type: elemType },
          { name: 'second', type: OCL.Any },
        ]));

      default:
        return OCL.Any;
    }
  }

  // ── Let-In ──────────────────────────────────────────────────────────

  private inferLetIn(
    node: LetInNode,
    contextClass: string,
    scope: Map<string, OCLType>,
    errors: TypeInferenceError[],
  ): OCLType {
    const initType = this.inferNode(node.initExpr, contextClass, scope, errors);
    const newScope = new Map(scope);
    newScope.set(node.varName, initType);
    return this.inferNode(node.bodyExpr, contextClass, newScope, errors);
  }

  // ── If-Then-Else ────────────────────────────────────────────────────

  private inferIf(
    node: IfNode,
    contextClass: string,
    scope: Map<string, OCLType>,
    errors: TypeInferenceError[],
  ): OCLType {
    // Condition should be Boolean (we don't error here, that's for the validator)
    this.inferNode(node.condition, contextClass, scope, errors);
    const thenType = this.inferNode(node.thenExpr, contextClass, scope, errors);
    const elseType = this.inferNode(node.elseExpr, contextClass, scope, errors);
    return commonSupertype(thenType, elseType, this.hierarchy);
  }

  // ── Collection Literal ──────────────────────────────────────────────

  private inferCollectionLiteral(
    node: CollectionLiteralNode,
    contextClass: string,
    scope: Map<string, OCLType>,
    errors: TypeInferenceError[],
  ): OCLType {
    if (node.elements.length === 0) {
      return { kind: 'collection', collectionKind: node.collectionType, elementType: OCL.Any };
    }

    // Infer element types and find common supertype
    let elemType = this.inferNode(node.elements[0], contextClass, scope, errors);
    for (let i = 1; i < node.elements.length; i++) {
      const t = this.inferNode(node.elements[i], contextClass, scope, errors);
      elemType = commonSupertype(elemType, t, this.hierarchy);
    }

    return { kind: 'collection', collectionKind: node.collectionType, elementType: elemType };
  }

  // ── Feature Resolution ──────────────────────────────────────────────

  /**
   * Resolve the type of a feature (attribute or reference) on a class.
   */
  private resolveFeatureType(
    className: string,
    featureName: string,
    errors: TypeInferenceError[],
    node: ASTNode,
  ): OCLType {
    const cls = this.classMap.get(className);
    if (!cls) {
      errors.push({ message: `Unknown class '${className}'`, node });
      return OCL.Any;
    }

    // Check attributes
    const attr = cls.attributes.find((a) => a.name === featureName);
    if (attr) {
      const baseType = this.ecoreTypeToOCLType(attr.type);
      return attr.many ? OCL.SetOf(baseType) : baseType;
    }

    // Check references
    const ref = cls.references.find((r) => r.name === featureName);
    if (ref) {
      const targetType = OCL.Class(ref.targetClass);
      return ref.many ? OCL.SetOf(targetType) : targetType;
    }

    // Check operations
    if (cls.operations) {
      const op = cls.operations.find((o) => o.name === featureName);
      if (op) {
        return this.ecoreTypeToOCLType(op.returnType);
      }
    }

    // Check supertypes
    const supers = this.hierarchy.get(className);
    if (supers) {
      for (const superName of supers) {
        const result = this.resolveFeatureTypeSilent(superName, featureName);
        if (result) return result;
      }
    }

    errors.push({ message: `Unknown feature '${featureName}' in class '${className}'`, node });
    return OCL.Any;
  }

  /**
   * Same as resolveFeatureType but without error reporting (for supertype traversal).
   */
  private resolveFeatureTypeSilent(className: string, featureName: string): OCLType | null {
    const cls = this.classMap.get(className);
    if (!cls) return null;

    const attr = cls.attributes.find((a) => a.name === featureName);
    if (attr) {
      const baseType = this.ecoreTypeToOCLType(attr.type);
      return attr.many ? OCL.SetOf(baseType) : baseType;
    }

    const ref = cls.references.find((r) => r.name === featureName);
    if (ref) {
      const targetType = OCL.Class(ref.targetClass);
      return ref.many ? OCL.SetOf(targetType) : targetType;
    }

    if (cls.operations) {
      const op = cls.operations.find((o) => o.name === featureName);
      if (op) return this.ecoreTypeToOCLType(op.returnType);
    }

    // Recurse into supertypes
    const supers = this.hierarchy.get(className);
    if (supers) {
      for (const superName of supers) {
        const result = this.resolveFeatureTypeSilent(superName, featureName);
        if (result) return result;
      }
    }

    return null;
  }

  // ── Ecore Type → OCL Type Mapping ─────────────────────────────────

  private ecoreTypeToOCLType(ecoreType: string): OCLType {
    switch (ecoreType) {
      case 'EString':
      case 'String':
        return OCL.String;
      case 'EInt':
      case 'EIntegerObject':
      case 'Integer':
      case 'int':
        return OCL.Integer;
      case 'EDouble':
      case 'EFloat':
      case 'EDoubleObject':
      case 'EFloatObject':
      case 'Real':
      case 'double':
      case 'float':
        return OCL.Real;
      case 'EBoolean':
      case 'EBooleanObject':
      case 'Boolean':
      case 'boolean':
        return OCL.Boolean;
      case 'ELong':
      case 'ELongObject':
      case 'EBigInteger':
      case 'UnlimitedNatural':
        return OCL.UnlimitedNatural;
      default:
        // Assume it's a class name
        if (this.classMap.has(ecoreType)) {
          return OCL.Class(ecoreType);
        }
        return OCL.Any;
    }
  }

  // ── Helper: resolve operation return type ─────────────────────────

  private resolveOperationReturnType(op: OCLOperationSignature, selfType: OCLType): OCLType {
    const ret = op.returnType;
    if (ret === 'self') return selfType;
    if (ret === 'boolean') return OCL.Boolean;
    if (ret === 'elementType') {
      if (selfType.kind === 'collection') return selfType.elementType;
      return OCL.Any;
    }
    return ret;
  }
}
