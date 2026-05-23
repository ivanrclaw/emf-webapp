# Model Editor Rework — Plan Profesional

## Estado Actual

El editor de modelos (`ModelEditor.tsx`) tiene una base funcional pero está lejos del nivel profesional del resto de la plataforma:

**Lo que funciona:**
- Layout 3 columnas (Palette | Canvas | Property Inspector)
- Nodos renderizados según NodeMapping styles (6 shapes, conditional styles)
- Edges con routing, spreading, markers SVG, labels
- Palette generada desde ToolSections del VSM
- Layer toggle en toolbar
- Auto-save cada 30s
- Export JSON/XMI básico

**Lo que falta o es deficiente:**
- Property Inspector es un listado crudo de inputs sin contexto
- No hay inline editing (doble-click para renombrar)
- No hay context menu (click derecho)
- No hay undo/redo
- No hay drag-from-palette (solo click-to-create, aparece en posición random)
- No hay Object Explorer / Outline view
- No hay status bar con info del modelo
- No hay breadcrumb de navegación
- No hay multi-select ni operaciones en lote
- Containers no contienen hijos visualmente (solo placeholder)
- No hay alignment/distribution tools
- No hay grid snapping configurable
- No hay copy/paste de elementos
- No hay zoom-to-fit / zoom-to-selection
- No hay validación del modelo contra el metamodel
- No hay indicadores visuales de errores/warnings
- Toolbar es un simple row de botones sin estructura
- No hay search/filter de elementos

---

## Sprint 1 — Toolbar Profesional + Status Bar + Undo/Redo

**Objetivo:** Dar al editor una barra de herramientas estructurada y un sistema de historial.

### Tareas:
1. **EditorToolbar** — Barra superior con secciones agrupadas:
   - Navegación: breadcrumb (Project > Metamodel > Model)
   - Acciones: Save, Undo, Redo, Export (dropdown JSON/XMI/SVG)
   - View: Zoom In/Out, Fit View, Toggle Grid, Toggle Minimap
   - Edit: Delete, Duplicate, Select All
   - Layers: toggle chips (ya existe, integrar mejor)
   - Status: save indicator, object count

2. **useModelHistory** hook — Undo/redo stack:
   - Basado en el patrón de `useSpecHistory` del SpecEditor
   - Debounce 300ms para cambios rápidos
   - Max 50 entries
   - Ctrl+Z / Ctrl+Shift+Z shortcuts

3. **EditorStatusBar** — Barra inferior:
   - Zoom level (clickable para reset)
   - Object count: "12 nodes, 8 edges"
   - Selection info: "Selected: Employee (NodeMapping)"
   - Validation summary: "⚠ 2 warnings"
   - Grid snap toggle + size

### Archivos:
- `components/model-editor/EditorToolbar.tsx` (nuevo)
- `components/model-editor/EditorStatusBar.tsx` (nuevo)
- `components/model-editor/hooks/useModelHistory.ts` (nuevo)
- `pages/ModelEditor.tsx` (refactor layout)

---

## Sprint 2 — Property Inspector Profesional

**Objetivo:** Transformar el inspector de propiedades en un panel tipo Eclipse Properties View.

### Tareas:
1. **Tabs en el inspector:**
   - Properties: atributos editables con tipos correctos
   - References: lista de referencias con links navegables
   - Style: override visual (si el VSM lo permite)
   - Semantic: eClass, id, containment info

2. **Typed attribute editors:**
   - EString → TextInput
   - EInt/EFloat → NumberInput con validación
   - EBoolean → Toggle switch
   - EEnum → Select dropdown con valores del enum
   - EDate → Date picker
   - Multi-valued → Lista editable con add/remove

3. **Reference editor:**
   - Lista de referencias salientes con target clickable
   - Botón para crear nueva referencia (abre connect mode)
   - Botón para eliminar referencia
   - Drag-reorder para referencias ordenadas

4. **Metamodel-aware validation:**
   - Campos required marcados con *
   - Validación de tipos en tiempo real
   - Multiplicidad (lowerBound/upperBound) enforced
   - Error indicators inline

5. **Header mejorado:**
   - Icono del shape + color del mapping
   - Nombre editable inline
   - Badge con eClass
   - Botón delete

### Archivos:
- `components/model-editor/VsmPropertyInspector.tsx` (rewrite completo)
- `components/model-editor/PropertyTabs.tsx` (nuevo)
- `components/model-editor/editors/AttributeEditor.tsx` (nuevo)
- `components/model-editor/editors/ReferenceEditor.tsx` (nuevo)

---

