# Plan: OCL Professional — Drop-in Eclipse Replacement

## Análisis de Gaps vs Eclipse OCL

| Área | Estado actual | Eclipse OCL |
|------|--------------|-------------|
| Parser | Expresiones sueltas | Complete OCL documents (package/context/inv/pre/post/def/body/init/derive) |
| Type System | Inexistente | Tipado fuerte con inferencia, conformance, 3-valued logic |
| Evaluator | ~60% operaciones | 100% standard library (String, Integer, Real, Collection, OclAny) |
| Validator | Solo sintaxis | Sintaxis + semántica + type-checking + error recovery |
| Autocompletado | Básico (1 nivel) | Type-aware con resolución de cadenas, signatures, hover |
| Editor | Campo de expresión | Complete OCL editor con document mode, markers, quick fixes |

---

## FASE 1: Motor de Tipos (Type System Engine)

**Objetivo:** Crear un sistema de tipos completo que sirva de base para validación y autocompletado.

**Fichero:** `packages/core/src/ocl/OCLTypeSystem.ts`

**Tareas:**
1. Definir jerarquía de tipos OCL completa:
   - Primitivos: `OclAny`, `Boolean`, `Integer`, `Real`, `UnlimitedNatural`, `String`
   - Especiales: `OclVoid`, `OclInvalid`
   - Colecciones: `Collection(T)`, `Set(T)`, `Bag(T)`, `Sequence(T)`, `OrderedSet(T)`
   - `Tuple(part1:T1, part2:T2, ...)`
   - Tipos de usuario (EClass del metamodelo)
   - Enumeraciones

2. Implementar reglas de conformance:
   - `Integer` conforms to `Real`
   - `UnlimitedNatural` conforms to `Integer`
   - `OclVoid` conforms to all (except `OclInvalid`)
   - `OclInvalid` conforms to all
   - Covarianza en colecciones
   - Conformance de Tuples (mismos part names, tipos conformantes)

3. Implementar Standard Library como catálogo de operaciones tipadas:
   - Cada tipo tiene sus operaciones con firma: `(paramTypes) → returnType`
   - String: `size()→Integer`, `concat(String)→String`, `substring(Integer,Integer)→String`, `indexOf(String)→Integer`, `toInteger()→Integer`, `toReal()→Real`, `toBoolean()→Boolean`, `matches(String)→Boolean`, `toUpperCase()→String`, `toLowerCase()→String`, `trim()→String`, `at(Integer)→String`, `characters()→Sequence(String)`, `startsWith(String)→Boolean`, `endsWith(String)→Boolean`, `equalsIgnoreCase(String)→Boolean`, `replaceAll(String,String)→String`, `substituteAll(String,String)→String`, `tokenize()→Sequence(String)`, `+`(String)→String, comparisons
   - Integer/Real: arithmetic, `abs()`, `floor()`, `round()`, `max(T)`, `min(T)`, `div(Integer)→Integer`, `mod(Integer)→Integer`, `toString()→String`
   - Boolean: `and`, `or`, `not`, `xor`, `implies` (con 3-valued logic)
   - Collection(T): `size()→Integer`, `isEmpty()→Boolean`, `notEmpty()→Boolean`, `includes(T)→Boolean`, `excludes(T)→Boolean`, `includesAll(Collection)→Boolean`, `excludesAll(Collection)→Boolean`, `count(T)→Integer`, `sum()→T`, `min()→T`, `max()→T`, `flatten()→Collection(T2)`, `product(Collection(T2))→Set(Tuple)`, `asSet()→Set(T)`, `asBag()→Bag(T)`, `asSequence()→Sequence(T)`, `asOrderedSet()→OrderedSet(T)`, `including(T)→C(T)`, `excluding(T)→C(T)`, `includingAll(Collection)→C(T)`, `excludingAll(Collection)→C(T)`, `selectByKind(Type)→C(Type)`, `selectByType(Type)→C(Type)`
   - Iteradores: `forAll`, `exists`, `select`, `reject`, `collect`, `collectNested`, `closure`, `sortedBy`, `any`, `one`, `isUnique`, `iterate`
   - Set: `union(Set)→Set`, `intersection(Set)→Set`, `-(Set)→Set`, `symmetricDifference(Set)→Set`
   - OrderedSet/Sequence: `first()→T`, `last()→T`, `at(Integer)→T`, `indexOf(T)→Integer`, `append(T)`, `prepend(T)`, `insertAt(Integer,T)`, `subSequence/subOrderedSet(Integer,Integer)`, `reverse()`
   - OclAny: `oclIsTypeOf(Type)→Boolean`, `oclIsKindOf(Type)→Boolean`, `oclAsType(Type)→Type`, `oclIsUndefined()→Boolean`, `oclIsInvalid()→Boolean`, `oclAsSet()→Set(Self)`, `oclType()→Type`, `toString()→String`

