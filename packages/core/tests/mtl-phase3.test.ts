/**
 * @emf-webapp/core — MTL Phase 3 Tests
 *
 * Tests para:
 * 1. File blocks: open modes (overwrite, append, create)
 * 2. Protected areas: preservation across regenerations
 * 3. Properties files: getProperty() in expressions
 * 4. File manager: lost files detection, stats
 */
import { describe, it, expect } from 'vitest';
import { MTLExecutor } from '../src/mtl/MTLExecutor.js';
import { MTLFileManager } from '../src/mtl/MTLFileManager.js';
import type { MTLNode, MTLModule, MTLTemplate } from '../src/mtl/MTLTypes.js';
import type { EObject } from '../src/ecore/interfaces.js';

// ══════════════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════════════

function mockEObject(props: Record<string, any> = {}): EObject {
  const className = props._className ?? 'MockClass';
  const features = Object.keys(props).filter(k => !k.startsWith('_'));
  const eClass: any = {
    name: className,
    getEStructuralFeature(name: string) {
      if (features.includes(name)) return { name, eType: { name: typeof props[name] } } as any;
      return null;
    },
    eAllStructuralFeatures: features.map(f => ({ name: f, eType: { name: typeof props[f] } })),
  };
  const obj: any = {
    eClass: () => eClass,
    eContainer: () => null,
    eContainingFeature: () => null,
    eContainmentFeature: () => null,
    eResource: () => null,
    eContents: () => (props._children ?? []),
    eAllContents: function* () { yield* (props._children ?? []); },
    eCrossReferences: () => [],
    eGet: (feature: any) => props[feature.name ?? feature],
    eSet: () => {},
    eIsSet: (feature: any) => (feature.name ?? feature) in props,
    eUnset: () => {},
    eInvoke: () => undefined,
    eIsProxy: () => false,
    eAdapters: () => [],
    eNotify: () => {},
    eDeliver: () => true,
    eSetDeliver: () => {},
    ...props,
  };
  return obj as EObject;
}

function mod(name: string, opts: { templates?: MTLTemplate[]; queries?: any[] } = {}): MTLModule {
  return {
    type: 'module', name, nsURIs: ['http://test.org'], imports: [],
    templates: opts.templates ?? [], queries: opts.queries ?? [],
  };
}

function mainTemplate(body: MTLNode[]): MTLTemplate {
  return {
    type: 'template', name: 'generate', visibility: 'public',
    params: [{ name: 'c', type: 'EClass' }], isMain: true, body,
  };
}

// ══════════════════════════════════════════════════════════════
//  FILE MANAGER TESTS
// ══════════════════════════════════════════════════════════════

