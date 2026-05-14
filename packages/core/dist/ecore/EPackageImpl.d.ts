/**
 * @emf-webapp/core — EPackageImpl
 *
 * Implementación de EPackage con eClassifiers, eSubpackages,
 * eFactoryInstance, getEClassifier(name).
 */
import { ENamedElementImpl } from './ENamedElementImpl.js';
import type { EPackage, EClassifier, EFactory } from './interfaces.js';
import { EListImpl } from '../util/EList.js';
export declare class EPackageImpl extends ENamedElementImpl implements EPackage {
    protected _nsURI: string;
    protected _nsPrefix: string;
    /** Clasificadores contenidos (containment) */
    protected _eClassifiers: EListImpl<EClassifier>;
    /** Subpaquetes (containment) */
    protected _eSubpackages: EListImpl<EPackage>;
    /** Super paquete */
    protected _eSuperPackage: EPackage | null;
    /** Fábrica asociada (containment) */
    protected _eFactoryInstance: EFactory | null;
    get nsURI(): string;
    set nsURI(value: string);
    get nsPrefix(): string;
    set nsPrefix(value: string);
    get eClassifiers(): EClassifier[];
    set eClassifiers(value: EClassifier[]);
    get eSubpackages(): EPackage[];
    set eSubpackages(value: EPackage[]);
    /** DERIVED, transient */
    get eSuperPackage(): EPackage | null;
    get eFactoryInstance(): EFactory;
    set eFactoryInstance(value: EFactory);
    /**
     * Busca un clasificador por nombre.
     */
    getEClassifier(name: string): EClassifier | null;
    toString(): string;
}
//# sourceMappingURL=EPackageImpl.d.ts.map