4. Implementar `OCLTypeInferenceEngine`:
   - Dado un AST + contexto (EClass) + metamodelo → inferir tipo de cada nodo
   - Resolver cadenas de navegación: `self.employees` → `Set(Employee)`, `self.employees.name` → `Bag(String)` (implicit collect)
   - Resolver tipo de retorno de operaciones de colección
   - Resolver tipo de iteradores (el body determina el tipo resultado)

**Tests (≥40):**
- Conformance rules (15 tests)
- Type inference para expresiones simples (10 tests)
- Type inference para cadenas de navegación (10 tests)
- Type inference para operaciones de colección (10 tests)
- Implicit collect type resolution (5 tests)

---

## FASE 2: Parser Completo — Complete OCL Documents

**Objetivo:** Soportar documentos OCL completos como en Eclipse (no solo expresiones sueltas).

**Ficheros:** `OCLLexer.ts`, `OCLParser.ts` (extender), nuevo `OCLDocumentParser.ts`

**Tareas:**
1. Extender el Lexer:
   - Token `TUPLE` para `Tuple{...}`
   - Token `AT_PRE` para `@pre`
   - Token `CARET` / `DOUBLE_CARET` para `^` y `^^` (OclMessage)
   - Token `STAR_LITERAL` para `*` (UnlimitedNatural)

2. Extender el Parser de expresiones:
   - Tuple literals: `Tuple{name:String='value', age:Integer=25}`
   - Acceso a partes de Tuple via `.partName`
   - `@pre` en postcondiciones
   - Multi-iterator: `forAll(i, j | body)`
   - Implicit collect: `self.employees.name` → CollectionOp(collect, source, body=name)
   - Type cast con paréntesis: `expr.oclAsType(SubClass).specificAttr`
   - Enum literals: `Status::ACTIVE`

3. Crear `OCLDocumentParser` para Complete OCL:
   ```
   OCLDocument → (PackageDecl | ContextDecl)*
   PackageDecl → 'package' QualifiedName ContextDecl* 'endpackage'
   ContextDecl → 'context' ClassifierContext ConstraintDef*
               | 'context' OperationContext ConstraintDef*
               | 'context' PropertyContext ConstraintDef*
   ClassifierContext → QualifiedName
   OperationContext → QualifiedName '::' OpName '(' Params ')' ':' Type
   PropertyContext → QualifiedName '::' PropName ':' Type
   ConstraintDef → InvDef | PreDef | PostDef | DefDef | InitDef | DeriveDef | BodyDef
   InvDef → 'inv' Name? ':' Expression
   PreDef → 'pre' Name? ':' Expression
   PostDef → 'post' Name? ':' Expression
   DefDef → 'def' ':' Name '(' Params? ')' ':' Type '=' Expression
          | 'def' ':' Name ':' Type '=' Expression
   InitDef → 'init' ':' Expression
   DeriveDef → 'derive' ':' Expression
   BodyDef → 'body' ':' Expression
   ```

4. AST nodes nuevos:
   - `OCLDocumentNode` (root con lista de package/context declarations)
   - `PackageDeclNode`
   - `ContextDeclNode` (classifier, operation, property)
   - `InvariantNode`, `PreConditionNode`, `PostConditionNode`
   - `DefNode` (helper attribute/operation)
   - `InitNode`, `DeriveNode`, `BodyNode`
   - `TupleLiteralNode`, `TupleTypeNode`
   - `AtPreNode`

