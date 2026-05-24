# Eclipse Compatibility Plan — emf-webapp

## Objetivo
100% compatibilidad bidireccional con Eclipse EMF, Sirius, EuGENia, y Acceleo.
Un proyecto exportado desde emf-webapp debe ser importable en Eclipse tal cual, y viceversa.

## Sprint 1 — Exportación Eclipse (COMPLETADO ✓)
Commit: `2a191ef` — Desplegado en producción.

### Generadores implementados:
1. **GenmodelGenerator** → `.genmodel` XML
2. **CompleteOCLExporter** → `.ocl` Complete OCL
3. **EclipseProjectGenerator** → `.project`, `.classpath`, `MANIFEST.MF`, `plugin.xml`, `build.properties`
4. **SiriusOdesignGenerator** → `.odesign` VSM XML
5. **SiriusAirdGenerator** → `.aird` representaciones
6. **EuGENiaAnnotationGenerator** → `@gmf.*` annotations
7. **AcceleoMtlGenerator** → `.mtl` Acceleo modules

### Endpoint:
- `GET /api/projects/:id/export/eclipse` → ZIP con estructura Eclipse completa

### Tests: 36 nuevos (1399 total)

---

## Sprint 2 — Importación Eclipse → webapp
Parsers para importar proyectos Eclipse existentes.

### Tareas:
1. Parser .ecore XMI → SerializableEPackage (mejorar existente `parseEcoreXmi`)
2. Parser Complete OCL (.ocl) → OCLConstraint[]
3. Parser .odesign → ViewpointSpec JSON
4. Parser .xmi instances → M1Model content
5. Parser Eclipse project ZIP → crear proyecto completo
6. Endpoint `POST /api/projects/import/eclipse` (multipart upload)

---

## Sprint 3 — Emfatic (.emf) export/import
Formato textual legible para metamodelos Ecore.

### Tareas:
1. Emfatic serializer (SerializableEPackage → .emf text)
2. Emfatic parser (.emf text → SerializableEPackage)
3. Incluir .emf en el ZIP Eclipse export
4. Tests

---

## Sprint 4 — Frontend UI
Integrar export/import Eclipse en la interfaz.

### Tareas:
1. Botón "Export as Eclipse Project" en la página de proyecto
2. Botón "Import Eclipse Project" con drag-and-drop de ZIP
3. Selector de formato (JSON interno vs Eclipse)
4. Progress indicator para import/export
5. Preview de contenido del ZIP antes de importar

---

## Estructura del ZIP Eclipse exportado:
```
com.example.myproject/
├── .project
├── .classpath
├── META-INF/MANIFEST.MF
├── plugin.xml
├── build.properties
├── model/
│   ├── metamodel.ecore
│   ├── metamodel.genmodel
│   ├── metamodel.emf
│   └── constraints.ocl
├── description/
│   └── metamodel.odesign
├── instances/
│   ├── example.xmi
│   └── representations.aird
├── templates/
│   └── generate.mtl
├── src/
└── src-gen/
```
