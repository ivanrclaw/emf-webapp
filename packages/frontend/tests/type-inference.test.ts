import { describe, it, expect, beforeEach } from 'vitest';
import { MTLTypeInference } from '../src/components/ide/language/MTLTypeInference';
import { MetamodelSchemaProvider } from '../src/components/ide/language/MetamodelSchemaProvider';

const sampleMetamodel = {
  eClassifiers: [
    {
      name: 'Person',
      abstract: false,
      interface: false,
      eAttributes: [
        { name: 'name', eType: 'EString' },
        { name: 'age', eType: 'EInt' },
      ],
      eReferences: [
        { name: 'address', targetId: 'Address', containment: true, upperBound: 1 },
        { name: 'friends', targetId: 'Person', containment: false, upperBound: -1 },
      ],
    },
    {
      name: 'Address',
      abstract: false,
      interface: false,
      eAttributes: [
        { name: 'street', eType: 'EString' },
        { name: 'city', eType: 'EString' },
      ],
      eReferences: [],
    },
    {
      name: 'Employee',
      abstract: false,
      interface: false,
      eSuperTypes: ['Person'],
      eAttributes: [
        { name: 'salary', eType: 'EDouble' },
      ],
      eReferences: [
        { name: 'company', targetId: 'Company', containment: false, upperBound: 1 },
      ],
    },
    {
      name: 'Company',
      abstract: false,
      interface: false,
      eAttributes: [
        { name: 'name', eType: 'EString' },
      ],
      eReferences: [
        { name: 'employees', targetId: 'Employee', containment: true, upperBound: -1 },
      ],
    },
  ],
};

