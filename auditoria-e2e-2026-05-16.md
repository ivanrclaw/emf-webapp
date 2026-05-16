# Auditoría E2E — emf-webapp

**Fecha:** 2026-05-16  
**App:** https://emf-webapp.fly.dev/  
**Proyecto auditado:** HandleTest (b35a7107) / HandleTestMM (132fc385) + creación propia intentada

---

## Resumen

| Área | Estado | Bugs |
|------|--------|------|
| Welcome / Landing | ⚠️ Parcial | 3 |
| Creación de proyectos | ❌ Roto | 2 |
| Diagrama (editor canvas) | ⚠️ Parcial | 4 |
| Inspector de propiedades | ❌ No funciona | 1 |
| Toolbar actions (Save, Validate, Export, etc.) | ⚠️ No operativas | 2 |
| OCL Constraints | ✅ Funcional | 1 |
| Code Generation | ✅ Funcional | 2 |
| Models (M1) | ✅ Funcional | 1 |
| Graphical Spec | ✅ Funcional | 0 |
| API (backend) | ⚠️ Parcial | 1 |
| XMI export | ❌ 500 error | 1 |

**Total bugs encontrados: 18**

---

## Bug #1 — New Project no funciona (Welcome tab)
- **Ruta:** Welcome page → "New Project" button
- **Severidad:** 🔴 Crítica
- **Descripción:** El handler `handleCreateProject` en `WelcomeTabWrapper` es un stub vacío (`// TODO: Open create project modal`). No abre ningún modal ni formulario.
- **Código:** `packages/frontend/src/layouts/WorkspaceLayout.tsx` línea 178-180
- **Solución:** Implementar el modal de creación de proyecto con nombre y descripción, conectándolo a `POST /api/projects`.

## Bug #2 — New Project tab "Unknown tab type: new-project"
- **Ruta:** Sidebar → Quick Actions → "New Project" button
- **Severidad:** 🔴 Crítica
- **Descripción:** El botón del sidebar abre un tab con `type: 'new-project'`, pero este tipo no está manejado en `TabContent` (WorkspaceLayout.tsx). Muestra "Unknown tab type: new-project".
- **Código:** `packages/frontend/src/components/workspace/Sidebar.tsx` línea 613-614 + `packages/frontend/src/layouts/WorkspaceLayout.tsx` línea 141-146
- **Solución:** Añadir case `'new-project'` en TabContent, o redirigir a un modal/flujo de creación.

## Bug #3 — Import .ecore no funciona (Welcome tab)
- **Ruta:** Welcome page → "Import .ecore" button
- **Severidad:** 🔴 Crítica
- **Descripción:** El handler `handleImportEcore` en `WelcomeTabWrapper` es un stub vacío (`// TODO: Open import dialog`).
- **Código:** `packages/frontend/src/layouts/WorkspaceLayout.tsx` línea 182-184
- **Solución:** Implementar el diálogo de importación de archivos .ecore.

## Bug #4 — Import .ecore tab "Unknown tab type: import-ecore"
- **Ruta:** Sidebar → Quick Actions → "Import .ecore" button
- **Severidad:** 🔴 Crítica
- **Descripción:** Similar al Bug #2, abre un tab con `type: 'import-ecore'` no manejado.
- **Código:** `packages/frontend/src/components/workspace/Sidebar.tsx` línea 616-617
- **Solución:** Añadir case `'import-ecore'` o redirigir a un file picker.

## Bug #5 — Inspector de propiedades no reacciona a selección de nodos
- **Ruta:** Diagram editor → hacer clic en nodos del canvas
- **Severidad:** 🟠 Alta
- **Descripción:** Al hacer clic en cualquier nodo del diagrama (Library, Book, etc.), el panel derecho "Properties" siempre muestra "Select an element to inspect its properties". No parece haber conexión entre la selección de React Flow y el panel de propiedades.
- **Evidencia:** Probado con clics programáticos en elementos SVG `<text>` y sus `<g>` padres. Ninguno activó el inspector.
- **Solución:** Verificar que `onNodeClick`/`onNodeSelect` de React Flow esté conectado al state del inspector de propiedades.

