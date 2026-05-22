/**
 * OCL Parser Suite — Part 10: Complete Parser Feature Coverage
 * Tests all AST node types and parser features comprehensively.
 */
import { describe, it, expect } from 'vitest';
import {
  OCLParser,
  ASTNode,
  CollectionOpNode,
  MethodCallNode,
  CollectionLiteralNode,
  RangeNode,
  LiteralNode,
  IdentifierNode,
  SelfNode,
  UnaryOpNode,
  BinaryOpNode,
  LetInNode,
  IfNode,
  TupleLiteralNode,
  AtPreNode,
} from '../../src/ocl/OCLParser.js';

function parse(expr: string): ASTNode {
  return new OCLParser().parse(expr);
}

// ─── 1. Range Expressions ────────────────────────────────────────────────────

describe('Parser — Range Expressions', () => {
  it('parses Sequence{1..10} with RangeNode element', () => {
    const ast = parse('Sequence{1..10}') as CollectionLiteralNode;
    expect(ast.type).toBe('collectionliteral');
    expect(ast.collectionType).toBe('Sequence');
    expect(ast.elements).toHaveLength(1);
    const range = ast.elements[0] as RangeNode;
    expect(range.type).toBe('range');
    expect((range.start as LiteralNode).value).toBe(1);
    expect((range.end as LiteralNode).value).toBe(10);
  });

  it('parses mixed elements and ranges: Sequence{1, 3..5, 9}', () => {
    const ast = parse('Sequence{1, 3..5, 9}') as CollectionLiteralNode;
    expect(ast.elements).toHaveLength(3);
    expect((ast.elements[0] as LiteralNode).type).toBe('literal');
    expect((ast.elements[1] as RangeNode).type).toBe('range');
    expect((ast.elements[2] as LiteralNode).type).toBe('literal');
  });
});

// ─── 2. Multi-Iterator ───────────────────────────────────────────────────────

describe('Parser — Multi-Iterator', () => {
  it('parses forAll(x, y | x <> y) with iterators array', () => {
    const ast = parse('self.items->forAll(x, y | x <> y)') as CollectionOpNode;
    expect(ast.type).toBe('collectionop');
    expect(ast.operation).toBe('forAll');
    expect(ast.iterator).toBe('x');
    expect(ast.iterators).toEqual(['x', 'y']);
    expect(ast.body).toBeDefined();
    const body = ast.body as BinaryOpNode;
    expect(body.type).toBe('binary');
    expect(body.operator).toBe('<>');
  });

  it('parses single iterator without iterators array', () => {
    const ast = parse('self.items->forAll(x | x > 0)') as CollectionOpNode;
    expect(ast.operation).toBe('forAll');
    expect(ast.iterator).toBe('x');
    expect(ast.iterators).toBeUndefined();
  });
});

// ─── 3. All Collection Literal Types ─────────────────────────────────────────

