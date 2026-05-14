/**
 * @emf-webapp/core — MTL Executor
 *
 * Executes a parsed MTL template AST against an EMF model context (EObject).
 * Resolves expressions via dot-notation navigation on EObject attributes/references,
 * expands for loops, evaluates if/else conditions, handles protected areas,
 * and collects file outputs.
 */
import { MTLFileManager } from './MTLFileManager.js';
export class MTLExecutor {
    fileManager;
    constructor() {
        this.fileManager = new MTLFileManager();
    }
    /**
     * Execute parsed MTL templates against a model object.
     * Finds the @main template and generates file outputs.
     */
    execute(templates, model) {
        try {
            const mainTemplate = this.findMainTemplate(templates);
            if (!mainTemplate) {
                return {
                    files: [],
                    error: 'No @main template found. Mark a template with [comment @main/] inside its body.',
                };
            }
            // Create a fresh file manager for each execution
            this.fileManager = new MTLFileManager();
            // Execute the main template's body with the model as context
            const context = {};
            context[mainTemplate.paramName] = model;
            context.self = model;
            this.executeNodes(mainTemplate.body, context);
            return {
                files: this.fileManager.getFiles(),
            };
        }
        catch (err) {
            return {
                files: this.fileManager.getFiles(),
                error: err.message ?? String(err),
            };
        }
    }
    /**
     * Find the template marked as @main in the AST.
     */
    findMainTemplate(nodes) {
        for (const node of nodes) {
            if (node.type === 'template' && node.isMain) {
                return node;
            }
            if (node.type === 'module') {
                for (const tmpl of node.templates) {
                    if (tmpl.isMain)
                        return tmpl;
                }
                // Also check module's direct children
                for (const child of node.templates) {
                    if (child.isMain)
                        return child;
                }
            }
        }
        return null;
    }
    /**
     * Execute an array of MTL nodes in the given context.
     * Returns the concatenated text output.
     */
    executeNodes(nodes, context) {
        let output = '';
        for (const node of nodes) {
            output += this.executeNode(node, context);
        }
        return output;
    }
    /**
     * Execute a single MTL node and return its text output.
     */
    executeNode(node, context) {
        switch (node.type) {
            case 'text':
                return node.value;
            case 'expression': {
                const value = this.resolveExpression(node.expression, context);
                if (value === null || value === undefined)
                    return '';
                return String(value);
            }
            case 'for': {
                const collection = this.resolveExpression(node.collection, context);
                if (!Array.isArray(collection))
                    return '';
                let result = '';
                for (const item of collection) {
                    const iterContext = { ...context };
                    iterContext[node.iterator] = item;
                    iterContext.self = item;
                    result += this.executeNodes(node.body, iterContext);
                }
                return result;
            }
            case 'if': {
                const condition = this.resolveExpression(node.condition, context);
                const truthy = this.isTruthy(condition);
                if (truthy) {
                    return this.executeNodes(node.thenBody, context);
                }
                else {
                    return this.executeNodes(node.elseBody, context);
                }
            }
            case 'file': {
                const fileName = String(this.resolveExpression(node.fileName, context) ?? node.fileName);
                const content = this.executeNodes(node.body, context);
                this.fileManager.addFile(fileName, content);
                return '';
            }
            case 'protected': {
                const id = String(this.resolveExpression(node.id, context) ?? node.id);
                // Check if we already have protected content preserved
                const existingContent = this.fileManager.restoreProtected(id, '');
                if (existingContent) {
                    return existingContent;
                }
                // Generate fresh content
                const content = this.executeNodes(node.body, context);
                this.fileManager.captureProtected(id, content);
                return content;
            }
            case 'comment':
                return '';
            default:
                return '';
        }
    }
    /**
     * Resolve a dot-notation expression against the context.
     *
     * Supports:
     *   - 'self' → current context object
     *   - 'paramName.attribute.subAttribute' → navigation chains
     *   - String literals like 'hello'
     *   - Number literals like 42
     *   - Boolean literals: true, false
     *
     * For EObject instances, uses the EMF reflexive API (eGet) when possible.
     */
    resolveExpression(expr, context) {
        if (expr === undefined || expr === null)
            return undefined;
        const trimmed = expr.trim();
        // String literal
        if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
            return trimmed.slice(1, -1);
        }
        // Number literal
        const num = Number(trimmed);
        if (!isNaN(num) && trimmed.length > 0 && /^-?\d+(\.\d+)?$/.test(trimmed)) {
            return num;
        }
        // Boolean literal
        if (trimmed === 'true')
            return true;
        if (trimmed === 'false')
            return false;
        // Null/undefined
        if (trimmed === 'null')
            return null;
        if (trimmed === 'undefined')
            return undefined;
        // Dot-notation navigation
        const parts = trimmed.split('.');
        let current = null;
        // First part: look up in context
        const first = parts[0];
        if (first in context) {
            current = context[first];
        }
        else if (first === 'self') {
            current = context.self;
        }
        else {
            // Try self.xxx
            current = this.resolveOnObject(context.self, first) ?? context[first];
        }
        // Navigate remaining parts
        for (let i = 1; i < parts.length; i++) {
            if (current === null || current === undefined)
                return undefined;
            current = this.resolveOnObject(current, parts[i]);
        }
        return current;
    }
    /**
     * Resolve a property/attribute name on an object.
     * For EObject, uses the EMF reflexive API (eGet).
     * For plain objects, uses direct property access.
     */
    resolveOnObject(obj, name) {
        if (obj === null || obj === undefined)
            return undefined;
        // Try EMF reflexive API for EObject instances
        if (this.isEObject(obj)) {
            try {
                const eClass = obj.eClass();
                const feature = eClass.getEStructuralFeature(name);
                if (feature) {
                    return obj.eGet(feature);
                }
            }
            catch {
                // Fall through to direct access
            }
        }
        // Try direct property access
        if (typeof obj === 'object' && name in obj) {
            return obj[name];
        }
        return undefined;
    }
    /**
     * Check if an object implements the EObject interface duck-typingly.
     */
    isEObject(obj) {
        return (obj !== null &&
            typeof obj === 'object' &&
            typeof obj.eClass === 'function' &&
            typeof obj.eGet === 'function');
    }
    /**
     * Determine truthiness for if-condition evaluation.
     */
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
        if (typeof value === 'object')
            return true;
        return Boolean(value);
    }
}
//# sourceMappingURL=MTLExecutor.js.map