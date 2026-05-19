# Plan: IDE de Generación de Código — Drop-in Replacement de Acceleo

**Fecha**: 2026-05-18
**Proyecto**: emf-webapp
**Objetivo**: Convertir el IDE de generación de código en un reemplazo completo de Eclipse Acceleo

---

## Estado Actual (ya implementado)

- Parser MTL completo (module, import, template con guard/overrides/post, query, file, for, if, let, trace, protected, comment)
- Executor con expresiones OCL-like, navegación, métodos built-in, arrow operations (->select, ->collect, ->forAll, ->exists, ->sortedBy, etc.)
- Monaco con syntax highlighting, completions contextuales, diagnósticos, hover, go-to-definition, folding, formatting
- File explorer (plano, sin carpetas), multi-tab, output panel con diff view
- Backend CRUD + pipeline de generación con resolución de imports
- Auto-save (5s), live preview (1.5s debounce), command palette, template library, snippets, wizard
- ImportResolver cross-file (módulos por nombre, templates/queries públicos)
- DiagnosticEngine con 8 reglas (MTL001-MTL201)
- 22 acciones en el reducer (useIDEStore)
- Keyboard shortcuts: Ctrl+S, Ctrl+Enter/F5, Ctrl+Shift+P, Ctrl+P, Ctrl+W, Ctrl+Tab, F1

---

## FASE 1 — Bugs y UX Básica

### 1.1 Prohibir nombres de archivo duplicados
- **Frontend**: Validación en ADD_FILE y RENAME_FILE del reducer
- **Backend**: Validación en POST `/files` y PUT `/files/:fid`
- **UX**: Toast/error inline si el nombre ya existe en el mismo directorio
- **Archivos**: `useIDEStore.ts`, `CodeGenIDE.tsx`, `FileExplorer.tsx`, `template-project.controller.ts`

### 1.2 Soporte de carpetas/subcarpetas
- Cambiar modelo de `filename: string` a `path: string` (ej: `common/utils.mtl`)
- FileExplorer → árbol jerárquico con expand/collapse
- Operaciones: crear carpeta, mover archivos entre carpetas, drag & drop
- Resolución de imports por path cualificado (`common::utils` → `common/utils.mtl`)
- Backend: almacenar path completo en `code_templates.filename`
- Context menu: "New Folder", "Move to..."
- **Archivos**: `FileExplorer.tsx` (rewrite mayor), `useIDEStore.ts`, `template-project.controller.ts`, `template-project.service.ts`, `ImportResolver.ts`

### 1.3 Scaffolding inicial (main.mtl por defecto)
- Al crear un nuevo proyecto, generar automáticamente un `main.mtl` con:
  - `[comment encoding = UTF-8 /]`
  - `[module main('METAMODEL_URI')/]` — URI del metamodelo actual
  - `[comment @main /]`
  - Template `main` con parámetro del tipo raíz del metamodelo
  - Template ejemplo `generateFile` con `[file]` block
- Detectar tipo raíz del metamodelo (primer EPackage o EClass sin eContainer)
- **Archivos**: `template-project.service.ts` (método createProject), `CodeGenIDE.tsx` (nuevo proyecto flow)

---

## FASE 2 — Sistema de Módulos Completo

### 2.1 Import resolution por path cualificado
- `[import common::utils /]` → busca `common/utils.mtl` en el proyecto
- Soporte de `::` como separador de paquetes (mapea a `/` en el filesystem)
- Fallback: buscar por nombre de módulo (declaración `[module X/]`)
- Validación: import no encontrado → diagnostic MTL104
- **Archivos**: `ImportResolver.ts`, `MTLDiagnosticEngine.ts`, `template-project.service.ts`

### 2.2 Extends (herencia de módulos)
- Parser: ya soporta `extends` en la declaración de módulo ✓
- Executor: resolver cadena de herencia, buscar templates en módulo padre
- Override resolution: módulo hijo > módulo padre (por orden de declaración)
- `[super.templateName()/]` para llamar al template del padre
- Detección de ciclos en herencia
- **Archivos**: `MTLExecutor.ts`, `MTLParser.ts` (verificar), `ImportResolver.ts`

