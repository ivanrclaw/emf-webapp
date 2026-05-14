# Spec: Motor de Generación de Código (Acceleo-like)

## ADDED: Motor de Plantillas M2T

### Resumen
Sistema de generación de código basado en plantillas que itera sobre modelos EMF para producir texto arbitrario.

### Formato de Plantillas

#### Sintaxis MTL-like
```
[comment encoding = UTF-8 /]
[module generate('http://mi.modelo/1.0')/]

[template public generateModel(aRoot : RootEClass)]
[comment @main/]
[file ('output.html', false, 'UTF-8')]
<html>
<head><title>[aRoot.name/]</title></head>
<body>
  [for (aChild : ChildType | aRoot.children)]
  <div class="child">
    <h2>[aChild.name/]</h2>
    [if (aChild.active)]
    <p>ACTIVE</p>
    [else]
    <p>INACTIVE</p>
    [/if]
  </div>
  [/for]
</body>
</html>
[/file]
[/template]
```

#### Estructura de Template
- **Module**: declara el NS URI del EPackage destino
- **Template**: función que recibe un parámetro tipado (EClass)
- **File**: produce un archivo de salida con nombre y encoding
- **Expressions**: acceso a atributos `[obj.name/]`
- **For**: iteración sobre colecciones
- **If/Else**: condicionales
- **Protected areas**: regiones preservadas en regeneración

### Editor de Plantillas
- Monaco Editor con resaltado de sintaxis MTL
- Autocompletado de features del EClass contexto
- Resaltado de errores de sintaxis en vivo
- Vista previa en panel dividido (template a la izquierda, resultado a la derecha)

### Generadores Predefinidos

#### generateHTML
- Documentación HTML del metamodelo
- Página por EClass con atributos, referencias, herencia
- Enlaces de navegación entre páginas
- CSS incluido

#### generateSQL
- CREATE TABLE por EClass
- Columnas para EAttributes con tipos SQL mapeados
- Foreign Keys para EReferences
- Índices para IDs

#### generateTypescript
- Interfaces TS por EClass
- Propiedades con tipos correctos (EString→string, EInt→number, EBoolean→boolean)
- Enums como union types o TypeScript enums
- nullables para upperBound=0 opcionales
- Arrays para upperBound=-1

#### generateJSONSchema
- Schema JSON por EPackage
- Propiedades con tipos correctos
- required para lowerBound>0
- items para arrays
- $ref para referencias entre schemas

#### generatePlantUML
- Diagrama de clases PlantUML
- Relaciones con estereotipos (composition, inheritance, reference)

### Motor de Ejecución
- **Parser**: analiza sintaxis MTL, genera AST de templates
- **Binder**: conecta el modelo EMF con las variables de template
- **Executor**: recorre el AST, expande bucles, evalúa condicionales, genera output
- **File Manager**: gestiona múltiples archivos de salida, evita overwrites

### API de Generación
```
POST /api/projects/:pid/generate
Body: {
  modelId: string,
  templateId: string,
  params?: Record<string, string>
}
Response: {
  files: [{ name: string, content: string }]
}
```