## Bug #6 — Botón "+" (añadir atributo) añade sin diálogo de configuración
- **Ruta:** Diagram editor → nodo → "+" en Attributes
- **Severidad:** 🟡 Media
- **Descripción:** Al hacer clic en "+" se añade un atributo con nombre "newAttr" y tipo "EString" automáticamente, sin mostrar ningún diálogo para configurar nombre, tipo, multiplicidad, etc.
- **Evidencia:** Se añadió `newAttr: EString` a Library. El cambio se refleja inmediatamente en el canvas y el árbol.
- **Solución:** Implementar un modal/diálogo de añadir atributo con campos editables.

## Bug #7 — Botón "+" en referencias añade referencia vacía
- **Ruta:** Diagram editor → nodo → "+" en References
- **Severidad:** 🟡 Media
- **Descripción:** FictionCategory ya tenía `newRef→` con target vacío (sin clase destino). No hay forma de seleccionar el target desde la UI.
- **Evidencia:** `eReferences[].targetId` está vacío para `newRef`.
- **Solución:** Implementar selector de clase destino para referencias.

## Bug #8 — Library muestra "1 Library" en lugar de "Library"
- **Ruta:** Diagram editor → nodo Library
- **Severidad:** 🟢 Leve
- **Descripción:** El título del nodo Library muestra "1 Library" con un "1" inexplicable delante. Podría ser un artefacto de estado interno.
- **Evidencia:** En el snapshot: `text: "1 Library Attributes name: EString newAttr: EString"`
- **Solución:** Investigar por qué se añade el prefijo "1".

## Bug #9 — Botón Settings no abre nada
- **Ruta:** Toolbar → Settings (⚙️)
- **Severidad:** 🟡 Media
- **Descripción:** El case `'settings'` en `handleToolbarAction` está vacío (`break;`). No abre ningún modal de configuración.
- **Código:** `WorkspaceLayout.tsx` línea 254-255
- **Solución:** Implementar el modal de settings (o vinculación de teclas, tema, etc.) o eliminar el botón.

## Bug #10 — Botón Validate no muestra resultados visibles
- **Ruta:** Toolbar → Validate
- **Severidad:** 🟡 Media
- **Descripción:** Al hacer clic en Validate, no aparece ningún mensaje, toast, ni cambio visible (excepto el contador de violaciones OCL que ya estaba presente). El status siempre muestra "Invalid 1".
- **Solución:** Añadir feedback visual (toast, panel de resultados, cambio de status).

## Bug #11 — Botones Export .ecore, Eclipse Project, Import .ecore, Import Eclipse ZIP sin feedback
- **Ruta:** Toolbar → Export .ecore / Eclipse Project / Import .ecore / Import Eclipse ZIP
- **Severidad:** 🟡 Media
- **Descripción:** Estos botones llaman a `editor.actions.exportEcore()` etc., pero no hay feedback visual ni descarga de archivos. Dependen de `EditorContext` que quizás no esté correctamente inicializado.
- **Código:** `WorkspaceLayout.tsx` líneas 259-270
- **Solución:** Verificar que `EditorContext.actions` esté correctamente implementado y probar con descarga real de archivos.

## Bug #12 — HTML Generator muestra "pages: EString" incorrectamente
- **Ruta:** Code Generation → HTML Documentation → Generated output
- **Severidad:** 🟡 Media
- **Descripción:** El atributo `pages` de la clase Book aparece como `EString` en el HTML generado, pero en el metamodelo real es `EInt`.
- **Evidencia:** API devuelve `"eType":"EInt"` para pages, pero el HTML generado dice `pages: EString [0..1]`.
- **Solución:** Investigar el generador HTML — probablemente no maneja correctamente tipos primitivos no-String.

## Bug #13 — HTML Generator muestra ID crudo en "extends"
- **Ruta:** Code Generation → HTML Documentation → Generated output
- **Severidad:** 🟡 Media
- **Descripción:** FictionCategory extiende Category pero el HTML generado muestra `extends: ec_import_1778938223891_11` (el ID interno) en lugar del nombre de la clase "Category".
- **Solución:** El generador debe resolver `eSuperTypes[]` buscando por ID en la lista de eClassifiers para mostrar el nombre.

## Bug #14 — OCL "Create" button siempre disabled
- **Ruta:** OCL Constraints → Create button
- **Severidad:** 🟡 Media
- **Descripción:** El botón "Create" está siempre deshabilitado, incluso con nombre y expresión rellenos. No permite crear nuevas restricciones OCL.
- **Solución:** Verificar la lógica de habilitación del botón — probablemente necesita validar que nombre, contexto y expresión no estén vacíos.

