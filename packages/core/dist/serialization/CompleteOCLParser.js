/**
 * @emf-webapp/core — CompleteOCLParser
 *
 * Parses Eclipse Complete OCL (.ocl) files into structured constraint objects.
 * Handles the standard Complete OCL format including imports, packages,
 * context declarations, invariants, and annotations.
 *
 * Format reference: Eclipse OCL Complete OCL specification
 * https://wiki.eclipse.org/OCL/CompleteOCL
 */
// ═══════════════════════════════════════════════════════════════
// Parser
// ═══════════════════════════════════════════════════════════════
/**
 * Parses a Complete OCL text into structured constraint objects.
 *
 * Handles:
 * - import declarations (import 'nsURI')
 * - package/endpackage blocks
 * - context declarations
 * - inv constraints with name and expression (single and multi-line)
 * - -- @severity: annotations
 * - -- @message: annotations
 * - Comments (-- line comments)
 * - Nested expressions with parentheses, let/in, if/then/else/endif
 */
export function parseCompleteOCL(oclText) {
    const result = {
        packageName: '',
        imports: [],
        constraints: [],
    };
    if (!oclText || oclText.trim().length === 0) {
        return result;
    }
    const lines = oclText.split(/\r?\n/);
    let currentContext = '';
    let currentSeverity = 'error';
    let currentMessage;
    let currentInvName = '';
    let currentExpression = '';
    let inMultiLineExpression = false;
    let expressionIndent = 0;
    /**
     * Flush the current constraint being built (if any) into the result.
     */
    function flushConstraint() {
        if (currentInvName && currentExpression.trim()) {
            const constraint = {
                name: currentInvName,
                context: currentContext,
                expression: currentExpression.trim(),
                severity: currentSeverity,
            };
            if (currentMessage !== undefined) {
                constraint.message = currentMessage;
            }
            result.constraints.push(constraint);
        }
        // Reset constraint-level state
        currentInvName = '';
        currentExpression = '';
        inMultiLineExpression = false;
        expressionIndent = 0;
    }
    /**
     * Reset annotation state (severity/message) for the next constraint.
     */
    function resetAnnotations() {
        currentSeverity = 'error';
        currentMessage = undefined;
    }
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        // Skip empty lines — but if we're in a multi-line expression,
        // an empty line does NOT terminate it (expressions can span blank lines
        // within nested constructs like let/in or if/then/else)
        if (trimmed === '') {
            if (inMultiLineExpression) {
                // Keep blank lines in expression for readability, they'll be trimmed later
                currentExpression += '\n';
            }
            continue;
        }
        // ─── Import declarations ───────────────────────────────────
        const importMatch = trimmed.match(/^import\s+['"]([^'"]+)['"]\s*$/);
        if (importMatch) {
            result.imports.push(importMatch[1]);
            continue;
        }
        // ─── Package declaration ───────────────────────────────────
        const packageMatch = trimmed.match(/^package\s+(\S+)\s*$/);
        if (packageMatch) {
            flushConstraint();
            result.packageName = packageMatch[1];
            continue;
        }
        // ─── Endpackage ────────────────────────────────────────────
        if (trimmed === 'endpackage') {
            flushConstraint();
            continue;
        }
        // ─── Annotation comments ───────────────────────────────────
        const severityMatch = trimmed.match(/^--\s*@severity:\s*(error|warning|info)\s*$/i);
        if (severityMatch) {
            // Severity annotation applies to the NEXT constraint
            // If we're building a multi-line expression, flush first
            if (inMultiLineExpression) {
                flushConstraint();
            }
            currentSeverity = severityMatch[1].toLowerCase();
            continue;
        }
        const messageMatch = trimmed.match(/^--\s*@message:\s*(.+)$/i);
        if (messageMatch) {
            if (inMultiLineExpression) {
                flushConstraint();
            }
            currentMessage = messageMatch[1].trim();
            continue;
        }
        // ─── Regular comments (skip) ───────────────────────────────
        if (trimmed.startsWith('--') && !inMultiLineExpression) {
            continue;
        }
        // ─── Context declaration ───────────────────────────────────
        const contextMatch = trimmed.match(/^context\s+(\S+)\s*$/);
        if (contextMatch) {
            flushConstraint();
            resetAnnotations();
            currentContext = contextMatch[1];
            continue;
        }
        // ─── Invariant declaration ─────────────────────────────────
        const invMatch = trimmed.match(/^inv\s+(\w+)\s*:\s*(.*)$/);
        if (invMatch) {
            // Flush any previous constraint
            flushConstraint();
            currentInvName = invMatch[1];
            const exprPart = invMatch[2].trim();
            if (exprPart) {
                // Expression starts on the same line as inv
                currentExpression = exprPart;
                inMultiLineExpression = true;
                // Record the indent level of the inv line to detect continuation
                expressionIndent = getIndent(line);
            }
            else {
                // Expression starts on the next line(s)
                currentExpression = '';
                inMultiLineExpression = true;
                expressionIndent = getIndent(line);
            }
            continue;
        }
        // ─── Invariant without name (inv: expression) ──────────────
        const invNoNameMatch = trimmed.match(/^inv\s*:\s*(.*)$/);
        if (invNoNameMatch) {
            flushConstraint();
            // Generate a name from context + index
            const unnamed = `unnamed_${result.constraints.length + 1}`;
            currentInvName = unnamed;
            const exprPart = invNoNameMatch[1].trim();
            if (exprPart) {
                currentExpression = exprPart;
                inMultiLineExpression = true;
                expressionIndent = getIndent(line);
            }
            else {
                currentExpression = '';
                inMultiLineExpression = true;
                expressionIndent = getIndent(line);
            }
            continue;
        }
        // ─── Multi-line expression continuation ────────────────────
        if (inMultiLineExpression) {
            const lineIndent = getIndent(line);
            // A line is a continuation if it's indented more than the inv line,
            // OR if it's at the same level but starts with a known continuation keyword/operator
            const isContinuation = lineIndent > expressionIndent ||
                isContinuationToken(trimmed);
            if (isContinuation) {
                if (currentExpression) {
                    currentExpression += '\n' + trimmed;
                }
                else {
                    currentExpression = trimmed;
                }
            }
            else {
                // This line is NOT a continuation — flush and re-process
                flushConstraint();
                resetAnnotations();
                i--; // Re-process this line
            }
            continue;
        }
    }
    // Flush any remaining constraint at end of file
    flushConstraint();
    // Clean up expressions: collapse internal whitespace for single-line expressions
    for (const constraint of result.constraints) {
        constraint.expression = normalizeExpression(constraint.expression);
    }
    return result;
}
// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════
/**
 * Get the indentation level (number of leading spaces) of a line.
 * Tabs count as 2 spaces.
 */