**Tests (≥35):**
- Parsing de documentos OCL completos (10 tests)
- Tuple literals y acceso (5 tests)
- @pre en postcondiciones (3 tests)
- Multi-iterator (3 tests)
- Package declarations (5 tests)
- Def helpers (5 tests)
- Init/derive/body (4 tests)
- Error recovery y mensajes claros (5 tests)

---

## FASE 3: Evaluador Completo

**Objetivo:** Implementar TODAS las operaciones de la Standard Library OCL 2.4.

**Fichero:** `OCLEvaluator.ts` (refactor masivo)

**Tareas:**
1. Operaciones String faltantes:
   - `indexOf(s)`, `lastIndexOf(s)`, `at(i)` (1-based), `characters()`
   - `matches(regex)`, `replaceAll(regex, replacement)`, `replaceFirst(regex, replacement)`
   - `substituteAll(old, new)`, `substituteFirst(old, new)`
   - `equalsIgnoreCase(s)`, `trim()`
   - `toInteger()`, `toReal()`, `toBoolean()`
   - `tokenize()`, `tokenize(delimiters)`, `tokenize(delimiters, returnDelimiters)`
   - `+` como concatenación, comparisons `<`, `<=`, `>=`, `>`

2. Operaciones Collection faltantes:
   - `excludesAll(c)`, `count(obj)`, `product(c2)`
   - `selectByKind(type)`, `selectByType(type)`
   - `includingAll(c)`, `excludingAll(c)`
   - `symmetricDifference(s)` (Set)
   - `reverse()` (OrderedSet, Sequence)
   - `indexOf(obj)` (OrderedSet, Sequence)
   - `insertAt(index, obj)` (OrderedSet, Sequence)
   - `appendAll(c)`, `prependAll(c)` (OrderedSet, Sequence)

3. Semántica de null/invalid (3-valued logic):
   - `null.property` → `invalid` (excepto `oclIsUndefined`, `=`, `<>`)
   - `invalid` propaga en la mayoría de operaciones
   - `false and X` → `false` (short-circuit incluso si X es invalid)
   - `true or X` → `true` (short-circuit)
   - `null` como source de colección → `Bag{}`

4. Tuple support:
   - Evaluar `Tuple{...}` literals
   - Acceso a partes via `.partName`
   - Igualdad de Tuples (mismos parts, mismos valores)

5. `allInstances()` correcto:
   - Buscar todos los objetos del tipo dado (y subtipos) en el modelo completo
   - Requiere pasar el modelo completo al evaluador (no solo el contexto)

6. `@pre` en postcondiciones:
   - Almacenar estado previo antes de la operación
   - `expr@pre` evalúa `expr` en el estado anterior

7. Implicit collect:
   - `collection.property` → `collection->collect(e | e.property)`
   - Resultado: Bag (desde Set) o Sequence (desde OrderedSet/Sequence)

8. `result` en postcondiciones:
   - Variable especial que referencia el valor de retorno

**Tests (≥50):**
- String operations completas (15 tests)
- Collection operations nuevas (15 tests)
- 3-valued logic / null propagation (10 tests)
- Tuple evaluation (5 tests)
- allInstances (3 tests)
- Implicit collect (5 tests)
- @pre (3 tests)

---

## FASE 4: Validador Semántico (Type Checker)

**Objetivo:** Validación en tiempo real con errores precisos como Eclipse OCL.

**Fichero:** Nuevo `packages/core/src/ocl/OCLSemanticValidator.ts`

**Tareas:**
1. Type-checking completo:
   - Verificar que operaciones se aplican a tipos compatibles
   - `self.name + 5` → error: "Cannot apply '+' to String and Integer"
   - `self.employees->forAll(e | e.name > 5)` → error: "Cannot compare String with Integer"
   - `self.age->size()` → error: "Collection operation 'size' called on Integer (not a collection)"

