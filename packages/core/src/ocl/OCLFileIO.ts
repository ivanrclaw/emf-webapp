/**
 * OCLFileIO — Import/Export of standalone .ocl files (Complete OCL format).
 *
 * Supports parsing and generating Eclipse-compatible .ocl files with
 * package declarations, context blocks, and constraint definitions.
 */

// ── Types ────────────────────────────────────────────────────────────────

export interface OCLFileImportResult {
  constraints: ImportedConstraint[];
  errors: ImportError[];
  packages: string[];
}

export interface ImportedConstraint {
  name: string;
  context: string;
  kind: 'inv' | 'pre' | 'post' | 'def' | 'init' | 'derive' | 'body';
  expression: string;
  /** Original line number in the .ocl file */
  sourceLine: number;
}

export interface ImportError {
  line: number;
  message: string;
}

export interface ExportableConstraint {
  name: string;
  context: string;
  kind: 'inv' | 'pre' | 'post' | 'def' | 'init' | 'derive' | 'body';
  expression: string;
}

export interface ExportOptions {
  /** Group constraints by package */
  packageName?: string;
  /** Add header comment */
  header?: string;
  /** Indent style */
  indent?: string;
}

// ── Constraint kinds recognized by the parser ────────────────────────────

const CONSTRAINT_KINDS = ['inv', 'pre', 'post', 'def', 'init', 'derive', 'body'] as const;
type ConstraintKind = (typeof CONSTRAINT_KINDS)[number];

// Regex to match a constraint keyword line, e.g. "inv ValidAge:" or "inv ValidAge: self.age > 0"
const CONSTRAINT_RE = /^\s*(inv|pre|post|def|init|derive|body)\s*([A-Za-z_][A-Za-z0-9_]*)?\s*:\s*(.*)?$/;

// Regex to match a context declaration, e.g. "context Person" or "context pkg::Person"
const CONTEXT_RE = /^\s*context\s+([A-Za-z_][A-Za-z0-9_:]*(?:::[A-Za-z_][A-Za-z0-9_]*)*)\s*$/;

// Regex for context with operation signature (pre/post), e.g. "context Person::getName(): String"
const CONTEXT_OP_RE = /^\s*context\s+([A-Za-z_][A-Za-z0-9_:]*(?:::[A-Za-z_][A-Za-z0-9_]*)*)\s*::\s*[A-Za-z_][A-Za-z0-9_]*\s*\(.*\).*$/;

// Package declaration
const PACKAGE_RE = /^\s*package\s+([A-Za-z_][A-Za-z0-9_:]*(?:::[A-Za-z_][A-Za-z0-9_]*)*)\s*$/;
const ENDPACKAGE_RE = /^\s*endpackage\s*$/;

// ── Import ───────────────────────────────────────────────────────────────

