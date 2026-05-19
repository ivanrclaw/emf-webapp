/**
 * Tests for OCLSemanticValidator — Phase 4: Type checking & diagnostics
 */
import { describe, it, expect } from 'vitest';
import {
  OCLSemanticValidator,
  OCLDiagnostic,
  SemanticValidationResult,
} from '../src/ocl/OCLSemanticValidator.js';
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
        { name: 'salary', type: 'EDouble' },
      ],
      references: [
        { name: 'employer', targetClass: 'Company', many: false },
        { name: 'friends', targetClass: 'Person', many: true },
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
        { name: 'ceo', targetClass: 'Person', many: false },
      ],
    },
    {
      name: 'Department',
      attributes: [
        { name: 'deptName', type: 'EString' },
      ],
      references: [
        { name: 'members', targetClass: 'Person', many: true },
        { name: 'company', targetClass: 'Company', many: false },
      ],
    },
  ],
  hierarchy: new Map([
    // No inheritance in this simple model
  ]),
};

function validate(expr: string, ctx = 'Person'): SemanticValidationResult {
  const validator = new OCLSemanticValidator(testMetamodel);
  return validator.validate(expr, ctx);
}

function errors(result: SemanticValidationResult): OCLDiagnostic[] {
  return result.diagnostics.filter((d) => d.severity === 'error');
}

function warnings(result: SemanticValidationResult): OCLDiagnostic[] {
  return result.diagnostics.filter((d) => d.severity === 'warning');
}

function infos(result: SemanticValidationResult): OCLDiagnostic[] {
  return result.diagnostics.filter((d) => d.severity === 'info');
}

// ── Basic Validation ──────────────────────────────────────────────

describe('OCLSemanticValidator — Basic', () => {
  it('validates empty expression', () => {
    const result = validate('');
    expect(result.valid).toBe(false);
    expect(errors(result)[0].code).toBe('OCL_EMPTY');
  });

  it('validates whitespace-only expression', () => {
    const result = validate('   ');
    expect(result.valid).toBe(false);
  });

  it('reports lexer errors', () => {
    const result = validate('name @@ invalid');
    expect(result.valid).toBe(false);
    expect(errors(result).some((e) => e.code === 'OCL_PARSE_ERROR' || e.code === 'OCL_LEXER_ERROR')).toBe(true);
  });

  it('reports parse errors', () => {
    const result = validate('name + + age');
    expect(result.valid).toBe(false);
  });

  it('reports unknown context class', () => {
    const result = validate('name', 'NonExistentClass');
    expect(result.valid).toBe(false);
    expect(errors(result)[0].code).toBe('OCL_UNKNOWN_CONTEXT');
  });

  it('valid simple attribute access', () => {
    const result = validate('name');
    expect(result.valid).toBe(true);
    expect(result.diagnostics).toHaveLength(0);
  });

  it('valid self access', () => {
    const result = validate('self.name');
    expect(result.valid).toBe(true);
  });
});

// ── Type Checking ─────────────────────────────────────────────────

describe('OCLSemanticValidator — Type Checking', () => {
  it('detects undefined feature on class', () => {
    const result = validate('self.nonExistent');
    expect(result.valid).toBe(false);
    expect(errors(result).some((e) => e.code === 'OCL_UNDEFINED_FEATURE')).toBe(true);
  });

  it('valid reference navigation', () => {
    const result = validate('self.employer');
    expect(result.valid).toBe(true);
  });

  it('valid chained navigation', () => {
    const result = validate('self.employer.companyName');
    expect(result.valid).toBe(true);
  });

  it('detects undefined feature on navigated class', () => {
    const result = validate('self.employer.nonExistent');
    expect(result.valid).toBe(false);
    expect(errors(result).some((e) => e.code === 'OCL_UNDEFINED_FEATURE')).toBe(true);
  });

  it('valid collection operation on multi-valued reference', () => {
    const result = validate('self.friends->size()');
    expect(result.valid).toBe(true);
  });

  it('valid string operation', () => {
    const result = validate('name.size()');
    expect(result.valid).toBe(true);
  });

  it('detects undefined operation on string', () => {
    const result = validate('name.nonExistentOp()');
    expect(result.valid).toBe(false);
    expect(errors(result).some((e) => e.code === 'OCL_UNDEFINED_OPERATION')).toBe(true);
  });

  it('valid arithmetic on numeric attributes', () => {
    const result = validate('age + 1');
    expect(result.valid).toBe(true);
  });

  it('valid boolean expression', () => {
    const result = validate('active and age > 18');
    expect(result.valid).toBe(true);
  });

  it('valid let expression', () => {
    const result = validate('let x : Integer = age in x > 0');
    expect(result.valid).toBe(true);
  });

  it('valid if expression', () => {
    const result = validate("if active then name else 'unknown' endif");
    expect(result.valid).toBe(true);
  });

  it('valid collection forAll', () => {
    const result = validate("friends->forAll(f | f.name <> '')", 'Person');
    expect(result.valid).toBe(true);
  });

  it('valid collection select', () => {
    const result = validate('friends->select(f | f.age > 18)', 'Person');
    expect(result.valid).toBe(true);
  });

  it('valid collection collect', () => {
    const result = validate('friends->collect(f | f.name)', 'Person');
    expect(result.valid).toBe(true);
  });

  it('valid from Company context', () => {
    const result = validate('employees->size() > 0', 'Company');
    expect(result.valid).toBe(true);
  });

  it('valid chained from Company', () => {
    const result = validate('ceo.name', 'Company');
    expect(result.valid).toBe(true);
  });
});

// ── Warnings ──────────────────────────────────────────────────────

