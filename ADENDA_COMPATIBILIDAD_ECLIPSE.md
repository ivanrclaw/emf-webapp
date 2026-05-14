# ADENDA CRÍTICA: Correcciones y Adiciones a la Guía Completa EMF Web

## ⚠️ Esta adenda corrige y completa la GUIA_COMPLETA_EMF_WEB.md con requisitos imprescindibles para la compatibilidad TOTAL con el metametamodelo Ecore de Eclipse y la exportación/importación con Eclipse EMF.

**Versión de referencia:** EMF **2.45.0** (febrero 2026, última versión estable).
**Estabilidad de la API:** El metametamodelo Ecore es extraordinariamente estable. Las interfaces fundamentales (EObject, EClass, EAttribute, EReference, EPackage) no han cambiado desde EMF 2.0. Entre 2.11 y 2.45 solo ha habido mejoras en code generation, Xcore, EMF Forms y rendimiento — el núcleo de Ecore sigue siendo idéntico.

---

## C1. EObject: La API Reflexiva Completa

En la guía original faltaban métodos CRUCIALES de EObject. La interfaz completa es:

```typescript
interface EObject extends Notifier {
  // === CLASIFICACIÓN ===
  eClass(): EClass;                             // La metaclase que define este objeto

  // === CONTENEDOR Y RECURSOS ===
  eContainer(): EObject | null;                 // Contenedor inmediato (quien me contiene)
  eContainingFeature(): EStructuralFeature | null;  // QUÉ feature del contenedor me contiene (puede ser FeatureMap.Entry)
  eContainmentFeature(): EReference | null;     // QUÉ EReference de containment me contiene (siempre EReference)
  eResource(): Resource | null;                 // Recurso al que pertenezco (yo o mi contenedor)

  // === CONTENIDO ===
  eContents(): EObject[];                       // Hijos directos (feature de containment)
  eAllContents(): IterableIterator<EObject>;    // Todos los descendientes (recursivo)
  eCrossReferences(): EObject[];                // Objetos referenciados NO por containment (excluye oppuestos)

  // === REFLEXIÓN (GET/SET/UNSET) ===
  eGet(feature: EStructuralFeature): any;
  eGet(feature: EStructuralFeature, resolve: boolean): any;  // resolve=true resuelve proxies
  eSet(feature: EStructuralFeature, value: any): void;
  eIsSet(feature: EStructuralFeature): boolean;
  eUnset(feature: EStructuralFeature): void;

  // === OPERACIONES ===
  eInvoke(operation: EOperation, args: any[]): any;  // Invocar operación

  // === PROXIES ===
  eIsProxy(): boolean;                          // true si es un proxy (objeto no cargado)
}

// === NOTIFIER — Sistema de Notificaciones (CRÍTICO) ===
interface Notifier {
  eAdapters(): Adapter[];                       // Lista de adapters registrados
  eDeliver(): boolean;                          // Si se están entregando notificaciones
  eSetDeliver(deliver: boolean): void;          // Activar/desactivar notificaciones
  eNotify(notification: Notification): void;    // Enviar notificación a todos los adapters
}

interface Adapter {
  getTarget(): EObject | null;
  setTarget(newTarget: EObject): void;
  notifyChanged(notification: Notification): void;  // ← Recibe notificaciones de cambios
  isAdapterForType(type: any): boolean;
}

interface Notification {
  getNotifier(): any;                          // Objeto que cambió
  getFeature(): EStructuralFeature | null;      // Feature que cambió
  getFeatureID(class: EClass): number;         // ID del feature
  getOldValue(): any;                          // Valor anterior
  getNewValue(): any;                          // Valor nuevo
  getEventType(): number;                      // ADD, REMOVE, SET, UNSET, ADD_MANY, REMOVE_MANY, MOVE
  getPosition(): number;                       // Posición (para listas)
  isTouch(): boolean;                          // Touch notification (mismo valor)
  merge(notification: Notification): boolean;  // Mergear con otra notificación
  getNewBooleanValue(): boolean;
  getNewIntegerValue(): number;
  getNewStringValue(): string;
  getOldBooleanValue(): boolean;
  getOldIntegerValue(): number;
  getOldStringValue(): string;
  eInterface(): any;
}

// === ADAPTER FACTORY (para el patrón Edit/Editor) ===
interface AdapterFactory {
  isFactoryForType(type: any): boolean;
  adapt(newTarget: any, type: any): Adapter;
  adapt(newTarget: any, type: any, adapter: Adapter): Adapter;
  createAdapter(target: any): Adapter | null;
}
```

### C1.1 eCrossReferences — La función olvidada

**`eCrossReferences()`** es fundamental. Devuelve TODOS los objetos referenciados por EReferences de tipo NO containment (y que no sean el opposite del containment). Se usa para:
- Determinar dependencias entre objetos
- Serialización correcta de referencias cruzadas
- Recorrido completo del grafo de objetos

