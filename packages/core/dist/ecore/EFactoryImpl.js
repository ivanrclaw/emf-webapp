/**
 * @emf-webapp/core — EFactoryImpl
 *
 * Implementación de EFactory con create(EClass), createFromString(EDataType, String),
 * convertToString(EDataType, Object).
 */
import { EModelElementImpl } from './EModelElementImpl.js';
export class EFactoryImpl extends EModelElementImpl {
    // ==========================================================
    // Almacenamiento
    // ==========================================================
    _ePackage = null;
    // ==========================================================
    // Propiedades de interfaz
    // ==========================================================
    /** DERIVED, transient */
    get ePackage() {
        if (this._ePackage === null) {
            throw new Error('EFactory is not contained in an EPackage');
        }
        return this._ePackage;
    }
    set ePackage(value) {
        this._ePackage = value;
    }
    // ==========================================================
    // Métodos
    // ==========================================================
    /**
     * Crea una nueva instancia de la EClass dada.
     * Usa eInvoke si la clase tiene un factory method, o intenta
     * instanciar dinámicamente.
     */
    create(eClass) {
        // Intentar con eInvoke (llamar al constructor si existe)
        try {
            const instanceClass = eClass.instanceClass;
            if (instanceClass && typeof instanceClass === 'function') {
                return new instanceClass();
            }
        }
        catch {
            // Fallback: no hay clase JS, continuar
        }
        // Crear un objeto genérico (DynamicEObject)
        // Por ahora, lanzamos error ya que necesitamos registro de mapeos
        throw new Error(`Cannot create instance of '${eClass.name}': no instance class registered`);
    }
    /**
     * Convierte un string literal a un valor del tipo EDataType.
     */
    createFromString(eDataType, literalValue) {
        const typeName = eDataType.name;
        switch (typeName) {
            case 'EString':
                return literalValue;
            case 'EBoolean':
                return literalValue.toLowerCase() === 'true';
            case 'EInt':
            case 'EShort':
            case 'EByte':
                return parseInt(literalValue, 10);
            case 'ELong':
                return parseInt(literalValue, 10);
            case 'EFloat':
                return parseFloat(literalValue);
            case 'EDouble':
                return parseFloat(literalValue);
            case 'EChar':
                return literalValue.length > 0 ? literalValue[0] : '\u0000';
            case 'EBigDecimal': {
                // Usar Number para simplicidad
                return parseFloat(literalValue);
            }
            case 'EBigInteger': {
                return parseInt(literalValue, 10);
            }
            case 'EDate': {
                return new Date(literalValue);
            }
            case 'EByteArray': {
                return new TextEncoder().encode(literalValue);
            }
            default: {
                // Si es un EEnum, buscar el literal
                if ('eLiterals' in eDataType) {
                    const enumType = eDataType;
                    const lit = enumType.getEEnumLiteral(literalValue);
                    if (lit) {
                        return lit;
                    }
                    // Intentar parsear como número (value del literal)
                    const numVal = parseInt(literalValue, 10);
                    if (!isNaN(numVal)) {
                        return enumType.getEEnumLiteral(numVal) ?? literalValue;
                    }
                }
                return literalValue;
            }
        }
    }
    /**
     * Convierte un valor de instancia a su representación string.
     */
    convertToString(eDataType, instanceValue) {
        if (instanceValue === null || instanceValue === undefined) {
            return '';
        }
        const typeName = eDataType.name;
        switch (typeName) {
            case 'EString':
                return String(instanceValue);
            case 'EBoolean':
            case 'EInt':
            case 'EShort':
            case 'EByte':
            case 'ELong':
            case 'EFloat':
            case 'EDouble':
                return String(instanceValue);
            case 'EChar':
                return String(instanceValue);
            case 'EBigDecimal':
            case 'EBigInteger':
                return String(instanceValue);
            case 'EDate':
                return instanceValue instanceof Date ? instanceValue.toISOString() : String(instanceValue);
            case 'EByteArray':
                return new TextDecoder().decode(instanceValue);
            default: {
                // Si es un EEnumLiteral, devolver el literal
                if (instanceValue && typeof instanceValue === 'object' && 'literal' in instanceValue) {
                    return instanceValue.literal;
                }
                return String(instanceValue);
            }
        }
    }
}
//# sourceMappingURL=EFactoryImpl.js.map