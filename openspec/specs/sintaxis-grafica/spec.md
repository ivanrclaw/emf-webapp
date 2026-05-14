# Spec: Editor de Sintaxis Gráfica (Sirius-like)

## ADDED: Especificación de Sintaxis

### Resumen
Permite definir cómo se renderizan visualmente los elementos de un modelo, de forma similar a Sirius pero en web.

### Formato de Especificación (JSON)
```json
{
  "name": "MiDiagrama",
  "domain": "http://ejemplo.com/1.0",
  "layers": [
    {
      "name": "Principal",
      "default": true,
      "mappings": [
        {
          "domainClass": "EClassName",
          "semanticCandidatesExpression": "self.referenceName",
          "style": {
            "shape": "rectangle|ellipse|diamond|image",
            "color": "#HEX",
            "borderColor": "#HEX",
            "borderSize": 2,
            "labelExpression": "self.name",
            "labelPosition": "inside|top|bottom"
          },
          "conditionnalStyles": [
            {
              "predicate": "self.active = true",
              "style": { "color": "#00FF00" }
            }
          ],
          "childrenMappings": [...],
          "edgeMappings": [
            {
              "domainClass": "ReferenceEClass",
              "sourceMapping": "EClassName",
              "targetMapping": "EClassName",
              "style": {
                "lineStyle": "solid|dash|dot|dash-dot",
                "sourceDecoration": "none|arrow|diamond|filled-diamond",
                "targetDecoration": "none|arrow|diamond|filled-diamond",
                "color": "#HEX",
                "labelExpression": "self.name"
              }
            }
          ]
        }
      ]
    }
  ],
  "tools": [
    {
      "id": "nuevo-agente",
      "label": "Nuevo Agente",
      "mapping": "Agente",
      "image": "icono-agente.svg"
    }
  ]
}
```

### Editor Visual de Especificación
- Panel de configuración de forma para cada EClass mapping
- Selector de color (color picker)
- Preview en vivo (el canvas se actualiza al cambiar la spec)
- Editor de expresiones semánticas (query language para seleccionar elementos del modelo)
- Editor de estilos condicionales

### Capas (Layers)
- Crear/renombrar/eliminar capas
- Activar/desactivar capas desde toolbar
- Cada capa puede tener sus propios mappings
- Las capas se combinan (overlay)

### Filtros
- Filtrar elementos según condiciones
- Ocultar/mostrar elementos seleccionados
- Filtros predefinidos: "Solo tareas humanas", "Solo enlaces activos"

### Paletas
- Toolbar de herramientas con tooltip
- Herramientas: crear nodo, crear edge, seleccionar, borrar, zoom
- Herramientas personalizadas por mapping
