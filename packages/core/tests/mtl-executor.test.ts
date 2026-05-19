/**
 * @emf-webapp/core — MTL Executor Tests (Phase 2)
 *
 * Tests para:
 * 1. Extends resolution (herencia de módulos)
 * 2. Visibility enforcement (public/protected/private)
 * 3. Query memoization
 * 4. Polymorphic dispatch (guards)
 * 5. Super keyword
 * 6. Post-treatment
 */
import { describe, it, expect } from 'vitest';
import { MTLExecutor } from '../src/mtl/MTLExecutor.js';
import type { MTLNode, MTLModule, MTLTemplate, MTLQuery } from '../src/mtl/MTLTypes.js';
import type { EObject } from '../src/ecore/interfaces.js';

// ══════════════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════════════

/** Minimal EObject mock for testing */
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
    // Direct property access (used by resolveOnObject)
    ...props,
  };

  return obj as EObject;
}

/** Helper to create a main template node */
function mainTemplate(body: MTLNode[], params: { name: string; type: string }[] = [{ name: 'c', type: 'EClass' }]): MTLTemplate {
  return {
    type: 'template',
    name: 'generate',
    visibility: 'public',
    params,
    isMain: true,
    body,
  };
}

/** Helper to create a module */
function mod(name: string, opts: {
  extends?: string;
  templates?: MTLTemplate[];
  queries?: MTLQuery[];
} = {}): MTLModule {
  return {
    type: 'module',
    name,
    extends: opts.extends,
    nsURIs: ['http://test.org'],
    imports: [],
    templates: opts.templates ?? [],
    queries: opts.queries ?? [],
  };
}

/** Helper to create a template */
function tmpl(name: string, opts: {
  visibility?: 'public' | 'protected' | 'private';
  body?: MTLNode[];
  guard?: string;
  overrides?: string;
  post?: string;
  isMain?: boolean;
  params?: { name: string; type: string }[];
} = {}): MTLTemplate {
  return {
    type: 'template',
    name,
    visibility: opts.visibility ?? 'public',
    params: opts.params ?? [{ name: 'c', type: 'EClass' }],
    guard: opts.guard,
    overrides: opts.overrides,
    post: opts.post,
    isMain: opts.isMain ?? false,
    body: opts.body ?? [{ type: 'text', value: `[${name}]` }],
  };
}

/** Helper to create a query */
function query(name: string, expr: string, opts: {
  visibility?: 'public' | 'protected' | 'private';
  params?: { name: string; type: string }[];
} = {}): MTLQuery {
  return {
    type: 'query',
    name,
    visibility: opts.visibility ?? 'public',
    params: opts.params ?? [{ name: 'c', type: 'EClass' }],
    returnType: 'String',
    expression: expr,
  };
}

// ══════════════════════════════════════════════════════════════
//  TESTS
// ══════════════════════════════════════════════════════════════