### 2.3 Visibilidad (public/protected/private)
- Enforcement en el executor: imports solo acceden a `public`, extends accede a `public` + `protected`
- Diagnósticos: error si se intenta usar un template `private` desde otro módulo
- Completions: filtrar por visibilidad según contexto (import vs extends vs mismo módulo)
- **Archivos**: `MTLExecutor.ts`, `MTLDiagnosticEngine.ts`, `MTLCompletionProvider.ts`

### 2.4 Query caching
- Cache por argumentos (key = query name + serialized args)
- Invalidar cache al inicio de cada generación
- Verificar implementación actual y completar si es parcial
- **Archivos**: `MTLExecutor.ts`

---

## FASE 3 — Motor de Generación Avanzado

### 3.1 File blocks completos
- Modos: `overwrite` (default), `append`, `create` (solo genera si no existe)
- Path expressions con subdirectorios (crear automáticamente en output)
- Encoding configurable por archivo (3er parámetro del [file])
- Contadores: Files generated, Lost files (archivos que ya no se generan)
- **Archivos**: `MTLExecutor.ts`, `MTLFileManager.ts`, `OutputPanel.tsx`

### 3.2 Protected areas (preservación de código manual)
- Al regenerar: leer archivo existente del output previo
- Extraer contenido entre marcadores `// Start of user code ID` / `// End of user code`
- Merge: sustituir solo las partes fuera de protected areas
- Marcadores configurables por lenguaje:
  - Java/TS/JS: `// Start of user code` / `// End of user code`
  - Python: `# Start of user code` / `# End of user code`
  - HTML/XML: `<!-- Start of user code -->` / `<!-- End of user code -->`
- Almacenar output previo en backend para comparación
- **Archivos**: `MTLExecutor.ts`, `MTLFileManager.ts`, `template-project.service.ts`

### 3.3 Post-treatment en templates
- `post(trim())`, `post(self.replaceAll(...))` etc.
- Aplicar transformación al output completo del template antes de escribir
- Parser: ya soporta `post` en template declaration ✓
- Executor: evaluar expresión post con `self` = output string
- **Archivos**: `MTLExecutor.ts`

### 3.4 Template guards y dispatch polimórfico
- Múltiples templates con misma firma pero diferentes guards
- Ejecutar el primero cuya guard sea true (orden de declaración)
- Ya parcialmente implementado — verificar edge cases:
  - Guard con expresiones complejas (navegación, comparación)
  - Guard que referencia parámetros del template
  - Fallback cuando ninguna guard es true
- **Archivos**: `MTLExecutor.ts`

### 3.5 Properties files
- Soporte de archivos `.properties` en el proyecto (key=value)
- `getProperty('key')` en expresiones MTL
- `getProperty('filename', 'key')` para archivo específico
- `getProperty('key', Sequence{params})` para interpolación
- Editor de properties integrado (Monaco con language 'properties')
- **Archivos**: `MTLExecutor.ts`, `EditorPanel.tsx`, `useIDEStore.ts`

---

## FASE 4 — Live Preview Avanzado

### 4.1 Preview multi-formato
- **HTML**: renderizar en iframe sandbox (preview real del HTML generado)
- **PlantUML**: renderizar diagrama via kroki.io API
- **Markdown**: renderizar con marked (ya disponible en el proyecto)
- **SVG**: renderizar inline en un contenedor
- **JSON**: syntax highlighting + tree view colapsable (react-json-view o similar)
- **XML**: syntax highlighting + tree view
- **SQL**: syntax highlighting + schema visualization básica
- **Java/TypeScript/Python/etc**: syntax highlighting en Monaco (ya funciona)
- **Archivos**: `OutputPanel.tsx` (nuevo componente PreviewRenderer)

### 4.2 Preview split view
- Panel de output con tabs: "Code" | "Preview" | "Diff"
- Selector de formato preview (auto-detect por extensión del [file])
- Para multi-file output: preview del archivo seleccionado
- Toggle entre code view y rendered preview
- **Archivos**: `OutputPanel.tsx`

### 4.3 Multi-file output tree
- Árbol de archivos generados (refleja la estructura de [file] blocks)
- Click en archivo → muestra su contenido + preview
- Indicadores: nuevo (🟢), modificado (🟡), sin cambios (⚪), error (🔴)
- Comparación con generación anterior
- **Archivos**: `OutputPanel.tsx` (nuevo componente OutputFileTree)

