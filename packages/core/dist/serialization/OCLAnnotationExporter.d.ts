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
export interface OCLConstraintInfo {
    /** Nombre del constraint (e.g. 'nameNotEmpty') */
    name: string;
    /** Nombre de la clase contexto (e.g. 'Person') */
    context: string;
    /** Expresión OCL (e.g. 'self.name.size() > 0') */
    expression: string;
    /** Tipo de constraint OCL */
    type?: 'invariant' | 'precondition' | 'postcondition' | 'body' | 'derive' | 'init';
}
export interface EAnnotationData {
    source: string;
    details: Record<string, string>;
}
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
export declare class OCLAnnotationExporter {
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
    exportPackageAnnotations(constraints: OCLConstraintInfo[]): EAnnotationData[];
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
    exportClassAnnotations(className: string, constraints: OCLConstraintInfo[]): EAnnotationData[];
    /**
     * Genera la anotación para el cuerpo de una operación derivada.
     *
     * @param body - Expresión OCL del cuerpo de la operación
     * @returns EAnnotationData con source OCL/Pivot y detail 'body'
     */
    exportOperationAnnotation(body: string): EAnnotationData;
    /**
     * Genera la anotación para un atributo derivado.
     *
     * @param expression - Expresión OCL de derivación
     * @returns EAnnotationData con source OCL/Pivot y detail 'derivation'
     */
    exportDerivedAttributeAnnotation(expression: string): EAnnotationData;
}
//# sourceMappingURL=OCLAnnotationExporter.d.ts.map