describe('MTLExecutor — Phase 2: Module System', () => {
  const executor = new MTLExecutor();

  describe('Basic execution (regression)', () => {
    it('executes a simple @main template with text', () => {
      const nodes: MTLNode[] = [
        mod('gen', {
          templates: [
            mainTemplate([{ type: 'text', value: 'Hello World' }]),
          ],
        }),
      ];
      const result = executor.execute(nodes, mockEObject({ name: 'Test' }));
      expect(result.error).toBeUndefined();
      expect(result.output).toBe('Hello World');
    });

    it('executes template calling a query', () => {
      const nodes: MTLNode[] = [
        mod('gen', {
          templates: [
            mainTemplate([{ type: 'expression', expression: 'getName(c)' }]),
          ],
          queries: [
            query('getName', 'self.name'),
          ],
        }),
      ];
      const model = mockEObject({ name: 'MyClass' });
      const result = executor.execute(nodes, model);
      expect(result.error).toBeUndefined();
      expect(result.output).toBe('MyClass');
    });
  });

  describe('Extends resolution', () => {
    it('child module inherits parent templates', () => {
      const parent = mod('base', {
        templates: [
          tmpl('header', { body: [{ type: 'text', value: '// Header' }] }),
        ],
      });
      const child = mod('gen', {
        extends: 'base',
        templates: [
          mainTemplate([
            { type: 'expression', expression: 'header(c)' },
            { type: 'text', value: '\nBody' },
          ]),
        ],
      });
      const result = executor.execute([parent, child], mockEObject());
      expect(result.error).toBeUndefined();
      expect(result.output).toBe('// Header\nBody');
    });

    it('child module inherits parent queries', () => {
      const parent = mod('base', {
        queries: [
          query('prefix', "'pkg_'"),
        ],
      });
      const child = mod('gen', {
        extends: 'base',
        templates: [
          mainTemplate([{ type: 'expression', expression: 'prefix(c)' }]),
        ],
      });
      const result = executor.execute([parent, child], mockEObject());
      expect(result.error).toBeUndefined();
      expect(result.output).toBe('pkg_');
    });

    it('child template overrides parent template with same name', () => {
      const parent = mod('base', {
        templates: [
          tmpl('render', { body: [{ type: 'text', value: 'PARENT' }] }),
        ],
      });
      const child = mod('gen', {
        extends: 'base',
        templates: [
          tmpl('render', { overrides: 'render', body: [{ type: 'text', value: 'CHILD' }] }),
          mainTemplate([{ type: 'expression', expression: 'render(c)' }]),
        ],
      });
      const result = executor.execute([parent, child], mockEObject());
      expect(result.error).toBeUndefined();
      expect(result.output).toBe('CHILD');
    });
  });

  describe('Visibility enforcement', () => {
    it('public templates are accessible from any module', () => {
      const lib = mod('lib', {
        templates: [
          tmpl('helper', { visibility: 'public', body: [{ type: 'text', value: 'OK' }] }),
        ],
      });
      const gen = mod('gen', {
        templates: [
          mainTemplate([{ type: 'expression', expression: 'helper(c)' }]),
        ],
      });
      const result = executor.execute([lib, gen], mockEObject());
      expect(result.error).toBeUndefined();
      expect(result.output).toBe('OK');
    });

    it('private templates throw when accessed from another module', () => {
      const lib = mod('lib', {
        templates: [
          tmpl('secret', { visibility: 'private', body: [{ type: 'text', value: 'SECRET' }] }),
        ],
      });
      const gen = mod('gen', {
        templates: [
          mainTemplate([{ type: 'expression', expression: 'secret(c)' }]),
        ],
      });
      const result = executor.execute([lib, gen], mockEObject());
      expect(result.error).toContain('private');
      expect(result.error).toContain('secret');
    });

    it('protected templates are accessible from extending module', () => {
      const lib = mod('lib', {
        templates: [
          tmpl('internal', { visibility: 'protected', body: [{ type: 'text', value: 'PROTECTED' }] }),
        ],
      });
      const gen = mod('gen', {
        extends: 'lib',
        templates: [
          mainTemplate([{ type: 'expression', expression: 'internal(c)' }]),
        ],
      });
      const result = executor.execute([lib, gen], mockEObject());
      expect(result.error).toBeUndefined();
      expect(result.output).toBe('PROTECTED');
    });

    it('protected templates throw when accessed from non-extending module', () => {
      const lib = mod('lib', {
        templates: [
          tmpl('internal', { visibility: 'protected', body: [{ type: 'text', value: 'PROTECTED' }] }),
        ],
      });
      const gen = mod('gen', {
        // NO extends
        templates: [
          mainTemplate([{ type: 'expression', expression: 'internal(c)' }]),
        ],
      });
      const result = executor.execute([lib, gen], mockEObject());
      expect(result.error).toContain('protected');
      expect(result.error).toContain('internal');
    });

    it('private queries throw when accessed from another module', () => {
      const lib = mod('lib', {
        queries: [
          query('secretQuery', "'hidden'", { visibility: 'private' }),
        ],
      });
      const gen = mod('gen', {
        templates: [
          mainTemplate([{ type: 'expression', expression: 'secretQuery(c)' }]),
        ],
      });
      const result = executor.execute([lib, gen], mockEObject());
      expect(result.error).toContain('private');
      expect(result.error).toContain('secretQuery');
    });

    it('same module can access its own private templates', () => {
      const gen = mod('gen', {
        templates: [
          tmpl('privateHelper', { visibility: 'private', body: [{ type: 'text', value: 'PRIVATE_OK' }] }),
          mainTemplate([{ type: 'expression', expression: 'privateHelper(c)' }]),
        ],
      });
      const result = executor.execute([gen], mockEObject());
      expect(result.error).toBeUndefined();
      expect(result.output).toBe('PRIVATE_OK');
    });
  });

  describe('Query memoization', () => {
    it('returns same result for same arguments (no side effects)', () => {
      let callCount = 0;
      // We test memoization indirectly: the query expression is deterministic
      const nodes: MTLNode[] = [
        mod('gen', {
          templates: [
            mainTemplate([
              { type: 'expression', expression: 'getPrefix(c)' },
              { type: 'text', value: '-' },
              { type: 'expression', expression: 'getPrefix(c)' },
            ]),
          ],
          queries: [
            query('getPrefix', "'hello'"),
          ],
        }),
      ];
      const result = executor.execute(nodes, mockEObject());
      expect(result.error).toBeUndefined();
      expect(result.output).toBe('hello-hello');
    });

    it('different arguments produce different cached results', () => {
      const nodes: MTLNode[] = [
        mod('gen', {
          templates: [
            mainTemplate([
              { type: 'expression', expression: 'identity(c)' },
            ]),
          ],
          queries: [
            query('identity', 'self.name'),
          ],
        }),
      ];
      const result1 = executor.execute(nodes, mockEObject({ name: 'A' }));
      const result2 = executor.execute(nodes, mockEObject({ name: 'B' }));
      expect(result1.output).toBe('A');
      expect(result2.output).toBe('B');
    });

    it('cache is cleared between execute() calls', () => {
      const nodes: MTLNode[] = [
        mod('gen', {
          templates: [
            mainTemplate([{ type: 'expression', expression: 'getName(c)' }]),
          ],
          queries: [
            query('getName', 'self.name'),
          ],
        }),
      ];
      const r1 = executor.execute(nodes, mockEObject({ name: 'First' }));
      const r2 = executor.execute(nodes, mockEObject({ name: 'Second' }));
      expect(r1.output).toBe('First');
      expect(r2.output).toBe('Second');
    });
  });

  describe('Polymorphic dispatch (guards)', () => {
    it('template with true guard executes', () => {
      const gen = mod('gen', {
        templates: [
          tmpl('conditional', {
            guard: "'true'",
            body: [{ type: 'text', value: 'GUARDED' }],
          }),
          mainTemplate([{ type: 'expression', expression: 'conditional(c)' }]),
        ],
      });
      const result = executor.execute([gen], mockEObject());
      expect(result.error).toBeUndefined();
      expect(result.output).toBe('GUARDED');
    });

    it('template with false guard returns empty string', () => {
      const gen = mod('gen', {
        templates: [
          tmpl('conditional', {
            guard: "''",  // empty string = falsy
            body: [{ type: 'text', value: 'SHOULD_NOT_APPEAR' }],
          }),
          mainTemplate([{ type: 'expression', expression: 'conditional(c)' }]),
        ],
      });
      const result = executor.execute([gen], mockEObject());
      expect(result.error).toBeUndefined();
      expect(result.output).toBe('');
    });

    it('guard can reference model properties', () => {
      const gen = mod('gen', {
        templates: [
          tmpl('onlyAbstract', {
            guard: 'self.abstract',
            body: [{ type: 'text', value: 'IS_ABSTRACT' }],
          }),
          mainTemplate([{ type: 'expression', expression: 'onlyAbstract(c)' }]),
        ],
      });
      const abstractModel = mockEObject({ abstract: true });
      const concreteModel = mockEObject({ abstract: false });

      const r1 = executor.execute([gen], abstractModel);
      expect(r1.output).toBe('IS_ABSTRACT');

      const r2 = executor.execute([gen], concreteModel);
      expect(r2.output).toBe('');
    });
  });

  describe('Super keyword', () => {
    it('child can call super to invoke parent version', () => {
      const parent = mod('base', {
        templates: [
          tmpl('render', { body: [{ type: 'text', value: 'BASE' }] }),
        ],
      });
      const child = mod('gen', {
        extends: 'base',
        templates: [
          tmpl('render', {
            overrides: 'render',
            body: [
              { type: 'text', value: 'CHILD+' },
              { type: 'expression', expression: 'super.render(c)' },
            ],
          }),
          mainTemplate([{ type: 'expression', expression: 'render(c)' }]),
        ],
      });
      const result = executor.execute([parent, child], mockEObject());
      expect(result.error).toBeUndefined();
      expect(result.output).toBe('CHILD+BASE');
    });
  });

  describe('Post-treatment', () => {
    it('applies trim() post-treatment to template output', () => {
      const gen = mod('gen', {
        templates: [
          tmpl('padded', {
            post: 'self.trim()',
            body: [{ type: 'text', value: '  hello  ' }],
          }),
          mainTemplate([{ type: 'expression', expression: 'padded(c)' }]),
        ],
      });
      const result = executor.execute([gen], mockEObject());
      expect(result.error).toBeUndefined();
      expect(result.output).toBe('hello');
    });
  });

  describe('Multi-module integration', () => {
    it('complex scenario: parent + child + visibility + queries', () => {
      const base = mod('base', {
        templates: [
          tmpl('fileHeader', {
            visibility: 'protected',
            body: [{ type: 'text', value: '// Generated\n' }],
          }),
        ],
        queries: [
          query('className', 'self.name', { visibility: 'public' }),
        ],
      });

      const gen = mod('gen', {
        extends: 'base',
        templates: [
          mainTemplate([
            { type: 'expression', expression: 'fileHeader(c)' },
            { type: 'text', value: 'class ' },
            { type: 'expression', expression: 'className(c)' },
            { type: 'text', value: ' {}' },
          ]),
        ],
      });

      const result = executor.execute([base, gen], mockEObject({ name: 'Person' }));
      expect(result.error).toBeUndefined();
      expect(result.output).toBe('// Generated\nclass Person {}');
    });
  });
});
