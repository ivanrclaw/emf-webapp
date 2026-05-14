# Spec: Editor Visual de Metamodelos

## ADDED: Canvas de Diagrama Ecore

### Resumen
Editor visual para crear y modificar metamodelos .ecore mediante diagramas de clases UML con React Flow.

### Nodos
- **EClassNode**: visualiza un EClass con header (nombre, estereotipo), sección de atributos, sección de referencias
- **EEnumNode**: visualiza un EEnum con sus literales
- **EDataTypeNode**: visualiza un tipo de dato primitivo

### Conexiones
- **ReferenceEdge**: flecha entre dos EClassNodes (origen → destino), etiquetada con nombre de la referencia
- **ContainmentEdge**: flecha con diamante relleno (composición)
- **InheritanceEdge**: flecha con triángulo vacío (herencia)

### Paletas
- Toolbox lateral para arrastrar nuevos elementos al canvas
- Categorías: Clases, Enums, DataTypes, Referencias

### Panel de Propiedades (Inspector)
- Se activa al seleccionar un elemento del canvas
- Muestra formularios para editar propiedades del EObject seleccionado
- Para EClass: nombre, abstract, interface, eSuperTypes (selector múltiple)
- Para EAttribute: nombre, tipo (dropdown EDataTypes), lowerBound, upperBound, iD, defaultValue
- Para EReference: nombre, tipo destino (dropdown EClasses), containment toggle, eOpposite (dropdown referencias destino), upperBound

### Vista Árbol
- Panel lateral izquierdo con árbol jerárquico del EPackage
- Sincronizado con el canvas (seleccionar en árbol → seleccionar en canvas y viceversa)
- Drag & drop para reordenar EClasses y EStructuralFeatures

### Edición Inline
- Doble click en nombre de EClass → editable inline
- Click en "+" dentro de sección de atributos → nuevo EAttribute inline
- Click en "+" dentro de sección de referencias → nueva EReference inline

## ADDED: Panel de EAnnotations

### Resumen
Permite añadir metadatos (annotations) a cualquier elemento del metamodelo.

### Funcionalidad
- Añadir EAnnotation con source URI
- Editar pares clave-valor (details)
- Vistas predefinidas para: OCL constraints, GenModel, documentación

## ADDED: Validación del Metamodelo

### Reglas de Validación
- Nombres de EClass únicos dentro del EPackage
- Nombres de EStructuralFeature únicos dentro del EClass
- eOpposite debe ser bidireccional (si A apunta a B, B debe apuntar a A)
- No ciclos de herencia
- eType de EAttribute debe ser un EDataType (no EClass)
- eType de EReference debe ser un EClass (no EDataType)
- Containment requiere destino como raíz de árbol (no dos contenedores)
