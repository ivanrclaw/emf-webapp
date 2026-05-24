/**
 * @emf-webapp/core — AcceleoMtlGenerator
 *
 * Converts webapp code templates to Acceleo .mtl module files.
 * Acceleo is Eclipse's standard M2T (Model-to-Text) transformation engine.
 *
 * Format: Acceleo 3.x module syntax
 *   [comment encoding = UTF-8 /]
 *   [module moduleName('nsURI')]
 *   [template public templateName(arg : EClass)]
 *     ... template body ...
 *   [/template]
 *
 * Reference: https://wiki.eclipse.org/Acceleo
 */
// ═══════════════════════════════════════════════════════════════
// Main Generator
// ═══════════════════════════════════════════════════════════════
/**
 * Generates an Acceleo .mtl module from a list of code templates.
 *
 * @param templates - Array of code templates to convert
 * @param options - Module-level options
 * @returns Complete .mtl file content
 */
export function generateAcceleoModule(templates, options) {
    const lines = [];
    // Encoding comment (required by Acceleo)
    lines.push('[comment encoding = UTF-8 /]');
    // Module documentation
    if (options.description || options.author) {
        lines.push('[**');
        if (options.description) {
            lines.push(` * ${options.description}`);
        }
        if (options.author) {
            lines.push(` * @author ${options.author}`);
        }
        lines.push(' */]');
    }
    // Module declaration
    lines.push(`[module ${options.moduleName}('${options.nsURI}')/]`);
    lines.push('');
    // Generate each template
    for (const template of templates) {
        emitTemplate(lines, template, options);
        lines.push('');
    }
    return lines.join('\n');
}
/**
 * Generates a standalone Acceleo .mtl for a single template.
 * Useful when each code template maps to its own .mtl file.
 */
export function generateAcceleoSingleTemplate(template, options) {
    return generateAcceleoModule([template], {
        ...options,
        moduleName: options.moduleName || sanitizeModuleName(template.name),
    });
}
// ═══════════════════════════════════════════════════════════════
// Template emission
// ═══════════════════════════════════════════════════════════════
function emitTemplate(lines, template, options) {
    const visibility = template.visibility || 'public';
    const context = template.context || 'EObject';
    const argName = context.charAt(0).toLowerCase() + context.slice(1);
    // Template documentation
    if (template.description) {
        lines.push('[**');
        lines.push(` * ${template.description}`);
        lines.push(` * @param ${argName} the ${context} instance`);
        lines.push(' */]');
    }
    // Template declaration
    if (template.isMain && template.outputFile) {
        // Main template with file output
        lines.push(`[template ${visibility} ${template.name}(${argName} : ${context})]`);
        lines.push(`[comment @main /]`);
        const outputExpr = convertExpressionToAcceleo(template.outputFile, argName);
        lines.push(`[file (${outputExpr}, false, 'UTF-8')]`);
        // Template body
        const body = convertBodyToAcceleo(template.body, argName);
        lines.push(body);
        lines.push('[/file]');
    }
    else if (template.outputFile) {
        // Non-main template with file output
        lines.push(`[template ${visibility} ${template.name}(${argName} : ${context})]`);
        const outputExpr = convertExpressionToAcceleo(template.outputFile, argName);
        lines.push(`[file (${outputExpr}, false, 'UTF-8')]`);
        const body = convertBodyToAcceleo(template.body, argName);
        lines.push(body);
        lines.push('[/file]');
    }
    else {
        // Helper template (no file output)
        lines.push(`[template ${visibility} ${template.name}(${argName} : ${context})]`);
        const body = convertBodyToAcceleo(template.body, argName);
        lines.push(body);
    }
    lines.push(`[/template]`);
}
// ═══════════════════════════════════════════════════════════════
// Expression conversion (webapp → Acceleo)
// ═══════════════════════════════════════════════════════════════
/**
 * Converts webapp template expressions to Acceleo syntax.
 *
 * Webapp uses:
 *   ${self.name}         → [self.name/]
 *   ${self.attributes}   → [for (attr : EAttribute | self.eAttributes)]...[/for]
 *   {{#each attributes}} → [for ...]
 *   {{name}}             → [name/]
 *
 * Acceleo uses:
 *   [expression/]        → inline expression
 *   [for (x : T | col)]  → iteration
 *   [if (cond)]          → conditional
 */
function convertBodyToAcceleo(body, argName) {
    let result = body;
    // Convert ${self.xxx} or ${xxx} to [argName.xxx/]
    result = result.replace(/\$\{self\.([^}]+)\}/g, `[${argName}.$1/]`);
    result = result.replace(/\$\{([^}]+)\}/g, `[$1/]`);
    // Convert {{#each xxx}} ... {{/each}} to [for] blocks
    result = result.replace(/\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (_, collection, inner) => {
        const itemName = collection.replace(/s$/, ''); // naive singularize
        const converted = inner
            .replace(/\{\{(\w+)\}\}/g, `[${itemName}.$1/]`)
            .replace(/\{\{this\}\}/g, `[${itemName}/]`);
        return `[for (${itemName} | ${argName}.${collection})]\n${converted}[/for]`;
    });
    // Convert {{#if xxx}} ... {{/if}} to [if] blocks
    result = result.replace(/\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, condition, inner) => {
        return `[if (${argName}.${condition})]\n${inner}[/if]`;
    });
    // Convert remaining {{xxx}} to [argName.xxx/]
    result = result.replace(/\{\{([^#/][^}]*)\}\}/g, `[${argName}.$1/]`);
    return result;
}
/**
 * Converts a file output expression to Acceleo format.
 * e.g., "self.name + '.java'" → "argName.name.concat('.java')"
 */
function convertExpressionToAcceleo(expr, argName) {
    let result = expr;
    // Replace self. with argName.
    result = result.replace(/self\./g, `${argName}.`);
    // Convert string concatenation: x + '.ext' → x.concat('.ext')
    result = result.replace(/(\w+(?:\.\w+)*)\s*\+\s*'([^']+)'/g, "$1.concat('$2')");
    return result;
}
// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════
function sanitizeModuleName(name) {
    return name
        .replace(/[^a-zA-Z0-9_]/g, '_')
        .replace(/^[0-9]/, '_$&');
}
//# sourceMappingURL=AcceleoMtlGenerator.js.map