# Plan de Mejora — emf-webapp

> Auditoría realizada: 2026-05-16
> Estado actual: 173 tests pasan, app desplegada en emf-webapp.fly.dev
> Objetivo: 100% funcional, profesional e interoperable con Eclipse

---

## Sprint 9 — Interoperabilidad XMI (Crítico)

**Objetivo:** El .ecore exportado debe abrirse en Eclipse sin errores.

### 9.1 — Arreglar `eReferenceType="[object Object]"`
- **Archivo:** `packages/core/src/serialization/SerializableToXmiObject.ts`
- **Bug:** Las EReferences exportan `eReferenceType="[object Object]"` en vez del fragment path
- **Fix:** En la fase 2 de resolución de referencias, asegurar que `eReferenceType` se resuelve a un objeto con `name` que el serializer pueda convertir a `#//ClassName`
- **Verificación:** `grep "object Object" exported.ecore` debe devolver 0 resultados

### 9.2 — Arreglar `eType` de EReferences (fragment path local)
- **Archivo:** `packages/core/src/serialization/XMISerializer.ts`
- **Bug:** Exporta `eType="ecore:EDataType http://www.eclipse.org/emf/2002/Ecore#//Book"` para refs a clases del propio paquete
- **Fix:** Detectar si el eType apunta a un classifier del mismo paquete → emitir `eType="#//ClassName"`. Solo usar URI completa para tipos Ecore primitivos (EString, EInt, etc.)
- **Verificación:** Las EReferences deben tener `eType="#//Book"`, no `eType="ecore:EDataType .../Ecore#//Book"`

### 9.3 — Emitir `eSuperTypes` en el export
- **Archivo:** `packages/core/src/serialization/SerializableToXmiObject.ts`
- **Bug:** `FictionCategory extends Category` se importa pero al exportar se pierde el atributo `eSuperTypes`
- **Fix:** Al construir el objeto minimal de EClass, leer `eSuperTypes[]` del SerializableEClassifier y emitir como atributo inline `eSuperTypes="#//Category #//OtherParent"`
- **Verificación:** `grep eSuperTypes exported.ecore` debe mostrar `eSuperTypes="#//Category"`

### 9.4 — Eliminar atributo XML `abstract` duplicado
- **Archivo:** `packages/core/src/serialization/XMISerializer.ts`
- **Bug:** `<eClassifiers ... abstract="true" name="Category" abstract="true">` — duplicado
- **Fix:** Deduplicar atributos antes de emitir. Usar un Set o Map para los attrs ya escritos
- **Verificación:** `xmllint --noout exported.ecore` sin errores

### 9.5 — Generar `xmi:id` únicos
- **Archivo:** `packages/core/src/serialization/XMISerializer.ts`
- **Bug:** Múltiples features tienen `xmi:id="name"` o `xmi:id="books"` — deben ser únicos
- **Fix:** Usar formato `{ClassName}_{featureName}` para features (ej: `Library_name`, `Book_title`) o IDs incrementales
- **Verificación:** `grep 'xmi:id=' exported.ecore | sort | uniq -d` debe estar vacío

### 9.6 — Eliminar `href` espurio en EEnum
- **Archivo:** `packages/core/src/serialization/XMISerializer.ts`
- **Bug:** EEnum exporta `href="http://library.example.org/1.0#//BookFormat"` que no es estándar
- **Fix:** No emitir `href` para classifiers contenidos en el propio paquete
- **Verificación:** EEnums sin atributo `href`

### 9.7 — GenModel completo
- **Archivo:** `packages/backend/src/modules/xmi/xmi.service.ts`
- **Bug:** Solo lista 1 `genClass` en vez de todas las clases del metamodelo
- **Fix:** Iterar todos los eClassifiers del metamodelo y generar un `<genClasses>` por cada EClass
- **Verificación:** El genmodel debe tener tantos `<genClasses>` como EClasses hay en el metamodelo

### 9.8 — Tests de round-trip Eclipse-compatible
- **Archivo:** `packages/core/tests/eclipse-roundtrip.test.ts`
- **Tests nuevos:**
  - Import .ecore con herencia → export → verificar eSuperTypes presente
  - Import .ecore con EReferences → export → verificar eType="#//ClassName"
  - Import .ecore con EEnum → export → sin href espurio
  - Validar XML con parser (sin duplicados, IDs únicos)
  - Verificar que el .ecore exportado es parseable por `parseEcoreXmi()` (round-trip completo)

---

## Sprint 10 — Bugs Funcionales Críticos

**Objetivo:** Todas las APIs funcionan correctamente sin errores 500.

