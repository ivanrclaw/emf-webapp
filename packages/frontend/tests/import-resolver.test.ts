import { describe, it, expect, beforeEach } from 'vitest';
import { ImportResolver } from '../src/components/ide/language/ImportResolver';

describe('ImportResolver', () => {
  let resolver: ImportResolver;

  const fileA = {
    id: 'file-a',
    filename: 'utils.mtl',
    content: `[module utils('http://example.org/1.0')/]

[template public greet(c : EClass)]
Hello [c.name/]
[/template]

[template private helper(c : EClass)]
internal
[/template]

[query public fullName(c : EClass) : EString = c.name.concat('Impl')/]

[query private internalQuery(c : EClass) : EString = c.name/]
`,
  };

  const fileB = {
    id: 'file-b',
    filename: 'main.mtl',
    content: `[module main('http://example.org/1.0')/]

[import utils/]

[template public generate(c : EClass)]
[file (c.name.concat('.java'), false, 'UTF-8')]
[greet(c)/]
[/file]
[/template]
`,
  };

  const fileC = {
    id: 'file-c',
    filename: 'extra.mtl',
    content: `[module extra('http://example.org/1.0')/]

[import main/]

[template public doSomething(c : EClass)]
extra stuff
[/template]
`,
  };

  beforeEach(() => {
    resolver = new ImportResolver();
  });

  describe('updateIndex / module indexing', () => {
    it('parses module name from [module name(...)] declaration', () => {
      resolver.updateIndex([fileA]);
      const mod = resolver.getModuleForFile('file-a');
      expect(mod).not.toBeNull();
      expect(mod!.moduleName).toBe('utils');
    });

    it('indexes multiple files', () => {
      resolver.updateIndex([fileA, fileB, fileC]);
      const modules = resolver.getAvailableModules();
      expect(modules).toHaveLength(3);
    });

    it('extracts templates with correct visibility', () => {
      resolver.updateIndex([fileA]);
      const mod = resolver.getModuleForFile('file-a');
      expect(mod!.templates).toHaveLength(2);
      expect(mod!.templates[0]).toMatchObject({ name: 'greet', visibility: 'public' });
      expect(mod!.templates[1]).toMatchObject({ name: 'helper', visibility: 'private' });
    });

    it('extracts queries with visibility and return type', () => {
      resolver.updateIndex([fileA]);
      const mod = resolver.getModuleForFile('file-a');
      expect(mod!.queries).toHaveLength(2);
      expect(mod!.queries[0]).toMatchObject({
        name: 'fullName',
        visibility: 'public',
        returnType: 'EString',
      });
      expect(mod!.queries[1]).toMatchObject({
        name: 'internalQuery',
        visibility: 'private',
      });
    });

    it('extracts import declarations', () => {
      resolver.updateIndex([fileA, fileB]);
      const mod = resolver.getModuleForFile('file-b');
      expect(mod!.imports).toContain('utils');
    });
  });

  describe('resolveImport', () => {
    beforeEach(() => {
      resolver.updateIndex([fileA, fileB, fileC]);
    });

    it('resolves by module name', () => {
      const resolved = resolver.resolveImport('utils');
      expect(resolved).not.toBeNull();
      expect(resolved!.fileId).toBe('file-a');
    });

    it('resolves by filename without extension', () => {
      const resolved = resolver.resolveImport('utils');
      expect(resolved).not.toBeNull();
      expect(resolved!.filename).toBe('utils.mtl');
    });

    it('returns null for unknown module', () => {
      const resolved = resolver.resolveImport('nonexistent');
      expect(resolved).toBeNull();
    });
  });

  describe('getAvailableModules', () => {
    it('excludes the specified file', () => {
      resolver.updateIndex([fileA, fileB, fileC]);
      const available = resolver.getAvailableModules('file-a');
      expect(available).toHaveLength(2);
      expect(available.every((m) => m.fileId !== 'file-a')).toBe(true);
    });
  });

  describe('getImportedSymbols', () => {
    beforeEach(() => {
      resolver.updateIndex([fileA, fileB]);
    });

    it('returns only public templates from imported modules', () => {
      const symbols = resolver.getImportedSymbols(fileB.content, 'file-b');
      expect(symbols.templates).toHaveLength(1);
      expect(symbols.templates[0].name).toBe('greet');
      expect(symbols.templates[0].visibility).toBe('public');
    });

    it('returns only public queries from imported modules', () => {
      const symbols = resolver.getImportedSymbols(fileB.content, 'file-b');
      expect(symbols.queries).toHaveLength(1);
      expect(symbols.queries[0].name).toBe('fullName');
    });

    it('provides source file mapping', () => {
      const symbols = resolver.getImportedSymbols(fileB.content, 'file-b');
      expect(symbols.sourceFiles.get('greet')).toBe('utils.mtl');
      expect(symbols.sourceFiles.get('fullName')).toBe('utils.mtl');
    });

    it('does not include private symbols', () => {
      const symbols = resolver.getImportedSymbols(fileB.content, 'file-b');
      const allNames = [
        ...symbols.templates.map((t) => t.name),
        ...symbols.queries.map((q) => q.name),
      ];
      expect(allNames).not.toContain('helper');
      expect(allNames).not.toContain('internalQuery');
    });
  });

  describe('validateImports', () => {
    it('detects unresolved imports (MTL104)', () => {
      resolver.updateIndex([fileA]);
      const content = `[module test('http://example.org/1.0')/]\n[import nonexistent/]\n`;
      const diags = resolver.validateImports(content, 'file-test');
      expect(diags).toHaveLength(1);
      expect(diags[0].code).toBe('MTL104');
      expect(diags[0].severity).toBe('error');
      expect(diags[0].message).toContain('nonexistent');
    });

    it('detects self-imports (MTL105)', () => {
      resolver.updateIndex([fileA]);
      const content = `[module utils('http://example.org/1.0')/]\n[import utils/]\n`;
      const diags = resolver.validateImports(content, 'file-a');
      expect(diags).toHaveLength(1);
      expect(diags[0].code).toBe('MTL105');
      expect(diags[0].severity).toBe('warning');
      expect(diags[0].message).toContain('imports itself');
    });

    it('returns no diagnostics for valid imports', () => {
      resolver.updateIndex([fileA, fileB]);
      const diags = resolver.validateImports(fileB.content, 'file-b');
      // Filter out circular import warnings — only check for errors
      const errors = diags.filter((d) => d.code === 'MTL104' || d.code === 'MTL105');
      expect(errors).toHaveLength(0);
    });
  });

  describe('findDefinitionFile', () => {
    it('locates a template defined in another file', () => {
      resolver.updateIndex([fileA, fileB]);
      const def = resolver.findDefinitionFile('greet');
      expect(def).not.toBeNull();
      expect(def!.fileId).toBe('file-a');
      expect(def!.filename).toBe('utils.mtl');
      expect(def!.line).toBeGreaterThan(0);
    });

    it('locates a query defined in another file', () => {
      resolver.updateIndex([fileA, fileB]);
      const def = resolver.findDefinitionFile('fullName');
      expect(def).not.toBeNull();
      expect(def!.fileId).toBe('file-a');
    });

    it('returns null for unknown symbol', () => {
      resolver.updateIndex([fileA, fileB]);
      const def = resolver.findDefinitionFile('unknownSymbol');
      expect(def).toBeNull();
    });
  });

  describe('circular import detection', () => {
    it('detects circular imports (MTL106)', () => {
      const circA = {
        id: 'circ-a',
        filename: 'circA.mtl',
        content: `[module circA('http://example.org/1.0')/]\n[import circB/]\n[template public tA(c : EClass)]\n[/template]\n`,
      };
      const circB = {
        id: 'circ-b',
        filename: 'circB.mtl',
        content: `[module circB('http://example.org/1.0')/]\n[import circA/]\n[template public tB(c : EClass)]\n[/template]\n`,
      };
      resolver.updateIndex([circA, circB]);
      const diags = resolver.validateImports(circA.content, 'circ-a');
      const cycleDiag = diags.find((d) => d.code === 'MTL106');
      expect(cycleDiag).toBeDefined();
      expect(cycleDiag!.message).toContain('Circular');
    });
  });
});
