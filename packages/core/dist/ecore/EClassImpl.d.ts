/**
 * @emf-webapp/core — EClassImpl
 *
 * Implementación completa de EClass con:
 * - eStructuralFeatures, eSuperTypes (derived from eGenericSuperTypes),
 *   eOperations, eGenericSuperTypes, eTypeParameters
 * - Todas las propiedades derivadas: eAllAttributes, eAllReferences,
 *   eAllSuperTypes, eAllContainments, eAllOperations, eAllStructuralFeatures,
 *   eIDAttribute, eAttributes (local), eReferences (local),
 *   eAllGenericSuperTypes
 * - Métodos: getFeatureCount, getFeatureID, getEStructuralFeature(name/id),
 *   getOperationCount, getOperationID, isSuperTypeOf, getOverride
 */
import { EClassifierImpl } from './EClassifierImpl.js';
import type { EClass, EStructuralFeature, EAttribute, EReference, EOperation, EGenericType } from './interfaces.js';
import { EListImpl } from '../util/EList.js';
export declare class EClassImpl extends EClassifierImpl implements EClass {
    protected _abstract: boolean;
    protected _interface: boolean;
    /** Super tipos genéricos (containment) — fuente de verdad para eSuperTypes */
    protected _eGenericSuperTypes: EListImpl<EGenericType>;
    /** Features estructurales locales (containment) */
    protected _eStructuralFeatures: EListImpl<EStructuralFeature>;
    /** Operaciones locales (containment) */
    protected _eOperations: EListImpl<EOperation>;
    private _derivedCache;
    private markSupersDirty;
    private markFeaturesDirty;
    private markOperationsDirty;
    get abstract(): boolean;
    set abstract(value: boolean);
    get interface(): boolean;
    set interface(value: boolean);
    get eSuperTypes(): EClass[];
    set eSuperTypes(value: EClass[]);
    get eGenericSuperTypes(): EGenericType[];
    set eGenericSuperTypes(value: EGenericType[]);
    get eAllSuperTypes(): EClass[];
    get eAllGenericSuperTypes(): EGenericType[];
    get eStructuralFeatures(): EStructuralFeature[];
    set eStructuralFeatures(value: EStructuralFeature[]);
    /** DERIVED — solo EAttribute de eStructuralFeatures */
    get eAttributes(): EAttribute[];
    /** DERIVED — solo EReference de eStructuralFeatures */
    get eReferences(): EReference[];
    get eOperations(): EOperation[];
    set eOperations(value: EOperation[]);
    /**
     * DERIVED — todos los atributos (locales + herencia DFS).
     */
    get eAllAttributes(): EAttribute[];
    /**
     * DERIVED — todas las referencias (locales + herencia DFS).
     */
    get eAllReferences(): EReference[];
    /**
     * DERIVED — todos los features estructurales (locales + herencia DFS).
     */
    get eAllStructuralFeatures(): EStructuralFeature[];
    /**
     * DERIVED — todas las operaciones (locales + herencia DFS).
     */
    get eAllOperations(): EOperation[];
    /**
     * DERIVED — todas las referencias con containment=true.
     */
    get eAllContainments(): EReference[];
    /**
     * DERIVED — el atributo que es ID (iD=true), o null si no hay ninguno.
     */
    get eIDAttribute(): EAttribute | null;
    /**
     * Número total de features estructurales (incluyendo herencia).
     */
    getFeatureCount(): number;
    /**
     * FeatureID de un feature en esta clase.
     * El featureID es el índice en eAllStructuralFeatures.
     */
    getFeatureID(feature: EStructuralFeature): number;
    /**
     * Obtiene el feature estructural por su ID (índice).
     */
    getEStructuralFeature(featureID: number): EStructuralFeature;
    /**
     * Obtiene el feature estructural por su nombre.
     */
    getEStructuralFeature(featureName: string): EStructuralFeature | null;
    /**
     * Obtiene el tipo de un feature estructural como EGenericType.
     */
    getFeatureType(feature: EStructuralFeature): import('./interfaces.js').EGenericType;
    /**
     * Número total de operaciones (incluyendo herencia).
     */
    getOperationCount(): number;
    /**
     * OperationID de una operación en esta clase.
     * El ID es el índice en eAllOperations.
     */
    getOperationID(operation: EOperation): number;
    /**
     * Obtiene la operación por su ID (índice).
     */
    getEOperation(operationID: number): EOperation;
    /**
     * Encuentra el override de una operación.
     * Busca en los super tipos una operación con el mismo nombre y parámetros.
     */
    getOverride(operation: EOperation): EOperation;
    /**
     * Verifica si esta clase es supertipo de someClass (directa o transitivamente).
     */
    isSuperTypeOf(someClass: EClass): boolean;
    /**
     * Retorna el classifierID para esta clase (índice del paquete).
     */
    getClassifierID(): number;
    /**
     * Computa eSuperTypes desde eGenericSuperTypes (erasure).
     */
    private computeESuperTypes;
    /**
     * Computa eAllSuperTypes como clausura transitiva DFS de eSuperTypes.
     * Orden: DFS pre-order, sin duplicados, excluyendo self.
     */
    private computeAllSuperTypesDFS;
    /**
     * Computa eAllGenericSuperTypes como clausura transitiva DFS.
     */
    private computeAllGenericSuperTypesDFS;
    /**
     * Computa todos los features estructurales (herencia DFS + locales).
     * Orden: super tipos DFS pre-order, luego locales.
     */
    private computeAllStructuralFeatures;
    /**
     * Computa todos los features de un tipo específico (atributos o referencias).
     */
    private computeAllOfType;
    /**
     * Computa todas las operaciones (herencia DFS + locales).
     */
    private computeAllOperations;
    /**
     * Computa todas las referencias de containment.
     */
    private computeAllContainments;
    /**
     * Computa el atributo ID (eIDAttribute).
     */
    private computeEIDAttribute;
}
//# sourceMappingURL=EClassImpl.d.ts.map