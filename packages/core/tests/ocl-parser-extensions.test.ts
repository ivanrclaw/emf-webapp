/**
 * Tests — OCL Parser Extensions: Tuple literals, @pre, multi-iterator
 */
import { describe, it, expect } from 'vitest';
import { OCLParser } from '../src/ocl/OCLParser.js';
import type { TupleLiteralNode, AtPreNode, MethodCallNode, CollectionOpNode } from '../src/ocl/OCLParser.js';
import { OCLLexer, TokenType } from '../src/ocl/OCLLexer.js';

const parser = new OCLParser();

// ═══════════════════════════════════════════════════════════════════════
// TUPLE LITERALS
// ═══════════════════════════════════════════════════════════════════════

describe('OCLParser — Tuple Literals', () => {
  it('parses simple Tuple literal', () => {
    const ast = parser.parse("Tuple{name = 'John', age = 25}");
    expect(ast.type).toBe('tupleliteral');
    const tuple = ast as TupleLiteralNode;
    expect(tuple.parts).toHaveLength(2);
    expect(tuple.parts[0].name).toBe('name');
    expect(tuple.parts[1].name).toBe('age');
  });

  it('parses Tuple literal with type annotations', () => {
    const ast = parser.parse("Tuple{name : String = 'John', age : Integer = 25}");
    expect(ast.type).toBe('tupleliteral');
    const tuple = ast as TupleLiteralNode;
    expect(tuple.parts[0].type).toBe('String');
    expect(tuple.parts[1].type).toBe('Integer');
  });

  it('parses Tuple literal with expression values', () => {
    const ast = parser.parse("Tuple{total = self.price * self.quantity}");
    expect(ast.type).toBe('tupleliteral');
    const tuple = ast as TupleLiteralNode;
    expect(tuple.parts[0].name).toBe('total');
    expect(tuple.parts[0].value.type).toBe('binary');
  });

  it('parses empty Tuple literal', () => {
    const ast = parser.parse("Tuple{}");
    expect(ast.type).toBe('tupleliteral');
    const tuple = ast as TupleLiteralNode;
    expect(tuple.parts).toHaveLength(0);
  });

  it('allows call chain on Tuple literal', () => {
    const ast = parser.parse("Tuple{x = 1, y = 2}.x");
    expect(ast.type).toBe('methodcall');
    const call = ast as MethodCallNode;
    expect(call.method).toBe('x');
    expect(call.object.type).toBe('tupleliteral');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// @PRE (POSTCONDITIONS)
// ═══════════════════════════════════════════════════════════════════════

describe('OCLParser — @pre', () => {
  it('parses simple @pre on identifier', () => {
    const ast = parser.parse('self.age@pre');
    expect(ast.type).toBe('atpre');
    const atPre = ast as AtPreNode;
    expect(atPre.expression.type).toBe('methodcall');
  });

  it('parses @pre on method call', () => {
    const ast = parser.parse('self.name@pre');
    expect(ast.type).toBe('atpre');
    const atPre = ast as AtPreNode;
    const inner = atPre.expression as MethodCallNode;
    expect(inner.method).toBe('name');
  });

  it('parses @pre followed by dot navigation', () => {
    const ast = parser.parse('self.employer@pre.name');
    // Should be: (self.employer@pre).name
    expect(ast.type).toBe('methodcall');
    const call = ast as MethodCallNode;
    expect(call.method).toBe('name');
    expect(call.object.type).toBe('atpre');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// LEXER — NEW TOKENS
// ═══════════════════════════════════════════════════════════════════════

describe('OCLLexer — New Tokens', () => {
  it('tokenizes Tuple keyword', () => {
    const lexer = new OCLLexer('Tuple');
    const tokens = lexer.tokenize();
    expect(tokens[0].type).toBe(TokenType.TUPLE);
    expect(tokens[0].value).toBe('Tuple');
  });

  it('tokenizes ^ (caret)', () => {
    const lexer = new OCLLexer('a ^ b');
    const tokens = lexer.tokenize();
    expect(tokens[1].type).toBe(TokenType.CARET);
  });

  it('tokenizes ^^ (double caret)', () => {
    const lexer = new OCLLexer('a ^^ b');
    const tokens = lexer.tokenize();
    expect(tokens[1].type).toBe(TokenType.DOUBLE_CARET);
  });

  it('tokenizes @pre after identifier', () => {
    const lexer = new OCLLexer('salary@pre');
    const tokens = lexer.tokenize();
    expect(tokens[0].type).toBe(TokenType.IDENTIFIER);
    expect(tokens[0].value).toBe('salary');
    expect(tokens[1].type).toBe(TokenType.AT_PRE);
    expect(tokens[1].value).toBe('@pre');
  });

  it('tokenizes @pre after keyword identifier', () => {
    const lexer = new OCLLexer('result@pre');
    const tokens = lexer.tokenize();
    expect(tokens[0].type).toBe(TokenType.RESULT);
    expect(tokens[0].value).toBe('result');
    expect(tokens[1].type).toBe(TokenType.AT_PRE);
  });

  it('does not confuse @pre with regular @ in other contexts', () => {
    const lexer = new OCLLexer('name');
    const tokens = lexer.tokenize();
    expect(tokens[0].type).toBe(TokenType.IDENTIFIER);
    expect(tokens).toHaveLength(2); // name + EOF
  });
});

// ═══════════════════════════════════════════════════════════════════════
// MULTI-ITERATOR (forAll(i, j | body))
// ═══════════════════════════════════════════════════════════════════════

describe('OCLParser — Collection Operations', () => {
  it('parses ->reject(e | cond)', () => {
    const ast = parser.parse('self.friends->reject(f | f.active)');
    expect(ast.type).toBe('collectionop');
    const op = ast as CollectionOpNode;
    expect(op.operation).toBe('reject');
    expect(op.iterator).toBe('f');
  });

  it('parses ->closure(e | expr)', () => {
    const ast = parser.parse('self.friends->closure(f | f.friends)');
    expect(ast.type).toBe('collectionop');
    const op = ast as CollectionOpNode;
    expect(op.operation).toBe('closure');
    expect(op.iterator).toBe('f');
  });

  it('parses ->collectNested(e | expr)', () => {
    const ast = parser.parse('self.friends->collectNested(f | f.name)');
    expect(ast.type).toBe('collectionop');
    const op = ast as CollectionOpNode;
    expect(op.operation).toBe('collectNested');
  });

  it('parses chained collection operations', () => {
    const ast = parser.parse('self.friends->select(f | f.age > 18)->collect(f | f.name)');
    expect(ast.type).toBe('collectionop');
    const outer = ast as CollectionOpNode;
    expect(outer.operation).toBe('collect');
    expect(outer.source.type).toBe('collectionop');
    const inner = outer.source as CollectionOpNode;
    expect(inner.operation).toBe('select');
  });

  it('parses ->size() after ->select()', () => {
    const ast = parser.parse('self.friends->select(f | f.active)->size()');
    expect(ast.type).toBe('collectionop');
    const op = ast as CollectionOpNode;
    expect(op.operation).toBe('size');
    expect(op.source.type).toBe('collectionop');
  });
});
