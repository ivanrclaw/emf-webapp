# Auditoría E2E Completa — emf-webapp

**Fecha:** 2026-05-16  
**App:** https://emf-webapp.fly.dev/  
**Commits auditados:** 6150c42 → 0e17096 (4 deploys)

---

## Resumen

| Área | Estado |
|------|--------|
| Frontend (carga inicial) | ✅ Fix aplicado |
| API CRUD Proyectos | ✅ 100% funcional |
| API CRUD Metamodelos | ✅ 100% funcional |
| API XMI Ecore Export | ✅ Fix aplicado |
| API XMI GenModel Export | ✅ Funcional |
| API XMI ZIP Export | ✅ Fix aplicado |
| API OCL Constraints | ✅ 100% funcional |
| API Code Templates | ✅ 100% funcional |
| API M1 Model Instances | ✅ 100% funcional |
| API XMI Instance Export | ✅ Fix aplicado |
| UI - Diagram Editor | ✅ Funcional |
| UI - PropertyInspector | ✅ Funcional |
| UI - Tabs system | ✅ Funcional |
| UI - Dark/Light mode | ✅ Funcional |
| UI - Sidebar | ✅ Funcional |
| UI - Toolbar | ✅ Funcional |

---

## Bugs Encontrados y Corregidos

### Bug #1: TDZ ReferenceError — "can't access lexical declaration 'O' before initialization" 🔴

**Archivo:** `packages/frontend/src/components/workspace/OnboardingTour.tsx`

**Causa:** El hook `useEffect` (línea 81) dependía de la constante `finish` en su array de dependencias `[visible, finish]`, pero `const finish = useCallback(...)` estaba declarada después (línea 104). JavaScript lanza ReferenceError al acceder a una variable `const` en la Temporal Dead Zone (TDZ).

**Fix:** Mover `finish` y `next` (useCallbacks) ANTES de los `useEffect` que los referencian.

**Commit:** `bb5daf1`

---

### Bug #2: XMI ecore export devuelve 404 cuando content.name no existe 🔴

**Archivo:** `packages/backend/src/modules/xmi/xmi.service.ts`

**Causa:** El contenido del metamodelo se guarda con formato EPackage donde `name`, `nsURI`, `nsPrefix` están en la raíz del metamodel (`mm.name`, `mm.ns_uri`, `mm.ns_prefix`), NO dentro de `mm.content.name`. El guard `if (!content || !content.name)` retornaba null porque `content.name` es undefined.

**Fix:** Cambiar el guard a `if (!content)` y usar `content.name || mm.name` como fallback para el nombre, `content.nsURI || mm.ns_uri` para nsURI, etc.

**Commit:** `ba867f0`

---

### Bug #3: ZIP export cascada del Bug #2 🔴

**Archivo:** `packages/backend/src/modules/xmi/xmi.service.ts` — método `exportEclipseProject`