**Diferencia crítica:**
- `eContents()` → solo containment (árbol de composición)
- `eCrossReferences()` → solo referencias NO containment (grafos entre árboles)

---

## C2. EStructuralFeature: Propiedades y Métodos Completos

La interfaz completa que faltaba en la guía:

```typescript
interface EStructuralFeature extends ETypedElement {
  // === ATRIBUTOS ===
  changeable: boolean;             // default: true
  volatile: boolean;               // default: false
  transient: boolean;              // default: false (no se serializa)
  defaultValueLiteral: string;     // Valor por defecto en string
  unsettable: boolean;             // default: false (si tiene estado "no seteado")
  derived: boolean;                // default: false (se calcula de otros features)

  // === PROPIEDADES DERIVADAS ===
  readonly defaultValue: any;      // DERIVED, volatile, transient — evaluado desde literal
  readonly eContainingClass: EClass;  // Container (bidirectional, opposite de eStructuralFeatures)

  // === MÉTODOS ===
  getFeatureID(): number;          // ID relativo a la clase contenedora
  getContainerClass(): any;        // La clase Java de la clase contenedora

  // === SUBSISTEMA DE SETTINGS ===
  // EStructuralFeature.Setting — representa el valor actual de un feature en un objeto
}

// EStructuralFeature.Setting
interface EStructuralFeatureSetting {
  getObject(): EObject;
  getStructuralFeature(): EStructuralFeature;
  get(): any;
  set(value: any): void;
  unset(): void;
  isSet(): boolean;
}
```

---

## C3. EOperation: Métodos Completos

```typescript
interface EOperation extends ETypedElement {
  // === REFERENCIAS ===
  readonly eContainingClass: EClass;      // Container (bidirectional, opposite de eOperations)
  eParameters: EParameter[];              // Parámetros (containment, bidirectional)
  readonly eExceptions: EClassifier[];    // DERIVED desde eGenericExceptions (erasure)
  eGenericExceptions: EGenericType[];     // Excepciones genéricas (containment)
  eTypeParameters: ETypeParameter[];      // Parámetros de tipo del método (genéricos Java)

  // === MÉTODOS ===
  getOperationID(): number;                // ID relativo a la clase contenedora
  isOverrideOf(someOperation: EOperation): boolean;  // Si esta operación hace override de otra
}
```

---

## C4. EClass: Propiedades Derivadas que Faltaban

```typescript
interface EClass extends EClassifier {
  // === YA DOCUMENTADO ===
  abstract: boolean;
  interface: boolean;
  eSuperTypes: EClass[];
  eStructuralFeatures: EStructuralFeature[];
  eOperations: EOperation[];

  // === ADICIONALES que FALTABAN ===
  eGenericSuperTypes: EGenericType[];         // Super tipos genéricos (con type params)
  eAllGenericSuperTypes: EGenericType[];      // DERIVED — todos los super tipos genéricos
  eTypeParameters: ETypeParameter[];          // Parámetros de tipo (genéricos)

  // === DERIVADOS que FALTABAN ===
  readonly eAllAttributes: EAttribute[];           // DERIVED — atributos locales + herencia
  readonly eAllReferences: EReference[];            // DERIVED — referencias locales + herencia
  readonly eAllStructuralFeatures: EStructuralFeature[];  // DERIVED — todos los features
  readonly eAllOperations: EOperation[];            // DERIVED — operaciones locales + herencia
  readonly eAllContainments: EReference[];          // DERIVED — todas las referencias de containment (¡determina eContents()!)
  readonly eAllSuperTypes: EClass[];                // DERIVED — todas las superclases transitivas
  readonly eIDAttribute: EAttribute | null;         // DERIVED — feature con iD=true
  readonly eReferences: EReference[];               // DERIVED — referencias locales
  readonly eAttributes: EAttribute[];               // DERIVED — atributos locales

  // === MÉTODOS ADICIONALES ===
  getFeatureCount(): number;                                     // Nº total de features
  getFeatureID(feature: EStructuralFeature): number;              // ID de un feature
  getFeatureType(feature: EStructuralFeature): EGenericType;     // Tipo reificado del feature
  getEStructuralFeature(featureID: number): EStructuralFeature;  // Lookup por ID
  getEStructuralFeature(featureName: string): EStructuralFeature | null;  // Lookup por nombre
  getOperationCount(): number;                                    // Nº total de operaciones
  getOperationID(operation: EOperation): number;                  // ID de una operación
  getEOperation(operationID: number): EOperation;                 // Lookup por ID
  getOverride(operation: EOperation): EOperation;                // Operación que hace override
  isSuperTypeOf(someClass: EClass): boolean;                     // Like Class.isAssignableFrom()
}
```