describe('Parser — Collection Literal Types', () => {
  it('parses Set{1, 2, 3}', () => {
    const ast = parse('Set{1, 2, 3}') as CollectionLiteralNode;
    expect(ast.type).toBe('collectionliteral');
    expect(ast.collectionType).toBe('Set');
    expect(ast.elements).toHaveLength(3);
  });

  it('parses Bag{1, 2, 3}', () => {
    const ast = parse('Bag{1, 2, 3}') as CollectionLiteralNode;
    expect(ast.type).toBe('collectionliteral');
    expect(ast.collectionType).toBe('Bag');
    expect(ast.elements).toHaveLength(3);
  });

  it('parses Sequence{1, 2, 3}', () => {
    const ast = parse('Sequence{1, 2, 3}') as CollectionLiteralNode;
    expect(ast.type).toBe('collectionliteral');
    expect(ast.collectionType).toBe('Sequence');
    expect(ast.elements).toHaveLength(3);
  });

  it('parses OrderedSet{1, 2, 3}', () => {
    const ast = parse('OrderedSet{1, 2, 3}') as CollectionLiteralNode;
    expect(ast.type).toBe('collectionliteral');
    expect(ast.collectionType).toBe('OrderedSet');
    expect(ast.elements).toHaveLength(3);
  });

  it('parses empty Set{}', () => {
    const ast = parse('Set{}') as CollectionLiteralNode;
    expect(ast.type).toBe('collectionliteral');
    expect(ast.collectionType).toBe('Set');
    expect(ast.elements).toHaveLength(0);
  });

  it('parses empty Bag{}', () => {
    const ast = parse('Bag{}') as CollectionLiteralNode;
    expect(ast.collectionType).toBe('Bag');
    expect(ast.elements).toHaveLength(0);
  });

  it('parses empty Sequence{}', () => {
    const ast = parse('Sequence{}') as CollectionLiteralNode;
    expect(ast.collectionType).toBe('Sequence');
    expect(ast.elements).toHaveLength(0);
  });

  it('parses empty OrderedSet{}', () => {
    const ast = parse('OrderedSet{}') as CollectionLiteralNode;
    expect(ast.collectionType).toBe('OrderedSet');
    expect(ast.elements).toHaveLength(0);
  });
});

// ─── 4. Tuple Literals ───────────────────────────────────────────────────────

describe('Parser — Tuple Literals', () => {
  it("parses Tuple{name = 'x', age = 5}", () => {
    const ast = parse("Tuple{name = 'x', age = 5}") as TupleLiteralNode;
    expect(ast.type).toBe('tupleliteral');
    expect(ast.parts).toHaveLength(2);
    expect(ast.parts[0].name).toBe('name');
    expect((ast.parts[0].value as LiteralNode).value).toBe('x');
    expect(ast.parts[1].name).toBe('age');
    expect((ast.parts[1].value as LiteralNode).value).toBe(5);
  });

  it('parses Tuple with type annotations: Tuple{name : String = x, age : Integer = 5}', () => {
    const ast = parse("Tuple{name : String = 'hello', age : Integer = 42}") as TupleLiteralNode;
    expect(ast.type).toBe('tupleliteral');
    expect(ast.parts[0].name).toBe('name');
    expect(ast.parts[0].type).toBe('String');
    expect(ast.parts[1].name).toBe('age');
    expect(ast.parts[1].type).toBe('Integer');
  });
});

// ─── 5. Let/In Expressions ──────────────────────────────────────────────────

describe('Parser — Let/In Expressions', () => {
  it('parses let x = 5 in x + 1', () => {
    const ast = parse('let x = 5 in x + 1') as LetInNode;
    expect(ast.type).toBe('letin');
    expect(ast.varName).toBe('x');
    expect(ast.varType).toBeUndefined();
    expect((ast.initExpr as LiteralNode).value).toBe(5);
    expect((ast.bodyExpr as BinaryOpNode).operator).toBe('+');
  });

  it('parses let with type annotation: let x : Integer = 5 in x + 1', () => {
    const ast = parse('let x : Integer = 5 in x + 1') as LetInNode;
    expect(ast.type).toBe('letin');
    expect(ast.varName).toBe('x');
    expect(ast.varType).toBe('Integer');
    expect((ast.initExpr as LiteralNode).value).toBe(5);
  });

  it('parses nested let expressions', () => {
    const ast = parse('let x = 1 in let y = 2 in x + y') as LetInNode;
    expect(ast.type).toBe('letin');
    expect(ast.varName).toBe('x');
    const inner = ast.bodyExpr as LetInNode;
    expect(inner.type).toBe('letin');
    expect(inner.varName).toBe('y');
  });
});

// ─── 6. If/Then/Else/Endif ───────────────────────────────────────────────────

