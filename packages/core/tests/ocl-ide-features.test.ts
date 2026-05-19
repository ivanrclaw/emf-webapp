/**
 * Tests for OCLCompletionEngine & OCLHoverEngine — Phase 5: IDE Features
 */
import { describe, it, expect } from 'vitest';
import { OCLCompletionEngine, OCLCompletionItem } from '../src/ocl/OCLCompletionEngine.js';
import { OCLHoverEngine } from '../src/ocl/OCLHoverEngine.js';
import { OCLDefinitionEngine } from '../src/ocl/OCLDefinitionEngine.js';
import { MetamodelInfo } from '../src/ocl/OCLTypeInference.js';

// ── Test Metamodel ────────────────────────────────────────────────

const testMetamodel: MetamodelInfo = {
  classes: [
    {
      name: 'Person',
      attributes: [
        { name: 'name', type: 'EString' },
        { name: 'age', type: 'EInt' },
        { name: 'active', type: 'EBoolean' },
      ],
      references: [
        { name: 'employer', targetClass: 'Company', many: false },
        { name: 'friends', targetClass: 'Person', many: true },
      ],
      operations: [
        { name: 'fullName', returnType: 'EString', params: [] },
      ],
    },
    {
      name: 'Company',
      attributes: [
        { name: 'companyName', type: 'EString' },
        { name: 'revenue', type: 'EDouble' },
      ],
      references: [
        { name: 'employees', targetClass: 'Person', many: true },
      ],
    },
  ],
  hierarchy: new Map(),
};

// ── Completion Engine Tests ───────────────────────────────────────