### C4.1 Comportamiento Detallado de las Propiedades Derivadas

| Propiedad | Origen | Cómo se calcula |
|-----------|--------|-----------------|
| `eAllAttributes` | EClass | Atributos de `this` + atributos de cada `eSuperTypes` (DFS, sin duplicados) |
| `eAllReferences` | EClass | Referencias de `this` + referencias de cada `eSuperTypes` |
| `eAllStructuralFeatures` | EClass | eAllAttributes + eAllReferences (mezclados en orden de definición) |
| `eAllContainments` | EClass | `eAllReferences` filtrado por `containment===true` |
| `eAllOperations` | EClass | Operaciones de `this` + operaciones de cada `eSuperTypes` |
| `eAllSuperTypes` | EClass | Recorrido DFS de `eSuperTypes` (no incluye `this`) |
| `eAllGenericSuperTypes` | EClass | Recorrido DFS de `eGenericSuperTypes` |
| `eIDAttribute` | EClass | Primer `EAttribute` con `iD===true` en `eAllAttributes` |
| `eReferences` (local) | EClass | `eStructuralFeatures` filtrado por `type === EReference` |
| `eAttributes` (local) | EClass | `eStructuralFeatures` filtrado por `type === EAttribute` |
| `eSuperTypes` | EClass | DERIVED desde `eGenericSuperTypes` (erasure de cada generic type) |
| `defaultValue` | EStructuralFeature | DERIVED: si no hay literal → default de `eType`; si hay literal → `EFactory.createFromString()` |
| `many` | ETypedElement | DERIVED: `upperBound < 0 \|\| upperBound > 1` |
| `required` | ETypedElement | DERIVED: `lowerBound > 0` |
| `container` | EReference | DERIVED: `eOpposite !== null && eOpposite.containment === true` |

---

## C5. EPackage: Métodos de Búsqueda

```typescript
interface EPackage extends ENamedElement {
  nsURI: string;
  nsPrefix: string;
  eClassifiers: EClassifier[];                 // Todos los clasificadores (EClasses, EDataTypes, EEnums)
  eSubpackages: EPackage[];                     // Subpaquetes
  eSuperPackage: EPackage | null;               // Paquete padre
  readonly eFactoryInstance: EFactory;           // Factory para crear instancias

  // === MÉTODOS DE BÚSQUEDA ===
  getEClassifier(name: string): EClassifier | null;  // Buscar clasificador por nombre
}
```

---

## C6. EEnum y EEnumLiteral: Operaciones de Búsqueda

```typescript
interface EEnum extends EDataType {
  eLiterals: EEnumLiteral[];

  // === MÉTODOS DE BÚSQUEDA ===
  getEEnumLiteral(name: string): EEnumLiteral | null;          // Por nombre
  getEEnumLiteral(value: number): EEnumLiteral | null;         // Por valor entero
  getEEnumLiteral(literal: string): EEnumLiteral | null;       // Por string literal
}

interface EEnumLiteral extends ENamedElement {
  value: number;
  literal: string;
  readonly instance: any;              // DERIVED — instancia del enumerado
  readonly eEnum: EEnum;               // Container, opposite
}
```

---

## C7. EFactory: Fábrica de Objetos

```typescript
interface EFactory extends EModelElement {
  readonly ePackage: EPackage;          // Container, opposite

  // === MÉTODOS CRÍTICOS ===
  create(eClass: EClass): EObject;                          // Crear nueva instancia de EClass
  createFromString(eDataType: EDataType, literalValue: string): any;  // Parsear string → valor tipado
  convertToString(eDataType: EDataType, instanceValue: any): string;  // Valor tipado → string
}
```

---

## C8. Sistema de Recursos (Resources) — La Base de la Serialización

**No documentado adecuadamente en la guía original.** El sistema de Resources es la base de la persistencia en EMF.

