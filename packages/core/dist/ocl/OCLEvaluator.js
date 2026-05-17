/**
 * OCLEvaluator — Recorre un AST OCL y lo evalúa contra un modelo EMF.
 *
 * Soporta:
 * - Navegación por atributos y referencias
 * - Operaciones de colección (forAll, exists, select, collect, reject, closure, etc.)
 * - Operadores aritméticos, comparación, lógicos
 * - String operations
 * - Type operations (oclIsTypeOf, oclIsKindOf con herencia, etc.)
 * - Let / in expressions
 * - If / then / else / endif expressions
 * - Collection literales (Set{}, Bag{}, Sequence{}, OrderedSet{})
 * - iterate
 * - div / mod
 */
export class OCLEvaluator {
    eclassMap;
    eclassHierarchy;
    constructor(eclassMap, 
    /** Optional map of class name -> list of superclass names for isKindOf inheritance checks */
    eclassHierarchy) {
        this.eclassMap = eclassMap;
        this.eclassHierarchy = eclassHierarchy;
    }
    evaluate(ast, context) {
        try {
            const value = this.evalNode(ast, context, new Map());
            return { success: true, value };
        }
        catch (e) {
            return { success: false, error: e instanceof Error ? e.message : String(e) };
        }
    }
    evalNode(node, context, scope) {
        switch (node.type) {
            case 'literal':
                return node.value;
            case 'self':
                return context;
            case 'identifier':
                return this.evalIdentifier(node, context, scope);
            case 'unary':
                return this.evalUnary(node, context, scope);
            case 'binary':
                return this.evalBinary(node, context, scope);
            case 'methodcall':
                return this.evalMethodCall(node, context, scope);
            case 'collectionop':
                return this.evalCollectionOp(node, context, scope);
            case 'letin':
                return this.evalLetIn(node, context, scope);
            case 'if':
                return this.evalIf(node, context, scope);
            case 'collectionliteral':
                return this.evalCollectionLiteral(node, context, scope);
            default:
                throw new Error(`Unknown node type: ${node.type}`);
        }
    }
    evalIdentifier(node, context, scope) {
        // Check local scope first (iterator variables, let-bound variables)
        if (scope.has(node.name)) {
            return scope.get(node.name);
        }
        // Check if it's a qualified enum literal like Status::ACTIVE
        if (node.name.includes('::')) {
            // Return the qualified name as a string value for enum literals
            return node.name;
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
    evalLetIn(node, context, scope) {
        const initVal = this.evalNode(node.initExpr, context, scope);
        const newScope = new Map(scope);
        newScope.set(node.varName, initVal);
        return this.evalNode(node.bodyExpr, context, newScope);
    }
    evalIf(node, context, scope) {
        const cond = this.toBoolean(this.evalNode(node.condition, context, scope));
        if (cond) {
            return this.evalNode(node.thenExpr, context, scope);
        }
        else {
            return this.evalNode(node.elseExpr, context, scope);
        }
    }
    evalCollectionLiteral(node, context, scope) {
        const elements = node.elements.map((el) => this.evalNode(el, context, scope));
        switch (node.collectionType) {
            case 'Set':
            case 'OrderedSet': {
                // Deduplicate by JSON serialization (simple approach)
                const seen = new Set();
                const unique = [];
                for (const el of elements) {
                    const key = JSON.stringify(el);
                    if (!seen.has(key)) {
                        seen.add(key);
                        unique.push(el);
                    }
                }
                return unique;
            }
            case 'Bag':
            case 'Sequence':
            default:
                return elements;
        }
    }
    evalUnary(node, context, scope) {
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
    evalBinary(node, context, scope) {
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
                if (r === 0)
                    throw new Error('Division by zero');
                return this.toNumber(left) / r;
            }
            case 'div': {
                const r = this.toNumber(right);
                if (r === 0)
                    throw new Error('Division by zero');
                return Math.floor(this.toNumber(left) / r);
            }
            case 'mod': {
                const r = this.toNumber(right);
                if (r === 0)
                    throw new Error('Division by zero');
                return this.toNumber(left) % r;
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
    evalMethodCall(node, context, scope) {
        const obj = this.evalNode(node.object, context, scope);
        const method = node.method;
        const args = node.args.map((a) => this.evalNode(a, context, scope));
        switch (method) {
            // String operations
            case 'concat':
                return String(obj) + (args[0] !== undefined ? String(args[0]) : '');
            case 'size':
                if (typeof obj === 'string')
                    return obj.length;
                if (Array.isArray(obj))
                    return obj.length;
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
            case 'max':
                if (typeof obj === 'number') {
                    return Math.max(obj, ...args.map((a) => this.toNumber(a)));
                }
                throw new Error(`max() called on non-numeric`);
            case 'min':
                if (typeof obj === 'number') {
                    return Math.min(obj, ...args.map((a) => this.toNumber(a)));
                }
                throw new Error(`min() called on non-numeric`);
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
                    const eo = obj;
                    if (method in eo.attributes)
                        return eo.attributes[method];
                    if (method in eo.references)
                        return eo.references[method];
                }
                // If obj is array, map the property across
                if (Array.isArray(obj)) {
                    return obj.map((item) => {
                        if (this.isEObject(item)) {
                            const eo = item;
                            if (method in eo.attributes)
                                return eo.attributes[method];
                            if (method in eo.references)
                                return eo.references[method];
                        }
                        return null;
                    }).flat();
                }
                throw new Error(`Cannot resolve method/property '${method}' on ${typeof obj}`);
            }
        }
    }
    evalCollectionOp(node, context, scope) {
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
            case 'sum': {
                let total = 0;
                for (const item of col) {
                    total += this.toNumber(item);
                }
                return total;
            }
            case 'min': {
                if (col.length === 0)
                    throw new Error('min() called on empty collection');
                let result = this.toNumber(col[0]);
                for (let i = 1; i < col.length; i++) {
                    result = Math.min(result, this.toNumber(col[i]));
                }
                return result;
            }
            case 'max': {
                if (col.length === 0)
                    throw new Error('max() called on empty collection');
                let result = this.toNumber(col[0]);
                for (let i = 1; i < col.length; i++) {
                    result = Math.max(result, this.toNumber(col[i]));
                }
                return result;
            }
            case 'flatten': {
                const result = [];
                for (const item of col) {
                    if (Array.isArray(item)) {
                        result.push(...item);
                    }
                    else {
                        result.push(item);
                    }
                }
                return result;
            }
            // Lambda-based operations
            case 'forAll': {
                if (!node.body || !node.iterator) {
                    return col.every(() => true);
                }
                for (const item of col) {
                    const newScope = new Map(scope);
                    newScope.set(node.iterator, item);
                    const result = this.evalNode(node.body, context, newScope);
                    if (!this.toBoolean(result))
                        return false;
                }
                return true;
            }
            case 'exists': {
                if (!node.body)
                    return col.length > 0;
                for (const item of col) {
                    const newScope = new Map(scope);
                    newScope.set(node.iterator, item);
                    if (this.toBoolean(this.evalNode(node.body, context, newScope)))
                        return true;
                }
                return false;
            }
            case 'select': {
                if (!node.body)
                    return col;
                const result = [];
                for (const item of col) {
                    const newScope = new Map(scope);
                    newScope.set(node.iterator, item);
                    if (this.toBoolean(this.evalNode(node.body, context, newScope))) {
                        result.push(item);
                    }
                }
                return result;
            }
            case 'reject': {
                if (!node.body)
                    return col;
                const result = [];
                for (const item of col) {
                    const newScope = new Map(scope);
                    newScope.set(node.iterator, item);
                    if (!this.toBoolean(this.evalNode(node.body, context, newScope))) {
                        result.push(item);
                    }
                }
                return result;
            }
            case 'collect': {
                if (!node.body)
                    return col;
                return col.map((item) => {
                    const newScope = new Map(scope);
                    newScope.set(node.iterator, item);
                    return this.evalNode(node.body, context, newScope);
                });
            }
            case 'collectNested': {
                // Same as collect but preserves nested collections (no flattening)
                if (!node.body)
                    return col;
                return col.map((item) => {
                    const newScope = new Map(scope);
                    newScope.set(node.iterator, item);
                    return this.evalNode(node.body, context, newScope);
                });
            }
            case 'closure': {
                // closure: transitive closure — recursively traverse until no more results
                if (!node.body)
                    return col;
                const seen = new Set();
                const result = [];
                const queue = [...col];
                while (queue.length > 0) {
                    const current = queue.shift();
                    const key = this.isEObject(current)
                        ? JSON.stringify(current.attributes)
                        : JSON.stringify(current);
                    if (seen.has(key))
                        continue;
                    seen.add(key);
                    result.push(current);
                    // Evaluate body on current element to get next level
                    const nextScope = new Map(scope);
                    nextScope.set(node.iterator, current);
                    const nextItems = this.evalNode(node.body, context, nextScope);
                    if (Array.isArray(nextItems)) {
                        for (const item of nextItems) {
                            const itemKey = this.isEObject(item)
                                ? JSON.stringify(item.attributes)
                                : JSON.stringify(item);
                            if (!seen.has(itemKey)) {
                                queue.push(item);
                            }
                        }
                    }
                }
                return result;
            }
            case 'one': {
                if (!node.body)
                    return col.length === 1;
                let count = 0;
                for (const item of col) {
                    const newScope = new Map(scope);
                    newScope.set(node.iterator, item);
                    if (this.toBoolean(this.evalNode(node.body, context, newScope))) {
                        count++;
                        if (count > 1)
                            return false;
                    }
                }
                return count === 1;
            }
            case 'isUnique': {
                if (!node.body)
                    return true;
                const seen = new Set();
                for (const item of col) {
                    const newScope = new Map(scope);
                    newScope.set(node.iterator, item);
                    const val = this.evalNode(node.body, context, newScope);
                    const key = JSON.stringify(val);
                    if (seen.has(key))
                        return false;
                    seen.add(key);
                }
                return true;
            }
            case 'sortedBy': {
                if (!node.body)
                    return col;
                return [...col].sort((a, b) => {
                    const scopeA = new Map(scope);
                    scopeA.set(node.iterator, a);
                    const scopeB = new Map(scope);
                    scopeB.set(node.iterator, b);
                    const valA = this.evalNode(node.body, context, scopeA);
                    const valB = this.evalNode(node.body, context, scopeB);
                    if (typeof valA === 'number' && typeof valB === 'number') {
                        return valA - valB;
                    }
                    return String(valA).localeCompare(String(valB));
                });
            }
            case 'any': {
                if (!node.body)
                    return col.length > 0 ? col[0] : null;
                for (const item of col) {
                    const newScope = new Map(scope);
                    newScope.set(node.iterator, item);
                    if (this.toBoolean(this.evalNode(node.body, context, newScope))) {
                        return item;
                    }
                }
                return null;
            }
            case 'iterate': {
                if (!node.body || !node.iterator || !node.iterAcc) {
                    throw new Error('iterate requires iterator, accumulator, and body');
                }
                // Initialize accumulator
                const accInit = node.iterInit
                    ? this.evalNode(node.iterInit, context, scope)
                    : null;
                let acc = accInit;
                for (const item of col) {
                    const newScope = new Map(scope);
                    newScope.set(node.iterator, item);
                    newScope.set(node.iterAcc, acc);
                    acc = this.evalNode(node.body, context, newScope);
                }
                return acc;
            }
            default:
                throw new Error(`Unknown collection operation: ${node.operation}`);
        }
    }
    // ── Helpers ──────────────────────────────────────────────────────
    toBoolean(val) {
        if (typeof val === 'boolean')
            return val;
        if (typeof val === 'number')
            return val !== 0;
        if (typeof val === 'string')
            return val.length > 0;
        if (val === null || val === undefined)
            return false;
        if (Array.isArray(val))
            return val.length > 0;
        return true;
    }
    toNumber(val) {
        if (typeof val === 'number')
            return val;
        if (typeof val === 'string')
            return parseFloat(val) || 0;
        if (typeof val === 'boolean')
            return val ? 1 : 0;
        return 0;
    }
    isEqual(a, b) {
        if (a === b)
            return true;
        if (a === null || a === undefined)
            return b === null || b === undefined;
        if (typeof a !== typeof b)
            return false;
        return JSON.stringify(a) === JSON.stringify(b);
    }
    isEObject(val) {
        return (val !== null &&
            val !== undefined &&
            typeof val === 'object' &&
            !Array.isArray(val) &&
            'eClass' in val);
    }
    isTypeOf(obj, className) {
        if (this.isEObject(obj)) {
            return obj.eClass === className;
        }
        return false;
    }
    /**
     * Checks if obj is an instance of className or any of its subclasses.
     * If eclassHierarchy is provided, walks the supertype chain.
     */
    isKindOf(obj, className) {
        if (!this.isEObject(obj)) {
            return false;
        }
        const eClass = obj.eClass;
        if (eClass === className)
            return true;
        // Walk the hierarchy if available
        if (this.eclassHierarchy) {
            const visited = new Set();
            const queue = [eClass];
            while (queue.length > 0) {
                const current = queue.shift();
                if (visited.has(current))
                    continue;
                visited.add(current);
                const supers = this.eclassHierarchy.get(current);
                if (supers) {
                    for (const superClass of supers) {
                        if (superClass === className)
                            return true;
                        queue.push(superClass);
                    }
                }
            }
        }
        return false;
    }
}
//# sourceMappingURL=OCLEvaluator.js.map