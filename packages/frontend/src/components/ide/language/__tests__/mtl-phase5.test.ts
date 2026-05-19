/**
 * Phase 5 Tests — Validación y Diagnósticos Avanzados
 * Tests for: chain type checking, oclAsType, oclIsKindOf/oclIsTypeOf,
 * arrow-on-non-collection, OCL operation type validation, call arity checking.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MTLDiagnosticEngine } from '../MTLDiagnosticEngine';
import { MTLTypeInference } from '../MTLTypeInference';
import { MetamodelSchemaProvider } from '../MetamodelSchemaProvider';
import { ImportResolver } from '../ImportResolver';

// Minimal metamodel for testing
const metamodelContent = {
  eClassifiers: [
    {
      name: 'Universidad',
      eAttributes: [{ name: 'nombre', eType: 'EString' }],
      eReferences: [
        { name: 'departamentos', targetId: 'Departamento', containment: true, upperBound: -1 },
      ],
      eSuperTypes: [],
    },
    {
      name: 'Departamento',
      eAttributes: [
        { name: 'nombre', eType: 'EString' },
        { name: 'codigo', eType: 'EInt' },
      ],
      eReferences: [
        { name: 'profesores', targetId: 'Profesor', containment: true, upperBound: -1 },
        { name: 'universidad', targetId: 'Universidad', containment: false, upperBound: 1 },
      ],
      eSuperTypes: [],
    },
    {
      name: 'Profesor',
      eAttributes: [
        { name: 'nombre', eType: 'EString' },
        { name: 'edad', eType: 'EInt' },
        { name: 'activo', eType: 'EBoolean' },
      ],
      eReferences: [
        { name: 'departamento', targetId: 'Departamento', containment: false, upperBound: 1 },
      ],
      eSuperTypes: ['Persona'],
    },
    {
      name: 'Persona',
      eAttributes: [
        { name: 'nombre', eType: 'EString' },
        { name: 'email', eType: 'EString' },
      ],
      eReferences: [],
      eSuperTypes: [],
    },
    {
      name: 'Estudiante',
      eAttributes: [{ name: 'matricula', eType: 'EString' }],
      eReferences: [],
      eSuperTypes: ['Persona'],
    },
    {
      name: 'Asignatura',
      eAttributes: [{ name: 'creditos', eType: 'EInt' }],
      eReferences: [],
      eSuperTypes: [],
    },
  ],
};

describe('Phase 5 — Validación y Diagnósticos Avanzados', () => {
  let schema: MetamodelSchemaProvider;
  let engine: MTLDiagnosticEngine;
  let importResolver: ImportResolver;

  beforeEach(() => {
    schema = new MetamodelSchemaProvider(metamodelContent);
    importResolver = new ImportResolver();
    engine = new MTLDiagnosticEngine(schema, importResolver);
  });

  describe('5.1 — Type checking contra metamodelo (chain)', () => {
    it('should detect invalid feature in navigation chain (self.x.y)', () => {
      const text = `[module test('http://test')/]
[template public genDept(d : Departamento)]
[file ('out.txt', false, 'UTF-8')]
d.nombre.size()
d.noExiste
[/file]
[/template]`;
      const diags = engine.analyze(text);
      const mtl004 = diags.filter((d) => d.code === 'MTL004');
      expect(mtl004.length).toBeGreaterThanOrEqual(1);
      expect(mtl004.some((d) => d.message.includes('noExiste'))).toBe(true);
    });

    it('should validate multi-level chain: self.departamentos->first().nombre', () => {
      // This should NOT produce errors — valid chain
      const text = `[module test('http://test')/]
[template public genUni(u : Universidad)]
[file ('out.txt', false, 'UTF-8')]
u.departamentos->first().nombre
[/file]
[/template]`;
      const diags = engine.analyze(text);
      const mtl004 = diags.filter((d) => d.code === 'MTL004');
      expect(mtl004.length).toBe(0);
    });

    it('should detect invalid feature after reference navigation', () => {
      const text = `[module test('http://test')/]
[template public genProf(p : Profesor)]
[file ('out.txt', false, 'UTF-8')]
p.departamento.invalido
[/file]
[/template]`;
      const diags = engine.analyze(text);
      const mtl004 = diags.filter((d) => d.code === 'MTL004');
      expect(mtl004.some((d) => d.message.includes('invalido'))).toBe(true);
    });

    it('should support oclAsType cast and validate subsequent access', () => {
      // Cast Persona to Profesor, then access 'edad' (valid on Profesor)
      const text = `[module test('http://test')/]
[template public genPersona(p : Persona)]
[file ('out.txt', false, 'UTF-8')]
p.oclAsType(Profesor).edad
[/file]
[/template]`;
      const diags = engine.analyze(text);
      const typeErrors = diags.filter((d) => d.code === 'MTL004' || d.code === 'MTL006');
      // Should not error — Profesor extends Persona, cast is valid
      expect(typeErrors.length).toBe(0);
    });

    it('should warn on suspicious cast (unrelated types)', () => {
      const text = `[module test('http://test')/]
[template public genDept(d : Departamento)]
[file ('out.txt', false, 'UTF-8')]
d.oclAsType(Asignatura).creditos
[/file]
[/template]`;
      const diags = engine.analyze(text);
      const mtl006 = diags.filter((d) => d.code === 'MTL006');
      expect(mtl006.length).toBeGreaterThanOrEqual(1);
      expect(mtl006[0].message).toContain('not in the type hierarchy');
    });

    it('should error on oclAsType with unknown type', () => {
      const text = `[module test('http://test')/]
[template public genDept(d : Departamento)]
[file ('out.txt', false, 'UTF-8')]
d.oclAsType(NoExiste).algo
[/file]
[/template]`;
      const diags = engine.analyze(text);
      const mtl007 = diags.filter((d) => d.code === 'MTL007');
      expect(mtl007.length).toBeGreaterThanOrEqual(1);
    });

    it('should validate oclIsKindOf type argument', () => {
      const text = `[module test('http://test')/]
[template public genPersona(p : Persona)]
[if (p.oclIsKindOf(TipoInvalido))]
cast
[/if]
[/template]`;
      const diags = engine.analyze(text);
      const mtl008 = diags.filter((d) => d.code === 'MTL008');
      expect(mtl008.length).toBeGreaterThanOrEqual(1);
      expect(mtl008[0].message).toContain('TipoInvalido');
    });

    it('should accept valid oclIsKindOf check', () => {
      const text = `[module test('http://test')/]
[template public genPersona(p : Persona)]
[if (p.oclIsKindOf(Profesor))]
es profesor
[/if]
[/template]`;
      const diags = engine.analyze(text);
      const mtl008 = diags.filter((d) => d.code === 'MTL008');
      expect(mtl008.length).toBe(0);
    });
  });

  describe('5.2 — Validación cross-file (arity)', () => {
    beforeEach(() => {
      // Set up multi-file project
      importResolver.updateIndex([
        {
          id: 'file1',
          filename: 'main.mtl',
          content: `[module main('http://test')/]
[import utils/]
[template public genMain(u : Universidad)]
[file ('out.txt', false, 'UTF-8')]
[genHeader(u)/]
[genFooter(u, 'extra')/]
[/file]
[/template]`,
        },
        {
          id: 'file2',
          filename: 'utils.mtl',
          content: `[module utils('http://test')/]
[template public genHeader(u : Universidad)]
Header: u.nombre
[/template]
[template public genFooter(u : Universidad)]
Footer
[/template]`,
        },
      ]);
    });

    it('should detect arity mismatch in template call', () => {
      const text = `[module main('http://test')/]
[import utils/]
[template public genMain(u : Universidad)]
[file ('out.txt', false, 'UTF-8')]
[genFooter(u, 'extra')/]
[/file]
[/template]`;
      const diags = engine.analyze(text, 'file1');
      const mtl012 = diags.filter((d) => d.code === 'MTL012');
      expect(mtl012.length).toBeGreaterThanOrEqual(1);
      expect(mtl012[0].message).toContain('genFooter');
      expect(mtl012[0].message).toContain('1');
      expect(mtl012[0].message).toContain('2');
    });

    it('should accept correct arity call', () => {
      const text = `[module main('http://test')/]
[import utils/]
[template public genMain(u : Universidad)]
[file ('out.txt', false, 'UTF-8')]
[genHeader(u)/]
[/file]
[/template]`;
      const diags = engine.analyze(text, 'file1');
      const mtl012 = diags.filter((d) => d.code === 'MTL012');
      expect(mtl012.length).toBe(0);
    });
  });

  describe('5.3 — Validación de expresiones OCL', () => {
    it('should detect string operation on numeric type', () => {
      const text = `[module test('http://test')/]
[template public genProf(p : Profesor)]
[file ('out.txt', false, 'UTF-8')]
p.edad.toLower()
[/file]
[/template]`;
      const diags = engine.analyze(text);
      const mtl011 = diags.filter((d) => d.code === 'MTL011');
      expect(mtl011.length).toBeGreaterThanOrEqual(1);
      expect(mtl011[0].message).toContain('toLower');
      expect(mtl011[0].message).toContain('numeric');
    });

    it('should accept string operation on string type', () => {
      const text = `[module test('http://test')/]
[template public genProf(p : Profesor)]
[file ('out.txt', false, 'UTF-8')]
p.nombre.toLower()
[/file]
[/template]`;
      const diags = engine.analyze(text);
      const mtl011 = diags.filter((d) => d.code === 'MTL011');
      expect(mtl011.length).toBe(0);
    });

    it('should detect arrow on non-collection', () => {
      const text = `[module test('http://test')/]
[template public genProf(p : Profesor)]
[file ('out.txt', false, 'UTF-8')]
p.nombre->select(x | x.size() > 3)
[/file]
[/template]`;
      const diags = engine.analyze(text);
      const mtl009 = diags.filter((d) => d.code === 'MTL009');
      expect(mtl009.length).toBeGreaterThanOrEqual(1);
      expect(mtl009[0].message).toContain('not a collection');
    });

    it('should accept arrow on collection reference', () => {
      const text = `[module test('http://test')/]
[template public genDept(d : Departamento)]
[file ('out.txt', false, 'UTF-8')]
d.profesores->select(p | p.activo)
[/file]
[/template]`;
      const diags = engine.analyze(text);
      const mtl009 = diags.filter((d) => d.code === 'MTL009');
      expect(mtl009.length).toBe(0);
    });

    it('should accept valid collection operations', () => {
      const text = `[module test('http://test')/]
[template public genUni(u : Universidad)]
[file ('out.txt', false, 'UTF-8')]
u.departamentos->size()
u.departamentos->isEmpty()
u.departamentos->first().nombre
[/file]
[/template]`;
      const diags = engine.analyze(text);
      const collErrors = diags.filter((d) => d.code === 'MTL009' || d.code === 'MTL010');
      expect(collErrors.length).toBe(0);
    });
  });

  describe('MTLTypeInference — validateOperation', () => {
    let inference: MTLTypeInference;

    beforeEach(() => {
      inference = new MTLTypeInference();
    });

    it('should reject arrow on non-collection', () => {
      const err = inference.validateOperation('EString', 'select', false, true);
      expect(err).not.toBeNull();
      expect(err).toContain('not a collection');
    });

    it('should accept arrow on collection', () => {
      const err = inference.validateOperation('Departamento', 'select', true, true);
      expect(err).toBeNull();
    });

    it('should reject invalid collection operation', () => {
      const err = inference.validateOperation('Departamento', 'toLower', true, true);
      expect(err).not.toBeNull();
      expect(err).toContain('not a valid collection operation');
    });

    it('should reject string op on numeric', () => {
      const err = inference.validateOperation('EInt', 'toLower', false, false);
      expect(err).not.toBeNull();
      expect(err).toContain('String operation');
    });

    it('should accept numeric op on numeric', () => {
      const err = inference.validateOperation('EInt', 'abs', false, false);
      expect(err).toBeNull();
    });

    it('should accept string op on string', () => {
      const err = inference.validateOperation('EString', 'toUpper', false, false);
      expect(err).toBeNull();
    });

    it('should identify builtin operations', () => {
      expect(inference.isBuiltinOperation('select')).toBe(true);
      expect(inference.isBuiltinOperation('toLower')).toBe(true);
      expect(inference.isBuiltinOperation('oclAsType')).toBe(true);
      expect(inference.isBuiltinOperation('randomThing')).toBe(false);
    });

    it('should return correct types for builtins', () => {
      const strResult = inference.getBuiltinReturnType('toLower', { typeName: 'EString', isCollection: false });
      expect(strResult).toEqual({ typeName: 'EString', isCollection: false });

      const boolResult = inference.getBuiltinReturnType('oclIsKindOf', { typeName: 'Profesor', isCollection: false });
      expect(boolResult).toEqual({ typeName: 'EBoolean', isCollection: false });

      const sizeResult = inference.getBuiltinReturnType('size', { typeName: 'EString', isCollection: false });
      expect(sizeResult).toEqual({ typeName: 'EInt', isCollection: false });
    });
  });

  describe('Unknown type detection (MTL005)', () => {
    it('should detect unknown type in template param', () => {
      const text = `[module test('http://test')/]
[template public gen(x : TipoInventado)]
[/template]`;
      const diags = engine.analyze(text);
      const mtl005 = diags.filter((d) => d.code === 'MTL005');
      expect(mtl005.length).toBeGreaterThanOrEqual(1);
      expect(mtl005[0].message).toContain('TipoInventado');
    });

    it('should detect unknown type in for iterator', () => {
      const text = `[module test('http://test')/]
[template public gen(u : Universidad)]
[for (x : ClaseFantasma | u.departamentos)]
x.nombre
[/for]
[/template]`;
      const diags = engine.analyze(text);
      const mtl005 = diags.filter((d) => d.code === 'MTL005');
      expect(mtl005.some((d) => d.message.includes('ClaseFantasma'))).toBe(true);
    });

    it('should accept known metamodel types', () => {
      const text = `[module test('http://test')/]
[template public gen(u : Universidad)]
[for (d : Departamento | u.departamentos)]
d.nombre
[/for]
[/template]`;
      const diags = engine.analyze(text);
      const mtl005 = diags.filter((d) => d.code === 'MTL005');
      expect(mtl005.length).toBe(0);
    });

    it('should accept builtin ETypes', () => {
      const text = `[module test('http://test')/]
[template public gen(u : Universidad)]
[let x : EString = u.nombre]
x
[/let]
[/template]`;
      const diags = engine.analyze(text);
      const mtl005 = diags.filter((d) => d.code === 'MTL005');
      expect(mtl005.length).toBe(0);
    });
  });
});
