# Propuesta: Sprint 1 — Fundación Core Ecore

## Motivación
Establecer las bases sobre las que se construirá toda la aplicación. Sin un core Ecore sólido, el resto de funcionalidades no pueden existir.

## Alcance
1. Implementar el metametamodelo Ecore completo en TypeScript
2. Serialización JSON y XMI
3. API REST para proyectos y metamodelos
4. Persistencia SQLite

## Tareas
- [EMF-001] Definir interfaces TypeScript del metametamodelo Ecore
- [EMF-002] Implementar EObject con API reflexiva
- [EMF-003] Implementar EPackage y gestión de EClassifiers
- [EMF-004] Implementar resolución de referencias (eOpposite, eSuperTypes)
- [EMF-005] Propiedades derivadas (eAllAttributes, eAllReferences, eAllSuperTypes)
- [EMF-006] Serialización JSON
- [EMF-007] Serialización XMI
- [EMF-008] Backend NestJS con CRUD de proyectos y metamodelos
- [EMF-009] Persistencia SQLite con TypeORM
- [EMF-010] Tests unitarios completos del core

## Diseño Técnico
- Monorepo con Turborepo + pnpm
- `packages/core`: librería Ecore TypeScript compartida
- `packages/backend`: NestJS con módulos Project, Metamodel
- `packages/frontend`: React + Vite (básico, solo interfaz de listado)
- Tests: Vitest para core, Supertest para API

## No Incluye
- Editor visual de diagramas
- Editor de instancias
- Validación OCL
- Generación de código
- Interfaz gráfica más allá de listados básicos
