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

import { Token, TokenType, OCLLexer } from './OCLLexer';

export type ASTNode =
  | LiteralNode
  | IdentifierNode
  | SelfNode
  | UnaryOpNode
  | BinaryOpNode
  | MethodCallNode
  | CollectionOpNode;

export interface LiteralNode {
  type: 'literal';
  valueType: 'number' | 'string' | 'boolean';
  value: number | string | boolean;
}

export interface IdentifierNode {
  type: 'identifier';
  name: string;
}

export interface SelfNode {
  type: 'self';
}

export interface UnaryOpNode {
  type: 'unary';
  operator: string; // '-', 'not'
  operand: ASTNode;
}

export interface BinaryOpNode {
  type: 'binary';
  operator: string;
  left: ASTNode;
  right: ASTNode;
}

export interface MethodCallNode {
  type: 'methodcall';
  object: ASTNode;
  method: string;
  args: ASTNode[];
}

export interface CollectionOpNode {
  type: 'collectionop';
  source: ASTNode;
  operation: string;
  iterator?: string;
  body?: ASTNode;
  args?: ASTNode[];
}

export class OCLParser {
  private tokens: Token[] = [];
  private pos = 0;

  parse(input: string): ASTNode {
    const lexer = new OCLLexer(input);
    this.tokens = lexer.tokenize();
    this.pos = 0;
    const ast = this.expression();
    this.expect(TokenType.EOF);
    return ast;
  }

  // For the validator: re-lex/re-parse but return null on failure
  tryParse(input: string): ASTNode | null {
    try {
      return this.parse(input);
    } catch {
      return null;
    }
  }

  private expression(): ASTNode {
    return this.orExpression();
  }

  private orExpression(): ASTNode {
    let left = this.xorExpression();
    while (this.match(TokenType.OR) || this.match(TokenType.XOR)) {
      const op = this.previous().value;
      const right = this.xorExpression();
      left = { type: 'binary', operator: op, left, right };
    }
    return left;
  }

  private xorExpression(): ASTNode {
    let left = this.andExpression();
    while (this.match(TokenType.XOR) || this.match(TokenType.IMPLIES)) {
      const op = this.previous().value;
      const right = this.andExpression();
      left = { type: 'binary', operator: op, left, right };
    }
    return left;
  }

  private andExpression(): ASTNode {
    let left = this.notExpression();
    while (this.match(TokenType.AND)) {
      const op = this.previous().value;
      const right = this.notExpression();
      left = { type: 'binary', operator: op, left, right };
    }
    return left;
  }

  private notExpression(): ASTNode {
    if (this.match(TokenType.NOT)) {
      const operand = this.notExpression();
      return { type: 'unary', operator: 'not', operand };
    }
    return this.comparisonExpression();
  }

  private comparisonExpression(): ASTNode {
    let left = this.additiveExpression();
    if (
      this.match(TokenType.EQUALS) ||
      this.match(TokenType.NOT_EQUALS) ||
      this.match(TokenType.GT) ||
      this.match(TokenType.LT) ||
      this.match(TokenType.GTE) ||
      this.match(TokenType.LTE)
    ) {
      const op = this.previous().value;
      const right = this.additiveExpression();
      left = { type: 'binary', operator: op, left, right };
    }
    return left;
  }

  private additiveExpression(): ASTNode {
    let left = this.multiplicativeExpression();
    while (this.match(TokenType.PLUS) || this.match(TokenType.MINUS)) {
      const op = this.previous().value;
      const right = this.multiplicativeExpression();
      left = { type: 'binary', operator: op, left, right };
    }
    return left;
  }

  private multiplicativeExpression(): ASTNode {
    let left = this.unaryExpression();
    while (this.match(TokenType.STAR) || this.match(TokenType.SLASH)) {
      const op = this.previous().value;
      const right = this.unaryExpression();
      left = { type: 'binary', operator: op, left, right };
    }
    return left;
  }

