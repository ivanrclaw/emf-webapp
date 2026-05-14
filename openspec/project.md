# Proyecto: emf-webapp

## Visión General
Reconstrucción de Eclipse Modeling Framework (EMF) como una aplicación web moderna, permitiendo la creación visual de metamodelos .ecore, modelos M1, sintaxis gráfica Sirius-like y generación de código Acceleo-like.

## Stack Tecnológico

**Frontend:**
- React 19 + TypeScript + Vite
- React Flow (xyflow) para diagramas nodo-enlace
- Monaco Editor para edición de código/plantillas
- Tailwind CSS 4 + shadcn/ui
- Zustand para estado global
- TanStack React Query para datos servidor
- react-i18next (EN/ES)

**Backend:**
- Node.js + NestJS
- Python (PyEcore) para validación OCL y parsing XMI
- SQLite/PostgreSQL con TypeORM
- WebSocket (Socket.IO) para colaboración
- JWT para autenticación

**Despliegue:**
- Fly.io (basado en experiencia previa)

## Arquitectura
Cliente-Servidor. El frontend maneja la edición visual interactiva (canvas React Flow). El backend maneja operaciones pesadas: validación OCL, generación de código, parsing XMI completo, persistencia. Comunicación vía REST API + WebSocket.

## Directorio del Proyecto
`~/projects/emf-webapp/`

## Convenciones
- TypeScript estricto en todo el frontend
- Tests unitarios para todo el core Ecore
- i18n para todas las strings visibles (ES principal, EN secundario)
- Commits convencionales (feat:, fix:, docs:, chore:)
- Desarrollo spec-driven con OpenSpec

## Fases
8 sprints incrementales (~20 semanas total):
1. Fundación: Core Ecore + Persistencia
2. Editor Visual de Metamodelos
3. Editor de Modelos (Instancias M1)
4. Editor de Sintaxis Gráfica (Sirius-like)
5. Motor de Validación OCL
6. Motor de Generación de Código
7. Colaboración, UX y Pulido
8. Avanzado: Integración, CLI, Publicación
