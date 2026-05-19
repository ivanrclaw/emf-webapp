# Plan: Acceleo IDE Profesional

## Objetivo
Transformar el editor de generación de código (actualmente un Monaco de 250px con snippets estáticos) en un IDE profesional completo, a la altura del editor de metamodelos y el resto de la plataforma.

## Estado Actual
- **Editor:** Monaco 250px fijo, minimap off, font 13
- **Syntax highlighting:** Monarch tokenizer custom `emf-mtl` (keywords, tags, strings, operators)
- **Autocompletado:** ~30 snippets estáticos (module, template, for, if, etc.)
- **Motor MTL:** Completo (parser 710 LOC, executor 633 LOC, file manager)
- **Almacenamiento:** 1 template = 1 registro en SQLite (sin proyectos multi-fichero)
- **Output:** Tabs con `<pre>` plano, sin highlighting
- **Carencias:** Sin diagnósticos, sin context-aware completion, sin hover docs, sin live preview, sin file tree, sin shortcuts

---

## Sprint 1: Layout IDE & Gestión Multi-fichero

### Objetivo
Rediseñar la página de CodeGen como un IDE con layout profesional y soporte para proyectos de templates con múltiples ficheros `.mtl`.

### Tareas

#### 1.1 — Layout IDE Split-Pane
- Reemplazar el layout actual (editor arriba, output abajo) por un split-pane redimensionable:
  - **Panel izquierdo:** File Explorer (árbol de ficheros del proyecto)
  - **Panel central:** Editor Monaco (ocupa todo el alto disponible, mínimo 500px)
  - **Panel derecho/inferior (togglable):** Output con tabs
- Usar `react-resizable-panels` (ya usado en otros editores del proyecto o similar)
- Toolbar superior: nombre del proyecto, botones de acción (Generate, Save All, New File, Settings)
- Status bar inferior: línea:columna, lenguaje, errores/warnings count

#### 1.2 — Modelo de datos: Proyectos de Templates
- Nueva entidad `TemplateProject`:
  ```
  id: UUID
  metamodel_id: FK
  name: string
  description: string
  created_at, updated_at
  ```
- Modificar entidad `CodeTemplate` → añadir:
  ```
  project_id: FK (nullable para backward compat)
  filename: string (e.g., "generate.mtl", "common.mtl")
  order: number (para ordenar en el tree)
  ```
- Migración: templates existentes se agrupan en un proyecto "Default" automáticamente

#### 1.3 — File Explorer (Sidebar)
- Árbol de ficheros del proyecto con iconos por tipo (.mtl, .query)
- Acciones: New File, Rename, Delete, Duplicate
- Drag-and-drop para reordenar
- Indicador visual de fichero modificado (dot) y fichero con errores (rojo)
- Doble-click para abrir en editor

#### 1.4 — Sistema de Tabs en el Editor
- Múltiples ficheros abiertos simultáneamente en tabs
- Indicador de cambios sin guardar (dot en tab)
- Ctrl+W cerrar tab, Ctrl+Tab cambiar tab
- Persistir tabs abiertos en localStorage

#### 1.5 — Backend CRUD
- Endpoints: `POST/GET/PUT/DELETE /api/template-projects/:id`
- Endpoints: `POST/GET/PUT/DELETE /api/template-projects/:id/files`
- Endpoint de generación actualizado para ejecutar un proyecto completo (resolviendo imports entre ficheros)

---

## Sprint 2: Autocompletado Context-Aware

### Objetivo
Reemplazar los snippets estáticos por un sistema de autocompletado inteligente que conozca el metamodelo activo y el contexto sintáctico.

### Tareas

#### 2.1 — Metamodel Schema Provider
- Servicio frontend `MetamodelSchemaProvider` que:
  - Carga las clases, atributos, referencias y enums del metamodelo activo
  - Expone un API tipado: `getClasses()`, `getAttributesOf(className)`, `getReferencesOf(className)`, `getEnums()`
  - Se actualiza cuando cambia el metamodelo

#### 2.2 — Type Inference Engine (frontend)
- Mini type-checker que analiza el template y determina:
  - Tipo del parámetro del template actual (`param : EClass` → tipo es EClass)
  - Tipo de variables en `[for (x : Type | ...)]` → x es Type
  - Tipo de variables en `[let v : Type = ...]` → v es Type
  - Tipo de `self` según el contexto
  - Tipo resultado de navegación: `self.departamentos` → Collection(Departamento)
- Basado en el AST del parser existente (reutilizar `MTLParser`)

