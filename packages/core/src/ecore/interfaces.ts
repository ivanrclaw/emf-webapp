/**
 * @emf-webapp/core — Core Ecore Metametamodel
 *
 * Implementación TypeScript completa del metametamodelo Ecore
 * conforme a EMF 2.45.0 (febrero 2026).
 *
 * Referencia: https://download.eclipse.org/modeling/emf/emf/javadoc/latest/
 */

// ============================================================
// Tipos auxiliares y constantes
// ============================================================

/** Adaptador para el sistema de notificaciones EMF */
export interface Adapter {
  getTarget(): EObject | null;
  setTarget(newTarget: EObject): void;
  notifyChanged(notification: Notification): void;
  isAdapterForType(type: any): boolean;
}

/** Tipos de evento de notificación */
export const enum EventType {
  SET = 1,
  UNSET = 2,
  ADD = 3,
  REMOVE = 4,
  ADD_MANY = 5,
  REMOVE_MANY = 6,
  MOVE = 7,
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

// ============================================================
// EObject — raíz de todo objeto modelado
// ============================================================

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

  // === API REFLEXIVA ===
  eGet(feature: EStructuralFeature): any;
  eGet(feature: EStructuralFeature, resolve: boolean): any;
  eSet(feature: EStructuralFeature, value: any): void;
  eIsSet(feature: EStructuralFeature): boolean;
  eUnset(feature: EStructuralFeature): void;

  // === OPERACIONES ===
  eInvoke(operation: EOperation, args: any[]): any;

  // === PROXIES ===
  eIsProxy(): boolean;
}

// ============================================================
// EModelElement — base para elementos con anotaciones
// ============================================================

export interface EModelElement extends EObject {
   eAnnotations: EAnnotation[];
  getEAnnotation(source: string): EAnnotation | null;
}

// ============================================================
// ENamedElement — añade nombre
// ============================================================

export interface ENamedElement extends EModelElement {
  name: string;
}

// ============================================================
// EClassifier — clasificador abstracto
// ============================================================

export interface EClassifier extends ENamedElement {
  instanceClassName: string;
  readonly instanceClass: any; // DERIVED, transient
  defaultValue: string;
  instanceTypeName: string;

  // Container
  ePackage: EPackage;

  // Type parameters
   eTypeParameters: ETypeParameter[];

  // Methods
  isInstance(object: any): boolean;
  getClassifierID(): number;
}

// ============================================================
// EClass — la clase del modelo
// ============================================================

export interface EClass extends EClassifier {
  abstract: boolean;
  interface: boolean;

  // Super tipos
   eSuperTypes: EClass[];
   eGenericSuperTypes: EGenericType[];
   readonly eAllSuperTypes: EClass[];
   readonly eAllGenericSuperTypes: EGenericType[];

  // Features
   eStructuralFeatures: EStructuralFeature[];
   eOperations: EOperation[];

  // DERIVED — locales
   readonly eAttributes: EAttribute[];
   readonly eReferences: EReference[];

  // DERIVED — todos (locales + herencia)
   readonly eAllAttributes: EAttribute[];
   readonly eAllReferences: EReference[];
   readonly eAllStructuralFeatures: EStructuralFeature[];
   readonly eAllOperations: EOperation[];
   readonly eAllContainments: EReference[];

  // DERIVED — misc
  readonly eIDAttribute: EAttribute | null;

  // Type parameters
   eTypeParameters: ETypeParameter[];

  // Methods
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

// ============================================================
// ETypedElement — elemento con tipo y cardinalidad
// ============================================================

export interface ETypedElement extends ENamedElement {
  ordered: boolean;
  unique: boolean;
  lowerBound: number;
  upperBound: number; // -1 = muchos

  readonly many: boolean; // DERIVED: upperBound < 0 || upperBound > 1
  readonly required: boolean; // DERIVED: lowerBound > 0

  eType: EClassifier | null;
  eGenericType: EGenericType | null;
}

// ============================================================
// EStructuralFeature — atributo o referencia
// ============================================================

export interface EStructuralFeature extends ETypedElement {
  changeable: boolean;
  volatile: boolean;
  transient: boolean;
  defaultValueLiteral: string;
  unsettable: boolean;
  derived: boolean;

  readonly defaultValue: any; // DERIVED, volatile, transient
  readonly eContainingClass: EClass; // Container

