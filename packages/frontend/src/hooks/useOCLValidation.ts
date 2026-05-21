/**
 * @emf-webapp/frontend — useOCLValidation
 *
 * Hook que valida restricciones OCL semánticamente contra el metamodelo actual.
 * Usa OCLSemanticValidator (sintaxis + tipos + existencia de atributos) en lugar
 * de evaluación runtime, ya que en el editor de metamodelo no hay instancias reales.
 *
 * Devuelve un mapa de violaciones por classifier ID para mostrar badges en nodos.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { getOCLConstraints, type OCLConstraint } from '../api/client';

// ── Lazy-load OCL core ───────────────────────────────────────────────
let OCLSemanticValidator: any = null;

async function ensureOCL() {
  if (!OCLSemanticValidator) {
    const ocl = await import('@emf-webapp/core');
    OCLSemanticValidator = ocl.OCLSemanticValidator;
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
  eSuperTypes?: string[];
}

/**
 * Build MetamodelInfo from classifiers for OCLSemanticValidator.
 */
function buildMetamodelInfoFromClassifiers(classifiers: ClassifierInfo[]) {
  // Build id→name lookup
  const idToName: Record<string, string> = {};
  for (const cls of classifiers) {
    if (cls.id) idToName[cls.id] = cls.name;
    idToName[cls.name] = cls.name;
  }

  const classes = classifiers.map((cls) => ({
    name: cls.name,
    abstract: cls.abstract,
    attributes: cls.eAttributes.map((a) => ({
      name: a.name,
      type: a.type || 'EString',
      many: false,
    })),
    references: cls.eReferences.map((r) => ({
      name: r.name,
      targetClass: idToName[r.targetId || ''] || r.targetId || 'EObject',
      many: true,
      containment: !!r.containment,
    })),
  }));

  // Build hierarchy map
  const hierarchy = new Map<string, string[]>();
  for (const cls of classifiers) {
    if (cls.eSuperTypes && cls.eSuperTypes.length > 0) {
      const parents = cls.eSuperTypes.map((st) => idToName[st] || st);
      hierarchy.set(cls.name, parents);
    }
  }

  return { classes, hierarchy };
}

/**
 * Valida todas las OCL constraints definidas para un metamodelo
 * usando validación semántica (sintaxis + tipos + atributos).
 * NO ejecuta las expresiones contra instancias — solo verifica corrección estática.
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

  // Re-validar cuando cambien los classifiers
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
        const res = runSemanticValidation(constraints, classifiers);
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

function runSemanticValidation(
  constraints: OCLConstraint[],
  classifiers: ClassifierInfo[],
): OCLValidationResult {
  // Build name → id map
  const nameToId = new Map<string, string>();
  for (const c of classifiers) {
    nameToId.set(c.name, c.id);
  }

  const metamodelInfo = buildMetamodelInfoFromClassifiers(classifiers);
  const validator = new OCLSemanticValidator(metamodelInfo);

  const allResults: OCLValidationResult['allResults'] = [];
  const violations = new Map<string, OCLViolation[]>();

  for (const constraint of constraints) {
    // Find matching classifiers by context name
    const matching = classifiers.filter((c) => c.name === constraint.context);

    if (matching.length === 0) {
      // No classifiers of the constraint's context — vacuously valid
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

    // Semantic validation: syntax + types + attribute existence
    const semanticResult = validator.validate(constraint.expression, constraint.context);
    const hasErrors = semanticResult.diagnostics.some(
      (d: any) => d.severity === 'error',
    );

    if (hasErrors) {
      // Collect error messages
      const errorMessages = semanticResult.diagnostics
        .filter((d: any) => d.severity === 'error')
        .map((d: any) => d.message)
        .join('; ');

      allResults.push({
        constraintId: constraint.id,
        constraintName: constraint.name,
        context: constraint.context,
        expression: constraint.expression,
        severity: constraint.severity as 'error' | 'warning' | 'info',
        passed: false,
        error: errorMessages,
      });

      // Add violation to all matching classifiers
      for (const cls of matching) {
        addViolation(violations, cls.id, {
          constraintId: constraint.id,
          constraintName: constraint.name,
          expression: constraint.expression,
          severity: constraint.severity as 'error' | 'warning' | 'info',
          passed: false,
          error: errorMessages,
        });
      }
    } else {
      // Semantically valid — no violations to report
      allResults.push({
        constraintId: constraint.id,
        constraintName: constraint.name,
        context: constraint.context,
        expression: constraint.expression,
        severity: constraint.severity as 'error' | 'warning' | 'info',
        passed: true,
      });
    }
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
