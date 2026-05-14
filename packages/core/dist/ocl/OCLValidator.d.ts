/**
 * OCLValidator — Valida sintaxis de una expresión OCL y chequea tipado básico.
 */
export interface OCLValidationError {
    message: string;
    position: number;
}
export declare class OCLValidator {
    private readonly parser;
    validate(expression: string): OCLValidationError[];
    isValid(expression: string): boolean;
}
//# sourceMappingURL=OCLValidator.d.ts.map