  getFeatureID(): number;
  getContainerClass(): any;
}

// ============================================================
// EAttribute — atributo simple
// ============================================================

export interface EAttribute extends EStructuralFeature {
  iD: boolean;
  readonly eAttributeType: EDataType; // DERIVED
}

// ============================================================
// EReference — referencia entre clases
// ============================================================

export interface EReference extends EStructuralFeature {
  containment: boolean;
  readonly container: boolean; // DERIVED
  resolveProxies: boolean;
  eOpposite: EReference | null;
  readonly eReferenceType: EClass; // DERIVED
   eKeys: EAttribute[];
}

// ============================================================
// EDataType — tipo de dato primitivo
// ============================================================

export interface EDataType extends EClassifier {
  serializable: boolean;
}

// ============================================================
// EEnum — enumeración
// ============================================================

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

// ============================================================
// EOperation — operación/método
// ============================================================

export interface EOperation extends ETypedElement {
  readonly eContainingClass: EClass; // Container
   eParameters: EParameter[];
   readonly eExceptions: EClassifier[];
   eGenericExceptions: EGenericType[];
   eTypeParameters: ETypeParameter[];

  getOperationID(): number;
  isOverrideOf(someOperation: EOperation): boolean;
}

export interface EParameter extends ETypedElement {
  readonly eOperation: EOperation; // Container
}

// ============================================================
// EPackage — paquete contenedor de clasificadores
// ============================================================

export interface EPackage extends ENamedElement {
  nsURI: string;
  nsPrefix: string;
   eClassifiers: EClassifier[];
   eSubpackages: EPackage[];
  readonly eSuperPackage: EPackage | null;
  readonly eFactoryInstance: EFactory;

  getEClassifier(name: string): EClassifier | null;
}

// ============================================================
// EFactory — fábrica de objetos
// ============================================================

export interface EFactory extends EModelElement {
  readonly ePackage: EPackage;

  create(eClass: EClass): EObject;
  createFromString(eDataType: EDataType, literalValue: string): any;
  convertToString(eDataType: EDataType, instanceValue: any): string;
}

// ============================================================
// EAnnotation — metadatos extensibles
// ============================================================

export interface EAnnotation extends EModelElement {
  source: string;
  details: Record<string, string>;
   contents: EObject[];
   references: EObject[];
  readonly eModelElement: EModelElement | null; // Container, transient
}

// ============================================================
// EGenericType — tipos genéricos
// ============================================================

export interface EGenericType extends EObject {
  eUpperBound: EClassifier | null;
   eTypeArguments: EGenericType[];
  readonly eRawType: EClassifier | null; // DERIVED
  eLowerBound: EClassifier | null;
  eTypeParameter: ETypeParameter | null;
  eClassifier: EClassifier | null;
}

export interface ETypeParameter extends ENamedElement {
   eBounds: EGenericType[];
}

// ============================================================
// Sistema de Recursos
// ============================================================

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

// ============================================================
// EList — lista observable al estilo EMF
// ============================================================

export interface EList<T> extends Array<T> {
  // Lectura
  get(index: number): T;
  size(): number;
  isEmpty(): boolean;
  contains(e: T): boolean;
  containsAll(collection: T[]): boolean;
  indexOf(e: T): number;
  lastIndexOf(e: T): number;
  toArray(): T[];

  // Adición
  add(e: T): boolean;
  add(index: number, e: T): void;
  addAll(collection: T[]): boolean;
  addAll(index: number, collection: T[]): boolean;

  // Adición unique (sin duplicados)
  addUnique(e: T): void;
  addUnique(index: number, e: T): void;
  addAllUnique(collection: T[]): boolean;
  addAllUnique(index: number, collection: T[]): boolean;

  // Adición sin notificaciones
  basicAdd(e: T): void;

  // Mover
  move(newIndex: number, e: T): void;
  move(oldIndex: number, newIndex: number): T;

  // Eliminar
  remove(index: number): T;
  remove(e: T): boolean;
  removeAll(collection: T[]): boolean;
  retainAll(collection: T[]): boolean;
  clear(): void;

  // Set
  set(index: number, e: T): T;

  // Iteración
  [Symbol.iterator](): IterableIterator<T>;
}

// ============================================================
// EDataType — constantes para tipos primitivos
// ============================================================

export const EcoreDataTypes = {
  EString: 'EString',
  EBoolean: 'EBoolean',
  EInt: 'EInt',
  ELong: 'ELong',
  EFloat: 'EFloat',
  EDouble: 'EDouble',
  EByte: 'EByte',
  EByteArray: 'EByteArray',
  EChar: 'EChar',
  EShort: 'EShort',
  EBigDecimal: 'EBigDecimal',
  EBigInteger: 'EBigInteger',
  EDate: 'EDate',
  EObject: 'EObject',
  EJavaObject: 'EJavaObject',
  EJavaClass: 'EJavaClass',
} as const;

export type EcoreDataTypeName = typeof EcoreDataTypes[keyof typeof EcoreDataTypes];