describe('MTLTypeInference', () => {
  let inference: MTLTypeInference;
  let schema: MetamodelSchemaProvider;

  beforeEach(() => {
    inference = new MTLTypeInference();
    schema = new MetamodelSchemaProvider(sampleMetamodel);
  });

  describe('getVariablesInScope', () => {
    it('finds template parameters', () => {
      const text = `[module test('http://example.org/1.0')/]
[template public generate(p : Person)]
cursor here
[/template]
`;
      const vars = inference.getVariablesInScope(text, 3, 1);
      const paramVar = vars.find((v) => v.name === 'p');
      expect(paramVar).toBeDefined();
      expect(paramVar!.type.typeName).toBe('Person');
      expect(paramVar!.source).toBe('param');
    });

    it('adds self as alias for first template param', () => {
      const text = `[module test('http://example.org/1.0')/]
[template public generate(p : Person)]
cursor here
[/template]
`;
      const vars = inference.getVariablesInScope(text, 3, 1);
      const selfVar = vars.find((v) => v.name === 'self');
      expect(selfVar).toBeDefined();
      expect(selfVar!.type.typeName).toBe('Person');
      expect(selfVar!.source).toBe('self');
    });

    it('finds for-loop iterators', () => {
      const text = `[module test('http://example.org/1.0')/]
[template public generate(p : Person)]
[for (f : Person | p.friends)]
cursor here
[/for]
[/template]
`;
      const vars = inference.getVariablesInScope(text, 4, 1);
      const forVar = vars.find((v) => v.name === 'f');
      expect(forVar).toBeDefined();
      expect(forVar!.type.typeName).toBe('Person');
      expect(forVar!.source).toBe('for');
    });

    it('does not include for-loop variable after [/for]', () => {
      const text = `[module test('http://example.org/1.0')/]
[template public generate(p : Person)]
[for (f : Person | p.friends)]
inside
[/for]
cursor here
[/template]
`;
      const vars = inference.getVariablesInScope(text, 6, 1);
      const forVar = vars.find((v) => v.name === 'f');
      expect(forVar).toBeUndefined();
    });

    it('finds let bindings', () => {
      const text = `[module test('http://example.org/1.0')/]
[template public generate(p : Person)]
[let fullName : EString = p.name]
cursor here
[/let]
[/template]
`;
      const vars = inference.getVariablesInScope(text, 4, 1);
      const letVar = vars.find((v) => v.name === 'fullName');
      expect(letVar).toBeDefined();
      expect(letVar!.type.typeName).toBe('EString');
      expect(letVar!.source).toBe('let');
    });

    it('does not include let variable after [/let]', () => {
      const text = `[module test('http://example.org/1.0')/]
[template public generate(p : Person)]
[let fullName : EString = p.name]
inside
[/let]
cursor here
[/template]
`;
      const vars = inference.getVariablesInScope(text, 6, 1);
      const letVar = vars.find((v) => v.name === 'fullName');
      expect(letVar).toBeUndefined();
    });

    it('handles multiple template parameters', () => {
      const text = `[module test('http://example.org/1.0')/]
[template public generate(p : Person, a : Address)]
cursor here
[/template]
`;
      const vars = inference.getVariablesInScope(text, 3, 1);
      expect(vars.find((v) => v.name === 'p')).toBeDefined();
      expect(vars.find((v) => v.name === 'a')).toBeDefined();
    });
  });

  describe('resolveExpressionType', () => {
    it('resolves simple attribute access', () => {
      const scope = [{ name: 'p', type: { typeName: 'Person', isCollection: false }, source: 'param' as const }];
      const result = inference.resolveExpressionType('p.name', scope, schema);
      expect(result).not.toBeNull();
      expect(result!.typeName).toBe('EString');
      expect(result!.isCollection).toBe(false);
    });

    it('resolves reference access', () => {
      const scope = [{ name: 'p', type: { typeName: 'Person', isCollection: false }, source: 'param' as const }];
      const result = inference.resolveExpressionType('p.address', scope, schema);
      expect(result).not.toBeNull();
      expect(result!.typeName).toBe('Address');
      expect(result!.isCollection).toBe(false);
    });

    it('resolves multi-valued reference as collection', () => {
      const scope = [{ name: 'p', type: { typeName: 'Person', isCollection: false }, source: 'param' as const }];
      const result = inference.resolveExpressionType('p.friends', scope, schema);
      expect(result).not.toBeNull();
      expect(result!.typeName).toBe('Person');
      expect(result!.isCollection).toBe(true);
    });

    it('resolves chained access', () => {
      const scope = [{ name: 'p', type: { typeName: 'Person', isCollection: false }, source: 'param' as const }];
      const result = inference.resolveExpressionType('p.address.street', scope, schema);
      expect(result).not.toBeNull();
      expect(result!.typeName).toBe('EString');
    });

    it('resolves collection operations with arrow', () => {
      const scope = [{ name: 'p', type: { typeName: 'Person', isCollection: false }, source: 'param' as const }];
      const result = inference.resolveExpressionType('p.friends->size', scope, schema);
      expect(result).not.toBeNull();
      expect(result!.typeName).toBe('EInt');
      expect(result!.isCollection).toBe(false);
    });

    it('resolves select as collection', () => {
      const scope = [{ name: 'p', type: { typeName: 'Person', isCollection: false }, source: 'param' as const }];
      const result = inference.resolveExpressionType('p.friends->select', scope, schema);
      expect(result).not.toBeNull();
      expect(result!.isCollection).toBe(true);
    });

    it('resolves first/last as element', () => {
      const scope = [{ name: 'p', type: { typeName: 'Person', isCollection: false }, source: 'param' as const }];
      const result = inference.resolveExpressionType('p.friends->first', scope, schema);
      expect(result).not.toBeNull();
      expect(result!.typeName).toBe('Person');
      expect(result!.isCollection).toBe(false);
    });

    it('returns null for unknown variable', () => {
      const scope = [{ name: 'p', type: { typeName: 'Person', isCollection: false }, source: 'param' as const }];
      const result = inference.resolveExpressionType('unknown.name', scope, schema);
      expect(result).toBeNull();
    });
  });

  describe('getCompletionContext', () => {
    it('identifies dot-access trigger', () => {
      const text = `[module test('http://example.org/1.0')/]
[template public generate(p : Person)]
[p.
[/template]
`;
      const ctx = inference.getCompletionContext(text, 3, 4, schema);
      expect(ctx.trigger).toBe('dot');
      expect(ctx.expressionPrefix).toBe('p');
    });

    it('identifies arrow trigger', () => {
      const text = `[module test('http://example.org/1.0')/]
[template public generate(p : Person)]
[p.friends->
[/template]
`;
      const ctx = inference.getCompletionContext(text, 3, 13, schema);
      expect(ctx.trigger).toBe('arrow');
    });

    it('identifies keyword position after [', () => {
      const text = `[module test('http://example.org/1.0')/]
[template public generate(p : Person)]
[f
[/template]
`;
      const ctx = inference.getCompletionContext(text, 3, 3, schema);
      expect(ctx.trigger).toBe('keyword_position');
    });

    it('provides variables in scope in context', () => {
      const text = `[module test('http://example.org/1.0')/]
[template public generate(p : Person)]
[p.
[/template]
`;
      const ctx = inference.getCompletionContext(text, 3, 4, schema);
      expect(ctx.variablesInScope.length).toBeGreaterThan(0);
      expect(ctx.variablesInScope.find((v) => v.name === 'p')).toBeDefined();
    });

    it('resolves type for dot-access prefix', () => {
      const text = `[module test('http://example.org/1.0')/]
[template public generate(p : Person)]
[p.
[/template]
`;
      const ctx = inference.getCompletionContext(text, 3, 4, schema);
      expect(ctx.resolvedType).toBeDefined();
      expect(ctx.resolvedType!.typeName).toBe('Person');
    });
  });
});