### 10.1 — Arreglar M1Model entity (`[object Object]`)
- **Archivo:** `packages/backend/src/modules/m1model/m1model.entity.ts`
- **Bug:** `content` es `type: 'text'` → al guardar un objeto JS se convierte a `"[object Object]"`
- **Fix:** Cambiar a `@Column({ type: 'simple-json', default: '[]' })` para serialización automática
- **Verificación:** POST un modelo con content JSON → GET devuelve el JSON intacto

### 10.2 — Arreglar OCL Validate (HTTP 500)
- **Archivo:** `packages/backend/src/modules/oclconstraint/oclconstraint.service.ts`
- **Bug:** El endpoint crashea. El controller espera `{ modelContent: string }` pero el body enviado no coincide
- **Fix:**
  1. Añadir try/catch global en `validate()` que devuelva error descriptivo
  2. Aceptar tanto `{ modelContent: "..." }` (JSON string) como `{ model: {...} }` (objeto directo)
  3. Si `modelContent` no es string, hacer `JSON.stringify()` antes de parsear
- **Verificación:** POST con modelo válido → array de resultados. POST con modelo inválido → error 400 descriptivo

### 10.3 — Validar unicidad de nombres de atributos
- **Archivo:** `packages/frontend/src/components/ecore-diagram/useEcoreModel.ts`
- **Bug:** Se pueden crear múltiples atributos "newAttr" sin validación
- **Fix:** Al añadir atributo, generar nombre único (`newAttr`, `newAttr2`, `newAttr3`...) o mostrar error si ya existe
- **Verificación:** Añadir 3 atributos → nombres distintos automáticamente

### 10.4 — Labels de referencias: mostrar nombre de clase destino
- **Archivo:** `packages/frontend/src/components/ecore-diagram/useEcoreModel.ts` (función que genera edges)
- **Bug:** Muestra `books→ec_import_1778938223889_4` en vez de `books→Book`
- **Fix:** Al generar edge labels, resolver el `targetId` de la referencia al `name` del classifier correspondiente
- **Verificación:** Las edges muestran `books→Book [0..*]`

---

## Sprint 11 — Auto-Layout y UX del Diagrama

**Objetivo:** El diagrama es legible y usable sin intervención manual.

### 11.1 — Integrar auto-layout (dagre o elkjs)
- **Dependencia:** `npm install dagre` o `npm install elkjs`
- **Archivos:** `packages/frontend/src/components/ecore-diagram/useEcoreModel.ts`
- **Implementación:**
  1. Al importar un .ecore o al crear un metamodelo nuevo, ejecutar layout automático
  2. Usar dagre con dirección TB (top-bottom) o LR (left-right)
  3. Respetar posiciones guardadas si existen; solo auto-layout si no hay posiciones
- **Botón:** Añadir botón "Auto Layout" en la toolbar del diagrama
- **Verificación:** Importar el library.ecore → 6 nodos distribuidos sin solapamiento

### 11.2 — Fit View automático tras import/layout
- **Archivo:** `packages/frontend/src/components/ecore-diagram/EcoreEditor.tsx`
- **Fix:** Llamar `reactFlowInstance.fitView()` después de aplicar layout
- **Verificación:** Tras importar, todos los nodos son visibles sin zoom manual

### 11.3 — Mejorar posicionamiento de edges
- **Archivo:** `packages/frontend/src/components/ecore-diagram/edges/CustomEdges.tsx`
- **Fix:** Usar `smoothstep` o `bezier` edge type para evitar solapamiento de líneas
- **Verificación:** Edges no se cruzan innecesariamente

---

## Sprint 12 — Dark Mode y Layout Completo

**Objetivo:** UI 100% profesional sin glitches visuales.

### 12.1 — Dark mode completo en panel derecho
- **Archivo:** `packages/frontend/src/layouts/WorkspaceLayout.tsx` o CSS global
- **Bug:** La zona inferior del panel derecho (debajo de OCL Validation) queda blanca
- **Fix:** Asegurar que el contenedor del panel derecho tiene `background: var(--surface)` en toda su extensión, incluyendo el overflow area
- **Verificación:** En dark mode, 0 áreas blancas visibles

### 12.2 — Eliminar espacio blanco a la derecha
- **Archivo:** `packages/frontend/src/layouts/WorkspaceLayout.tsx`
- **Bug:** El editor no ocupa 100% del viewport
- **Fix:** Verificar que `styles.root` tiene `width: 100vw` y que el panel derecho no tiene un width fijo que cause overflow. Posiblemente el `rightPanel` con `width: 300` necesita ser condicional
- **Verificación:** El layout ocupa exactamente el 100% del viewport sin scroll horizontal

### 12.3 — Sidebar responsive con toggle visible
- **Archivo:** `packages/frontend/src/layouts/WorkspaceLayout.tsx`
- **Bug:** En viewports < 1024px el sidebar desaparece sin forma de reabrirlo
- **Fix:** Añadir un botón hamburguesa (☰) visible en la toolbar cuando el sidebar está oculto
- **Verificación:** En móvil/tablet, el botón ☰ abre/cierra el sidebar

