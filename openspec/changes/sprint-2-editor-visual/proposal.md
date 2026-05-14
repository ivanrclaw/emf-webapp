# Propuesta: Sprint 2 — Editor Visual de Metamodelos

## Motivación
Sobre el core Ecore implementado en Sprint 1, necesitamos un editor visual que permita crear y modificar metamodelos .ecore mediante diagramas de clases UML, usando React Flow (xyflow). Esto es el corazón de la experiencia de usuario de EMF-webapp.

## Alcance
1. Canvas de diagrama Ecore con React Flow (nodos, conexiones, paletas)
2. Nodos personalizados: EClassNode, EEnumNode, EDataTypeNode
3. Conexiones personalizadas: ReferenceEdge, ContainmentEdge, InheritanceEdge
4. Toolbox lateral para arrastrar nuevos elementos
5. Panel de Propiedades (Inspector) para editar elementos seleccionados
6. Vista Árbol jerárquica del EPackage sincronizada con el canvas
7. Edición inline (doble click, botones "+")
8. Panel de EAnnotations
9. Validación del metamodelo en cliente
10. Backend: endpoint para actualizar contenido del metamodelo desde el editor
11. Integración en la navegación (ruta /projects/:pid/metamodels/:mmid/edit)

## Tareas
- [EMF-011] Instalar @xyflow/react y configurar canvas base
- [EMF-012] Crear tipos del editor (EcoreNodeData, EcoreEdgeData, etc.)
- [EMF-013] Implementar EClassNode (header, atributos, referencias)
- [EMF-014] Implementar EEnumNode con literales
- [EMF-015] Implementar EDataTypeNode
- [EMF-016] Implementar ReferenceEdge, ContainmentEdge, InheritanceEdge
- [EMF-017] Implementar Toolbox (paleta lateral arrastrable)
- [EMF-018] Implementar PropertyInspector (formularios por tipo de elemento)
- [EMF-019] Implementar TreeView (árbol jerárquico sincronizado)
- [EMF-020] Implementar edición inline (doble click, botones "+")
- [EMF-021] Implementar EAnnotationsPanel
- [EMF-022] Implementar validación del metamodelo
- [EMF-023] Backend: endpoint PUT content del metamodelo
- [EMF-024] Integrar editor en App.tsx y ProjectDetail.tsx
- [EMF-025] Tests de integración del editor

## Diseño Técnico
- `packages/frontend/src/components/ecore-diagram/`: todos los componentes del editor
  - `EcoreEditor.tsx`: página principal del editor
  - `EcoreCanvas.tsx`: canvas React Flow con lógica de sync
  - `types.ts`: interfaces del editor
  - `nodes/EClassNode.tsx`, `EEnumNode.tsx`, `EDataTypeNode.tsx`
  - `edges/CustomEdges.tsx`
  - `Toolbox.tsx`, `PropertyInspector.tsx`, `TreeView.tsx`
  - `EAnnotationsPanel.tsx`, `validation.ts`
  - `useEcoreModel.ts`: hook para gestionar el modelo Ecore
- El `content` del metamodelo se serializa como JSON con estructura Ecore nativa
- Sincronización bidireccional: canvas ↔ árbol ↔ inspector ↔ modelo interno

## No Incluye
- Editor de instancias M1 (Sprint 3)
- Editor de sintaxis gráfica Sirius-like (Sprint 4)
- Validación OCL (Sprint 5)
- Generación de código Acceleo (Sprint 6)
