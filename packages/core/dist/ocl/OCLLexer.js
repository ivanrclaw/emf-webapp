/**
 * OCLLexer — Tokeniza expresiones OCL (Object Constraint Language)
 *
 * Divide la cadena en tokens reconocibles: literales, identificadores,
 * operadores, símbolos de colección (->), paréntesis, etc.
 */
export var TokenType;
(function (TokenType) {
    // Literals
    TokenType["NUMBER"] = "NUMBER";
    TokenType["STRING"] = "STRING";
    TokenType["BOOLEAN"] = "BOOLEAN";
    TokenType["IDENTIFIER"] = "IDENTIFIER";
    TokenType["SELF"] = "SELF";
    TokenType["NULL"] = "NULL";
    TokenType["INVALID"] = "INVALID";
    // Operators
    TokenType["PLUS"] = "PLUS";
    TokenType["MINUS"] = "MINUS";
    TokenType["STAR"] = "STAR";
    TokenType["SLASH"] = "SLASH";
    TokenType["MOD"] = "MOD";
    TokenType["DIV"] = "DIV";
    TokenType["EQUALS"] = "EQUALS";
    TokenType["NOT_EQUALS"] = "NOT_EQUALS";
    TokenType["GT"] = "GT";
    TokenType["LT"] = "LT";
    TokenType["GTE"] = "GTE";
    TokenType["LTE"] = "LTE";
    // Logical
    TokenType["AND"] = "AND";
    TokenType["OR"] = "OR";
    TokenType["NOT"] = "NOT";
    TokenType["XOR"] = "XOR";
    TokenType["IMPLIES"] = "IMPLIES";
    // Collection
    TokenType["ARROW"] = "ARROW";
    TokenType["PIPE"] = "PIPE";
    // Delimiters
    TokenType["LPAREN"] = "LPAREN";
    TokenType["RPAREN"] = "RPAREN";
    TokenType["LBRACE"] = "LBRACE";
    TokenType["RBRACE"] = "RBRACE";
    TokenType["DOT"] = "DOT";
    TokenType["COMMA"] = "COMMA";
    TokenType["SEMI"] = "SEMI";
    TokenType["COLON"] = "COLON";
    TokenType["COLON_COLON"] = "COLON_COLON";
    // Special
    TokenType["ASSIGN"] = "ASSIGN";
    TokenType["EOF"] = "EOF";
    // Control flow
    TokenType["LET"] = "LET";
    TokenType["IN"] = "IN";
    TokenType["IF"] = "IF";
    TokenType["THEN"] = "THEN";
    TokenType["ELSE"] = "ELSE";
    TokenType["ENDIF"] = "ENDIF";
    // OCL document keywords
    TokenType["PACKAGE"] = "PACKAGE";
    TokenType["ENDPACKAGE"] = "ENDPACKAGE";
    TokenType["CONTEXT"] = "CONTEXT";
    TokenType["INV"] = "INV";
    TokenType["PRE"] = "PRE";
    TokenType["POST"] = "POST";
    TokenType["DEF"] = "DEF";
    TokenType["INIT"] = "INIT";
    TokenType["DERIVE"] = "DERIVE";
    TokenType["BODY"] = "BODY";
    TokenType["RESULT"] = "RESULT";
    TokenType["AT_PRE"] = "AT_PRE";
    // Collection operation names (dedicated tokens for clarity)
    TokenType["REJECT"] = "REJECT";
    TokenType["CLOSURE"] = "CLOSURE";
    TokenType["COLLECT_NESTED"] = "COLLECT_NESTED";
    TokenType["FLATTEN"] = "FLATTEN";
    TokenType["ITERATE"] = "ITERATE";
    TokenType["SUM"] = "SUM";
    TokenType["MIN"] = "MIN";
    TokenType["MAX"] = "MAX";
    TokenType["ALL_INSTANCES"] = "ALL_INSTANCES";
    // Collection type names
    TokenType["SET"] = "SET";
    TokenType["BAG"] = "BAG";
    TokenType["SEQUENCE"] = "SEQUENCE";
    TokenType["ORDERED_SET"] = "ORDERED_SET";
    TokenType["TUPLE"] = "TUPLE";
    // OclMessage
    TokenType["CARET"] = "CARET";
    TokenType["DOUBLE_CARET"] = "DOUBLE_CARET";
})(TokenType || (TokenType = {}));
const KEYWORDS = {
    self: TokenType.SELF,
    true: TokenType.BOOLEAN,
    false: TokenType.BOOLEAN,
    and: TokenType.AND,
    or: TokenType.OR,
    not: TokenType.NOT,
    xor: TokenType.XOR,
    implies: TokenType.IMPLIES,
    let: TokenType.LET,
    in: TokenType.IN,
    if: TokenType.IF,
    then: TokenType.THEN,
    else: TokenType.ELSE,
    endif: TokenType.ENDIF,
    package: TokenType.PACKAGE,
    endpackage: TokenType.ENDPACKAGE,
    context: TokenType.CONTEXT,
    inv: TokenType.INV,
    pre: TokenType.PRE,
    post: TokenType.POST,
    def: TokenType.DEF,
    init: TokenType.INIT,
    derive: TokenType.DERIVE,
    body: TokenType.BODY,
    result: TokenType.RESULT,
    '@pre': TokenType.AT_PRE,
    null: TokenType.NULL,
    invalid: TokenType.INVALID,
    mod: TokenType.MOD,
    div: TokenType.DIV,
    reject: TokenType.REJECT,
    closure: TokenType.CLOSURE,
    collectNested: TokenType.COLLECT_NESTED,
    flatten: TokenType.FLATTEN,
    iterate: TokenType.ITERATE,
    sum: TokenType.SUM,
    min: TokenType.MIN,
    max: TokenType.MAX,
    allInstances: TokenType.ALL_INSTANCES,
    Set: TokenType.SET,
    Bag: TokenType.BAG,
    Sequence: TokenType.SEQUENCE,
    OrderedSet: TokenType.ORDERED_SET,
    Tuple: TokenType.TUPLE,
};
export class OCLLexer {
    input;
    pos = 0;
    tokens = [];
    constructor(input) {
        this.input = input;
    }
    tokenize() {
        this.pos = 0;
        this.tokens.length = 0;
        const len = this.input.length;
        while (this.pos < len) {
            const ch = this.input[this.pos];
            // Whitespace
            if (/\s/.test(ch)) {
                this.pos++;
                continue;
            }
            // Comments: -- to end of line
            if (ch === '-' && this.input[this.pos + 1] === '-') {
                while (this.pos < len && this.input[this.pos] !== '\n')
                    this.pos++;
                continue;
            }
            // Arrow -> (must come before minus)
            if (ch === '-' && this.input[this.pos + 1] === '>') {
                this.addToken(TokenType.ARROW, '->');
                this.pos += 2;
                continue;
            }
            // String literals: 'text' or "text"
            if (ch === "'" || ch === '"') {
                const quote = ch;
                this.pos++;
                let str = '';
                while (this.pos < len && this.input[this.pos] !== quote) {
                    if (this.input[this.pos] === '\\') {
                        this.pos++;
                        if (this.pos < len) {
                            str += this.input[this.pos];
                            this.pos++;
                        }
                    }
                    else {
                        str += this.input[this.pos];
                        this.pos++;
                    }
                }
                if (this.pos < len)
                    this.pos++; // closing quote
                this.addToken(TokenType.STRING, str);
                continue;
            }
            // Numbers
            if (/[0-9]/.test(ch)) {
                let num = '';
                while (this.pos < len && /[0-9.]/.test(this.input[this.pos])) {
                    num += this.input[this.pos];
                    this.pos++;
                }
                this.addToken(TokenType.NUMBER, num);
                continue;
            }
            // Identifiers and keywords
            if (/[a-zA-Z_]/.test(ch)) {
                let id = '';
                while (this.pos < len && /[a-zA-Z0-9_]/.test(this.input[this.pos])) {
                    id += this.input[this.pos];
                    this.pos++;
                }
                // Check for @pre suffix (e.g., someAttr@pre)
                if (this.input[this.pos] === '@' && this.input.substring(this.pos, this.pos + 4) === '@pre') {
                    // Emit the identifier first, then @pre as separate token
                    if (id === 'oclIsTypeOf' || id === 'oclIsKindOf' || id === 'oclAsType' || id === 'oclIsUndefined') {
                        this.addToken(TokenType.IDENTIFIER, id);
                    }
                    else {
                        const kw = KEYWORDS[id];
                        this.addToken(kw ?? TokenType.IDENTIFIER, id);
                    }
                    this.addToken(TokenType.AT_PRE, '@pre');
                    this.pos += 4;
                }
                else if (id === 'oclIsTypeOf' || id === 'oclIsKindOf' || id === 'oclAsType' || id === 'oclIsUndefined') {
                    this.addToken(TokenType.IDENTIFIER, id);
                }
                else {
                    const kw = KEYWORDS[id];
                    this.addToken(kw ?? TokenType.IDENTIFIER, id);
                }
                continue;
            }
            // Multi-char operators
            if (ch === '<' && this.input[this.pos + 1] === '>') {
                this.addToken(TokenType.NOT_EQUALS, '<>');
                this.pos += 2;
                continue;
            }
            if (ch === '>' && this.input[this.pos + 1] === '=') {
                this.addToken(TokenType.GTE, '>=');
                this.pos += 2;
                continue;
            }
            if (ch === '<' && this.input[this.pos + 1] === '=') {
                this.addToken(TokenType.LTE, '<=');
                this.pos += 2;
                continue;
            }
            // :: (colon colon) for enum literals
            if (ch === ':' && this.input[this.pos + 1] === ':') {
                this.addToken(TokenType.COLON_COLON, '::');
                this.pos += 2;
                continue;
            }
            // ^^ (double caret) for OclMessage
            if (ch === '^' && this.input[this.pos + 1] === '^') {
                this.addToken(TokenType.DOUBLE_CARET, '^^');
                this.pos += 2;
                continue;
            }
            // ^ (single caret) for OclMessage
            if (ch === '^') {
                this.addToken(TokenType.CARET, '^');
                this.pos++;
                continue;
            }
            // Single-char tokens
            const singleCharMap = {
                '+': TokenType.PLUS,
                '-': TokenType.MINUS,
                '*': TokenType.STAR,
                '/': TokenType.SLASH,
                '=': TokenType.EQUALS,
                '>': TokenType.GT,
                '<': TokenType.LT,
                '(': TokenType.LPAREN,
                ')': TokenType.RPAREN,
                '{': TokenType.LBRACE,
                '}': TokenType.RBRACE,
                '.': TokenType.DOT,
                ',': TokenType.COMMA,
                ';': TokenType.SEMI,
                ':': TokenType.COLON,
                '|': TokenType.PIPE,
            };
            const tt = singleCharMap[ch];
            if (tt !== undefined) {
                this.addToken(tt, ch);
                this.pos++;
                continue;
            }
            // Unknown char — skip
            this.pos++;
        }
        this.addToken(TokenType.EOF, '');
        return this.tokens;
    }
    addToken(type, value) {
        this.tokens.push({ type, value, position: this.pos });
    }
}
//# sourceMappingURL=OCLLexer.js.map