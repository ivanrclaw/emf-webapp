# Plan de Rework: Colaboración en Tiempo Real

## Diagnóstico del Estado Actual

### Arquitectura actual
- **Backend**: NestJS `CollaborationGateway` con Socket.IO, estado en memoria (`Map<string, RoomState>`)
- **Frontend**: `useCollaboration` hook + `RemoteCursors` overlay
- **Modelo de sync**: "Last Write Wins" — envía el modelo COMPLETO en cada cambio (`model-changed`)
- **Awareness**: Solo cursores (posición x,y) y "user-typing" genérico

### Problemas críticos identificados

| # | Problema | Impacto | Referencia Figma/Canva |
|---|---------|---------|------------------------|
| 1 | **Sin resolución de conflictos** — envía el modelo entero en cada cambio. Si dos usuarios editan simultáneamente, el último en enviar sobreescribe al otro | Pérdida de datos | Figma usa CRDTs, Canva usa OT |
| 2 | **Sin granularidad de operaciones** — no hay concepto de "operación" (add node, rename, move). Todo es un blob JSON completo | Ancho de banda explosivo, imposible hacer undo/redo colaborativo | Figma envía operaciones atómicas |
| 3 | **Estado solo en memoria** — si el servidor se reinicia, se pierde el estado de la sala. No hay persistencia de sesión | Pérdida total en deploy/crash | Figma persiste todo en servidor |
| 4 | **Sin awareness de selección** — no se ve qué nodo/edge está seleccionando otro usuario | Conflictos silenciosos | Figma muestra borde coloreado en elementos seleccionados |
| 5 | **Cursores sin transformación de viewport** — las coordenadas son absolutas, no se transforman con zoom/pan del canvas | Cursores desalineados | Figma transforma cursores al viewport de cada usuario |
| 6 | **Sin indicador de quién edita qué** — no hay "locks" suaves ni indicadores de edición activa en nodos | Ediciones simultáneas destructivas | Figma muestra avatar en el elemento siendo editado |
| 7 | **Sin reconexión con re-sync** — si se pierde la conexión, al reconectar no se garantiza estado consistente | Divergencia silenciosa | Figma re-sincroniza estado completo al reconectar |
| 8 | **Sin historial colaborativo** — no hay undo/redo que respete las operaciones de otros usuarios | UX confusa | Figma tiene undo por usuario que no deshace cambios ajenos |
| 9 | **Sin presencia offline** — no hay modo offline con reconciliación posterior | Inutilizable sin red estable | Figma permite editar offline y reconcilia |
| 10 | **Sin throttling de cursores** — cada mousemove emite un evento WS | Saturación de red | Figma throttlea a ~30fps con interpolación |

---

## Plan de Rework por Sprints

### Sprint 1: Fundación CRDT con Yjs
**Objetivo**: Reemplazar "last write wins" por un modelo CRDT que resuelve conflictos automáticamente.