2. Feature resolution:
   - Verificar que atributos/referencias existen en el EClass
   - `self.nonExistentAttr` → error: "Unknown feature 'nonExistentAttr' in class 'Person'"
   - Sugerir correcciones (did you mean?)

3. Validación de documentos Complete OCL:
   - Context class debe existir en el metamodelo
   - Operation context: operación debe existir con firma correcta
   - Property context: propiedad debe existir con tipo correcto
   - `result` solo válido en postcondiciones/body
   - `@pre` solo válido en postcondiciones

4. Error recovery:
   - No parar en el primer error
   - Reportar todos los errores encontrados con posiciones exactas (línea, columna)
   - Cada error tiene: message, severity (error/warning/info), range (startLine, startCol, endLine, endCol)

5. Warnings útiles:
   - Constraint siempre true/false (trivial)
   - Variable de iterador no usada
   - Shadowing de variables
   - Uso de operaciones deprecated (`toLower` → `toLowerCase`)

6. Integración con metamodelo:
   - Recibir metamodelo como input para resolver tipos de usuario
   - Resolver herencia (oclIsKindOf con supertypes)
   - Resolver multiplicidad (saber si una referencia es [*] → Collection o [1] → single)

**Tests (≥40):**
- Type errors detectados correctamente (15 tests)
- Feature resolution errors (10 tests)
- Document-level validation (5 tests)
- Error recovery (5 tests)
- Warnings (5 tests)
- Position accuracy (5 tests)

---

## FASE 5: Autocompletado Profesional

**Objetivo:** Autocompletado type-aware que resuelve cadenas completas, como Eclipse OCL.

**Fichero:** Refactor completo de la sección de completion en `OCLConstraintPage.tsx` → extraer a `packages/frontend/src/components/ocl/OCLCompletionProvider.ts`

**Tareas:**
1. Type-aware completion engine:
   - Resolver el tipo de la expresión ANTES del cursor
   - `self.employees->select(e | e.` → tipo del iterador es `Employee` → sugerir features de Employee
   - `self.name.` → tipo es `String` → sugerir operaciones de String
   - `self.employees->collect(e | e.salary).` → tipo es `Bag(Integer)` → sugerir ops de Bag + Integer
   - `self.employees->first().` → tipo es `Employee` → sugerir features

2. Resolución de cadenas profundas:
   - `self.department.manager.employees->` → resolver paso a paso
   - Soportar implicit collect: `self.employees.department.` → tipo es `Bag(Department)`

3. Context-sensitive suggestions:
   - Después de `->`: solo operaciones de colección
   - Después de `.` en colección: implicit collect + operaciones de colección
   - Después de `.` en objeto: features + operaciones OclAny
   - Después de `.` en String: operaciones de String
   - Después de `.` en Integer/Real: operaciones numéricas
   - En posición de tipo: sugerir EClasses, tipos primitivos, Collection types
   - En posición de iterador: sugerir nombre de variable
   - Después de `context`: sugerir EClasses del metamodelo
   - Después de `inv`/`pre`/`post`: sugerir `:` + nombre

4. Signature help (parameter hints):
   - Al escribir `(` después de una operación → mostrar firma
   - `substring(|)` → "substring(lower: Integer, upper: Integer): String"
   - Actualizar al escribir `,` para el siguiente parámetro

5. Hover information:
   - Sobre un feature: tipo, multiplicidad, documentación
   - Sobre una operación: firma completa, descripción
   - Sobre una keyword: explicación OCL
   - Sobre un tipo: jerarquía, features disponibles

6. Snippets inteligentes:
   - `inv` → template completo con nombre
   - `forAll` → con iterador y body placeholder
   - `let` → con tipo y body
   - `if` → con then/else/endif
   - `context` → con clase y constraint

**Tests (≥30):**
- Completion después de `.` con type resolution (10 tests)
- Completion después de `->` (5 tests)
- Completion en cadenas profundas (5 tests)
- Signature help (5 tests)
- Context-sensitive filtering (5 tests)

---

## FASE 6: Editor OCL Profesional (Complete OCL Mode)

**Objetivo:** Editor Monaco completo para documentos OCL, no solo expresiones sueltas.

