# Plan: OCL IDE — Professional Web IDE (single-editor)

> Decisión del usuario: single-editor (no multi-tab interno), shortcuts libres.

## Visión

Layout VSCode-grade dentro del workspace, full-height, mismo lenguaje visual del resto:

```
┌─────────────────────────────────────────────────────────────────┐
│ OCL Toolbar: New · Save · Format · Validate · Run M1 · ⌘K       │
├──────────┬──────────────────────────────────────┬───────────────┤
│ Constra- │ Breadcrumb: AuditMM › Department › … │  Inspector    │
│ ints     ├──────────────────────────────────────┤               │
│ Browser  │     Monaco OCL Editor (full)         │  Properties   │
│ ─────── │     · breadcrumbs                    │  Type Info    │
│ ▾ Empl.  │     · sticky scroll                  │  AST          │
│   ✗ inv  │     · minimap                        │  M1 Selector  │
│   ✓ inv  │     · format on save                 │               │
│ ▾ Dept.  │     · go-to-def · hover · sigHelp    │               │
│   ⚠ inv  │                                      │               │
├──────────┴──────────────────────────────────────┴───────────────┤
│ Problems · Output  [3 errors · 1 warning]                       │
├─────────────────────────────────────────────────────────────────┤
│ ln 12, col 8 · OCL · self: Employee · ✗3 ⚠1 · ●Validated        │
└─────────────────────────────────────────────────────────────────┘
```

## Restricciones

- Single editor central (el árbol de izquierda controla qué se muestra).
- Shortcuts libres: Ctrl+S guarda el constraint, Ctrl+Shift+B valida, F8 next problem, F12 go-to-def, Shift+Alt+F format.
- Reusar `ResizablePanel` (horizontal) y crear `ResizablePanelV` (vertical) para el bottom dock.
- Reusar tokens de `App.css` (`--surface`, `--border`, `--primary`...).
- Mantener compatibilidad con la ruta standalone (`/projects/:pid/metamodels/:mmid/ocl`) y con `OCLTab`.

---

## FASE 1 — IDE Shell (resizable 3-pane + bottom dock)

**Archivos:**
- `packages/frontend/src/pages/OCLConstraintPage.tsx` → refactor a IDE shell
- `packages/frontend/src/components/workspace/tabs/OCLTab.tsx` → eliminar padding/overflow:auto, dar `height: 100%`
- `packages/frontend/src/components/workspace/ResizablePanelV.tsx` (NUEVO) — vertical
- `packages/frontend/src/components/ocl/OCLToolbar.tsx` (NUEVO)
- `packages/frontend/src/components/ocl/OCLConstraintBrowser.tsx` (NUEVO)
- `packages/frontend/src/components/ocl/OCLInspector.tsx` (NUEVO)
- `packages/frontend/src/components/ocl/OCLProblemsPanel.tsx` (NUEVO)
- `packages/frontend/src/components/ocl/OCLStatusBar.tsx` (NUEVO)
- `packages/frontend/src/components/ocl/OCLEditorPane.tsx` (NUEVO)

**Layout flex:**
```
<div flex column h:100%>
  <OCLToolbar />                                  // 40px
  <div flex row flex:1>
    <ResizablePanel left  180-360 default 240>
      <OCLConstraintBrowser />
    </ResizablePanel>
    <div flex column flex:1 minWidth:0>
      <OCLEditorPane />                           // grows
      <ResizablePanelV minH:120 maxH:50% default 200>
        <OCLProblemsPanel />
      </ResizablePanelV>
    </div>
    <ResizablePanel right 240-440 default 320>
      <OCLInspector />
    </ResizablePanel>
  </div>
  <OCLStatusBar />                                // 24px
</div>
```

**Estado central elevado al shell** (no en el `Editor`):
- `currentConstraint: OCLConstraint | null`
- `dirty: boolean`
- `formName, formContext, formExpression, formSeverity` (cuando se edita un constraint nuevo)
- `diagnostics: OCLDiagnostic[]` (del constraint seleccionado)
- `globalProblems: Map<constraintId, Diagnostic[]>` (todos los constraints)
- `validationResults: OCLValidationResult[] | null`
- `selectedModelId`

**Tests Fase 1:**
- Render del shell sin crash con metamodel vacío
- Resize de paneles persiste en localStorage
- Selección de constraint en el browser actualiza el editor

---

## FASE 2 — Monaco profesional

**Cambios en `OCLEditorPane`:**
- `height: 100%` (no fijo)
- Activar:
  - `minimap.enabled: true`, `minimap.scale: 2`, `minimap.renderCharacters: false`
  - `bracketPairColorization.enabled: true`
  - `guides.bracketPairs: 'active'`, `guides.indentation: true`
  - `stickyScroll.enabled: true`
  - `smoothScrolling: true`, `cursorSmoothCaretAnimation: 'on'`
  - `renderLineHighlight: 'all'`
  - `rulers: [100]`
  - `padding: { top: 12, bottom: 12 }`
  - `fontFamily: "'JetBrains Mono', 'Fira Code', monospace"`
  - `fontLigatures: true`
  - `fontSize: 14`
  - `lineHeight: 22`
  - `automaticLayout: true`