### 12.4 — PropertyInspector responde al primer click
- **Archivo:** `packages/frontend/src/components/ecore-diagram/EcoreEditor.tsx`
- **Bug:** El nodo aparece seleccionado visualmente pero el panel muestra "Select an element"
- **Fix:** Verificar que el evento `onNodeClick` de React Flow propaga correctamente al estado de selección del PropertyInspector. Posible race condition entre `onSelectionChange` y el render del panel
- **Verificación:** Click en nodo → PropertyInspector muestra sus propiedades inmediatamente

---

## Sprint 13 — Toolbox/Palette y Drag-and-Drop

**Objetivo:** Crear elementos arrastrando desde una paleta, como en Eclipse.

### 13.1 — Toolbox visible como panel lateral
- **Archivo:** `packages/frontend/src/components/ecore-diagram/Toolbox.tsx`
- **Estado actual:** El Toolbox existe pero se renderiza con dimensiones 0x0 (portal colapsado)
- **Fix:** Verificar que el portal target (`leftPanelRef`) tiene dimensiones reales cuando el sidebar está abierto. Posible bug: el `flex: 1` del portal target no se expande si el sidebar no tiene altura suficiente
- **Verificación:** Con sidebar abierto, el Toolbox muestra "Añadir Clase", "Añadir Enum", "Añadir DataType"

### 13.2 — Drag-and-drop desde Toolbox al canvas
- **Archivo:** `packages/frontend/src/components/ecore-diagram/EcoreEditor.tsx`
- **Implementación:**
  1. Toolbox items son `draggable`
  2. Canvas tiene `onDrop` handler que lee el tipo del elemento arrastrado
  3. Al soltar, crear el classifier en la posición del drop
- **Verificación:** Arrastrar "EClass" desde Toolbox → nuevo nodo aparece en la posición del drop

### 13.3 — TreeView funcional
- **Archivo:** `packages/frontend/src/components/ecore-diagram/TreeView.tsx`
- **Verificación:** El TreeView muestra la jerarquía del metamodelo (Package > Classes > Attributes/References)
- **Interacción:** Click en un item del tree → selecciona el nodo correspondiente en el canvas

---

## Sprint 14 — OCL Completo y Code Generation

**Objetivo:** OCL validation end-to-end y code generation funcional.

### 14.1 — OCL Tab funcional end-to-end
- **Archivos:** `packages/frontend/src/components/workspace/tabs/OCLTab.tsx`
- **Verificación:**
  1. Listar constraints existentes
  2. Crear nueva constraint con editor Monaco (syntax highlighting OCL)
  3. Validar contra un modelo M1
  4. Mostrar resultados (passed/failed) con mensajes claros

### 14.2 — OCL live validation en el diagrama
- **Archivo:** `packages/frontend/src/hooks/useOCLValidation.ts`
- **Implementación:** Evaluar constraints client-side usando el OCLEvaluator del core
- **Verificación:** Nodos con violaciones muestran badge rojo con count

### 14.3 — Code Generation Tab funcional
- **Archivos:** `packages/frontend/src/components/workspace/tabs/CodeGenTab.tsx`
- **Implementación:**
  1. Listar templates disponibles (MTL)
  2. Editor Monaco para escribir/editar templates
  3. Botón "Generate" que ejecuta el MTLExecutor del core
  4. Preview del código generado
- **Verificación:** Escribir template simple → generar → ver output

### 14.4 — Models Tab (M1 instances)
- **Archivos:** `packages/frontend/src/components/workspace/tabs/ModelsTab.tsx`
- **Implementación:**
  1. Listar instancias M1 del metamodelo
  2. Crear nueva instancia (formulario basado en el metamodelo)
  3. Editar instancia existente
  4. Validar contra OCL constraints
- **Verificación:** Crear instancia de Library con Books → guardar → recuperar intacta

---

## Sprint 15 — Version History y Collaboration

**Objetivo:** Historial de versiones funcional y colaboración básica.

### 15.1 — Version History UI
- **Archivo:** `packages/frontend/src/components/versioning/VersionHistory.tsx`
- **Implementación:**
  1. Panel que muestra timeline de versiones
  2. Botón "Save Version" (snapshot manual)
  3. Diff entre versiones (added/removed/changed)
  4. Revert a versión anterior
- **Verificación:** Guardar versión → modificar → guardar otra → diff muestra cambios → revert restaura

### 15.2 — Auto-save con indicador
- **Implementación:** Guardar automáticamente cada 30s si hay cambios (sin crear versión)
- **UI:** Indicador "Saving..." / "Saved ✓" en la StatusBar
- **Verificación:** Modificar modelo → esperar 30s → recargar página → cambios persisten