**Tecnología**: [Yjs](https://yjs.dev/) — CRDT probado en producción (usado por Notion, Jupyter, BlockSuite)

**Tareas**:
1. Instalar `yjs`, `y-websocket`, `y-protocols` en backend y frontend
2. Definir el `Y.Doc` schema para el metamodelo:
   ```
   Y.Map("meta")     → { name, nsURI, nsPrefix }
   Y.Map("nodes")    → nodeId → Y.Map({ type, position, data })
   Y.Map("edges")    → edgeId → Y.Map({ source, target, type, data })
   Y.Map("awareness") → per-user state (cursor, selection, name, color)
   ```
3. Crear `YjsProvider` — wrapper que conecta Y.Doc ↔ WebSocket ↔ React Flow state
4. Reescribir `CollaborationGateway` como `y-websocket` provider (o usar `y-websocket` server directamente)
5. Migrar `useEcoreModel` para que lea/escriba desde Y.Doc en vez de estado local
6. Persistencia: guardar Y.Doc snapshots en SQLite (binary encoding) cada N segundos + on disconnect

**Resultado**: Edición simultánea sin pérdida de datos. Dos usuarios pueden mover nodos distintos o el mismo nodo sin conflicto.

---

### Sprint 2: Awareness Profesional
**Objetivo**: Presencia rica — cursores transformados, selección visible, indicadores de edición.

**Tareas**:
1. **Cursores con viewport transform**: Usar `Awareness` de Yjs para compartir cursor en coordenadas de canvas (no viewport). Cada cliente transforma al renderizar según su propio zoom/pan.
2. **Selección compartida**: Broadcast de `selectedNodeIds`/`selectedEdgeIds` via awareness. Renderizar borde coloreado (color del usuario) en nodos seleccionados por otros.
3. **Indicador de edición activa**: Cuando un usuario abre el PropertyInspector de un nodo, mostrar avatar + "Editando..." en ese nodo.
4. **Throttling inteligente**: Cursor updates a 30fps max con interpolación cubic en el receptor. Selection updates inmediatos.
5. **Avatares en toolbar**: Reescribir `CollaborationBadge` con avatares apilados, tooltip con nombre, indicador de actividad (idle/active/editing).
6. **Notificaciones de presencia**: Toast sutil al entrar/salir ("Iván se unió", "María se fue").

**Resultado**: Experiencia visual comparable a Figma — ves exactamente qué hace cada colaborador.

---

### Sprint 3: Operaciones Atómicas + Undo/Redo Colaborativo
**Objetivo**: Historial de operaciones granular con undo por usuario.

**Tareas**:
1. Definir operaciones atómicas del metamodelo:
   - `AddNode(type, position, data)`
   - `RemoveNode(nodeId)`
   - `MoveNode(nodeId, newPosition)`
   - `UpdateNodeData(nodeId, field, value)`
   - `AddEdge(type, source, target, data)`
   - `RemoveEdge(edgeId)`
   - `UpdateEdgeData(edgeId, field, value)`
   - `BatchOperation([...ops])` (para drag multi-select, etc.)
2. Implementar `UndoManager` de Yjs con scoping por usuario:
   - Cada usuario tiene su propio stack de undo
   - `Ctrl+Z` deshace TUS operaciones sin afectar las de otros
   - Las operaciones de otros se "rebasan" automáticamente (CRDT)
3. Integrar con React Flow: interceptar `onNodesChange`/`onEdgesChange` para generar operaciones atómicas en vez de diffs completos
4. Panel de historial (opcional): timeline visual de operaciones recientes con avatar del autor

**Resultado**: Undo/redo que funciona correctamente en contexto colaborativo. Nunca deshaces el trabajo de otro.

---

### Sprint 4: Persistencia y Reconexión Robusta
**Objetivo**: Estado duradero, reconexión sin pérdida, modo offline básico.

**Tareas**:
1. **Persistencia en servidor**: 
   - Guardar Y.Doc state vector en SQLite (tabla `collaboration_snapshots`)
   - Guardar incremental updates como log (tabla `collaboration_updates`)
   - Compactar log periódicamente (merge updates en snapshot)
2. **Reconexión con sync**:
   - Al reconectar, enviar state vector del cliente → servidor responde con diff
   - Yjs maneja esto nativamente con `Y.encodeStateAsUpdate` / `Y.applyUpdate`
3. **Modo offline básico**:
   - Detectar desconexión → seguir editando localmente en Y.Doc
   - Al reconectar → sync automático (Yjs merge)
   - Indicador visual: banner "Offline — cambios se sincronizarán al reconectar"
4. **Versionado**:
   - Guardar snapshots nombrados ("versiones") que el usuario puede restaurar
   - Diff visual entre versiones (highlight nodos añadidos/eliminados/modificados)
5. **Garbage collection**: Limpiar rooms inactivas (>30min sin usuarios) del memory, mantener en DB

**Resultado**: Cero pérdida de datos. Funciona offline. Reconexión transparente.

---

### Sprint 5: Locks Suaves + Resolución de Conflictos Visual
**Objetivo**: Prevenir conflictos en edición de propiedades, resolver los inevitables visualmente.

**Tareas**:
1. **Soft locks en PropertyInspector**:
   - Cuando un usuario edita un campo de un nodo, ese campo se marca como "locked" via awareness
   - Otros usuarios ven el campo con borde coloreado + "Editando: Iván" 
   - No bloquea — puedes editar igualmente, pero sabes que hay conflicto potencial
2. **Merge visual para texto**:
   - Campos de texto (name, etc.) usan `Y.Text` con cursores colaborativos
   - Edición simultánea del mismo campo funciona como Google Docs (character-level CRDT)
3. **Conflicto de posición**:
   - Si dos usuarios mueven el mismo nodo simultáneamente, el CRDT resuelve (last position wins per-axis)
   - Animación suave de "snap" cuando llega la posición del otro usuario
4. **Conflicto de estructura**:
   - Si usuario A borra un nodo que usuario B está editando → notificación + undo automático de la edición
   - Si usuario A añade edge a nodo que B borró → edge se elimina + notificación

**Resultado**: Conflictos manejados elegantemente sin pérdida de trabajo ni confusión.

---

### Sprint 6: Rendimiento y Escalabilidad
**Objetivo**: Soportar 10+ usuarios simultáneos con <50ms de latencia percibida.

**Tareas**:
1. **Compresión de updates**: Usar `Y.encodeStateAsUpdate` con encoding binario (no JSON)
2. **Batching de operaciones**: Agrupar cambios en frames de 16ms antes de broadcast
3. **Lazy awareness**: Solo enviar awareness de usuarios visibles en el viewport del receptor
4. **WebSocket binary frames**: Usar ArrayBuffer en vez de JSON para el transporte
5. **Connection pooling**: Un solo WebSocket por cliente, multiplexado por room
6. **Métricas**: 
   - Latencia de sync (p50, p95, p99)
   - Tamaño de updates por segundo
   - Número de conflictos resueltos
   - Memory usage del Y.Doc en servidor
7. **Load testing**: Simular 10 usuarios editando simultáneamente, medir degradación

**Resultado**: Rendimiento profesional. Edición fluida incluso con muchos colaboradores.

---

### Sprint 7: Features Premium
**Objetivo**: Diferenciadores que elevan la experiencia por encima del estándar.

**Tareas**:
1. **Follow mode**: "Seguir a Iván" — tu viewport sigue automáticamente el de otro usuario
2. **Comentarios en canvas**: Pins de comentario anclados a nodos/posiciones, con threads
3. **Modo presentación colaborativo**: Un usuario presenta, otros ven su viewport en tiempo real
4. **Permisos granulares**: Viewer (solo ve) / Editor (edita) / Owner (gestiona permisos)
5. **Activity feed**: Panel lateral con log de actividad reciente ("Iván movió Entidad", "María añadió RedSocial")
6. **Cursor chat**: Mensajes efímeros que aparecen junto al cursor (como Figma)
7. **Sesiones grabadas**: Replay de una sesión de edición (time-travel del Y.Doc)

---

## Stack Tecnológico Propuesto

| Capa | Actual | Propuesto |
|------|--------|-----------|
| Sync engine | Socket.IO + JSON blobs | **Yjs** (CRDT) + y-websocket |
| Transporte | Socket.IO (JSON) | **WebSocket nativo** (binary) via y-websocket |
| Awareness | Custom cursor events | **Yjs Awareness Protocol** |
| Persistencia | Ninguna (in-memory) | **SQLite** (Y.Doc snapshots + update log) |
| Undo/Redo | Local (no colaborativo) | **Yjs UndoManager** (per-user scoped) |
| Offline | No soportado | **IndexedDB** (y-indexeddb) + auto-sync |
| Conflictos | Last write wins | **CRDT merge** + soft locks + notificaciones |

## Dependencias Nuevas

```
# Backend
yjs                    # CRDT engine
y-protocols            # Sync/awareness protocols  
y-websocket            # WebSocket provider (o custom NestJS adapter)
lib0                   # Binary encoding utilities

# Frontend  
yjs                    # CRDT engine (shared)
y-websocket            # Client WebSocket provider
y-indexeddb            # Offline persistence
y-protocols            # Sync/awareness protocols
```

## Métricas de Éxito

- **Latencia de sync**: <100ms p95 para operaciones atómicas
- **Conflictos**: 0 pérdida de datos en edición simultánea
- **Reconexión**: <2s para re-sync completo tras desconexión
- **Offline**: Edición funcional sin red, sync automático al reconectar
- **Escalabilidad**: 10 usuarios simultáneos sin degradación perceptible
- **Bandwidth**: <5KB/s por usuario en edición activa (vs actual ~50KB/s con JSON blobs)

## Orden de Prioridad

1. **Sprint 1** (CRDT) — Elimina el problema fundamental de pérdida de datos
2. **Sprint 2** (Awareness) — Impacto visual inmediato, UX profesional
3. **Sprint 4** (Persistencia) — Robustez para uso real
4. **Sprint 3** (Undo/Redo) — UX crítica para productividad
5. **Sprint 5** (Locks) — Polish para edición de propiedades
6. **Sprint 6** (Rendimiento) — Necesario cuando haya usuarios reales
7. **Sprint 7** (Premium) — Diferenciadores competitivos

## Estimación

| Sprint | Complejidad | Archivos nuevos/modificados |
|--------|-------------|----------------------------|
| 1 | Alta | ~8 nuevos, ~5 modificados |
| 2 | Media | ~4 nuevos, ~3 modificados |
| 3 | Alta | ~3 nuevos, ~4 modificados |
| 4 | Media | ~4 nuevos, ~2 modificados |
| 5 | Media | ~3 nuevos, ~3 modificados |
| 6 | Media | ~2 nuevos, ~4 modificados |
| 7 | Alta | ~8 nuevos, ~3 modificados |