describe('Parser — If/Then/Else/Endif', () => {
  it('parses if true then 1 else 0 endif', () => {
    const ast = parse('if true then 1 else 0 endif') as IfNode;
    expect(ast.type).toBe('if');
    expect((ast.condition as LiteralNode).value).toBe(true);
    expect((ast.thenExpr as LiteralNode).value).toBe(1);
    expect((ast.elseExpr as LiteralNode).value).toBe(0);
  });

  it('parses if with complex condition', () => {
    const ast = parse('if self.age > 18 then true else false endif') as IfNode;
    expect(ast.type).toBe('if');
    expect((ast.condition as BinaryOpNode).operator).toBe('>');
  });

  it('parses nested if expressions', () => {
    const ast = parse('if true then if false then 1 else 2 endif else 3 endif') as IfNode;
    expect(ast.type).toBe('if');
    const inner = ast.thenExpr as IfNode;
    expect(inner.type).toBe('if');
  });
});

// ─── 7. @pre Suffix ─────────────────────────────────────────────────────────

describe('Parser — @pre Suffix', () => {
  it('parses self.name@pre', () => {
    const ast = parse('self.name@pre') as AtPreNode;
    expect(ast.type).toBe('atpre');
    const inner = ast.expression as MethodCallNode;
    expect(inner.type).toBe('methodcall');
    expect(inner.method).toBe('name');
  });

  it('parses self.items->size()@pre', () => {
    const ast = parse('self.items->size()@pre') as AtPreNode;
    expect(ast.type).toBe('atpre');
    const inner = ast.expression as CollectionOpNode;
    expect(inner.type).toBe('collectionop');
    expect(inner.operation).toBe('size');
  });
});

// ─── 8. Iterate ──────────────────────────────────────────────────────────────

describe('Parser — Iterate', () => {
  it('parses ->iterate(x; acc : Integer = 0 | acc + x)', () => {
    const ast = parse('self.items->iterate(x; acc : Integer = 0 | acc + x)') as CollectionOpNode;
    expect(ast.type).toBe('collectionop');
    expect(ast.operation).toBe('iterate');
    expect(ast.iterator).toBe('x');
    expect(ast.iterAcc).toBe('acc');
    expect((ast.iterInit as LiteralNode).value).toBe(0);
    const body = ast.body as BinaryOpNode;
    expect(body.operator).toBe('+');
    expect((body.left as IdentifierNode).name).toBe('acc');
    expect((body.right as IdentifierNode).name).toBe('x');
  });

  it('parses iterate without type annotations', () => {
    const ast = parse('col->iterate(x; acc = 0 | acc + x)') as CollectionOpNode;
    expect(ast.operation).toBe('iterate');
    expect(ast.iterator).toBe('x');
    expect(ast.iterAcc).toBe('acc');
  });
});

// ─── 9. Nested Arrow Operations ─────────────────────────────────────────────

describe('Parser — Nested Arrow Operations', () => {
  it('parses ->select(x | x > 0)->size()', () => {
    const ast = parse('self.items->select(x | x > 0)->size()') as CollectionOpNode;
    expect(ast.type).toBe('collectionop');
    expect(ast.operation).toBe('size');
    const inner = ast.source as CollectionOpNode;
    expect(inner.type).toBe('collectionop');
    expect(inner.operation).toBe('select');
    expect(inner.iterator).toBe('x');
  });

  it('parses triple chained arrow: ->reject()->collect()->size()', () => {
    const ast = parse('self.items->reject(x | x < 0)->collect(x | x * 2)->size()') as CollectionOpNode;
    expect(ast.operation).toBe('size');
    const collect = ast.source as CollectionOpNode;
    expect(collect.operation).toBe('collect');
    const reject = collect.source as CollectionOpNode;
    expect(reject.operation).toBe('reject');
  });
});

// ─── 10. Dot vs Arrow ────────────────────────────────────────────────────────

