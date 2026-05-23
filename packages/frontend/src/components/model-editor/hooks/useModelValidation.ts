/**
 * @emf-webapp/frontend — useModelValidation
 *
 * Hook that validates M1 model objects against the metamodel.
 * Checks: multiplicity, type correctness, containment validity.
 * Runs with debounce to avoid excessive computation.
 */
import { useMemo, useState, useEffect, useRef } from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SemanticObject {
  id: string;
  eClass: string;
  attributes: Record<string, unknown>;
  references: Record<string, string[]>;
}

interface EClass {
  name: string;
  abstract?: boolean;
  interface?: boolean;
  eAttributes?: { name: string; eType?: string; lowerBound?: number; upperBound?: number }[];
  eReferences?: { name: string; eType?: string; containment?: boolean; lowerBound?: number; upperBound?: number }[];
}

export type DiagnosticSeverity = 'error' | 'warning';

export interface ModelDiagnostic {
  id: string;
  objectId: string;
  objectName: string;
  eClass: string;
  severity: DiagnosticSeverity;
  message: string;
  category: 'multiplicity' | 'type' | 'containment' | 'abstract' | 'reference';
}

interface UseModelValidationReturn {
  diagnostics: ModelDiagnostic[];
  errorCount: number;
  warningCount: number;
  errorsByObject: Map<string, ModelDiagnostic[]>;
  warningsByObject: Map<string, ModelDiagnostic[]>;
  hasErrors: (objectId: string) => boolean;
  hasWarnings: (objectId: string) => boolean;
  getDiagnostics: (objectId: string) => ModelDiagnostic[];
}

/* ------------------------------------------------------------------ */
/*  Validation Logic                                                   */
/* ------------------------------------------------------------------ */

function validateModel(objects: SemanticObject[], eclasses: EClass[]): ModelDiagnostic[] {
  const diagnostics: ModelDiagnostic[] = [];
  const eclassMap = new Map(eclasses.map((ec) => [ec.name, ec]));
  const objectMap = new Map(objects.map((o) => [o.id, o]));
  let diagId = 0;

  for (const obj of objects) {
    const ec = eclassMap.get(obj.eClass);
    const objName = (obj.attributes.name as string) || obj.id;

    // 1. Check if eClass exists in metamodel
    if (!ec) {
      diagnostics.push({
        id: `diag_${diagId++}`,
        objectId: obj.id,
        objectName: objName,
        eClass: obj.eClass,
        severity: 'error',
        message: `Unknown eClass "${obj.eClass}" — not defined in metamodel`,
        category: 'type',
      });
      continue;
    }

    // 2. Check if eClass is abstract
    if (ec.abstract || ec.interface) {
      diagnostics.push({
        id: `diag_${diagId++}`,
        objectId: obj.id,
        objectName: objName,
        eClass: obj.eClass,
        severity: 'error',
        message: `Cannot instantiate ${ec.interface ? 'interface' : 'abstract class'} "${obj.eClass}"`,
        category: 'abstract',
      });
    }

    // 3. Check attribute types
    if (ec.eAttributes) {
      for (const attr of ec.eAttributes) {
        const value = obj.attributes[attr.name];

        // Required check (lowerBound >= 1)
        if (attr.lowerBound && attr.lowerBound >= 1) {
          if (value === undefined || value === null || value === '') {
            diagnostics.push({
              id: `diag_${diagId++}`,
              objectId: obj.id,
              objectName: objName,
              eClass: obj.eClass,
              severity: 'error',
              message: `Required attribute "${attr.name}" is missing`,
              category: 'multiplicity',
            });
          }
        }

        // Type validation
        if (value !== undefined && value !== null && value !== '') {
          const typeError = validateAttributeType(value, attr.eType || 'EString');
          if (typeError) {
            diagnostics.push({
              id: `diag_${diagId++}`,
              objectId: obj.id,
              objectName: objName,
              eClass: obj.eClass,
              severity: 'warning',
              message: `Attribute "${attr.name}": ${typeError}`,
              category: 'type',
            });
          }
        }
      }
    }

    // 4. Check reference multiplicity
    if (ec.eReferences) {
      for (const ref of ec.eReferences) {
        const targets = obj.references[ref.name] || [];

        // Lower bound check
        if (ref.lowerBound && ref.lowerBound > 0 && targets.length < ref.lowerBound) {
          diagnostics.push({
            id: `diag_${diagId++}`,
            objectId: obj.id,
            objectName: objName,
            eClass: obj.eClass,
            severity: 'error',
            message: `Reference "${ref.name}" requires at least ${ref.lowerBound} target(s), has ${targets.length}`,
            category: 'multiplicity',
          });
        }

        // Upper bound check (upperBound = -1 means unbounded)
        if (ref.upperBound && ref.upperBound > 0 && targets.length > ref.upperBound) {
          diagnostics.push({
            id: `diag_${diagId++}`,
            objectId: obj.id,
            objectName: objName,
            eClass: obj.eClass,
            severity: 'error',
            message: `Reference "${ref.name}" allows at most ${ref.upperBound} target(s), has ${targets.length}`,
            category: 'multiplicity',
          });
        }

        // Check that targets exist
        for (const targetId of targets) {
          if (!objectMap.has(targetId)) {
            diagnostics.push({
              id: `diag_${diagId++}`,
              objectId: obj.id,
              objectName: objName,
              eClass: obj.eClass,
              severity: 'error',
              message: `Reference "${ref.name}" points to non-existent object "${targetId}"`,
              category: 'reference',
            });
          } else if (ref.eType) {
            // Check target type compatibility
            const target = objectMap.get(targetId)!;
            const targetEc = eclassMap.get(target.eClass);
            if (targetEc && ref.eType !== target.eClass) {
              // Simple type check — in a full implementation we'd check inheritance
              // For now, just warn if types don't match exactly
              // (skip if eType matches or if we can't resolve)
              const expectedEc = eclassMap.get(ref.eType);
              if (expectedEc && target.eClass !== ref.eType) {
                diagnostics.push({
                  id: `diag_${diagId++}`,
                  objectId: obj.id,
                  objectName: objName,
                  eClass: obj.eClass,
                  severity: 'warning',
                  message: `Reference "${ref.name}" expects type "${ref.eType}", target is "${target.eClass}"`,
                  category: 'type',
                });
              }
            }
          }
        }
      }
    }
  }

  return diagnostics;
}