### 15.3 — Collaboration cursors (WebSocket)
- **Archivo:** `packages/frontend/src/hooks/useCollaboration.ts`
- **Estado actual:** Gateway WebSocket existe pero no está conectado al frontend
- **Implementación:**
  1. Conectar al WebSocket al abrir un diagrama
  2. Enviar posición del cursor
  3. Mostrar cursores remotos con nombre/color
- **Verificación:** Abrir mismo metamodelo en 2 pestañas → ver cursor del otro

---

## Sprint 16 — Import/Export Avanzado y Proyecto Eclipse

**Objetivo:** Exportar un proyecto Eclipse completo importable.

### 16.1 — ZIP con estructura de proyecto Eclipse
- **Archivo:** `packages/backend/src/modules/project/project-export.service.ts`
- **Contenido del ZIP:**
  ```
  {package.name}/
  ├── .project (con EcoreNature)
  ├── .classpath
  ├── META-INF/MANIFEST.MF
  ├── model/{name}.ecore
  ├── model/{name}.genmodel
  └── plugin.xml
  ```
- **Verificación:** Importar ZIP en Eclipse → proyecto reconocido → .ecore abre sin errores

### 16.2 — Import de proyecto Eclipse (ZIP)
- **Implementación:** Aceptar ZIP con estructura Eclipse → extraer .ecore → importar
- **Verificación:** Exportar desde Eclipse → importar en webapp → modelo intacto

### 16.3 — Export con OCL annotations
- **Archivo:** `packages/core/src/serialization/OCLAnnotationExporter.ts`
- **Implementación:** Incluir EAnnotations OCL en el .ecore exportado
- **Verificación:** Constraints OCL aparecen como `<eAnnotations source="http://www.eclipse.org/emf/2002/Ecore/OCL/Pivot">` en el XMI

### 16.4 — Graphical Spec export (EuGENia .emf)
- **Implementación:** Exportar el metamodelo en formato Emfatic con anotaciones @gmf
- **Verificación:** El .emf generado es procesable por EuGENia en Eclipse

---

## Sprint 17 — Polish Final y Testing E2E

**Objetivo:** Calidad de producción.

### 17.1 — Tests E2E con Playwright
- **Implementación:**
  1. Test: crear proyecto → crear metamodelo → añadir clases → guardar → exportar .ecore → validar XML
  2. Test: importar .ecore → verificar nodos en canvas → exportar → round-trip
  3. Test: OCL constraint → validate → resultados correctos
  4. Test: dark mode toggle → todos los paneles oscuros
- **Cobertura objetivo:** 90%+ de flujos críticos

### 17.2 — Error handling global
- **Implementación:**
  1. Toast notifications para errores de red
  2. Error boundaries por sección (no crash global)
  3. Retry automático en fallos transitorios
  4. Mensajes de error descriptivos (no "Internal server error")
- **Verificación:** Desconectar red → toast "Connection lost" → reconectar → auto-retry

### 17.3 — Performance audit
- **Verificación:**
  1. Metamodelo con 50+ clases → canvas fluido (60fps)
  2. Import de .ecore grande (100 classifiers) → < 3s
  3. Export XMI → < 1s
  4. Bundle size < 500KB gzipped (actualmente ~220KB)

### 17.4 — Accessibility (WCAG 2.1 AA)
- **Verificación:**
  1. Navegación por teclado completa
  2. ARIA labels en todos los controles
  3. Contraste suficiente en ambos temas
  4. Screen reader compatible (estructura semántica)

---

## Resumen de Prioridades

| Sprint | Prioridad | Impacto |
|--------|-----------|---------|
| 9 | 🔴 Crítica | Sin esto, el proyecto no sirve como alternativa a Eclipse |
| 10 | 🔴 Crítica | APIs rotas = app no funcional |
| 11 | 🟠 Alta | Diagrama ilegible sin layout |
| 12 | 🟡 Media | Profesionalismo visual |
| 13 | 🟡 Media | Usabilidad del editor |
| 14 | 🟠 Alta | Funcionalidades core incompletas |
| 15 | 🟢 Baja | Nice-to-have para v1 |
| 16 | 🟠 Alta | Interoperabilidad completa |
| 17 | 🟡 Media | Calidad de producción |

---

## Métricas de Éxito

- [ ] .ecore exportado abre en Eclipse 2024-12 sin errores
- [ ] Round-trip (Eclipse → webapp → Eclipse) sin pérdida de datos
- [ ] 0 errores HTTP 500 en todas las APIs
- [ ] Diagrama legible automáticamente tras import
- [ ] Dark mode 100% consistente
- [ ] OCL validation funcional end-to-end
- [ ] 200+ tests pasando
- [ ] Bundle < 500KB gzipped