describe('Parser — Dot vs Arrow', () => {
  it('parses self.name as MethodCallNode (dot navigation)', () => {
    const ast = parse('self.name') as MethodCallNode;
    expect(ast.type).toBe('methodcall');
    expect(ast.method).toBe('name');
    expect((ast.object as SelfNode).type).toBe('self');
    expect(ast.args).toEqual([]);
  });

  it('parses self.friends->size() as CollectionOpNode (arrow)', () => {
    const ast = parse('self.friends->size()') as CollectionOpNode;
    expect(ast.type).toBe('collectionop');
    expect(ast.operation).toBe('size');
    const source = ast.source as MethodCallNode;
    expect(source.type).toBe('methodcall');
    expect(source.method).toBe('friends');
  });

  it('parses self.friends->isEmpty() as CollectionOpNode', () => {
    const ast = parse('self.friends->isEmpty()') as CollectionOpNode;
    expect(ast.type).toBe('collectionop');
    expect(ast.operation).toBe('isEmpty');
  });
});

// ─── 11. Unary Minus and Not ─────────────────────────────────────────────────

describe('Parser — Unary Operators', () => {
  it('parses unary minus: -5', () => {
    const ast = parse('-5') as UnaryOpNode;
    expect(ast.type).toBe('unary');
    expect(ast.operator).toBe('-');
    expect((ast.operand as LiteralNode).value).toBe(5);
  });

  it('parses unary not: not true', () => {
    const ast = parse('not true') as UnaryOpNode;
    expect(ast.type).toBe('unary');
    expect(ast.operator).toBe('not');
    expect((ast.operand as LiteralNode).value).toBe(true);
  });

  it('parses double negation: not not x', () => {
    const ast = parse('not not x') as UnaryOpNode;
    expect(ast.type).toBe('unary');
    expect(ast.operator).toBe('not');
    const inner = ast.operand as UnaryOpNode;
    expect(inner.type).toBe('unary');
    expect(inner.operator).toBe('not');
  });

  it('parses unary minus on expression: -(self.age)', () => {
    const ast = parse('-(self.age)') as UnaryOpNode;
    expect(ast.type).toBe('unary');
    expect(ast.operator).toBe('-');
  });
});

// ─── 12. All Binary Operators ────────────────────────────────────────────────

describe('Parser — Binary Operators', () => {
  const binaryOps: Array<[string, string]> = [
    ['1 + 2', '+'],
    ['1 - 2', '-'],
    ['1 * 2', '*'],
    ['1 / 2', '/'],
    ['7 div 3', 'div'],
    ['7 mod 3', 'mod'],
    ['1 = 2', '='],
    ['1 <> 2', '<>'],
    ['1 < 2', '<'],
    ['1 > 2', '>'],
    ['1 <= 2', '<='],
    ['1 >= 2', '>='],
    ['true and false', 'and'],
    ['true or false', 'or'],
    ['true xor false', 'xor'],
    ['true implies false', 'implies'],
  ];

  for (const [expr, op] of binaryOps) {
    it(`parses '${expr}' with operator '${op}'`, () => {
      const ast = parse(expr) as BinaryOpNode;
      expect(ast.type).toBe('binary');
      expect(ast.operator).toBe(op);
    });
  }

  it('respects arithmetic precedence: 1 + 2 * 3 = 1 + (2*3)', () => {
    const ast = parse('1 + 2 * 3') as BinaryOpNode;
    expect(ast.operator).toBe('+');
    expect((ast.left as LiteralNode).value).toBe(1);
    const right = ast.right as BinaryOpNode;
    expect(right.operator).toBe('*');
    expect((right.left as LiteralNode).value).toBe(2);
    expect((right.right as LiteralNode).value).toBe(3);
  });

  it('respects logical precedence: a and b or c = (a and b) or c', () => {
    const ast = parse('a and b or c') as BinaryOpNode;
    // 'or' is at the top level (lower precedence)
    expect(ast.operator).toBe('or');
    const left = ast.left as BinaryOpNode;
    expect(left.operator).toBe('and');
  });
});

// ─── 13. Method Calls with Args ──────────────────────────────────────────────

