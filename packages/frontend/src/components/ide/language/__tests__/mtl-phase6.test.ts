import { describe, it, expect } from 'vitest';
import { MTLReferenceProvider } from '../MTLReferenceProvider';
import { ImportResolver } from '../ImportResolver';

describe('MTLReferenceProvider', () => {
  const files = [
    {
      id: 'file1',
      filename: 'main.mtl',
      content: `[comment @main/]
[module generate('http://example.org/1.0')/]

[import utils/]

[template public generateClass(c : EClass)]
  [generateHeader(c)/]
  [for (a : EAttribute | c.eAllAttributes)]
    [generateAttribute(a)/]
  [/for]
[/template]

[template private generateHeader(c : EClass)]
  // Header for [c.name/]
[/template]`,
    },
    {
      id: 'file2',
      filename: 'utils.mtl',
      content: `[module utils('http://example.org/1.0')/]

[template public generateAttribute(a : EAttribute)]
  private [a.eType.name/] [a.name/];
[/template]

[query public getTypeName(a : EAttribute) : String = a.eType.name/]`,
    },
  ];

  function createProvider() {
    const importResolver = new ImportResolver();
    importResolver.updateIndex(
      files.map((f) => ({ id: f.id, filename: f.filename, content: f.content })),
    );
    return new MTLReferenceProvider(importResolver);
  }

  describe('findReferences', () => {
    it('finds all references to a template name across files', () => {
      const provider = createProvider();
      const refs = provider.findReferences('generateAttribute', files);

      expect(refs.length).toBeGreaterThanOrEqual(2);
      // One definition in utils.mtl
      const defs = refs.filter((r) => r.isDefinition);
      expect(defs.length).toBe(1);
      expect(defs[0].filename).toBe('utils.mtl');
      // One usage in main.mtl
      const usages = refs.filter((r) => !r.isDefinition && r.filename === 'main.mtl');
      expect(usages.length).toBe(1);
    });

    it('finds references to a template defined and used in the same file', () => {
      const provider = createProvider();
      const refs = provider.findReferences('generateHeader', files);

      // Definition + usage both in main.mtl
      expect(refs.length).toBe(2);
      const defs = refs.filter((r) => r.isDefinition);
      expect(defs.length).toBe(1);
      expect(defs[0].filename).toBe('main.mtl');
    });

    it('finds references to a query name', () => {
      const provider = createProvider();
      const refs = provider.findReferences('getTypeName', files);

      // Only the definition (no usages in these files)
      expect(refs.length).toBe(1);
      expect(refs[0].isDefinition).toBe(true);
      expect(refs[0].filename).toBe('utils.mtl');
    });

    it('returns empty array for unknown symbol', () => {
      const provider = createProvider();
      const refs = provider.findReferences('nonExistentSymbol', files);
      expect(refs).toEqual([]);
    });

    it('sorts definitions before references', () => {
      const provider = createProvider();
      const refs = provider.findReferences('generateAttribute', files);
      if (refs.length > 1) {
        expect(refs[0].isDefinition).toBe(true);
      }
    });
  });

  describe('getSymbolAtPosition', () => {
    it('extracts symbol name at cursor position', () => {
      const provider = createProvider();
      // Line 6: [template public generateClass(c : EClass)]
      const symbol = provider.getSymbolAtPosition(files[0].content, 6, 26);
      expect(symbol).toBe('generateClass');
    });

    it('returns null for keywords', () => {
      const provider = createProvider();
      // Line 6: [template public generateClass(c : EClass)]
      const symbol = provider.getSymbolAtPosition(files[0].content, 6, 3);
      expect(symbol).toBeNull(); // 'template' is a keyword
    });

    it('returns null for out-of-bounds position', () => {
      const provider = createProvider();
      const symbol = provider.getSymbolAtPosition(files[0].content, 999, 1);
      expect(symbol).toBeNull();
    });

    it('returns null for empty position', () => {
      const provider = createProvider();
      // Line 1 col 1 is '[' — not a word char
      const symbol = provider.getSymbolAtPosition(files[0].content, 1, 1);
      expect(symbol).toBeNull();
    });
  });

  describe('prepareRename', () => {
    it('renames a symbol across all files', () => {
      const provider = createProvider();
      const edits = provider.prepareRename('generateAttribute', 'genAttr', files);

      expect(edits.length).toBe(2); // Both files contain the symbol
      // main.mtl should have the call renamed
      const mainEdit = edits.find((e) => e.filename === 'main.mtl');
      expect(mainEdit).toBeDefined();
      expect(mainEdit!.newContent).toContain('genAttr');
      expect(mainEdit!.newContent).not.toContain('generateAttribute');

      // utils.mtl should have the definition renamed
      const utilsEdit = edits.find((e) => e.filename === 'utils.mtl');
      expect(utilsEdit).toBeDefined();
      expect(utilsEdit!.newContent).toContain('genAttr');
      expect(utilsEdit!.newContent).not.toContain('generateAttribute');
    });

    it('returns empty edits for unknown symbol', () => {
      const provider = createProvider();
      const edits = provider.prepareRename('unknownSymbol', 'newName', files);
      expect(edits).toEqual([]);
    });

    it('does not rename partial matches', () => {
      const provider = createProvider();
      // 'generate' appears in 'generateClass', 'generateHeader', 'generateAttribute'
      // but as a word boundary match, 'generate' alone should only match the module name
      const edits = provider.prepareRename('generate', 'gen', files);
      // The module is named 'generate' in main.mtl
      const mainEdit = edits.find((e) => e.filename === 'main.mtl');
      if (mainEdit) {
        // Should NOT have renamed generateClass to genClass
        expect(mainEdit.newContent).toContain('generateClass');
      }
    });
  });
});
