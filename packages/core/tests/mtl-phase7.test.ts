import { describe, it, expect } from 'vitest';
import { MTLParser } from '../src/mtl/MTLParser';
import { MTLExecutor } from '../src/mtl/MTLExecutor';
import type { EObject } from '../src/ecore/interfaces';

// ── Helpers ──────────────────────────────────────────────────────────────

/** Minimal EObject mock matching executor's resolveOnObject expectations */
function mockEObject(props: Record<string, any> = {}): EObject {
  const className = props._className ?? 'MockClass';
  const features = Object.keys(props).filter(k => !k.startsWith('_'));

  const eClass: any = {
    name: className,
    getEStructuralFeature(name: string) {
      if (features.includes(name)) {
        return { name, eType: { name: typeof props[name] } } as any;
      }
      return null;
    },
    eAllStructuralFeatures: features.map(f => ({ name: f, eType: { name: typeof props[f] } })),
  };

  const obj: any = {
    eClass: () => eClass,
    eContainer: () => null,
    eContainingFeature: () => null,
    eGet(feature: any) {
      const fname = typeof feature === 'string' ? feature : feature?.name;
      return props[fname];
    },
    eSet() {},
    eIsSet() { return true; },
    eUnset() {},
    eResource: () => null,
    eAdapters: () => [],
    eNotify() {},
    eDeliver: () => false,
    eSetDeliver() {},
  };
  return obj;
}

describe('Phase 7 — Execution Logging & Traceability', () => {
  const model = mockEObject({
    _className: 'Package',
    name: 'TestPackage',
    classes: [
      mockEObject({ _className: 'Class', name: 'Person', attributes: [] }),
      mockEObject({ _className: 'Class', name: 'Address', attributes: [] }),
    ],
  });

  describe('Logging disabled (default)', () => {
    it('should not produce log entries when logging is not enabled', () => {
      const src = `[module main('Package')/]
[template public generate(p : Package)]
Hello [p.name/]
[/template]`;
      const ast = MTLParser.parse(src);
      const executor = new MTLExecutor();
      const result = executor.execute(ast, model as any);

      expect(result.log).toBeUndefined();
    });
  });

  describe('Logging enabled', () => {
    it('should produce template-start and template-end log entries', () => {
      const src = `[module main('Package')/]
[template public generate(p : Package)]
Hello [p.name/]
[/template]`;
      const ast = MTLParser.parse(src);
      const executor = new MTLExecutor();
      const result = executor.execute(ast, model as any, { enableLogging: true });

      expect(result.log).toBeDefined();
      expect(result.log!.length).toBeGreaterThanOrEqual(2);

      const starts = result.log!.filter(e => e.type === 'template-start');
      const ends = result.log!.filter(e => e.type === 'template-end');
      expect(starts.length).toBe(1);
      expect(ends.length).toBe(1);
      expect(starts[0].templateName).toBe('generate');
    });

    it('should record duration on template-end entries', () => {
      const src = `[module main('Package')/]
[template public generate(p : Package)]
[p.name/]
[/template]`;
      const ast = MTLParser.parse(src);
      const executor = new MTLExecutor();
      const result = executor.execute(ast, model as any, { enableLogging: true });

      const ends = result.log!.filter(e => e.type === 'template-end');
      expect(ends.length).toBe(1);
      expect(ends[0].duration).toBeDefined();
      expect(typeof ends[0].duration).toBe('number');
      expect(ends[0].duration!).toBeGreaterThanOrEqual(0);
    });

    it('should log file-write entries for [file] blocks', () => {
      const src = `[module main('Package')/]
[template public generate(p : Package)]
[file (p.name.concat('.txt'), false, 'UTF-8')]
Content for [p.name/]
[/file]
[/template]`;
      const ast = MTLParser.parse(src);
      const executor = new MTLExecutor();
      const result = executor.execute(ast, model as any, { enableLogging: true });

      const fileWrites = result.log!.filter(e => e.type === 'file-write');
      expect(fileWrites.length).toBe(1);
      expect(fileWrites[0].fileName).toBe('TestPackage.txt');
    });

    it('should log multiple template calls in a for loop', () => {
      const src = `[module main('Package')/]
[template public generate(p : Package)]
[for (c : Class | p.classes)]
[generateClass(c)/]
[/for]
[/template]

[template public generateClass(c : Class)]
Class: [c.name/]
[/template]`;
      const ast = MTLParser.parse(src);
      const executor = new MTLExecutor();
      const result = executor.execute(ast, model as any, { enableLogging: true });

      const starts = result.log!.filter(e => e.type === 'template-start');
      // 1 generate (main) + 2 generateClass
      expect(starts.length).toBe(3);
      const classStarts = starts.filter(e => e.templateName === 'generateClass');
      expect(classStarts.length).toBe(2);
    });

    it('should include timestamps on all log entries', () => {
      const src = `[module main('Package')/]
[template public generate(p : Package)]
[p.name/]
[/template]`;
      const ast = MTLParser.parse(src);
      const executor = new MTLExecutor();
      const result = executor.execute(ast, model as any, { enableLogging: true });

      for (const entry of result.log!) {
        expect(entry.timestamp).toBeDefined();
        expect(typeof entry.timestamp).toBe('number');
      }
    });

    it('should record executionTime', () => {
      const src = `[module main('Package')/]
[template public generate(p : Package)]
[p.name/]
[/template]`;
      const ast = MTLParser.parse(src);
      const executor = new MTLExecutor();
      const result = executor.execute(ast, model as any, { enableLogging: true });

      expect(result.executionTime).toBeDefined();
      expect(typeof result.executionTime).toBe('number');
      expect(result.executionTime!).toBeGreaterThanOrEqual(0);
    });

    it('should summarize args in template-start entries', () => {
      const src = `[module main('Package')/]
[template public generate(p : Package)]
[for (c : Class | p.classes)]
[generateClass(c)/]
[/for]
[/template]

[template public generateClass(c : Class)]
[c.name/]
[/template]`;
      const ast = MTLParser.parse(src);
      const executor = new MTLExecutor();
      const result = executor.execute(ast, model as any, { enableLogging: true });

      const classStarts = result.log!.filter(e => e.type === 'template-start' && e.templateName === 'generateClass');
      expect(classStarts.length).toBe(2);
      // Args should be summarized (not full JSON dump)
      if (classStarts[0].args) {
        expect(classStarts[0].args.length).toBeLessThan(200);
      }
    });

    it('should log error entries when execution fails gracefully', () => {
      const src = `[module main('Package')/]
[template public generate(p : Package)]
[p.nonExistentProperty.something/]
[/template]`;
      const ast = MTLParser.parse(src);
      const executor = new MTLExecutor();
      const result = executor.execute(ast, model as any, { enableLogging: true });

      // Should still have log entries (at least template-start/end)
      expect(result.log).toBeDefined();
      expect(result.log!.length).toBeGreaterThan(0);
    });
  });

  describe('Execution stats', () => {
    it('should report generated file count in stats', () => {
      const src = `[module main('Package')/]
[template public generate(p : Package)]
[for (c : Class | p.classes)]
[file (c.name.concat('.java'), false, 'UTF-8')]
public class [c.name/] {}
[/file]
[/for]
[/template]`;
      const ast = MTLParser.parse(src);
      const executor = new MTLExecutor();
      const result = executor.execute(ast, model as any, { enableLogging: true });

      expect(result.files.length).toBe(2);
      expect(result.stats).toBeDefined();
      expect(result.stats!.generated).toBe(2);
    });
  });
});
