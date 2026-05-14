# Guía Completa: Reconstrucción de Eclipse Modeling Framework (EMF) como WebApp

## Índice
1. [Introducción y Objetivo](#1-introducción-y-objetivo)
2. [El Metametamodelo Ecore](#2-el-metametamodelo-ecore)
3. [Arquitectura Completa de EMF](#3-arquitectura-completa-de-emf)
4. [Análisis de Viabilidad Web](#4-análisis-de-viabilidad-web)
5. [Arquitectura Propuesta: Cliente-Servidor](#5-arquitectura-propuesta-cliente-servidor)
6. [Stack Tecnológico Detallado](#6-stack-tecnológico-detallado)
7. [Componentes del Sistema](#7-componentes-del-sistema)
8. [Flujo de Trabajo Completo](#8-flujo-de-trabajo-completo)
9. [Plan de Implementación por Sprints (OpenSpec)](#9-plan-de-implementación-por-sprints-openspec)

---

## 1. Introducción y Objetivo

### 1.1 ¿Qué es EMF?

Eclipse Modeling Framework (EMF) es un framework de modelado y generación de código basado en Eclipse. Permite:

- **Definir metamodelos** (esquemas de datos) usando **Ecore** como lenguaje de metmodelado
- **Generar código Java** automáticamente (interfaces, implementaciones, adaptadores, editores)
- **Crear editores visuales** (diagramas gráficos) para los modelos definidos
- **Transformar modelos** a otros modelos (M2M) y a texto/código (M2T)
- **Validar modelos** con restricciones OCL

### 1.2 Objetivo del Proyecto

Reconstruir las funcionalidades esenciales de EMF como una **aplicación web moderna**, sin dependencia del IDE Eclipse, que permita:

1. **Crear metamodelos .ecore** visual e intuitivamente (editor gráfico)
2. **Crear modelos** (instancias) a partir de los metamodelos
3. **Diseñar sintaxis gráfica** similar a Sirius (arrastrar y soltar diagramas)
4. **Generar código** mediante plantillas (similar a Acceleo)
5. **Validar modelos** con restricciones OCL (Object Constraint Language)

### 1.3 Principios de Diseño

- **100% web**: sin dependencias de Eclipse, Java ni instalaciones locales
- **Interfaz intuitiva**: drag & drop, WYSIWYG, feedback visual inmediato
- **Procesamiento local y en servidor**: operaciones ligeras en cliente, pesadas en servidor
- **Persistencia en la nube**: los modelos se almacenan en el backend
- **Exportación/Importación**: XMI, JSON, formatos estándar
- **Extensible**: arquitectura de plugins para añadir nuevos generadores y validadores

---

## 2. El Metametamodelo Ecore

### 2.1 ¿Qué es Ecore?

**Ecore** es el metametamodelo central de EMF. Es un modelo de sí mismo (autodescriptivo: `Ecore.ecore` se define en términos de Ecore). Corresponde a EMOF (Essential Meta-Object Facility) de OMG.

Ecore define 44 clasificadores (EClasses + EDataTypes) organizados jerárquicamente.

### 2.2 Jerarquía de Tipos Fundamentales

```
EObject (raíz de todos los objetos modelados)
  └── EModelElement (abstracto, añade eAnnotations)
       └── ENamedElement (abstracto, añade name)
            ├── EClassifier (abstracto, añade instanceClassName, defaultValue)
            │    ├── EClass (el más importante: clases, atributos, referencias)
            │    └── EDataType (tipos primitivos: EString, EInt, EBoolean...)
            │         └── EEnum (enumeraciones con EEnumLiterals)
            ├── ETypedElement (abstracto, añade tipo, cardinalidad)
            │    ├── EStructuralFeature (abstracto, añade changeable, volatile, transient)
            │    │    ├── EAttribute (atributo simple, apunta a EDataType)
            │    │    └── EReference (referencia, apunta a EClass, containment, eOpposite)
            │    └── EOperation (método, con EParameters y excepciones)
            └── EPackage (contiene EClassifiers, nsURI, nsPrefix)
                 └── (puede tener subpaquetes)
```

### 2.3 EClass en Detalle (el corazón de Ecore)

Un `EClass` representa un concepto del dominio. Puede ser:
- **Concreto** (se pueden crear instancias)
- **Abstracto** (no se pueden instanciar directamente)
- **Interfaz**

Propiedades clave de EClass:

| Propiedad | Tipo | Descripción |
|-----------|------|-------------|
| `name` | EString | Nombre de la clase |
| `abstract` | EBoolean | Si es abstracta |
| `interface` | EBoolean | Si es interfaz |
| `eSuperTypes` | [EClass] | Clases padre (herencia múltiple) |
| `eStructuralFeatures` | [EStructuralFeature] | Atributos + Referencias |
| `eOperations` | [EOperation] | Métodos |
| `eAllAttributes` | [EAttribute] (derivado) | Todos los atributos (incluyendo herencia) |
| `eAllReferences` | [EReference] (derivado) | Todas las referencias (incluyendo herencia) |
| `eAllStructuralFeatures` | [EStructuralFeature] (derivado) | Todos los features |
| `eAllSuperTypes` | [EClass] (derivado) | Todas las superclases transitivas |
| `eIDAttribute` | EAttribute (derivado) | El atributo marcado como ID |
| `eTypeParameters` | [ETypeParameter] | Parámetros de tipo (genéricos) |

### 2.4 EStructuralFeature en Detalle

#### EAttribute
Representa una propiedad simple (atributo Java):
- `name`: nombre
- `eType`: EDataType (EString, EInt, EBoolean, EBigDecimal...)
- `lowerBound`, `upperBound`: cardinalidad (-1 = muchos)
- `iD`: si es el atributo identificador
- `changeable`, `volatile`, `transient`, `unsettable`, `derived`: flags de comportamiento
- `defaultValueLiteral`: valor por defecto

#### EReference
Representa una asociación entre clases:
- `name`: nombre
- `eType`: EClass destino
- `containment`: si el destino es hijo (composición)
- `eOpposite`: referencia inversa (bidireccionalidad)
- `lowerBound`, `upperBound`: cardinalidad
- `resolveProxies`: si resuelve referencias proxy
- `eKeys`: claves para referencia por atributos

### 2.5 EDataType y EEnum

**EDataType** (tipos primitivos nativos):
- `EString`, `EBoolean`, `EInt`, `ELong`, `EFloat`, `EDouble`, `EByte`
- `EByteArray`, `EChar`, `EShort`, `EBigDecimal`, `EBigInteger`, `EDate`
- `EObject` (el tipo base de todos los objetos)
- `EJavaObject`, `EJavaClass`

**EEnum** define enumeraciones:
```
EEnum
  └── EEnumLiteral
       ├── name: EString
       ├── value: EInt
       └── literal: EString
```

### 2.6 EPackage

Contenedor raíz de los clasificadores (EClasses, EDataTypes, EEnums):
- `name`: nombre corto
- `nsURI`: URI única (ej: `http://mimodelo/1.0`)
- `nsPrefix`: prefijo (ej: `mimodelo`)
- `eClassifiers`: lista de clasificadores
- `eSubpackages`: subpaquetes

### 2.7 EAnnotation (Mecanismo de Extensión)

Permite añadir metadatos arbitrarios a cualquier EModelElement:
- `source`: URI que identifica el tipo de anotación
- `details`: pares clave-valor (`EStringToStringMapEntry`)
- `contents`: objetos EObject embebidos
- `references`: referencias a otros objetos

**Usos críticos de EAnnotation:**
- **OCL constraints** (`http://www.eclipse.org/emf/2002/Ecore/OCL/Pivot`)
- **GenModel configuración** (`http://www.eclipse.org/emf/2002/GenModel`)
- **Delegación OCL** (invocationDelegates, settingDelegates, validationDelegates)

### 2.8 Referencia Rápida de la API Reflexiva de EObject

```javascript
// Todo objeto modelado implementa la interfaz EObject:
obj.eClass()           // → EClass (su metaclase)
obj.eGet(feature)      // → leer propiedad por nombre o índice
obj.eSet(feature, val) // → escribir propiedad
obj.eIsSet(feature)    // → verificar si está seteada
obj.eUnset(feature)    // → resetear a valor por defecto
obj.eContainer()       // → contenedor padre
obj.eContents()        // → hijos directos (referencias de containment)
obj.eAllContents()     // → todos los hijos recursivamente
obj.eResource()        // → recurso que lo contiene
obj.eClass().getEStructuralFeature(name) // buscar feature por nombre
```

---

## 3. Arquitectura Completa de EMF

### 3.1 Mapa del Ecosistema EMF

```
┌──────────────────────────────────────────────────────────────────┐
│                    ECLIPSE MODELING PROJECT                       │
│                                                                   │
│  ┌─────────────────┐  ┌──────────────┐  ┌──────────────────┐    │
│  │   EMF CORE       │  │  EMF EDIT    │  │  EMF EDITOR      │    │
│  │  ─ Ecore         │  │  ─ Item      │  │  ─ Multi-page    │    │
│  │  ─ EObject       │  │    Providers │  │    Editor        │    │
│  │  ─ Resource      │  │  ─ Commands  │  │  ─ Wizards       │    │
│  │  ─ EPackage.Reg  │  │  ─ Property  │  │  ─ Views         │    │
│  │  ─ XMI Serial.   │  │    Sources   │  │                  │    │
│  └────────┬─────────┘  └──────┬───────┘  └────────┬─────────┘    │
│           │                   │                    │              │
│  ┌────────▼───────────────────▼────────────────────▼─────────┐    │
│  │                 EMF CODE GENERATION                       │    │
│  │       GenModel → Interfaces + Impl + Edit + Editor        │    │
│  └────────────────────────────────┬─────────────────────────┘    │
│                                   │                              │
│  ┌────────────────────────────────┼────────────────────────┐    │
│  │                                │                        │    │
│  ▼                                ▼                        ▼     │
│  ┌──────────┐  ┌──────────┐  ┌────────┐  ┌──────────┐  ┌────┐ │
│  │ M2M: ATL │  │ M2T:     │  │ OCL    │  │ Xtext   │  │CDO │ │
│  │ QVT      │  │ Acceleo  │  │ Valid. │  │ (DSLs)  │  │Rep.│ │
│  │ Epsilon  │  │ EGL      │  │        │  │         │  │    │ │
│  └──────────┘  └──────────┘  └────────┘  └──────────┘  └────┘ │
│  ┌──────────┐  ┌───────────────────────┐  ┌──────────────────┐ │
│  │ GMF      │  │ Sirius (Desktop + Web)│  │ GLSP             │ │
│  │ EuGENia  │  │ Diagramas gráficos    │  │ Web Diagrams     │ │
│  └──────────┘  └───────────────────────┘  └──────────────────┘ │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────┐ │
│  │ Epsilon  │  │ MoDisco  │  │ EMF      │  │ MWE            │ │
│  │ (ETL+EGL)│  │ Reverse  │  │ Compare  │  │ Workflow Eng.  │ │
│  └──────────┘  │ Eng.     │  └──────────┘  └────────────────┘ │
│                └──────────┘                                    │
└──────────────────────────────────────────────────────────────────┘
```

### 3.2 Subproyectos Esenciales de EMF

| Subproyecto | Función | Tipo |
|-------------|---------|------|
| **Ecore** | Metametamodelo, runtime reflexivo | Núcleo |
| **EMF.Edit** | ItemProviders, Commands, PropertySources | UI |
| **EMF.Editor** | Editor multipágina genérico | UI |
| **EMF CodeGen** | Generación Java desde .genmodel | Generación |
| **XMI** | Serialización/deserialización XML | Persistencia |
| **EMF JSON (emfjson)** | Serialización JSON alternativa | Persistencia |

### 3.3 Extensiones Clave

| Proyecto | Función |
|----------|---------|
| **OCL** | Lenguaje de restricciones y validación |
| **Acceleo** | Generación M2T basada en plantillas MTL |
| **ATL** | Transformación M2M declarativa |
| **QVT** | Transformaciones modelo-modelo (OMG) |
| **Epsilon** | Suite completa (ETL, EGL, ECL, EVL, EML, EOL) |
| **Xtext** | Frameworks DSLs textuales |
| **Sirius** | Workbenches de modelado gráfico (Desktop + Web) |
| **GMF / EuGENia** | Editores gráficos basados en EMF |
| **GLSP** | Plataforma servidor gráfico web (LSP para diagramas) |
| **CDO** | Repositorio distribuido de modelos |
| **EMF Compare** | Comparación y fusión de modelos |
| **MoDisco** | Ingeniería inversa (Java → Modelo) |
| **MWE** | Orquestación de workflows de modelado |
| **Papyrus** | Modelado UML industrial |

---

## 4. Análisis de Viabilidad Web

### 4.1 ¿100% Local (Solo Navegador)?

**Ventajas:**
- Sin dependencias servidor, despliegue trivial (GitHub Pages, CDN)
- Privacidad total (datos nunca salen del navegador)
- Ideal para prototipado rápido
- Framework existente: **ecore.js** implementa Ecore en JS puro

**Limitaciones:**
- **ecore.js** está desactualizado (v0.4.1, 2014) y no soporta XMI completo
- Acceso a sistema de archivos restringido (solo con File System Access API)
- No hay generación de código compleja sin backend (Java imposible, genera texto plano)
- Las transformaciones M2M pesadas colapsan el hilo principal
- Persistencia limitada a IndexedDB/LocalStorage
- Imposible integrar motores OCL pesados o validación Epsilon

**Conclusión: 100% local es viable para funcionalidad básica pero insuficiente para un reemplazo completo de EMF.**

### 4.2 Arquitectura Cliente-Servidor (RECOMENDADA)

**Ventajas:**
- Backend se encarga de operaciones pesadas (validación OCL, generación, transformaciones)
- Persistencia real (base de datos, sistema de archivos)
- Colaboración en tiempo real (WebSockets)
- Escalabilidad (múltiples usuarios, proyectos compartidos)
- Puede usar librerías Java existentes (PyEcore, EMF4CPP)
- Integración con sistemas externos (Git, CI/CD)

**Inconvenientes:**
- Necesita servidor desplegado (Fly.io, AWS, Railway)
- Mayor complejidad operativa
- Latencia de red en operaciones

**Conclusión: Cliente-Servidor es la arquitectura correcta. El frontend maneja la edición visual interactiva y el backend las operaciones pesadas.**

### 4.3 Similitudes con Proyectos Existentes

| Proyecto | Tecnología | Nuestra WebApp |
|----------|------------|----------------|
| **Sirius Web** | Spring + React + GraphQL + PostgreSQL | Inspiración directa para diagramas |
| **GLSP** | Servidor gráfico + cliente web | Inspiración para protocolo cliente-servidor |
| **ecore.js** | JavaScript puro | Base para manipulación Ecore en cliente |
| **PyEcore** | Python | Alternativa backend para Ecore |
| **emfjson** | JSON | Formato de serialización ligero |
| **React Flow** | React | Librería para diagramas nodo-enlace |

---

## 5. Arquitectura Propuesta: Cliente-Servidor

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENTE (Navegador)                          │
│                                                                     │
│  ┌──────────────┐  ┌──────────────────┐  ┌─────────────────────┐  │
│  │ Editor       │  │ Canvas Diagramas  │  │ Editor Plantillas   │  │
│  │ Ecore Visual │  │ (React Flow)     │  │ MTL (CodeMirror/    │  │
│  │ (Tree +      │  │ - Nodos EClass   │  │ Monaco)             │  │
│  │  Inspector)  │  │ - Edges ERefs    │  │ - Sintaxis resaltada│  │
│  │              │  │ - Paletas        │  │ - Vista previa      │  │
│  └──────┬───────┘  └────────┬─────────┘  └─────────┬───────────┘  │
│         │                  │                       │              │
│         └──────────────────┼───────────────────────┘              │
│                            │                                      │
│  ┌─────────────────────────▼─────────────────────────────────┐   │
│  │               Capa de Servicios Web                        │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐ │   │
│  │  │ Servicio │ │ Servicio │ │ Servicio │ │ Servicio     │ │   │
│  │  │ Modelo   │ │ Grafos   │ │ Valida-  │ │ Generación   │ │   │
│  │  │ CRUD     │ │ Diseño   │ │ ción OCL │ │ Código       │ │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────┘ │   │
│  └────────────────────────┬──────────────────────────────────┘   │
│                           │ HTTP/REST/WebSocket                  │
└───────────────────────────┼──────────────────────────────────────┘
                            │
┌───────────────────────────┼──────────────────────────────────────┐
│                      API GATEWAY (Express/HTTP)                   │
│                           │                                       │
│  ┌────────────────────────▼──────────────────────────────────┐   │
│  │                     BACKEND (Node.js + Python)              │   │
│  │                                                             │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │   │
│  │  │ Core Ecore   │  │ Motor OCL    │  │ Motor            │  │   │
│  │  │ Resolver     │  │ (PyEcore)    │  │ Generación       │  │   │
│  │  │ - EPackages  │  │ - Validación │  │ (Handlebars/     │  │   │
│  │  │ - Recursos   │  │ - Invariants │  │  JSX/Mustache)   │  │   │
│  │  │ - XMI Parser │  │              │  │                  │  │   │
│  │  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │   │
│  │         │                │                    │              │   │
│  │  ┌──────▼────────────────▼────────────────────▼──────────┐  │   │
│  │  │              Gestor de Persistencia                    │  │   │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐   │  │   │
│  │  │  │ SQLite/  │ │ Sistema  │ │ Index   │ │ Git     │   │  │   │
│  │  │  │ Postgres │ │ Archivos │ │ Búsqueda│ │ Snap.   │   │  │   │
│  │  │  └──────────┘ └──────────┘ └──────────┘ └─────────┘   │  │   │
│  │  └────────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────┘
```

### 5.1 Flujo de Datos

1. **Editor Ecore**: El usuario dibuja EClasses, EAttributes, EReferences en el canvas (React Flow). El frontend mantiene un modelo Ecore en memoria (ecore.js o modelo propio). Al guardar, se serializa a JSON/XMI y se envía al backend.

2. **Editor de Diagramas (Sirius-like)**: Para editar instancias del modelo (modelos M1). El backend envía la definición del metamodelo (Ecore) y el frontend renderiza un canvas con nodos editables que se ajustan al metamodelo.

3. **Validación OCL**: El frontend envía el modelo + restricciones al backend. El backend ejecuta PyEcore o un motor OCL JS y devuelve los errores/infos.

4. **Generación de Código**: El usuario escribe plantillas en el editor (Monaco/CodeMirror). El backend ejecuta las plantillas contra el modelo y devuelve el resultado.

---

## 6. Stack Tecnológico Detallado

### 6.1 Frontend

| Tecnología | Propósito | Justificación |
|------------|-----------|---------------|
| **React 19** | Framework UI | Ecosistema maduro, componentes reutilizables |
| **TypeScript** | Tipado seguro | Evita errores en manipulación de metamodelos |
| **React Flow (xyflow)** | Canvas diagramas nodo-enlace | Editor visual de EClasses y referencias |
| **Monaco Editor** | Editor de código/plantillas | Resaltado sintaxis, autocompletado |
| **Tailwind CSS 4** | Estilos | Rápido, consistente, responsive |
| **shadcn/ui** | Componentes UI | Diálogos, formularios, tabs, paneles |
| **react-i18next** | Internacionalización | EN/ES |
| **Zustand** | Estado global | Ligero, simple, TypeScript-friendly |
| **React Query (TanStack)** | Datos servidor | Cache, refetch, mutaciones |
| **react-beautiful-dnd / dnd-kit** | Drag & drop | Reordenar features en panel de propiedades |
| **vis-network / cytoscape** | Alternativa grafos | Para visualización de modelos completos |

### 6.2 Backend

| Tecnología | Propósito |
|------------|-----------|
| **Node.js + Express/NestJS** | API REST principal |
| **Python (PyEcore)** | Manipulación Ecore, validación OCL, parsing XMI |
| **SQLite / PostgreSQL** | Persistencia de proyectos y modelos |
| **TypeORM o Prisma** | ORM para base de datos |
| **WebSocket (Socket.IO)** | Colaboración en tiempo real |
| **Passport/JWT** | Autenticación |
| **Fly.io** | Despliegue (basado en experiencia previa) |
| **Redis** | Cache de modelos parseados |

### 6.3 Librerías para Modelado Ecore

| Librería | Lenguaje | Función |
|----------|----------|---------|
| **ecore.js** | JS | Implementación Ecore en cliente (limitada) |
| **PyEcore** | Python | Implementación completa Ecore en servidor |
| **emfjson** | JSON | Serialización alternativa a XMI |
| **Eclipse EMF Core** | Java | Para usar si se despliega servidor Java |
| **EMF4CPP** | C++ | Alternativa para backend de alto rendimiento |

### 6.4 Formato de Datos

**Opción recomendada: JSON como formato nativo, con exportación a XMI.**

```json
{
  "eClass": "ECorePackage#//EPackage",
  "name": "miModelo",
  "nsURI": "http://ejemplo.com/miModelo/1.0",
  "nsPrefix": "mimodelo",
  "eClassifiers": [
    {
      "eClass": "ECorePackage#//EClass",
      "name": "Persona",
      "abstract": false,
      "eStructuralFeatures": [
        {
          "eClass": "ECorePackage#//EAttribute",
          "name": "nombre",
          "eType": "ECorePackage#//EString",
          "lowerBound": 1,
          "upperBound": 1
        },
        {
          "eClass": "ECorePackage#//EReference",
          "name": "hijos",
          "eType": "#//Persona",
          "containment": true,
          "upperBound": -1
        }
      ]
    }
  ]
}
```

---

## 7. Componentes del Sistema

### 7.1 Módulo Core Ecore (Backend y Frontend)

**Responsabilidades:**
- Definir el modelo de datos Ecore en JSON/TypeScript
- Operaciones CRUD sobre EPackage, EClass, EAttribute, EReference, EEnum, EOperation
- Serialización/deserialización XMI
- Resolución de referencias (eOpposite, eSuperTypes, eType)
- Cálculo de propiedades derivadas (eAllAttributes, eAllReferences...)

**Interfaces TypeScript:**

```typescript
// === Metametamodelo Ecore ===

interface EObject {
  eClass(): EClass;
  eGet(feature: string | number): any;
  eSet(feature: string | number, value: any): void;
  eIsSet(feature: string | number): boolean;
  eUnset(feature: string | number): void;
  eContainer(): EObject | null;
  eContents(): EObject[];
  eAllContents(): Generator<EObject>;
  eResource(): Resource | null;
}

interface ENamedElement extends EModelElement {
  name: string;
}

interface EModelElement extends EObject {
  eAnnotations: EAnnotation[];
}

interface EClassifier extends ENamedElement {
  instanceClassName?: string;
  defaultValue?: string;
  ePackage: EPackage;
  eTypeParameters: ETypeParameter[];
}

interface EClass extends EClassifier {
  abstract: boolean;
  interface: boolean;
  eSuperTypes: EClass[];
  eStructuralFeatures: EStructuralFeature[];
  eOperations: EOperation[];
  eAllAttributes: EAttribute[];      // derivado
  eAllReferences: EReference[];       // derivado
  eAllStructuralFeatures: EStructuralFeature[]; // derivado
  eAllSuperTypes: EClass[];           // derivado
  eIDAttribute: EAttribute | null;    // derivado
}

interface ETypedElement extends ENamedElement {
  ordered: boolean;
  unique: boolean;
  lowerBound: number;
  upperBound: number;  // -1 = muchos
  many: boolean;       // derivado: upperBound < 0 || upperBound > 1
  required: boolean;   // derivado: lowerBound > 0
  eType: EClassifier | null;
  eGenericType: EGenericType | null;
}

interface EStructuralFeature extends ETypedElement {
  changeable: boolean;
  volatile: boolean;
  transient: boolean;
  defaultValueLiteral: string;
  unsettable: boolean;
  derived: boolean;
  eContainingClass: EClass;
}

interface EAttribute extends EStructuralFeature {
  iD: boolean;
  eAttributeType: EDataType; // derivado
}

interface EReference extends EStructuralFeature {
  containment: boolean;
  container: boolean;      // derivado: opposite != null && opposite.containment
  resolveProxies: boolean;
  eOpposite: EReference | null;
  eReferenceType: EClass;  // derivado
  eKeys: EAttribute[];
}

interface EDataType extends EClassifier {
  serializable: boolean;
}

interface EEnum extends EDataType {
  eLiterals: EEnumLiteral[];
}

interface EEnumLiteral extends ENamedElement {
  value: number;
  literal: string;
  instance: any;
  eEnum: EEnum;
}

interface EOperation extends ETypedElement {
  eParameters: EParameter[];
  eExceptions: EClassifier[];
  eContainingClass: EClass;
}

interface EParameter extends ETypedElement {
  eOperation: EOperation;
}

interface EPackage extends ENamedElement {
  nsURI: string;
  nsPrefix: string;
  eClassifiers: EClassifier[];
  eSubpackages: EPackage[];
  eSuperPackage: EPackage | null;
  eFactoryInstance: EFactory;
}

interface EAnnotation extends EModelElement {
  source: string;
  details: Record<string, string>;
  contents: EObject[];
  references: EObject[];
}

interface EFactory extends EModelElement {
  ePackage: EPackage;
}

interface EGenericType extends EObject {
  eUpperBound: EClassifier | null;
  eTypeArguments: EGenericType[];
  eLowerBound: EClassifier | null;
  eTypeParameter: ETypeParameter | null;
  eClassifier: EClassifier | null;
}

interface ETypeParameter extends ENamedElement {
  eBounds: EGenericType[];
}
```

### 7.2 Editor Visual de Metamodelos (Ecore Diagram Editor)

**Funcionalidades:**
- Canvas tipo diagrama de clases UML
- Arrastrar EClass desde paleta al canvas
- Conectar EClasses con flechas (EReference)
- Panel de propiedades para editar atributos
- Vista de árbol jerárquico del EPackage
- Vista de código fuente (Ecore XMI en vivo)

**React Flow Nodes personalizados:**
```
EClassNode:
┌──────────────────────┐
│ «EClass»             │
│ Persona              │
├──────────────────────┤
│ + nombre: EString    │ ← EAttributes
│ + edad: EInt         │
├──────────────────────┤
│ + direccion          │ ← EReferences (no containment)
│ └ hijos[*]           │ ← EReferences (containment)
└──────────────────────┘
```

### 7.3 Editor de Modelos (Instancias M1)

**Funcionalidades:**
- Carga un metamodelo .ecore
- Genera canvas con nodos que solo pueden tener features definidos en el metamodelo
- Restricción de tipos: solo permite valores de tipos correctos
- Validación en tiempo real de OCL constraints
- Exportación a XMI

### 7.4 Editor de Diagramas (Sirius-like)

**Funcionalidades:**
- Definir representaciones gráficas para cada EClass
- Configurar colores, formas, íconos, estilos condicionales
- Capas (layers) y filtros
- Paletas de herramientas personalizadas
- Editor de mapping: qué EClass → qué forma

**Inspiración en Sirius Desktop y Sirius Web:**
- Sirius usa modelos `.odesign` (definición de la representación visual)
- Nosotros usaremos JSON/YAML para definir el mapping
- El frontend interpreta ese mapping para renderizar

**Ejemplo de definición de sintaxis (Specification):**

```json
{
  "name": "Diagrama de Agentes",
  "domain": "http://ejemplo.com/agentes/1.0",
  "layers": [
    {
      "name": "Principal",
      "default": true,
      "mappings": [
        {
          "domainClass": "Agente",
          "semanticCandidatesExpression": "self.agentes",
          "style": {
            "shape": "rectangle",
            "color": "#D4E6F1",
            "borderColor": "#2980B9",
            "labelExpression": "self.name"
          },
          "childrenMappings": [
            {
              "domainClass": "Tarea",
              "style": {
                "shape": "ellipse",
                "color": "#D5F5E3",
                "labelExpression": "self.name"
              }
            }
          ]
        },
        {
          "domainClass": "Enlace",
          "sourceMapping": "Tarea",
          "targetMapping": "Tarea",
          "style": {
            "lineStyle": "solid",
            "sourceDecoration": "none",
            "targetDecoration": "arrow"
          }
        }
      ]
    }
  ]
}
```

### 7.5 Motor de Validación OCL

**Niveles de implementación:**

1. **Básico**: sintaxis simplificada de OCL (invariants simples)
   - `self.atributo > 0`
   - `self.referencia->size() <= 5`
   - `self.referencia->forAll(x | x.nombre <> '')`

2. **Intermedio**: OCL completo con tipos y colecciones
   - `self.agentes.tareas->select(t | t.oclIsKindOf(TareaHumana))->size() >= 1`
   - `self.referencia.outgoing->forAll(l | l.target <> self)`

3. **Avanzado**: derivación de atributos, operaciones helper
   - Interfaz con Python PyEcore para validación completa

**Formato de constraints:**

```json
{
  "constraints": [
    {
      "name": "R01_OneStart",
      "context": "Sistema",
      "type": "invariant",
      "expression": "self.agentes.tareas->select(t | t.oclIsTypeOf(TareaInicio))->size() = 1",
      "message": "Debe haber exactamente una tarea de inicio en el sistema",
      "severity": "error"
    },
    {
      "name": "R02_NoCiclos",
      "context": "Sistema",
      "type": "invariant", 
      "expression": "not self.agentes.tareas->exists(t | self.agentes.enlaces->exists(e | e.origen = t and e.destino = t))",
      "message": "No se permiten auto-referencias en tareas",
      "severity": "error"
    }
  ]
}
```

### 7.6 Motor de Generación de Código (Acceleo-like)

**Arquitectura de generación:**
- **Plantillas**: lenguaje propio simplificado (MTL-like) o Handlebars/Mustache
- **Contexto**: el modelo (EObject) se pasa como data al template
- **Output**: texto (HTML, SQL, Java, TypeScript, Markdown...)

**Ejemplo de template MTL-like:**

```handlebars
{{#template name="generateHTML"}}
{{#main}}{{{{/main}}}
{{#template name="generateClase"}}
<div class="clase">
  <h2>{{name}}</h2>
  {{#each eStructuralFeatures}}
    {{#if eClass.name '===' 'EAttribute'}}
      <p><strong>{{name}}</strong>: {{eType.name}}</p>
    {{else if eClass.name '===' 'EReference'}}
      <p><strong>{{name}}</strong>: → {{eType.name}}{{#if many}}[*]{{/if}}</p>
    {{/if}}
  {{/each}}
</div>
{{/template}}
```

**Generadores predefinidos que incluiremos:**
- `generateHTML`: genera documentación HTML del modelo
- `generateSQL`: genera esquema SQL CREATE TABLE
- `generateTypescript`: genera interfaces TypeScript
- `generateJSONSchema`: genera JSON Schema
- `generatePlantUML`: genera diagramas PlantUML
- `generateMarkdown`: genera documentación Markdown

### 7.7 Gestión de Proyectos

Cada proyecto contiene:
- Uno o más metamodelos .ecore (EPackage)
- Uno o más modelos M1 (instancias)
- Definiciones de sintaxis gráfica (especificaciones Sirius-like)
- Plantillas de generación de código
- Constraints OCL
- Historial de versiones (Git snapshots)
- Metadatos (nombre, descripción, tags)

### 7.8 API REST

```
Proyectos:
  GET/POST   /api/projects
  GET/PUT/DEL /api/projects/:id

Metamodelos (.ecore):
  GET/POST   /api/projects/:pid/metamodels
  GET/PUT/DEL /api/projects/:pid/metamodels/:mmid
  POST        /api/projects/:pid/metamodels/:mmid/export (XMI/JSON)

Modelos (instancias M1):
  GET/POST   /api/projects/:pid/models
  GET/PUT/DEL /api/projects/:pid/models/:mid

Sintaxis Gráfica (Sirius specs):
  GET/POST   /api/projects/:pid/diagram-specs
  GET/PUT/DEL /api/projects/:pid/diagram-specs/:dsid

Validación OCL:
  POST /api/projects/:pid/validate
  Body: { modelId: string, constraints?: string[] }
  Response: { valid: boolean, errors: ValidationError[] }

Generación Código:
  POST /api/projects/:pid/generate
  Body: { modelId: string, templateId: string }
  Response: { files: [{ name: string, content: string }] }

Plantillas:
  GET/POST   /api/projects/:pid/templates
  GET/PUT/DEL  /api/projects/:pid/templates/:tid
  POST         /api/projects/:pid/templates/:tid/preview
```

---

## 8. Flujo de Trabajo Completo

### 8.1 Ciclo de Vida de un Proyecto

```
1. CREAR PROYECTO
   ↓
2. DEFINIR METAMODELO (Ecore)
   ├── Añadir EClasses (diagrama o código)
   ├── Añadir EAttributes
   ├── Añadir EReferences (con containment y eOpposite)
   ├── Definir EEnums
   ├── Añadir constraints OCL
   └── Validar
   ↓
3. DEFINIR MODELOS (instancias M1)
   ├── Crear instancias de EClasses
   ├── Poblar atributos
   ├── Conectar referencias
   └── Validar contra metamodelo + OCL
   ↓
4. DEFINIR SINTAXIS GRÁFICA (Sirius-like)
   ├── Configurar representación visual
   ├── Mapear EClasses a formas/colores
   ├── Definir paletas y herramientas
   └── Previsualizar
   ↓
5. GENERAR CÓDIGO (Acceleo-like)
   ├── Seleccionar modelo
   ├── Seleccionar/escribir plantilla
   ├── Ejecutar generación
   └── Exportar/descargar resultado
```

### 8.2 Comparativa: EMF Eclipse vs Nuestra WebApp

| Funcionalidad | EMF Eclipse | Nuestra WebApp |
|---------------|-------------|----------------|
| Crear .ecore | Tree editor + Ecore Tools | Canvas visual drag & drop |
| EAttributes | Formularios | Tabla editable inline |
| EReferences | Formularios | Flechas en canvas |
| EOperations | Solo código | Editor visual |
| OCL Constraints | Editor textual | Editor integrado + validación en vivo |
| GenModel | Configuración Java | JSON config |
| Code Gen | Eclipse ejecuta | Botón → backend → resultado |
| XMI/JSON | Nativo | Nativo + exportación |
| Editores | Java SWT | React + TypeScript |
| Colaboración | No nativa | Tiempo real (WebSocket) |
| Despliegue | Eclipse IDE | Navegador (Fly.io) |

---

## 9. Plan de Implementación por Sprints (OpenSpec)

Usando OpenSpec (Spec-Driven Development), dividimos el proyecto en **8 sprints** incrementales.

### Sprint 1: Fundación — Núcleo Ecore y Persistencia

**Duración:** 2 semanas
**Objetivo:** Establecer las bases: modelo Ecore en TypeScript, persistencia, API básica.

**Historias:**
- [EMF-001] Definir interfaces TypeScript del metametamodelo Ecore (EObject, EClass, EAttribute, EReference, EPackage, etc.)
- [EMF-002] Implementar EObject básico con eClass(), eGet(), eSet(), eContainer(), eContents(), eAllContents()
- [EMF-003] Implementar EPackage con eClassifiers (CRUD de EClasses, EDataTypes, EEnums)
- [EMF-004] Implementar resolución de referencias (eOpposite, eSuperTypes, eType, eKeys)
- [EMF-005] Implementar serialización/deserialización JSON (emfjson compatible)
- [EMF-006] Implementar serialización/deserialización XMI básica
- [EMF-007] Crear backend Express/NestJS con API REST para proyectos y metamodelos
- [EMF-008] Persistencia SQLite: guardar/cargar proyectos, metamodelos y modelos
- [EMF-009] Tests unitarios del core Ecore (EObject, EClass, ciclos de modelado)
- [EMF-010] Documentación del módulo Core

**Criterios de aceptación:**
- Se puede crear un EPackage con EClasses y EFeatures programáticamente en JS/TS
- Serialización ida y vuelta (JSON → objeto → JSON sin pérdida de información)
- eAllAttributes y eAllReferences recorren correctamente la jerarquía de herencia
- API REST: CRUD completo de proyectos y metamodelos

---

### Sprint 2: Editor Visual de Metamodelos (Ecore Diagram)

**Duración:** 3 semanas
**Objetivo:** Interfaz gráfica para crear y editar metamodelos .ecore arrastrando y soltando.

**Historias:**
- [EMF-011] Configurar proyecto React + Vite + TypeScript con React Flow
- [EMF-012] Componente EClassNode personalizado (mostrar nombre, atributos, referencias)
- [EMF-013] Paleta de herramientas (arrastrar nueva EClass al canvas)
- [EMF-014] Panel de propiedades (inspector) para editar EClass seleccionado
- [EMF-015] Edición inline de EAttributes (añadir, editar, eliminar, reordenar)
- [EMF-016] Edición inline de EReferences (conectar clases con flechas)
- [EMF-017] Creación de herencia (flecha especial "extends")
- [EMF-018] Vista de árbol jerárquico (navegación lateral del EPackage)
- [EMF-019] Panel de EAnnotations (añadir/metadata extension points)
- [EMF-020] Sincronización en tiempo real entre canvas y árbol lateral

**Criterios de aceptación:**
- El usuario puede crear EClasses arrastrando desde la paleta
- Las propiedades se editan en el inspector con feedback inmediato
- Las EReferences se dibujan como flechas entre nodos
- Se soporta herencia (eSuperTypes) visualmente
- El árbol lateral muestra la jerarquía completa del package

---

### Sprint 3: Editor de Modelos (Instancias M1)

**Duración:** 2 semanas
**Objetivo:** Permitir crear modelos (instancias) a partir de un metamodelo cargado.

**Historias:**
- [EMF-021] Cargar un metamodelo .ecore y generar automáticamente los tipos de nodos disponibles
- [EMF-022] Canvas de instancias: crear nodos que solo pueden tener features del metamodelo
- [EMF-023] Editor de valores con validación de tipos (EString, EInt, EBoolean, EEnum)
- [EMF-024] Conectores entre instancias siguiendo las EReferences definidas
- [EMF-025] Restricción de containment: un hijo no puede tener dos padres
- [EMF-026] Validación en vivo: cardinalidad lowerBound/upperBound en referencias
- [EMF-027] Exportar modelo a XMI/JSON
- [EMF-028] Importar modelo desde XMI/JSON

**Criterios de aceptación:**
- Se crean instancias solo de EClasses concretas (no abstractas ni interfaces)
- Los valores ingresados se validan contra el tipo EDataType
- Las referencias de containment obligan estructura de árbol
- Las cardinalidades se respetan (1, 0..1, *, 1..*)

---

### Sprint 4: Editor de Sintaxis Gráfica (Sirius-like)

**Duración:** 3 semanas
**Objetivo:** Permitir definir representaciones visuales personalizadas para cada EClass.

**Historias:**
- [EMF-029] Crear formato JSON de especificación de sintaxis (mappings, estilos, capas)
- [EMF-030] Editor visual de especificación (configurar forma, color, borde para cada EClass)
- [EMF-031] Sistema de renderizado condicional (colores según valores de atributos)
- [EMF-032] Capas (layers): activar/desactivar conjuntos de elementos visuales
- [EMF-033] Filtros: ocultar/mostrar elementos según condiciones
- [EMF-034] Editor de paletas (herramientas personalizadas para crear elementos)
- [EMF-035] Vista previa en vivo de la especificación contra un modelo existente
- [EMF-036] Estilos de arista (flechas, líneas discontinuas, colores, etiquetas)

**Criterios de aceptación:**
- Se puede definir que "las EClass Tarea se dibujen como elipses azules"
- Los estilos condicionales cambian colores según valores de atributos
- Las capas permiten mostrar/ocultar grupos de elementos
- La vista previa se actualiza al cambiar la especificación

---

### Sprint 5: Motor de Validación OCL

**Duración:** 3 semanas
**Objetivo:** Implementar un motor de restricciones OCL para validar modelos.

**Historias:**
- [EMF-037] Definir AST (Abstract Syntax Tree) para OCL simplificado
- [EMF-038] Parser OCL: tokenizar y parsear invariants
- [EMF-039] Evaluador: navegar el modelo evaluando expresiones OCL
- [EMF-040] Operaciones de colección: forAll, exists, select, collect, size, includes
- [EMF-041] Operadores: OCL lógicos (and, or, not, implies), aritméticos (>, <, >=, <=, =, <>)
- [EMF-042] Navegación de referencias: self.atributo, self.referencia.propiedad
- [EMF-043] oclIsTypeOf, oclIsKindOf, oclAsType
- [EMF-044] Verificación de atributos derivados con OCL
- [EMF-045] Análisis de ciclos en grafos (closure/allSuccessors)
- [EMF-046] UI: panel de validación con lista de errores con localización en canvas
- [EMF-047] Validación en vivo (al editar el modelo, se re-evalúan constraints)

**Criterios de aceptación:**
- Parsear correctamente invariants OCL estándar
- Evaluar restricciones contra modelos y reportar errores precisos
- Soporte completo para operaciones de colección
- Los errores se muestran en la UI con la ubicación exacta del elemento infractor
- Rendimiento aceptable con modelos de hasta 1000 elementos

---

### Sprint 6: Motor de Generación de Código (Acceleo-like)

**Duración:** 3 semanas
**Objetivo:** Crear un sistema de plantillas para generar código/texto a partir de modelos.

**Historias:**
- [EMF-048] Especificar formato de plantillas (sintaxis MTL-like simplificada)
- [EMF-049] Parser de plantillas: leer, validar sintaxis, generar AST
- [EMF-050] Motor de ejecución: bind modelo a plantilla, expandir bucles y condicionales
- [EMF-051] Editor de plantillas con Monaco (resaltado sintaxis, autocompletado)
- [EMF-052] Vista previa en vivo al editar la plantilla
- [EMF-053] Gestor de plantillas (CRUD, versionado dentro del proyecto)
- [EMF-054] Template: generateHTML (documentación del modelo)
- [EMF-055] Template: generateSQL (CREATE TABLE para cada EClass)
- [EMF-056] Template: generateTypescript (interfaces TS)
- [EMF-057] Template: generateJSONSchema
- [EMF-058] Template: generatePlantUML
- [EMF-059] Exportación: descargar archivos generados como ZIP

**Criterios de aceptación:**
- Una plantilla puede iterar sobre EClasses, EAttributes, EReferences
- Los condicionales y bucles funcionan correctamente
- Editor con resaltado sintaxis
- Generación correcta de HTML, SQL, TypeScript, JSON Schema desde un modelo
- Los archivos generados se descargan como ZIP

---

### Sprint 7: Colaboración, UX y Pulido

**Duración:** 2 semanas
**Objetivo:** Mejorar la experiencia de usuario, añadir colaboración y pulir.

**Historias:**
- [EMF-060] Colaboración en tiempo real (WebSocket, operaciones CRDT o similar)
- [EMF-061] Historial de versiones del proyecto (cada 5 min o al guardar)
- [EMF-062] Comparación visual de versiones (diff de modelos)
- [EMF-063] Múltiples pestañas/ventanas: editar modelo y diagrama simultáneamente
- [EMF-064] Temas: claro/oscuro
- [EMF-065] Atajos de teclado (Ctrl+Z, Ctrl+S, Delete, N para nuevo EClass)
- [EMF-066] Autoguardado (cada 30 segundos)
- [EMF-067] Notificaciones de error con tooltips en canvas
- [EMF-068] Vistas: Zoom, minimapa, grid
- [EMF-069] Tutorial interactivo de primeros pasos
- [EMF-070] Internacionalización completa EN/ES

**Criterios de aceptación:**
- Dos usuarios pueden editar el mismo modelo simultáneamente
- Versiones accesibles con capacidad de revertir
- Test suite completa (unit + integration + e2e para flujos críticos)
- Sin bugs conocidos en los flujos principales (Crear metamodelo → Crear modelo → Validar → Generar)

---

### Sprint 8: Avanzado — Integración, CLI, Publicación

**Duración:** 2 semanas
**Objetivo:** Funcionalidades avanzadas y preparación para producción.

**Historias:**
- [EMF-071] Integración con Git (commit/push automático de modelos)
- [EMF-072] CLI (Command Line Interface) para generación headless
  - `emf-web generate --model model.xmi --template template.mtl`
- [EMF-073] API pública REST para integración con CI/CD
- [EMF-074] Webhooks: notificar cuando un modelo cambia o se genera código
- [EMF-075] Plugins: sistema de extensiones para generadores de código personalizados
- [EMF-076] Exportación a formato .ecode de Eclipse (compatibilidad XMI 100%)
- [EMF-077] Importación de proyectos Eclipse existentes (recognize .ecore + .genmodel)
- [EMF-078] Despliegue en producción (Fly.io con dominios, SSL, backup)
- [EMF-079] Documentación de usuario (wiki integrada en la app)
- [EMF-080] Análisis de rendimiento y optimización (carga de modelos grandes 10k+ objetos)

**Criterios de aceptación:**
- CLI instalable via npm y funcional
- API pública documentada con OpenAPI/Swagger
- Compatibilidad de importación/exportación con Eclipse EMF
- Despliegue funcionando en Fly.io con backups automáticos
- Tests de carga con modelos grandes

---

## Anexo A: Glosario

| Término | Definición |
|---------|------------|
| **Ecore** | Metametamodelo que define cómo se construyen los modelos en EMF |
| **EClass** | Clase en un metamodelo (similar a Class en UML) |
| **EAttribute** | Propiedad simple de un EClass (nombre, tipo, cardinalidad) |
| **EReference** | Asociación entre EClasses (puede ser containment o referencia) |
| **EPackage** | Contenedor de clasificadores (EClasses, EDataTypes, EEnums) |
| **M1** | Nivel de modelo (instancias del metamodelo M2) |
| **M2** | Nivel de metamodelo (Ecore M2, instancias de M3) |
| **M3** | Nivel de metametamodelo (Ecore es M3 y también su propio metamodelo) |
| **OCL** | Object Constraint Language, lenguaje de restricciones para modelos |
| **M2M** | Model-to-Model, transformación de modelos a otros modelos |
| **M2T** | Model-to-Text, generación de código/texto desde modelos |
| **XMI** | XML Metadata Interchange, formato estándar de serialización de modelos |
| **Sirius** | Framework para crear workbenches de modelado gráfico |
| **Acceleo** | Motor de generación M2T basado en plantillas |
| **GLSP** | Graphical Language Server Protocol, protocolo para editores de diagramas web |
| **EMOF** | Essential Meta-Object Facility, estándar OMG simplificado que Ecore implementa |

## Anexo B: Referencias y Recursos

- [Eclipse EMF Official Site](https://eclipse.dev/emf/)
- [EMF Wikipedia](https://en.wikipedia.org/wiki/Eclipse_Modeling_Framework)
- [Ecore.ecore (metametamodelo completo)](https://github.com/MDEGroup/CITRIC/blob/master/resources/running_example/metamodels/Ecore.ecore)
- [ecore.js - Ecore en JavaScript](https://emfjson.github.io/ecore.js/)
- [PyEcore - Ecore en Python](https://pyecore.readthedocs.io/)
- [emfjson - JSON for EMF](https://github.com/ghillairet/emfjson)
- [Sirius Web](https://eclipse.dev/sirius/sirius-web.html)
- [GLSP - Graphical Language Server Platform](https://eclipse.dev/glsp/)
- [React Flow](https://reactflow.dev/)
- [Acceleo - M2T Generation](https://eclipse.dev/acceleo/)
- [OpenSpec - Spec-Driven Development](https://intent-driven.dev/knowledge/openspec/)
- [Vogella EMF Tutorial](https://www.vogella.com/tutorials/EclipseEMF/article.html)
- [Eclipse Modeling Project - Full list of subprojects](https://projects.eclipse.org/projects/modeling)
- [Epsilon - EMF model management suite](https://eclipse.org/epsilon/)
- [Eclipse OCL](https://eclipse.dev/ocl/)