describe('OCLCompletionEngine', () => {
  const engine = new OCLCompletionEngine(testMetamodel);

  describe('Empty / Identifier completions', () => {
    it('provides context features on empty expression', () => {
      const items = engine.complete('', 0, 'Person');
      expect(items.length).toBeGreaterThan(0);
      expect(items.some((i) => i.label === 'name')).toBe(true);
      expect(items.some((i) => i.label === 'age')).toBe(true);
      expect(items.some((i) => i.label === 'friends')).toBe(true);
    });

    it('provides keywords', () => {
      const items = engine.complete('', 0, 'Person');
      expect(items.some((i) => i.label === 'self')).toBe(true);
      expect(items.some((i) => i.label === 'if')).toBe(true);
      expect(items.some((i) => i.label === 'let')).toBe(true);
    });

    it('filters by prefix', () => {
      const items = engine.complete('na', 2, 'Person');
      expect(items.some((i) => i.label === 'name')).toBe(true);
      expect(items.every((i) => i.label.startsWith('na'))).toBe(true);
    });

    it('provides type names', () => {
      const items = engine.complete('', 0, 'Person');
      expect(items.some((i) => i.label === 'Company' && i.kind === 'type')).toBe(true);
    });
  });

  describe('Dot completions', () => {
    it('provides class features after self.', () => {
      const items = engine.complete('self.', 5, 'Person');
      expect(items.some((i) => i.label === 'name' && i.kind === 'attribute')).toBe(true);
      expect(items.some((i) => i.label === 'employer' && i.kind === 'reference')).toBe(true);
    });

    it('provides features of navigated class', () => {
      const items = engine.complete('self.employer.', 14, 'Person');
      expect(items.some((i) => i.label === 'companyName')).toBe(true);
      expect(items.some((i) => i.label === 'revenue')).toBe(true);
      expect(items.some((i) => i.label === 'employees')).toBe(true);
    });

    it('provides standard library operations', () => {
      const items = engine.complete('name.', 5, 'Person');
      // String operations
      expect(items.some((i) => i.label === 'size')).toBe(true);
      expect(items.some((i) => i.label === 'substring')).toBe(true);
      expect(items.some((i) => i.label === 'toUpper')).toBe(true);
    });

    it('filters dot completions by prefix', () => {
      const items = engine.complete('self.na', 7, 'Person');
      expect(items.some((i) => i.label === 'name')).toBe(true);
      expect(items.every((i) => i.label.startsWith('na'))).toBe(true);
    });

    it('provides custom operations', () => {
      const items = engine.complete('self.', 5, 'Person');
      expect(items.some((i) => i.label === 'fullName')).toBe(true);
    });
  });

  describe('Arrow completions', () => {
    it('provides collection operations after ->', () => {
      const items = engine.complete('friends->', 9, 'Person');
      expect(items.some((i) => i.label === 'size')).toBe(true);
      expect(items.some((i) => i.label === 'forAll')).toBe(true);
      expect(items.some((i) => i.label === 'select')).toBe(true);
      expect(items.some((i) => i.label === 'collect')).toBe(true);
      expect(items.some((i) => i.label === 'isEmpty')).toBe(true);
    });

    it('filters arrow completions by prefix', () => {
      const items = engine.complete('friends->se', 11, 'Person');
      expect(items.some((i) => i.label === 'select')).toBe(true);
      expect(items.every((i) => i.label.startsWith('se'))).toBe(true);
    });

    it('provides iterator operations with snippet insertText', () => {
      const items = engine.complete('friends->', 9, 'Person');
      const forAll = items.find((i) => i.label === 'forAll');
      expect(forAll).toBeDefined();
      expect(forAll!.insertText).toContain('|');
    });

    it('provides all collection operation categories', () => {
      const items = engine.complete('friends->', 9, 'Person');
      // Query
      expect(items.some((i) => i.label === 'includes')).toBe(true);
      // Transformation
      expect(items.some((i) => i.label === 'asSet')).toBe(true);
      // Ordered
      expect(items.some((i) => i.label === 'first')).toBe(true);
      expect(items.some((i) => i.label === 'reverse')).toBe(true);
      // Set ops
      expect(items.some((i) => i.label === 'union')).toBe(true);
      expect(items.some((i) => i.label === 'intersection')).toBe(true);
    });
  });

  describe('Sort order', () => {
    it('attributes come before operations', () => {
      const items = engine.complete('self.', 5, 'Person');
      const nameItem = items.find((i) => i.label === 'name');
      const oclTypeItem = items.find((i) => i.label === 'oclType');
      expect(nameItem).toBeDefined();
      expect(oclTypeItem).toBeDefined();
      expect(nameItem!.sortOrder).toBeLessThan(oclTypeItem!.sortOrder);
    });

    it('references come before stdlib operations', () => {
      const items = engine.complete('self.', 5, 'Person');
      const empItem = items.find((i) => i.label === 'employer');
      const toStrItem = items.find((i) => i.label === 'toString');
      expect(empItem).toBeDefined();
      expect(toStrItem).toBeDefined();
      expect(empItem!.sortOrder).toBeLessThan(toStrItem!.sortOrder);
    });
  });
});

// ── Hover Engine Tests ────────────────────────────────────────────