## Bug #15 — El editor de modelos (M1) redirige al diagrama del metamodelo
- **Ruta:** Models → Open Editor en un modelo M1
- **Severidad:** 🟠 Alta
- **Descripción:** Al hacer clic en "Open Editor" de un modelo de instancia (M1), la URL lleva a `/models/:modelId/edit` que usa `DeepLinkRouter`, el cual abre una pestaña `type: 'diagram'` en lugar de un editor específico de modelos de instancia. No hay distinción visual entre editar el metamodelo y editar una instancia.
- **Solución:** Crear un `DeepLinkModelEditor` que abra un tab `type: 'model-instance-editor'` con un componente específico para editar instancias M1.

## Bug #16 — Múltiples tabs "OCL Constraints" duplicados
- **Ruta:** Navegación entre deep links OCL
- **Severidad:** 🟢 Leve
- **Descripción:** Al navegar a OCL constraints vía deep link, se abre un nuevo tab aunque ya exista uno abierto. En la auditoría aparecieron 2 tabs "OCL Constraints".
- **Solución:** El `DeepLinkOCL` debería reutilizar tabs existentes en lugar de crear nuevos.

## Bug #17 — XMI Export endpoint retorna 500
- **Ruta:** `/api/projects/:projectId/xmi/:metamodelId/ecore`
- **Severidad:** 🟠 Alta
- **Descripción:** El endpoint de exportación .ecore retorna 500 Internal Server Error.
- **Solución:** Revisar `XmiService.exportToXmi()` para identificar la causa del error.

## Bug #18 — El tour de onboarding no se puede cerrar (Skip no funciona)
- **Ruta:** Welcome page → Onboarding tour
- **Severidad:** 🟢 Leve
- **Descripción:** El botón "Skip" del tour de onboarding no parece tener efecto visible — la capa del tour permanece.
- **Solución:** Verificar el componente `OnboardingTour` y su estado.

---

## Funcionalidades que SÍ funcionan correctamente ✅

1. **Carga de la aplicación y Welcome page** — la landing page se muestra con proyectos recientes.
2. **Sidebar con explorador de proyectos** — lista proyectos y metamodelos, expandir/colapsar funciona.
3. **Apertura de proyecto** — al hacer clic en un proyecto se abre su página de información.
4. **Apertura del diagrama** — al hacer clic en "Open Diagram" se abre el editor de diagrama con React Flow.
5. **Visualización del canvas** — los nodos y edges se renderizan correctamente.
6. **Toolbox: Añadir Clase** — funciona correctamente, añade nuevas clases al metamodelo.
7. **Añadir atributo via "+"** — añade atributos con valores por defecto (aunque sin diálogo, Bug #6).
8. **Model tree** — muestra correctamente la jerarquía de clases, atributos, referencias y enums.
9. **Zoom In / Zoom Out / Fit View** — funcional.
10. **Mini Map** — se muestra correctamente.
11. **Layout buttons** — presentes en la UI.
12. **Dark/Light theme toggle** — funciona.
13. **OCL Constraints page** — carga correctamente, muestra EClasses, restricciones existentes, selector de severidad.
14. **Code Generation page** — 5 generadores predefinidos funcionales.
15. **HTML Documentation generator** — genera HTML completo con toda la documentación del metamodelo.
16. **Models page** — lista modelos M1, botón "New Model Instance" presente.
17. **Graphical Spec page** — paleta de clases, canvas, selector de specs, style editor.
18. **Status bar** — muestra contador de validación y estado.
19. **API CRUD de proyectos** — endpoints GET funcionan correctamente.
20. **API de metamodelos** — endpoints GET funcionan con datos completos.

---

## Problemas de arquitectura / UX

1. **No hay navegación entre vistas de metamodelo** — Desde el diagrama no hay enlaces para ir a OCL, Code Gen, Models o Specs. Solo se accede vía deep links directos o desde los iconos ocultos del sidebar (hover en metamodelo). Los iconos del sidebar tienen opacidad 0 por defecto.
2. **Los tabs de deep links se duplican** — No hay lógica de reutilización de tabs.
3. **No hay feedback visual para acciones** — Save, Validate, Export no muestran toasts ni indicadores.
4. **Inspector de propiedades no conectado** — El panel derecho está siempre vacío.

---

*Auditoría realizada por Hermes Agent (Kimi K2.6) el 2026-05-16*
