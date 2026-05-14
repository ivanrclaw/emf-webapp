/**
 * @emf-webapp/core — Core Ecore Metametamodel
 *
 * Implementación TypeScript completa del metametamodelo Ecore
 * conforme a EMF 2.45.0 (febrero 2026).
 *
 * Referencia: https://download.eclipse.org/modeling/emf/emf/javadoc/latest/
 */
/** Tipos de evento de notificación */
export var EventType;
(function (EventType) {
    EventType[EventType["SET"] = 1] = "SET";
    EventType[EventType["UNSET"] = 2] = "UNSET";
    EventType[EventType["ADD"] = 3] = "ADD";
    EventType[EventType["REMOVE"] = 4] = "REMOVE";
    EventType[EventType["ADD_MANY"] = 5] = "ADD_MANY";
    EventType[EventType["REMOVE_MANY"] = 6] = "REMOVE_MANY";
    EventType[EventType["MOVE"] = 7] = "MOVE";
})(EventType || (EventType = {}));
// ============================================================
// EDataType — constantes para tipos primitivos
// ============================================================
export const EcoreDataTypes = {
    EString: 'EString',
    EBoolean: 'EBoolean',
    EInt: 'EInt',
    ELong: 'ELong',
    EFloat: 'EFloat',
    EDouble: 'EDouble',
    EByte: 'EByte',
    EByteArray: 'EByteArray',
    EChar: 'EChar',
    EShort: 'EShort',
    EBigDecimal: 'EBigDecimal',
    EBigInteger: 'EBigInteger',
    EDate: 'EDate',
    EObject: 'EObject',
    EJavaObject: 'EJavaObject',
    EJavaClass: 'EJavaClass',
};
//# sourceMappingURL=interfaces.js.map