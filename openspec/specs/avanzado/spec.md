# Spec: Colaboración, UX y Funcionalidades Avanzadas

## ADDED: Colaboración en Tiempo Real
- WebSocket para sincronización multiusuario
- CRDT (Conflict-free Replicated Data Types) para edición simultánea sin conflictos
- Cursor de otros usuarios visibles en canvas
- Indicador "X está editando este modelo"
- Sala de proyecto compartida

## ADDED: Historial de Versiones
- Snapshot automático cada 30 segundos o al detectar cambio significativo
- Vista de timeline de versiones
- Diff visual entre versiones (resaltado de cambios en canvas)
- Revertir a versión anterior

## ADDED: UX General
- Temas claro/oscuro con persistencia
- Atajos de teclado configurables
- Autoguardado cada 30 segundos
- Minimapa en canvas diagrama
- Grid y snapping
- Zoom y pan infinito
- Tooltips informativos en todos los controles
- Tutorial interactivo integrado (primera vez)
- Vistas: diagrama, árbol, código, split
- Pestañas múltiples para abrir varios modelos/diagramas

## ADDED: Integración y Despliegue
- CLI npm: `emf-web generate --model model.xmi --template template.mtl --output ./out`
- API pública REST documentada con OpenAPI
- Webhooks: POST a URL cuando modelo cambia o se genera código
- Sistema de plugins: generar código con scripts externos
- Compatibilidad XMI 100% con Eclipse EMF
- Despliegue Fly.io con SSL, backups automáticos
- Exportar/Importar proyectos como ZIP

## ADDED: Rendimiento
- Virtualización de canvas para modelos grandes (10k+ nodos)
- Lazy loading de modelos
- Compresión de datos en WebSocket
- Indexación de modelos para búsqueda rápida
- Paginación server-side en listas de proyectos