function getIndent(line) {
    let indent = 0;
    for (const ch of line) {
        if (ch === ' ') {
            indent++;
        }
        else if (ch === '\t') {
            indent += 2;
        }
        else {
            break;
        }
    }
    return indent;
}
/**
 * Check if a trimmed line starts with a token that indicates
 * it's a continuation of a previous expression.
 */
function isContinuationToken(trimmed) {
    const continuationPrefixes = [
        'and', 'or', 'xor', 'implies',
        'then', 'else', 'endif', 'in',
        '.', '->', '<>', '=', '<', '>', '<=', '>=', '+', '-', '*', '/',
    ];
    for (const prefix of continuationPrefixes) {
        if (trimmed.startsWith(prefix)) {
            // Make sure it's a word boundary for keyword prefixes
            if (/^[a-z]/.test(prefix)) {
                const nextChar = trimmed[prefix.length];
                if (!nextChar || /[\s(.]/.test(nextChar)) {
                    return true;
                }
            }
            else {
                return true;
            }
        }
    }
    return false;
}
/**
 * Normalize an expression: trim each line and join with single spaces
 * if it's effectively a single logical line, or preserve structure
 * for complex multi-line expressions.
 */
function normalizeExpression(expr) {
    const lines = expr.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length <= 1) {
        return lines.join('').trim();
    }
    // For multi-line expressions, join with newlines preserving logical structure
    return lines.join('\n');
}
//# sourceMappingURL=CompleteOCLParser.js.map