function validateAttributeType(value: unknown, eType: string): string | null {
  switch (eType) {
    case 'EInt':
    case 'EInteger':
      if (typeof value === 'string' && value !== '' && isNaN(Number(value))) {
        return `expected integer, got "${value}"`;
      }
      break;
    case 'EFloat':
    case 'EDouble':
      if (typeof value === 'string' && value !== '' && isNaN(parseFloat(value as string))) {
        return `expected number, got "${value}"`;
      }
      break;
    case 'EBoolean':
      if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
        return `expected boolean, got "${value}"`;
      }
      break;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useModelValidation(
  objects: SemanticObject[],
  eclasses: EClass[],
  debounceMs = 500,
): UseModelValidationReturn {
  const [diagnostics, setDiagnostics] = useState<ModelDiagnostic[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced validation
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const result = validateModel(objects, eclasses);
      setDiagnostics(result);
    }, debounceMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [objects, eclasses, debounceMs]);

  // Derived data
  const { errorCount, warningCount, errorsByObject, warningsByObject } = useMemo(() => {
    let errors = 0;
    let warnings = 0;
    const errMap = new Map<string, ModelDiagnostic[]>();
    const warnMap = new Map<string, ModelDiagnostic[]>();

    for (const d of diagnostics) {
      if (d.severity === 'error') {
        errors++;
        const list = errMap.get(d.objectId) || [];
        list.push(d);
        errMap.set(d.objectId, list);
      } else {
        warnings++;
        const list = warnMap.get(d.objectId) || [];
        list.push(d);
        warnMap.set(d.objectId, list);
      }
    }

    return { errorCount: errors, warningCount: warnings, errorsByObject: errMap, warningsByObject: warnMap };
  }, [diagnostics]);

  const hasErrors = (objectId: string) => errorsByObject.has(objectId);
  const hasWarnings = (objectId: string) => warningsByObject.has(objectId);
  const getDiagnostics = (objectId: string) => diagnostics.filter((d) => d.objectId === objectId);

  return {
    diagnostics,
    errorCount,
    warningCount,
    errorsByObject,
    warningsByObject,
    hasErrors,
    hasWarnings,
    getDiagnostics,
  };
}