## Sprint 3 — Inline Editing + Context Menu

**Objetivo:** Interacción directa con los elementos del canvas.

### Tareas:
1. **Double-click to edit:**
   - Double-click en nodo → input overlay sobre el label
   - Enter para confirmar, Escape para cancelar
   - Respeta DirectEditTool constraints del VSM
   - Animación suave de transición

2. **Context menu (click derecho):**
   - En nodo: Rename, Delete, Duplicate, Copy Style, Paste Style
   - En edge: Delete, Reverse Direction, Change Style
   - En canvas: Paste, Create (submenu con tools disponibles), Select All, Fit View
   - Separadores lógicos entre grupos
   - Keyboard shortcuts mostrados a la derecha
   - Iconos por acción

3. **Keyboard shortcuts completos:**
   - Delete/Backspace: eliminar selección
   - Ctrl+D: duplicar
   - Ctrl+A: select all
   - Ctrl+C/V: copy/paste (con offset)
   - F2: rename (inline edit)
   - Escape: deselect
   - Ctrl+Z/Shift+Ctrl+Z: undo/redo

4. **Multi-select:**
   - Shift+click para añadir a selección
   - Rubber-band selection (drag en canvas vacío)
   - Operaciones en lote: delete, move, align

### Archivos:
- `components/model-editor/InlineEditor.tsx` (nuevo)
- `components/model-editor/ContextMenu.tsx` (nuevo)
- `components/model-editor/hooks/useKeyboardShortcuts.ts` (nuevo)
- `components/model-editor/hooks/useClipboard.ts` (nuevo)
- `pages/ModelEditor.tsx` (integrar)

---

## Sprint 4 — Palette Mejorada + Drag-to-Canvas

**Objetivo:** Palette profesional con drag-and-drop y preview.

### Tareas:
1. **Drag from palette to canvas:**
   - Drag un tool de creación → ghost preview sigue el cursor
   - Drop en canvas → crea el elemento en esa posición exacta
   - Feedback visual durante drag (cursor, highlight zona válida)

2. **Palette mejorada:**
   - Search/filter en la parte superior
   - Tooltips con descripción del tool
   - Preview del shape+color al hover
   - Contador de instancias creadas por tipo
   - Sección "Recent" con los últimos 3 tools usados

3. **Quick-create panel:**
   - Botón "+" flotante en canvas (esquina)
   - Abre un mini-palette inline con los tools más usados
   - Click → crea en el centro del viewport

4. **Tool state feedback:**
   - Cursor cambia según tool activo (crosshair para create, pointer para connect)
   - Banner sutil en canvas: "Click to place Employee" / "Connect: drag from source to target"
   - Escape para cancelar tool activo

### Archivos:
- `components/model-editor/VsmPalette.tsx` (rewrite)
- `components/model-editor/DragGhost.tsx` (nuevo)
- `components/model-editor/QuickCreate.tsx` (nuevo)
- `components/model-editor/hooks/useDragCreate.ts` (nuevo)

---

## Sprint 5 — Object Explorer + Search

**Objetivo:** Panel de exploración del modelo como árbol jerárquico.

### Tareas:
1. **Object Explorer (reemplaza o complementa Palette):**
   - Árbol jerárquico: containers > children
   - Cada item muestra: icono shape + nombre + eClass badge
   - Click → selecciona en canvas + centra vista
   - Double-click → inline rename
   - Drag-reorder para cambiar containment
   - Context menu propio (delete, duplicate, move to container)

2. **Search/Filter:**
   - Input de búsqueda en la parte superior
   - Filtra por nombre, eClass, atributo
   - Highlight matches en el árbol
   - Ctrl+F shortcut

3. **Outline minimap mejorado:**
   - Minimap con colores del VSM (no genérico)
   - Nodos coloreados según su mapping color
   - Click en minimap → navega

4. **Panel toggle:**
   - Botones para mostrar/ocultar: Explorer, Palette, Inspector
   - Collapse con animación
   - Responsive: en pantallas pequeñas, solo 1 panel lateral

### Archivos:
- `components/model-editor/ObjectExplorer.tsx` (nuevo)
- `components/model-editor/SearchPanel.tsx` (nuevo)
- `components/model-editor/hooks/useObjectTree.ts` (nuevo)
- `pages/ModelEditor.tsx` (layout con panel toggle)

---

## Sprint 6 — Containment Visual + Auto-Layout

**Objetivo:** Los containers deben contener visualmente a sus hijos.