```typescript
// === RESOURCE — Cada modelo se almacena en un Resource ===
interface Resource {
  readonly resourceSet: ResourceSet | null;      // ResourceSet al que pertenece
  readonly uri: URI;                              // URI que identifica este recurso
  contents: EObject[];                            // Objetos raíz del recurso (EObjects contenidos)
  errors: ResourceDiagnostic[];                   // Errores de carga
  warnings: ResourceDiagnostic[];                 // Advertencias de carga
  
  modified: boolean;                              // Si ha sido modificado desde último save
  trackingModification: boolean;                  // Si se trackea el modificado
  loaded: boolean;                                // Si el recurso está cargado (puede ser proxy)

  save(options?: ResourceSaveOptions): void;      // Guardar recurso a su URI
  load(options?: ResourceLoadOptions): void;      // Cargar recurso desde su URI
  unload(): void;                                  // Descargar (libera memoria)

  getAllContents(): IterableIterator<EObject>;    // Todos los objetos del recurso
  getEObject(uriFragment: string): EObject | null; // Obtener objeto por fragment path
  getURIFragment(eObject: EObject): string;        // Obtener fragment path (ej: "//@agents.0/@tasks.1")

  delete(options?: ResourceDeleteOptions): void;   // Eliminar recurso
}

// === URI — Localizador de recursos ===
interface URI {
  scheme: string;                          // ej: "http", "file", "platform"
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
  fragment: string;                        // Fragment path (ej: "//@agents.0/@tasks.1")

  // Métodos de manipulación
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

// === RESOURCE SET — Gestor de recursos ===
interface ResourceSet {
  resources: Resource[];                     // Recursos gestionados
  readonly packageRegistry: PackageRegistry;  // Registro de EPackages conocidos

  getResource(uri: URI, loadOnDemand: boolean): Resource;  // Obtener recurso (carga si es necesario)
  createResource(uri: URI): Resource;         // Crear nuevo recurso vacío
  getEObject(uri: URI, resolve: boolean): EObject | null;  // Obtener EObject por URI completo
  getResources(): Resource[];                 // Todos los recursos

  // Opciones por defecto para load/save
  getLoadOptions(): Map<string, any>;
  getSaveOptions(): Map<string, any>;
}

// === REGISTRO DE PAQUETES ===
interface PackageRegistry {
  getEPackage(nsURI: string): EPackage | null;       // Buscar EPackage por nsURI
  putEPackage(nsURI: string, ePackage: EPackage): void;  // Registrar EPackage
  removeEPackage(ePackage: EPackage): void;           // Eliminar EPackage
  values(): EPackage[];                               // Todos los EPackages registrados
}
```

### C8.1 Fragment Paths — El Formato EXACTO de Eclipse

Los fragment paths son cómo EMF identifica objetos dentro de un recurso. El formato es:

```
//@<featureName>.<index>/@<featureName>.<index>/...
```

**Reglas exactas:**
- El path SIEMPRE empieza con `//`
- Cada segmento es `@<nombreFeature>.<índice>` (índice 0-based)
- Si el feature tiene upperBound=1 (single), se omite el `.0`

**Ejemplos:**
```
//@agents.0                           → Primer EClass en eClassifiers
//@agents.0/@tasks.1                  → Segunda tarea del primer agente
//@links.5                            → Sexto enlace
//@contexts.0/@properties.2/@name     → Atributo 'name' de la tercera propiedad del primer contexto
```

**Cross-resource references** (HREF):
```
model.ecore#//@EClassName
other.ecore#//@agents.0/@tasks.1
platform:/resource/MyProject/model/Other.ecore#//@Foo
```

---

## C9. Formato EXACTO de XMI para Compatibilidad con Eclipse

### C9.1 Cabecera del archivo .ecore

```xml
<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmi:version="2.0"
    xmlns:xmi="http://www.omg.org/XMI"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore"
    name="modelName"
    nsURI="http://example.com/model/1.0"
    nsPrefix="model">
```

**REGLAS ESTRICTAS:**
1. `xmi:version` debe ser `"2.0"` (NO "2.1")
2. Los namespaces deben estar en el orden: xmi → xsi → ecore
3. `nsURI` debe ser única y en formato URI
4. `nsPrefix` debe ser un identificador corto (sin espacios)

### C9.2 EClass con ESuperTypes — FORMATO INLINE (CRÍTICO)

```xml
<!-- ✅ CORRECTO — inline attribute -->
<eClassifiers xsi:type="ecore:EClass" name="StartTask" eSuperTypes="#//Task">
```

```xml
<!-- ❌ INCORRECTO — child element (FeatureNotFoundException) -->
<eClassifiers xsi:type="ecore:EClass" name="StartTask">
  <eSuperTypes>#//Task</eSuperTypes>
</eClassifiers>
```

**Formato de eSuperTypes:**
- `"#//Task"` → dentro del mismo recurso, apunta a un EClass llamado "Task"
- `"model.ecore#//Task"` → cruzando recursos, archivo "model.ecore", EClass "Task"
- `"platform:/resource/Proj/model/Other.ecore#//Foo"` → recurso completo

### C9.3 EAttribute — Formato Completo

```xml
<eStructuralFeatures xsi:type="ecore:EAttribute"
    name="name"
    ordered="true"
    unique="true"
    lowerBound="0"
    upperBound="1"
    eType="ecore:EDataType http://www.eclipse.org/emf/2002/Ecore#//EString"
    changeable="true"
    volatile="false"
    transient="false"
    defaultValueLiteral=""
    unsettable="false"
    derived="false"
    iD="false"/>
```

