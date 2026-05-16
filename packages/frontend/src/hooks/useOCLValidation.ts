/**
 * @emf-webapp/frontend — useOCLValidation
 *
 * Hook que evalúa restricciones OCL contra el metamodelo actual en el editor.
 * Devuelve un mapa de violaciones por classifier ID para mostrar badges en nodos.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { getOCLConstraints, type OCLConstraint } from '../api/client';

// ── Re-exportamos tipos de OCL del core ───────────────────────────
// Usamos import dinámico porque el frontend resuelve @emf-webapp/core
let OCLParser: any = null;
let OCLEvaluator: any = null;

async function ensureOCL() {
  if (!OCLParser) {
    const ocl = await import('@emf-webapp/core');
    OCLParser = ocl.OCLParser;
    OCLEvaluator = ocl.OCLEvaluator;
  }
}

export interface OCLViolation {
  constraintId: string;
  constraintName: string;
  expression: string;
  severity: 'error' | 'warning' | 'info';
  passed: boolean;
  error?: string;
}

export interface OCLValidationResult {
  /** Por classifier ID (ej. "ec_1234") */
  violations: Map<string, OCLViolation[]>;
  /** Lista de todos los resultados */
  allResults: Array<{
    constraintId: string;
    constraintName: string;
    context: string;
    expression: string;
    severity: 'error' | 'warning' | 'info';
    passed: boolean;
    error?: string;
  }>;
  /** Número total de violaciones activas */
  totalViolations: number;
}

interface ClassifierInfo {
  id: string;
  name: string;
  eAttributes: Array<{ name: string; type?: string }>;
  eReferences: Array<{ name: string; targetId?: string; containment?: boolean }>;
  abstract?: boolean;
}

/**
 * Evalúa todas las OCL constraints definidas para un metamodelo
 * contra su contenido actual, devolviendo violaciones por classifier.
 */
