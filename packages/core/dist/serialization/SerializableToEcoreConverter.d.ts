/**
 * @emf-webapp/core — SerializableToEcoreConverter
 *
 * Convierte el formato SerializableEPackage (JSON plano almacenado en DB)
 * a objetos EObject/EPackageImpl completos para usar con XMISerializer.
 *
 * Esto permite exportar metamodelos a XMI 2.0 compatible con Eclipse EMF.
 *
 * Formato de entrada: SerializableEPackage (desde frontend/types.ts)
 * Formato de salida: EPackageImpl (desde ecore/EPackageImpl.ts)
 */
import { EPackageImpl } from '../ecore/index.js';
export interface SerializableAnnotation {
    source: string;
    details: Record<string, string>;
}
export interface SerializableEAttribute {
    id: string;
    name: string;
    eType: string;
    lowerBound: number;
    upperBound: number;
    iD: boolean;
    defaultValueLiteral: string;
    changeable: boolean;
    derived: boolean;
    transient: boolean;
    annotations?: SerializableAnnotation[];
}
export interface SerializableEReference {
    id: string;
    name: string;
    targetId: string;
    containment: boolean;
    lowerBound: number;
    upperBound: number;
    eOpposite: string | null;
    changeable: boolean;
    derived: boolean;
    annotations?: SerializableAnnotation[];
}
export interface SerializableEParameter {
    id: string;
    name: string;
    eType: string;
    lowerBound: number;
    upperBound: number;
}
export interface SerializableEOperation {
    id: string;
    name: string;
    eType: string;
    lowerBound: number;
    upperBound: number;
    eParameters: SerializableEParameter[];
    annotations?: SerializableAnnotation[];
}
export interface SerializableEClass {
    id: string;
    name: string;
    abstract: boolean;
    interface: boolean;
    eSuperTypes: string[];
    eAttributes: SerializableEAttribute[];
    eReferences: SerializableEReference[];
    eOperations?: SerializableEOperation[];
    annotations?: SerializableAnnotation[];
    position?: {
        x: number;
        y: number;
    };
}
export interface SerializableEEnumLiteral {
    id: string;
    name: string;
    value: number;
    literal: string;
}
export interface SerializableEEnum {
    id: string;
    name: string;
    eLiterals: SerializableEEnumLiteral[];
    annotations?: SerializableAnnotation[];
    position?: {
        x: number;
        y: number;
    };
}
export interface SerializableEDataType {
    id: string;
    name: string;
    instanceClassName: string;
    serializable: boolean;
    annotations?: SerializableAnnotation[];
    position?: {
        x: number;
        y: number;
    };
}
export interface SerializableEPackage {
    name: string;
    nsURI: string;
    nsPrefix: string;
    eClassifiers: (SerializableEClass | SerializableEEnum | SerializableEDataType)[];
    annotations?: SerializableAnnotation[];
}
export declare class SerializableToEcoreConverter {
    private readonly idToClassifier;
    private readonly idToEClass;
    private readonly idToEDataType;
    private readonly ePackage;
    private readonly staticPackages;
    constructor();
    /**
     * Inicializa los EDataType estándar de Ecore como si fueran
     * parte del paquete http://www.eclipse.org/emf/2002/Ecore.
     */
    private initStaticDataTypes;
    /**
     * Convierte un SerializableEPackage a EPackageImpl.
     * @returns EPackage listo para usar con XMISerializer
     */
    convert(serializable: SerializableEPackage): EPackageImpl;
    private createAnnotation;
}
//# sourceMappingURL=SerializableToEcoreConverter.d.ts.map