  private unaryExpression(): ASTNode {
    if (this.match(TokenType.MINUS)) {
      const operand = this.unaryExpression();
      return { type: 'unary', operator: '-', operand };
    }
    return this.primary();
  }

  private primary(): ASTNode {
    // Literals
    if (this.match(TokenType.NUMBER)) {
      return {
        type: 'literal',
        valueType: 'number',
        value: Number(this.previous().value),
      } as LiteralNode;
    }
    if (this.match(TokenType.STRING)) {
      return {
        type: 'literal',
        valueType: 'string',
        value: this.previous().value,
      } as LiteralNode;
    }
    if (this.match(TokenType.BOOLEAN)) {
      return {
        type: 'literal',
        valueType: 'boolean',
        value: this.previous().value === 'true',
      } as LiteralNode;
    }

    // self
    if (this.match(TokenType.SELF)) {
      let node: ASTNode = { type: 'self' } as SelfNode;
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
          object: { type: 'self' } as SelfNode,
          method: name,
          args,
        } as MethodCallNode);
      }

      let node: ASTNode = { type: 'identifier', name } as IdentifierNode;
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

  private parseCallChain(object: ASTNode): ASTNode {
    let node = object;

    while (true) {
      // Dot navigation: .identifier
      if (this.match(TokenType.DOT)) {
        const name = this.expect(TokenType.IDENTIFIER).value;
        if (this.check(TokenType.LPAREN)) {
          this.advance();
          const args = this.parseArgs();
          this.expect(TokenType.RPAREN);
          node = { type: 'methodcall', object: node, method: name, args } as MethodCallNode;
        } else {
          // treat as method call with no args (property access is method with no args)
          node = { type: 'methodcall', object: node, method: name, args: [] } as MethodCallNode;
        }
        continue;
      }

      // Arrow operation: ->operation
      if (this.match(TokenType.ARROW)) {
        const opName = this.expect(TokenType.IDENTIFIER).value;

        // Lambda: ->forAll(x | expr), ->exists(x | expr), etc.
        if (
          ['forAll', 'exists', 'select', 'collect', 'one', 'isUnique', 'sortedBy', 'any'].includes(opName)
        ) {
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
            } as CollectionOpNode;
          } else {
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
              } as CollectionOpNode;
            } else {
              // The "body" is just `iterator` itself (simple expression)
              const exprNode: ASTNode = { type: 'identifier', name: iterator } as IdentifierNode;
              this.expect(TokenType.RPAREN);
              node = {
                type: 'collectionop',
                source: node,
                operation: opName,
                body: exprNode,
              } as CollectionOpNode;
            }
          }
        } else {
          // Simple arrow call: ->size(), ->isEmpty(), etc.
          this.expect(TokenType.LPAREN);
          const args = this.parseArgs();
          this.expect(TokenType.RPAREN);
          node = {
            type: 'collectionop',
            source: node,
            operation: opName,
            args,
          } as unknown as MethodCallNode;
        }
        continue;
      }

      break;
    }

    return node;
  }

  private parseArgs(): ASTNode[] {
    const args: ASTNode[] = [];
    if (!this.check(TokenType.RPAREN)) {
      args.push(this.expression());
      while (this.match(TokenType.COMMA)) {
        args.push(this.expression());
      }
    }
    return args;
  }

  // ── Helpers ──────────────────────────────────────────────────────

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private check(type: TokenType): boolean {
    return this.peek()?.type === type;
  }

  private advance(): Token {
    if (this.pos >= this.tokens.length) {
      throw new Error('Unexpected end of expression');
    }
    return this.tokens[this.pos++];
  }

  private match(type: TokenType): boolean {
    if (this.check(type)) {
      this.advance();
      return true;
    }
    return false;
  }

  private previous(): Token {
    return this.tokens[this.pos - 1];
  }

  private expect(type: TokenType): Token {
    if (!this.check(type)) {
      const found = this.peek();
      throw new Error(
        `Expected ${TokenType[type]} but found '${found?.value ?? 'EOF'}' at position ${found?.position ?? -1}`,
      );
    }
    return this.advance();
  }
}
