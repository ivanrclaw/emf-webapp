/**
 * @emf-webapp/core — OCLAnnotationExporter
 *
 * Convierte restricciones OCL en EAnnotations compatibles con Eclipse EMF.
 * Produce la estructura XML exacta que Eclipse espera para delegados OCL/Pivot.
 *
 * Formato de salida:
 * - Package level: delegados de invocación, setting y validación
 * - Class level: lista de constraints + cuerpos OCL
 * - Operation level: body de operación derivada
 * - Attribute level: derivation para atributos derivados
 */
// ═══════════════════════════════════════════════════════════════
// Constantes
// ═══════════════════════════════════════════════════════════════
const ECORE_ANNOTATION_SOURCE = 'http://www.eclipse.org/emf/2002/Ecore';
const OCL_PIVOT_SOURCE = 'http://www.eclipse.org/emf/2002/Ecore/OCL/Pivot';
// ═══════════════════════════════════════════════════════════════
// OCLAnnotationExporter
// ═══════════════════════════════════════════════════════════════
/**
 * Exporta restricciones OCL como EAnnotations en el formato que Eclipse EMF espera.
 *
 * Uso típico:
 * ```ts
 * const exporter = new OCLAnnotationExporter();
 * const pkgAnnotations = exporter.exportPackageAnnotations(constraints);
 * const classAnnotations = exporter.exportClassAnnotations('Person', constraints);
 * ```
 */
export class OCLAnnotationExporter {
    /**
     * Genera las anotaciones a nivel de paquete que habilitan la delegación OCL/Pivot.
     *
     * Eclipse requiere que el EPackage declare qué delegados usa para invocación,
     * setting y validación. Sin estas anotaciones, Eclipse no evalúa las expresiones OCL.
     *
     * @param constraints - Lista de constraints OCL del paquete (usada para determinar
     *   qué delegados son necesarios)
     * @returns Array de EAnnotationData para el paquete
     */
    exportPackageAnnotations(constraints) {
        if (constraints.length === 0) {
            return [];
        }
        const details = {};
        // Determinar qué delegados son necesarios según los tipos de constraints
        const hasInvocation = constraints.some((c) => c.type === 'body' || c.type === 'precondition' || c.type === 'postcondition');
        const hasSetting = constraints.some((c) => c.type === 'derive' || c.type === 'init');
        const hasValidation = constraints.some((c) => !c.type || c.type === 'invariant');
        if (hasInvocation) {
            details['invocationDelegates'] = OCL_PIVOT_SOURCE;
        }
        if (hasSetting) {
            details['settingDelegates'] = OCL_PIVOT_SOURCE;
        }
        if (hasValidation) {
            details['validationDelegates'] = OCL_PIVOT_SOURCE;
        }
        // Si no se detectó ningún tipo específico, incluir todos los delegados
        // (caso defensivo para constraints sin tipo explícito)
        if (Object.keys(details).length === 0) {
            details['invocationDelegates'] = OCL_PIVOT_SOURCE;
            details['settingDelegates'] = OCL_PIVOT_SOURCE;
            details['validationDelegates'] = OCL_PIVOT_SOURCE;
        }
        return [
            {
                source: ECORE_ANNOTATION_SOURCE,
                details,
            },
        ];
    }
    /**
     * Genera las anotaciones a nivel de clase para los constraints OCL.
     *
     * Produce dos tipos de anotaciones:
     * 1. Una anotación Ecore con la lista de nombres de constraints (space-separated)
     * 2. Una anotación OCL/Pivot por cada constraint con su expresión
     *
     * @param className - Nombre de la clase
     * @param constraints - Todos los constraints del modelo (se filtran por className)
     * @returns Array de EAnnotationData para la clase
     */
    exportClassAnnotations(className, constraints) {
        const classConstraints = constraints.filter((c) => c.context === className);
        if (classConstraints.length === 0) {
            return [];
        }
        const annotations = [];
        // Separar invariants de otros tipos
        const invariants = classConstraints.filter((c) => !c.type || c.type === 'invariant');
        const derived = classConstraints.filter((c) => c.type === 'derive');
        const bodies = classConstraints.filter((c) => c.type === 'body');
        // 1. Anotación Ecore con lista de constraints (solo invariants)
        if (invariants.length > 0) {
            const constraintNames = invariants.map((c) => c.name).join(' ');
            annotations.push({
                source: ECORE_ANNOTATION_SOURCE,
                details: {
                    constraints: constraintNames,
                },
            });
        }
        // 2. Anotación OCL/Pivot con los cuerpos de cada invariant
        if (invariants.length > 0) {
            const oclDetails = {};
            for (const constraint of invariants) {
                oclDetails[constraint.name] = constraint.expression;
            }
            annotations.push({
                source: OCL_PIVOT_SOURCE,
                details: oclDetails,
            });
        }
        // 3. Anotaciones para atributos derivados
        for (const constraint of derived) {
            annotations.push({
                source: OCL_PIVOT_SOURCE,
                details: {
                    derivation: constraint.expression,
                },
            });
        }
        // 4. Anotaciones para cuerpos de operación
        for (const constraint of bodies) {
            annotations.push({
                source: OCL_PIVOT_SOURCE,
                details: {
                    body: constraint.expression,
                },
            });
        }
        return annotations;
    }
    /**
     * Genera la anotación para el cuerpo de una operación derivada.
     *
     * @param body - Expresión OCL del cuerpo de la operación
     * @returns EAnnotationData con source OCL/Pivot y detail 'body'
     */
    exportOperationAnnotation(body) {
        return {
            source: OCL_PIVOT_SOURCE,
            details: {
                body,
            },
        };
    }
    /**
     * Genera la anotación para un atributo derivado.
     *
     * @param expression - Expresión OCL de derivación
     * @returns EAnnotationData con source OCL/Pivot y detail 'derivation'
     */
    exportDerivedAttributeAnnotation(expression) {
        return {
            source: OCL_PIVOT_SOURCE,
            details: {
                derivation: expression,
            },
        };
    }
}
//# sourceMappingURL=OCLAnnotationExporter.js.map