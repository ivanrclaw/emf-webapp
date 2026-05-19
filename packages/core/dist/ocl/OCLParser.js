/**
 * OCLParser — Construye un AST (Abstract Syntax Tree) a partir de tokens OCL.
 *
 * Gramática extendida:
 *   expression            → letExpression | ifExpression | orExpression
 *   letExpression         → "let" IDENTIFIER (":" type)? "=" expression "in" expression | orExpression
 *   ifExpression          → "if" expression "then" expression "else" expression "endif" | orExpression
 *   orExpression          → xorExpression (("or" | "xor") xorExpression)*
 *   xorExpression         → andExpression (("xor" | "implies") andExpression)*
 *   andExpression         → notExpression ("and" notExpression)*
 *   notExpression         → "not" notExpression | comparisonExpression
 *   comparisonExpression  → additiveExpression (("=" | "<>" | ">" | "<" | ">=" | "<=") additiveExpression)?
 *   additiveExpression    → multiplicativeExpression (("+" | "-") multiplicativeExpression)*
 *   multiplicativeExpression → unaryExpression (("*" | "/" | "div" | "mod") unaryExpression)*
 *   unaryExpression       → ("-" | "not")? primary
 *   primary               → literal | self | "(" expression ")" | collectionLiteral | qualifiedName (call chain)
 *   collectionLiteral     → ("Set" | "Bag" | "Sequence" | "OrderedSet") "{" args "}"
 *   qualifiedName         → IDENTIFIER ("::" IDENTIFIER)*
 *   callChain             → ("." identifier | "->" operation | "(" args ")")*
 *   operation             → identifier (("(" args ")")? | lambdaOp | iterateOp)
 *   lambdaOp              → "(" IDENTIFIER (":" type)? ( "|" expression )? ")"
 *   iterateOp             → "(" IDENTIFIER (":" type)? ";" IDENTIFIER (":" type)? "=" expression "|" expression ")"
 *   args                  → expression ("," expression)*
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
    // ── Expression levels ───────────────────────────────────────────
    expression() {
        // let x = expr in body
        if (this.match(TokenType.LET)) {
            return this.parseLetIn();
        }
        // if cond then expr else expr endif
        if (this.match(TokenType.IF)) {
            return this.parseIfThenElse();
        }
        return this.orExpression();
    }
    parseLetIn() {
        const varName = this.expect(TokenType.IDENTIFIER).value;
        // Optional type annotation
        let varType;
        if (this.match(TokenType.COLON)) {
            varType = this.parseQualifiedType();
        }
        this.expect(TokenType.EQUALS);
        const initExpr = this.expression();
        this.expect(TokenType.IN);
        const bodyExpr = this.expression();
        return {
            type: 'letin',
            varName,
            varType,
            initExpr,
            bodyExpr,
        };
    }
    parseIfThenElse() {
        const condition = this.expression();
        this.expect(TokenType.THEN);
        const thenExpr = this.expression();
        this.expect(TokenType.ELSE);
        const elseExpr = this.expression();
        this.expect(TokenType.ENDIF);
        return {
            type: 'if',
            condition,
            thenExpr,
            elseExpr,
        };
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
        while (this.match(TokenType.STAR) ||
            this.match(TokenType.SLASH) ||
            this.match(TokenType.DIV) ||
            this.match(TokenType.MOD)) {
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
        if (this.match(TokenType.NOT)) {
            const operand = this.unaryExpression();
            return { type: 'unary', operator: 'not', operand };
        }
        return this.primary();
    }
    primary() {
        // Literals
        if (this.match(TokenType.NUMBER)) {
            let node = {
                type: 'literal',
                valueType: 'number',
                value: Number(this.previous().value),
            };
            node = this.parseCallChain(node);
            return node;
        }
        if (this.match(TokenType.STRING)) {
            let node = {
                type: 'literal',
                valueType: 'string',
                value: this.previous().value,
            };
            node = this.parseCallChain(node);
            return node;
        }
        if (this.match(TokenType.BOOLEAN)) {
            let node = {
                type: 'literal',
                valueType: 'boolean',
                value: this.previous().value === 'true',
            };
            node = this.parseCallChain(node);
            return node;
        }
        if (this.match(TokenType.NULL)) {
            let node = {
                type: 'literal',
                valueType: 'null',
                value: null,
            };
            node = this.parseCallChain(node);
            return node;
        }
        if (this.match(TokenType.INVALID)) {
            let node = {
                type: 'literal',
                valueType: 'invalid',
                value: null,
            };
            node = this.parseCallChain(node);
            return node;
        }
        // self
        if (this.match(TokenType.SELF)) {
            let node = { type: 'self' };
            node = this.parseCallChain(node);
            return node;
        }
        // identifier or qualified name (MyEnum::LITERAL)
        if (this.match(TokenType.IDENTIFIER)) {
            const name = this.previous().value;
            // Check for qualified names via ::
            if (this.check(TokenType.COLON_COLON)) {
                return this.parseQualifiedIdentifier(name);
            }
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
        // Collection type keywords as identifier-like usage
        // Set{...}, Bag{...}, Sequence{...}, OrderedSet{...}
        if (this.isCollectionTypeKeyword()) {
            return this.parseCollectionLiteral();
        }
        // Tuple literal: Tuple{name:String='value', age:Integer=25}
        if (this.match(TokenType.TUPLE)) {
            if (this.check(TokenType.LBRACE)) {
                return this.parseTupleLiteral();
            }
            // Tuple used as type name (identifier-like)
            let node = { type: 'identifier', name: 'Tuple' };
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
    parseQualifiedIdentifier(firstPart) {
        const parts = [firstPart];
        while (this.match(TokenType.COLON_COLON)) {
            const next = this.expect(TokenType.IDENTIFIER).value;
            parts.push(next);
        }
        const qualifiedName = parts.join('::');
        let node = { type: 'identifier', name: qualifiedName };
        node = this.parseCallChain(node);
        return node;
    }
    /** Parse a type annotation (e.g., "String", "ecore::EClass") */
    parseQualifiedType() {
        const first = this.expect(TokenType.IDENTIFIER).value;
        const parts = [first];
        while (this.match(TokenType.COLON_COLON)) {
            const next = this.expect(TokenType.IDENTIFIER).value;
            parts.push(next);
        }
        return parts.join('::');
    }
    isCollectionTypeKeyword() {
        return (this.check(TokenType.SET) ||
            this.check(TokenType.BAG) ||
            this.check(TokenType.SEQUENCE) ||
            this.check(TokenType.ORDERED_SET));
    }
    getCollectionTypeKeyword() {
        const kw = this.peek();
        if (!kw)
            return null;
        switch (kw.type) {
            case TokenType.SET: return 'Set';
            case TokenType.BAG: return 'Bag';
            case TokenType.SEQUENCE: return 'Sequence';
            case TokenType.ORDERED_SET: return 'OrderedSet';
            default: return null;
        }
    }
    /** Parse Set{ expr, ... }, Bag{ expr, ... }, etc. */
    parseCollectionLiteral() {
        const ct = this.getCollectionTypeKeyword();
        if (!ct)
            throw new Error('Expected collection type keyword');
        this.advance(); // consume the keyword
        this.expect(TokenType.LBRACE);
        const elements = this.parseArgs();
        this.expect(TokenType.RBRACE);
        let node = {
            type: 'collectionliteral',
            collectionType: ct,
            elements,
        };
        // Allow call chain on the literal (e.g., Set{1,2}->size())
        node = this.parseCallChain(node);
        return node;
    }
    parseCallChain(object) {
        let node = object;
        while (true) {
            // Dot navigation: .identifier (or keyword used as property/method name)
            if (this.match(TokenType.DOT)) {
                const name = this.expectOperationName();
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
                const opName = this.expectOperationName();
                // Lambda-based operations: ->forAll(x | expr), ->exists(x | expr), ->select(x | expr),
                // ->collect(x | expr), ->one(x | expr), ->isUnique(x | expr), ->sortedBy(x | expr),
                // ->any(x | expr), ->reject(x | expr), ->closure(x | expr), ->collectNested(x | expr)
                if (['forAll', 'exists', 'select', 'collect', 'one', 'isUnique', 'sortedBy', 'any',
                    'reject', 'closure', 'collectNested'].includes(opName)) {
                    node = this.parseLambdaOperation(node, opName);
                    continue;
                }
                // ->iterate(iter : Type; acc : Type = init | body)
                if (opName === 'iterate') {
                    node = this.parseIterateOperation(node);
                    continue;
                }
                // Simple arrow call: ->size(), ->isEmpty(), ->sum(), ->min(), ->max(), ->flatten()
                // or ->at(i), ->includes(x), etc.
                this.expect(TokenType.LPAREN);
                const args = this.parseArgs();
                this.expect(TokenType.RPAREN);
                node = {
                    type: 'collectionop',
                    source: node,
                    operation: opName,
                    args,
                };
                continue;
            }
            // @pre suffix (postconditions)
            if (this.match(TokenType.AT_PRE)) {
                node = { type: 'atpre', expression: node };
                continue;
            }
            break;
        }
        return node;
    }
    parseTupleLiteral() {
        this.expect(TokenType.LBRACE);
        const parts = [];
        if (!this.check(TokenType.RBRACE)) {
            parts.push(this.parseTuplePart());
            while (this.match(TokenType.COMMA)) {
                parts.push(this.parseTuplePart());
            }
        }
        this.expect(TokenType.RBRACE);
        let node = { type: 'tupleliteral', parts };
        node = this.parseCallChain(node);
        return node;
    }
    parseTuplePart() {
        const name = this.expect(TokenType.IDENTIFIER).value;
        let type;
        // Optional type: name : Type = value  OR  name = value
        if (this.check(TokenType.COLON)) {
            this.advance();
            type = this.parseQualifiedType();
        }
        this.expect(TokenType.EQUALS);
        const value = this.expression();
        return { name, type, value };
    }
    parseLambdaOperation(source, opName) {
        this.expect(TokenType.LPAREN);
        const iterator = this.expect(TokenType.IDENTIFIER).value;
        // Optional type annotation on iterator
        if (this.match(TokenType.COLON)) {
            this.parseQualifiedType(); // consume but ignore type for now
        }
        if (this.match(TokenType.PIPE)) {
            // explicit iterator: forAll(x | expr)
            const body = this.expression();
            this.expect(TokenType.RPAREN);
            return {
                type: 'collectionop',
                source,
                operation: opName,
                iterator,
                body,
            };
        }
        else {
            // No pipe: the iterator variable IS the body (e.g., forAll(x) means forAll(x | x))
            // Or it could be a simple expression like collect(x.property)
            // Check if next is RPAREN — if so, it's simple iteration
            if (this.check(TokenType.RPAREN)) {
                this.advance(); // consume )
                const exprNode = { type: 'identifier', name: iterator };
                return {
                    type: 'collectionop',
                    source,
                    operation: opName,
                    body: exprNode,
                };
            }
            else {
                // It's collect(x.property) style — the iterator variable was already consumed
                // Let's treat what follows as a property chain on the iterator
                // Parse the rest up to RPAREN as the body, using implicit iterator name
                const body = this.parseImplicitBody(iterator);
                this.expect(TokenType.RPAREN);
                return {
                    type: 'collectionop',
                    source,
                    operation: opName,
                    iterator,
                    body,
                };
            }
        }
    }
    /**
     * Parse a "body" that starts with a dot-chain on an implicit iterator variable.
     * e.g., in "collect(x.name)", after consuming "x", we see ".name" which becomes
     * the body expression "x.name".
     */
    parseImplicitBody(iteratorName) {
        let node = { type: 'identifier', name: iteratorName };
        // Parse dot chain and arrow chain
        node = this.parseCallChain(node);
        return node;
    }
    parseIterateOperation(source) {
        this.expect(TokenType.LPAREN);
        // Iterator variable
        const iterator = this.expect(TokenType.IDENTIFIER).value;
        // Optional iterator type
        if (this.match(TokenType.COLON)) {
            this.parseQualifiedType(); // consume type
        }
        // Semicolon separator
        this.expect(TokenType.SEMI);
        // Accumulator variable
        const accName = this.expect(TokenType.IDENTIFIER).value;
        // Optional accumulator type
        if (this.match(TokenType.COLON)) {
            this.parseQualifiedType(); // consume type
        }
        // = and initial value
        this.expect(TokenType.EQUALS);
        const initExpr = this.expression();
        // Pipe separator
        this.expect(TokenType.PIPE);
        const body = this.expression();
        this.expect(TokenType.RPAREN);
        return {
            type: 'collectionop',
            source,
            operation: 'iterate',
            iterator,
            body,
            iterAcc: accName,
            iterInit: initExpr,
        };
    }
    parseArgs() {
        const args = [];
        if (!this.check(TokenType.RPAREN) && !this.check(TokenType.RBRACE)) {
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
    /**
     * After '->', accept IDENTIFIER or any keyword token that is also a valid
     * collection operation name (reject, closure, etc.).
     */
    expectOperationName() {
        const token = this.peek();
        if (!token) {
            throw new Error('Expected operation name but found EOF');
        }
        // Accept IDENTIFIER directly
        if (token.type === TokenType.IDENTIFIER) {
            return this.advance().value;
        }
        // Accept keywords that double as operation names
        const keywordOps = [
            TokenType.REJECT, TokenType.CLOSURE,
            TokenType.NOT, TokenType.AND, TokenType.OR,
            TokenType.IF, TokenType.LET,
        ];
        if (keywordOps.includes(token.type)) {
            return this.advance().value;
        }
        // Any other keyword — just take its value as an identifier
        // This handles future keywords gracefully
        if (token.value && /^[a-zA-Z_]/.test(token.value)) {
            return this.advance().value;
        }
        throw new Error(`Expected operation name but found '${token.value ?? 'EOF'}' at position ${token.position ?? -1}`);
    }
}
//# sourceMappingURL=OCLParser.js.map