describe('MTLFileManager — Phase 3', () => {
  describe('Open modes', () => {
    it('overwrite mode replaces file content', () => {
      const fm = new MTLFileManager();
      fm.addFile('test.java', 'first', 'overwrite');
      fm.addFile('test.java', 'second', 'overwrite');
      const files = fm.getFiles();
      expect(files).toHaveLength(1);
      expect(files[0].content).toBe('second');
    });

    it('append mode concatenates content', () => {
      const fm = new MTLFileManager();
      fm.addFile('log.txt', 'line1', 'append');
      fm.addFile('log.txt', 'line2', 'append');
      const files = fm.getFiles();
      expect(files).toHaveLength(1);
      expect(files[0].content).toBe('line1line2');
    });

    it('create mode skips if file existed in previous output', () => {
      const fm = new MTLFileManager();
      fm.loadPreviousOutput([{ name: 'existing.java', content: 'old' }]);
      fm.addFile('existing.java', 'new content', 'create');
      const files = fm.getFiles();
      expect(files).toHaveLength(0);
    });

    it('create mode generates if file is new', () => {
      const fm = new MTLFileManager();
      fm.loadPreviousOutput([{ name: 'other.java', content: 'old' }]);
      fm.addFile('new.java', 'fresh', 'create');
      const files = fm.getFiles();
      expect(files).toHaveLength(1);
      expect(files[0].content).toBe('fresh');
    });

    it('normalizes Acceleo mode "false" to append', () => {
      const fm = new MTLFileManager();
      fm.addFile('test.txt', 'A', 'false');
      fm.addFile('test.txt', 'B', 'false');
      expect(fm.getFiles()[0].content).toBe('AB');
    });

    it('normalizes Acceleo mode "true" to overwrite', () => {
      const fm = new MTLFileManager();
      fm.addFile('test.txt', 'A', 'true');
      fm.addFile('test.txt', 'B', 'true');
      expect(fm.getFiles()[0].content).toBe('B');
    });

    it('stores encoding metadata', () => {
      const fm = new MTLFileManager();
      fm.addFile('test.java', 'content', 'overwrite', 'ISO-8859-1');
      expect(fm.getFiles()[0].encoding).toBe('ISO-8859-1');
    });
  });

  describe('Protected areas', () => {
    it('extracts protected areas from previous output (// style)', () => {
      const fm = new MTLFileManager();
      const prev = `public class Foo {
// Start of user code customMethods
  public void myMethod() {}
// End of user code
}`;
      fm.loadPreviousOutput([{ name: 'Foo.java', content: prev }]);
      expect(fm.protectedAreas.get('customMethods')).toContain('myMethod');
    });

    it('extracts protected areas from previous output (# style)', () => {
      const fm = new MTLFileManager();
      const prev = `# Start of user code imports
import os
# End of user code`;
      fm.loadPreviousOutput([{ name: 'main.py', content: prev }]);
      expect(fm.protectedAreas.get('imports')).toContain('import os');
    });

    it('extracts protected areas from previous output (HTML style)', () => {
      const fm = new MTLFileManager();
      const prev = `<div>
<!-- Start of user code header -->
<h1>Custom</h1>
<!-- End of user code -->
</div>`;
      fm.loadPreviousOutput([{ name: 'index.html', content: prev }]);
      expect(fm.protectedAreas.get('header')).toContain('Custom');
    });

    it('merges protected areas on overwrite', () => {
      const fm = new MTLFileManager();
      const prev = `class Foo {
// Start of user code body
  private int x = 42;
// End of user code
}`;
      fm.loadPreviousOutput([{ name: 'Foo.java', content: prev }]);

      const newContent = `class Foo {
// Start of user code body
  // TODO: implement
// End of user code
}`;
      fm.addFile('Foo.java', newContent, 'overwrite');
      const result = fm.getFiles()[0].content;
      expect(result).toContain('private int x = 42');
      expect(result).not.toContain('TODO: implement');
    });
  });

  describe('Lost files and stats', () => {
    it('detects lost files', () => {
      const fm = new MTLFileManager();
      fm.loadPreviousOutput([
        { name: 'A.java', content: 'a' },
        { name: 'B.java', content: 'b' },
        { name: 'C.java', content: 'c' },
      ]);
      fm.addFile('A.java', 'new a', 'overwrite');
      // B and C are lost
      expect(fm.getLostFiles()).toEqual(['B.java', 'C.java']);
    });

    it('skipped files are not counted as lost', () => {
      const fm = new MTLFileManager();
      fm.loadPreviousOutput([
        { name: 'A.java', content: 'a' },
        { name: 'B.java', content: 'b' },
      ]);
      fm.addFile('A.java', 'new a', 'overwrite');
      fm.addFile('B.java', 'new b', 'create'); // skipped because exists
      expect(fm.getLostFiles()).toEqual([]);
    });

    it('returns correct stats', () => {
      const fm = new MTLFileManager();
      fm.loadPreviousOutput([
        { name: 'old.java', content: 'x' },
        { name: 'keep.java', content: 'y' },
      ]);
      fm.addFile('keep.java', 'updated', 'overwrite');
      fm.addFile('new.java', 'fresh', 'overwrite');
      fm.addFile('old.java', 'skip', 'create'); // skipped
      const stats = fm.getStats();
      expect(stats.generated).toBe(2); // keep + new
      expect(stats.skipped).toBe(1); // old (create mode)
      expect(stats.lost).toBe(0); // old is skipped, not lost
    });
  });
});

// ══════════════════════════════════════════════════════════════
//  EXECUTOR INTEGRATION TESTS
// ══════════════════════════════════════════════════════════════

