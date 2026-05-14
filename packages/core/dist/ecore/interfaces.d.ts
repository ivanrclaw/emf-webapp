/**
 * @emf-webapp/core — Core Ecore Metametamodel
 *
 * Implementación TypeScript completa del metametamodelo Ecore
 * conforme a EMF 2.45.0 (febrero 2026).
 *
 * Referencia: https://download.eclipse.org/modeling/emf/emf/javadoc/latest/
 */
/** Adaptador para el sistema de notificaciones EMF */
export interface Adapter {
    getTarget(): EObject | null;
    setTarget(newTarget: EObject): void;
    notifyChanged(notification: Notification): void;
    isAdapterForType(type: any): boolean;
}
/** Tipos de evento de notificación */
export declare const enum EventType {
    SET = 1,
    UNSET = 2,
    ADD = 3,
    REMOVE = 4,
    ADD_MANY = 5,
    REMOVE_MANY = 6,
    MOVE = 7
}
/** Notificación de cambio en el modelo */
export interface Notification {
    getNotifier(): any;
    getFeature(): EStructuralFeature | null;
    getFeatureID(expectedClass: EClass): number;
    getOldValue(): any;
    getNewValue(): any;
    getEventType(): number;
    getPosition(): number;
    isTouch(): boolean;
    merge(notification: Notification): boolean;
}
/** Interfaz Notifier — base del sistema de eventos EMF */
export interface Notifier {
    eAdapters(): Adapter[];
    eDeliver(): boolean;
    eSetDeliver(deliver: boolean): void;
    eNotify(notification: Notification): void;
}
export interface EObject extends Notifier {
    /** Devuelve la metaclase (EClass) que define este objeto */
    eClass(): EClass;
    /** Contenedor inmediato (quien me contiene por containment) */
    eContainer(): EObject | null;
    /** Feature del contenedor que me contiene (puede ser FeatureMap.Entry) */
    eContainingFeature(): EStructuralFeature | null;
    /** EReference de containment que me contiene (siempre EReference) */
    eContainmentFeature(): EReference | null;
    /** Recurso al que pertenezco (yo o mi contenedor) */
    eResource(): Resource | null;
    /** Hijos directos (por features de containment) — lista no modificable */
    eContents(): EObject[];
    /** Todos los descendientes (recursivo) */
    eAllContents(): IterableIterator<EObject>;
    /** Objetos referenciados NO por containment (excluye opposites) */
    eCrossReferences(): EObject[];
    eGet(feature: EStructuralFeature): any;
    eGet(feature: EStructuralFeature, resolve: boolean): any;
    eSet(feature: EStructuralFeature, value: any): void;
    eIsSet(feature: EStructuralFeature): boolean;
    eUnset(feature: EStructuralFeature): void;
    eInvoke(operation: EOperation, args: any[]): any;
    eIsProxy(): boolean;
}
export interface EModelElement extends EObject {
    eAnnotations: EAnnotation[];
    getEAnnotation(source: string): EAnnotation | null;
}
export interface ENamedElement extends EModelElement {
    name: string;
}
export interface EClassifier extends ENamedElement {
    instanceClassName: string;
    readonly instanceClass: any;
    defaultValue: string;
    instanceTypeName: string;
    ePackage: EPackage;
    eTypeParameters: ETypeParameter[];
    isInstance(object: any): boolean;
    getClassifierID(): number;
}
export interface EClass extends EClassifier {
    abstract: boolean;
    interface: boolean;
    eSuperTypes: EClass[];
    eGenericSuperTypes: EGenericType[];
    readonly eAllSuperTypes: EClass[];
    readonly eAllGenericSuperTypes: EGenericType[];
    eStructuralFeatures: EStructuralFeature[];
    eOperations: EOperation[];
    readonly eAttributes: EAttribute[];
    readonly eReferences: EReference[];
    readonly eAllAttributes: EAttribute[];
    readonly eAllReferences: EReference[];
    readonly eAllStructuralFeatures: EStructuralFeature[];
    readonly eAllOperations: EOperation[];
    readonly eAllContainments: EReference[];
    readonly eIDAttribute: EAttribute | null;
    eTypeParameters: ETypeParameter[];
    getFeatureCount(): number;
    getFeatureID(feature: EStructuralFeature): number;
    getFeatureType(feature: EStructuralFeature): EGenericType;
    getEStructuralFeature(featureID: number): EStructuralFeature;
    getEStructuralFeature(featureName: string): EStructuralFeature | null;
    getOperationCount(): number;
    getOperationID(operation: EOperation): number;
    getEOperation(operationID: number): EOperation;
    getOverride(operation: EOperation): EOperation;
    isSuperTypeOf(someClass: EClass): boolean;
}
export interface ETypedElement extends ENamedElement {
    ordered: boolean;
    unique: boolean;
    lowerBound: number;
    upperBound: number;
    readonly many: boolean;
    readonly required: boolean;
    eType: EClassifier | null;
    eGenericType: EGenericType | null;
}
export interface EStructuralFeature extends ETypedElement {
    changeable: boolean;
    volatile: boolean;
    transient: boolean;
    defaultValueLiteral: string;
    unsettable: boolean;
    derived: boolean;
    readonly defaultValue: any;
    readonly eContainingClass: EClass;
    getFeatureID(): number;
    getContainerClass(): any;
}
export interface EAttribute extends EStructuralFeature {
    iD: boolean;
    readonly eAttributeType: EDataType;
}
export interface EReference extends EStructuralFeature {
    containment: boolean;
    readonly container: boolean;
    resolveProxies: boolean;
    eOpposite: EReference | null;
    readonly eReferenceType: EClass;
    eKeys: EAttribute[];
}
export interface EDataType extends EClassifier {
    serializable: boolean;
}
export interface EEnum extends EDataType {
    eLiterals: EEnumLiteral[];
    getEEnumLiteral(name: string): EEnumLiteral | null;
    getEEnumLiteral(value: number): EEnumLiteral | null;
    getEEnumLiteral(literal: string): EEnumLiteral | null;
}
export interface EEnumLiteral extends ENamedElement {
    value: number;
    literal: string;
    readonly instance: any;
    readonly eEnum: EEnum;
}
export interface EOperation extends ETypedElement {
    readonly eContainingClass: EClass;
    eParameters: EParameter[];
    readonly eExceptions: EClassifier[];
    eGenericExceptions: EGenericType[];
    eTypeParameters: ETypeParameter[];
    getOperationID(): number;
    isOverrideOf(someOperation: EOperation): boolean;
}
export interface EParameter extends ETypedElement {
    readonly eOperation: EOperation;
}
export interface EPackage extends ENamedElement {
    nsURI: string;
    nsPrefix: string;
    eClassifiers: EClassifier[];
    eSubpackages: EPackage[];
    readonly eSuperPackage: EPackage | null;
    readonly eFactoryInstance: EFactory;
    getEClassifier(name: string): EClassifier | null;
}
export interface EFactory extends EModelElement {
    readonly ePackage: EPackage;
    create(eClass: EClass): EObject;
    createFromString(eDataType: EDataType, literalValue: string): any;
    convertToString(eDataType: EDataType, instanceValue: any): string;
}
export interface EAnnotation extends EModelElement {
    source: string;
    details: Record<string, string>;
    contents: EObject[];
    references: EObject[];
    readonly eModelElement: EModelElement | null;
}
export interface EGenericType extends EObject {
    eUpperBound: EClassifier | null;
    eTypeArguments: EGenericType[];
    readonly eRawType: EClassifier | null;
    eLowerBound: EClassifier | null;
    eTypeParameter: ETypeParameter | null;
    eClassifier: EClassifier | null;
}
export interface ETypeParameter extends ENamedElement {
    eBounds: EGenericType[];
}
export interface Resource {
    readonly resourceSet: ResourceSet | null;
    readonly uri: URI;
    contents: EObject[];
    errors: ResourceDiagnostic[];
    warnings: ResourceDiagnostic[];
    modified: boolean;
    trackingModification: boolean;
    loaded: boolean;
    save(options?: Record<string, any>): void;
    load(options?: Record<string, any>): void;
    unload(): void;
    getAllContents(): IterableIterator<EObject>;
    getEObject(uriFragment: string): EObject | null;
    getURIFragment(eObject: EObject): string;
    delete(options?: Record<string, any>): void;
}
export interface ResourceDiagnostic {
    readonly location: string;
    readonly line: number;
    readonly column: number;
    readonly message: string;
}
export interface URI {
    scheme: string;
    schemeSpecificPart: string;
    authority: string;
    host: string;
    port: number;
    path: string;
    device: string;
    segments: string[];
    lastSegment: string;
    fileExtension: string;
    query: string;
    fragment: string;
    appendSegment(segment: string): URI;
    appendSegments(segments: string[]): URI;
    trimSegments(count: number): URI;
    resolve(uri: URI): URI;
    deresolve(uri: URI): URI;
    isRelative(): boolean;
    isHierarchical(): boolean;
    toFileString(): string;
    toPlatformString(force: boolean): string;
}
export interface ResourceSet {
    resources: Resource[];
    readonly packageRegistry: PackageRegistry;
    getResource(uri: URI, loadOnDemand: boolean): Resource;
    createResource(uri: URI): Resource;
    getEObject(uri: URI, resolve: boolean): EObject | null;
    getResources(): Resource[];
}
export interface PackageRegistry {
    getEPackage(nsURI: string): EPackage | null;
    putEPackage(nsURI: string, ePackage: EPackage): void;
    removeEPackage(ePackage: EPackage): void;
    values(): EPackage[];
}
export interface EList<T> extends Array<T> {
    get(index: number): T;
    size(): number;
    isEmpty(): boolean;
    contains(e: T): boolean;
    containsAll(collection: T[]): boolean;
    indexOf(e: T): number;
    lastIndexOf(e: T): number;
    toArray(): T[];
    add(e: T): boolean;
    add(index: number, e: T): void;
    addAll(collection: T[]): boolean;
    addAll(index: number, collection: T[]): boolean;
    addUnique(e: T): void;
    addUnique(index: number, e: T): void;
    addAllUnique(collection: T[]): boolean;
    addAllUnique(index: number, collection: T[]): boolean;
    basicAdd(e: T): void;
    move(newIndex: number, e: T): void;
    move(oldIndex: number, newIndex: number): T;
    remove(index: number): T;
    remove(e: T): boolean;
    removeAll(collection: T[]): boolean;
    retainAll(collection: T[]): boolean;
    clear(): void;
    set(index: number, e: T): T;
    [Symbol.iterator](): IterableIterator<T>;
}
export declare const EcoreDataTypes: {
    readonly EString: "EString";
    readonly EBoolean: "EBoolean";
    readonly EInt: "EInt";
    readonly ELong: "ELong";
    readonly EFloat: "EFloat";
    readonly EDouble: "EDouble";
    readonly EByte: "EByte";
    readonly EByteArray: "EByteArray";
    readonly EChar: "EChar";
    readonly EShort: "EShort";
    readonly EBigDecimal: "EBigDecimal";
    readonly EBigInteger: "EBigInteger";
    readonly EDate: "EDate";
    readonly EObject: "EObject";
    readonly EJavaObject: "EJavaObject";
    readonly EJavaClass: "EJavaClass";
};
export type EcoreDataTypeName = typeof EcoreDataTypes[keyof typeof EcoreDataTypes];
//# sourceMappingURL=interfaces.d.ts.map