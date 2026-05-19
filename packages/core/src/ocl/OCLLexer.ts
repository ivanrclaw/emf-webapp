/**
 * OCLLexer — Tokeniza expresiones OCL (Object Constraint Language)
 *
 * Divide la cadena en tokens reconocibles: literales, identificadores,
 * operadores, símbolos de colección (->), paréntesis, etc.
 */

export enum TokenType {
  // Literals
  NUMBER = 'NUMBER',
  STRING = 'STRING',
  BOOLEAN = 'BOOLEAN',
  IDENTIFIER = 'IDENTIFIER',
  SELF = 'SELF',
  NULL = 'NULL',
  INVALID = 'INVALID',

  // Operators
  PLUS = 'PLUS',
  MINUS = 'MINUS',
  STAR = 'STAR',
  SLASH = 'SLASH',
  MOD = 'MOD',
  DIV = 'DIV',
  EQUALS = 'EQUALS',
  NOT_EQUALS = 'NOT_EQUALS',
  GT = 'GT',
  LT = 'LT',
  GTE = 'GTE',
  LTE = 'LTE',

  // Logical
  AND = 'AND',
  OR = 'OR',
  NOT = 'NOT',
  XOR = 'XOR',
  IMPLIES = 'IMPLIES',

  // Collection
  ARROW = 'ARROW',           // ->
  PIPE = 'PIPE',             // |

  // Delimiters
  LPAREN = 'LPAREN',
  RPAREN = 'RPAREN',
  LBRACE = 'LBRACE',         // {
  RBRACE = 'RBRACE',         // }
  DOT = 'DOT',
  COMMA = 'COMMA',
  SEMI = 'SEMI',           // ;
  COLON = 'COLON',
  COLON_COLON = 'COLON_COLON', // ::

  // Special
  ASSIGN = 'ASSIGN',         // =
  EOF = 'EOF',

  // Control flow
  LET = 'LET',
  IN = 'IN',
  IF = 'IF',
  THEN = 'THEN',
  ELSE = 'ELSE',
  ENDIF = 'ENDIF',

  // OCL document keywords
  PACKAGE = 'PACKAGE',
  ENDPACKAGE = 'ENDPACKAGE',
  CONTEXT = 'CONTEXT',
  INV = 'INV',
  PRE = 'PRE',
  POST = 'POST',
  DEF = 'DEF',
  INIT = 'INIT',
  DERIVE = 'DERIVE',
  BODY = 'BODY',
  RESULT = 'RESULT',
  AT_PRE = 'AT_PRE',

  // Collection operation names (dedicated tokens for clarity)
  REJECT = 'REJECT',
  CLOSURE = 'CLOSURE',
  COLLECT_NESTED = 'COLLECT_NESTED',
  FLATTEN = 'FLATTEN',
  ITERATE = 'ITERATE',
  SUM = 'SUM',
  MIN = 'MIN',
  MAX = 'MAX',
  ALL_INSTANCES = 'ALL_INSTANCES',

  // Collection type names
  SET = 'SET',
  BAG = 'BAG',
  SEQUENCE = 'SEQUENCE',
  ORDERED_SET = 'ORDERED_SET',
  TUPLE = 'TUPLE',

  // OclMessage
  CARET = 'CARET',             // ^
  DOUBLE_CARET = 'DOUBLE_CARET', // ^^
}

export interface Token {
  type: TokenType;
  value: string;
  position: number;
}

const KEYWORDS: Record<string, TokenType> = {
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
  private pos = 0;
  private readonly tokens: Token[] = [];

  constructor(private readonly input: string) {}

  tokenize(): Token[] {
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
        while (this.pos < len && this.input[this.pos] !== '\n') this.pos++;
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
          } else {
            str += this.input[this.pos];
            this.pos++;
          }
        }
        if (this.pos < len) this.pos++; // closing quote
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
          } else {
            const kw = KEYWORDS[id];
            this.addToken(kw ?? TokenType.IDENTIFIER, id);
          }
          this.addToken(TokenType.AT_PRE, '@pre');
          this.pos += 4;
        } else if (id === 'oclIsTypeOf' || id === 'oclIsKindOf' || id === 'oclAsType' || id === 'oclIsUndefined') {
          this.addToken(TokenType.IDENTIFIER, id);
        } else {
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
      const singleCharMap: Record<string, TokenType> = {
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

      // Unknown char — error
      throw new Error(`Unexpected character '${ch}' at position ${this.pos}`);
    }

    this.addToken(TokenType.EOF, '');
    return this.tokens;
  }

  private addToken(type: TokenType, value: string): void {
    this.tokens.push({ type, value, position: this.pos });
  }
}