**Detalles importantes:**
- `ordered`, `unique` por defecto son `true` (se pueden omitir en el XML si son true)
- `lowerBound="0" upperBound="1"` es un feature single-valued
- `lowerBound="0" upperBound="-1"` es un feature many-valued (lista)
- `eType` puede ser:
  - `ecore:EDataType http://...Ecore#//EString` → tipo primitivo
  - `#//SomeClass` → tipo EClass (para EReference)
- `iD="true"` marca atributo identificador (solo uno por jerarquía de clases)

### C9.4 EReference — Formato Completo

```xml
<eStructuralFeatures xsi:type="ecore:EReference"
    name="agents"
    ordered="true"
    unique="true"
    lowerBound="0"
    upperBound="-1"
    eType="#//Agent"
    containment="true"
    resolveProxies="true"
    changeable="true"
    volatile="false"
    transient="false"
    unsettable="false"
    derived="false"
    eOpposite="#//Agent/system"/>
```

**REGLAS CRÍTICAS:**
- `containment="false"` → referencia NO containment (cruzada)
- `containment="true"` → composición (el objeto es hijo)
- `eOpposite` se usa para bidireccionalidad: `"#//Agent/system"` significa "el EReference llamado 'system' en el EClass 'Agent'"
- `resolveProxies` por defecto es `true`
- Si `containment="true"`, normalmente `resolveProxies="false"` (los hijos no pueden ser proxies)

### C9.5 EAnnotation — Formato para OCL

```xml
<!-- En el EPackage raíz: delegación OCL -->
<eAnnotations source="http://www.eclipse.org/emf/2002/Ecore">
    <details key="invocationDelegates" value="http://www.eclipse.org/emf/2002/Ecore/OCL/Pivot"/>
    <details key="settingDelegates" value="http://www.eclipse.org/emf/2002/Ecore/OCL/Pivot"/>
    <details key="validationDelegates" value="http://www.eclipse.org/emf/2002/Ecore/OCL/Pivot"/>
</eAnnotations>

<!-- En un EClass: constraint OCL -->
<eAnnotations source="http://www.eclipse.org/emf/2002/Ecore/OCL/Pivot">
    <details key="R01_OneStart"
        value="self.agents.tasks->select(t | t.oclIsTypeOf(StartTask))->size() = 1"/>
</eAnnotations>

<!-- En un EAttribute derivado: expresión de derivación -->
<eStructuralFeatures xsi:type="ecore:EAttribute"
    name="numTareas"
    eType="ecore:EDataType http://www.eclipse.org/emf/2002/Ecore#//EInt"
    changeable="false" volatile="true" transient="true" derived="true">
    <eAnnotations source="http://www.eclipse.org/emf/2002/Ecore/OCL/Pivot">
        <details key="derivation"
            value="self.tasks->select(t | not t.oclIsTypeOf(StartTask) and not t.oclIsTypeOf(EndTask))->size()"/>
    </eAnnotations>
</eStructuralFeatures>
```

### C9.6 EEnum — Formato

```xml
<eClassifiers xsi:type="ecore:EEnum" name="PropertyType">
    <eLiterals name="INTEGER" value="0" literal="INTEGER"/>
    <eLiterals name="STRING" value="1" literal="STRING"/>
    <eLiterals name="REAL" value="2" literal="REAL"/>
</eClassifiers>
```

### C9.7 EDataType — Formato

```xml
<!-- Tipo primitivo simple -->
<eClassifiers xsi:type="ecore:EDataType" name="MyCustomType"
    instanceClassName="java.util.Date"
    serializable="true"/>
```

### C9.8 EGenericType — Formato

```xml
<eClassifiers xsi:type="ecore:EClass" name="Container">
    <eTypeParameters name="T"/>
    <eStructuralFeatures xsi:type="ecore:EReference" name="items"
        upperBound="-1" eType="#//Item">
        <eGenericType eClassifier="#//Container">
            <eTypeArguments eClassifier="#//Item"/>
        </eGenericType>
    </eStructuralFeatures>
</eClassifiers>
```

---

## C10. Modelo XMI de Instancias (Formato EXACTO para Importar en Eclipse)

Cuando se genera un modelo de instancia (M1), el formato XMI debe ser:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<model:AgentSystem xmi:version="2.0"
    xmlns:xmi="http://www.omg.org/XMI"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:model="http://example.com/model/1.0"
    name="MySystem">

    <!-- Contenedores raíz (containment) -->
    <agents name="Agent1">
        <!-- Hijos con xsi:type para subtipos -->
        <tasks xsi:type="model:StartTask" name="Inicio"/>
        <tasks xsi:type="model:UserTask" name="Datos">
            <properties name="campo1"/>
        </tasks>
    </agents>

    <!-- Referencias cruzadas con fragment paths -->
    <links name="l1"
        source="//@agents.0/@tasks.0"
        target="//@agents.0/@tasks.1"/>
