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

|## Convenciones
|- TypeScript estricto en todo el frontend
|- Tests unitarios para todo el core Ecore
|- i18n para todas las strings visibles (ES principal, EN secundario)
|- Commits convencionales (feat:, fix:, docs:, chore:)
|- Desarrollo spec-driven con OpenSpec

## Sistema de Diseño (Obligatorio)
El diseño visual debe ser **moderno, fresco y profesional** en toda la plataforma.

### Principios de Diseño
- **Clean UI**: Espacio amplio, tipografía clara (Inter), bordes redondeados consistentes (12px cards, 8px botones)
- **Gradientes sutiles**: Usar gradientes lineales (primary→dark, accent→teal, success→green) en tarjetas de estadísticas
- **Feedback visual**: Hover effects con translateY(-2px), sombras suaves, bordes coloreados
- **Consistencia**: Mismo sistema de colores, espaciado y tipografía en todas las vistas
- **Animaciones ligeras**: fadeIn y slideUp para modales, skeleton loading para estados de carga
- **Paleta**: Indigo (#4f46e5) como primary, Cyan (#06b6d4) como accent, fondo gris claro (#f1f5f9)

### Componentes UI Requeridos
- **Header**: Sticky con backdrop-filter blur(12px), logo con gradiente, navegación clara
- **Stats Cards**: 3-4 cards con gradientes mostrando métricas clave
- **Project Cards**: Cards con hover effect, borde izquierdo de acento al hacer hover
- **Metamodel Cards**: Cards con nombre monoespaciado, badges de nsPrefix, acciones inline
- **Empty States**: Icono + título + descripción + CTA
- **Skeleton Loading**: Animación shimmer mientras cargan datos
- **Modales**: Overlay con backdrop-filter blur, panel slideUp con sombra XL
- **Botones**: Variantes primary (indigo), secondary (outline), ghost (transparente), danger (rojo)
- **Formularios**: Labels sobre inputs, focus ring con box-shadow, placeholder estilizados
- **Badges**: Para estados y contadores
- **Tablas**: Clean sin bordes verticales, hover en filas, th uppercase

### Referencia de Estilos
Los estilos se definen en `App.css` con variables CSS en :root. NO usar Tailwind directamente — usar las clases CSS del design system (.card, .btn, .btn-primary, .stat-card, .project-card, .mm-card, etc.) y las variables CSS (--primary, --text-secondary, --shadow, --radius, etc.).

### NUNCA usar diseños básicos por defecto
Siempre aplicar el design system completo en cada nueva vista o componente. No hay excusa para vistas sin diseño profesional.

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
