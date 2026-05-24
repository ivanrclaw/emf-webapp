/**
 * @emf-webapp/core — CompleteOCLExporter
 *
 * Generates Eclipse Complete OCL (.ocl) files from stored constraints.
 * Complete OCL is the standard format for standalone OCL constraint files
 * that can be loaded alongside .ecore models in Eclipse.
 *
 * Format reference: Eclipse OCL Complete OCL specification
 * https://wiki.eclipse.org/OCL/CompleteOCL
 *
 * Structure:
 *   import <nsURI>
 *   package <packageName>
 *     context <ClassName>
 *       inv <constraintName>: <expression>
 *       def: <helperName>(...) : <Type> = <body>
 *   endpackage
 */

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface OCLConstraintInput {
  /** Constraint name (e.g., "positiveAge") */
  name: string;
  /** Context EClass name (e.g., "Person") */
  context: string;
  /** OCL expression body */
  expression: string;
  /** Severity level */
  severity: 'error' | 'warning' | 'info';
  /** Optional message template */
  message?: string;
}

export interface CompleteOCLOptions {
  /** Package name (e.g., "library") */
  packageName: string;
  /** Namespace URI (e.g., "http://www.example.org/library") */
  nsURI: string;
  /** Optional imports (additional nsURIs to import) */
  imports?: string[];
  /** Optional header comment */
  headerComment?: string;
}

// ═══════════════════════════════════════════════════════════════
// Main Exporter
// ═══════════════════════════════════════════════════════════════

/**
 * Generates a Complete OCL (.ocl) document from a list of constraints.
 *
 * @param constraints - Array of OCL constraints
 * @param options - Export options (package name, nsURI, etc.)
 * @returns Complete OCL document as string
 */
export function generateCompleteOCL(
  constraints: OCLConstraintInput[],
  options: CompleteOCLOptions,
): string {
  const lines: string[] = [];

  // Header comment
  if (options.headerComment) {
    lines.push('--');
    for (const line of options.headerComment.split('\n')) {
      lines.push(`-- ${line}`);
    }
    lines.push('--');
    lines.push('');
  }

  // Import declaration
  lines.push(`import '${options.nsURI}'`);
  if (options.imports) {
    for (const imp of options.imports) {
      lines.push(`import '${imp}'`);
    }
  }
  lines.push('');

  // Group constraints by context
  const byContext = groupByContext(constraints);

  // Package block
  lines.push(`package ${options.packageName}`);
  lines.push('');

  for (const [contextName, contextConstraints] of byContext) {
    lines.push(`  context ${contextName}`);
    lines.push('');

    for (const constraint of contextConstraints) {
      // Severity annotation (Eclipse OCL uses stereotype-like annotations)
      if (constraint.severity !== 'error') {
        lines.push(`    -- @severity: ${constraint.severity}`);
      }

      // Message annotation
      if (constraint.message) {
        lines.push(`    -- @message: ${constraint.message}`);
      }

      // Invariant
      const expr = formatExpression(constraint.expression);
      if (expr.includes('\n')) {
        // Multi-line expression
        lines.push(`    inv ${constraint.name}:`);
        for (const exprLine of expr.split('\n')) {
          lines.push(`      ${exprLine}`);
        }
      } else {
        lines.push(`    inv ${constraint.name}: ${expr}`);
      }
      lines.push('');
    }
  }

  lines.push('endpackage');
  lines.push('');

  return lines.join('\n');
}

/**
 * Generates OCL constraints as EAnnotations for embedding in .ecore files.
 * This is the inline format used by Eclipse EMF Validation Framework.
 *
 * Returns annotation data that should be added to the EClass in the .ecore.
 *
 * Format:
 *   <eAnnotations source="http://www.eclipse.org/emf/2002/Ecore">
 *     <details key="constraints" value="constraintName1 constraintName2"/>
 *   </eAnnotations>
 *   <eAnnotations source="http://www.eclipse.org/emf/2002/Ecore/OCL/Pivot">
 *     <details key="constraintName1" value="self.age > 0"/>
 *   </eAnnotations>
 */
export interface InlineOCLAnnotation {
  /** The context EClass name */
  context: string;
  /** Constraint names list (space-separated for Ecore annotation) */
  constraintNames: string;
  /** Map of constraint name → OCL expression */
  constraintBodies: Record<string, string>;
}

/**
 * Groups constraints by context and returns inline annotation data
 * suitable for embedding in .ecore EAnnotations.
 */
export function generateInlineOCLAnnotations(
  constraints: OCLConstraintInput[],
): InlineOCLAnnotation[] {
  const byContext = groupByContext(constraints);
  const result: InlineOCLAnnotation[] = [];

  for (const [contextName, contextConstraints] of byContext) {
    const names = contextConstraints.map(c => c.name);
    const bodies: Record<string, string> = {};
    for (const c of contextConstraints) {
      bodies[c.name] = c.expression;
    }
    result.push({
      context: contextName,
      constraintNames: names.join(' '),
      constraintBodies: bodies,
    });
  }

  return result;
}

/**
 * Generates the OCL delegation annotations that go on the EPackage.
 * These tell Eclipse which OCL evaluator to use.
 *
 * Returns annotations array for the package level:
 *   source="http://www.eclipse.org/emf/2002/Ecore"
 *     details: invocationDelegates, settingDelegates, validationDelegates
 */
export interface PackageOCLDelegation {
  source: string;
  details: Record<string, string>;
}

export function generateOCLDelegationAnnotations(): PackageOCLDelegation[] {
  const oclDelegateURI = 'http://www.eclipse.org/emf/2002/Ecore/OCL/Pivot';

  return [
    {
      source: 'http://www.eclipse.org/emf/2002/Ecore',
      details: {
        invocationDelegates: oclDelegateURI,
        settingDelegates: oclDelegateURI,
        validationDelegates: oclDelegateURI,
      },
    },
  ];
}

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function groupByContext(
  constraints: OCLConstraintInput[],
): Map<string, OCLConstraintInput[]> {
  const map = new Map<string, OCLConstraintInput[]>();
  for (const c of constraints) {
    const existing = map.get(c.context);
    if (existing) {
      existing.push(c);
    } else {
      map.set(c.context, [c]);
    }
  }
  return map;
}

/**
 * Formats an OCL expression for output.
 * Trims whitespace and normalizes line endings.
 */
function formatExpression(expr: string): string {
  return expr.trim().replace(/\r\n/g, '\n');
}