export function useOCLValidation(
  metamodelId: string | undefined,
  classifiers: ClassifierInfo[],
) {
  const [loading, setLoading] = useState(false);
  const [constraints, setConstraints] = useState<OCLConstraint[]>([]);
  const [result, setResult] = useState<OCLValidationResult | null>(null);
  const [enabled, setEnabled] = useState(true);
  const prevJson = useRef<string>('');

  // Cargar constraints
  useEffect(() => {
    if (!metamodelId) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await getOCLConstraints(metamodelId);
        if (!cancelled) setConstraints(list);
      } catch {
        // Silently fail
      }
    })();
    return () => { cancelled = true; };
  }, [metamodelId]);

  // Re-evaluar cuando cambien los classifiers
  useEffect(() => {
    if (!enabled || constraints.length === 0 || classifiers.length === 0) {
      setResult(null);
      return;
    }

    const currentJson = JSON.stringify(classifiers);
    if (currentJson === prevJson.current) return;
    prevJson.current = currentJson;

    let cancelled = false;
    (async () => {
      setLoading(true);
      await ensureOCL();
      if (cancelled) return;

      try {
        const parser = new OCLParser();
        const res = await runValidation(parser, constraints, classifiers);
        if (!cancelled) setResult(res);
      } catch {
        // Silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [classifiers, constraints, enabled]);

  const refresh = useCallback(async () => {
    if (!metamodelId) return;
    try {
      const list = await getOCLConstraints(metamodelId);
      setConstraints(list);
    } catch {
      // Silently fail
    }
  }, [metamodelId]);

  const toggleEnabled = useCallback(() => {
    setEnabled((e) => !e);
  }, []);

  return {
    loading,
    enabled,
    toggleEnabled,
    constraints,
    refresh,
    result,
  };
}

async function runValidation(
  parser: any,
  constraints: OCLConstraint[],
  classifiers: ClassifierInfo[],
): Promise<OCLValidationResult> {
  // Build name → id map
  const nameToId = new Map<string, string>();
  for (const c of classifiers) {
    nameToId.set(c.name, c.id);
  }

  const allResults: OCLValidationResult['allResults'] = [];
  const violations = new Map<string, OCLViolation[]>();

  for (const constraint of constraints) {
    // Find matching classifiers by context name
    const matching = classifiers.filter((c) => c.name === constraint.context);

    if (matching.length === 0) {
      // No objects of the constraint's context — vacuously true
      allResults.push({
        constraintId: constraint.id,
        constraintName: constraint.name,
        context: constraint.context,
        expression: constraint.expression,
        severity: constraint.severity as 'error' | 'warning' | 'info',
        passed: true,
      });
      continue;
    }

    // Parse OCL expression
    let ast: any;
    try {
      ast = parser.tryParse(constraint.expression);
    } catch {
      // Parse error
      const r = {
        constraintId: constraint.id,
        constraintName: constraint.name,
        context: constraint.context,
        expression: constraint.expression,
        severity: constraint.severity as 'error' | 'warning' | 'info',
        passed: false,
        error: `Failed to parse: "${constraint.expression}"`,
      };
      allResults.push(r);
      for (const cls of matching) {
        addViolation(violations, cls.id, {
          constraintId: constraint.id,
          constraintName: constraint.name,
          expression: constraint.expression,
          severity: constraint.severity as 'error' | 'warning' | 'info',
          passed: false,
          error: r.error,
        });
      }
      continue;
    }

    if (!ast) {
      continue;
    }

    // Build eclass map for OCLEvaluator
    const eclassMap = new Map<string, any>();
    for (const cls of classifiers) {
      const features = [
        ...cls.eAttributes.map((a) => ({
          name: a.name,
          type: a.type || 'EString',
          kind: 'attribute' as const,
          many: false,
        })),
        ...cls.eReferences.map((r) => ({
          name: r.name,
          type: r.targetId || 'EObject',
          kind: 'reference' as const,
          many: true,
        })),
      ];
      eclassMap.set(cls.name, {
        name: cls.name,
        abstract: cls.abstract || false,
        eStructuralFeatures: features,
      });
    }

    const evaluator = new OCLEvaluator(eclassMap);
    let allPassed = true;
    let firstError: string | undefined;

    for (const cls of matching) {
      // Convert classifier to OCLEObject for evaluation
      const obj: any = {
        eClass: cls.name,
        attributes: {},
        references: {},
      };

      // Set default values for all attributes
      for (const attr of cls.eAttributes) {
        if (attr.name === 'name') {
          obj.attributes.name = cls.name;
        } else {
          obj.attributes[attr.name] = '';
        }
      }

      // Set default values for references
      for (const ref of cls.eReferences) {
        obj.references[ref.name] = [];
      }

      try {
        // Add self reference
        obj.self = obj;

        const evalResult = evaluator.evaluate(ast, obj);

        if (!evalResult.success) {
          allPassed = false;
          firstError = evalResult.error || 'Evaluation error';
          addViolation(violations, cls.id, {
            constraintId: constraint.id,
            constraintName: constraint.name,
            expression: constraint.expression,
            severity: constraint.severity as 'error' | 'warning' | 'info',
            passed: false,
            error: firstError,
          });
        } else if (typeof evalResult.value === 'boolean' && !evalResult.value) {
          allPassed = false;
          firstError = undefined; // It just evaluated to false, not an error
          addViolation(violations, cls.id, {
            constraintId: constraint.id,
            constraintName: constraint.name,
            expression: constraint.expression,
            severity: constraint.severity as 'error' | 'warning' | 'info',
            passed: false,
          });
        }
      } catch (err: any) {
        allPassed = false;
        firstError = err.message || String(err);
        addViolation(violations, cls.id, {
          constraintId: constraint.id,
          constraintName: constraint.name,
          expression: constraint.expression,
          severity: constraint.severity as 'error' | 'warning' | 'info',
          passed: false,
          error: firstError,
        });
      }
    }

    allResults.push({
      constraintId: constraint.id,
      constraintName: constraint.name,
      context: constraint.context,
      expression: constraint.expression,
      severity: constraint.severity as 'error' | 'warning' | 'info',
      passed: allPassed,
      error: allPassed ? undefined : firstError,
    });
  }

  // Add empty arrays for classifiers with no violations
  for (const cls of classifiers) {
    if (!violations.has(cls.id)) {
      violations.set(cls.id, []);
    }
  }

  const totalViolations = allResults.filter((r) => !r.passed).length;

  return { violations, allResults, totalViolations };
}

function addViolation(
  map: Map<string, OCLViolation[]>,
  classifierId: string,
  violation: OCLViolation,
) {
  const existing = map.get(classifierId);
  if (existing) {
    existing.push(violation);
  } else {
    map.set(classifierId, [violation]);
  }
}