#### 2.3 — Completion Provider Inteligente
- Reemplazar el `CompletionItemProvider` estático por uno dinámico:
  - **Después de `self.` o `variable.`:** atributos y referencias del tipo inferido
  - **Después de `->`:** operaciones de colección (select, collect, reject, etc.) con signatures
  - **Después de `(`en template/query:** tipos del metamodelo (EClass, EString, etc.)
  - **Dentro de `[for (x : ` :** clases del metamodelo
  - **Después de `[` al inicio de línea:** keywords estructurales (template, for, if, file, etc.)
  - **Dentro de expresiones:** variables en scope + queries definidas + templates invocables
  - **Después de `[import `:** templates disponibles en el proyecto
- Priorización: variables locales > atributos del tipo > operaciones OCL > keywords

#### 2.4 — Signature Help
- Al escribir `->operation(` mostrar tooltip con:
  - Firma completa: `->select(iterator | condition) : Collection(T)`
  - Descripción breve
  - Parámetro activo resaltado
- Para operaciones de string: `substring(startIndex : Integer, endIndex : Integer) : String`

---

## Sprint 3: Diagnósticos en Tiempo Real

### Objetivo
Validar el template mientras se escribe y mostrar errores/warnings inline con squiggly underlines.

### Tareas

#### 3.1 — Diagnostic Engine
- Ejecutar el parser en cada cambio (debounced 300ms)
- Capturar errores de parsing con posición exacta (línea, columna, longitud)
- Clasificar: Error (rojo), Warning (amarillo), Info (azul)
- Tipos de diagnósticos:
  - **Syntax errors:** tag no cerrado, keyword desconocido, paréntesis sin match
  - **Type errors:** acceder a atributo inexistente, tipo incompatible en asignación
  - **Warnings:** variable declarada pero no usada, import no resuelto, template sin `@main`
  - **Info:** template vacío, expresión siempre true/false

#### 3.2 — Monaco Markers Integration
- Usar `monaco.editor.setModelMarkers()` para pintar diagnósticos
- Actualizar markers en cada re-parse
- Panel de "Problems" en la parte inferior (como VS Code) con lista clickable

#### 3.3 — Quick Fixes (Code Actions)
- Para errores comunes, ofrecer fix automático:
  - "Did you mean `nombre`?" para typos en atributos
  - "Add missing `[/for]`" para tags sin cerrar
  - "Import template X" cuando se referencia un template no importado

---

## Sprint 4: Hover Documentation & Go-to-Definition

### Objetivo
Información contextual al pasar el ratón y navegación entre definiciones.

### Tareas

#### 4.1 — Hover Provider
- **Keywords MTL:** hover sobre `[for` → documentación del for loop con ejemplo
- **Operaciones OCL:** hover sobre `->select` → firma + descripción + ejemplo
- **Elementos del metamodelo:** hover sobre `self.nombre` → "nombre : EString (attribute of Empresa)"
- **Variables:** hover sobre variable → tipo inferido + dónde se declaró
- **Queries/Templates:** hover sobre invocación → firma completa + fichero donde se define

#### 4.2 — Go-to-Definition
- Ctrl+Click o F12 sobre:
  - Nombre de query → salta a la definición del query
  - Nombre de template invocado → salta al template (puede ser otro fichero)
  - Variable → salta a su declaración (for/let/parámetro)
  - Import → abre el fichero importado
- Peek Definition (Alt+F12): vista inline sin cambiar de fichero

#### 4.3 — Find All References
- Shift+F12 sobre query/template/variable → lista de todos los usos
- Resaltado de ocurrencias al seleccionar un símbolo

---

## Sprint 5: Editor Features Avanzados

### Objetivo
Bracket matching, auto-close, folding, formatting y demás features de editor profesional.

### Tareas

#### 5.1 — Bracket Matching para Tags MTL
- Matching de `[template ...]` con `[/template]`
- Matching de `[for ...]` con `[/for]`, `[if]` con `[/if]`, etc.
- Highlight visual del par al posicionar cursor en uno de ellos
- Ctrl+Shift+\ para saltar al bracket matching

#### 5.2 — Auto-close Tags
- Al escribir `[template public generate(c : EClass)]` + Enter → insertar `[/template]` automáticamente
- Igual para for, if, file, let, protected
- Configurable (on/off en settings)

#### 5.3 — Code Folding
- Folding regions para cada bloque: template, for, if, file, let, protected, comment
- Fold All / Unfold All en toolbar
- Indicadores visuales en el gutter

#### 5.4 — Formatter
- Indentación automática de bloques anidados
- Alineación de expresiones
- Ctrl+Shift+F para formatear documento completo
- Format on save (opcional)