---

## FASE 5 — Validación y Diagnósticos Avanzados

### 5.1 Type checking contra metamodelo
- Inferir tipo de cada expresión en la cadena de navegación
- Error si se accede a un atributo/referencia que no existe en el EClass
- Warning si el tipo no puede resolverse (ambiguo)
- Soporte de `oclAsType(Type)` para casts explícitos
- Soporte de `oclIsKindOf(Type)` / `oclIsTypeOf(Type)` en guards
- **Archivos**: `MTLTypeInference.ts`, `MTLDiagnosticEngine.ts`, `MetamodelSchemaProvider.ts`

### 5.2 Validación cross-file
- Verificar que todos los imports resuelven a módulos existentes
- Verificar que templates/queries referenciados existen y son accesibles (visibilidad)
- Verificar compatibilidad de tipos en llamadas cross-module
- Verificar que `extends` apunta a un módulo válido
- **Archivos**: `MTLDiagnosticEngine.ts`, `ImportResolver.ts`

### 5.3 Validación de expresiones OCL
- Verificar operaciones válidas por tipo (no llamar `toLower()` en un Integer)
- Verificar aridad de llamadas a templates/queries
- Verificar tipos de parámetros en llamadas
- Verificar que iteradores (->select, ->collect) reciben lambda con tipo correcto
- **Archivos**: `MTLDiagnosticEngine.ts`, `MTLTypeInference.ts`

---

## FASE 6 — Experiencia de Editor Avanzada

### 6.1 Refactoring
- Rename symbol (template/query) across all files del proyecto
- Extract template (selección → nuevo template con parámetros inferidos)
- Wrap in if/for/let/protected (selección → envolver en bloque)
- **Archivos**: Nuevos providers en `language/`

### 6.2 Outline/Structure view
- Panel lateral con árbol de módulo: imports, templates, queries
- Click → navegar al símbolo
- Iconos por visibilidad (🟢 public, 🟡 protected, 🔴 private)
- Actualización en tiempo real al editar
- **Archivos**: Nuevo componente `OutlinePanel.tsx`

### 6.3 Breadcrumbs
- Mostrar path de contexto: Module > Template > For > If
- Clickable para navegar al bloque padre
- **Archivos**: `EditorPanel.tsx` (Monaco breadcrumbs API)

### 6.4 Find all references
- Buscar todos los usos de un template/query en el proyecto
- Resultados en panel con preview de línea
- **Archivos**: Nuevo provider `MTLReferenceProvider.ts`

---

## FASE 7 — Debugging y Traceability

### 7.1 Traceability view
- Después de generar: mapear cada región del output al template + elemento del modelo que la produjo
- Click en output → highlight en editor del template source
- Click en elemento del modelo → highlight en output
- Almacenar trace info durante ejecución
- **Archivos**: `MTLExecutor.ts` (trace collection), nuevo componente `TraceabilityPanel.tsx`

### 7.2 Step-through debugging
- Breakpoints en líneas del template (click en gutter)
- Ejecución paso a paso: Step Into, Step Over, Continue
- Panel de variables: ver valores de parámetros y variables locales en cada paso
- Panel de "Block Output": ver texto generado hasta el momento
- Implementación: ejecutor con modo "debug" que yield en cada statement
- **Archivos**: `MTLExecutor.ts` (generator/async mode), nuevo componente `DebugPanel.tsx`

### 7.3 Generation console
- Log de ejecución: qué templates se ejecutaron, qué archivos se generaron
- Contadores: Files generated, Lost files, Errors, Warnings
- Tiempo de ejecución por template
- Expandible: ver detalle de cada paso
- **Archivos**: `OutputPanel.tsx` (nueva tab "Console")

---

## FASE 8 — Funcionalidades Complementarias

### 8.1 Profiling/Coverage
- Highlight de líneas ejecutadas (verde) vs no ejecutadas (rojo) en el editor
- Porcentaje de cobertura por template
- Decoraciones Monaco para mostrar coverage
- **Archivos**: `MTLExecutor.ts` (coverage tracking), `EditorPanel.tsx` (decorations)