</model:AgentSystem>
```

**REGLAS CRÍTICAS para instancias:**
1. El elemento raíz usa el nsPrefix: `<model:AgentSystem>` (no `<ecore:EPackage>`)
2. `xmlns:model="http://example.com/model/1.0"` → debe coincidir con el nsURI del metamodelo
3. `xsi:type="model:TaskType"` → para elementos polimórficos (subtipos de EClasses)
4. Fragment paths: `//@agents.0` → primer elemento del feature "agents"
5. Para referencias multi-valor: `source="//@agents.0/@tasks.0 //@agents.0/@tasks.1"` (separadas por espacios)
6. Si el modelo instancia features del metamodelo pero no tiene el .ecore cargado, Eclipse no podrá validarlo

---

## C11. Funcionalidades COMPLETAS del Ecore Diagram Editor (EcoreTools)

La webapp debe emular **TODAS** estas funcionalidades para ser un reemplazo completo:

### C11.1 Viewpoints (Puntos de Vista)
EcoreTools organiza las funcionalidades en **viewpoints** que se activan/desactivan:

| Viewpoint | Propósito | Capas |
|-----------|-----------|-------|
| **Design** | Edición principal del metamodelo | Entity Diagram (diagrama de clases), Documentation Table (tabla de documentación) |
| **Review** | Revisión y análisis | Dependencies Diagram (dependencias entre paquetes) |

### C11.2 Capas (Layers) del Entity Diagram

| Capa | Función | Herramientas que añade |
|------|---------|----------------------|
| **Design** (siempre activa) | Edición base | EClass, Abstract Class, Interface, EDataType, EAttribute, EReference, etc. |
| **Validation** | Validación | Bordes rojos en elementos con errores |
| **Documentation** | Documentación | Resalta elementos sin documentar (borde rojo), herramientas de anotación |
| **Constraints** | Restricciones | Herramientas para añadir constraints, visualizar existentes |

### C11.3 Herramientas de la Paleta

| Herramienta | Acción |
|-------------|--------|
| **EClass** | Crear nueva EClass concreta en el diagrama |
| **Abstract Class** | Crear EClass abstracta (o convertir existente a abstracta) |
| **Interface** | Crear EClass de tipo interfaz |
| **EDatatype** | Crear nuevo EDataType (custom type) |
| **EAttribute** | Crear atributo en la EClass seleccionada |
| **EReference (containment)** | Crear referencia de composición entre EClasses |
| **EReference (non-containment)** | Crear referencia simple (no composición) |
| **EReference (0..*)** | Crear referencia many-valued |
| **EReference (eOpposite)** | Crear referencia bidireccional (crea ambas direcciones) |
| **EOperation** | Crear operación/método |
| **EEnum** | Crear nueva enumeración |
| **ETypeParameter** | Añadir parámetro de tipo genérico |
| **Delete from Diagram** | Eliminar del diagrama (no del modelo) |
| **Remove Model Element** | Eliminar del modelo (y del diagrama) |

### C11.4 Atajos de Teclado y Edición Rápida

| Acción | Efecto |
|--------|--------|
| Doble click en label | Editar inline |
| `*` tecleado en label | Establecer multiplicidad `0..*` |
| `1` | Establecer multiplicidad `1` |
| `0..1` | Establecer multiplicidad `0..1` |
| `:SomeType` | Establecer tipo del atributo/referencia sin cambiar nombre |
| `newName:Type` | Cambiar nombre y tipo simultáneamente |
| `CTRL+O` | Quick outline: buscar elemento por nombre |
| `DEL` | Eliminar elemento del modelo (y del diagrama) |
| Drag from palette | Crear nuevo elemento arrastrando |
| Hover + tooltip | Ver información del elemento |

### C11.5 Propiedades Editables por Elemento

**EClass:**
- `name`, `abstract` (toggle), `interface` (toggle)
- `eSuperTypes` (selector de EClasses existentes)
- Instance Class Name (solo para EClassifier)

**EAttribute:**
- `name`, `eType` (selector de EDataType)
- `lowerBound`, `upperBound` (cardinalidad)
- `ordered`, `unique`, `changeable`, `volatile`, `transient`
- `defaultValueLiteral`, `unsettable`, `derived`, `iD`

**EReference:**
- `name`, `eType` (selector de EClass)
- `lowerBound`, `upperBound`
- `containment`, `resolveProxies`
- `eOpposite` (selector de EReference del tipo destino)
- `ordered`, `unique`, `changeable`, `volatile`, `transient`, `derived`
- `eKeys` (selector de EAttributes para referencias por clave)

**EOperation:**
- `name`, `eType` (tipo de retorno)
- `eParameters` (tabla de parámetros: nombre, tipo, multiplicidad)
- `eExceptions` (selector de EClassifiers)

### C11.6 Add Related Elements

