import { MTLFileManager } from './MTLFileManager.js';
export class MTLExecutor {
    fileManager;
    traceOutput = [];
    /** Memoization cache for query results (cleared per execute() call) */
    queryMemo = new Map();
    /** Module metadata for visibility enforcement */
    moduleRegistry = new Map();
    /** Maps template/query name → owning module name */
    symbolOwner = new Map();
    /** Maps template name → parent (overridden) function for super calls */
    superMap = new Map();
    /** Current executing module name (for visibility checks) */
    currentModule = null;
    /** Properties files loaded for getProperty() support */
    properties = new Map();
    /** Execution log entries */
    executionLog = [];
    /** Trace entries mapping output regions to source */
    traceEntries = [];
    /** Execution start time (for relative timestamps) */
    execStartTime = 0;
    /** Whether tracing/logging is enabled (opt-in for performance) */
    loggingEnabled = false;
    /** Root model object (for allInstances) */
    rootModel = null;
    /** Iteration stack for current() support — each entry is { collection, index } */
    iterationStack = [];
    constructor() {
        this.fileManager = new MTLFileManager();
    }
    /**
     * Load properties files for use with getProperty() in MTL expressions.
     * @param files - Array of { name, content } where content is key=value format
     */
    loadProperties(files) {
        this.properties.clear();
        for (const file of files) {
            const props = new Map();
            for (const line of file.content.split('\n')) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!'))
                    continue;
                const eqIdx = trimmed.indexOf('=');
                if (eqIdx > 0) {
                    const key = trimmed.slice(0, eqIdx).trim();
                    const value = trimmed.slice(eqIdx + 1).trim();
                    props.set(key, value);
                }
            }
            this.properties.set(file.name, props);
        }
    }
    /**
     * Execute parsed MTL templates against a model object.
     * @param options.enableLogging - If true, collect execution log and trace data
     */
    execute(nodes, model, options) {
        try {
            this.traceOutput = [];
            this.fileManager = new MTLFileManager();
            this.queryMemo.clear();
            this.moduleRegistry.clear();
            this.symbolOwner.clear();
            this.superMap.clear();
            this.currentModule = null;
            this.executionLog = [];
            this.traceEntries = [];
            this.loggingEnabled = options?.enableLogging ?? false;
            this.execStartTime = Date.now();
            this.rootModel = model;
            this.iterationStack = [];
            const mainTemplate = this.findMainTemplate(nodes);
            if (!mainTemplate) {
                return { output: '', files: [], error: 'No @main template found. Mark a template with [comment @main/].' };
            }
            const context = {
                self: model,
                ...this.resolveQueryCache(nodes),
                // Built-in: getProperty(key), getProperty(file, key), getProperty(key, params)
                getProperty: (...args) => this.resolveProperty(args),
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
            // Set currentModule to the module owning @main
            for (const n of nodes) {
                if (n.type === 'module' && n.templates.some(t => t === mainTemplate)) {
                    this.currentModule = n.name;
                    break;
                }
            }
            // Log main template start
            if (this.loggingEnabled) {
                this.executionLog.push({
                    type: 'template-start',
                    timestamp: Date.now() - this.execStartTime,
                    templateName: mainTemplate.name,
                    moduleName: this.currentModule ?? 'main',
                    args: model && typeof model === 'object' ? this.summarizeArg(model) : undefined,
                });
            }
            // Execute main template body (file blocks capture to fileManager, text to output)
            const output = this.executeNodes(mainTemplate.body, context);
            // Log main template end
            if (this.loggingEnabled) {
                const endTs = Date.now() - this.execStartTime;
                this.executionLog.push({
                    type: 'template-end',
                    timestamp: endTs,
                    templateName: mainTemplate.name,
                    moduleName: this.currentModule ?? 'main',
                    duration: endTs,
                    outputLength: output.length,
                });
            }
            const executionTime = Date.now() - this.execStartTime;
            return {
                output,
                files: this.fileManager.getFiles(),
                lostFiles: this.fileManager.getLostFiles(),
                stats: this.fileManager.getStats(),
                log: this.loggingEnabled ? this.executionLog : undefined,
                traces: this.loggingEnabled ? this.traceEntries : undefined,
                executionTime,
            };
        }
        catch (err) {
            const executionTime = Date.now() - this.execStartTime;
            if (this.loggingEnabled) {
                this.executionLog.push({
                    type: 'error',
                    timestamp: executionTime,
                    message: err.message ?? String(err),
                });
            }
            return {
                output: '',
                files: this.fileManager.getFiles(),
                error: err.message ?? String(err),
                log: this.loggingEnabled ? this.executionLog : undefined,
                executionTime,
            };
        }
    }
    resolveQueryCache(nodes) {
        const cache = {};
        const modules = [];
        // 1. Collect all modules and register standalone queries/templates
        for (const n of nodes) {
            if (n.type === 'module') {
                modules.push(n);
                this.moduleRegistry.set(n.name, n);
            }
            if (n.type === 'query') {
                cache[n.name] = (...args) => {
                    const cacheKey = `${n.name}:${JSON.stringify(args)}`;
                    if (this.queryMemo.has(cacheKey))
                        return this.queryMemo.get(cacheKey);
                    const qCtx = { ...cache };
                    n.params.forEach((p, i) => { qCtx[p.name] = args[i]; });
                    qCtx.self = args[0];
                    const result = this.evaluateExpression(n.expression, qCtx);
                    this.queryMemo.set(cacheKey, result);
                    return result;
                };
            }
        }
        // 2. Build extends chain and process modules in dependency order (parents first)
        const processed = new Set();
        const processModule = (mod) => {
            if (processed.has(mod.name))
                return;
            // Process parent first if extends
            if (mod.extends) {
                const parent = modules.find(m => m.name === mod.extends);
                if (parent)
                    processModule(parent);
            }
            processed.add(mod.name);
            // Register queries with memoization
            for (const q of mod.queries) {
                this.symbolOwner.set(q.name, mod.name);
                cache[q.name] = (...args) => {
                    const cacheKey = `${q.name}:${JSON.stringify(args)}`;
                    if (this.queryMemo.has(cacheKey))
                        return this.queryMemo.get(cacheKey);
                    this.checkVisibility(q.name, q.visibility, mod.name);
                    const qCtx = { ...cache };
                    q.params.forEach((p, i) => { qCtx[p.name] = args[i]; });
                    qCtx.self = args[0];
                    const result = this.evaluateExpression(q.expression, qCtx);
                    this.queryMemo.set(cacheKey, result);
                    return result;
                };
            }
            // Register templates (child overrides parent if same name)
            for (const t of mod.templates) {
                const parentFn = cache[t.name]; // save parent version for super
                if (parentFn && t.overrides) {
                    this.superMap.set(`${mod.name}:${t.name}`, parentFn);
                }
                this.symbolOwner.set(t.name, mod.name);
                cache[t.name] = (...args) => {
                    this.checkVisibility(t.name, t.visibility, mod.name);
                    // Check guard
                    if (t.guard) {
                        const guardCtx = { ...cache, self: args[0] };
                        t.params.forEach((p, i) => { guardCtx[p.name] = args[i]; });
                        const guardVal = this.evaluateExpression(t.guard, guardCtx);
                        if (!this.isTruthy(guardVal))
                            return '';
                    }
                    // Log template start
                    const startTs = this.loggingEnabled ? Date.now() - this.execStartTime : 0;
                    if (this.loggingEnabled) {
                        this.executionLog.push({
                            type: 'template-start',
                            timestamp: startTs,
                            templateName: t.name,
                            moduleName: mod.name,
                            args: args.length > 0 ? this.summarizeArg(args[0]) : undefined,
                        });
                    }
                    // Execute template body
                    const prevModule = this.currentModule;
                    this.currentModule = mod.name;
                    const tCtx = { ...cache, self: args[0] };
                    t.params.forEach((p, i) => { tCtx[p.name] = args[i]; });
                    // Provide super access
                    const superFn = this.superMap.get(`${mod.name}:${t.name}`);
                    if (superFn) {
                        tCtx['super'] = { [t.name]: superFn };
                    }
                    let output = this.executeNodes(t.body, tCtx);
                    // Apply post-treatment
                    if (t.post) {
                        output = this.applyPostTreatment(output, t.post);
                    }
                    this.currentModule = prevModule;
                    // Log template end
                    if (this.loggingEnabled) {
                        const endTs = Date.now() - this.execStartTime;
                        this.executionLog.push({
                            type: 'template-end',
                            timestamp: endTs,
                            templateName: t.name,
                            moduleName: mod.name,
                            duration: endTs - startTs,
                            outputLength: output.length,
                        });
                    }
                    return output;
                };
            }
        };
        for (const m of modules)
            processModule(m);
        return cache;
    }
    /**
     * Check visibility of a symbol being accessed from the current module.
     * Throws if access is not allowed.
     */
    checkVisibility(symbolName, visibility, ownerModule) {
        if (visibility === 'public')
            return; // always accessible
        if (!this.currentModule)
            return; // top-level call (from @main), allow
        if (this.currentModule === ownerModule)
            return; // same module, allow
        if (visibility === 'private') {
            throw new Error(`Template/query '${symbolName}' is private and cannot be accessed from module '${this.currentModule}'`);
        }
        if (visibility === 'protected') {
            // Check if currentModule extends ownerModule (directly or transitively)
            let mod = this.moduleRegistry.get(this.currentModule);
            while (mod?.extends) {
                if (mod.extends === ownerModule)
                    return; // allowed via extends chain
                mod = this.moduleRegistry.get(mod.extends);
            }
            throw new Error(`Template/query '${symbolName}' is protected and cannot be accessed from module '${this.currentModule}' (not in extends chain)`);
        }
    }
    /**
     * Summarize a model element argument for logging (avoid huge serialization).
     */
    summarizeArg(arg) {
        if (arg == null)
            return 'null';
        if (typeof arg === 'string')
            return arg.length > 40 ? arg.slice(0, 40) + '...' : arg;
        if (typeof arg === 'number' || typeof arg === 'boolean')
            return String(arg);
        if (Array.isArray(arg))
            return `[${arg.length} items]`;
        // EObject-like
        if (arg.eClass) {
            const name = arg.name || arg.eClass?.name || '?';
            const type = arg.eClass?.name || 'EObject';
            return `${type}(${name})`;
        }
        return typeof arg;
    }
    /**
     * Apply post-treatment expression to template output.
     * The expression operates on `self` which is the output string.
     */
    applyPostTreatment(output, postExpr) {
        // Common post expressions: trim(), replaceAll('x', 'y')
        const ctx = { self: output };
        const result = this.evaluateExpression(postExpr, ctx);
        if (typeof result === 'string')
            return result;
        // If expression returned the string via method call on self
        return output;
    }
    /**
     * Resolve getProperty() calls.
     * Signatures:
     *   getProperty('key') — search all loaded properties files
     *   getProperty('filename', 'key') — search specific file
     *   getProperty('key', Sequence{params}) — interpolate {0}, {1}, etc.
     */
    resolveProperty(args) {
        if (args.length === 0)
            return '';
        // getProperty('key') — search all files
        if (args.length === 1) {
            const key = String(args[0]);
            for (const props of Array.from(this.properties.values())) {
                const val = props.get(key);
                if (val !== undefined)
                    return val;
            }
            return '';
        }
        // getProperty('filename', 'key') or getProperty('key', Sequence{params})
        if (args.length === 2) {
            if (Array.isArray(args[1])) {
                // getProperty('key', [param0, param1, ...])
                const key = String(args[0]);
                let value = '';
                for (const props of Array.from(this.properties.values())) {
                    const v = props.get(key);
                    if (v !== undefined) {
                        value = v;
                        break;
                    }
                }
                // Interpolate {0}, {1}, etc.
                return value.replace(/\{(\d+)\}/g, (_, idx) => {
                    const i = parseInt(idx, 10);
                    return i < args[1].length ? String(args[1][i]) : `{${idx}}`;
                });
            }
            else {
                // getProperty('filename', 'key')
                const fileName = String(args[0]);
                const key = String(args[1]);
                const props = this.properties.get(fileName);
                if (props)
                    return props.get(key) ?? '';
                // Fallback: try partial match on filename
                for (const [name, p] of Array.from(this.properties.entries())) {
                    if (name.endsWith(fileName) || name.includes(fileName)) {
                        const val = p.get(key);
                        if (val !== undefined)
                            return val;
                    }
                }
                return '';
            }
        }
        return '';
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
                    this.iterationStack.push({ collection, index: i });
                    const iterContext = { ...context, [node.iterator]: collection[i], self: collection[i] };
                    result += this.executeNodes(node.body, iterContext);
                    this.iterationStack.pop();
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
                this.fileManager.addFile(fileName, content, node.openMode, node.encoding);
                if (this.loggingEnabled) {
                    this.executionLog.push({
                        type: 'file-write',
                        timestamp: Date.now() - this.execStartTime,
                        fileName,
                        outputLength: content.length,
                        message: `${node.openMode || 'overwrite'} → ${fileName} (${content.length} chars)`,
                    });
                }
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
        // Not operator: not expr
        if (trimmed.startsWith('not ')) {
            return !this.isTruthy(this.evaluateExpression(trimmed.slice(4).trim(), context));
        }
        // Let expression: let varName : Type = expr in body
        const letMatch = trimmed.match(/^let\s+(\w+)\s*(?::\s*\w+)?\s*=\s*(.+?)\s+in\s+(.+)$/);
        if (letMatch) {
            const varName = letMatch[1];
            const varValue = this.evaluateExpression(letMatch[2].trim(), context);
            const newCtx = { ...context, [varName]: varValue };
            return this.evaluateExpression(letMatch[3].trim(), newCtx);
        }
        // Inline if-then-else: if cond then expr1 else expr2 endif
        const ifMatch = trimmed.match(/^if\s+(.+?)\s+then\s+(.+?)\s+else\s+(.+?)(?:\s+endif)?$/);
        if (ifMatch) {
            const cond = this.evaluateExpression(ifMatch[1].trim(), context);
            if (this.isTruthy(cond)) {
                return this.evaluateExpression(ifMatch[2].trim(), context);
            }
            else {
                return this.evaluateExpression(ifMatch[3].trim(), context);
            }
        }
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
            // current(n) — standalone call for iteration stack access
            if (funcName === 'current') {
                const args = this.parseFunctionArgs(rawArgs, context);
                const depth = args.length > 0 ? Number(args[0]) : 0;
                const stackIdx = this.iterationStack.length - 1 - depth;
                if (stackIdx >= 0 && stackIdx < this.iterationStack.length) {
                    const frame = this.iterationStack[stackIdx];
                    return frame.collection[frame.index];
                }
                return context.self;
            }
            // Resolve first part as variable then call method
        }
        // Arrow operations: find the LAST '->' outside parentheses, split there
        const arrowIdx = this.findLastArrowOutsideParens(expr);
        if (arrowIdx >= 0) {
            const sourcePart = expr.slice(0, arrowIdx).trim();
            const opPart = expr.slice(arrowIdx + 2).trim(); // skip '->'
            // Parse operation: name(args) or name(iter | body)
            const opMatch = opPart.match(/^([a-zA-Z_]\w*)\s*\(([\s\S]*)\)\s*$/);
            if (opMatch) {
                const source = this.evaluateExpression(sourcePart, context);
                const operation = opMatch[1];
                const innerArgs = opMatch[2].trim();
                // Check if it's a lambda: iter | body
                const pipeIdx = this.findPipeOutsideParens(innerArgs);
                if (pipeIdx >= 0) {
                    const iterator = innerArgs.slice(0, pipeIdx).trim();
                    const body = innerArgs.slice(pipeIdx + 1).trim();
                    if (/^\w+$/.test(iterator)) {
                        return this.executeArrowOpWithLambda(source, operation, iterator, body, context);
                    }
                }
                return this.executeArrowOp(source, operation, innerArgs, context);
            }
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
            case 'excludesAll': return Array.isArray(arg0) && arg0.every((a) => !source.includes(a));
            case 'flatten': return source.flat();
            case 'reverse': return [...source].reverse();
            case 'asSequence': return [...source];
            case 'asOrderedSet': {
                const unique = [];
                const seen = new Set();
                for (const item of source) {
                    if (!seen.has(item)) {
                        seen.add(item);
                        unique.push(item);
                    }
                }
                return unique;
            }
            case 'asSet': {
                const unique2 = [];
                const seen2 = new Set();
                for (const item of source) {
                    if (!seen2.has(item)) {
                        seen2.add(item);
                        unique2.push(item);
                    }
                }
                return unique2;
            }
            case 'asBag': return [...source];
            case 'sum': return source.reduce((a, b) => a + (Number(b) || 0), 0);
            case 'indexOf': return source.indexOf(arg0);
            case 'including': return source.includes(arg0) ? source : [...source, arg0];
            case 'excluding': return source.filter((x) => x !== arg0);
            case 'union': return [...source, ...(Array.isArray(arg0) ? arg0 : [])];
            case 'intersection': return source.filter((x) => arg0?.includes?.(x));
            case 'prepend': return [arg0, ...source];
            case 'append': return [...source, arg0];
            case 'sep': return source.join(String(arg0 ?? ', '));
            case 'subSequence': {
                // subSequence(lower, upper) — 1-indexed, inclusive
                const args = rawArgs.split(',').map(a => Number(this.evaluateExpression(a.trim(), context)));
                const lower = (args[0] ?? 1) - 1; // convert to 0-indexed
                const upper = args[1] ?? source.length;
                return source.slice(lower, upper);
            }
            case 'subOrderedSet': {
                const args2 = rawArgs.split(',').map(a => Number(this.evaluateExpression(a.trim(), context)));
                const lo = (args2[0] ?? 1) - 1;
                const hi = args2[1] ?? source.length;
                return source.slice(lo, hi);
            }
            case 'insertAt': {
                const args3 = rawArgs.split(',').map(a => a.trim());
                const idx = Number(this.evaluateExpression(args3[0], context)) - 1;
                const val = this.evaluateExpression(args3[1], context);
                const copy = [...source];
                copy.splice(idx, 0, val);
                return copy;
            }
            case 'count': return source.filter((x) => x === arg0).length;
            case 'product': return source.reduce((a, b) => a * (Number(b) || 1), 1);
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
            case 'any':
                return source.some((item) => {
                    const ctx = { ...context, [iterator]: item, self: item };
                    return this.isTruthy(this.evaluateExpression(body, ctx));
                });
            case 'filter':
                return source.filter((item) => {
                    const ctx = { ...context, [iterator]: item, self: item };
                    return this.isTruthy(this.evaluateExpression(body, ctx));
                });
            case 'collectNested':
                return source.map((item) => {
                    const ctx = { ...context, [iterator]: item, self: item };
                    return this.evaluateExpression(body, ctx);
                }).flat();
            case 'closure': {
                // closure(iter | body) — transitive closure: repeatedly apply body until no new elements
                const result = [];
                const visited = new Set();
                let pending = [...source];
                while (pending.length > 0) {
                    const next = [];
                    for (const item of pending) {
                        if (visited.has(item))
                            continue;
                        visited.add(item);
                        result.push(item);
                        const ctx = { ...context, [iterator]: item, self: item };
                        const val = this.evaluateExpression(body, ctx);
                        if (Array.isArray(val)) {
                            for (const v of val) {
                                if (!visited.has(v))
                                    next.push(v);
                            }
                        }
                        else if (val !== null && val !== undefined && !visited.has(val)) {
                            next.push(val);
                        }
                    }
                    pending = next;
                }
                return result;
            }
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
        // Universal OCL methods (apply to any object)
        switch (method) {
            case 'oclIsUndefined': return obj === null || obj === undefined;
            case 'oclIsKindOf': return this.isEObject(obj) ? obj.eClass().name === String(args[0]) : false;
            case 'oclIsTypeOf': return this.isEObject(obj) ? obj.eClass().name === String(args[0]) : false;
            case 'oclAsType': return obj;
            case 'toString': return String(obj);
            case 'allInstances': {
                // Type.allInstances() — collect all instances of a type from the model tree
                const typeName = typeof obj === 'string' ? obj : (this.isEObject(obj) ? obj.eClass().name : String(obj));
                return this.collectAllInstances(typeName);
            }
            case 'invoke': {
                // invoke('className', 'methodSig', args) — non-standard Acceleo, no-op in web context
                return undefined;
            }
            case 'current': {
                // current() — returns current iteration element; current(n) — n-th enclosing
                if (this.iterationStack.length === 0)
                    return obj;
                const depth = args.length > 0 ? Number(args[0]) : 0;
                const stackIdx = this.iterationStack.length - 1 - depth;
                if (stackIdx < 0 || stackIdx >= this.iterationStack.length)
                    return undefined;
                const frame = this.iterationStack[stackIdx];
                return frame.collection[frame.index];
            }
        }
        // String methods
        if (typeof obj === 'string') {
            switch (method) {
                case 'size': return obj.length;
                case 'toUpper': return obj.toUpperCase();
                case 'toUpperFirst': return obj.charAt(0).toUpperCase() + obj.slice(1);
                case 'toLower': return obj.toLowerCase();
                case 'toLowerFirst': return obj.charAt(0).toLowerCase() + obj.slice(1);
                case 'trim': return obj.trim();
                case 'concat': return obj + String(args[0] ?? '');
                case 'substring': return obj.slice(args[0], args[1]);
                case 'startsWith': return obj.startsWith(String(args[0]));
                case 'endsWith': return obj.endsWith(String(args[0]));
                case 'matches': return new RegExp(String(args[0])).test(obj);
                case 'replaceAll':
                case 'substituteAll': return obj.replace(new RegExp(String(args[0]), 'g'), String(args[1] ?? ''));
                case 'toInteger': return parseInt(obj, 10);
                case 'tokenize': return obj.split(String(args[0] ?? '\\\\s+'));
                case 'indexOf':
                case 'index': return obj.indexOf(String(args[0]));
                case 'first': return obj.charAt(0);
                case 'last': return obj.charAt(obj.length - 1);
                case 'lastIndex':
                case 'lastIndexOf': return obj.lastIndexOf(String(args[0]));
                case 'contains': return obj.includes(String(args[0]));
                case 'replace':
                case 'substitute': return obj.replace(String(args[0]), String(args[1] ?? ''));
                case 'prefix': return String(args[0] ?? '') + obj;
                case 'toReal': return parseFloat(obj);
                case 'isAlpha': return /^[a-zA-Z]+$/.test(obj);
                case 'isAlphaNum': return /^[a-zA-Z0-9]+$/.test(obj);
                case 'strcmp': return obj.localeCompare(String(args[0]));
                case 'equalsIgnoreCase': return obj.toLowerCase() === String(args[0]).toLowerCase();
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
                case 'reverse': return [...obj].reverse();
                case 'asOrderedSet': {
                    const unique2 = [];
                    const seen2 = new Set();
                    for (const item of obj) {
                        if (!seen2.has(item)) {
                            seen2.add(item);
                            unique2.push(item);
                        }
                    }
                    return unique2;
                }
                case 'asBag': return [...obj];
                case 'indexOf': return obj.indexOf(args[0]);
                case 'insertAt': {
                    const idx = Number(args[0]);
                    return [...obj.slice(0, idx), args[1], ...obj.slice(idx)];
                }
                case 'sep': return obj.join(String(args[0] ?? ', '));
                case 'excludesAll': return Array.isArray(args[0]) && args[0].every((a) => !obj.includes(a));
                case 'includesAll': return Array.isArray(args[0]) && args[0].every((a) => obj.includes(a));
                case 'collect': return obj.map((x) => this.resolveOnObject(x, String(args[0])));
                case 'sortedBy': return [...obj].sort((a, b) => { const va = this.resolveOnObject(a, String(args[0])); const vb = this.resolveOnObject(b, String(args[0])); return va < vb ? -1 : va > vb ? 1 : 0; });
            }
        }
        // EObject reflexive methods
        if (this.isEObject(obj)) {
            switch (method) {
                case 'eClass': return obj.eClass();
                case 'eGet': {
                    const feature = obj.eClass().getEStructuralFeature(String(args[0]));
                    return feature ? obj.eGet(feature) : undefined;
                }
                case 'eAllContents': return this.flattenEAllContents(obj);
                case 'eContainer': return obj.eContainer();
                case 'eContainingFeature': return obj.eContainingFeature();
                case 'eContents': {
                    const eClass = obj.eClass();
                    const refs = eClass.eAllReferences || eClass.eAllStructuralFeatures?.filter?.((f) => f.eType?.name !== 'EDataType') || [];
                    const result = [];
                    for (const ref of refs) {
                        const val = obj.eGet(ref);
                        if (Array.isArray(val))
                            result.push(...val);
                        else if (val)
                            result.push(val);
                    }
                    return result;
                }
                case 'oclIsKindOf': {
                    const typeName = String(args[0]);
                    const eClass = obj.eClass();
                    return eClass.name === typeName;
                }
                case 'oclIsTypeOf': {
                    const typeName = String(args[0]);
                    const eClass = obj.eClass();
                    return eClass.name === typeName;
                }
                case 'oclAsType': return obj;
                case 'oclIsUndefined': return false;
                case 'ancestors': {
                    const result = [];
                    let cur = obj.eContainer();
                    while (cur) {
                        result.push(cur);
                        cur = cur.eContainer?.();
                    }
                    return result;
                }
                case 'siblings': {
                    const container = obj.eContainer();
                    if (!container)
                        return [];
                    const feat = obj.eContainingFeature();
                    if (!feat)
                        return [];
                    const siblings = container.eGet(feat);
                    return Array.isArray(siblings) ? siblings.filter((s) => s !== obj) : [];
                }
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
    /**
     * Collect all instances of a given type name from the root model tree.
     * Used by Type.allInstances() OCL operation.
     */
    collectAllInstances(typeName) {
        if (!this.rootModel)
            return [];
        const result = [];
        const visited = new Set();
        const walk = (o) => {
            if (!this.isEObject(o) || visited.has(o))
                return;
            visited.add(o);
            if (o.eClass().name === typeName) {
                result.push(o);
            }
            const eClass = o.eClass();
            for (const ref of eClass.eAllReferences || []) {
                const val = o.eGet(ref);
                if (Array.isArray(val)) {
                    for (const child of val)
                        walk(child);
                }
                else if (val) {
                    walk(val);
                }
            }
        };
        walk(this.rootModel);
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
            else if (depth === 0 && str.startsWith(op, i)) {
                // Skip '>' or '>=' when preceded by '-' (part of '->' arrow operator)
                if ((op === '>' || op === '>=') && i > 0 && str[i - 1] === '-')
                    continue;
                // Skip '<' or '<=' or '<>' when followed by context that looks like a type param
                return i;
            }
        }
        return -1;
    }
    /** Find the last '->' outside parentheses (for chained arrow operations) */
    findLastArrowOutsideParens(str) {
        let depth = 0;
        let lastIdx = -1;
        for (let i = 0; i < str.length - 1; i++) {
            if (str[i] === '(' || str[i] === '[')
                depth++;
            else if (str[i] === ')' || str[i] === ']')
                depth--;
            else if (depth === 0 && str[i] === '-' && str[i + 1] === '>') {
                lastIdx = i;
            }
        }
        return lastIdx;
    }
    /** Find first '|' outside parentheses (for lambda separator) */
    findPipeOutsideParens(str) {
        let depth = 0;
        for (let i = 0; i < str.length; i++) {
            if (str[i] === '(' || str[i] === '[')
                depth++;
            else if (str[i] === ')' || str[i] === ']')
                depth--;
            else if (depth === 0 && str[i] === '|')
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