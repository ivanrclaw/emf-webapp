# Spec: Sistema Base — Núcleo Ecore

## ADDED: Core Ecore Metamodel

### Resumen
Implementación del metametamodelo Ecore completo en TypeScript, con todas las interfaces y clases necesarias para representar cualquier modelo EMF.

### Interfaces
- `EObject`: raíz reflexiva (eClass, eGet, eSet, eContainer, eContents, eAllContents)
- `EModelElement`: añade eAnnotations
- `ENamedElement`: añade name
- `EClassifier`: abstracto, añade instanceClassName, defaultValue, ePackage
- `EClass`: EClassifiers con eStructuralFeatures, eOperations, eSuperTypes, propiedades derivadas (eAllAttributes, eAllReferences, eAllSuperTypes, eIDAttribute)
- `ETypedElement`: tipo, cardinalidad (ordered, unique, lowerBound, upperBound)
- `EStructuralFeature`: abstracto, añade changeable, volatile, transient, derived, defaultValueLiteral
- `EAttribute`: iD, eAttributeType
- `EReference`: containment, resolveProxies, eOpposite, eReferenceType, eKeys
- `EDataType`: serializable
- `EEnum`: eLiterals
- `EEnumLiteral`: value, literal
- `EOperation`: eParameters, eExceptions
- `EParameter`: eOperation
- `EPackage`: nsURI, nsPrefix, eClassifiers, eSubpackages, eFactoryInstance
- `EAnnotation`: source, details (pares clave-valor)
- `EFactory`: create(), createFromString(), convertToString()
- `EGenericType`: eUpperBound, eLowerBound, eTypeArguments, eClassifier, eTypeParameter
- `ETypeParameter`: eBounds

### Comportamiento
- eAllAttributes y eAllReferences deben recorrer la jerarquía de herencia (eSuperTypes transitivo)
- eAllSuperTypes debe devolver todas las superclases (DFS/BFS, sin duplicados)
- eIDAttribute debe devolver el primer EAttribute con iD=true, buscando en la jerarquía
- eContainer debe devolver el contenedor padre (objeto que tiene una EReference de containment hacia este)
- eContents debe devolver todos los objetos hijos por referencias de containment
- eAllContents debe recorrer recursivamente todos los descendientes

### DataTypes Soportados
EString, EBoolean, EInt, ELong, EFloat, EDouble, EByte, EByteArray, EChar, EShort, EBigDecimal, EBigInteger, EDate, EObject, EJavaObject, EJavaClass

## ADDED: Serialización

### JSON (formato nativo)
```json
{
  "eClass": "http://www.eclipse.org/emf/2002/Ecore#//EClass",
  "name": "Persona",
  "eStructuralFeatures": [...]
}
```

### XMI (compatible con Eclipse)
Soporte completo de XMI 2.0 para importación/exportación con Eclipse EMF

## ADDED: API REST

### Endpoints
- `GET/POST /api/projects` — listar/crear proyectos
- `GET/PUT/DEL /api/projects/:id` — CRUD proyecto individual
- `GET/POST /api/projects/:pid/metamodels` — metamodelos del proyecto
- `GET/PUT/DEL /api/projects/:pid/metamodels/:mmid` — metamodelo individual
- `POST /api/projects/:pid/metamodels/:mmid/export` — exportar a XMI/JSON

### Modelo de Persistencia (SQLite)
- Tabla `projects`: id, name, description, created_at, updated_at
- Tabla `metamodels`: id, project_id, name, ns_uri, ns_prefix, content (JSON)
- Tabla `models`: id, metamodel_id, name, content (JSON)
- Tabla `templates`: id, project_id, name, content, language
- Tabla `constraints`: id, metamodel_id, name, context_class, expression, severity, message
- Tabla `diagram_specs`: id, metamodel_id, name, spec (JSON)
