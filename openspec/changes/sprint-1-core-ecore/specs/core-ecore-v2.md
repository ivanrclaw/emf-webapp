# Spec: Core Ecore — Actualización v2 para compatibilidad total con Eclipse

## MODIFIED: Interfaces Completas

Se actualizan todas las interfaces del core Ecore para incluir los métodos que faltaban en la v1.

### Cambios en EObject
- AÑADIDO: `eContainingFeature()` — EStructuralFeature del contenedor que me contiene
- AÑADIDO: `eContainmentFeature()` — EReference de containment que me contiene
- AÑADIDO: `eCrossReferences()` — objetos referenciados NO containment (excluye opposites)
- AÑADIDO: `eIsProxy()` — detección de proxies
- AÑADIDO: `eInvoke(EOperation, args)` — invocación de operaciones
- AÑADIDO: Sistema Notifier completo — `eAdapters()`, `eDeliver()`, `eSetDeliver()`, `eNotify()`
- AÑADIDO: Interfaz `Adapter` y `Notification`

### Cambios en EStructuralFeature
- AÑADIDO: `getFeatureID()` — ID relativo a la clase contenedora
- AÑADIDO: `getContainerClass()` — clase Java del contenedor
- AÑADIDO: `defaultValue` (derived, volatile, transient)
- AÑADIDO: `EStructuralFeature.Setting` — representación del valor actual

### Cambios en EOperation
- AÑADIDO: `eExceptions` (derived desde eGenericExceptions)
- AÑADIDO: `eGenericExceptions` (containment)
- AÑADIDO: `eTypeParameters` (parámetros de tipo genérico en métodos)
- AÑADIDO: `getOperationID()`, `isOverrideOf()`

### Cambios en EClass
- AÑADIDO: `eGenericSuperTypes`, `eAllGenericSuperTypes`
- AÑADIDO: `eTypeParameters`
- AÑADIDO: `eAllContainments` (CRÍTICO: determina eContents())
- AÑADIDO: `eAllOperations`
- AÑADIDO: `getFeatureCount()`, `getFeatureID()`, `getFeatureType()`
- AÑADIDO: `getEStructuralFeature(int)`, `getEStructuralFeature(String)`
- AÑADIDO: `getOperationCount()`, `getOperationID()`, `getEOperation(int)`
- AÑADIDO: `getOverride()`, `isSuperTypeOf()`

### Cambios en EPackage
- AÑADIDO: `getEClassifier(name)` — búsqueda por nombre

### Cambios en EEnum
- AÑADIDO: `getEEnumLiteral(name)`, `getEEnumLiteral(value)`, `getEEnumLiteral(literal)`

### Cambios en EFactory
- AÑADIDO: `create(EClass)`, `createFromString(EDataType, String)`, `convertToString(EDataType, Object)`

### Cambios en EClassifier
- AÑADIDO: `isInstance(object)`, `getClassifierID()`

## ADDED: Resource System Completo

### Resource
- `contents` — objetos raíz del recurso
- `uri` — URI que identifica el recurso
- `save()`, `load()`, `unload()`, `delete()`
- `getAllContents()` — todos los objetos
- `getEObject(fragment)` — lookup por fragment path
- `getURIFragment(eObject)` — obtener fragment path (formato: //@feature.index)

### ResourceSet
- `resources` — lista de recursos gestionados
- `packageRegistry` — registro de EPackages
- `getResource(URI, loadOnDemand)`, `createResource(URI)`
- `getEObject(URI, resolve)` — resolver cualquier URI a EObject

### URI
- `scheme`, `host`, `path`, `fragment`, `segments`, etc.
- `resolve()`, `deresolve()`, `appendSegment()`, `trimSegments()`

## ADDED: EList Completa

Implementación completa incluyendo:
- `addUnique()`, `addAllUnique()`, `basicAdd()` — adiciones con/sin duplicados y sin notificaciones
- `move()` — reordenación de elementos
- `get()`, `set()`, `remove()` — acceso indexado
- Soporte para iteración con `FeatureIterator` (para saber qué feature contiene cada elemento)

## MODIFIED: Serialización XMI — Formato Exacto

### Cabecera OBLIGATORIA
```xml
<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmi:version="2.0"
    xmlns:xmi="http://www.omg.org/XMI"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore"
    name="..."
    nsURI="..."
    nsPrefix="...">
```

### Fragment paths
```typescript
// Formato: //@featureName.index
// Single-valued: //@featureName (sin .0)
// Multi-valued:  //@agents.0/@tasks.1
// Cross-resource: "model.ecore#//@Foo"
```

### eSuperTypes: SIEMPRE inline attribute (NUNCA child element)
✅ `eSuperTypes="#//Task"` 
❌ `<eSuperTypes eType="#//Task"/>`
❌ `<eSuperTypes>#//Task</eSuperTypes>`

## ADDED: Checklist de Compatibilidad Eclipse

Documentación de 7 errores comunes que rompen la importación en Eclipse, con sus causas y soluciones.

## ADDED: Sistema de Notificaciones (Observable Pattern)

El sistema de observers de EMF se mapea a React:
- `eAdapters()` → array de callbacks React
- `eNotify()` → dispatches a Zustand store
- Cambios en EList → notificaciones ADD/REMOVE/SET/MOVE
- Patrón Command para undo/redo histórico
