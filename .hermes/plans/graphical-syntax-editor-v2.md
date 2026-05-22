# Graphical Syntax Editor v2.0 — Plan

## Concepto

Reemplazar el canvas central por un editor master-detail orientado a formularios.
Cada elemento del metamodelo tiene su propio panel de configuración con preview en vivo.

## Layout

3 columnas:
1. **Izquierda — Mapping Navigator** (árbol jerárquico)
2. **Centro — Editor de Propiedades** (formulario contextual)
3. **Derecha — Live Preview** (mini-canvas readonly)

---

## Sprint 1: Arquitectura base y navegación

- [ ] Eliminar canvas central como elemento principal
- [ ] Crear `MappingNavigator` — árbol colapsable:
  - 📦 Node Mappings (una entrada por EClass mapeada)
  - 📦 Container Mappings (EClasses con hijos)
  - 🔗 Edge Mappings (EReferences mapeadas)
  - 🛠️ Tool Sections
  - 🎨 Layers
- [ ] Cada entrada: icono + nombre de clase + mini badge forma/color
- [ ] Acciones: añadir mapping (dropdown clases no mapeadas), eliminar, duplicar, reordenar (drag)
- [ ] Botón "Auto-generate all" (reutilizar lógica existente de spec-generator)
- [ ] Header: nombre viewpoint, save status, botones generate/save

---

## Sprint 2: Editor de Node Mapping

Panel central con tabs al seleccionar un Node Mapping:

### Tab "General"
- [ ] Domain Class (readonly)
- [ ] Label Expression (input con autocompletado de atributos)
- [ ] Semantic Candidates Expression
- [ ] Tooltip Expression

### Tab "Style"
- [ ] Shape selector (grid visual 6 formas, clickable)
- [ ] Color pickers: fill, border, label
- [ ] Border: size slider + line style dropdown
- [ ] Dimensions: width/height con lock aspect ratio
- [ ] Label: position (5 opciones visual), size, bold/italic toggles
- [ ] Show icon toggle

### Tab "Conditional Styles"
- [ ] Lista de reglas: predicateExpression → style overrides
- [ ] Cada regla expandible con controles de estilo
- [ ] Añadir/eliminar/reordenar reglas

### Tab "Tools"
- [ ] Creation tool asociado
- [ ] Delete tool config
- [ ] Direct edit tool config
- [ ] Precondition expressions

---

## Sprint 3: Editor de Edge Mapping

### Tab "General"
- [ ] Type: relation-based / element-based (radio)
- [ ] Source Reference (dropdown EReferences)
- [ ] Source/Target Mapping IDs (multi-select)
- [ ] Target Finder Expression

### Tab "Style"
- [ ] Line: style (solid/dash/dot), width slider, color picker
- [ ] Routing: straight / manhattan / tree (visual selector)
- [ ] Source decoration: selector visual 7 tipos flecha
- [ ] Target decoration: ídem
- [ ] Labels: begin/center/end con expression inputs

### Tab "Conditional Styles"
- [ ] Mismo patrón que nodos

---

## Sprint 4: Editor de Container Mapping

Extiende Node Mapping con:

### Tab "Children"
- [ ] Lista de sub-node mappings contenidos
- [ ] Layout de hijos: vertical / horizontal / free-form
- [ ] Spacing, padding configurables
- [ ] Bordered sections (compartments) toggle

---

## Sprint 5: Live Preview Panel

- [ ] Mini-canvas ReactFlow readonly en panel derecho
- [ ] Para nodos: nodo con estilo + nodos fantasma conectados
- [ ] Para edges: source → edge → target con estilos reales
- [ ] Para containers: container con 2-3 hijos ejemplo
- [ ] Actualización en tiempo real
- [ ] Toggle dark/light background

---

## Sprint 6: Diagram Preview completo

- [ ] Vista "Full Preview" con diagrama ejemplo usando instancias dummy
- [ ] Muestra todas las clases, relaciones, containers con estilos
- [ ] Zoom, pan (readonly)
- [ ] Botón "Randomize data"
- [ ] Indicador de mappings faltantes

---

## Sprint 7: UX profesional y polish

- [ ] Undo/Redo
- [ ] Validación inline (expresiones inválidas, mappings incompletos)
- [ ] Import/Export specs como JSON
- [ ] Copiar estilo entre mappings
- [ ] Templates predefinidos (UML-like, ER-like, BPMN-like, minimal)
- [ ] Keyboard shortcuts (Ctrl+S, Ctrl+Z, Delete)
- [ ] Breadcrumb de navegación
- [ ] Responsive: collapse panels en pantallas pequeñas