#### 5.5 — Rename Symbol
- F2 sobre query/template name → renombrar en todas las referencias (cross-file)
- Preview de cambios antes de aplicar

---

## Sprint 6: Output IDE & Live Preview

### Objetivo
Convertir el visor de output en un editor profesional con preview en vivo.

### Tareas

#### 6.1 — Output en Monaco (Read-only)
- Reemplazar `<pre>` por Monaco editor read-only
- Syntax highlighting automático según extensión del fichero generado (.html, .sql, .ts, .java)
- Line numbers, search (Ctrl+F), copy

#### 6.2 — Live Preview (Debounced)
- Generar output automáticamente al modificar el template (debounce 1s)
- Indicador visual: "Generating..." / "Up to date" / "Error"
- Toggle: Live mode ON/OFF (para templates pesados)
- Split horizontal o vertical configurable

#### 6.3 — Diff View
- Comparar output actual vs output anterior (última generación guardada)
- Vista side-by-side o inline (como VS Code diff)
- Útil para verificar que cambios en template producen el output esperado

#### 6.4 — Export Mejorado
- Download fichero individual
- Download All as ZIP (con estructura de carpetas según `[file]` paths)
- Copy to clipboard por fichero
- Botón "Open in new tab" para preview HTML

---

## Sprint 7: Keyboard Shortcuts & Productividad

### Objetivo
Shortcuts profesionales y herramientas de productividad.

### Tareas

#### 7.1 — Shortcuts Core
| Shortcut | Acción |
|----------|--------|
| Ctrl+S | Guardar template actual |
| Ctrl+Shift+S | Guardar todos |
| Ctrl+Enter | Generar output |
| Ctrl+Space | Trigger autocompletado |
| Ctrl+Shift+F | Formatear |
| Ctrl+P | Quick Open (buscar fichero por nombre) |
| Ctrl+Shift+P | Command Palette |
| Ctrl+G | Go to Line |
| Ctrl+W | Cerrar tab |
| Ctrl+Tab | Siguiente tab |
| F5 | Generar y mostrar output |

#### 7.2 — Command Palette
- Ctrl+Shift+P abre palette con todas las acciones disponibles
- Búsqueda fuzzy
- Acciones: New File, Generate, Format, Toggle Live Preview, Toggle Problems Panel, etc.

#### 7.3 — Breadcrumbs
- Barra superior del editor mostrando: `Proyecto > fichero.mtl > template generate > [for ...]`
- Clickable para navegar

#### 7.4 — Minimap Inteligente
- Minimap opcional (toggle) con highlighting de errores/warnings
- Decoraciones para bloques template/file

---

## Sprint 8: Import Resolution & Cross-file Intelligence

### Objetivo
Resolver imports entre ficheros del mismo proyecto y habilitar navegación cross-file.

### Tareas

#### 8.1 — Import Resolver
- Al parsear un fichero con `[import otherModule/]`:
  - Buscar en el proyecto un fichero cuyo `[module]` coincida
  - Cargar sus queries y templates públicos en el scope
  - Mostrar error si el import no se resuelve

#### 8.2 — Cross-file Completions
- Queries y templates de módulos importados aparecen en autocompletado
- Con indicador del fichero de origen: `generate (from common.mtl)`

#### 8.3 — Cross-file Go-to-Definition
- Ctrl+Click en template/query importado → abre el fichero y salta a la definición
- Funciona con el sistema de tabs (abre nueva tab si no está abierto)

#### 8.4 — Circular Import Detection
- Detectar ciclos en el grafo de imports
- Mostrar error con la cadena circular: `A imports B imports C imports A`

#### 8.5 — Generación de Proyecto Completo
- El botón "Generate" ejecuta el proyecto entero:
  1. Resolver orden de dependencias (topological sort)
  2. Parsear todos los ficheros
  3. Ejecutar el template marcado con `@main`
  4. Queries/templates de otros ficheros disponibles vía import
- Errores de ejecución mapeados al fichero/línea de origen

---

## Sprint 9: Template Library & Snippets Avanzados

### Objetivo
Biblioteca de templates reutilizables y sistema de snippets configurable.

### Tareas

#### 9.1 — Template Library
- Panel "Library" con templates predefinidos categorizados:
  - **Structural:** Java classes, TypeScript interfaces, Python dataclasses
  - **Persistence:** SQL DDL, JPA entities, TypeORM entities
  - **Documentation:** HTML docs, Markdown, PlantUML
  - **API:** REST controllers, GraphQL schemas, OpenAPI specs