Una funcionalidad MUY importante de EcoreTools: al hacer clic en "Add Related Elements", se añaden al diagrama todas las EClasses relacionadas (referencias, supertipos) de las EClasses actualmente visibles. Esto evita tener que arrastrar manualmente cada clase.

### C11.7 Package Dependencies Diagram

Diagrama que muestra las dependencias entre EPackages: qué paquetes referencian a qué otros paquetes (útil para análisis de acoplamiento).

---

## C12. Compatibilidad Garantizada con Eclipse — Checklist

Para que un archivo .ecore generado por nuestra webapp sea **100% importable y usable en Eclipse EMF**, debe cumplir:

- [x] `xmi:version="2.0"` en el elemento raíz
- [x] Declaración de namespaces XMI, XSI, ECORE
- [x] `eSuperTypes` como inline attribute (NUNCA como child element)
- [x] `nsURI` y `nsPrefix` en EPackage
- [x] La URI debe coincidir cuando se referencia externamente
- [x] `eOpposite` usa fragment path exacto: `"#//<TargetClass>/<FeatureName>"`
- [x] `eType` para primitivas: `"ecore:EDataType http://...Ecore#//EString"`
- [x] `eType` para EClasses: `"#//<ClassName>"`
- [x] Referencias fraccionadas en instancias: `//@agents.0/@tasks.1`
- [x] `xsi:type` correcto en elementos: `xsi:type="ecore:EClass"`, `xsi:type="ecore:EAttribute"`, etc.
- [x] Sin child elements para propiedades que deben ser atributos inline
- [x] Para `EDataType` href: `href="http://www.eclipse.org/emf/2002/Ecore#//EString"` formato URI absoluto

### C12.1 Errores Comunes que Rompen la Compatibilidad

| Error | Síntoma en Eclipse | Causa |
|-------|-------------------|-------|
| `eSuperTypes` como child | `FeatureNotFoundException: Feature 'eType' not found` | XML malformado |
| `DanglingHREFException` | Referencia rota | `eType` apunta a algo que no existe |
| `Content not allowed in prolog` | No se abre el .ecore | Caracteres basura antes de `<?xml` |
| `org.eclipse.emf.ecore.EcoreNature` missing | No se abre el editor Ecore | Falta `.project` con EcoreNature |
| `featurenotfound` en atributos | Error al hacer scroll en editor | Atributo XML desconocido |
| Modelo no se abre en Sample Ecore Editor | Error de resource | Objeto raíz no es EObject o no tiene eResource() |

---

## C13. EList — La Colección Especial de EMF

Todas las listas en EMF (eStructuralFeatures, eSuperTypes, eContents, etc.) usan EList, que tiene comportamiento específico:

```typescript
interface EList<T> extends Array<T> {
  // === ADICIÓN CON DUPLICADOS ===
  add(e: T): boolean;
  add(index: number, e: T): void;
  addAll(collection: Collection<T>): boolean;
  addAll(index: number, collection: Collection<T>): boolean;

  // === ADICIÓN SIN DUPLICADOS (unique lists) ===
  addUnique(e: T): void;
  addUnique(index: number, e: T): void;
  addAllUnique(collection: Collection<T>): boolean;
  addAllUnique(index: number, collection: Collection<T>): boolean;
  basicAdd(e: T): void;              // Sin notificaciones

  // === MOVER ===
  move(newIndex: number, e: T): void;
  move(oldIndex: number, newIndex: number): T;

  // === ELIMINAR ===
  remove(index: number): T;
  remove(e: T): boolean;
  removeAll(collection: Collection<T>): boolean;
  retainAll(collection: Collection<T>): boolean;
  clear(): void;

  // === BÚSQUEDA ===
  get(index: number): T;
  set(index: number, e: T): T;
  indexOf(e: T): number;
  lastIndexOf(e: T): number;
  contains(e: T): boolean;
  containsAll(collection: Collection<T>): boolean;
  isEmpty(): boolean;
  size(): number;
  toArray(): T[];

  // === ITERACIÓN ===
  iterator(): Iterator<T>;
  listIterator(): ListIterator<T>;
  listIterator(index: number): ListIterator<T>;
  subList(from: number, to: number): EList<T>;
}
```

**Comportamiento especial:**
- `addUnique()` -> lanza excepción si ya existe (para listas unique=true)
- `basicAdd()` -> añade SIN disparar notificaciones (para uso interno durante la inicialización)
- `move()` -> mover elemento en la lista (cambia el orden, que es el feature ID)
- Las listas de `eStructuralFeatures` SON ordenadas: el orden determina el featureID

---

## C14. Operaciones de Búsqueda en EClassifier

