/**
 * OCLDocumentParser — Parser para documentos OCL completos (Complete OCL)
 *
 * Soporta la gramática completa de documentos OCL 2.4:
 * - package/endpackage declarations
 * - context (classifier, operation, property)
 * - inv, pre, post, def, init, derive, body
 * - Tuple literals y tipos
 * - @pre en postcondiciones
 * - Multi-iterator (forAll(i, j | body))
 */
import { OCLLexer, TokenType } from './OCLLexer.js';
import { OCLParser } from './OCLParser.js';
// ── Document Parser ─────────────────────────────────────────────────
export class OCLDocumentParser {
    tokens = [];
    pos = 0;
    errors = [];
    exprParser = new OCLParser();
    /**
     * Parse a complete OCL document string.
     */
    parse(input) {
        const lexer = new OCLLexer(input);
        this.tokens = lexer.tokenize();
        this.pos = 0;
        this.errors = [];
        const declarations = [];
        while (!this.isAtEnd()) {
            try {
                if (this.check(TokenType.PACKAGE)) {
                    declarations.push(this.parsePackage());
                }
                else if (this.check(TokenType.CONTEXT)) {
                    declarations.push(this.parseContext());
                }
                else {
                    // Skip unknown tokens with error recovery
                    const tok = this.peek();
                    this.addError(`Unexpected token '${tok.value}' — expected 'package' or 'context'`, tok.position, true);
                    this.advance();
                }
            }
            catch (e) {
                // Error recovery: skip to next context/package/EOF
                this.recoverToNextDeclaration();
            }
        }
        return {
            document: { type: 'document', declarations },
            errors: this.errors,
        };
    }
    // ── Package ─────────────────────────────────────────────────────────
    parsePackage() {
        this.expect(TokenType.PACKAGE);
        const name = this.parseQualifiedName();
        const contexts = [];
        while (!this.isAtEnd() && !this.check(TokenType.ENDPACKAGE)) {
            if (this.check(TokenType.CONTEXT)) {
                contexts.push(this.parseContext());
            }
            else {
                const tok = this.peek();
                this.addError(`Unexpected token '${tok.value}' inside package`, tok.position, true);
                this.advance();
            }
        }
        if (this.check(TokenType.ENDPACKAGE)) {
            this.advance();
        }
        else {
            this.addError(`Missing 'endpackage' for package '${name}'`, this.currentPosition(), true);
        }
        return { type: 'package', name, contexts };
    }
    // ── Context ─────────────────────────────────────────────────────────
    parseContext() {
        this.expect(TokenType.CONTEXT);
        const fullName = this.parseQualifiedName();
        // Determine context kind:
        // If fullName contains '::', the last segment might be a member name
        // Check what follows: ':' → property, '(' → operation
        if (fullName.includes('::')) {
            const lastSep = fullName.lastIndexOf('::');
            const className = fullName.substring(0, lastSep);
            const memberName = fullName.substring(lastSep + 2);
            if (this.check(TokenType.LPAREN)) {
                // Operation context: ClassName::opName(params) : ReturnType
                return this.parseOperationContext(className, memberName);
            }
            else if (this.check(TokenType.COLON)) {
                // Property context: ClassName::propName : Type
                return this.parsePropertyContext(className, memberName);
            }
            // If neither, treat the whole thing as a classifier with qualified name
            // and the :: was part of the package path
        }
        // Classifier context (or qualified class name like org::model::Person)
        return this.parseClassifierContext(fullName);
    }
    parseClassifierContext(className) {
        const constraints = this.parseConstraints();
        return { type: 'context', kind: 'classifier', className, constraints };
    }
    parseOperationContext(className, opName) {
        this.expect(TokenType.LPAREN);
        const params = [];
        if (!this.check(TokenType.RPAREN)) {
            params.push(this.parseParam());
            while (this.check(TokenType.COMMA)) {
                this.advance();
                params.push(this.parseParam());
            }
        }
        this.expect(TokenType.RPAREN);
        let returnType;
        if (this.check(TokenType.COLON)) {
            this.advance();
            returnType = this.parseTypeName();
        }
        const constraints = this.parseConstraints();
        return {
            type: 'context',
            kind: 'operation',
            className,
            operationName: opName,
            operationParams: params,
            returnType,
            constraints,
        };
    }
    parsePropertyContext(className, propName) {
        let returnType;
        if (this.check(TokenType.COLON)) {
            this.advance();
            returnType = this.parseTypeName();
        }
        const constraints = this.parseConstraints();
        return {
            type: 'context',
            kind: 'property',
            className,
            propertyName: propName,
            returnType,
            constraints,
        };
    }
    // ── Constraints ─────────────────────────────────────────────────────
    parseConstraints() {
        const constraints = [];
        while (!this.isAtEnd() && !this.check(TokenType.CONTEXT) && !this.check(TokenType.PACKAGE) && !this.check(TokenType.ENDPACKAGE)) {
            if (this.check(TokenType.INV)) {
                constraints.push(this.parseInvariant());
            }
            else if (this.check(TokenType.PRE)) {
                constraints.push(this.parsePrecondition());
            }
            else if (this.check(TokenType.POST)) {
                constraints.push(this.parsePostcondition());
            }
            else if (this.check(TokenType.DEF)) {
                constraints.push(this.parseDef());
            }
            else if (this.check(TokenType.INIT)) {
                constraints.push(this.parseInit());
            }
            else if (this.check(TokenType.DERIVE)) {
                constraints.push(this.parseDerive());
            }
            else if (this.check(TokenType.BODY)) {
                constraints.push(this.parseBody());
            }
            else {
                break;
            }
        }
        return constraints;
    }
    parseInvariant() {
        this.expect(TokenType.INV);
        const name = this.parseOptionalName();
        this.expect(TokenType.COLON);
        const expression = this.parseExpression();
        return { type: 'invariant', name, expression };
    }
    parsePrecondition() {
        this.expect(TokenType.PRE);
        const name = this.parseOptionalName();
        this.expect(TokenType.COLON);
        const expression = this.parseExpression();
        return { type: 'precondition', name, expression };
    }
    parsePostcondition() {
        this.expect(TokenType.POST);
        const name = this.parseOptionalName();
        this.expect(TokenType.COLON);
        const expression = this.parseExpression();
        return { type: 'postcondition', name, expression };
    }
    parseDef() {
        this.expect(TokenType.DEF);
        this.expect(TokenType.COLON);
        const name = this.expectIdentifierOrKeyword();
        // Check if it's an operation def (has params)
        let params;
        if (this.check(TokenType.LPAREN)) {
            this.advance();
            params = [];
            if (!this.check(TokenType.RPAREN)) {
                params.push(this.parseParam());
                while (this.check(TokenType.COMMA)) {
                    this.advance();
                    params.push(this.parseParam());
                }
            }
            this.expect(TokenType.RPAREN);
        }
        let returnType;
        if (this.check(TokenType.COLON)) {
            this.advance();
            returnType = this.parseTypeName();
        }
        this.expect(TokenType.EQUALS);
        const expression = this.parseExpression();
        return { type: 'def', name, params, returnType, expression };
    }
    parseInit() {
        this.expect(TokenType.INIT);
        this.expect(TokenType.COLON);
        const expression = this.parseExpression();
        return { type: 'init', expression };
    }
    parseDerive() {
        this.expect(TokenType.DERIVE);
        this.expect(TokenType.COLON);
        const expression = this.parseExpression();
        return { type: 'derive', expression };
    }
    parseBody() {
        this.expect(TokenType.BODY);
        const name = this.parseOptionalName();
        this.expect(TokenType.COLON);
        const expression = this.parseExpression();
        return { type: 'body', name, expression };
    }
    // ── Expression Parsing (delegates to OCLParser) ─────────────────────
    parseExpression() {
        // Collect tokens until the next constraint keyword or context/package/EOF
        const exprTokens = [];
        const stopTokens = [
            TokenType.INV, TokenType.PRE, TokenType.POST, TokenType.DEF,
            TokenType.INIT, TokenType.DERIVE, TokenType.BODY,
            TokenType.CONTEXT, TokenType.PACKAGE, TokenType.ENDPACKAGE, TokenType.EOF,
        ];
        let depth = 0; // Track parentheses/braces depth
        while (!this.isAtEnd()) {
            const tok = this.peek();
            // Only stop at keywords when at top level (not inside parens/braces)
            if (depth === 0 && stopTokens.includes(tok.type)) {
                break;
            }
            if (tok.type === TokenType.LPAREN || tok.type === TokenType.LBRACE)
                depth++;
            if (tok.type === TokenType.RPAREN || tok.type === TokenType.RBRACE)
                depth--;
            exprTokens.push(tok);
            this.advance();
        }
        // Reconstruct expression text from tokens and parse it
        if (exprTokens.length === 0) {
            this.addError('Expected expression', this.currentPosition(), true);
            return { type: 'literal', value: null, valueType: 'null' };
        }
        // Build expression string from token values
        const exprText = this.tokensToString(exprTokens);
        try {
            return this.exprParser.parse(exprText);
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            this.addError(`Expression parse error: ${msg}`, exprTokens[0].position, true);
            return { type: 'literal', value: null, valueType: 'null' };
        }
    }
    // ── Helpers ─────────────────────────────────────────────────────────
    parseQualifiedName() {
        let name = this.expectIdentifierOrKeyword();
        while (this.check(TokenType.COLON_COLON)) {
            this.advance();
            name += '::' + this.expectIdentifierOrKeyword();
        }
        return name;
    }
    parseOptionalName() {
        // A name follows if the next token is an identifier and the one after is ':'
        if (this.isIdentifierLike(this.peek()) && this.pos + 1 < this.tokens.length && this.tokens[this.pos + 1].type === TokenType.COLON) {
            return this.expectIdentifierOrKeyword();
        }
        return undefined;
    }
    parseParam() {
        const name = this.expectIdentifierOrKeyword();
        this.expect(TokenType.COLON);
        const type = this.parseTypeName();
        return { name, type };
    }
    parseTypeName() {
        // Handle collection types: Set(Type), Bag(Type), etc.
        const tok = this.peek();
        if (tok.type === TokenType.SET || tok.type === TokenType.BAG ||
            tok.type === TokenType.SEQUENCE || tok.type === TokenType.ORDERED_SET ||
            tok.type === TokenType.TUPLE) {
            const collName = this.advance().value;
            if (this.check(TokenType.LPAREN)) {
                this.advance();
                const inner = this.parseTypeName();
                this.expect(TokenType.RPAREN);
                return `${collName}(${inner})`;
            }
            return collName;
        }
        return this.parseQualifiedName();
    }
    expectIdentifierOrKeyword() {
        const tok = this.peek();
        if (this.isIdentifierLike(tok)) {
            return this.advance().value;
        }
        this.addError(`Expected identifier but found '${tok.value}'`, tok.position, false);
        throw new Error(`Expected identifier but found '${tok.value}'`);
    }
    isIdentifierLike(tok) {
        if (!tok)
            return false;
        if (tok.type === TokenType.IDENTIFIER)
            return true;
        // Many keywords can appear as names in certain positions
        const nameableKeywords = [
            TokenType.REJECT, TokenType.CLOSURE, TokenType.COLLECT_NESTED,
            TokenType.FLATTEN, TokenType.ITERATE, TokenType.SUM,
            TokenType.MIN, TokenType.MAX, TokenType.ALL_INSTANCES,
            TokenType.RESULT, TokenType.SET, TokenType.BAG,
            TokenType.SEQUENCE, TokenType.ORDERED_SET, TokenType.TUPLE,
        ];
        return nameableKeywords.includes(tok.type);
    }
    tokensToString(tokens) {
        // Reconstruct expression text with proper spacing
        let result = '';
        for (let i = 0; i < tokens.length; i++) {
            const tok = tokens[i];
            if (i > 0) {
                const prev = tokens[i - 1];
                // Add space between tokens unless it's a dot, arrow, paren, etc.
                const noSpaceBefore = [TokenType.DOT, TokenType.LPAREN, TokenType.RPAREN, TokenType.LBRACE, TokenType.RBRACE, TokenType.COMMA, TokenType.SEMI, TokenType.COLON, TokenType.COLON_COLON];
                const noSpaceAfter = [TokenType.DOT, TokenType.LPAREN, TokenType.LBRACE, TokenType.ARROW, TokenType.COLON_COLON];
                if (!noSpaceBefore.includes(tok.type) && !noSpaceAfter.includes(prev.type)) {
                    result += ' ';
                }
            }
            // Reconstruct string literals with quotes
            if (tok.type === TokenType.STRING) {
                result += `'${tok.value}'`;
            }
            else {
                result += tok.value;
            }
        }
        return result;
    }
    // ── Token Navigation ──────────────────────────────────────────────
    peek() {
        return this.tokens[this.pos] ?? { type: TokenType.EOF, value: '', position: -1 };
    }
    advance() {
        const tok = this.tokens[this.pos];
        if (this.pos < this.tokens.length)
            this.pos++;
        return tok;
    }
    check(type) {
        return this.peek().type === type;
    }
    expect(type) {
        if (!this.check(type)) {
            const tok = this.peek();
            const msg = `Expected ${type} but found '${tok.value}'`;
            this.addError(msg, tok.position, false);
            throw new Error(msg);
        }
        return this.advance();
    }
    isAtEnd() {
        return this.peek().type === TokenType.EOF;
    }
    currentPosition() {
        return this.peek().position;
    }
    addError(message, position, recoverable) {
        this.errors.push({ message, position, recoverable });
    }
    recoverToNextDeclaration() {
        while (!this.isAtEnd()) {
            const tok = this.peek();
            if (tok.type === TokenType.CONTEXT || tok.type === TokenType.PACKAGE || tok.type === TokenType.ENDPACKAGE) {
                return;
            }
            this.advance();
        }
    }
}
//# sourceMappingURL=OCLDocumentParser.js.map