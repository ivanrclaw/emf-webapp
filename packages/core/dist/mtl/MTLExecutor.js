import { MTLFileManager } from './MTLFileManager.js';
export class MTLExecutor {
    fileManager;
    traceOutput = [];
    constructor() {
        this.fileManager = new MTLFileManager();
    }
    /**
     * Execute parsed MTL templates against a model object.
     */
    execute(nodes, model) {
        try {
            this.traceOutput = [];
            this.fileManager = new MTLFileManager();
            const mainTemplate = this.findMainTemplate(nodes);
            if (!mainTemplate) {
                return { output: '', files: [], error: 'No @main template found. Mark a template with [comment @main/].' };
            }
            const context = {
                self: model,
                ...this.resolveQueryCache(nodes),
            };
            // Bind first param name to model
            if (mainTemplate.params.length > 0) {
                context[mainTemplate.params[0].name] = model;
            }
            // Check guard
            if (mainTemplate.guard) {
                const guardVal = this.evaluateExpression(mainTemplate.guard, context);
                if (!this.isTruthy(guardVal)) {
                    return { output: '', files: [], error: `Template guard "${mainTemplate.guard}" evaluated to false` };
                }
            }
            // Execute main template body (file blocks capture to fileManager, text to output)
            const output = this.executeNodes(mainTemplate.body, context);
            return {
                output,
                files: this.fileManager.getFiles(),
            };
        }
        catch (err) {
            return {
                output: '',
                files: this.fileManager.getFiles(),
                error: err.message ?? String(err),
            };
        }
    }
    resolveQueryCache(nodes) {
        const cache = {};
        const collect = (list) => {
            for (const n of list) {
                if (n.type === 'query') {
                    cache[n.name] = (...args) => {
                        const qCtx = {};
                        n.params.forEach((p, i) => { qCtx[p.name] = args[i]; });
                        qCtx.self = args[0];
                        return this.evaluateExpression(n.expression, qCtx);
                    };
                }
                if (n.type === 'module') {
                    for (const t of n.templates)
                        cache[t.name] = (...args) => {
                            const tCtx = { self: args[0] };
                            t.params.forEach((p, i) => { tCtx[p.name] = args[i]; });
                            return this.executeNodes(t.body, tCtx);
                        };
                    collect(n.queries);
                }
            }
        };
        collect(nodes);
        return cache;
    }
    findMainTemplate(nodes) {
        let fallback = null;
        for (const node of nodes) {
            if (node.type === 'template') {
                if (node.isMain)
                    return node;
                if (!fallback && node.visibility === 'public')
                    fallback = node;
            }
            if (node.type === 'module') {
                for (const tmpl of node.templates) {
                    if (tmpl.isMain)
                        return tmpl;
                    if (!fallback && tmpl.visibility === 'public')
                        fallback = tmpl;
                }
            }
        }
        return fallback;
    }
    executeNodes(nodes, context) {
        let output = '';
        for (const node of nodes) {
            output += this.executeNode(node, context);
        }
        return output;
    }
    executeNode(node, context) {
        switch (node.type) {
            case 'text':
                return node.value;
            case 'expression': {
                const value = this.evaluateExpression(node.expression, context);
                if (value === null || value === undefined)
                    return '';
                return String(value);
            }
            case 'for': {
                const collection = this.evaluateExpression(node.collection, context);
                if (!Array.isArray(collection))
                    return '';
                let result = '';
                // before content
                if (node.before) {
                    result += this.evaluateExpressionAsString(node.before, context);
                }
                // iteration with optional separator
                for (let i = 0; i < collection.length; i++) {
                    if (i > 0 && node.separator) {
                        result += this.evaluateExpressionAsString(node.separator, context);
                    }
                    const iterContext = { ...context, [node.iterator]: collection[i], self: collection[i] };
                    result += this.executeNodes(node.body, iterContext);
                }
                // after content
                if (node.after) {
                    result += this.evaluateExpressionAsString(node.after, context);
                }
                return result;
            }
            case 'if': {
                const condition = this.evaluateExpression(node.condition, context);
                if (this.isTruthy(condition)) {
                    return this.executeNodes(node.thenBody, context);
                }
                // Check elseif clauses
                for (const elif of node.elseIfClauses) {
                    const elifVal = this.evaluateExpression(elif.condition, context);
                    if (this.isTruthy(elifVal)) {
                        return this.executeNodes(elif.body, context);
                    }
                }
                return this.executeNodes(node.elseBody, context);
            }
            case 'let': {
                const value = this.evaluateExpression(node.expression, context);
                const letContext = { ...context, [node.variable]: value };
                return this.executeNodes(node.body, letContext);
            }
            case 'file': {
                const fileName = this.evaluateExpressionAsString(node.fileName, context);
                const content = this.executeNodes(node.body, context);
                this.fileManager.addFile(fileName, content);
                return '';
            }
            case 'protected': {
                const id = this.evaluateExpressionAsString(node.id, context);
                const existingContent = this.fileManager.restoreProtected(id, '');
                if (existingContent)
                    return existingContent;
                const content = this.executeNodes(node.body, context);
                this.fileManager.captureProtected(id, content);
                return content;
            }
            case 'trace': {
                const msg = this.evaluateExpressionAsString(node.expression, context);
                const content = this.executeNodes(node.body, context);
                this.traceOutput.push(msg);
                return content;
            }
            case 'comment':
                return '';
            default:
                return '';
        }
    }
    // ─── Expression Evaluator (OCL-like) ────────────────────────────────────────
    evaluateExpression(expr, context) {
        if (!expr || typeof expr !== 'string')
            return undefined;
        const trimmed = expr.trim();
        if (!trimmed)
            return undefined;
        // String literal
        if ((trimmed.startsWith("'") && trimmed.endsWith("'")) ||
            (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
            return trimmed.slice(1, -1);
        }
        // Number literal
        const num = Number(trimmed);
        if (!isNaN(num) && /^-?\d+(\.\d+)?$/.test(trimmed))
            return num;
        // Boolean / null
        if (trimmed === 'true')
            return true;
        if (trimmed === 'false')
            return false;
        if (trimmed === 'null')
            return null;
        if (trimmed === 'undefined')
            return undefined;
        // String concatenation with +
        if (trimmed.includes('+')) {
            const parts = this.splitByOperatorOutsideParens(trimmed, '+');
            if (parts.length > 1) {
                return parts.map(p => {
                    const v = this.evaluateExpression(p.trim(), context);
                    return v === null || v === undefined ? '' : String(v);
                }).join('');
            }
        }
        // Comparison operators
        const cmpOps = ['>=', '<=', '!=', '=', '<>', '>', '<'];
        for (const op of cmpOps) {
            const idx = this.findOperatorOutsideParens(trimmed, op);
            if (idx >= 0) {
                const left = this.evaluateExpression(trimmed.slice(0, idx).trim(), context);
                const right = this.evaluateExpression(trimmed.slice(idx + op.length).trim(), context);
                switch (op) {
                    case '=':
                    case '==': return left == right;
                    case '!=':
                    case '<>': return left != right;
                    case '>': return left > right;
                    case '<': return left < right;
                    case '>=': return left >= right;
                    case '<=': return left <= right;
                }
            }
        }
        // Logical operators (and, or)
        if (/\band\b/.test(trimmed)) {
            const parts = trimmed.split(/\band\b/).map(s => s.trim());
            if (parts.length > 1) {
                return parts.every(p => this.isTruthy(this.evaluateExpression(p, context)));
            }
        }
        if (/\bor\b/.test(trimmed)) {
            const parts = trimmed.split(/\bor\b/).map(s => s.trim());
            if (parts.length > 1) {
                return parts.some(p => this.isTruthy(this.evaluateExpression(p, context)));
            }
        }
        // Method calls / chain navigation
        return this.resolveNavigation(trimmed, context);
    }
    /**
     * Resolve dot-notation and method call chains.
     * Supports: self.attr, obj.method(), obj->method(args), obj.attr.sub
     * Also handles function/query calls from context (e.g., generateInterface(c))
     */
    resolveNavigation(expr, context) {
        // Function call pattern: funcName(args)
        const funcMatch = expr.match(/^([a-zA-Z_]\w*)\s*\((.+)\)$/);
        if (funcMatch) {
            const funcName = funcMatch[1];
            const rawArgs = funcMatch[2];
            // Check if it's a query in context
            if (typeof context[funcName] === 'function') {
                const args = this.parseFunctionArgs(rawArgs, context);
                return context[funcName](...args);
            }
            // Resolve first part as variable then call method
        }
        // Arrow operations: expr->operation(args)
        const arrowMatch = expr.match(/^(.+?)\s*->\s*([a-zA-Z_]\w*)\s*\((.*)\)\s*$/);
        if (arrowMatch) {
            const source = this.evaluateExpression(arrowMatch[1].trim(), context);
            const operation = arrowMatch[2];
            const rawArgs = arrowMatch[3].trim();
            return this.executeArrowOp(source, operation, rawArgs, context);
        }
        // Arrow operation with lambda: expr->op(iter | body)
        const arrowLambdaMatch = expr.match(/^(.+?)\s*->\s*([a-zA-Z_]\w*)\s*\(\s*(\w+)\s*\|\s*(.+)\s*\)\s*$/);
        if (arrowLambdaMatch) {
            const source = this.evaluateExpression(arrowLambdaMatch[1].trim(), context);
            const operation = arrowLambdaMatch[2];
            const iterator = arrowLambdaMatch[3];
            const body = arrowLambdaMatch[4].trim();
            return this.executeArrowOpWithLambda(source, operation, iterator, body, context);
        }
        // Dot-notation chain: a.b.c or a.b().c()
        // Split on dots, handling parentheses
        const dotSegments = this.splitDotChain(expr);
        if (dotSegments.length === 0)
            return undefined;
        // First segment resolve
        let current;
        const first = dotSegments[0];
        if (first in context) {
            current = context[first];
        }
        else if (first === 'self') {
            current = context.self;
        }
        else {
            current = this.resolveOnObject(context.self, first);
            if (current === undefined)
                current = context[first];
        }
        // Navigate remaining
        for (let i = 1; i < dotSegments.length; i++) {
            if (current === null || current === undefined)
                return undefined;
            current = this.resolvePropertyOrMethod(current, dotSegments[i], context);
        }
        return current;
    }
    executeArrowOp(source, operation, rawArgs, context) {
        if (!Array.isArray(source))
            return undefined;
        const arg0 = rawArgs ? this.evaluateExpression(rawArgs, context) : undefined;
        switch (operation) {
            case 'size': return source.length;
            case 'isEmpty': return source.length === 0;
            case 'notEmpty': return source.length > 0;
            case 'first': return source[0];
            case 'last': return source[source.length - 1];
            case 'at': return source[Number(arg0)];
            case 'includes': return source.includes(arg0);
            case 'excludes': return !source.includes(arg0);
            case 'includesAll': return Array.isArray(arg0) && arg0.every((a) => source.includes(a));
            default: return undefined;
        }
    }
    executeArrowOpWithLambda(source, operation, iterator, body, context) {
        if (!Array.isArray(source))
            return undefined;
        switch (operation) {
            case 'select':
                return source.filter((item) => {
                    const ctx = { ...context, [iterator]: item, self: item };
                    return this.isTruthy(this.evaluateExpression(body, ctx));
                });
            case 'reject':
                return source.filter((item) => {
                    const ctx = { ...context, [iterator]: item, self: item };
                    return !this.isTruthy(this.evaluateExpression(body, ctx));
                });
            case 'collect':
                return source.map((item) => {
                    const ctx = { ...context, [iterator]: item, self: item };
                    return this.evaluateExpression(body, ctx);
                });
            case 'forAll':
                return source.every((item) => {
                    const ctx = { ...context, [iterator]: item, self: item };
                    return this.isTruthy(this.evaluateExpression(body, ctx));
                });
            case 'exists':
                return source.some((item) => {
                    const ctx = { ...context, [iterator]: item, self: item };
                    return this.isTruthy(this.evaluateExpression(body, ctx));
                });
            case 'sortedBy':
                return [...source].sort((a, b) => {
                    const ctxA = { ...context, [iterator]: a, self: a };
                    const ctxB = { ...context, [iterator]: b, self: b };
                    const va = this.evaluateExpression(body, ctxA);
                    const vb = this.evaluateExpression(body, ctxB);
                    return va < vb ? -1 : va > vb ? 1 : 0;
                });
            case 'one':
                return source.filter((item) => {
                    const ctx = { ...context, [iterator]: item, self: item };
                    return this.isTruthy(this.evaluateExpression(body, ctx));
                }).length === 1;
            case 'isUnique':
                return new Set(source.map((item) => {
                    const ctx = { ...context, [iterator]: item, self: item };
                    return this.evaluateExpression(body, ctx);
                })).size === source.length;
            default:
                return undefined;
        }
    }
    resolvePropertyOrMethod(obj, segment, context) {
        // Method call: name(args)
        const methodMatch = segment.match(/^([a-zA-Z_]\w*)\s*\(\s*(.*)\s*\)\s*$/);
        if (methodMatch) {
            const method = methodMatch[1];
            const rawArgs = methodMatch[2].trim();
            return this.callMethod(obj, method, rawArgs, context);
        }
        // Property access: name
        return this.resolveOnObject(obj, segment);
    }
    callMethod(obj, method, rawArgs, context) {
        const args = rawArgs ? this.parseFunctionArgs(rawArgs, context) : [];
        // String methods
        if (typeof obj === 'string') {
            switch (method) {
                case 'size': return obj.length;
                case 'toUpper':
                case 'toUpperFirst': return obj.charAt(0).toUpperCase() + obj.slice(1);
                case 'toLower':
                case 'toLowerFirst': return obj.charAt(0).toLowerCase() + obj.slice(1);
                case 'trim': return obj.trim();
                case 'concat': return obj + String(args[0] ?? '');
                case 'substring':
                case 'substring': return obj.slice(args[0], args[1]);
                case 'startsWith': return obj.startsWith(String(args[0]));
                case 'endsWith': return obj.endsWith(String(args[0]));
                case 'matches': return new RegExp(String(args[0])).test(obj);
                case 'replaceAll': return obj.replace(new RegExp(String(args[0]), 'g'), String(args[1] ?? ''));
                case 'toInteger': return parseInt(obj, 10);
                case 'tokenize': return obj.split(String(args[0] ?? '\\s+'));
                case 'indexOf': return obj.indexOf(String(args[0]));
            }
        }
        // Number methods
        if (typeof obj === 'number') {
            switch (method) {
                case 'abs': return Math.abs(obj);
                case 'floor': return Math.floor(obj);
                case 'round': return Math.round(obj);
                case 'toString': return String(obj);
                case 'div': return Math.floor(obj / args[0]);
                case 'mod': return obj % args[0];
                case 'max': return Math.max(obj, args[0]);
                case 'min': return Math.min(obj, args[0]);
            }
        }
        // Collection methods
        if (Array.isArray(obj)) {
            switch (method) {
                case 'size': return obj.length;
                case 'isEmpty': return obj.length === 0;
                case 'notEmpty': return obj.length > 0;
                case 'first': return obj[0];
                case 'last': return obj[obj.length - 1];
                case 'at': return obj[Number(args[0])];
                case 'includes': return obj.includes(args[0]);
                case 'excludes': return !obj.includes(args[0]);
                case 'sum': return obj.reduce((a, b) => a + (Number(b) || 0), 0);
                case 'asSet': {
                    const unique = [];
                    const seen = new Set();
                    for (const item of obj) {
                        if (!seen.has(item)) {
                            seen.add(item);
                            unique.push(item);
                        }
                    }
                    return unique;
                }
                case 'asSequence': return [...obj];
                case 'flatten': return obj.flat();
                case 'append': return [...obj, args[0]];
                case 'prepend': return [args[0], ...obj];
                case 'union': return [...obj, ...(Array.isArray(args[0]) ? args[0] : [])];
                case 'intersection': return obj.filter((x) => args[0]?.includes?.(x));
                case 'including': return obj.includes(args[0]) ? obj : [...obj, args[0]];
                case 'excluding': return obj.filter((x) => x !== args[0]);
            }
        }
        // EObject reflexive methods
        if (this.isEObject(obj)) {
            switch (method) {
                case 'eClass': return obj.eClass();
                case 'eGet':
                    const feature = obj.eClass().getEStructuralFeature(String(args[0]));
                    return feature ? obj.eGet(feature) : undefined;
                case 'eAllContents': return this.flattenEAllContents(obj);
            }
        }
        // Plain object methods
        if (typeof obj === 'object' && obj !== null && typeof obj[method] === 'function') {
            return obj[method](...args);
        }
        return undefined;
    }
    flattenEAllContents(obj) {
        const result = [];
        const walk = (o) => {
            if (this.isEObject(o)) {
                const eClass = o.eClass();
                for (const ref of eClass.eAllReferences || []) {
                    const val = o.eGet(ref);
                    if (Array.isArray(val)) {
                        for (const child of val) {
                            result.push(child);
                            walk(child);
                        }
                    }
                    else if (val) {
                        result.push(val);
                        walk(val);
                    }
                }
            }
        };
        walk(obj);
        return result;
    }
    evaluateExpressionAsString(expr, context) {
        const val = this.evaluateExpression(expr, context);
        if (val === null || val === undefined)
            return '';
        return String(val);
    }
    resolveOnObject(obj, name) {
        if (obj === null || obj === undefined)
            return undefined;
        if (this.isEObject(obj)) {
            try {
                const eClass = obj.eClass();
                const feature = eClass.getEStructuralFeature(name);
                if (feature)
                    return obj.eGet(feature);
            }
            catch { /* fall through */ }
        }
        if (typeof obj === 'object' && name in obj)
            return obj[name];
        return undefined;
    }
    isEObject(obj) {
        return obj !== null && typeof obj === 'object' && typeof obj.eClass === 'function' && typeof obj.eGet === 'function';
    }
    isTruthy(value) {
        if (typeof value === 'boolean')
            return value;
        if (typeof value === 'string')
            return value.length > 0;
        if (typeof value === 'number')
            return value !== 0;
        if (Array.isArray(value))
            return value.length > 0;
        if (value === null || value === undefined)
            return false;
        return true;
    }
    // ─── Helper: split string by operator outside parentheses ──────────────────
    splitByOperatorOutsideParens(str, op) {
        const parts = [];
        let depth = 0;
        let start = 0;
        for (let i = 0; i < str.length; i++) {
            if (str[i] === '(' || str[i] === '[')
                depth++;
            else if (str[i] === ')' || str[i] === ']')
                depth--;
            else if (depth === 0 && str.startsWith(op, i)) {
                parts.push(str.slice(start, i));
                start = i + op.length;
                i += op.length - 1;
            }
        }
        parts.push(str.slice(start));
        return parts;
    }
    findOperatorOutsideParens(str, op) {
        let depth = 0;
        for (let i = 0; i <= str.length - op.length; i++) {
            if (str[i] === '(' || str[i] === '[')
                depth++;
            else if (str[i] === ')' || str[i] === ']')
                depth--;
            else if (depth === 0 && str.startsWith(op, i))
                return i;
        }
        return -1;
    }
    parseFunctionArgs(rawArgs, context) {
        if (!rawArgs.trim())
            return [];
        const args = [];
        let depth = 0;
        let start = 0;
        for (let i = 0; i < rawArgs.length; i++) {
            if (rawArgs[i] === '(' || rawArgs[i] === '[')
                depth++;
            else if (rawArgs[i] === ')' || rawArgs[i] === ']')
                depth--;
            else if (depth === 0 && rawArgs[i] === ',') {
                args.push(this.evaluateExpression(rawArgs.slice(start, i).trim(), context));
                start = i + 1;
            }
        }
        args.push(this.evaluateExpression(rawArgs.slice(start).trim(), context));
        return args;
    }
    splitDotChain(expr) {
        const segments = [];
        let depth = 0;
        let start = 0;
        for (let i = 0; i < expr.length; i++) {
            if (expr[i] === '(' || expr[i] === '[')
                depth++;
            else if (expr[i] === ')' || expr[i] === ']')
                depth--;
            else if (depth === 0 && expr[i] === '.') {
                segments.push(expr.slice(start, i).trim());
                start = i + 1;
            }
        }
        segments.push(expr.slice(start).trim());
        return segments.filter(s => s.length > 0);
    }
}
//# sourceMappingURL=MTLExecutor.js.map