/**
 * @emf-webapp/frontend — Model Validation Module
 *
 * Funciones de validación del modelo Ecore (SerializableEPackage).
 * Verifica reglas de integridad como nombres únicos, tipos existentes,
 * ausencia de ciclos de herencia, etc.
 */
import type {
  SerializableEPackage,
  SerializableEClass,
  SerializableEEnum,
  SerializableEDataType,
  SerializableEAttribute,
  SerializableEReference,
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from './types';

// ── Type Guards ─────────────────────────────────────────────────

function isEClass(c: SerializableEClass | SerializableEEnum | SerializableEDataType): c is SerializableEClass {
  return 'eAttributes' in c && 'eReferences' in c;
}

function isEEnum(c: SerializableEClass | SerializableEEnum | SerializableEDataType): c is SerializableEEnum {
  return 'eLiterals' in c;
}

function isEDataType(c: SerializableEClass | SerializableEEnum | SerializableEDataType): c is SerializableEDataType {
  return !isEClass(c) && !isEEnum(c);
}

// ── Constantes ──────────────────────────────────────────────────

/** DataTypes estándar de EMF que se consideran conocidos */
const KNOWN_DATATYPES = new Set([
  'EString',
  'EBoolean',
  'EInt',
  'ELong',
  'EFloat',
  'EDouble',
  'EBigDecimal',
  'EBigInteger',
  'EDate',
  'EByteArray',
  'EObject',
]);

/** DataTypes definidos por el usuario en el paquete */
function getUserDataTypes(pkg: SerializableEPackage): Set<string> {
  const names = new Set<string>();
  for (const c of pkg.eClassifiers) {
    if (isEDataType(c)) {
      names.add(c.name);
    }
  }
  return names;
}

/** Obtener todos los IDs de EClass en el paquete */
function getEClassIds(pkg: SerializableEPackage): Set<string> {
  const ids = new Set<string>();
  for (const c of pkg.eClassifiers) {
    if (isEClass(c)) {
      ids.add(c.id);
    }
  }
  return ids;
}

// ================================================================
// Reglas de validación
// ================================================================

/**
 * a) Nombres de EClass únicos dentro del EPackage
 */
function validateUniqueClassNames(pkg: SerializableEPackage): ValidationError[] {
  const errors: ValidationError[] = [];
  const nameMap = new Map<string, string[]>(); // name → [ids]

  for (const c of pkg.eClassifiers) {
    const ids = nameMap.get(c.name) ?? [];
    ids.push(c.id);
    nameMap.set(c.name, ids);
  }

  nameMap.forEach((ids, name) => {
    if (ids.length > 1) {
      ids.forEach((id) => {
        errors.push({
          nodeId: id,
          field: 'name',
          message: `Duplicate classifier name "${name}". All classifier names must be unique within the package.`,
        });
      });
    }
  });

  return errors;
}

/**
 * b) Nombres de EStructuralFeature únicos dentro del EClass
 */
function validateUniqueFeatureNames(pkg: SerializableEPackage): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const c of pkg.eClassifiers) {
    if (!isEClass(c)) continue;

    const featureNames = new Map<string, string[]>(); // name → [featureIds]

    for (const attr of c.eAttributes) {
      const ids = featureNames.get(attr.name) ?? [];
      ids.push(attr.id);
      featureNames.set(attr.name, ids);
    }

    for (const ref of c.eReferences) {
      const ids = featureNames.get(ref.name) ?? [];
      ids.push(ref.id);
      featureNames.set(ref.name, ids);
    }

    featureNames.forEach((ids, name) => {
      if (ids.length > 1) {
        ids.forEach((id) => {
          errors.push({
            nodeId: id,
            field: 'name',
            message: `Duplicate feature name "${name}" in class "${c.name}". Feature names must be unique within a class.`,
          });
        });
      }
    });
  }

  return errors;
}

/**
 * c) eType de EAttribute debe ser un EDataType conocido (warning)
 */
function validateAttributeTypes(pkg: SerializableEPackage): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const userDataTypes = getUserDataTypes(pkg);
  const allKnownTypes = new Set<string>();
  KNOWN_DATATYPES.forEach((t) => allKnownTypes.add(t));
  userDataTypes.forEach((t) => allKnownTypes.add(t));

  for (const c of pkg.eClassifiers) {
    if (!isEClass(c)) continue;

    for (const attr of c.eAttributes) {
      if (!attr.eType || attr.eType.trim() === '') continue;
      if (!allKnownTypes.has(attr.eType)) {
        warnings.push({
          nodeId: attr.id,
          field: 'eType',
          message: `Attribute "${attr.name}" in class "${c.name}" references unknown data type "${attr.eType}".`,
        });
      }
    }
  }

  return warnings;
}

/**
 * d) eType de EReference debe ser un EClass existente (error)
 */