describe('OCLHoverEngine', () => {
  const engine = new OCLHoverEngine(testMetamodel);

  describe('Identifier hover', () => {
    it('shows type for attribute', () => {
      const info = engine.hover('name', 2, 'Person');
      expect(info).not.toBeNull();
      expect(info!.word).toBe('name');
      expect(info!.type).toBe('String');
    });

    it('shows type for reference', () => {
      const info = engine.hover('employer', 4, 'Person');
      expect(info).not.toBeNull();
      expect(info!.type).toBe('Company');
    });

    it('shows type for multi-valued reference', () => {
      const info = engine.hover('friends', 3, 'Person');
      expect(info).not.toBeNull();
      expect(info!.type).toBe('Set(Person)');
    });

    it('shows class info for type name', () => {
      const info = engine.hover('Company', 3, 'Person');
      expect(info).not.toBeNull();
      expect(info!.type).toBe('Class');
      expect(info!.documentation).toContain('companyName');
    });
  });

  describe('Keyword hover', () => {
    it('shows info for self', () => {
      const info = engine.hover('self', 2, 'Person');
      expect(info).not.toBeNull();
      expect(info!.type).toBe('Person');
    });

    it('shows info for true', () => {
      const info = engine.hover('true', 2, 'Person');
      expect(info).not.toBeNull();
      expect(info!.type).toBe('Boolean');
    });
  });

  describe('Literal hover', () => {
    it('shows Integer for number literal', () => {
      const info = engine.hover('42', 1, 'Person');
      expect(info).not.toBeNull();
      expect(info!.type).toBe('Integer');
    });

    it('shows Real for float literal', () => {
      const info = engine.hover('3.14', 2, 'Person');
      expect(info).not.toBeNull();
      expect(info!.type).toBe('Real');
    });

    it('shows String for string literal', () => {
      const info = engine.hover("'hello'", 3, 'Person');
      expect(info).not.toBeNull();
      expect(info!.type).toBe('String');
    });
  });

  describe('Dot navigation hover', () => {
    it('shows type for navigated attribute', () => {
      const info = engine.hover('self.name', 7, 'Person');
      expect(info).not.toBeNull();
      expect(info!.word).toBe('name');
      expect(info!.type).toBe('String');
    });

    it('shows type for chained navigation', () => {
      const info = engine.hover('self.employer.companyName', 18, 'Person');
      expect(info).not.toBeNull();
      expect(info!.word).toBe('companyName');
      expect(info!.type).toBe('String');
    });
  });

  describe('Arrow operation hover', () => {
    it('shows info for collection operation', () => {
      const info = engine.hover('friends->size', 11, 'Person');
      expect(info).not.toBeNull();
      expect(info!.word).toBe('size');
      expect(info!.type).toBe('Integer');
      expect(info!.signature).toContain('size()');
    });

    it('shows info for iterator operation', () => {
      const info = engine.hover('friends->forAll', 12, 'Person');
      expect(info).not.toBeNull();
      expect(info!.word).toBe('forAll');
      expect(info!.type).toBe('Boolean');
    });
  });

  describe('Range information', () => {
    it('provides correct range for hovered word', () => {
      const info = engine.hover('self.name', 7, 'Person');
      expect(info).not.toBeNull();
      expect(info!.range.start).toBe(5);
      expect(info!.range.end).toBe(9);
    });
  });
});

// ── Definition Engine Tests ───────────────────────────────────────

