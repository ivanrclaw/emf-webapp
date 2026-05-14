# Spec: Motor de Validación OCL

## ADDED: Motor de Validación OCL

### Resumen
Motor de validación de restricciones OCL (Object Constraint Language) que evalúa invariants sobre modelos EMF.

### Gramática OCL Soportada

#### Expresiones Primitivas
- Literales: números, strings, booleanos, enumeraciones
- `self.atributo` — navegación a atributo
- `self.referencia` — navegación simple a referencia
- `self.referencia.atributo` — navegación encadenada

#### Operadores
- Aritméticos: `+`, `-`, `*`, `/`, `abs()`, `floor()`, `round()`
- Comparación: `=`, `<>`, `>`, `<`, `>=`, `<=`
- Lógicos: `and`, `or`, `not`, `xor`, `implies`
- String: `concat()`, `size()`, `substring()`, `toUpper()`, `toLower()`, `startsWith()`

#### Operaciones de Colección
- `->size()` — número de elementos
- `->isEmpty()` / `->notEmpty()`
- `->includes(element)`, `->excludes(element)`
- `->includesAll(collection)`
- `->forAll(x | expression)` — cuantificador universal
- `->exists(x | expression)` — cuantificador existencial
- `->select(x | expression)` — filtrar
- `->collect(x | expression)` — transformar (implicito en navegación)
- `->one(x | expression)` — exactamente uno
- `->isUnique(x | expression)` — todos distintos según expresión
- `->sortedBy(x | expression)` — ordenar
- `->any(x | expression)` — cualquiera que cumpla
- `->first()`, `->last()`, `->at(index)`

#### Navegación Implícita
- `self.agentes.tareas` ≡ `self.agentes->collect(a | a.tareas)->flatten()`

#### Type Operations
- `obj.oclIsTypeOf(EClassName)` — tipo exacto
- `obj.oclIsKindOf(EClassName)` — tipo o subtipo
- `obj.oclAsType(EClassName)` — casteo de tipo
- `obj.oclIsUndefined()` — si es null/undefined

#### Derivación
- Atributos derivados: `self.numTareas = self.tareas->size()`

### Arquitectura
- **OCLLexer**: tokeniza la expresión OCL
- **OCLParser**: genera AST (Abstract Syntax Tree)
- **OCLEvaluator**: recorre el AST contra el modelo, devuelve resultado booleano
- **OCLValidator**: valida el string OCL (errores sintácticos)

### UI de Constraints
- Tabla de constraints con nombre, contexto, expresión, severidad
- Editor de expresión OCL con autocompletado de features del contexto
- Vista de errores: lista con localización (elemento + feature) y mensaje
- Errores resaltados en el canvas (elementos en rojo)
- Validación automática al modificar modelo

### Modos de Validación
- **Manual**: botón "Validar ahora"
- **En vivo**: validación automática cada 2 segundos al editar
- **Batch**: validación completa de todo el modelo