**Causa:** `exportEclipseProject` llama a `exportToXmi` internamente. Como `exportToXmi` retornaba null (Bug #2), el ZIP también fallaba con 404. Además, el método `exportEclipseProject` también tenía su propio guard `if (!content || !content.name)`.

**Fix:** Mismo fix que Bug #2 — usar `content.name || mm.name` como fallback.

**Commit:** `ba867f0`

---

### Bug #4: XMI Instance Export/Import falla por content.name 🔴

**Archivo:** `packages/backend/src/modules/xmi/xmi.service.ts` — métodos `exportInstance` e `importInstance`

**Causa:** Misma razón que Bug #2 — los métodos de instancia XMI verificaban `content.name` que no existe.

**Fix:** Eliminar check de `content.name`, pasar `{ ...content, name: content.name || mm.name }` a las funciones de serialización.

**Commit:** `3a33732`

---

### Bug #5: XMI Instance Export/Import requiere formato de documento específico ⚠️

**No es un bug.** El documento de instancia debe incluir `root`, `nsURI` y `nsPrefix`:

```json
{
  "document": {
    "root": {"eClass":"Person","attributes":{...},"references":{},"children":{}},
    "nsURI": "http://...",
    "nsPrefix": "testmm"
  }
}
```

---

### Bug #6: Settings button no muestra feedback visual ⚠️

**Archivo:** `packages/frontend/src/layouts/WorkspaceLayout.tsx`

**Causa:** El botón Settings llama a `addToast('Settings panel coming soon', 'info')` que muestra un toast con auto-dismiss de 4 segundos. Los toasts existen pero el tiempo de auto-dismiss es muy corto. No es un bug crítico, es una funcionalidad no implementada.

**Estado:** Mejora UX — no corregido (comportamiento intencional, falta implementar el panel Settings).

---

### Bug #6: Atributos duplicados al hacer click repetido en "+ Attribute" ⚠️

**Causa:** El editor de diagramas no valida que el nombre del atributo sea único dentro de la EClass. Cada click añade "newAttr: EString" sin verificar duplicados.

**Estado:** Mejora UX — no corregido (funciona, pero permite duplicados).

---

### Bug #7: El cambio de tema no persiste al hacer F5 🔴

**Archivo:** `packages/frontend/index.html`

**Causa:** El theme toggle guardaba en `localStorage.setItem('theme', ...)` pero al cargar la página no se leía ese valor. El `data-theme` nunca se inicializaba, por lo que tras F5 se perdía la preferencia.

**Fix:** Añadir un script síncrono en `<head>` del `index.html` que ejecuta una IIFE leyendo `localStorage.getItem('theme')` y aplicando `document.documentElement.setAttribute('data-theme', theme)` antes de que React se monte. Si no hay tema guardado, por defecto es 'dark'.

**Commit:** `8b59354`

---

## Falsos Positivos (no son bugs)

| Reportado como bug | Realidad |
|---|---|
| "OCL Create 500" | El campo correcto es `expression`, no `body` |
| "Code Template 500" | El campo correcto es `template`, no `content` |
| "Sin toasts visibles" | Los toasts auto-dismiss después de 4s |
| "Nodo Invalid EDataType" | Metamodelo precargado de pruebas anterior |
| "OCL/CodeGen/Models/Spec tabs no encontrados" | Se abren al hacer click en un metamodelo específico en la sidebar |

---

## Resultados de Pruebas E2E

### Proyectos (API)
- `GET /api/projects` → ✅ 200, lista paginada
- `POST /api/projects` → ✅ 201, crea proyecto
- `GET /api/projects/:pid` → ✅ 200
- `PUT /api/projects/:pid` → ✅ 200
- `DELETE /api/projects/:pid` → ✅ 200

### Metamodelos (API)
- `GET /api/projects/:pid/metamodels` → ✅ 200
- `POST /api/projects/:pid/metamodels` → ✅ 201
- `GET /api/projects/:pid/metamodels/:mmid` → ✅ 200
- `PUT /api/projects/:pid/metamodels/:mmid` → ✅ 200
- `DELETE /api/projects/:pid/metamodels/:mmid` → ✅ 200
- `PUT /api/projects/:pid/metamodels/:mmid/content` → ✅ 200

### XMI/Import-Export (API)
- `GET /api/projects/:pid/xmi/:mmid/ecore` → ✅ 200 (XML XMI 2.0 válido)
- `GET /api/projects/:pid/xmi/:mmid/genmodel` → ✅ 200 (XML GenModel válido)
- `GET /api/projects/:pid/xmi/:mmid/zip` → ✅ 200 (ZIP con estructura Eclipse)
- `POST /api/projects/:pid/xmi/:mmid/import` → ✅ 201
- `POST /api/projects/:pid/xmi/:mmid/instance/import` → ✅
- `POST /api/projects/:pid/xmi/:mmid/instance/export` → ✅

### OCL Constraints (API)
- `GET /api/metamodels/:mmid/constraints` → ✅ 200
- `POST /api/metamodels/:mmid/constraints` → ✅ 201
- `GET /api/metamodels/:mmid/constraints/:id` → ✅ 200
- `PUT /api/metamodels/:mmid/constraints/:id` → ✅ 200
- `DELETE /api/metamodels/:mmid/constraints/:id` → ✅ 200
- `POST /api/metamodels/:mmid/constraints/validate` → ✅ 200

### Code Templates (API)
- `GET /api/metamodels/:mmid/templates` → ✅ 200
- `POST /api/metamodels/:mmid/templates` → ✅ 201
- `GET /api/metamodels/:mmid/templates/:id` → ✅ 200
- `PUT /api/metamodels/:mmid/templates/:id` → ✅ 200
- `DELETE /api/metamodels/:mmid/templates/:id` → ✅ 200
- `POST /api/metamodels/:mmid/templates/generate/predefined` → ✅ 200 (5 generadores)
- `POST /api/metamodels/:mmid/templates/:id/generate` → ✅ 400 si falta @main (comportamiento esperado)

### M1 Models (API)
- `GET /api/projects/:pid/metamodels/:mmid/models` → ✅ 200
- `POST /api/projects/:pid/metamodels/:mmid/models` → ✅ 201
- `DELETE /api/projects/:pid/metamodels/:mmid/models/:modelId` → ✅ 200

### UI (Frontend)
- Bienvenida con proyectos recientes → ✅
- New Project modal + creación → ✅
- Sidebar con árbol de proyectos → ✅
- Editor diagrama con nodos → ✅
- PropertyInspector (click en nodo) → ✅
- Editar nombre de EClass → ✅
- Añadir atributos → ✅
- Tabs (abrir/cerrar/navegar) → ✅
- Dark/Light mode toggle → ✅
- Toolbar (save, export, validate) → ✅
- Onboarding Tour → ✅
- Toasts → ✅

---

## Deploys Realizados

| # | Commit | Cambio | Estado |
|---|--------|--------|--------|
| 1 | `6150c42` | Auditoría anterior + 17 fixes | ✅ Desplegado |
| 2 | `bb5daf1` | Fix TDZ OnboardingTour | ✅ Desplegado |
| 3 | `ba867f0` | Fix XMI/ZIP export content.name | ✅ Desplegado |
| 4 | `3a33732` | Fix instance export/import content.name | ✅ Desplegado |
| 5 | `0e17096` | Fix nsURI/nsPrefix en instance export/import | ✅ Desplegado |
| 6 | `8b59354` | Fix theme persistence on F5 - script inline en index.html | ✅ Desplegado |

## Pendiente

- [ ] Configurar `FLY_API_TOKEN` en GitHub Secrets para CI/CD automático
- [ ] Implementar panel de Settings (actualmente solo muestra un toast)
- [ ] Validar nombres únicos al añadir atributos/referencias
- [ ] Tests unitarios para XMI service