describe('MTLExecutor — Phase 3: File blocks & Properties', () => {
  const executor = new MTLExecutor();

  describe('File blocks with modes', () => {
    it('generates file with overwrite mode', () => {
      const nodes: MTLNode[] = [
        mod('gen', {
          templates: [
            mainTemplate([
              { type: 'file', fileName: "'Person.java'", openMode: 'overwrite', encoding: 'UTF-8', body: [
                { type: 'text', value: 'public class Person {}' },
              ]},
            ]),
          ],
        }),
      ];
      const result = executor.execute(nodes, mockEObject({ name: 'Person' }));
      expect(result.error).toBeUndefined();
      expect(result.files).toHaveLength(1);
      expect(result.files[0].name).toBe('Person.java');
      expect(result.files[0].content).toBe('public class Person {}');
    });

    it('generates file with subdirectory path', () => {
      const nodes: MTLNode[] = [
        mod('gen', {
          templates: [
            mainTemplate([
              { type: 'file', fileName: "'src/model/Person.java'", openMode: 'overwrite', encoding: 'UTF-8', body: [
                { type: 'text', value: 'package model;' },
              ]},
            ]),
          ],
        }),
      ];
      const result = executor.execute(nodes, mockEObject());
      expect(result.files[0].name).toBe('src/model/Person.java');
    });

    it('append mode accumulates across multiple file blocks', () => {
      const nodes: MTLNode[] = [
        mod('gen', {
          templates: [
            mainTemplate([
              { type: 'file', fileName: "'log.txt'", openMode: 'append', encoding: 'UTF-8', body: [
                { type: 'text', value: 'line1\n' },
              ]},
              { type: 'file', fileName: "'log.txt'", openMode: 'append', encoding: 'UTF-8', body: [
                { type: 'text', value: 'line2\n' },
              ]},
            ]),
          ],
        }),
      ];
      const result = executor.execute(nodes, mockEObject());
      expect(result.files).toHaveLength(1);
      expect(result.files[0].content).toBe('line1\nline2\n');
    });

    it('returns stats in execution result', () => {
      const nodes: MTLNode[] = [
        mod('gen', {
          templates: [
            mainTemplate([
              { type: 'file', fileName: "'A.java'", openMode: 'overwrite', encoding: 'UTF-8', body: [
                { type: 'text', value: 'class A {}' },
              ]},
            ]),
          ],
        }),
      ];
      const result = executor.execute(nodes, mockEObject());
      expect(result.stats).toBeDefined();
      expect(result.stats!.generated).toBe(1);
    });
  });

  describe('Properties files', () => {
    it('getProperty(key) returns value from loaded properties', () => {
      const nodes: MTLNode[] = [
        mod('gen', {
          templates: [
            mainTemplate([
              { type: 'expression', expression: "getProperty('app.name')" },
            ]),
          ],
        }),
      ];
      executor.loadProperties([{
        name: 'config.properties',
        content: 'app.name=MyApp\napp.version=1.0',
      }]);
      const result = executor.execute(nodes, mockEObject());
      expect(result.error).toBeUndefined();
      expect(result.output).toBe('MyApp');
    });

    it('getProperty(filename, key) searches specific file', () => {
      const nodes: MTLNode[] = [
        mod('gen', {
          templates: [
            mainTemplate([
              { type: 'expression', expression: "getProperty('messages.properties', 'greeting')" },
            ]),
          ],
        }),
      ];
      executor.loadProperties([
        { name: 'config.properties', content: 'greeting=Hello Config' },
        { name: 'messages.properties', content: 'greeting=Hello Messages' },
      ]);
      const result = executor.execute(nodes, mockEObject());
      expect(result.output).toBe('Hello Messages');
    });

    it('getProperty returns empty string for missing key', () => {
      const nodes: MTLNode[] = [
        mod('gen', {
          templates: [
            mainTemplate([
              { type: 'expression', expression: "getProperty('nonexistent')" },
            ]),
          ],
        }),
      ];
      executor.loadProperties([{ name: 'test.properties', content: 'key=value' }]);
      const result = executor.execute(nodes, mockEObject());
      expect(result.output).toBe('');
    });

    it('properties ignore comments and blank lines', () => {
      const nodes: MTLNode[] = [
        mod('gen', {
          templates: [
            mainTemplate([
              { type: 'expression', expression: "getProperty('real.key')" },
            ]),
          ],
        }),
      ];
      executor.loadProperties([{
        name: 'test.properties',
        content: '# This is a comment\n! Another comment\n\nreal.key=works',
      }]);
      const result = executor.execute(nodes, mockEObject());
      expect(result.output).toBe('works');
    });
  });
});
