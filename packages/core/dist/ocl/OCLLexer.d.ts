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
    NULL = "NULL",
    INVALID = "INVALID",
    PLUS = "PLUS",
    MINUS = "MINUS",
    STAR = "STAR",
    SLASH = "SLASH",
    MOD = "MOD",
    DIV = "DIV",
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
    LBRACE = "LBRACE",// {
    RBRACE = "RBRACE",// }
    DOT = "DOT",
    COMMA = "COMMA",
    SEMI = "SEMI",// ;
    COLON = "COLON",
    COLON_COLON = "COLON_COLON",// ::
    ASSIGN = "ASSIGN",// =
    EOF = "EOF",
    LET = "LET",
    IN = "IN",
    IF = "IF",
    THEN = "THEN",
    ELSE = "ELSE",
    ENDIF = "ENDIF",
    PACKAGE = "PACKAGE",
    ENDPACKAGE = "ENDPACKAGE",
    CONTEXT = "CONTEXT",
    INV = "INV",
    PRE = "PRE",
    POST = "POST",
    DEF = "DEF",
    INIT = "INIT",
    DERIVE = "DERIVE",
    BODY = "BODY",
    RESULT = "RESULT",
    AT_PRE = "AT_PRE",
    REJECT = "REJECT",
    CLOSURE = "CLOSURE",
    COLLECT_NESTED = "COLLECT_NESTED",
    FLATTEN = "FLATTEN",
    ITERATE = "ITERATE",
    SUM = "SUM",
    MIN = "MIN",
    MAX = "MAX",
    ALL_INSTANCES = "ALL_INSTANCES",
    SET = "SET",
    BAG = "BAG",
    SEQUENCE = "SEQUENCE",
    ORDERED_SET = "ORDERED_SET"
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