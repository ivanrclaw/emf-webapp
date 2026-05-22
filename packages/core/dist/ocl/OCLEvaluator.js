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
            case 'tupleliteral':
                return this.evalTupleLiteral(node, context, scope);
            case 'atpre':
                return this.evalAtPre(node, context, scope);
            case 'range':
                // Range nodes are normally handled inside collection literals
                // If encountered standalone, evaluate as a sequence
                const rangeN = node;
                const s = this.toNumber(this.evalNode(rangeN.start, context, scope));
                const e = this.toNumber(this.evalNode(rangeN.end, context, scope));
                const result = [];
                if (s <= e) {
                    for (let i = s; i <= e; i++)
                        result.push(i);
                }
                else {
                    for (let i = s; i >= e; i--)
                        result.push(i);
                }
                return result;
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
        const elements = [];
        for (const el of node.elements) {
            if (el.type === 'range') {
                // Range expression: expand start..end into individual integers
                const rangeNode = el;
                const start = this.toNumber(this.evalNode(rangeNode.start, context, scope));
                const end = this.toNumber(this.evalNode(rangeNode.end, context, scope));
                if (start <= end) {
                    for (let i = start; i <= end; i++)
                        elements.push(i);
                }
                else {
                    for (let i = start; i >= end; i--)
                        elements.push(i);
                }
            }
            else {
                elements.push(this.evalNode(el, context, scope));
            }
        }
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
            case '-': {
                // Set difference: Set - Set
                if (Array.isArray(left) && Array.isArray(right)) {
                    return left.filter((item) => !right.some((r) => this.isEqual(item, r)));
                }
                return this.toNumber(left) - this.toNumber(right);
            }
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
            case '>': return this.compareValues(left, right) > 0;
            case '<': return this.compareValues(left, right) < 0;
            case '>=': return this.compareValues(left, right) >= 0;
            case '<=': return this.compareValues(left, right) <= 0;
            // Logical (three-valued: null propagation per OCL 2.4)
            case 'and': {
                const lb = this.toBooleanOrNull(left);
                const rb = this.toBooleanOrNull(right);
                if (lb === false || rb === false)
                    return false; // false AND x = false
                if (lb === null || rb === null)
                    return null; // null AND true = null
                return true;
            }
            case 'or': {
                const lb = this.toBooleanOrNull(left);
                const rb = this.toBooleanOrNull(right);
                if (lb === true || rb === true)
                    return true; // true OR x = true
                if (lb === null || rb === null)
                    return null; // null OR false = null
                return false;
            }
            case 'xor': {
                const lb = this.toBooleanOrNull(left);
                const rb = this.toBooleanOrNull(right);
                if (lb === null || rb === null)
                    return null;
                return lb !== rb;
            }
            case 'implies': {
                const lb = this.toBooleanOrNull(left);
                const rb = this.toBooleanOrNull(right);
                if (lb === false)
                    return true; // false IMPLIES x = true
                if (rb === true)
                    return true; // x IMPLIES true = true
                if (lb === null || rb === null)
                    return null;
                return !lb || rb;
            }
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
                // OCL substring(lower, upper) is 1-based inclusive
                if (typeof obj === 'string') {
                    const lower = this.toNumber(args[0]);
                    const upper = this.toNumber(args[1]);
                    return obj.substring(lower - 1, upper);
                }
                return '';
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
            case 'indexOf': {
                // OCL: 1-based index, 0 if not found
                const s = String(obj);
                const sub = String(args[0]);
                const idx = s.indexOf(sub);
                return idx === -1 ? 0 : idx + 1;
            }
            case 'at': {
                // String.at(i) — 1-based, returns character
                if (typeof obj === 'string') {
                    const i = this.toNumber(args[0]);
                    if (i < 1 || i > obj.length)
                        throw new Error(`String index out of bounds: ${i}`);
                    return obj.charAt(i - 1);
                }
                // Array.at handled in collectionop
                throw new Error(`at() called on non-string/non-collection`);
            }
            case 'characters':
                return typeof obj === 'string' ? obj.split('') : [];
            case 'toInteger':
                return typeof obj === 'string' ? (parseInt(obj, 10) || 0) : Math.trunc(this.toNumber(obj));
            case 'toReal':
                return typeof obj === 'string' ? (parseFloat(obj) || 0.0) : this.toNumber(obj);
            case 'toBoolean':
                if (typeof obj === 'string')
                    return obj === 'true';
                return this.toBoolean(obj);
            case 'toString':
                if (obj === null || obj === undefined)
                    return 'null';
                if (typeof obj === 'string')
                    return obj;
                return String(obj);
            case 'trim':
                return typeof obj === 'string' ? obj.trim() : String(obj).trim();
            case 'replaceAll':
                return typeof obj === 'string' && typeof args[0] === 'string' && typeof args[1] === 'string'
                    ? obj.split(args[0]).join(args[1])
                    : String(obj);
            case 'replaceFirst':
                return typeof obj === 'string' && typeof args[0] === 'string' && typeof args[1] === 'string'
                    ? obj.replace(args[0], args[1])
                    : String(obj);
            case 'matches':
                if (typeof obj === 'string' && typeof args[0] === 'string') {
                    try {
                        return new RegExp(args[0]).test(obj);
                    }
                    catch {
                        return false;
                    }
                }
                return false;
            case 'equalsIgnoreCase':
                return typeof obj === 'string' && typeof args[0] === 'string'
                    ? obj.toLowerCase() === args[0].toLowerCase()
                    : false;
            case 'lastIndexOf': {
                // OCL: 1-based index, 0 if not found
                const str = String(obj);
                const substr = String(args[0]);
                const lastIdx = str.lastIndexOf(substr);
                return lastIdx === -1 ? 0 : lastIdx + 1;
            }
            case 'substituteAll':
                // Literal string replacement (not regex)
                return typeof obj === 'string' && typeof args[0] === 'string' && typeof args[1] === 'string'
                    ? obj.split(args[0]).join(args[1])
                    : String(obj);
            case 'substituteFirst':
                // Literal first occurrence replacement (not regex)
                return typeof obj === 'string' && typeof args[0] === 'string' && typeof args[1] === 'string'
                    ? obj.replace(args[0], args[1])
                    : String(obj);
            case 'tokenize':
                // Split by whitespace
                return typeof obj === 'string'
                    ? obj.trim().split(/\s+/).filter(s => s.length > 0)
                    : [];
            case 'toUpperCase':
                return typeof obj === 'string' ? obj.toUpperCase() : String(obj).toUpperCase();
            case 'toLowerCase':
                return typeof obj === 'string' ? obj.toLowerCase() : String(obj).toLowerCase();
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
            case 'oclIsInvalid':
                return obj === null || obj === undefined;
            case 'oclContainer':
                // Navigate to the containing object (parent in containment hierarchy)
                if (this.isEObject(obj) && obj.eContainer)
                    return obj.eContainer;
                return null;
            case 'oclContents':
                // Navigate to direct contained children
                if (this.isEObject(obj) && obj.eContents)
                    return obj.eContents();
                return [];
            case 'oclType': {
                if (this.isEObject(obj))
                    return obj.eClass;
                if (typeof obj === 'string')
                    return 'String';
                if (typeof obj === 'number')
                    return Number.isInteger(obj) ? 'Integer' : 'Real';
                if (typeof obj === 'boolean')
                    return 'Boolean';
                if (Array.isArray(obj))
                    return 'Collection';
                if (obj instanceof Map)
                    return 'Tuple';
                return 'OclVoid';
            }
            case 'allInstances':
                // allInstances requires access to all model elements — return empty by default
                // Subclasses or integration layer can override
                return [];
            // Collection as property / Tuple access / implicit collect
            default: {
                // Tuple property access
                if (obj instanceof Map) {
                    if (obj.has(method))
                        return obj.get(method);
                    throw new Error(`Tuple has no part '${method}'`);
                }
                // Treat unknown method as property navigation
                if (this.isEObject(obj)) {
                    const eo = obj;
                    if (method in eo.attributes)
                        return eo.attributes[method];
                    if (method in eo.references)
                        return eo.references[method];
                }
                // If obj is array, implicit collect (navigate property across all elements)
                if (Array.isArray(obj)) {
                    const result = [];
                    for (const item of obj) {
                        if (this.isEObject(item)) {
                            const eo = item;
                            if (method in eo.attributes) {
                                const val = eo.attributes[method];
                                if (Array.isArray(val))
                                    result.push(...val);
                                else
                                    result.push(val);
                            }
                            else if (method in eo.references) {
                                const val = eo.references[method];
                                if (Array.isArray(val))
                                    result.push(...val);
                                else
                                    result.push(val);
                            }
                            else {
                                result.push(null);
                            }
                        }
                        else {
                            result.push(null);
                        }
                    }
                    return result;
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
                // Multi-iterator: forAll(x, y | body) — nested loops over all combinations
                if (node.iterators && node.iterators.length > 1) {
                    return this.evalMultiIterator(col, node.iterators, node.body, context, scope, 'forAll');
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
                // Multi-iterator: exists(x, y | body) — nested loops
                if (node.iterators && node.iterators.length > 1) {
                    return this.evalMultiIterator(col, node.iterators, node.body, context, scope, 'exists');
                }
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
            // ── Set/Bag/Sequence operations ──────────────────────────────
            case 'excludesAll': {
                const coll = node.args?.[0]
                    ? this.evalNode(node.args[0], context, scope)
                    : [];
                const target = Array.isArray(coll) ? coll : [];
                return target.every((t) => !col.some((c) => this.isEqual(c, t)));
            }
            case 'count': {
                const val = node.args?.[0]
                    ? this.evalNode(node.args[0], context, scope)
                    : undefined;
                return col.filter((item) => this.isEqual(item, val)).length;
            }
            case 'including': {
                const val = node.args?.[0]
                    ? this.evalNode(node.args[0], context, scope)
                    : null;
                return [...col, val];
            }
            case 'excluding': {
                const val = node.args?.[0]
                    ? this.evalNode(node.args[0], context, scope)
                    : null;
                return col.filter((item) => !this.isEqual(item, val));
            }
            case 'union': {
                const other = node.args?.[0]
                    ? this.evalNode(node.args[0], context, scope)
                    : [];
                const otherArr = Array.isArray(other) ? other : [];
                return [...col, ...otherArr];
            }
            case 'intersection': {
                const other = node.args?.[0]
                    ? this.evalNode(node.args[0], context, scope)
                    : [];
                const otherArr = Array.isArray(other) ? other : [];
                return col.filter((item) => otherArr.some((o) => this.isEqual(item, o)));
            }
            case 'symmetricDifference': {
                const other = node.args?.[0]
                    ? this.evalNode(node.args[0], context, scope)
                    : [];
                const otherArr = Array.isArray(other) ? other : [];
                const onlyInCol = col.filter((item) => !otherArr.some((o) => this.isEqual(item, o)));
                const onlyInOther = otherArr.filter((item) => !col.some((c) => this.isEqual(c, item)));
                return [...onlyInCol, ...onlyInOther];
            }
            case 'asSet': {
                const seen = new Set();
                const unique = [];
                for (const el of col) {
                    const key = JSON.stringify(el);
                    if (!seen.has(key)) {
                        seen.add(key);
                        unique.push(el);
                    }
                }
                return unique;
            }
            case 'asOrderedSet': {
                const seen = new Set();
                const unique = [];
                for (const el of col) {
                    const key = JSON.stringify(el);
                    if (!seen.has(key)) {
                        seen.add(key);
                        unique.push(el);
                    }
                }
                return unique;
            }
            case 'asBag':
                return [...col];
            case 'asSequence':
                return [...col];
            case 'append': {
                const val = node.args?.[0]
                    ? this.evalNode(node.args[0], context, scope)
                    : null;
                return [...col, val];
            }
            case 'prepend': {
                const val = node.args?.[0]
                    ? this.evalNode(node.args[0], context, scope)
                    : null;
                return [val, ...col];
            }
            case 'insertAt': {
                const pos = node.args?.[0]
                    ? this.toNumber(this.evalNode(node.args[0], context, scope))
                    : 1;
                const val = node.args?.[1]
                    ? this.evalNode(node.args[1], context, scope)
                    : null;
                const result = [...col];
                result.splice(pos - 1, 0, val);
                return result;
            }
            case 'subOrderedSet':
            case 'subSequence': {
                const lower = node.args?.[0]
                    ? this.toNumber(this.evalNode(node.args[0], context, scope))
                    : 1;
                const upper = node.args?.[1]
                    ? this.toNumber(this.evalNode(node.args[1], context, scope))
                    : col.length;
                return col.slice(lower - 1, upper);
            }
            case 'indexOf': {
                const val = node.args?.[0]
                    ? this.evalNode(node.args[0], context, scope)
                    : undefined;
                for (let i = 0; i < col.length; i++) {
                    if (this.isEqual(col[i], val))
                        return i + 1;
                }
                return 0;
            }
            case 'reverse':
                return [...col].reverse();
            case 'includingAll': {
                const other = node.args?.[0]
                    ? this.evalNode(node.args[0], context, scope)
                    : [];
                const otherArr = Array.isArray(other) ? other : [];
                return [...col, ...otherArr];
            }
            case 'excludingAll': {
                const other = node.args?.[0]
                    ? this.evalNode(node.args[0], context, scope)
                    : [];
                const otherArr = Array.isArray(other) ? other : [];
                return col.filter((item) => !otherArr.some((o) => this.isEqual(item, o)));
            }
            case 'product': {
                const other = node.args?.[0]
                    ? this.evalNode(node.args[0], context, scope)
                    : [];
                const otherArr = Array.isArray(other) ? other : [];
                const result = [];
                for (const a of col) {
                    for (const b of otherArr) {
                        const tuple = new Map();
                        tuple.set('first', a);
                        tuple.set('second', b);
                        result.push(tuple);
                    }
                }
                return result;
            }
            case 'selectByKind': {
                const typeName = node.args?.[0]
                    ? String(this.evalNode(node.args[0], context, scope))
                    : '';
                return col.filter((item) => this.isEObject(item) && this.isKindOf(item, typeName));
            }
            case 'selectByType': {
                const typeName = node.args?.[0]
                    ? String(this.evalNode(node.args[0], context, scope))
                    : '';
                return col.filter((item) => this.isEObject(item) && this.isTypeOf(item, typeName));
            }
            default:
                throw new Error(`Unknown collection operation: ${node.operation}`);
        }
    }
    // ── Tuple & @pre ─────────────────────────────────────────────────
    evalTupleLiteral(node, context, scope) {
        const map = new Map();
        for (const part of node.parts) {
            map.set(part.name, this.evalNode(part.value, context, scope));
        }
        return map;
    }
    evalAtPre(node, context, scope) {
        // @pre requires a pre-state context. If not available, evaluate normally.
        // In a full postcondition evaluator, we'd look up the pre-state.
        // For now, evaluate the inner expression (best-effort without pre-state).
        if (scope.has('__preState__')) {
            const preContext = scope.get('__preState__');
            return this.evalNode(node.expression, preContext, scope);
        }
        return this.evalNode(node.expression, context, scope);
    }
    // ── Multi-iterator helper ────────────────────────────────────────
    evalMultiIterator(col, iterators, body, context, scope, mode) {
        // Generate all combinations via recursive nested loops
        const evalCombination = (depth, currentScope) => {
            if (depth >= iterators.length) {
                const result = this.toBoolean(this.evalNode(body, context, currentScope));
                return mode === 'forAll' ? result : result;
            }
            for (const item of col) {
                const newScope = new Map(currentScope);
                newScope.set(iterators[depth], item);
                const result = evalCombination(depth + 1, newScope);
                if (mode === 'forAll' && !result)
                    return false;
                if (mode === 'exists' && result)
                    return true;
            }
            return mode === 'forAll'; // forAll: true if all pass; exists: false if none found
        };
        return evalCombination(0, scope);
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
    toBooleanOrNull(val) {
        if (val === null || val === undefined)
            return null;
        return this.toBoolean(val);
    }
    compareValues(left, right) {
        // String lexicographic comparison
        if (typeof left === 'string' && typeof right === 'string') {
            return left.localeCompare(right);
        }
        // Numeric comparison
        return this.toNumber(left) - this.toNumber(right);
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