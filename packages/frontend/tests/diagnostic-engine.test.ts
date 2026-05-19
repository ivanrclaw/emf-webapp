import { describe, it, expect, beforeEach } from 'vitest';
import { MTLDiagnosticEngine, type Diagnostic } from '../src/components/ide/language/MTLDiagnosticEngine';
import { MetamodelSchemaProvider } from '../src/components/ide/language/MetamodelSchemaProvider';
import { ImportResolver } from '../src/components/ide/language/ImportResolver';

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

describe('MTLDiagnosticEngine', () => {
  let schema: MetamodelSchemaProvider;
  let engine: MTLDiagnosticEngine;

  beforeEach(() => {
    schema = new MetamodelSchemaProvider(sampleMetamodel);
    engine = new MTLDiagnosticEngine(schema);
  });

  describe('unclosed blocks detection', () => {
    it('detects unclosed [template] block (MTL001)', () => {
      const text = `[module test('http://example.org/1.0')/]
[template public generate(p : Person)]
Hello [p.name/]
`;
      const diags = engine.analyze(text);
      const unclosed = diags.find((d) => d.code === 'MTL001');
      expect(unclosed).toBeDefined();
      expect(unclosed!.message).toContain('Unclosed [template]');
    });

    it('detects unclosed [for] block', () => {
      const text = `[module test('http://example.org/1.0')/]
[template public generate(p : Person)]
[for (f : Person | p.friends)]
[f.name/]
[/template]
`;
      const diags = engine.analyze(text);
      // Should have a mismatch or unclosed error
      const blockError = diags.find((d) => d.code === 'MTL003' || d.code === 'MTL001');
      expect(blockError).toBeDefined();
    });

    it('detects unclosed [if] block', () => {
      const text = `[module test('http://example.org/1.0')/]
[template public generate(p : Person)]
[if (p.age > 18)]
Adult
[/template]
`;
      const diags = engine.analyze(text);
      const blockError = diags.find((d) => d.code === 'MTL003' || d.code === 'MTL001');
      expect(blockError).toBeDefined();
    });
  });

  describe('mismatched closing tags', () => {
    it('detects mismatched closing tag (MTL003)', () => {
      const text = `[module test('http://example.org/1.0')/]
[template public generate(p : Person)]
[for (f : Person | p.friends)]
[f.name/]
[/if]
[/template]
`;
      const diags = engine.analyze(text);
      const mismatch = diags.find((d) => d.code === 'MTL003');
      expect(mismatch).toBeDefined();
      expect(mismatch!.message).toContain('expected [/for]');
      expect(mismatch!.message).toContain('found [/if]');
    });

    it('detects orphan closing tag (MTL002)', () => {
      const text = `[module test('http://example.org/1.0')/]
[/template]
`;
      const diags = engine.analyze(text);
      const orphan = diags.find((d) => d.code === 'MTL002');
      expect(orphan).toBeDefined();
      expect(orphan!.message).toContain('Orphan closing tag');
    });
  });

  describe('type errors', () => {
    it('detects access to non-existent attribute (MTL004)', () => {
      const text = `[module test('http://example.org/1.0')/]
[template public generate(p : Person)]
[p.nonExistentAttr/]
[/template]
`;
      const diags = engine.analyze(text);
      const typeErr = diags.find((d) => d.code === 'MTL004');
      expect(typeErr).toBeDefined();
      expect(typeErr!.message).toContain('nonExistentAttr');
      expect(typeErr!.message).toContain('Person');
    });

    it('detects unknown type in declarations (MTL005)', () => {
      const text = `[module test('http://example.org/1.0')/]
[template public generate(p : UnknownType)]
[p.name/]
[/template]
`;
      const diags = engine.analyze(text);
      const typeErr = diags.find((d) => d.code === 'MTL005');
      expect(typeErr).toBeDefined();
      expect(typeErr!.message).toContain('UnknownType');
    });

    it('does not flag valid attribute access', () => {
      const text = `[module test('http://example.org/1.0')/]
[template public generate(p : Person)]
[p.name/]
[p.age/]
[/template]
`;
      const diags = engine.analyze(text);
      const typeErrors = diags.filter((d) => d.code === 'MTL004');
      expect(typeErrors).toHaveLength(0);
    });

    it('does not flag builtin methods as type errors', () => {
      const text = `[module test('http://example.org/1.0')/]
[template public generate(p : Person)]
[p.name.toUpper/]
[p.name.size/]
[/template]
`;
      const diags = engine.analyze(text);
      const typeErrors = diags.filter((d) => d.code === 'MTL004');
      expect(typeErrors).toHaveLength(0);
    });
  });

  describe('warnings', () => {
    it('warns about empty template body (MTL102)', () => {
      const text = `[module test('http://example.org/1.0')/]
[template public generate(p : Person)][/template]
`;
      const diags = engine.analyze(text);
      const emptyWarn = diags.find((d) => d.code === 'MTL102');
      expect(emptyWarn).toBeDefined();
      expect(emptyWarn!.severity).toBe('warning');
    });

    it('warns about missing @main marker (MTL101)', () => {
      const text = `[module test('http://example.org/1.0')/]
[template public generate(p : Person)]
[p.name/]
[/template]
`;
      const diags = engine.analyze(text);
      const mainWarn = diags.find((d) => d.code === 'MTL101');
      expect(mainWarn).toBeDefined();
      expect(mainWarn!.severity).toBe('warning');
    });

    it('does not warn about @main when marker is present', () => {
      const text = `[comment @main/]
[module test('http://example.org/1.0')/]
[template public generate(p : Person)]
[p.name/]
[/template]
`;
      const diags = engine.analyze(text);
      const mainWarn = diags.find((d) => d.code === 'MTL101');
      expect(mainWarn).toBeUndefined();
    });
  });

  describe('import validation integration', () => {
    it('reports import errors when resolver is provided', () => {
      const importResolver = new ImportResolver();
      importResolver.updateIndex([
        { id: 'file-a', filename: 'utils.mtl', content: `[module utils('http://example.org/1.0')/]\n[template public greet(c : Person)]\n[/template]\n` },
      ]);

      const engineWithImports = new MTLDiagnosticEngine(schema, importResolver);
      const text = `[module main('http://example.org/1.0')/]
[import nonexistent/]
[template public generate(p : Person)]
[p.name/]
[/template]
`;
      const diags = engineWithImports.analyze(text, 'file-main');
      const importErr = diags.find((d) => d.code === 'MTL104');
      expect(importErr).toBeDefined();
    });
  });

  describe('valid templates produce no errors', () => {
    it('produces no errors for a well-formed template', () => {
      const text = `[comment @main/]
[module test('http://example.org/1.0')/]

[template public generate(p : Person)]
[file (p.name.concat('.txt'), false, 'UTF-8')]
Name: [p.name/]
Age: [p.age/]
[for (f : Person | p.friends)]
  Friend: [f.name/]
[/for]
[if (p.age)]
  Has age
[/if]
[/file]
[/template]
`;
      const diags = engine.analyze(text);
      const errors = diags.filter((d) => d.severity === 'error');
      expect(errors).toHaveLength(0);
    });
  });
});