describe('Parser — Method Calls with Arguments', () => {
  it('parses self.name.substring(1, 3)', () => {
    const ast = parse('self.name.substring(1, 3)') as MethodCallNode;
    expect(ast.type).toBe('methodcall');
    expect(ast.method).toBe('substring');
    expect(ast.args).toHaveLength(2);
    expect((ast.args[0] as LiteralNode).value).toBe(1);
    expect((ast.args[1] as LiteralNode).value).toBe(3);
    const obj = ast.object as MethodCallNode;
    expect(obj.method).toBe('name');
  });

  it('parses method with no args: self.name.size()', () => {
    const ast = parse('self.name.size()') as MethodCallNode;
    expect(ast.type).toBe('methodcall');
    expect(ast.method).toBe('size');
    expect(ast.args).toHaveLength(0);
  });

  it('parses chained method calls: self.name.toUpper().size()', () => {
    const ast = parse('self.name.toUpper().size()') as MethodCallNode;
    expect(ast.method).toBe('size');
    const inner = ast.object as MethodCallNode;
    expect(inner.method).toBe('toUpper');
  });
});

// ─── 14. Enum Literals (Qualified Names) ─────────────────────────────────────

describe('Parser — Enum Literals', () => {
  it('parses Status::ACTIVE as qualified identifier', () => {
    const ast = parse('Status::ACTIVE') as IdentifierNode;
    expect(ast.type).toBe('identifier');
    expect(ast.name).toBe('Status::ACTIVE');
  });

  it('parses multi-part qualified name: pkg::Status::ACTIVE', () => {
    const ast = parse('pkg::Status::ACTIVE') as IdentifierNode;
    expect(ast.type).toBe('identifier');
    expect(ast.name).toBe('pkg::Status::ACTIVE');
  });

  it('parses enum comparison: self.status = Status::ACTIVE', () => {
    const ast = parse('self.status = Status::ACTIVE') as BinaryOpNode;
    expect(ast.operator).toBe('=');
    const right = ast.right as IdentifierNode;
    expect(right.name).toBe('Status::ACTIVE');
  });
});

// ─── 15. null and invalid Literals ───────────────────────────────────────────

describe('Parser — null and invalid Literals', () => {
  it('parses null', () => {
    const ast = parse('null') as LiteralNode;
    expect(ast.type).toBe('literal');
    expect(ast.valueType).toBe('null');
    expect(ast.value).toBeNull();
  });

  it('parses invalid', () => {
    const ast = parse('invalid') as LiteralNode;
    expect(ast.type).toBe('literal');
    expect(ast.valueType).toBe('invalid');
    expect(ast.value).toBeNull();
  });

  it('parses null comparison: self.name <> null', () => {
    const ast = parse('self.name <> null') as BinaryOpNode;
    expect(ast.operator).toBe('<>');
    const right = ast.right as LiteralNode;
    expect(right.valueType).toBe('null');
  });
});

// ─── 16. Implicit Collect (Dot Navigation on Collections) ────────────────────

describe('Parser — Implicit Collect', () => {
  it('parses self.friends.name as chained dot navigation', () => {
    const ast = parse('self.friends.name') as MethodCallNode;
    expect(ast.type).toBe('methodcall');
    expect(ast.method).toBe('name');
    const obj = ast.object as MethodCallNode;
    expect(obj.method).toBe('friends');
    expect((obj.object as SelfNode).type).toBe('self');
  });

  it('parses self.friends.name.size() as chained calls', () => {
    const ast = parse('self.friends.name.size()') as MethodCallNode;
    expect(ast.method).toBe('size');
    const nameNode = ast.object as MethodCallNode;
    expect(nameNode.method).toBe('name');
  });
});

// ─── 17. oclContainer ────────────────────────────────────────────────────────

