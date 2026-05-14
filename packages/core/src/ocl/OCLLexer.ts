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

  // Operators
  PLUS = 'PLUS',
  MINUS = 'MINUS',
  STAR = 'STAR',
  SLASH = 'SLASH',
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
  DOT = 'DOT',
  COMMA = 'COMMA',
  COLON = 'COLON',

  // Special
  ASSIGN = 'ASSIGN',         // =
  EOF = 'EOF',
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
        // Check if it's "oclIsTypeOf" etc. - they're compound identifiers
        const peek = this.input.substring(this.pos, this.pos + 10);
        if (id === 'oclIsTypeOf' || id === 'oclIsKindOf' || id === 'oclAsType' || id === 'oclIsUndefined') {
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
        '.': TokenType.DOT,
        ',': TokenType.COMMA,
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

  private addToken(type: TokenType, value: string): void {
    this.tokens.push({ type, value, position: this.pos });
  }
}