/** Parse a .ocl file string into structured constraints */
export function importOCLFile(content: string): OCLFileImportResult {
  const lines = content.split(/\r?\n/);
  const constraints: ImportedConstraint[] = [];
  const errors: ImportError[] = [];
  const packages: string[] = [];

  let currentContext: string | null = null;
  let currentConstraint: {
    name: string;
    kind: ConstraintKind;
    sourceLine: number;
    expressionLines: string[];
  } | null = null;

  function flushConstraint(): void {
    if (currentConstraint && currentContext) {
      const expression = currentConstraint.expressionLines
        .join('\n')
        .trim();
      constraints.push({
        name: currentConstraint.name,
        context: currentContext,
        kind: currentConstraint.kind,
        expression,
        sourceLine: currentConstraint.sourceLine,
      });
    } else if (currentConstraint && !currentContext) {
      errors.push({
        line: currentConstraint.sourceLine,
        message: `Constraint '${currentConstraint.name || currentConstraint.kind}' has no context declaration`,
      });
    }
    currentConstraint = null;
  }

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const rawLine = lines[i];

    // Strip line comments (-- ...)
    const commentIdx = rawLine.indexOf('--');
    const line = commentIdx >= 0 ? rawLine.substring(0, commentIdx) : rawLine;

    // Skip blank lines (but accumulate them in expression if inside one)
    const trimmed = line.trim();
    if (trimmed === '') {
      if (currentConstraint) {
        currentConstraint.expressionLines.push('');
      }
      continue;
    }

    // Check for endpackage
    if (ENDPACKAGE_RE.test(trimmed)) {
      flushConstraint();
      currentContext = null;
      continue;
    }

    // Check for package declaration
    const pkgMatch = trimmed.match(PACKAGE_RE);
    if (pkgMatch) {
      flushConstraint();
      currentContext = null;
      packages.push(pkgMatch[1]);
      continue;
    }

    // Check for context with operation signature
    const ctxOpMatch = rawLine.match(CONTEXT_OP_RE);
    if (ctxOpMatch) {
      flushConstraint();
      currentContext = ctxOpMatch[1];
      continue;
    }

    // Check for context declaration
    const ctxMatch = trimmed.match(CONTEXT_RE);
    if (ctxMatch) {
      flushConstraint();
      currentContext = ctxMatch[1];
      continue;
    }

    // Check for constraint keyword
    const conMatch = trimmed.match(CONSTRAINT_RE);
    if (conMatch) {
      flushConstraint();
      const kind = conMatch[1] as ConstraintKind;
      const name = conMatch[2] || '';
      const inlineExpr = conMatch[3] || '';
      currentConstraint = {
        name,
        kind,
        sourceLine: lineNum,
        expressionLines: inlineExpr.trim() ? [inlineExpr.trim()] : [],
      };
      continue;
    }

    // If we're inside a constraint, accumulate expression lines
    if (currentConstraint) {
      currentConstraint.expressionLines.push(trimmed);
      continue;
    }

    // If we have a context but no constraint started, and it's not a recognized keyword,
    // it might be a malformed line
    if (currentContext && trimmed !== '') {
      // Could be a continuation or unrecognized syntax — report as error
      errors.push({
        line: lineNum,
        message: `Unexpected content outside constraint definition: '${trimmed}'`,
      });
    }
  }

  // Flush any remaining constraint
  flushConstraint();

  return { constraints, errors, packages };
}

// ── Export ────────────────────────────────────────────────────────────────

/** Export constraints to a .ocl file string */
export function exportOCLFile(constraints: ExportableConstraint[], options?: ExportOptions): string {
  const indent = options?.indent ?? '  ';
  const lines: string[] = [];

  // Header comment
  if (options?.header) {
    for (const headerLine of options.header.split('\n')) {
      lines.push(`-- ${headerLine}`);
    }
    lines.push('');
  }

  // Group constraints by context
  const byContext = new Map<string, ExportableConstraint[]>();
  for (const c of constraints) {
    const group = byContext.get(c.context) || [];
    group.push(c);
    byContext.set(c.context, group);
  }

  const hasPackage = !!options?.packageName;

  if (hasPackage) {
    lines.push(`package ${options!.packageName}`);
    lines.push('');
  }

  const contextIndent = hasPackage ? indent : '';
  const constraintIndent = hasPackage ? indent + indent : indent;

  let first = true;
  for (const [context, group] of byContext) {
    if (!first) {
      lines.push('');
    }
    first = false;

    lines.push(`${contextIndent}context ${context}`);

    for (const c of group) {
      lines.push('');
      const namePart = c.name ? ` ${c.name}` : '';
      const exprLines = c.expression.split('\n');

      if (exprLines.length === 1) {
        lines.push(`${constraintIndent}${c.kind}${namePart}: ${exprLines[0]}`);
      } else {
        lines.push(`${constraintIndent}${c.kind}${namePart}:`);
        for (const exprLine of exprLines) {
          lines.push(`${constraintIndent}${indent}${exprLine}`);
        }
      }
    }
  }

  if (hasPackage) {
    lines.push('');
    lines.push('endpackage');
  }

  lines.push('');
  return lines.join('\n');
}