- One-click para importar un template de la library al proyecto
- Los 5 generadores predefinidos actuales migran aquí

#### 9.2 — User Snippets
- Panel de configuración para definir snippets custom
- Formato: prefix + body + description
- Snippets por proyecto o globales
- Exportar/importar snippets como JSON

#### 9.3 — Template Wizard
- Asistente para crear templates nuevos:
  - Seleccionar clase raíz del metamodelo
  - Elegir patrón (one file per class, single file, etc.)
  - Generar esqueleto del template con estructura básica

---

## Sprint 10: Polish, Testing & Performance

### Objetivo
Optimización, accesibilidad, tests y pulido final.

### Tareas

#### 10.1 — Performance
- Web Worker para el parser (no bloquear UI en templates grandes)
- Debounce inteligente: 300ms para diagnósticos, 1s para live preview
- Lazy loading del Monaco editor
- Virtualización del file tree para proyectos grandes

#### 10.2 — Persistencia & UX
- Auto-save con indicador (cada 5s si hay cambios)
- Undo/Redo a nivel de proyecto (no solo editor)
- Confirmación al cerrar con cambios sin guardar
- Restore session: tabs abiertos, posición del cursor, panel sizes

#### 10.3 — Accesibilidad
- ARIA labels en todos los paneles y controles
- Navegación por teclado completa (file tree, tabs, panels)
- Screen reader support para diagnósticos
- High contrast theme support

#### 10.4 — Tests
- Unit tests para:
  - Type inference engine
  - Completion provider (dado contexto X, sugiere Y)
  - Diagnostic engine (dado template con error, produce marker correcto)
  - Import resolver
- Integration tests:
  - Crear proyecto → añadir ficheros → generar → verificar output
  - Cross-file navigation
- E2E: flujo completo de creación de template hasta generación

#### 10.5 — Documentación Integrada
- Panel "Help" con referencia rápida de sintaxis Acceleo
- Ejemplos interactivos (click para insertar en editor)
- Link a documentación completa

---

## Resumen de Sprints

| Sprint | Nombre | Complejidad | Ficheros Nuevos/Modificados |
|--------|--------|-------------|----------------------------|
| 1 | Layout IDE & Multi-fichero | Alta | ~12 nuevos, ~5 modificados |
| 2 | Autocompletado Context-Aware | Alta | ~4 nuevos, ~2 modificados |
| 3 | Diagnósticos en Tiempo Real | Media-Alta | ~3 nuevos, ~2 modificados |
| 4 | Hover & Go-to-Definition | Media | ~3 nuevos, ~1 modificado |
| 5 | Editor Features Avanzados | Media | ~4 nuevos, ~2 modificados |
| 6 | Output IDE & Live Preview | Media | ~3 nuevos, ~2 modificados |
| 7 | Shortcuts & Productividad | Media-Baja | ~3 nuevos, ~2 modificados |
| 8 | Import Resolution Cross-file | Alta | ~3 nuevos, ~3 modificados |
| 9 | Template Library & Snippets | Media | ~4 nuevos, ~2 modificados |
| 10 | Polish, Testing & Performance | Media | ~8 nuevos, ~5 modificados |

## Dependencias entre Sprints
```
Sprint 1 (Layout) ──────────────────────────────────────┐
    │                                                    │
    ├── Sprint 2 (Autocompletado) ──┐                   │
    │       │                       │                   │
    │       ├── Sprint 3 (Diagnósticos)                 │
    │       │       │                                   │
    │       │       └── Sprint 4 (Hover & GoTo)         │
    │       │                                           │
    │       └── Sprint 8 (Cross-file) ←─────────────────┘
    │                                                    
    ├── Sprint 5 (Editor Features) [independiente]       
    │                                                    
    ├── Sprint 6 (Output IDE) [independiente]            
    │                                                    
    ├── Sprint 7 (Shortcuts) [independiente]             
    │                                                    
    └── Sprint 9 (Library) [independiente tras Sprint 1] 
                                                         
Sprint 10 (Polish) ← todos los anteriores               
```

## Stack Técnico
- **Editor:** Monaco Editor (ya integrado)
- **Layout:** `react-resizable-panels` o similar
- **Parser:** Reutilizar `MTLParser` existente (packages/core)
- **Type System:** Nuevo módulo `packages/core/src/mtl/MTLTypeChecker.ts`
- **Language Service:** Nuevo `packages/frontend/src/lib/mtl-language-service/`
- **Worker:** Web Worker para parsing off-thread
- **State:** Zustand store para estado del IDE (tabs, files, diagnostics)
