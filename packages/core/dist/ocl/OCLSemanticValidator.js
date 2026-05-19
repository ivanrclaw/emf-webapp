/**
 * OCLSemanticValidator — Validación semántica completa de expresiones OCL.
 *
 * Combina:
 * 1. Validación sintáctica (lexer + parser)
 * 2. Type checking via OCLTypeInferenceEngine
 * 3. Diagnósticos adicionales (warnings, info)
 *
 * Produce diagnósticos con severidad, posición, y mensajes descriptivos
 * al estilo de Eclipse OCL.
 */
import { OCLLexer } from './OCLLexer.js';
import { OCLParser, } from './OCLParser.js';
import { typeToString } from './OCLTypes.js';
import { getOperationsForType } from './OCLStandardLibrary.js';
import { OCLTypeInferenceEngine, } from './OCLTypeInference.js';
// ── Semantic Validator ────────────────────────────────────────────
export class OCLSemanticValidator {
    parser = new OCLParser();
    inferenceEngine;
    metamodel;
    constructor(metamodel) {
        this.metamodel = metamodel;
        this.inferenceEngine = new OCLTypeInferenceEngine(metamodel);
    }
    /**
     * Validate an OCL expression in the context of a given EClass.
     */
    validate(expression, contextClassName) {
        const diagnostics = [];
        // ── Phase 0: Empty check ──
        if (!expression || expression.trim().length === 0) {
            diagnostics.push({
                severity: 'error',
                message: 'Empty OCL expression',
                offset: 0,
                length: 0,
                code: 'OCL_EMPTY',
            });
            return { diagnostics, valid: false };
        }
        // ── Phase 1: Lexer validation ──
        let tokens;
        try {
            const lexer = new OCLLexer(expression);
            tokens = lexer.tokenize();
        }
        catch (e) {
            diagnostics.push({
                severity: 'error',
                message: `Lexer error: ${e instanceof Error ? e.message : String(e)}`,
                offset: 0,
                length: expression.length,
                code: 'OCL_LEXER_ERROR',
            });
            return { diagnostics, valid: false };
        }
        // ── Phase 2: Parser validation ──
        let ast;
        try {
            ast = this.parser.parse(expression);
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            const posMatch = msg.match(/at position (\d+)/);
            const offset = posMatch ? parseInt(posMatch[1]) : 0;
            diagnostics.push({
                severity: 'error',
                message: msg,
                offset,
                length: 1,
                code: 'OCL_PARSE_ERROR',
            });
            return { diagnostics, valid: false };
        }
        // ── Phase 3: Context class validation ──
        const classMap = new Map();
        for (const cls of this.metamodel.classes) {
            classMap.set(cls.name, cls);
        }
        if (!classMap.has(contextClassName)) {
            diagnostics.push({
                severity: 'error',
                message: `Unknown context class '${contextClassName}'`,
                offset: 0,
                length: 0,
                code: 'OCL_UNKNOWN_CONTEXT',
            });
            return { diagnostics, valid: false };
        }
        // ── Phase 4: Type inference (collects type errors) ──
        const inferResult = this.inferenceEngine.infer(ast, contextClassName);
        for (const err of inferResult.errors) {
            diagnostics.push({
                severity: 'error',
                message: err.message,
                offset: 0, // AST nodes don't carry position yet
                length: 0,
                code: 'OCL_TYPE_ERROR',
            });
        }
        // ── Phase 5: Semantic checks (walk AST for additional diagnostics) ──
        this.walkAST(ast, contextClassName, classMap, diagnostics);
        const hasErrors = diagnostics.some((d) => d.severity === 'error');
        return {
            diagnostics,
            valid: !hasErrors,
            inferredType: inferResult.type,
        };
    }
    /**
     * Check if a class (or any of its supertypes) has a given feature.
     */
    classHasFeature(className, featureName) {
        const cls = this.metamodel.classes.find((c) => c.name === className);
        if (!cls)
            return false;
        const hasAttr = cls.attributes.some((a) => a.name === featureName);
        if (hasAttr)
            return true;
        const hasRef = cls.references.some((r) => r.name === featureName);
        if (hasRef)
            return true;
        const hasOp = cls.operations?.some((o) => o.name === featureName) ?? false;
        if (hasOp)
            return true;
        // Traverse supertypes
        if (this.metamodel.hierarchy) {
            const supers = this.metamodel.hierarchy.get(className);
            if (supers) {
                for (const superName of supers) {
                    if (this.classHasFeature(superName, featureName))
                        return true;
                }
            }
        }
        return false;
    }
    /**
     * Walk the AST to produce additional semantic diagnostics beyond type inference.
     */
    walkAST(node, contextClassName, classMap, diagnostics) {
        switch (node.type) {
            case 'binary':
                this.checkBinaryOp(node, contextClassName, classMap, diagnostics);
                break;
            case 'if':
                this.checkIfExpr(node, contextClassName, classMap, diagnostics);
                break;
            case 'collectionop':
                this.checkCollectionOp(node, contextClassName, classMap, diagnostics);
                break;
            case 'methodcall':
                this.checkMethodCall(node, contextClassName, classMap, diagnostics);
                break;
            case 'letin':
                this.checkLetIn(node, contextClassName, classMap, diagnostics);
                break;
            case 'identifier':
                this.checkIdentifier(node, contextClassName, classMap, diagnostics);
                break;
            default:
                break;
        }
    }
    checkBinaryOp(node, ctx, classMap, diagnostics) {
        this.walkAST(node.left, ctx, classMap, diagnostics);
        this.walkAST(node.right, ctx, classMap, diagnostics);
        // Check comparison operators with incompatible types
        const compOps = ['>', '<', '>=', '<='];
        if (compOps.includes(node.operator)) {
            const leftType = this.inferenceEngine.infer(node.left, ctx).type;
            const rightType = this.inferenceEngine.infer(node.right, ctx).type;
            const numericKinds = ['Integer', 'Real'];
            if (leftType.kind === 'primitive' && !numericKinds.includes(leftType.name) &&
                rightType.kind === 'primitive' && !numericKinds.includes(rightType.name)) {
                diagnostics.push({
                    severity: 'warning',
                    message: `Comparison '${node.operator}' between non-numeric types: ${typeToString(leftType)} and ${typeToString(rightType)}`,
                    offset: 0,
                    length: 0,
                    code: 'OCL_COMPARISON_TYPE',
                });
            }
        }
        // Check 'implies' operands should be Boolean
        if (node.operator === 'implies' || node.operator === 'and' || node.operator === 'or' || node.operator === 'xor') {
            const leftType = this.inferenceEngine.infer(node.left, ctx).type;
            const rightType = this.inferenceEngine.infer(node.right, ctx).type;
            if (leftType.kind === 'primitive' && leftType.name !== 'Boolean') {
                diagnostics.push({
                    severity: 'warning',
                    message: `Left operand of '${node.operator}' should be Boolean, got ${typeToString(leftType)}`,
                    offset: 0,
                    length: 0,
                    code: 'OCL_BOOLEAN_EXPECTED',
                });
            }
            if (rightType.kind === 'primitive' && rightType.name !== 'Boolean') {
                diagnostics.push({
                    severity: 'warning',
                    message: `Right operand of '${node.operator}' should be Boolean, got ${typeToString(rightType)}`,
                    offset: 0,
                    length: 0,
                    code: 'OCL_BOOLEAN_EXPECTED',
                });
            }
        }
    }
    checkIfExpr(node, ctx, classMap, diagnostics) {
        this.walkAST(node.condition, ctx, classMap, diagnostics);
        this.walkAST(node.thenExpr, ctx, classMap, diagnostics);
        this.walkAST(node.elseExpr, ctx, classMap, diagnostics);
        // Condition should be Boolean
        const condType = this.inferenceEngine.infer(node.condition, ctx).type;
        if (condType.kind === 'primitive' && condType.name !== 'Boolean') {
            diagnostics.push({
                severity: 'warning',
                message: `if-condition should be Boolean, got ${typeToString(condType)}`,
                offset: 0,
                length: 0,
                code: 'OCL_IF_CONDITION_TYPE',
            });
        }
    }
    checkCollectionOp(node, ctx, classMap, diagnostics) {
        this.walkAST(node.source, ctx, classMap, diagnostics);
        if (node.body)
            this.walkAST(node.body, ctx, classMap, diagnostics);
        if (node.args) {
            for (const arg of node.args)
                this.walkAST(arg, ctx, classMap, diagnostics);
        }
        // Check source is actually a collection (or String, which behaves as Sequence in OCL)
        const sourceType = this.inferenceEngine.infer(node.source, ctx).type;
        const sourceKind = sourceType.kind;
        const isStringCollection = sourceKind === 'primitive' && sourceType.name === 'String';
        if (sourceKind !== 'collection' && sourceKind !== 'any' && !isStringCollection) {
            diagnostics.push({
                severity: 'error',
                message: `Collection operation '${node.operation}' called on non-collection type: ${typeToString(sourceType)}`,
                offset: 0,
                length: 0,
                code: 'OCL_NOT_COLLECTION',
            });
        }
        // Check lambda operations have body
        const lambdaOps = ['forAll', 'exists', 'select', 'reject', 'collect', 'closure',
            'one', 'isUnique', 'sortedBy', 'any', 'collectNested'];
        if (lambdaOps.includes(node.operation) && !node.body) {
            diagnostics.push({
                severity: 'warning',
                message: `Collection operation '${node.operation}' without body expression`,
                offset: 0,
                length: 0,
                code: 'OCL_MISSING_BODY',
            });
        }
        // Check iterate has all required parts
        if (node.operation === 'iterate') {
            if (!node.iterAcc) {
                diagnostics.push({
                    severity: 'error',
                    message: 'iterate requires an accumulator variable',
                    offset: 0,
                    length: 0,
                    code: 'OCL_ITERATE_NO_ACC',
                });
            }
            if (!node.iterInit) {
                diagnostics.push({
                    severity: 'error',
                    message: 'iterate requires an accumulator initial value',
                    offset: 0,
                    length: 0,
                    code: 'OCL_ITERATE_NO_INIT',
                });
            }
        }
    }
    checkMethodCall(node, ctx, classMap, diagnostics) {
        this.walkAST(node.object, ctx, classMap, diagnostics);
        for (const arg of node.args)
            this.walkAST(arg, ctx, classMap, diagnostics);
        // Check if method exists on the inferred type
        const objType = this.inferenceEngine.infer(node.object, ctx).type;
        // Skip check for 'any' type (unresolved)
        if (objType.kind === 'any' || objType.kind === 'invalid')
            return;
        // For class types, check features (including inherited)
        if (objType.kind === 'class') {
            // Skip allInstances — it's a valid static operation on any class
            if (node.method === 'allInstances')
                return;
            // Skip oclAsType — type narrowing handled by inference engine
            if (node.method === 'oclAsType')
                return;
            const hasFeature = this.classHasFeature(objType.name, node.method);
            // Also check standard library operations for OclAny
            const stdOps = getOperationsForType(objType);
            const hasStdOp = stdOps.some((op) => op.name === node.method);
            if (!hasFeature && !hasStdOp) {
                diagnostics.push({
                    severity: 'error',
                    message: `Property or operation '${node.method}' not found on type '${objType.name}'`,
                    offset: 0,
                    length: 0,
                    code: 'OCL_UNDEFINED_FEATURE',
                });
            }
        }
        // For primitive types, check standard library
        if (objType.kind === 'primitive') {
            const stdOps = getOperationsForType(objType);
            const hasStdOp = stdOps.some((op) => op.name === node.method);
            if (!hasStdOp) {
                diagnostics.push({
                    severity: 'error',
                    message: `Operation '${node.method}' not defined on type '${typeToString(objType)}'`,
                    offset: 0,
                    length: 0,
                    code: 'OCL_UNDEFINED_OPERATION',
                });
            }
        }
        // For collection types accessed via dot (implicit collect check)
        if (objType.kind === 'collection') {
            const elemType = objType.elementType;
            if (elemType.kind === 'class') {
                const hasFeature = this.classHasFeature(elemType.name, node.method);
                if (!hasFeature) {
                    // Check if it's a collection operation used with dot instead of arrow
                    const collOps = ['size', 'isEmpty', 'notEmpty', 'includes', 'excludes',
                        'first', 'last', 'sum', 'min', 'max', 'flatten', 'asSet', 'asBag',
                        'asSequence', 'asOrderedSet', 'reverse'];
                    if (collOps.includes(node.method)) {
                        diagnostics.push({
                            severity: 'info',
                            message: `'${node.method}' is a collection operation — consider using '->' instead of '.'`,
                            offset: 0,
                            length: 0,
                            code: 'OCL_DOT_VS_ARROW',
                        });
                    }
                }
            }
        }
    }
    checkLetIn(node, ctx, classMap, diagnostics) {
        this.walkAST(node.initExpr, ctx, classMap, diagnostics);
        this.walkAST(node.bodyExpr, ctx, classMap, diagnostics);
        // Warn about unused let variables (simple heuristic: check if varName appears in body)
        if (!this.astContainsIdentifier(node.bodyExpr, node.varName)) {
            diagnostics.push({
                severity: 'warning',
                message: `Variable '${node.varName}' is declared but never used`,
                offset: 0,
                length: 0,
                code: 'OCL_UNUSED_VARIABLE',
            });
        }
    }
    checkIdentifier(node, ctx, classMap, diagnostics) {
        // Skip qualified names (enum literals like Status::ACTIVE)
        if (node.name.includes('::'))
            return;
        // Check if identifier exists in context class
        const cls = classMap.get(ctx);
        if (cls) {
            const hasAttr = cls.attributes.some((a) => a.name === node.name);
            const hasRef = cls.references.some((r) => r.name === node.name);
            if (!hasAttr && !hasRef) {
                // Could be a scope variable — don't report error here
                // (type inference handles this more accurately)
                return;
            }
        }
    }
    // ── Utility ─────────────────────────────────────────────────────
    astContainsIdentifier(node, name) {
        switch (node.type) {
            case 'identifier':
                return node.name === name;
            case 'binary': {
                const b = node;
                return this.astContainsIdentifier(b.left, name) || this.astContainsIdentifier(b.right, name);
            }
            case 'methodcall': {
                const m = node;
                return this.astContainsIdentifier(m.object, name) || m.args.some((a) => this.astContainsIdentifier(a, name));
            }
            case 'collectionop': {
                const c = node;
                return this.astContainsIdentifier(c.source, name) ||
                    (c.body ? this.astContainsIdentifier(c.body, name) : false) ||
                    (c.args?.some((a) => this.astContainsIdentifier(a, name)) ?? false);
            }
            case 'if': {
                const i = node;
                return this.astContainsIdentifier(i.condition, name) ||
                    this.astContainsIdentifier(i.thenExpr, name) ||
                    this.astContainsIdentifier(i.elseExpr, name);
            }
            case 'letin': {
                const l = node;
                // If the let shadows the variable, it's not the same one
                if (l.varName === name)
                    return false;
                return this.astContainsIdentifier(l.initExpr, name) || this.astContainsIdentifier(l.bodyExpr, name);
            }
            case 'collectionliteral': {
                const cl = node;
                return cl.elements.some((e) => this.astContainsIdentifier(e, name));
            }
            case 'tupleliteral': {
                const t = node;
                return t.parts.some((p) => this.astContainsIdentifier(p.value, name));
            }
            case 'atpre':
                return this.astContainsIdentifier(node.expression, name);
            default:
                return false;
        }
    }
}
//# sourceMappingURL=OCLSemanticValidator.js.map