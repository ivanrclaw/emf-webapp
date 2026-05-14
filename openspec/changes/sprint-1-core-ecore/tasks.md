# Tasks: Sprint 1 — Core Ecore

## Fase 1: Configuración del Proyecto
- [ ] Inicializar monorepo con Turborepo + npm workspaces
- [ ] Configurar TypeScript estricto en packages/core
- [ ] Configurar Vitest para tests
- [ ] Configurar NestJS en packages/backend
- [ ] Configurar ESLint + Prettier

## Fase 2: Core Ecore — Interfaces
- [ ] EObject interface (eClass, eGet, eSet, eIsSet, eUnset, eContainer, eContents, eAllContents, eResource)
- [ ] EModelElement (eAnnotations)
- [ ] ENamedElement (name)
- [ ] EClassifier (instanceClassName, defaultValue, ePackage, eTypeParameters)
- [ ] EClass (abstract, interface, eSuperTypes, eStructuralFeatures, eOperations, eAllAttributes, eAllReferences, eAllSuperTypes, eIDAttribute)
- [ ] ETypedElement (ordered, unique, lowerBound, upperBound, many, required, eType)
- [ ] EStructuralFeature (changeable, volatile, transient, defaultValueLiteral, unsettable, derived)
- [ ] EAttribute (iD)
- [ ] EReference (containment, resolveProxies, eOpposite, eReferenceType, eKeys)
- [ ] EDataType (serializable) + constantes para tipos primitivos
- [ ] EEnum + EEnumLiteral
- [ ] EOperation + EParameter
- [ ] EPackage (nsURI, nsPrefix, eClassifiers, eSubpackages, eFactoryInstance)
- [ ] EAnnotation (source, details)
- [ ] EFactory (create, createFromString, convertToString)
- [ ] EGenericType + ETypeParameter

## Fase 3: Core Ecore — Implementación
- [ ] Implementar EObjectImpl (eGet/eSet por feature name, eContainer tracking)
- [ ] Implementar EList (array observable con add/remove/at/array)
- [ ] Implementar Notification básica (change events)
- [ ] Implementar resolución de eSuperTypes (DFS transitivo)
- [ ] Implementar eAllAttributes (recorrer herencia)
- [ ] Implementar eAllReferences (recorrer herencia)
- [ ] Implementar eAllSuperTypes (sin duplicados)
- [ ] Implementar eIDAttribute (buscar en herencia)
- [ ] Implementar eContainer/eContents/eAllContents
- [ ] Implementar EPackage con gestión de eClassifiers
- [ ] Implementar EFactory básica

## Fase 4: Serialización
- [ ] Serializador JSON: EObject → objeto plano → JSON
- [ ] Deserializador JSON: JSON → objeto Ecore (con resolución de referencias)
- [ ] Serializador XMI: EObject → XML Ecore
- [ ] Deserializador XMI: XML → objeto Ecore
- [ ] Tests de ida y vuelta (JSON y XMI)

## Fase 5: Backend API
- [ ] Módulo Project (controller, service, entity TypeORM)
- [ ] Módulo Metamodel (controller, service, entity TypeORM)
- [ ] Conexión SQLite con TypeORM
- [ ] CRUD completo de proyectos
- [ ] CRUD completo de metamodelos
- [ ] Endpoint de exportación (JSON/XMI)
- [ ] Validación de entrada (class-validator)
- [ ] Manejo de errores (exception filters)
- [ ] Tests de integración de la API

## Fase 6: Frontend Básico
- [ ] Layout básico React (sidebar + main)
- [ ] Lista de proyectos (fetch + mostrar)
- [ ] Página de detalle de proyecto
- [ ] Lista de metamodelos del proyecto
- [ ] Visualizador básico de metamodelo (árbol o JSON)

## Fase 7: Tests y Documentación
- [ ] Tests unitarios del core (20+ tests cubriendo todas las interfaces)
- [ ] Tests de serialización (JSON y XMI)
- [ ] Tests de integración API (10+ tests)
- [ ] Documentación del módulo core