function validateReferenceTargets(pkg: SerializableEPackage): ValidationError[] {
  const errors: ValidationError[] = [];
  const classIds = getEClassIds(pkg);

  for (const c of pkg.eClassifiers) {
    if (!isEClass(c)) continue;

    for (const ref of c.eReferences) {
      if (!ref.targetId || ref.targetId.trim() === '') {
        errors.push({
          nodeId: ref.id,
          field: 'targetId',
          message: `Reference "${ref.name}" in class "${c.name}" has no target type specified.`,
        });
      } else if (!classIds.has(ref.targetId)) {
        errors.push({
          nodeId: ref.id,
          field: 'targetId',
          message: `Reference "${ref.name}" in class "${c.name}" targets non-existent class (ID: "${ref.targetId.slice(0, 16)}…").`,
        });
      }
    }
  }

  return errors;
}

/**
 * e) No ciclos de herencia (error) — DFS-based cycle detection
 */
function validateInheritanceCycles(pkg: SerializableEPackage): ValidationError[] {
  const errors: ValidationError[] = [];

  // Construir adjacency list: parentId → childIds
  const childrenOf = new Map<string, string[]>();
  const allClasses = pkg.eClassifiers.filter(isEClass) as SerializableEClass[];

  for (const cls of allClasses) {
    if (!childrenOf.has(cls.id)) {
      childrenOf.set(cls.id, []);
    }
  }

  for (const cls of allClasses) {
    for (const superId of cls.eSuperTypes) {
      const children = childrenOf.get(superId) ?? [];
      children.push(cls.id);
      childrenOf.set(superId, children);
    }
  }

  // DFS desde cada nodo
  const visitados = new Set<string>();
  const enRecursion = new Set<string>();

  function dfs(nodeId: string, path: string[]): string | null {
    if (enRecursion.has(nodeId)) {
      // Ciclo detectado
      const cycleStart = path.indexOf(nodeId);
      return cycleStart >= 0 ? path.slice(cycleStart).concat(nodeId).join(' → ') : nodeId;
    }
    if (visitados.has(nodeId)) return null;

    visitados.add(nodeId);
    enRecursion.add(nodeId);
    path.push(nodeId);

    for (const childId of childrenOf.get(nodeId) ?? []) {
      const cycle = dfs(childId, path);
      if (cycle) {
        path.pop();
        enRecursion.delete(nodeId);
        return cycle;
      }
    }

    path.pop();
    enRecursion.delete(nodeId);
    return null;
  }

  for (const cls of allClasses) {
    if (!visitados.has(cls.id)) {
      const cycle = dfs(cls.id, []);
      if (cycle) {
        errors.push({
          nodeId: cls.id,
          field: 'eSuperTypes',
          message: `Inheritance cycle detected: ${cycle}. Inheritance hierarchy must be a DAG.`,
        });
        // Detener la validación de ciclos después del primer error para evitar spam
        break;
      }
    }
  }

  return errors;
}

/**
 * f) Containment no duplicado (un elemento no puede ser contenido por dos padres) (warning)
 */
function validateContainmentUniqueness(pkg: SerializableEPackage): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  // Mapa: targetId → [{ sourceClassName, refName, refId }]
  const containmentMap = new Map<string, { className: string; refName: string; refId: string }[]>();

  for (const c of pkg.eClassifiers) {
    if (!isEClass(c)) continue;

    for (const ref of c.eReferences) {
      if (ref.containment && ref.targetId) {
        const entries = containmentMap.get(ref.targetId) ?? [];
        entries.push({ className: c.name, refName: ref.name, refId: ref.id });
        containmentMap.set(ref.targetId, entries);
      }
    }
  }

  containmentMap.forEach((sources, targetId) => {
    if (sources.length > 1) {
      const targetName = pkg.eClassifiers.find((c) => c.id === targetId)?.name ?? targetId;
      sources.forEach((src) => {
        warnings.push({
          nodeId: src.refId,
          field: 'containment',
          message: `"${targetName}" is contained by "${src.className}::${src.refName}" but also has ${sources.length - 1} other containment reference(s). A classifier should have at most one container.`,
        });
      });
    }
  });

  return warnings;
}

// ================================================================
// Public API
// ================================================================

/**
 * Valida un modelo Ecore completo contra las reglas de integridad.
 *
 * Reglas:
 *  a) Nombres de EClass únicos dentro del EPackage (error)
 *  b) Nombres de EStructuralFeature únicos dentro del EClass (error)
 *  c) eType de EAttribute debe ser EDataType conocido (warning)
 *  d) eType de EReference debe ser un EClass existente (error)
 *  e) No ciclos de herencia (error)
 *  f) Containment no duplicado (warning)
 *
 * @param pkg - El EPackage serializable a validar
 * @returns ValidationResult con listas de errores y warnings
 */
export function validateModel(pkg: SerializableEPackage): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // a) Nombres de classifier únicos
  errors.push(...validateUniqueClassNames(pkg));

  // b) Nombres de feature únicos dentro de cada clase
  errors.push(...validateUniqueFeatureNames(pkg));

  // c) Tipos de atributos conocidos (warning)
  warnings.push(...validateAttributeTypes(pkg));

  // d) Referencias a clases existentes
  errors.push(...validateReferenceTargets(pkg));

  // e) Ciclos de herencia
  errors.push(...validateInheritanceCycles(pkg));

  // f) Containment no duplicado (warning)
  warnings.push(...validateContainmentUniqueness(pkg));

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export default validateModel;