### 8.2 Template documentation
- Soporte de `[** ... /]` doc-comments antes de templates/queries
- Mostrar en hover y en completions
- Tags: `@param`, `@author`, `@since`, `@version`
- **Archivos**: `MTLParser.ts`, `MTLHoverProvider.ts`, `MTLCompletionProvider.ts`

### 8.3 Incremental generation
- Detectar qué elementos del modelo cambiaron (diff con modelo anterior)
- Regenerar solo los archivos afectados por esos elementos
- Cache de resultados de templates por elemento
- **Archivos**: `MTLExecutor.ts`, `template-project.service.ts`

### 8.4 Export/Import de proyectos
- Exportar proyecto como .zip (estructura de carpetas + .mtl files + .properties)
- Importar proyecto Acceleo existente (.mtl files → crear proyecto + archivos)
- Mapear estructura de carpetas a paths
- **Archivos**: `template-project.controller.ts` (endpoints export/import), nuevo servicio

---

## Priorización

| Fase | Esfuerzo | Impacto | Prioridad |
|------|----------|---------|-----------|
| 1    | Bajo     | Alto    | Inmediata |
| 2    | Medio    | Alto    | Alta      |
| 3    | Alto     | Alto    | Alta      |
| 4    | Medio    | Alto    | Alta      |
| 5    | Medio    | Medio   | Media     |
| 6    | Medio    | Medio   | Media     |
| 7    | Alto     | Medio   | Baja      |
| 8    | Alto     | Bajo    | Baja      |

**Fases 1-4** = reemplazo funcional de Acceleo (generación completa)
**Fases 5-8** = experiencia de desarrollo profesional (IDE completo)

---

## Referencia Técnica: Sintaxis Acceleo Completa

### Estructura de módulo
```mtl
[comment encoding = UTF-8 /]
[module moduleName('http://metamodel/URI') extends parentModule/]
[import qualified::module::name /]
```

### Templates
```mtl
[template visibility name(param : Type) ? (guard) post (postExpr) overrides parentTemplate]
  body con [expresiones/] inline
[/template]
```

### Queries
```mtl
[query visibility name(param : Type) : ReturnType = expression /]
```

### File blocks
```mtl
[file (pathExpr, mode, 'encoding')]
  contenido del archivo
[/file]
```
Modos: `overwrite` | `append` | `create` (Acceleo 4) / `false` | `true` (Acceleo 3)

### Control flow
```mtl
[for (var : Type | collection)]...[/for]
[for (var : Type | collection) separator(', ')]...[/for]
[for (var : Type | collection) before('(') separator(', ') after(')')]...[/for]
[if (condition)]...[elseif (cond)]...[else]...[/if]
[let var : Type = expr]...[/let]
```

### Protected areas
```mtl
[protected ('unique-id')]
  // default content (preserved on regeneration)
[/protected]
```

### Operaciones String
size, substring, first, last, index, lastIndex, contains, startsWith, endsWith,
matches, replace, replaceAll, substitute, substituteAll, toLower, toUpper,
toLowerFirst, toUpperFirst, trim, tokenize, concat, prefix, toInteger, toReal,
isAlpha, isAlphaNum, strcmp, equalsIgnoreCase

### Operaciones Collection
select, reject, filter, any, exists, forAll, one, isUnique, includes, excludes,
includesAll, excludesAll, isEmpty, notEmpty, at, first, last, indexOf, size,
collect, collectNested, sortedBy, reverse, flatten, asSequence, asOrderedSet,
asSet, asBag, including, excluding, union, intersection, prepend, insertAt, sep

### Navegación EObject
eContainer, eContainer(Type), eContainerOrSelf(Type), eContents, eContents(Type),
eAllContents, eAllContents(Type), eInverse, eInverse(feature), eInverse(Type),
eClass, eGet(feature), eCrossReferences, eContainingFeature, ancestors,
ancestors(Type), siblings, followingSiblings, precedingSiblings

### OCL Type Operations
oclIsKindOf(Type), oclIsTypeOf(Type), oclAsType(Type), oclIsUndefined, allInstances

### Non-standard (Acceleo 3)
invoke(className, methodSig, args), getProperty(key), getProperty(file, key),
current(index), current(Type)