- Keybindings:
  - Ctrl+S → `onSave()`
  - Ctrl+Shift+B → `onValidate()`
  - F8 → `goToNextProblem()`
  - F12 → ya provided
  - Shift+Alt+F → format-on-save provider (placeholder hasta que tengamos formatter real)
- Theme override custom: `emf-ocl-dark` y `emf-ocl-light` con paleta consistente con la webapp.
- `defineTheme` para que keywords y tipos OCL usen los tokens de color del workspace.

**Tests Fase 2:**
- Monaco monta con el theme custom
- Ctrl+S dispara save
- Ctrl+Shift+B dispara validate

---

## FASE 3 — Constraint Browser (left pane)

`OCLConstraintBrowser`:
- Tree view agrupado por EClass (context)
- Iconos de severidad por constraint: ✗ error, ⚠ warning, ℹ info
- Badge de estado: dirty (`●`), passed (`✓`), failed (`✗`), unknown (`?`)
- Búsqueda incremental (input arriba)
- Botón "+ New" general y "+ New" inline en cada grupo de EClass
- Click → selecciona constraint → carga en editor
- Right-click context menu: Rename / Duplicate / Delete

**Tests:**
- Render con N constraints agrupa correctamente por context
- Filtro por nombre filtra y mantiene grupos no vacíos
- Click selecciona y emite onSelect

---

## FASE 4 — Inspector (right pane)

Tabs: **Properties** | **Type Info** | **AST**

**Properties tab:**
- Name (input)
- Context (select EClass)
- Severity (select)
- Expression preview (read-only, sync con editor)

**Type Info tab:**
- Tipo del símbolo bajo el cursor (uses `OCLTypeInferenceEngine`)
- Inheritance chain del context class
- Available attrs/refs/ops del context

**AST tab:**
- Árbol expandible del AST (uses `OCLDocumentParser`)
- Click en nodo → highlight en editor (range)

**M1 Selector:** dropdown bajo los tabs para validation runs.

**Tests:**
- Properties refleja constraint actual
- Cambio en cursor → Type Info se actualiza
- AST renderiza para una expresión simple

---

## FASE 5 — Problems Panel (bottom dock)

`OCLProblemsPanel`:
- Lista agregada de diagnostics de TODOS los constraints (no solo el abierto)
- Por entrada: severity icon + constraint name + line:col + message
- Click → abre constraint + jumps to line
- Filtro por severidad (toggles)
- Tabs: Problems | Validation Output (results de "Validate All")
- Real-time: re-diagnose en background al editar

**Tests:**
- Agrega errors de N constraints
- Click navega correctamente
- Toggle de severidad filtra

---

## FASE 6 — Status Bar OCL

Reemplaza `<status>? 0` actual por:
- ln/col del cursor
- contexto (`self: Employee`)
- `✗3 ⚠1 ℹ0` (totales)
- ● Validated / ● Unsaved / Saved 12s ago
- M1 model activo
- OCL versión

**Tests:**
- Refleja cursor position
- Suma de errores correcta

---

## FASE 7 — Comandos en CommandPalette

Añadir a `PREDEFINED_ACTIONS`:
- `OCL: New Constraint` (Ctrl+N en OCL pane)
- `OCL: Validate All`
- `OCL: Format`
- `OCL: Toggle Problems Panel`
- `OCL: Toggle Inspector`
- `OCL: Go to Next Problem`
- `OCL: Run on Selected M1 Model`

**Tests:**
- Comandos aparecen solo cuando OCL tab está activo
- Ejecutar dispara la acción correcta

---

## FASE 8 — Polish + persistencia + tests integración

- `localStorage`:
  - `ocl-ide.left.width`, `ocl-ide.right.width`, `ocl-ide.problems.height`
  - `ocl-ide.last-constraint:{metamodelId}` (último abierto)
- Welcome state cuando no hay constraints (CTA "Create your first constraint")
- Loading skeletons consistentes
- Empty problems panel state
- Theme sync con `data-theme` (ya implementado)
- Tests E2E (vitest + RTL):
  - Crear → editar → guardar → validar → ver en problems → click jump-to-line
  - Resize persiste tras reload
  - Switch metamodels mantiene tamaños

---

## Orden y estimación (calls/fase)

| Fase | Calls aprox | Deploy intermedio |
|------|------|------|
| 1 | 15-20 | sí |
| 2 | 8-12 | sí |
| 3 | 10-15 | sí |
| 4 | 12-18 | sí |
| 5 | 10-15 | sí |
| 6 | 5-8 | sí |
| 7 | 5-8 | no |
| 8 | 10-15 | sí (final) |
