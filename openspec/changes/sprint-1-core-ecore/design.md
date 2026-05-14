# Diseño: Sprint 1 — Core Ecore

## Estructura del Monorepo
```
emf-webapp/
├── packages/
│   ├── core/                    # Librería compartida Ecore
│   │   ├── src/
│   │   │   ├── ecore/           # Implementación del metametamodelo
│   │   │   │   ├── EObject.ts
│   │   │   │   ├── EClass.ts
│   │   │   │   ├── EAttribute.ts
│   │   │   │   ├── EReference.ts
│   │   │   │   ├── EPackage.ts
│   │   │   │   ├── EEnum.ts
│   │   │   │   ├── EDataType.ts
│   │   │   │   ├── EAnnotation.ts
│   │   │   │   ├── EOperation.ts
│   │   │   │   ├── EFactory.ts
│   │   │   │   ├── EGenericType.ts
│   │   │   │   └── index.ts
│   │   │   ├── serialization/   # Serialización
│   │   │   │   ├── JSONSerializer.ts
│   │   │   │   ├── XMISerializer.ts
│   │   │   │   └── index.ts
│   │   │   ├── util/            # Utilidades
│   │   │   │   ├── URIParser.ts
│   │   │   │   ├── EList.ts
│   │   │   │   └── Notification.ts
│   │   │   └── index.ts
│   │   ├── tests/
│   │   │   ├── ecore/
│   │   │   │   ├── EObject.test.ts
│   │   │   │   ├── EClass.test.ts
│   │   │   │   ├── EPackage.test.ts
│   │   │   │   ├── EReference.test.ts
│   │   │   │   ├── herencia.test.ts
│   │   │   │   └── serialization.test.ts
│   │   │   └── fixtures/
│   │   └── package.json
│   ├── backend/                 # NestJS API
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── project/
│   │   │   │   │   ├── project.controller.ts
│   │   │   │   │   ├── project.service.ts
│   │   │   │   │   └── project.entity.ts
│   │   │   │   └── metamodel/
│   │   │   │       ├── metamodel.controller.ts
│   │   │   │       ├── metamodel.service.ts
│   │   │   │       └── metamodel.entity.ts
│   │   │   ├── app.module.ts
│   │   │   └── main.ts
│   │   └── package.json
│   └── frontend/                # React (básico)
│       ├── src/
│       │   ├── pages/
│       │   └── App.tsx
│       └── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

## Diagrama de Clases del Core

```
┌─────────────────────┐
│ <<interface>>       │
│ EObject             │
├─────────────────────┤
│ eClass(): EClass    │
│ eGet(feature): any  │
│ eSet(feature, val)  │
│ eContainer(): EObj  │
│ eContents(): EObj[] │
│ eAllContents(): Gen │
└─────────┬───────────┘
          │ implements
┌─────────▼───────────┐
│ EObjectImpl         │ (abstract base)
└─────────┬───────────┘
          │ extends
┌─────────▼───────────┐
│ EModelElementImpl   │ ← eAnnotations: EAnnotation[]
└─────────┬───────────┘
          │ extends
┌─────────▼───────────┐
│ ENamedElementImpl   │ ← name: string
└─────────┬───────────┘
          │ extends
┌─────────┴──────────────┐
│                        │
┌────────▼───┐   ┌───────▼────────┐
│EClassifier │   │ ETypedElement   │
│ (abstract) │   │ (abstract)      │
└───────┬────┘   └───────┬────────┘
        │                 │
┌───────▼──────┐  ┌──────▼───────────┐
│ EClass       │  │EStructuralFeature│
│ EDataType    │  │ (abstract)       │
│ EEnum        │  └──────┬───────────┘
└──────────────┘    ┌────┴──────┐
                    │           │
              ┌─────▼──┐  ┌────▼──────┐
              │EAttr.  │  │EReference │
              └────────┘  └───────────┘
```

## Flujo de Serialización JSON

```
EObject → serialize(obj)
  ↓
Crear objeto plano
  ├── eClass: string (URI fragment)
  ├── [propiedades EAttribute]: valor (string, number, boolean)
  ├── [propiedades EReference containment]: array de objetos serializados
  └── [propiedades EReference no-containment]: array de strings (URI fragments)
  ↓
JSON.stringify(resultado)
```

## API Endpoints Detallados

```
GET    /api/projects                    # Listar proyectos (paginado)
POST   /api/projects                    # Crear proyecto { name, description }
GET    /api/projects/:id                # Obtener proyecto
PUT    /api/projects/:id                # Actualizar proyecto
DELETE /api/projects/:id                # Eliminar proyecto

GET    /api/projects/:pid/metamodels    # Listar metamodelos
POST   /api/projects/:pid/metamodels    # Crear metamodelo { name, nsURI, nsPrefix, content }
GET    /api/projects/:pid/metamodels/:mmid  # Obtener metamodelo
PUT    /api/projects/:pid/metamodels/:mmid  # Actualizar metamodelo
DELETE /api/projects/:pid/metamodels/:mmid  # Eliminar metamodelo
POST   /api/projects/:pid/metamodels/:mmid/export  # Exportar { format: 'json' | 'xmi' }
```

## Persistencia SQLite

Tabla `projects`:
- id: UUID (PK)
- name: VARCHAR(255) NOT NULL
- description: TEXT
- created_at: TIMESTAMP DEFAULT NOW()
- updated_at: TIMESTAMP DEFAULT NOW()

Tabla `metamodels`:
- id: UUID (PK)
- project_id: UUID (FK → projects.id)
- name: VARCHAR(255) NOT NULL
- ns_uri: VARCHAR(500)
- ns_prefix: VARCHAR(100)
- content: JSONB (el EPackage serializado)
- created_at: TIMESTAMP
- updated_at: TIMESTAMP

## Tests

### Unit Tests (Core)
- Crear EPackage y verificar nombre, nsURI, nsPrefix
- Crear EClass y verificar nombre, abstract
- Añadir EAttribute a EClass y verificar eStructuralFeatures
- Añadir EReference a EClass y verificar tipo, containment
- eAllAttributes con herencia simple y múltiple
- eAllReferences con herencia
- eAllSuperTypes recorrido DFS
- eIDAttribute con herencia
- eContainer y eContents para containment
- Serialización JSON ida y vuelta (objeto → JSON → objeto)
- Serialización XMI básica

### Integration Tests (API)
- Crear proyecto → 201 + location header
- Obtener proyecto por ID → 200 + proyecto
- Listar proyectos vacío → 200 + []
- Crear metamodelo en proyecto → 201
- Obtener metamodelo con contenido Ecore
- Exportar metamodelo a JSON
- Eliminar proyecto elimina metamodelos en cascada
- 404 para IDs inexistentes
- Validar campos requeridos → 400