### Tareas:
1. **Parent-child nesting visual:**
   - Containers renderizan sus hijos DENTRO del nodo
   - Layout según `childrenPresentation`: FreeForm, List, HStack, VStack
   - Resize automático del container al añadir hijos
   - Drag hijo fuera del container → remove containment
   - Drag hijo dentro de container → add containment

2. **Auto-layout engine:**
   - Botón "Auto Layout" en toolbar
   - Algoritmos: Tree (top-down), Force-directed, Grid
   - Respeta containment (hijos dentro de padres)
   - Animación suave de transición
   - Opción de layout solo para selección

3. **Alignment & Distribution:**
   - Align: left, center, right, top, middle, bottom
   - Distribute: horizontal, vertical (equal spacing)
   - Solo activo con multi-select (≥2 nodos)
   - Toolbar buttons + shortcuts

4. **Grid & Snap:**
   - Grid configurable (10/20/40px)
   - Snap-to-grid toggle
   - Snap-to-node (alignment guides)
   - Guías visuales durante drag (líneas punteadas)

### Archivos:
- `components/model-editor/VsmContainerNode.tsx` (rewrite para nesting real)
- `components/model-editor/hooks/useAutoLayout.ts` (nuevo)
- `components/model-editor/hooks/useAlignment.ts` (nuevo)
- `components/model-editor/AlignmentToolbar.tsx` (nuevo)
- `components/model-editor/SnapGuides.tsx` (nuevo)

---

## Sprint 7 — Validación + Diagnostics + Polish

**Objetivo:** Validación del modelo M1 contra el metamodel y pulido final.

### Tareas:
1. **Model validation engine:**
   - Multiplicidad: ¿todas las referencias required están satisfechas?
   - Tipos: ¿los atributos tienen valores del tipo correcto?
   - Containment: ¿los objetos están en containers válidos?
   - Custom constraints: evaluar OCL constraints del metamodel
   - Ejecutar en background (debounce 500ms)

2. **Problems panel:**
   - Panel inferior colapsable (como el del OCL editor)
   - Lista de errores/warnings con icono, mensaje, elemento afectado
   - Click en problema → selecciona y centra el elemento
   - Filtros: All / Errors / Warnings
   - Badge en status bar con count

3. **Visual indicators en canvas:**
   - Nodos con error: borde rojo pulsante
   - Nodos con warning: borde amarillo
   - Tooltip al hover sobre indicador
   - Edges inválidos: línea roja discontinua

4. **Export mejorado:**
   - JSON: formato completo con posiciones
   - XMI: export real con namespaces del metamodel
   - SVG: export del canvas como imagen vectorial
   - PNG: screenshot del canvas
   - Import: cargar JSON/XMI existente

5. **Polish general:**
   - Animaciones de transición suaves (nodos aparecen con fade-in)
   - Loading skeleton mejorado
   - Empty state cuando no hay objetos (ilustración + CTA)
   - Responsive: collapse panels en < 1200px
   - Accesibilidad: aria-labels, focus management, keyboard nav completa

### Archivos:
- `components/model-editor/hooks/useModelValidation.ts` (nuevo)
- `components/model-editor/ProblemsPanel.tsx` (nuevo)
- `components/model-editor/ValidationIndicator.tsx` (nuevo)
- `components/model-editor/EmptyState.tsx` (nuevo)
- `lib/model-export.ts` (nuevo — XMI/SVG/PNG export)
- `lib/model-import.ts` (nuevo — JSON/XMI import)

---

## Resumen de Sprints

| Sprint | Foco | Componentes Nuevos | Estimación |
|--------|------|-------------------|------------|
| 1 | Toolbar + Status Bar + Undo/Redo | 3 | Medio |
| 2 | Property Inspector profesional | 4 | Alto |
| 3 | Inline Edit + Context Menu + Shortcuts | 4 | Alto |
| 4 | Palette + Drag-to-Canvas | 4 | Medio |
| 5 | Object Explorer + Search | 3 | Medio |
| 6 | Containment Visual + Auto-Layout | 5 | Alto |
| 7 | Validación + Diagnostics + Polish | 6 | Alto |

## Principios de Diseño

1. **Consistencia con SpecEditor** — Mismos FormControls, misma paleta de colores, mismos patrones de interacción
2. **VSM-driven** — Todo lo que el usuario puede hacer está definido por el ViewpointSpec
3. **Metamodel-aware** — El inspector conoce los tipos, multiplicidades y constraints
4. **Keyboard-first** — Todo accesible por teclado, shortcuts visibles
5. **Feedback inmediato** — Cada acción tiene respuesta visual instantánea
6. **Non-destructive** — Undo/redo para todo, confirmación para delete
