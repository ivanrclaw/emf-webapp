/**
 * OCLParser — Construye un AST (Abstract Syntax Tree) a partir de tokens OCL.
 *
 * Gramática simplificada:
 *   expression        → orExpression
 *   orExpression       → xorExpression (("or" | "xor" | "implies") xorExpression)*
 *   xorExpression      → andExpression (("and" | "implies") andExpression)*
 *   andExpression      → notExpression (("and") notExpression)*
 *   notExpression      → "not" notExpression | comparisonExpression
 *   comparisonExpression → additiveExpression (("=" | "<>" | ">" | "<" | ">=" | "<=") additiveExpression)?
 *   additiveExpression → multiplicativeExpression (("+" | "-") multiplicativeExpression)*
 *   multiplicativeExpression → unaryExpression (("*" | "/") unaryExpression)*
 *   unaryExpression   → ("-" | "not")? primary
 *   primary           → literal | self | identifier (call chain)
 *   callChain         → ("." identifier | "->" operation | "(" args ")")*
 *   operation         → identifier ("(" args ")")?
 *   args              → expression ("," expression)*
 */
import { TokenType, OCLLexer } from './OCLLexer.js';
export class OCLParser {
    tokens = [];
    pos = 0;
    parse(input) {
        const lexer = new OCLLexer(input);
        this.tokens = lexer.tokenize();
        this.pos = 0;
        const ast = this.expression();
        this.expect(TokenType.EOF);
        return ast;
    }
    // For the validator: re-lex/re-parse but return null on failure
    tryParse(input) {
        try {
            return this.parse(input);
        }
        catch {
            return null;
        }
    }
    expression() {
        return this.orExpression();
    }
    orExpression() {
        let left = this.xorExpression();
        while (this.match(TokenType.OR) || this.match(TokenType.XOR)) {
            const op = this.previous().value;
            const right = this.xorExpression();
            left = { type: 'binary', operator: op, left, right };
        }
        return left;
    }
    xorExpression() {
        let left = this.andExpression();
        while (this.match(TokenType.XOR) || this.match(TokenType.IMPLIES)) {
            const op = this.previous().value;
            const right = this.andExpression();
            left = { type: 'binary', operator: op, left, right };
        }
        return left;
    }
    andExpression() {
        let left = this.notExpression();
        while (this.match(TokenType.AND)) {
            const op = this.previous().value;
            const right = this.notExpression();
            left = { type: 'binary', operator: op, left, right };
        }
        return left;
    }
    notExpression() {
        if (this.match(TokenType.NOT)) {
            const operand = this.notExpression();
            return { type: 'unary', operator: 'not', operand };
        }
        return this.comparisonExpression();
    }
    comparisonExpression() {
        let left = this.additiveExpression();
        if (this.match(TokenType.EQUALS) ||
            this.match(TokenType.NOT_EQUALS) ||
            this.match(TokenType.GT) ||
            this.match(TokenType.LT) ||
            this.match(TokenType.GTE) ||
            this.match(TokenType.LTE)) {
            const op = this.previous().value;
            const right = this.additiveExpression();
            left = { type: 'binary', operator: op, left, right };
        }
        return left;
    }
    additiveExpression() {
        let left = this.multiplicativeExpression();
        while (this.match(TokenType.PLUS) || this.match(TokenType.MINUS)) {
            const op = this.previous().value;
            const right = this.multiplicativeExpression();
            left = { type: 'binary', operator: op, left, right };
        }
        return left;
    }
    multiplicativeExpression() {
        let left = this.unaryExpression();
        while (this.match(TokenType.STAR) || this.match(TokenType.SLASH)) {
            const op = this.previous().value;
            const right = this.unaryExpression();
            left = { type: 'binary', operator: op, left, right };
        }
        return left;
    }
    unaryExpression() {
        if (this.match(TokenType.MINUS)) {
            const operand = this.unaryExpression();
            return { type: 'unary', operator: '-', operand };
        }
        return this.primary();
    }
    primary() {
        // Literals
        if (this.match(TokenType.NUMBER)) {
            return {
                type: 'literal',
                valueType: 'number',
                value: Number(this.previous().value),
            };
        }
        if (this.match(TokenType.STRING)) {
            return {
                type: 'literal',
                valueType: 'string',
                value: this.previous().value,
            };
        }
        if (this.match(TokenType.BOOLEAN)) {
            return {
                type: 'literal',
                valueType: 'boolean',
                value: this.previous().value === 'true',
            };
        }
        // self
        if (this.match(TokenType.SELF)) {
            let node = { type: 'self' };
            node = this.parseCallChain(node);
            return node;
        }
        // identifier initial
        if (this.match(TokenType.IDENTIFIER)) {
            const name = this.previous().value;
            // Function call: identifier(...)
            if (this.check(TokenType.LPAREN) && this.peek()?.type !== TokenType.ARROW) {
                this.advance(); // consume (
                const args = this.parseArgs();
                this.expect(TokenType.RPAREN);
                return this.parseCallChain({
                    type: 'methodcall',
                    object: { type: 'self' },
                    method: name,
                    args,
                });
            }
            let node = { type: 'identifier', name };
            node = this.parseCallChain(node);
            return node;
        }
        // Parenthesized expression
        if (this.match(TokenType.LPAREN)) {
            const expr = this.expression();
            this.expect(TokenType.RPAREN);
            const chainNode = this.parseCallChain(expr);
            return chainNode;
        }
        throw new Error(`Unexpected token '${this.peek()?.value ?? 'EOF'}' at position ${this.peek()?.position ?? -1}`);
    }
    parseCallChain(object) {
        let node = object;
        while (true) {
            // Dot navigation: .identifier
            if (this.match(TokenType.DOT)) {
                const name = this.expect(TokenType.IDENTIFIER).value;
                if (this.check(TokenType.LPAREN)) {
                    this.advance();
                    const args = this.parseArgs();
                    this.expect(TokenType.RPAREN);
                    node = { type: 'methodcall', object: node, method: name, args };
                }
                else {
                    // treat as method call with no args (property access is method with no args)
                    node = { type: 'methodcall', object: node, method: name, args: [] };
                }
                continue;
            }
            // Arrow operation: ->operation
            if (this.match(TokenType.ARROW)) {
                const opName = this.expect(TokenType.IDENTIFIER).value;
                // Lambda: ->forAll(x | expr), ->exists(x | expr), etc.
                if (['forAll', 'exists', 'select', 'collect', 'one', 'isUnique', 'sortedBy', 'any'].includes(opName)) {
                    this.expect(TokenType.LPAREN);
                    const iterator = this.expect(TokenType.IDENTIFIER).value;
                    if (this.match(TokenType.PIPE)) {
                        // explicit iterator
                        const body = this.expression();
                        this.expect(TokenType.RPAREN);
                        node = {
                            type: 'collectionop',
                            source: node,
                            operation: opName,
                            iterator,
                            body,
                        };
                    }
                    else {
                        // implicit or position-based — forAll(x), etc.
                        // treat as method call with the iterator name as argument
                        // Actually, standard OCL has forAll(x | expr) with pipe.
                        // But also: forAll(expr) with implicit iterator.
                        // Let's handle both:
                        // If we already consumed the iterator identifier, check if there's a pipe
                        // If no pipe, it might be a simple expression like forAll(x)
                        // Let's re-collect: We have IDENTIFIER (the iterator var name)
                        // See if next is PIPE
                        if (this.check(TokenType.PIPE)) {
                            this.advance();
                            const body = this.expression();
                            this.expect(TokenType.RPAREN);
                            node = {
                                type: 'collectionop',
                                source: node,
                                operation: opName,
                                iterator,
                                body,
                            };
                        }
                        else {
                            // The "body" is just `iterator` itself (simple expression)
                            const exprNode = { type: 'identifier', name: iterator };
                            this.expect(TokenType.RPAREN);
                            node = {
                                type: 'collectionop',
                                source: node,
                                operation: opName,
                                body: exprNode,
                            };
                        }
                    }
                }
                else {
                    // Simple arrow call: ->size(), ->isEmpty(), etc.
                    this.expect(TokenType.LPAREN);
                    const args = this.parseArgs();
                    this.expect(TokenType.RPAREN);
                    node = {
                        type: 'collectionop',
                        source: node,
                        operation: opName,
                        args,
                    };
                }
                continue;
            }
            break;
        }
        return node;
    }
    parseArgs() {
        const args = [];
        if (!this.check(TokenType.RPAREN)) {
            args.push(this.expression());
            while (this.match(TokenType.COMMA)) {
                args.push(this.expression());
            }
        }
        return args;
    }
    // ── Helpers ──────────────────────────────────────────────────────
    peek() {
        return this.tokens[this.pos];
    }
    check(type) {
        return this.peek()?.type === type;
    }
    advance() {
        if (this.pos >= this.tokens.length) {
            throw new Error('Unexpected end of expression');
        }
        return this.tokens[this.pos++];
    }
    match(type) {
        if (this.check(type)) {
            this.advance();
            return true;
        }
        return false;
    }
    previous() {
        return this.tokens[this.pos - 1];
    }
    expect(type) {
        if (!this.check(type)) {
            const found = this.peek();
            throw new Error(`Expected ${TokenType[type]} but found '${found?.value ?? 'EOF'}' at position ${found?.position ?? -1}`);
        }
        return this.advance();
    }
}
//# sourceMappingURL=OCLParser.js.map