**Ficheros:** Nuevo `packages/frontend/src/components/ocl/` (directorio completo)

**Tareas:**
1. Complete OCL Editor Mode:
   - Editor Monaco a pantalla completa para documentos `.ocl`
   - Syntax highlighting completo (Monarch grammar actualizada)
   - Soporte multi-constraint en un solo fichero
   - Numeración de líneas, minimap, breadcrumbs

2. Real-time validation markers:
   - Squiggles rojos/amarillos/azules en las posiciones exactas del error
   - Panel de problemas (como VS Code) con lista de errores/warnings
   - Click en error → navegar a la posición

3. Outline panel:
   - Árbol de estructura del documento OCL
   - Packages → Contexts → Constraints
   - Click para navegar

4. Quick fixes:
   - "Did you mean 'employees'?" → auto-corregir typo
   - "Add missing 'endif'" → insertar keyword faltante
   - "Change to 'toLowerCase()' (deprecated 'toLower')" → reemplazar

5. Formatting:
   - Auto-indent de documentos OCL
   - Alinear constraints
   - Normalizar espaciado

6. Dual mode en OCLConstraintPage:
   - **Expression mode** (actual): campo individual por constraint
   - **Document mode** (nuevo): editor completo con todo el fichero OCL
   - Sincronización bidireccional: editar en document mode actualiza las constraints individuales y viceversa
   - Toggle entre modos

7. Integración con el Ecore editor:
   - OCLValidationPanel mejorado: mostrar errores inline
   - Validación automática al cambiar el modelo
   - Indicador visual en el diagrama (nodos con constraints violadas resaltados)

**Tests (≥20):**
- Document parsing y rendering (5 tests)
- Validation markers posicionados correctamente (5 tests)
- Sync bidireccional expression↔document (5 tests)
- Quick fixes aplicados correctamente (5 tests)

---

## FASE 7: Integración E2E y Compatibilidad Eclipse

**Objetivo:** Garantizar que todo funciona junto y es compatible con Eclipse.

**Tareas:**
1. Import/Export de ficheros `.ocl`:
   - Importar ficheros Complete OCL de Eclipse
   - Exportar constraints como fichero `.ocl` compatible con Eclipse
   - Preservar formato y comentarios

2. OCL en anotaciones Ecore (OCLinEcore):
   - Constraints embebidas en el metamodelo como annotations
   - `@OCL(inv: "self.name.size() > 0")`
   - Sincronizar con la tabla de constraints

3. Validación batch:
   - Validar TODAS las constraints contra TODOS los modelos M1
   - Reporte completo con estadísticas
   - Export del reporte

4. Performance:
   - Debounce de validación (300ms)
   - Web Worker para parsing/validación pesada
   - Cache de resultados de type inference
   - Lazy evaluation para modelos grandes

5. Test suite de compatibilidad Eclipse:
   - 50+ expresiones OCL reales de proyectos Eclipse
   - Verificar que parsean, validan y evalúan igual que Eclipse OCL
   - Incluir edge cases: null propagation, collection nesting, herencia profunda

**Tests (≥50):**
- Compatibilidad Eclipse (30 tests con expresiones reales)
- Import/export roundtrip (5 tests)
- OCLinEcore annotations (5 tests)
- Performance benchmarks (5 tests)
- Validación batch (5 tests)

---

## Resumen de Entregables

| Fase | Ficheros principales | Tests | Dependencias |
|------|---------------------|-------|--------------|
| 1 | `OCLTypeSystem.ts` | ≥40 | Ninguna |
| 2 | `OCLDocumentParser.ts`, extensiones Parser/Lexer | ≥35 | Fase 1 |
| 3 | `OCLEvaluator.ts` refactor | ≥50 | Fase 2 |
| 4 | `OCLSemanticValidator.ts` | ≥40 | Fases 1+2 |
| 5 | `OCLCompletionProvider.ts` | ≥30 | Fases 1+4 |
| 6 | `components/ocl/*` | ≥20 | Fases 4+5 |
| 7 | Integration + compat | ≥50 | Todas |

**Total: ~265+ tests nuevos**
