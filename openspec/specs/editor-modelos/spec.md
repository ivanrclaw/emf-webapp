# Spec: Editor de Modelos (Instancias M1)

## ADDED: Editor de Instancias

### Resumen
Editor que carga un metamodelo .ecore y permite crear instancias (modelos M1) visualmente.

### Comportamiento
- Al cargar un metamodelo, se analizan los EClasses concretos (no abstractos, no interfaces)
- Cada EClass concreto se convierte en un tipo de nodo disponible en la paleta
- Al crear un nodo, se genera una instancia del EClass con valores por defecto
- El inspector muestra los atributos con controles según el tipo:
  - EString → input text
  - EInt → input number
  - EBoolean → checkbox/toggle
  - EEnum → dropdown
  - EDate → date picker
  - EBigDecimal → input number con decimales
- Las referencias se conectan con flechas, respetando:
  - containment: el destino se convierte en hijo
  - eOpposite: al conectar, la referencia inversa se auto-asigna
  - cardinalidad lowerBound/upperBound: validación en vivo

### Restricciones
- No se pueden crear instancias de EClasses abstractas
- Los valores deben coincidir con el tipo EDataType declarado
- Un objeto con EReference(containment=true) no puede tener dos padres
- Las cardinalidades se respetan (no añadir más elementos que upperBound)
- Los atributos required (lowerBound > 0) deben tener valor

### Exportación
- Exportar modelo como XMI con fragment paths compatibles con Eclipse
- Exportar como JSON (formato emfjson)
- Exportar como YAML (formato legible)
