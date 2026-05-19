import { describe, it, expect } from 'vitest';
import { MTLParser } from '../src/mtl/MTLParser';
import { MTLExecutor } from '../src/mtl/MTLExecutor';
import type { EObject } from '../src/ecore/interfaces';

// ── Helpers ──────────────────────────────────────────────────────────────

/** Minimal EObject mock matching executor's resolveOnObject expectations */
function mockEObject(props: Record<string, any> = {}): any {
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
    eAllReferences: features
      .filter(f => Array.isArray(props[f]) || (typeof props[f] === 'object' && props[f] !== null && props[f].eClass))
      .map(f => ({ name: f, eType: { name: f } })),
  };

  const obj: any = {
    eClass: () => eClass,
    eContainer: () => props._container || null,
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

/** Parse MTL source and execute against model */
function run(src: string, model: any): string {
  const ast = MTLParser.parse(src);
  const executor = new MTLExecutor();
  const result = executor.execute(ast, model);
  if (result.error) throw new Error(result.error);
  return result.output.trim();
}

/** Parse MTL source and execute with properties */
function runWithProps(src: string, model: any, propsFiles: Array<{ name: string; content: string }>): string {
  const ast = MTLParser.parse(src);
  const executor = new MTLExecutor();
  executor.loadProperties(propsFiles);
  const result = executor.execute(ast, model);
  if (result.error) throw new Error(result.error);
  return result.output.trim();
}

describe('Phase 8 — OCL Completeness', () => {
  describe('String operations', () => {
    const model = mockEObject({ _className: 'Model', name: 'hello' });

    it('toUpper converts entire string to uppercase', () => {
      const out = run(`[module m('Model')/]
[template public gen(m : Model)]
[m.name.toUpper()/]
[/template]`, model);
      expect(out).toBe('HELLO');
    });

    it('toLower converts entire string to lowercase', () => {
      const m = mockEObject({ _className: 'Model', name: 'HELLO' });
      const out = run(`[module m('Model')/]
[template public gen(m : Model)]
[m.name.toLower()/]
[/template]`, m);
      expect(out).toBe('hello');
    });

    it('toUpperFirst capitalizes first character only', () => {
      const out = run(`[module m('Model')/]
[template public gen(m : Model)]
[m.name.toUpperFirst()/]
[/template]`, model);
      expect(out).toBe('Hello');
    });

    it('toLowerFirst lowercases first character only', () => {
      const m = mockEObject({ _className: 'Model', name: 'Hello' });
      const out = run(`[module m('Model')/]
[template public gen(m : Model)]
[m.name.toLowerFirst()/]
[/template]`, m);
      expect(out).toBe('hello');
    });

    it('first returns first character', () => {
      const m = mockEObject({ _className: 'Model', name: 'abc' });
      const out = run(`[module m('Model')/]
[template public gen(m : Model)]
[m.name.first()/]
[/template]`, m);
      expect(out).toBe('a');
    });

    it('last returns last character', () => {
      const m = mockEObject({ _className: 'Model', name: 'abc' });
      const out = run(`[module m('Model')/]
[template public gen(m : Model)]
[m.name.last()/]
[/template]`, m);
      expect(out).toBe('c');
    });

    it('contains checks substring presence', () => {
      const m = mockEObject({ _className: 'Model', name: 'hello world' });
      const out = run(`[module m('Model')/]
[template public gen(m : Model)]
[m.name.contains('world')/]
[/template]`, m);
      expect(out).toBe('true');
    });

    it('replace replaces first occurrence', () => {
      const m = mockEObject({ _className: 'Model', name: 'aabaa' });
      const out = run(`[module m('Model')/]
[template public gen(m : Model)]
[m.name.replace('a', 'x')/]
[/template]`, m);
      expect(out).toBe('xabaa');
    });

    it('replaceAll replaces all occurrences', () => {
      const m = mockEObject({ _className: 'Model', name: 'aabaa' });
      const out = run(`[module m('Model')/]
[template public gen(m : Model)]
[m.name.replaceAll('a', 'x')/]
[/template]`, m);
      expect(out).toBe('xxbxx');
    });

    it('prefix prepends text', () => {
      const m = mockEObject({ _className: 'Model', name: 'World' });
      const out = run(`[module m('Model')/]
[template public gen(m : Model)]
[m.name.prefix('Hello ')/]
[/template]`, m);
      expect(out).toBe('Hello World');
    });

    it('toReal parses float', () => {
      const m = mockEObject({ _className: 'Model', value: '3.14' });
      const out = run(`[module m('Model')/]
[template public gen(m : Model)]
[m.value.toReal()/]
[/template]`, m);
      expect(out).toBe('3.14');
    });

    it('isAlpha checks alphabetic', () => {
      const m = mockEObject({ _className: 'Model', name: 'abc' });
      const out = run(`[module m('Model')/]
[template public gen(m : Model)]
[m.name.isAlpha()/]
[/template]`, m);
      expect(out).toBe('true');
    });

    it('equalsIgnoreCase compares case-insensitively', () => {
      const m = mockEObject({ _className: 'Model', name: 'Hello' });
      const out = run(`[module m('Model')/]
[template public gen(m : Model)]
[m.name.equalsIgnoreCase('HELLO')/]
[/template]`, m);
      expect(out).toBe('true');
    });

    it('lastIndex finds last occurrence', () => {
      const m = mockEObject({ _className: 'Model', name: 'abcabc' });
      const out = run(`[module m('Model')/]
[template public gen(m : Model)]
[m.name.lastIndex('a')/]
[/template]`, m);
      expect(out).toBe('3');
    });

    it('size returns string length', () => {
      const out = run(`[module m('Model')/]
[template public gen(m : Model)]
[m.name.size()/]
[/template]`, model);
      expect(out).toBe('5');
    });
  });

  describe('Collection operations (arrow)', () => {
    const child1 = mockEObject({ _className: 'Item', name: 'alpha', visible: true, priority: 3 });
    const child2 = mockEObject({ _className: 'Item', name: 'beta', visible: false, priority: 1 });
    const child3 = mockEObject({ _className: 'Item', name: 'gamma', visible: true, priority: 2 });
    const model = mockEObject({ _className: 'Model', items: [child1, child2, child3] });

    it('select filters elements', () => {
      const out = run(`[module m('Model')/]
[template public gen(m : Model)]
[m.items->select(i | i.visible)->size()/]
[/template]`, model);
      expect(out).toBe('2');
    });

    it('reject filters out elements', () => {
      const out = run(`[module m('Model')/]
[template public gen(m : Model)]
[m.items->reject(i | i.visible)->size()/]
[/template]`, model);
      expect(out).toBe('1');
    });

    it('collect maps elements', () => {
      const out = run(`[module m('Model')/]
[template public gen(m : Model)]
[m.items->collect(i | i.name)->sep(', ')/]
[/template]`, model);
      expect(out).toBe('alpha, beta, gamma');
    });

    it('forAll checks all elements', () => {
      const m = mockEObject({ _className: 'Model', items: [
        mockEObject({ _className: 'Item', active: true }),
        mockEObject({ _className: 'Item', active: true }),
      ]});
      const out = run(`[module m('Model')/]
[template public gen(m : Model)]
[m.items->forAll(i | i.active)/]
[/template]`, m);
      expect(out).toBe('true');
    });

    it('exists checks any element', () => {
      const out = run(`[module m('Model')/]
[template public gen(m : Model)]
[m.items->exists(i | i.visible)/]
[/template]`, model);
      expect(out).toBe('true');
    });

    it('sortedBy sorts elements', () => {
      const out = run(`[module m('Model')/]
[template public gen(m : Model)]
[m.items->sortedBy(i | i.name)->collect(i | i.name)->first()/]
[/template]`, model);
      expect(out).toBe('alpha');
    });

    it('one checks exactly one match', () => {
      const m = mockEObject({ _className: 'Model', items: [
        mockEObject({ _className: 'Item', special: true }),
        mockEObject({ _className: 'Item', special: false }),
        mockEObject({ _className: 'Item', special: false }),
      ]});
      const out = run(`[module m('Model')/]
[template public gen(m : Model)]
[m.items->one(i | i.special)/]
[/template]`, m);
      expect(out).toBe('true');
    });

    it('isUnique checks uniqueness', () => {
      const out = run(`[module m('Model')/]
[template public gen(m : Model)]
[m.items->isUnique(i | i.name)/]
[/template]`, model);
      expect(out).toBe('true');
    });

    it('sep joins elements with separator', () => {
      const out = run(`[module m('Model')/]
[template public gen(m : Model)]
[m.items->collect(i | i.name)->sep('; ')/]
[/template]`, model);
      expect(out).toBe('alpha; beta; gamma');
    });

    it('reverse reverses collection', () => {
      const out = run(`[module m('Model')/]
[template public gen(m : Model)]
[m.items->reverse()->collect(i | i.name)->first()/]
[/template]`, model);
      expect(out).toBe('gamma');
    });

    it('closure computes transitive closure', () => {
      const leaf = mockEObject({ _className: 'Node', name: 'leaf', children: [] });
      const mid = mockEObject({ _className: 'Node', name: 'mid', children: [leaf] });
      const root = mockEObject({ _className: 'Node', name: 'root', children: [mid] });
      const m = mockEObject({ _className: 'Model', nodes: [root] });
      const out = run(`[module m('Model')/]
[template public gen(m : Model)]
[m.nodes->closure(n | n.children)->size()/]
[/template]`, m);
      // root -> [mid] -> [leaf] -> [] = root + mid + leaf = 3
      expect(out).toBe('3');
    });
  });

  describe('OCL type operations', () => {
    it('oclIsKindOf checks type', () => {
      const m = mockEObject({ _className: 'Package', name: 'test' });
      const out = run(`[module m('Package')/]
[template public gen(p : Package)]
[p.oclIsKindOf('Package')/]
[/template]`, m);
      expect(out).toBe('true');
    });

    it('oclIsTypeOf checks exact type (false case)', () => {
      const m = mockEObject({ _className: 'Package', name: 'test' });
      const out = run(`[module m('Package')/]
[template public gen(p : Package)]
[p.oclIsTypeOf('Class')/]
[/template]`, m);
      expect(out).toBe('false');
    });

    it('oclAsType is a no-op cast', () => {
      const m = mockEObject({ _className: 'Package', name: 'test' });
      const out = run(`[module m('Package')/]
[template public gen(p : Package)]
[p.oclAsType('NamedElement').name/]
[/template]`, m);
      expect(out).toBe('test');
    });

    it('oclIsUndefined returns false for existing object', () => {
      const m = mockEObject({ _className: 'Model', name: 'test' });
      const out = run(`[module m('Model')/]
[template public gen(m : Model)]
[m.oclIsUndefined()/]
[/template]`, m);
      expect(out).toBe('false');
    });
  });

  describe('EObject navigation', () => {
    it('eContainer returns parent', () => {
      const parent = mockEObject({ _className: 'Package', name: 'pkg', classes: [] });
      const child = mockEObject({ _className: 'Class', name: 'MyClass', _container: parent });
      const out = run(`[module m('Class')/]
[template public gen(c : Class)]
[c.eContainer().name/]
[/template]`, child);
      expect(out).toBe('pkg');
    });

    it('eAllContents returns all nested elements', () => {
      const attr = mockEObject({ _className: 'Attribute', name: 'x' });
      const cls = mockEObject({ _className: 'Class', name: 'A', attrs: [attr] });
      const m = mockEObject({ _className: 'Package', name: 'pkg', classes: [cls] });
      const out = run(`[module m('Package')/]
[template public gen(p : Package)]
[p.eAllContents()->size()/]
[/template]`, m);
      // cls + attr = 2
      expect(out).toBe('2');
    });

    it('ancestors returns all containers up to root', () => {
      const pkg = mockEObject({ _className: 'Package', name: 'pkg' });
      const cls = mockEObject({ _className: 'Class', name: 'A', _container: pkg });
      const attr = mockEObject({ _className: 'Attribute', name: 'x', _container: cls });
      const out = run(`[module m('Attribute')/]
[template public gen(a : Attribute)]
[a.ancestors()->size()/]
[/template]`, attr);
      // cls + pkg = 2
      expect(out).toBe('2');
    });
  });

  describe('Expression features', () => {
    it('not operator negates boolean', () => {
      const m = mockEObject({ _className: 'Model', active: true });
      const out = run(`[module m('Model')/]
[template public gen(m : Model)]
[not m.active/]
[/template]`, m);
      expect(out).toBe('false');
    });

    it('let expression binds variable', () => {
      const m = mockEObject({ _className: 'Model', name: 'hello' });
      const out = run(`[module m('Model')/]
[template public gen(m : Model)]
[let upper : String = m.name.toUpper()][upper/][/let]
[/template]`, m);
      expect(out).toBe('HELLO');
    });

    it('if-then-else inline expression (true)', () => {
      const m = mockEObject({ _className: 'Model', count: 5 });
      const out = run(`[module m('Model')/]
[template public gen(m : Model)]
[if (m.count > 3)]big[else]small[/if]
[/template]`, m);
      expect(out).toBe('big');
    });

    it('if-then-else inline expression (false)', () => {
      const m = mockEObject({ _className: 'Model', count: 1 });
      const out = run(`[module m('Model')/]
[template public gen(m : Model)]
[if (m.count > 3)]big[else]small[/if]
[/template]`, m);
      expect(out).toBe('small');
    });
  });

  describe('Non-standard Acceleo operations', () => {
    it('for loop iterates over collection', () => {
      const items = [
        mockEObject({ _className: 'Item', name: 'first' }),
        mockEObject({ _className: 'Item', name: 'second' }),
      ];
      const m = mockEObject({ _className: 'Model', items });
      const out = run(`[module m('Model')/]
[template public gen(m : Model)]
[for (i : Item | m.items)][i.name/][/for]
[/template]`, m);
      expect(out).toBe('firstsecond');
    });

    it('invoke returns empty (no-op in web context)', () => {
      const m = mockEObject({ _className: 'Model', name: 'test' });
      const out = run(`[module m('Model')/]
[template public gen(m : Model)]
[m.invoke('java.lang.String', 'length()', '')/]
[/template]`, m);
      expect(out).toBe('');
    });

    it('getProperty resolves from loaded properties', () => {
      const m = mockEObject({ _className: 'Model', name: 'test' });
      const out = runWithProps(`[module m('Model')/]
[template public gen(m : Model)]
[getProperty('app.name')/]
[/template]`, m, [{ name: 'default.properties', content: 'app.name=MyApp\napp.version=1.0' }]);
      expect(out).toBe('MyApp');
    });
  });

  describe('Number operations', () => {
    it('abs returns absolute value', () => {
      const m = mockEObject({ _className: 'Model', value: -5 });
      const out = run(`[module m('Model')/]
[template public gen(m : Model)]
[m.value.abs()/]
[/template]`, m);
      expect(out).toBe('5');
    });

    it('div performs integer division', () => {
      const m = mockEObject({ _className: 'Model', value: 7 });
      const out = run(`[module m('Model')/]
[template public gen(m : Model)]
[m.value.div(2)/]
[/template]`, m);
      expect(out).toBe('3');
    });

    it('mod returns remainder', () => {
      const m = mockEObject({ _className: 'Model', value: 7 });
      const out = run(`[module m('Model')/]
[template public gen(m : Model)]
[m.value.mod(3)/]
[/template]`, m);
      expect(out).toBe('1');
    });
  });
});