```typescript
interface EClassifier extends ENamedElement {
  instanceClassName: string;         // "java.lang.String", "int", "com.example.MyClass"
  instanceClass: any;                 // DERIVED, transient — clase Java desde instanceClassName
  defaultValue: string;               // Valor por defecto
  instanceTypeName: string;           // Nombre del tipo (para XML Schema)
  
  ePackage: EPackage;                 // Container, opposite
  eTypeParameters: ETypeParameter[];  // Parámetros de tipo genérico

  // === MÉTODOS ===
  isInstance(object: any): boolean;   // Comprueba si el objeto es instancia de este clasificador
  getClassifierID(): number;          // ID único dentro del EPackage
}
```

---

## C15. Resumen del Sistema de Adapters (Patrón Observer de EMF)

El sistema de notificaciones de EMF es fundamental para el patrón Edit/Editor y para la reactividad en la webapp:

```
┌───────────────────────────────────────────────────────────────────────┐
│                        NOTIFICATION FLOW                             │
│                                                                       │
│  EObject cambia (eSet, eUnset, lista.add, etc.)                      │
│       │                                                               │
│       ▼                                                               │
│  Notification object creado                                           │
│       │                                                               │
│       ▼                                                               │
│  eDeliver() ? ────NO──→ FIN                                           │
│       │ SÍ                                                             │
│       ▼                                                               │
│  Para cada Adapter en eAdapters():                                    │
│       │                                                               │
│       ▼                                                               │
│  adapter.notifyChanged(notification)                                  │
│       │                                                               │
│       ▼                                                               │
│  Los adapters reaccionan:                                             │
│    - ItemProvider: actualiza vista                                    │
│    - Command: registra undo/redo                                      │
│    - Editor: refresca UI                                              │
│    - Listener personalizado: reacción custom                          │
└───────────────────────────────────────────────────────────────────────┘
```

En la webapp React, este sistema se puede mapear a:
- `eAdapters()` → React callbacks/efectos
- `eNotify()` → dispatches a Zustand store
- `Adapter.notifyChanged()` → React.useEffect triggers
- `Command` pattern → History de undo/redo con Zustand

---

## C16. Comprobación Final: ¿Qué NO estaba en la guía original?

| Concepto | Estaba en original | Ahora corregido |
|----------|-------------------|-----------------|
| `eContainingFeature()` | ❌ | ✅ C1 |
| `eContainmentFeature()` | ❌ | ✅ C1 |
| `eCrossReferences()` | ❌ | ✅ C1 |
| `eIsProxy()` | ❌ | ✅ C1 |
| `eInvoke()` | ❌ | ✅ C1 |
| Notifier (eAdapters, eDeliver, eNotify) | ❌ | ✅ C1 |
| Adapter y Notification interfaces | ❌ | ✅ C1 |
| `getFeatureID()`, `getContainerClass()` | ❌ | ✅ C2 |
| EStructuralFeature.Setting | ❌ | ✅ C2 |
| `EOperation.getEExceptions()` | ❌ | ✅ C3 |
| `EOperation.getEGenericExceptions()` | ❌ | ✅ C3 |
| `EOperation.getOperationID()` | ❌ | ✅ C3 |
| `EOperation.isOverrideOf()` | ❌ | ✅ C3 |
| `EClass.eAllContainments()` | ❌ | ✅ C4 |
| `EClass.eAllOperations()` | ❌ | ✅ C4 |
| `EClass.getFeatureCount()`, `getFeatureID()` | ❌ | ✅ C4 |
| `EClass.isSuperTypeOf()` | ❌ | ✅ C4 |
| `EClass.getEStructuralFeature(name)` | ❌ | ✅ C4 |
| `EClass.eGenericSuperTypes` / `eAllGenericSuperTypes` | ❌ | ✅ C4 |
| `EPackage.getEClassifier(name)` | ❌ | ✅ C5 |
| `EEnum.getEEnumLiteral(name/value/literal)` | ❌ | ✅ C6 |
| `EFactory.create()`, `createFromString()`, `convertToString()` | ❌ | ✅ C7 |
| Resource, ResourceSet, URI sistema completo | ✅ (mínimo) | ✅ C8 exhaustivo |
| Fragment paths (//@feature.index) | ✅ | ✅ C8.1 detallado |
| Formato XMI exacto con todos los casos | ✅ (parcial) | ✅ C9 completo |
| Formato de instancias XMI | ✅ | ✅ C10 detallado |
| EcoreTools layer system + palettes | ❌ | ✅ C11 |
| Atajos de teclado de EcoreTools | ❌ | ✅ C11.4 |
| Add Related Elements | ❌ | ✅ C11.6 |
| Package Dependencies Diagram | ❌ | ✅ C11.7 |
| EList completo | ❌ | ✅ C13 |
| `EClassifier.isInstance()` | ❌ | ✅ C14 |
| Tabla de errores comunes de compatibilidad | ❌ | ✅ C12.1 |