describe('OCLDefinitionEngine', () => {
  const engine = new OCLDefinitionEngine(testMetamodel);

  describe('Direct identifier resolution', () => {
    it('resolves attribute in context class', () => {
      const result = engine.findDefinition('name', 2, 'Person');
      expect(result).not.toBeNull();
      expect(result!.target.kind).toBe('attribute');
      expect(result!.target.name).toBe('name');
      expect(result!.target.ownerClass).toBe('Person');
      expect(result!.target.type).toBe('EString');
    });

    it('resolves reference in context class', () => {
      const result = engine.findDefinition('employer', 4, 'Person');
      expect(result).not.toBeNull();
      expect(result!.target.kind).toBe('reference');
      expect(result!.target.name).toBe('employer');
      expect(result!.target.type).toBe('Company');
    });

    it('resolves class name', () => {
      const result = engine.findDefinition('Company', 3, 'Person');
      expect(result).not.toBeNull();
      expect(result!.target.kind).toBe('class');
      expect(result!.target.name).toBe('Company');
    });
  });

  describe('Dot navigation resolution', () => {
    it('resolves attribute after dot', () => {
      const result = engine.findDefinition('self.name', 7, 'Person');
      expect(result).not.toBeNull();
      expect(result!.target.kind).toBe('attribute');
      expect(result!.target.name).toBe('name');
      expect(result!.target.ownerClass).toBe('Person');
    });

    it('resolves chained navigation', () => {
      const result = engine.findDefinition('self.employer.companyName', 18, 'Person');
      expect(result).not.toBeNull();
      expect(result!.target.kind).toBe('attribute');
      expect(result!.target.name).toBe('companyName');
      expect(result!.target.ownerClass).toBe('Company');
    });

    it('resolves reference after dot', () => {
      const result = engine.findDefinition('self.employer', 8, 'Person');
      expect(result).not.toBeNull();
      expect(result!.target.kind).toBe('reference');
      expect(result!.target.name).toBe('employer');
      expect(result!.target.type).toBe('Company');
    });
  });

  describe('Variable resolution', () => {
    it('resolves let variable', () => {
      const result = engine.findDefinition('let x = 5 in x', 13, 'Person');
      expect(result).not.toBeNull();
      expect(result!.target.kind).toBe('variable');
      expect(result!.target.name).toBe('x');
    });

    it('resolves iterator variable', () => {
      // In 'friends->select(f | f.age > 18)', cursor on second 'f'
      const expr = 'friends->select(f | f.age > 18)';
      const secondF = expr.indexOf('f.age');
      const result = engine.findDefinition(expr, secondF, 'Person');
      expect(result).not.toBeNull();
      expect(result!.target.kind).toBe('variable');
      expect(result!.target.name).toBe('f');
    });
  });

  describe('Returns null for unknown symbols', () => {
    it('returns null for stdlib operations', () => {
      // 'size' after -> is not a metamodel feature
      const result = engine.findDefinition('friends->size', 11, 'Person');
      expect(result).toBeNull();
    });

    it('returns null for non-existent features', () => {
      const result = engine.findDefinition('self.nonExistent', 10, 'Person');
      expect(result).toBeNull();
    });
  });
});

// ── Completion after binary operators (bug fix) ─────────────────────

describe('OCLCompletionEngine — receiver extraction after binary ops', () => {
  const engine = new OCLCompletionEngine(testMetamodel);

  it('provides completions after <> self.', () => {
    const expr = 'self.age <> self.';
    const items = engine.complete(expr, expr.length, 'Person');
    const names = items.map(i => i.label);
    expect(names).toContain('name');
    expect(names).toContain('age');
    expect(names).toContain('active');
  });

  it('provides completions after <> self.n (prefix filter)', () => {
    const expr = 'self.age <> self.n';
    const items = engine.complete(expr, expr.length, 'Person');
    const names = items.map(i => i.label);
    expect(names).toContain('name');
    expect(names).not.toContain('age');
  });

  it('provides completions after and self.', () => {
    const expr = 'self.age > 0 and self.';
    const items = engine.complete(expr, expr.length, 'Person');
    const names = items.map(i => i.label);
    expect(names).toContain('name');
    expect(names).toContain('employer');
  });

  it('provides completions after implies self.', () => {
    const expr = 'self.age > 0 implies self.';
    const items = engine.complete(expr, expr.length, 'Person');
    const names = items.map(i => i.label);
    expect(names).toContain('name');
  });

  it('provides completions after not self.', () => {
    const expr = 'not self.';
    const items = engine.complete(expr, expr.length, 'Person');
    const names = items.map(i => i.label);
    expect(names).toContain('active');
  });

  it('provides completions on chained navigation after binary op', () => {
    const expr = 'self.age > 0 and self.employer.';
    const items = engine.complete(expr, expr.length, 'Person');
    const names = items.map(i => i.label);
    expect(names).toContain('companyName');
    expect(names).toContain('revenue');
  });

  it('provides arrow completions after binary op', () => {
    const expr = 'self.age > 0 and self.friends->';
    const items = engine.complete(expr, expr.length, 'Person');
    const names = items.map(i => i.label);
    expect(names).toContain('select');
    expect(names).toContain('forAll');
    expect(names).toContain('size');
  });
});