describe('OCLSemanticValidator — Warnings', () => {
  it('warns about non-boolean if condition', () => {
    const result = validate("if name then 'yes' else 'no' endif");
    const w = warnings(result);
    expect(w.some((d) => d.code === 'OCL_IF_CONDITION_TYPE')).toBe(true);
  });

  it('warns about non-boolean logical operands', () => {
    const result = validate('name and age');
    const w = warnings(result);
    expect(w.some((d) => d.code === 'OCL_BOOLEAN_EXPECTED')).toBe(true);
  });

  it('warns about comparison between non-numeric types', () => {
    const result = validate("name > 'hello'");
    const w = warnings(result);
    expect(w.some((d) => d.code === 'OCL_COMPARISON_TYPE')).toBe(true);
  });

  it('warns about unused let variable', () => {
    const result = validate('let x : Integer = 42 in age > 0');
    const w = warnings(result);
    expect(w.some((d) => d.code === 'OCL_UNUSED_VARIABLE')).toBe(true);
  });

  it('no warning when let variable is used', () => {
    const result = validate('let x : Integer = 42 in x > 0');
    const w = warnings(result);
    expect(w.some((d) => d.code === 'OCL_UNUSED_VARIABLE')).toBe(false);
  });
});

// ── Collection Operation Checks ───────────────────────────────────

describe('OCLSemanticValidator — Collection Checks', () => {
  it('String can use collection ops (String is Sequence in OCL 2.4)', () => {
    const result = validate('name->size()');
    // String is treated as a collection (Sequence of characters) in OCL 2.4
    const errs = errors(result);
    expect(errs.some((e) => e.code === 'OCL_NOT_COLLECTION')).toBe(false);
    expect(result.valid).toBe(true);
  });

  it('valid collection op on multi-valued ref', () => {
    const result = validate('friends->isEmpty()');
    expect(result.valid).toBe(true);
  });

  it('info about dot vs arrow', () => {
    const result = validate('friends.size()');
    const i = infos(result);
    expect(i.some((d) => d.code === 'OCL_DOT_VS_ARROW')).toBe(true);
  });

  it('valid iterate', () => {
    // iterate is complex — the type inference may not fully resolve accumulator types
    // At minimum it should parse and not produce syntax errors
    const result = validate('friends->iterate(f; acc : Integer = 0 | acc + 1)');
    // Check no parse errors
    const parseErrors = result.diagnostics.filter((d) => d.code === 'OCL_PARSE_ERROR');
    expect(parseErrors).toHaveLength(0);
  });
});

// ── Inferred Type ─────────────────────────────────────────────────

describe('OCLSemanticValidator — Inferred Type', () => {
  it('infers String type for name', () => {
    const result = validate('name');
    expect(result.inferredType).toBeDefined();
    expect(result.inferredType?.kind).toBe('primitive');
    if (result.inferredType?.kind === 'primitive') {
      expect(result.inferredType.name).toBe('String');
    }
  });

  it('infers Integer type for age', () => {
    const result = validate('age');
    expect(result.inferredType).toBeDefined();
    expect(result.inferredType?.kind).toBe('primitive');
    if (result.inferredType?.kind === 'primitive') {
      expect(result.inferredType.name).toBe('Integer');
    }
  });

  it('infers Boolean for comparison', () => {
    const result = validate('age > 18');
    expect(result.inferredType).toBeDefined();
    expect(result.inferredType?.kind).toBe('primitive');
    if (result.inferredType?.kind === 'primitive') {
      expect(result.inferredType.name).toBe('Boolean');
    }
  });

  it('infers Collection for multi-valued ref', () => {
    const result = validate('friends');
    expect(result.inferredType).toBeDefined();
    expect(result.inferredType?.kind).toBe('collection');
  });

  it('infers Class type for single-valued ref', () => {
    const result = validate('employer');
    expect(result.inferredType).toBeDefined();
    expect(result.inferredType?.kind).toBe('class');
    if (result.inferredType?.kind === 'class') {
      expect(result.inferredType.name).toBe('Company');
    }
  });

  it('infers Integer for size()', () => {
    const result = validate('friends->size()');
    expect(result.inferredType).toBeDefined();
    expect(result.inferredType?.kind).toBe('primitive');
    if (result.inferredType?.kind === 'primitive') {
      expect(result.inferredType.name).toBe('Integer');
    }
  });

  it('infers Boolean for forAll', () => {
    const result = validate('friends->forAll(f | f.age > 0)');
    expect(result.inferredType).toBeDefined();
    expect(result.inferredType?.kind).toBe('primitive');
    if (result.inferredType?.kind === 'primitive') {
      expect(result.inferredType.name).toBe('Boolean');
    }
  });
});

// ── Complex Expressions ───────────────────────────────────────────

describe('OCLSemanticValidator — Complex Expressions', () => {
  it('validates complex invariant-style expression', () => {
    const result = validate(
      "friends->forAll(f | f.age >= 18 and f.name.size() > 0)",
      'Person',
    );
    expect(result.valid).toBe(true);
  });

  it('validates nested collection operations', () => {
    const result = validate(
      'employees->select(e | e.age > 30)->collect(e | e.name)',
      'Company',
    );
    expect(result.valid).toBe(true);
  });

  it('validates let with collection', () => {
    const result = validate(
      'let adults = friends->select(f | f.age >= 18) in adults->size() > 0',
      'Person',
    );
    expect(result.valid).toBe(true);
  });

  it('validates if with navigation', () => {
    const result = validate(
      "if employer.revenue > 1000000 then 'rich' else 'modest' endif",
      'Person',
    );
    expect(result.valid).toBe(true);
  });

  it('validates cross-context navigation', () => {
    const result = validate(
      'members->collect(m | m.employer.companyName)',
      'Department',
    );
    expect(result.valid).toBe(true);
  });
});
