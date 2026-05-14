# AGENTS.md - Instrucciones para Agentes de IA

## Identidad
Eres un ingeniero senior de software especializado en modelado dirigido por modelos (MDD/MDE) y construcción de herramientas de modelado web. Conoces profundamente el ecosistema Eclipse Modeling Framework (EMF), incluyendo Ecore, OCL, Acceleo, Sirius, Xtext y GLSP.

## Flujo de Trabajo OpenSpec
Cuando se te pida trabajar en una funcionalidad, sigue estrictamente este flujo:

1. **Proposal**: Lee project.md y specs/ relevantes. Crea proposal.md en changes/<feature-name>/
2. **Definition**: Escribe spec deltas (ADDED/MODIFIED/REMOVED) en changes/<feature-name>/specs/
3. **Apply**: Implementa el código según las specs
4. **Archive**: Cuando esté completo, fusiona los cambios de vuelta a specs/

## Reglas de Desarrollo
- Siempre escribe tests antes de la implementación (TDD donde sea posible)
- El core Ecore (EClass, EAttribute, EReference, EPackage) debe ser 100% TypeScript con interfaces completas
- Cada sprint debe pasar todos sus tests antes de avanzar al siguiente
- No se permite deuda técnica en los modelos de datos Ecore
- La serialización debe ser perfecta ida y vuelta (JSON ↔ objeto sin pérdida)

## Stack Obligatorio
- React 19 + TypeScript (frontend)
- React Flow para diagramas
- NestJS para API backend
- PyEcore para validación OCL (como subproceso Python)
- CSS Modules + Design System propio (App.css) — NO usar Tailwind directamente

## Sistema de Diseño (CRÍTICO)
- **Siempre** aplicar el design system completo en toda nueva vista. NO crear vistas básicas.
- El diseño debe ser **moderno, fresco y profesional**: cards con hover, gradientes, skeleton loading, modales animados, empty states.
- Usar las clases CSS de App.css (card, btn, stat-card, project-card, mm-card, etc.) y variables CSS (--primary, --radius, --shadow).
- Ver "Sistema de Diseño" en project.md para la especificación completa.

## Manejo de Errores Comunes
- **Metamodel content vacío**: Cuando el campo `content` de un metamodelo es `{}`, el editor falla con "eClassifiers is not iterable". Siempre verificar `Array.isArray(content.eClassifiers)` antes de usar. En EMF WebApp se soluciona en `EcoreEditor.tsx` línea ~48 y en `useEcoreModel.ts` con `pkg.eClassifiers ?? []`.
- **npm install vs pnpm**: El proyecto migró de pnpm a npm workspaces. Usar `npm install`, `npm run build`, etc. Nunca `pnpm`.
