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
import { EGenericTypeImpl } from './EGenericTypeImpl.js';
import { EListImpl } from '../util/EList.js';
export class EClassImpl extends EClassifierImpl {
    // ==========================================================
    // Almacenamiento
    // ==========================================================
    _abstract = false;
    _interface = false;
    /** Super tipos genéricos (containment) — fuente de verdad para eSuperTypes */
    _eGenericSuperTypes = new EListImpl({
        unique: false,
        notifier: this,
    });
    /** Features estructurales locales (containment) */
    _eStructuralFeatures = new EListImpl({
        unique: true,
        notifier: this,
    });
    /** Operaciones locales (containment) */
    _eOperations = new EListImpl({
        unique: true,
        notifier: this,
    });
    // ==========================================================
    // Cachés para propiedades derivadas
    // ==========================================================
    _derivedCache = {
        eSuperTypes: null,
        eAllSuperTypes: null,
        eAllGenericSuperTypes: null,
        eAllStructuralFeatures: null,
        eAllAttributes: null,
        eAllReferences: null,
        eAllOperations: null,
        eAllContainments: null,
        eAttributes: null,
        eReferences: null,
        eIDAttribute: null,
        featuresDirty: true,
        operationsDirty: true,
        supersDirty: true,
    };
    markSupersDirty() {
        this._derivedCache.eSuperTypes = null;
        this._derivedCache.eAllSuperTypes = null;
        this._derivedCache.eAllGenericSuperTypes = null;
        this._derivedCache.featuresDirty = true;
        this._derivedCache.operationsDirty = true;
        this._derivedCache.supersDirty = true;
    }
    markFeaturesDirty() {
        this._derivedCache.eAllStructuralFeatures = null;
        this._derivedCache.eAllAttributes = null;
        this._derivedCache.eAllReferences = null;
        this._derivedCache.eAllContainments = null;
        this._derivedCache.eAttributes = null;
        this._derivedCache.eReferences = null;
        this._derivedCache.eIDAttribute = null;
        this._derivedCache.featuresDirty = true;
    }
    markOperationsDirty() {
        this._derivedCache.eAllOperations = null;
        this._derivedCache.operationsDirty = true;
    }
    // ==========================================================
    // Propiedades básicas
    // ==========================================================
    get abstract() {
        return this._abstract;
    }
    set abstract(value) {
        const old = this._abstract;
        this._abstract = value;
        this.fireNotification(1, -1, old, value, -1);
    }
    get interface() {
        return this._interface;
    }
    set interface(value) {
        const old = this._interface;
        this._interface = value;
        this.fireNotification(1, -1, old, value, -1);
    }
    // ==========================================================
    // eSuperTypes — DERIVED desde eGenericSuperTypes (erasure)
    // ==========================================================
    get eSuperTypes() {
        if (this._derivedCache.eSuperTypes === null) {
            this._derivedCache.eSuperTypes = this.computeESuperTypes();
        }
        return this._derivedCache.eSuperTypes;
    }
    set eSuperTypes(value) {
        // EMF: eSuperTypes setter convierte cada EClass a EGenericType
        // Limpiamos eGenericSuperTypes y los recreamos
        this._eGenericSuperTypes.clear();
        for (const sup of value) {
            // Creamos un EGenericType que referencia a esta clase
            const gt = new EGenericTypeImpl();
            gt.eClassifier = sup;
            this._eGenericSuperTypes.add(gt);
        }
        this.markSupersDirty();
    }
    // ==========================================================
    // eGenericSuperTypes — fuente de verdad
    // ==========================================================
    get eGenericSuperTypes() {
        return this._eGenericSuperTypes;
    }
    set eGenericSuperTypes(value) {
        this._eGenericSuperTypes.clear();
        for (const gt of value) {
            this._eGenericSuperTypes.add(gt);
        }
        this.markSupersDirty();
    }
    // ==========================================================
    // eAllSuperTypes — DERIVED (clausura transitiva DFS)
    // ==========================================================
    get eAllSuperTypes() {
        if (this._derivedCache.eAllSuperTypes === null) {
            this._derivedCache.eAllSuperTypes = this.computeAllSuperTypesDFS();
        }
        return this._derivedCache.eAllSuperTypes;
    }
    // ==========================================================
    // eAllGenericSuperTypes — DERIVED (clausura transitiva DFS)
    // ==========================================================
    get eAllGenericSuperTypes() {
        if (this._derivedCache.eAllGenericSuperTypes === null) {
            this._derivedCache.eAllGenericSuperTypes = this.computeAllGenericSuperTypesDFS();
        }
        return this._derivedCache.eAllGenericSuperTypes;
    }
    // ==========================================================
    // Features locales
    // ==========================================================
    get eStructuralFeatures() {
        return this._eStructuralFeatures;
    }
    set eStructuralFeatures(value) {
        this._eStructuralFeatures.clear();
        for (const f of value) {
            this._eStructuralFeatures.add(f);
        }
        this.markFeaturesDirty();
    }
    /** DERIVED — solo EAttribute de eStructuralFeatures */
    get eAttributes() {
        if (this._derivedCache.eAttributes === null) {
            this._derivedCache.eAttributes = this._eStructuralFeatures
                .toArray()
                .filter((f) => 'iD' in f);
        }
        return this._derivedCache.eAttributes;
    }
    /** DERIVED — solo EReference de eStructuralFeatures */
    get eReferences() {
        if (this._derivedCache.eReferences === null) {
            this._derivedCache.eReferences = this._eStructuralFeatures
                .toArray()
                .filter((f) => 'containment' in f);
        }
        return this._derivedCache.eReferences;
    }
    // ==========================================================
    // Operaciones
    // ==========================================================
    get eOperations() {
        return this._eOperations;
    }
    set eOperations(value) {
        this._eOperations.clear();
        for (const op of value) {
            this._eOperations.add(op);
        }
        this.markOperationsDirty();
    }
    // ==========================================================
    // Propiedades ALL (derivadas)
    // ==========================================================
    /**
     * DERIVED — todos los atributos (locales + herencia DFS).
     */
    get eAllAttributes() {
        if (this._derivedCache.eAllAttributes === null) {
            this._derivedCache.eAllAttributes = this.computeAllOfType('attribute');
        }
        return this._derivedCache.eAllAttributes;
    }
    /**
     * DERIVED — todas las referencias (locales + herencia DFS).
     */
    get eAllReferences() {
        if (this._derivedCache.eAllReferences === null) {
            this._derivedCache.eAllReferences = this.computeAllOfType('reference');
        }
        return this._derivedCache.eAllReferences;
    }
    /**
     * DERIVED — todos los features estructurales (locales + herencia DFS).
     */
    get eAllStructuralFeatures() {
        if (this._derivedCache.eAllStructuralFeatures === null) {
            this._derivedCache.eAllStructuralFeatures = this.computeAllStructuralFeatures();
        }
        return this._derivedCache.eAllStructuralFeatures;
    }
    /**
     * DERIVED — todas las operaciones (locales + herencia DFS).
     */
    get eAllOperations() {
        if (this._derivedCache.eAllOperations === null) {
            this._derivedCache.eAllOperations = this.computeAllOperations();
        }
        return this._derivedCache.eAllOperations;
    }
    /**
     * DERIVED — todas las referencias con containment=true.
     */
    get eAllContainments() {
        if (this._derivedCache.eAllContainments === null) {
            this._derivedCache.eAllContainments = this.computeAllContainments();
        }
        return this._derivedCache.eAllContainments;
    }
    /**
     * DERIVED — el atributo que es ID (iD=true), o null si no hay ninguno.
     */
    get eIDAttribute() {
        if (this._derivedCache.eIDAttribute === null) {
            this._derivedCache.eIDAttribute = this.computeEIDAttribute();
        }
        return this._derivedCache.eIDAttribute;
    }
    // ==========================================================
    // Métodos
    // ==========================================================
    /**
     * Número total de features estructurales (incluyendo herencia).
     */
    getFeatureCount() {
        return this.eAllStructuralFeatures.length;
    }
    /**
     * FeatureID de un feature en esta clase.
     * El featureID es el índice en eAllStructuralFeatures.
     */
    getFeatureID(feature) {
        const all = this.eAllStructuralFeatures;
        return all.indexOf(feature);
    }
    getEStructuralFeature(idOrName) {
        if (typeof idOrName === 'number') {
            const all = this.eAllStructuralFeatures;
            return idOrName >= 0 && idOrName < all.length ? all[idOrName] : null;
        }
        else {
            // Buscar por nombre
            const all = this.eAllStructuralFeatures;
            for (const f of all) {
                if (f.name === idOrName) {
                    return f;
                }
            }
            return null;
        }
    }
    /**
     * Obtiene el tipo de un feature estructural como EGenericType.
     */
    getFeatureType(feature) {
        const gt = feature.eGenericType;
        if (gt) {
            return gt;
        }
        // Crear un EGenericType implícito
        const result = new EGenericTypeImpl();
        result.eClassifier = feature.eType;
        return result;
    }
    /**
     * Número total de operaciones (incluyendo herencia).
     */
    getOperationCount() {
        return this.eAllOperations.length;
    }
    /**
     * OperationID de una operación en esta clase.
     * El ID es el índice en eAllOperations.
     */
    getOperationID(operation) {
        const all = this.eAllOperations;
        return all.indexOf(operation);
    }
    /**
     * Obtiene la operación por su ID (índice).
     */
    getEOperation(operationID) {
        const all = this.eAllOperations;
        if (operationID >= 0 && operationID < all.length) {
            return all[operationID];
        }
        throw new RangeError(`Invalid operation ID: ${operationID}`);
    }
    /**
     * Encuentra el override de una operación.
     * Busca en los super tipos una operación con el mismo nombre y parámetros.
     */
    getOverride(operation) {
        // Buscar en super tipos DFS
        const allOps = this.eAllOperations;
        // El override es la operación en un super tipo con el mismo nombre
        for (const sup of this.eAllSuperTypes) {
            for (const supOp of sup.eOperations) {
                if (supOp.name === operation.name) {
                    return supOp;
                }
            }
        }
        throw new Error(`No override found for operation '${operation.name}' in ${this._name}`);
    }
    /**
     * Verifica si esta clase es supertipo de someClass (directa o transitivamente).
     */
    isSuperTypeOf(someClass) {
        if (someClass === this)
            return true;
        return someClass.eAllSuperTypes.includes(this);
    }
    /**
     * Retorna el classifierID para esta clase (índice del paquete).
     */
    getClassifierID() {
        // Si estamos dentro de un paquete, buscar nuestro índice
        if (this._ePackage) {
            const classifiers = this._ePackage.eClassifiers;
            return classifiers.indexOf(this);
        }
        return -1;
    }
    // ==========================================================
    // Métodos de cómputo interno
    // ==========================================================
    /**
     * Computa eSuperTypes desde eGenericSuperTypes (erasure).
     */
    computeESuperTypes() {
        const result = [];
        for (const gt of this._eGenericSuperTypes) {
            // Erasure: obtenemos el eRawType o eClassifier
            let cls = gt.eRawType ?? gt.eClassifier;
            if (cls && 'eSuperTypes' in cls) {
                result.push(cls);
            }
        }
        return result;
    }
    /**
     * Computa eAllSuperTypes como clausura transitiva DFS de eSuperTypes.
     * Orden: DFS pre-order, sin duplicados, excluyendo self.
     */
    computeAllSuperTypesDFS() {
        const visited = new Set();
        const result = [];
        const dfs = (cls) => {
            for (const sup of cls.eSuperTypes) {
                if (!visited.has(sup)) {
                    visited.add(sup);
                    result.push(sup);
                    dfs(sup);
                }
            }
        };
        dfs(this);
        return result;
    }
    /**
     * Computa eAllGenericSuperTypes como clausura transitiva DFS.
     */
    computeAllGenericSuperTypesDFS() {
        const visited = new Set();
        const result = [];
        const dfs = (cls) => {
            for (const gt of cls.eGenericSuperTypes) {
                const raw = gt.eRawType ?? gt.eClassifier;
                if (raw && 'eSuperTypes' in raw) {
                    const clsRaw = raw;
                    if (!visited.has(clsRaw)) {
                        visited.add(clsRaw);
                        result.push(gt);
                        dfs(clsRaw);
                    }
                }
            }
        };
        dfs(this);
        return result;
    }
    /**
     * Computa todos los features estructurales (herencia DFS + locales).
     * Orden: super tipos DFS pre-order, luego locales.
     */
    computeAllStructuralFeatures() {
        const result = [];
        const visitedClasses = new Set();
        const dfsFeatures = (cls) => {
            for (const sup of cls.eSuperTypes) {
                if (!visitedClasses.has(sup)) {
                    visitedClasses.add(sup);
                    dfsFeatures(sup);
                    // Añadimos los features de este super tipo
                    for (const f of sup.eStructuralFeatures) {
                        if (!result.includes(f)) {
                            result.push(f);
                        }
                    }
                }
            }
        };
        // DFS sobre super tipos
        visitedClasses.add(this);
        for (const sup of this.eSuperTypes) {
            if (!visitedClasses.has(sup)) {
                visitedClasses.add(sup);
                dfsFeatures(sup);
                for (const f of sup.eStructuralFeatures) {
                    if (!result.includes(f)) {
                        result.push(f);
                    }
                }
            }
        }
        // Luego features locales
        for (const f of this._eStructuralFeatures) {
            if (!result.includes(f)) {
                result.push(f);
            }
        }
        return result;
    }
    /**
     * Computa todos los features de un tipo específico (atributos o referencias).
     */
    computeAllOfType(type) {
        const all = this.eAllStructuralFeatures;
        const result = [];
        for (const f of all) {
            if (type === 'attribute' && 'iD' in f) {
                result.push(f);
            }
            else if (type === 'reference' && 'containment' in f) {
                result.push(f);
            }
        }
        return result;
    }
    /**
     * Computa todas las operaciones (herencia DFS + locales).
     */
    computeAllOperations() {
        const result = [];
        const visitedClasses = new Set();
        const dfsOps = (cls) => {
            for (const sup of cls.eSuperTypes) {
                if (!visitedClasses.has(sup)) {
                    visitedClasses.add(sup);
                    dfsOps(sup);
                    for (const op of sup.eOperations) {
                        if (!result.includes(op)) {
                            result.push(op);
                        }
                    }
                }
            }
        };
        visitedClasses.add(this);
        for (const sup of this.eSuperTypes) {
            if (!visitedClasses.has(sup)) {
                visitedClasses.add(sup);
                dfsOps(sup);
                for (const op of sup.eOperations) {
                    if (!result.includes(op)) {
                        result.push(op);
                    }
                }
            }
        }
        for (const op of this._eOperations) {
            if (!result.includes(op)) {
                result.push(op);
            }
        }
        return result;
    }
    /**
     * Computa todas las referencias de containment.
     */
    computeAllContainments() {
        const all = this.eAllReferences;
        return all.filter((r) => r.containment);
    }
    /**
     * Computa el atributo ID (eIDAttribute).
     */
    computeEIDAttribute() {
        for (const attr of this.eAllAttributes) {
            if (attr.iD) {
                return attr;
            }
        }
        return null;
    }
}
//# sourceMappingURL=EClassImpl.js.map