/**
 * OCLValidator — Valida sintaxis de una expresión OCL y chequea tipado básico.
 */
import { OCLLexer } from './OCLLexer';
import { OCLParser } from './OCLParser';
export class OCLValidator {
    parser = new OCLParser();
    validate(expression) {
        const errors = [];
        if (!expression || expression.trim().length === 0) {
            errors.push({ message: 'Empty OCL expression', position: 0 });
            return errors;
        }
        // Lexer validation
        try {
            const lexer = new OCLLexer(expression);
            const tokens = lexer.tokenize();
            // Check for completely empty tokenization
            if (tokens.length <= 1 && expression.trim().length > 0) {
                errors.push({ message: 'Expression could not be tokenized', position: 0 });
                return errors;
            }
        }
        catch (e) {
            errors.push({
                message: `Lexer error: ${e instanceof Error ? e.message : String(e)}`,
                position: 0,
            });
            return errors;
        }
        // Parser validation
        try {
            this.parser.parse(expression);
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            // Extract position from message if present
            const posMatch = msg.match(/at position (\d+)/);
            const position = posMatch ? parseInt(posMatch[1]) : 0;
            errors.push({ message: msg, position });
        }
        return errors;
    }
    isValid(expression) {
        return this.validate(expression).length === 0;
    }
}
//# sourceMappingURL=OCLValidator.js.map