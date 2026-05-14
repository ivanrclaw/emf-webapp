/**
 * OCLLexer — Tokeniza expresiones OCL (Object Constraint Language)
 *
 * Divide la cadena en tokens reconocibles: literales, identificadores,
 * operadores, símbolos de colección (->), paréntesis, etc.
 */
export declare enum TokenType {
    NUMBER = "NUMBER",
    STRING = "STRING",
    BOOLEAN = "BOOLEAN",
    IDENTIFIER = "IDENTIFIER",
    SELF = "SELF",
    PLUS = "PLUS",
    MINUS = "MINUS",
    STAR = "STAR",
    SLASH = "SLASH",
    EQUALS = "EQUALS",
    NOT_EQUALS = "NOT_EQUALS",
    GT = "GT",
    LT = "LT",
    GTE = "GTE",
    LTE = "LTE",
    AND = "AND",
    OR = "OR",
    NOT = "NOT",
    XOR = "XOR",
    IMPLIES = "IMPLIES",
    ARROW = "ARROW",// ->
    PIPE = "PIPE",// |
    LPAREN = "LPAREN",
    RPAREN = "RPAREN",
    DOT = "DOT",
    COMMA = "COMMA",
    COLON = "COLON",
    ASSIGN = "ASSIGN",// =
    EOF = "EOF"
}
export interface Token {
    type: TokenType;
    value: string;
    position: number;
}
export declare class OCLLexer {
    private readonly input;
    private pos;
    private readonly tokens;
    constructor(input: string);
    tokenize(): Token[];
    private addToken;
}
//# sourceMappingURL=OCLLexer.d.ts.map