describe('Parser — oclContainer', () => {
  it('parses self.oclContainer as property access (methodcall with no args)', () => {
    const ast = parse('self.oclContainer') as MethodCallNode;
    expect(ast.type).toBe('methodcall');
    expect(ast.method).toBe('oclContainer');
    expect(ast.args).toEqual([]);
    expect((ast.object as SelfNode).type).toBe('self');
  });

  it('parses self.oclContainer() as method call', () => {
    const ast = parse('self.oclContainer()') as MethodCallNode;
    expect(ast.type).toBe('methodcall');
    expect(ast.method).toBe('oclContainer');
    expect(ast.args).toEqual([]);
  });
});

// ─── 18. Chained Operations on Collection Literals ───────────────────────────

describe('Parser — Chained Operations on Collection Literals', () => {
  it('parses Set{1,2,3}->select(x | x > 1)->size()', () => {
    const ast = parse('Set{1,2,3}->select(x | x > 1)->size()') as CollectionOpNode;
    expect(ast.type).toBe('collectionop');
    expect(ast.operation).toBe('size');
    const select = ast.source as CollectionOpNode;
    expect(select.type).toBe('collectionop');
    expect(select.operation).toBe('select');
    expect(select.iterator).toBe('x');
    const source = select.source as CollectionLiteralNode;
    expect(source.type).toBe('collectionliteral');
    expect(source.collectionType).toBe('Set');
    expect(source.elements).toHaveLength(3);
  });

  it('parses Sequence{1..5}->collect(x | x * 2)->sum()', () => {
    const ast = parse('Sequence{1..5}->collect(x | x * 2)->sum()') as CollectionOpNode;
    expect(ast.operation).toBe('sum');
    const collect = ast.source as CollectionOpNode;
    expect(collect.operation).toBe('collect');
    const source = collect.source as CollectionLiteralNode;
    expect(source.collectionType).toBe('Sequence');
    expect((source.elements[0] as RangeNode).type).toBe('range');
  });

  it('parses OrderedSet{1,2,3}->at(1)', () => {
    const ast = parse('OrderedSet{1,2,3}->at(1)') as CollectionOpNode;
    expect(ast.operation).toBe('at');
    expect(ast.args).toHaveLength(1);
    expect((ast.args![0] as LiteralNode).value).toBe(1);
    const source = ast.source as CollectionLiteralNode;
    expect(source.collectionType).toBe('OrderedSet');
  });
});

// ─── Additional Edge Cases ───────────────────────────────────────────────────

describe('Parser — Additional Edge Cases', () => {
  it('parses parenthesized expression: (1 + 2) * 3', () => {
    const ast = parse('(1 + 2) * 3') as BinaryOpNode;
    expect(ast.operator).toBe('*');
    const left = ast.left as BinaryOpNode;
    expect(left.operator).toBe('+');
  });

  it('parses self keyword', () => {
    const ast = parse('self') as SelfNode;
    expect(ast.type).toBe('self');
  });

  it('parses string literal', () => {
    const ast = parse("'hello world'") as LiteralNode;
    expect(ast.type).toBe('literal');
    expect(ast.valueType).toBe('string');
    expect(ast.value).toBe('hello world');
  });

  it('parses boolean literals', () => {
    expect((parse('true') as LiteralNode).value).toBe(true);
    expect((parse('false') as LiteralNode).value).toBe(false);
  });

  it('parses number literal', () => {
    const ast = parse('42') as LiteralNode;
    expect(ast.type).toBe('literal');
    expect(ast.valueType).toBe('number');
    expect(ast.value).toBe(42);
  });

  it('parses complex real-world expression', () => {
    const expr = "self.employees->select(e | e.age >= 18 and e.salary > 0)->collect(e | e.name)->size()";
    const ast = parse(expr) as CollectionOpNode;
    expect(ast.operation).toBe('size');
    const collect = ast.source as CollectionOpNode;
    expect(collect.operation).toBe('collect');
    const select = collect.source as CollectionOpNode;
    expect(select.operation).toBe('select');
  });
});
