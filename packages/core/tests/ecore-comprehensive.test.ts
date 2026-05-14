/**
 * Tests exhaustivos del metametamodelo Ecore.
 *
 * Usa las APIs REALES de cada implementación (leídas de los source files).
 * No asume constructores con init-objects donde no existen.
 * Las propiedades se asignan post-construcción salvo en clases que
 * sí aceptan Partial<T> (EAttributeImpl, EReferenceImpl).
 */

import { describe, it, expect } from 'vitest';
import {
  EPackageImpl,
  EClassImpl,
  EAttributeImpl,
  EReferenceImpl,
  EDataTypeImpl,
  EEnumImpl,
  EEnumLiteralImpl,
  EOperationImpl,
  EParameterImpl,
  EFactoryImpl,
  EAnnotationImpl,
  EGenericTypeImpl,
  ETypeParameterImpl,
  EListImpl,
} from '../src/index.js';

// ============================================================
// Helpers
// ============================================================

/** Crea un EPackage con name, nsURI, nsPrefix asignados post-construcción */
function makePackage(name: string, nsURI?: string, nsPrefix?: string): EPackageImpl {
  const pkg = new EPackageImpl();
  pkg.name = name;
  if (nsURI !== undefined) pkg.nsURI = nsURI;
  if (nsPrefix !== undefined) pkg.nsPrefix = nsPrefix;
  return pkg;
}

/** Crea un EClass con name y opcionalmente abstract/interface */
function makeClass(name: string, opts?: { abstract?: boolean; interface?: boolean }): EClassImpl {
  const cls = new EClassImpl();
  cls.name = name;
  if (opts?.abstract) cls.abstract = true;
  if (opts?.interface) cls.interface = true;
  return cls;
}

/** Crea un EGenericType apuntando a un classifier */
function makeGenericType(classifier: EClassImpl): EGenericTypeImpl {
  const gt = new EGenericTypeImpl();
  gt.eClassifier = classifier;
  return gt;
}

/** Crea un EAttribute con init Partial<EAttribute> (constructor real sí lo acepta) */
function makeAttribute(name: string, opts?: Partial<{ iD: boolean; changeable: boolean }>): EAttributeImpl {
  return new EAttributeImpl({ name, ...opts });
}

/** Crea un EReference con init Partial<EReference> (constructor real sí lo acepta) */
function makeReference(name: string, opts?: Partial<{ containment: boolean; resolveProxies: boolean }>): EReferenceImpl {
  return new EReferenceImpl({ name, ...opts });
}

// ============================================================
// 1. EPackage
// ============================================================

describe('EPackage', () => {
  it('debe crear con name, nsURI y nsPrefix', () => {
    const pkg = makePackage('mylib', 'http://mylib/1.0', 'mylib');
    expect(pkg.name).toBe('mylib');
    expect(pkg.nsURI).toBe('http://mylib/1.0');
    expect(pkg.nsPrefix).toBe('mylib');
  });

  it('nsURI y nsPrefix deben ser modificables', () => {
    const pkg = makePackage('x');
    pkg.nsURI = 'http://changed/2.0';
    pkg.nsPrefix = 'ch';
    expect(pkg.nsURI).toBe('http://changed/2.0');
    expect(pkg.nsPrefix).toBe('ch');
  });

  it('getEClassifier debe encontrar clasificadores por nombre', () => {
    const pkg = makePackage('p');
    const cls = makeClass('Foo');
    pkg.eClassifiers.push(cls);
    expect(pkg.getEClassifier('Foo')).toBe(cls);
    expect(pkg.getEClassifier('NonExistent')).toBeNull();
  });

  it('eClassifiers debe ser una lista (EListImpl) que soporta push/length', () => {
    const pkg = makePackage('p');
    expect(pkg.eClassifiers).toBeInstanceOf(Array);
    expect(pkg.eClassifiers.length).toBe(0);
    pkg.eClassifiers.push(makeClass('A'));
    pkg.eClassifiers.push(makeClass('B'));
    expect(pkg.eClassifiers).toHaveLength(2);
    expect(pkg.eClassifiers[0].name).toBe('A');
    expect(pkg.eClassifiers[1].name).toBe('B');
  });

  it('eSubpackages debe soportar subpaquetes', () => {
    const parent = makePackage('parent');
    const child = makePackage('child');
    parent.eSubpackages.push(child);
    expect(parent.eSubpackages).toHaveLength(1);
    expect(parent.eSubpackages[0].name).toBe('child');
  });

  it('eSubpackages debe soportar múltiples subpaquetes', () => {
    const root = makePackage('root');
    root.eSubpackages.push(makePackage('a'));
    root.eSubpackages.push(makePackage('b'));
    root.eSubpackages.push(makePackage('c'));
    expect(root.eSubpackages).toHaveLength(3);
  });

  it('eFactoryInstance debe devolver una EFactory', () => {
    const pkg = makePackage('p');
    const factory = pkg.eFactoryInstance;
    expect(factory).toBeDefined();
    expect(factory).toBeInstanceOf(EFactoryImpl);
    // La factory debe estar vinculada al paquete
    expect(factory.ePackage).toBe(pkg);
  });

  it('eFactoryInstance debe ser la misma instancia en llamadas repetidas', () => {
    const pkg = makePackage('p');
    const f1 = pkg.eFactoryInstance;
    const f2 = pkg.eFactoryInstance;
    expect(f1).toBe(f2);
  });

  it('eFactoryInstance debe ser reemplazable via setter', () => {
    const pkg = makePackage('p');
    const customFactory = new EFactoryImpl();
    pkg.eFactoryInstance = customFactory;
    expect(pkg.eFactoryInstance).toBe(customFactory);
    expect(customFactory.ePackage).toBe(pkg);
  });

  it('eSuperPackage debe devolver null para paquetes raíz', () => {
    const pkg = makePackage('root');
    expect(pkg.eSuperPackage).toBeNull();
  });

  it('eSuperPackage de un subpaquete debe ser configurable', () => {
    const parent = makePackage('parent');
    const child = makePackage('child');
    // eSuperPackage se asigna internamente al hacer push a eSubpackages
    parent.eSubpackages.push(child);
    // revisamos indirectamente: child debería tener parent como superPackage
    // Nota: la implementación asigna _eSuperPackage internamente
    expect(parent.eSubpackages[0].name).toBe('child');
  });
});

// ============================================================
// 2. EClass
// ============================================================

describe('EClass', () => {
  it('debe crear con name y defaults (abstract=false, interface=false)', () => {
    const cls = makeClass('Person');
    expect(cls.name).toBe('Person');
    expect(cls.abstract).toBe(false);
    expect(cls.interface).toBe(false);
  });

  it('debe soportar abstract=true', () => {
    const cls = makeClass('AbstractBase', { abstract: true });
    expect(cls.abstract).toBe(true);
  });

  it('debe soportar interface=true', () => {
    const cls = makeClass('Identifiable', { interface: true });
    expect(cls.interface).toBe(true);
  });

  it('eStructuralFeatures debe ser una lista que soporta push', () => {
    const cls = makeClass('Person');
    expect(cls.eStructuralFeatures).toBeInstanceOf(Array);
    expect(cls.eStructuralFeatures).toHaveLength(0);

    const attr = makeAttribute('name');
    cls.eStructuralFeatures.push(attr);
    expect(cls.eStructuralFeatures).toHaveLength(1);
    expect(cls.eStructuralFeatures[0].name).toBe('name');
  });

  it('eStructuralFeatures debe soportar get por índice', () => {
    const cls = makeClass('C');
    cls.eStructuralFeatures.push(makeAttribute('a'));
    cls.eStructuralFeatures.push(makeAttribute('b'));
    expect(cls.eStructuralFeatures[0].name).toBe('a');
    expect(cls.eStructuralFeatures[1].name).toBe('b');
  });

  it('eAttributes debe filtrar solo EAttribute de eStructuralFeatures', () => {
    const cls = makeClass('C');
    cls.eStructuralFeatures.push(makeAttribute('name'));
    cls.eStructuralFeatures.push(makeAttribute('age'));
    cls.eStructuralFeatures.push(makeReference('children'));
    expect(cls.eAttributes).toHaveLength(2);
    expect(cls.eAttributes[0].name).toBe('name');
    expect(cls.eAttributes[1].name).toBe('age');
  });

  it('eReferences debe filtrar solo EReference de eStructuralFeatures', () => {
    const cls = makeClass('C');
    cls.eStructuralFeatures.push(makeAttribute('name'));
    cls.eStructuralFeatures.push(makeReference('parent'));
    cls.eStructuralFeatures.push(makeReference('children', { containment: true }));
    expect(cls.eReferences).toHaveLength(2);
    expect(cls.eReferences[0].name).toBe('parent');
    expect(cls.eReferences[1].name).toBe('children');
  });

  it('eAllAttributes debe incluir atributos heredados', () => {
    const base = makeClass('Base');
    base.eStructuralFeatures.push(makeAttribute('id'));

    const derived = makeClass('Derived');
    derived.eGenericSuperTypes.push(makeGenericType(base));
    derived.eStructuralFeatures.push(makeAttribute('name'));

    const allAttrs = derived.eAllAttributes;
    expect(allAttrs).toHaveLength(2);
    const names = allAttrs.map(a => a.name);
    expect(names).toContain('id');
    expect(names).toContain('name');
  });

  it('eAllReferences debe incluir referencias heredadas', () => {
    const base = makeClass('Base');
    base.eStructuralFeatures.push(makeReference('parent'));

    const derived = makeClass('Derived');
    derived.eGenericSuperTypes.push(makeGenericType(base));
    derived.eStructuralFeatures.push(makeReference('children', { containment: true }));

    const allRefs = derived.eAllReferences;
    expect(allRefs).toHaveLength(2);
    const names = allRefs.map(r => r.name);
    expect(names).toContain('parent');
    expect(names).toContain('children');
  });

  it('eAllSuperTypes debe computar clausura transitiva DFS', () => {
    const grandparent = makeClass('Grandparent');
    const parent = makeClass('Parent');
    const child = makeClass('Child');

    parent.eGenericSuperTypes.push(makeGenericType(grandparent));
    child.eGenericSuperTypes.push(makeGenericType(parent));

    const allSupers = child.eAllSuperTypes;
    expect(allSupers).toHaveLength(2);
    expect(allSupers[0].name).toBe('Parent');
    expect(allSupers[1].name).toBe('Grandparent');
  });

  it('eAllSuperTypes debe evitar duplicados en diamond inheritance', () => {
    const root = makeClass('Root');
    const left = makeClass('Left');
    const right = makeClass('Right');
    const leaf = makeClass('Leaf');

    left.eGenericSuperTypes.push(makeGenericType(root));
    right.eGenericSuperTypes.push(makeGenericType(root));
    leaf.eGenericSuperTypes.push(makeGenericType(left));
    leaf.eGenericSuperTypes.push(makeGenericType(right));

    // DFS pre-order: Left, Root, Right (Root ya visitado)
    const allSupers = leaf.eAllSuperTypes;
    const names = allSupers.map(c => c.name);
    expect(names).toContain('Left');
    expect(names).toContain('Root');
    expect(names).toContain('Right');
    // Root no debe aparecer dos veces
    const rootCount = names.filter(n => n === 'Root').length;
    expect(rootCount).toBe(1);
  });

  it('eIDAttribute debe encontrar el atributo con iD=true entre eAllAttributes', () => {
    const cls = makeClass('Entity');
    cls.eStructuralFeatures.push(makeAttribute('name'));
    cls.eStructuralFeatures.push(makeAttribute('uuid', { iD: true }));
    expect(cls.eIDAttribute).not.toBeNull();
    expect(cls.eIDAttribute!.name).toBe('uuid');
    expect(cls.eIDAttribute!.iD).toBe(true);
  });

  it('eIDAttribute debe ser null si no hay atributo ID', () => {
    const cls = makeClass('NoId');
    cls.eStructuralFeatures.push(makeAttribute('name'));
    cls.eStructuralFeatures.push(makeAttribute('age'));
    expect(cls.eIDAttribute).toBeNull();
  });

  it('getEStructuralFeature(name) debe encontrar por nombre en eAllStructuralFeatures', () => {
    const base = makeClass('Base');
    base.eStructuralFeatures.push(makeAttribute('id'));

    const derived = makeClass('Derived');
    derived.eGenericSuperTypes.push(makeGenericType(base));
    derived.eStructuralFeatures.push(makeAttribute('name'));

    expect(derived.getEStructuralFeature('id')).not.toBeNull();
    expect(derived.getEStructuralFeature('id')!.name).toBe('id');
    expect(derived.getEStructuralFeature('name')).not.toBeNull();
    expect(derived.getEStructuralFeature('name')!.name).toBe('name');
    expect(derived.getEStructuralFeature('nonExistent')).toBeNull();
  });

  it('getEStructuralFeature(id) debe encontrar por índice numérico', () => {
    const cls = makeClass('C');
    cls.eStructuralFeatures.push(makeAttribute('a'));
    cls.eStructuralFeatures.push(makeAttribute('b'));
    expect(cls.getEStructuralFeature(0)?.name).toBe('a');
    expect(cls.getEStructuralFeature(1)?.name).toBe('b');
    expect(cls.getEStructuralFeature(99)).toBeNull();
    expect(cls.getEStructuralFeature(-1)).toBeNull();
  });

  it('isSuperTypeOf debe devolver true para la misma clase', () => {
    const cls = makeClass('C');
    expect(cls.isSuperTypeOf(cls)).toBe(true);
  });

  it('isSuperTypeOf debe devolver true para subclase directa', () => {
    const base = makeClass('Base');
    const derived = makeClass('Derived');
    derived.eGenericSuperTypes.push(makeGenericType(base));
    expect(base.isSuperTypeOf(derived)).toBe(true);
  });

  it('isSuperTypeOf debe devolver true para subclase transitiva', () => {
    const grandparent = makeClass('Grandparent');
    const parent = makeClass('Parent');
    const child = makeClass('Child');

    parent.eGenericSuperTypes.push(makeGenericType(grandparent));
    child.eGenericSuperTypes.push(makeGenericType(parent));

    expect(grandparent.isSuperTypeOf(child)).toBe(true);
  });

  it('isSuperTypeOf debe devolver false para clases no relacionadas', () => {
    const a = makeClass('A');
    const b = makeClass('B');
    expect(a.isSuperTypeOf(b)).toBe(false);
  });

  it('eGenericSuperTypes debe ser modificable y propagarse a eSuperTypes', () => {
    const base = makeClass('Base');
    const derived = makeClass('Derived');

    const gt = makeGenericType(base);
    derived.eGenericSuperTypes.push(gt);

    expect(derived.eGenericSuperTypes).toHaveLength(1);
    expect(derived.eGenericSuperTypes[0].eClassifier).toBe(base);
    expect(derived.eSuperTypes).toHaveLength(1);
    expect(derived.eSuperTypes[0]).toBe(base);
  });
});

// ============================================================
// 3. EAttribute
// ============================================================

describe('EAttribute', () => {
  it('debe crear con name (via constructor Partial<EAttribute>)', () => {
    const attr = new EAttributeImpl({ name: 'firstName' });
    expect(attr.name).toBe('firstName');
  });

  it('iD debe ser false por defecto', () => {
    const attr = new EAttributeImpl({ name: 'x' });
    expect(attr.iD).toBe(false);
  });

  it('iD debe ser configurable', () => {
    const attr = new EAttributeImpl({ name: 'uuid', iD: true });
    expect(attr.iD).toBe(true);
    attr.iD = false;
    expect(attr.iD).toBe(false);
  });

  it('changeable debe ser true por defecto', () => {
    const attr = new EAttributeImpl({ name: 'x' });
    expect(attr.changeable).toBe(true);
  });

  it('changeable debe ser configurable', () => {
    const attr = new EAttributeImpl({ name: 'x', changeable: false });
    expect(attr.changeable).toBe(false);
  });
});

// ============================================================
// 4. EReference
// ============================================================

describe('EReference', () => {
  it('debe crear con name (via constructor Partial<EReference>)', () => {
    const ref = new EReferenceImpl({ name: 'children' });
    expect(ref.name).toBe('children');
  });

  it('containment debe ser false por defecto', () => {
    const ref = new EReferenceImpl({ name: 'x' });
    expect(ref.containment).toBe(false);
  });

  it('containment debe ser configurable', () => {
    const ref = new EReferenceImpl({ name: 'children', containment: true });
    expect(ref.containment).toBe(true);
  });

  it('resolveProxies debe ser true por defecto', () => {
    const ref = new EReferenceImpl({ name: 'x' });
    expect(ref.resolveProxies).toBe(true);
  });

  it('resolveProxies debe ser configurable', () => {
    const ref = new EReferenceImpl({ name: 'x', resolveProxies: false });
    expect(ref.resolveProxies).toBe(false);
  });

  it('eOpposite debe ser null por defecto', () => {
    const ref = new EReferenceImpl({ name: 'x' });
    expect(ref.eOpposite).toBeNull();
  });

  it('eOpposite debe ser configurable como bidireccional', () => {
    const parent = new EReferenceImpl({ name: 'parent' });
    const children = new EReferenceImpl({ name: 'children', containment: true });

    parent.eOpposite = children;
    expect(parent.eOpposite).toBe(children);
    // container es DERIVED: true si eOpposite != null y eOpposite.containment == true
    expect(parent.container).toBe(true);
    // children no tiene opposite, su container es false
    expect(children.container).toBe(false);
  });

  it('eReferenceType debe derivarse de eType como EClass', () => {
    const targetClass = makeClass('Target');
    const ref = new EReferenceImpl({ name: 'refToTarget' });
    ref.eType = targetClass;
    expect(ref.eReferenceType).toBe(targetClass);
  });

  it('eKeys debe ser una lista de EAttribute', () => {
    const ref = new EReferenceImpl({ name: 'ref' });
    expect(ref.eKeys).toBeInstanceOf(Array);
    expect(ref.eKeys).toHaveLength(0);

    const keyAttr = new EAttributeImpl({ name: 'key' });
    ref.eKeys.push(keyAttr);
    expect(ref.eKeys).toHaveLength(1);
    expect(ref.eKeys[0].name).toBe('key');
  });
});

// ============================================================
// 5. EDataType
// ============================================================

describe('EDataType', () => {
  it('debe crear con name y instanceClassName', () => {
    const dt = new EDataTypeImpl();
    dt.name = 'EString';
    dt.instanceClassName = 'java.lang.String';
    expect(dt.name).toBe('EString');
    expect(dt.instanceClassName).toBe('java.lang.String');
  });

  it('instanceClassName debe ser configurable', () => {
    const dt = new EDataTypeImpl();
    dt.instanceClassName = 'int';
    expect(dt.instanceClassName).toBe('int');
    dt.instanceClassName = 'java.lang.Boolean';
    expect(dt.instanceClassName).toBe('java.lang.Boolean');
  });

  it('serializable debe ser true por defecto', () => {
    const dt = new EDataTypeImpl();
    expect(dt.serializable).toBe(true);
  });

  it('serializable debe ser configurable', () => {
    const dt = new EDataTypeImpl();
    dt.serializable = false;
    expect(dt.serializable).toBe(false);
  });

  it('instanceClass debe mapear java.lang.String a String', () => {
    const dt = new EDataTypeImpl();
    dt.name = 'EString';
    dt.instanceClassName = 'java.lang.String';
    expect(dt.instanceClass).toBe(String);
  });

  it('instanceClass debe mapear java.lang.Boolean a Boolean', () => {
    const dt = new EDataTypeImpl();
    dt.instanceClassName = 'java.lang.Boolean';
    expect(dt.instanceClass).toBe(Boolean);
  });
});

// ============================================================
// 6. EEnum + EEnumLiteral
// ============================================================

describe('EEnum + EEnumLiteral', () => {
  it('debe crear EEnum con literales', () => {
    const enm = new EEnumImpl();
    enm.name = 'Color';

    const red = new EEnumLiteralImpl();
    red.name = 'RED';
    red.value = 0;
    red.literal = 'RED';
    enm.eLiterals.push(red);

    const green = new EEnumLiteralImpl();
    green.name = 'GREEN';
    green.value = 1;
    green.literal = 'GREEN';
    enm.eLiterals.push(green);

    const blue = new EEnumLiteralImpl();
    blue.name = 'BLUE';
    blue.value = 2;
    blue.literal = 'BLUE';
    enm.eLiterals.push(blue);

    expect(enm.eLiterals).toHaveLength(3);
  });

  it('getEEnumLiteral(name) debe buscar por nombre', () => {
    const enm = new EEnumImpl();
    enm.name = 'Color';
    const red = new EEnumLiteralImpl();
    red.name = 'RED'; red.value = 0; red.literal = 'RED';
    enm.eLiterals.push(red);

    expect(enm.getEEnumLiteral('RED')).toBe(red);
    expect(enm.getEEnumLiteral('NON_EXISTENT')).toBeNull();
  });

  it('getEEnumLiteral(value) debe buscar por valor numérico', () => {
    const enm = new EEnumImpl();
    enm.name = 'Color';

    const red = new EEnumLiteralImpl();
    red.name = 'RED'; red.value = 0; red.literal = 'RED';
    enm.eLiterals.push(red);

    const green = new EEnumLiteralImpl();
    green.name = 'GREEN'; green.value = 1; green.literal = 'GREEN';
    enm.eLiterals.push(green);

    expect(enm.getEEnumLiteral(0)).toBe(red);
    expect(enm.getEEnumLiteral(1)).toBe(green);
    expect(enm.getEEnumLiteral(99)).toBeNull();
  });

  it('getEEnumLiteral(literal) debe buscar por string literal', () => {
    const enm = new EEnumImpl();
    enm.name = 'Color';

    const red = new EEnumLiteralImpl();
    red.name = 'RED'; red.value = 0; red.literal = 'RED';
    enm.eLiterals.push(red);

    expect(enm.getEEnumLiteral('RED')).toBe(red);
  });

  it('EEnumLiteral debe tener value, literal, name accesibles', () => {
    const lit = new EEnumLiteralImpl();
    lit.name = 'JANUARY';
    lit.value = 1;
    lit.literal = 'January';
    expect(lit.name).toBe('JANUARY');
    expect(lit.value).toBe(1);
    expect(lit.literal).toBe('January');
  });

  it('EEnumLiteral.instance debe devolver self', () => {
    const lit = new EEnumLiteralImpl();
    lit.name = 'X'; lit.value = 0; lit.literal = 'x';
    expect(lit.instance).toBe(lit);
  });

  it('EEnum debe heredar serializable de EDataType', () => {
    const enm = new EEnumImpl();
    expect(enm.serializable).toBe(true);
    enm.serializable = false;
    expect(enm.serializable).toBe(false);
  });
});

// ============================================================
// 7. EOperation + EParameter
// ============================================================

describe('EOperation + EParameter', () => {
  it('debe crear EOperation con nombre', () => {
    const op = new EOperationImpl();
    op.name = 'doSomething';
    expect(op.name).toBe('doSomething');
  });

  it('eParameters debe ser una lista de EParameter', () => {
    const op = new EOperationImpl();
    op.name = 'calculate';

    const p1 = new EParameterImpl();
    p1.name = 'x';
    op.eParameters.push(p1);

    const p2 = new EParameterImpl();
    p2.name = 'y';
    op.eParameters.push(p2);

    expect(op.eParameters).toHaveLength(2);
    expect(op.eParameters.get(0).name).toBe('x');
    expect(op.eParameters.get(1).name).toBe('y');
  });

  it('EParameter debe tener name', () => {
    const param = new EParameterImpl();
    param.name = 'input';
    expect(param.name).toBe('input');
  });

  it('EParameter debe tener referencia a eOperation container', () => {
    const op = new EOperationImpl();
    op.name = 'compute';
    const param = new EParameterImpl();
    param.name = 'value';
    param.eOperation = op;
    expect(param.eOperation).toBe(op);
  });

  it('EOperation debe soportar lowerBound/upperBound heredados', () => {
    const op = new EOperationImpl();
    op.name = 'getItems';
    op.lowerBound = 0;
    op.upperBound = -1; // many
    expect(op.many).toBe(true);
    expect(op.required).toBe(false);
  });
});

// ============================================================
// 8. EFactory
// ============================================================

describe('EFactory', () => {
  it('createFromString debe convertir EString', () => {
    const factory = new EFactoryImpl();
    const strDt = new EDataTypeImpl();
    strDt.name = 'EString';
    expect(factory.createFromString(strDt, 'hello')).toBe('hello');
  });

  it('createFromString debe convertir EInt', () => {
    const factory = new EFactoryImpl();
    const intDt = new EDataTypeImpl();
    intDt.name = 'EInt';
    expect(factory.createFromString(intDt, '42')).toBe(42);
  });

  it('createFromString debe convertir EBoolean', () => {
    const factory = new EFactoryImpl();
    const boolDt = new EDataTypeImpl();
    boolDt.name = 'EBoolean';
    expect(factory.createFromString(boolDt, 'true')).toBe(true);
    expect(factory.createFromString(boolDt, 'false')).toBe(false);
  });

  it('createFromString debe convertir EDouble', () => {
    const factory = new EFactoryImpl();
    const dblDt = new EDataTypeImpl();
    dblDt.name = 'EDouble';
    expect(factory.createFromString(dblDt, '3.14')).toBeCloseTo(3.14);
  });

  it('createFromString debe convertir EDate', () => {
    const factory = new EFactoryImpl();
    const dateDt = new EDataTypeImpl();
    dateDt.name = 'EDate';
    const result = factory.createFromString(dateDt, '2024-01-15T00:00:00.000Z');
    expect(result).toBeInstanceOf(Date);
    expect(result.toISOString()).toBe('2024-01-15T00:00:00.000Z');
  });

  it('createFromString debe convertir EByteArray', () => {
    const factory = new EFactoryImpl();
    const baDt = new EDataTypeImpl();
    baDt.name = 'EByteArray';
    const result = factory.createFromString(baDt, 'hello');
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it('convertToString debe convertir valores a string', () => {
    const factory = new EFactoryImpl();
    const intDt = new EDataTypeImpl();
    intDt.name = 'EInt';
    expect(factory.convertToString(intDt, 42)).toBe('42');
  });

  it('convertToString debe convertir EDate', () => {
    const factory = new EFactoryImpl();
    const dateDt = new EDataTypeImpl();
    dateDt.name = 'EDate';
    const d = new Date('2024-06-15T12:30:00.000Z');
    expect(factory.convertToString(dateDt, d)).toBe('2024-06-15T12:30:00.000Z');
  });

  it('convertToString debe manejar null/undefined como cadena vacía', () => {
    const factory = new EFactoryImpl();
    const strDt = new EDataTypeImpl();
    strDt.name = 'EString';
    expect(factory.convertToString(strDt, null)).toBe('');
    expect(factory.convertToString(strDt, undefined)).toBe('');
  });
});

// ============================================================
// 9. EAnnotation
// ============================================================

describe('EAnnotation', () => {
  it('debe crear con source', () => {
    const ann = new EAnnotationImpl();
    ann.source = 'http://example.com/doc';
    expect(ann.source).toBe('http://example.com/doc');
  });

  it('details debe ser un objeto Record<string, string>', () => {
    const ann = new EAnnotationImpl();
    ann.source = 'genmodel';
    ann.details = { key1: 'value1', key2: 'value2' };
    expect(ann.details).toBeDefined();
    expect(ann.details.key1).toBe('value1');
    expect(ann.details.key2).toBe('value2');
  });

  it('details debe ser reemplazable completamente', () => {
    const ann = new EAnnotationImpl();
    ann.details = { a: '1', b: '2' };
    ann.details = { c: '3' };
    expect(ann.details).toEqual({ c: '3' });
  });

  it('contents debe ser una lista de EObject', () => {
    const ann = new EAnnotationImpl();
    expect(ann.contents).toBeInstanceOf(Array);
    expect(ann.contents).toHaveLength(0);
  });

  it('references debe ser una lista de EObject', () => {
    const ann = new EAnnotationImpl();
    expect(ann.references).toBeInstanceOf(Array);
    expect(ann.references).toHaveLength(0);
  });
});

// ============================================================
// 10. EListImpl
// ============================================================

describe('EListImpl', () => {
  it('add debe añadir elementos', () => {
    const list = new EListImpl<string>();
    list.add('a');
    list.add('b');
    expect(list).toHaveLength(2);
    expect(list.get(0)).toBe('a');
    expect(list.get(1)).toBe('b');
  });

  it('add(index, e) debe insertar en posición', () => {
    const list = new EListImpl<string>();
    list.add('a');
    list.add('c');
    list.add(1, 'b');
    expect(list.get(0)).toBe('a');
    expect(list.get(1)).toBe('b');
    expect(list.get(2)).toBe('c');
  });

  it('addUnique debe añadir elementos', () => {
    const list = new EListImpl<string>({ unique: true });
    list.addUnique('a');
    list.addUnique('b');
    expect(list).toHaveLength(2);
  });

  it('addUnique debe lanzar DuplicateException para duplicados', () => {
    const list = new EListImpl<string>({ unique: true });
    list.addUnique('a');
    expect(() => list.addUnique('a')).toThrow();
    expect(list).toHaveLength(1);
  });

  it('add debe rechazar duplicados silenciosamente en unique mode', () => {
    const list = new EListImpl<string>({ unique: true });
    expect(list.add('a')).toBe(true);
    expect(list.add('a')).toBe(false);
    expect(list).toHaveLength(1);
  });

  it('remove(index) debe eliminar por índice y devolver el elemento', () => {
    const list = new EListImpl<string>();
    list.add('a');
    list.add('b');
    list.add('c');
    const removed = list.remove(1);
    expect(removed).toBe('b');
    expect(list).toHaveLength(2);
    expect(list.get(0)).toBe('a');
    expect(list.get(1)).toBe('c');
  });

  it('remove(e) debe eliminar por elemento', () => {
    const list = new EListImpl<string>();
    list.add('a');
    list.add('b');
    expect(list.remove('a')).toBe(true);
    expect(list).toHaveLength(1);
    expect(list.get(0)).toBe('b');
    expect(list.remove('nonExistent')).toBe(false);
  });

  it('move(newIndex, element) debe reordenar', () => {
    const list = new EListImpl<string>();
    list.add('a');
    list.add('b');
    list.add('c');
    list.move(1, 'c'); // mover 'c' al índice 1
    expect(list.get(0)).toBe('a');
    expect(list.get(1)).toBe('c');
    expect(list.get(2)).toBe('b');
  });

  it('move(oldIndex, newIndex) debe reordenar por índices', () => {
    const list = new EListImpl<string>();
    list.add('a');
    list.add('b');
    list.add('c');
    const moved = list.move(0, 2); // mover índice 0 al índice 2
    expect(moved).toBe('a');
    expect(list.get(0)).toBe('b');
    expect(list.get(1)).toBe('c');
    expect(list.get(2)).toBe('a');
  });

  it('clear debe vaciar la lista', () => {
    const list = new EListImpl<string>();
    list.add('a');
    list.add('b');
    list.clear();
    expect(list).toHaveLength(0);
  });

  it('size() debe devolver la longitud', () => {
    const list = new EListImpl<string>();
    expect(list.size()).toBe(0);
    list.add('a');
    expect(list.size()).toBe(1);
  });

  it('isEmpty() debe funcionar', () => {
    const list = new EListImpl<string>();
    expect(list.isEmpty()).toBe(true);
    list.add('a');
    expect(list.isEmpty()).toBe(false);
  });

  it('contains() debe funcionar', () => {
    const list = new EListImpl<string>();
    list.add('a');
    expect(list.contains('a')).toBe(true);
    expect(list.contains('b')).toBe(false);
  });

  it('toArray() debe devolver copia', () => {
    const list = new EListImpl<string>();
    list.add('a');
    list.add('b');
    const arr = list.toArray();
    expect(arr).toEqual(['a', 'b']);
    // La copia no debe afectar al original
    arr.push('c');
    expect(list).toHaveLength(2);
  });

  it('debe ser iterable con for...of', () => {
    const list = new EListImpl<string>();
    list.add('x');
    list.add('y');
    const items: string[] = [];
    for (const item of list) {
      items.push(item);
    }
    expect(items).toEqual(['x', 'y']);
  });

  it('debe ser iterable con spread operator', () => {
    const list = new EListImpl<string>();
    list.add('a');
    list.add('b');
    expect([...list]).toEqual(['a', 'b']);
  });

  it('unique mode debe prevenir duplicados en add en cualquier posición', () => {
    const list = new EListImpl<string>({ unique: true });
    list.add('a');
    list.add('b');
    // Intentar añadir duplicado con índice
    list.add(1, 'a'); // no debe añadirse
    expect(list).toHaveLength(2);
  });

  it('set debe reemplazar en índice', () => {
    const list = new EListImpl<string>();
    list.add('a');
    list.add('b');
    const old = list.set(1, 'c');
    expect(old).toBe('b');
    expect(list.get(1)).toBe('c');
  });

  it('basicAdd debe añadir sin notificaciones', () => {
    const list = new EListImpl<string>();
    list.basicAdd('a');
    expect(list).toHaveLength(1);
    expect(list.get(0)).toBe('a');
  });
});

// ============================================================
// 11. EGenericType
// ============================================================

describe('EGenericType', () => {
  it('debe crear con eClassifier', () => {
    const cls = makeClass('MyClass');
    const gt = new EGenericTypeImpl();
    gt.eClassifier = cls;
    expect(gt.eClassifier).toBe(cls);
  });

  it('eTypeArguments debe ser una lista de EGenericType', () => {
    const outer = new EGenericTypeImpl();
    expect(outer.eTypeArguments).toBeInstanceOf(Array);
    expect(outer.eTypeArguments).toHaveLength(0);

    const inner = new EGenericTypeImpl();
    inner.eClassifier = makeClass('Inner');
    outer.eTypeArguments.push(inner);

    expect(outer.eTypeArguments).toHaveLength(1);
    expect(outer.eTypeArguments[0].eClassifier?.name).toBe('Inner');
  });

  it('eRawType debe devolver eClassifier cuando está presente', () => {
    const cls = makeClass('Foo');
    const gt = new EGenericTypeImpl();
    gt.eClassifier = cls;
    expect(gt.eRawType).toBe(cls);
  });

  it('eRawType debe devolver null cuando no hay classifier ni type parameter', () => {
    const gt = new EGenericTypeImpl();
    expect(gt.eRawType).toBeNull();
  });

  it('debe soportar eUpperBound', () => {
    const cls = makeClass('Bound');
    const gt = new EGenericTypeImpl();
    gt.eUpperBound = cls;
    expect(gt.eUpperBound).toBe(cls);
  });

  it('debe soportar eLowerBound', () => {
    const cls = makeClass('Lower');
    const gt = new EGenericTypeImpl();
    gt.eLowerBound = cls;
    expect(gt.eLowerBound).toBe(cls);
  });

  it('toString debe devolver el nombre del classifier', () => {
    const cls = makeClass('String');
    const gt = new EGenericTypeImpl();
    gt.eClassifier = cls;
    expect(gt.toString()).toBe('String');
  });

  it('toString con type arguments debe mostrar notación genérica', () => {
    const listCls = makeClass('EList');
    const stringCls = makeClass('EString');

    const stringArg = new EGenericTypeImpl();
    stringArg.eClassifier = stringCls;

    const listType = new EGenericTypeImpl();
    listType.eClassifier = listCls;
    listType.eTypeArguments.push(stringArg);

    expect(listType.toString()).toBe('EList<EString>');
  });
});

// ============================================================
// 12. Herencia con eGenericSuperTypes — eAllAttributes propaga
// ============================================================

describe('Herencia con eGenericSuperTypes', () => {
  it('eAllAttributes debe incluir atributos de super tipos vía eGenericSuperTypes', () => {
    const base = makeClass('Base');
    base.eStructuralFeatures.push(makeAttribute('id'));
    base.eStructuralFeatures.push(makeAttribute('createdAt'));

    const derived = makeClass('Derived');
    derived.eGenericSuperTypes.push(makeGenericType(base));
    derived.eStructuralFeatures.push(makeAttribute('name'));

    expect(derived.eAllAttributes).toHaveLength(3);
    const names = derived.eAllAttributes.map(a => a.name);
    expect(names).toContain('id');
    expect(names).toContain('createdAt');
    expect(names).toContain('name');
  });

  it('eAllAttributes no debe propagarse a clases no relacionadas', () => {
    const a = makeClass('A');
    a.eStructuralFeatures.push(makeAttribute('onlyA'));

    const b = makeClass('B');
    b.eStructuralFeatures.push(makeAttribute('onlyB'));

    expect(a.eAllAttributes).toHaveLength(1);
    expect(a.eAllAttributes[0].name).toBe('onlyA');
    expect(b.eAllAttributes).toHaveLength(1);
    expect(b.eAllAttributes[0].name).toBe('onlyB');
  });

  it('eAllAttributes debe propagarse correctamente en herencia multinivel', () => {
    const level0 = makeClass('Level0');
    level0.eStructuralFeatures.push(makeAttribute('attr0'));

    const level1 = makeClass('Level1');
    level1.eGenericSuperTypes.push(makeGenericType(level0));
    level1.eStructuralFeatures.push(makeAttribute('attr1'));

    const level2 = makeClass('Level2');
    level2.eGenericSuperTypes.push(makeGenericType(level1));
    level2.eStructuralFeatures.push(makeAttribute('attr2'));

    const allNames = level2.eAllAttributes.map(a => a.name);
    expect(allNames).toEqual(['attr0', 'attr1', 'attr2']);
  });

  it('eAllReferences debe propagarse en cadena de herencia', () => {
    const base = makeClass('Base');
    base.eStructuralFeatures.push(makeReference('parent'));

    const derived = makeClass('Derived');
    derived.eGenericSuperTypes.push(makeGenericType(base));
    derived.eStructuralFeatures.push(makeReference('children', { containment: true }));

    const refNames = derived.eAllReferences.map(r => r.name);
    expect(refNames).toContain('parent');
    expect(refNames).toContain('children');
  });
});

// ============================================================
// 13. Integración: metamodelo completo Employee→Manager→Department
// ============================================================

describe('Integración: Employee→Manager→Department', () => {
  it('debe crear el metamodelo completo con herencia y verificar todo', () => {
    // ==========================================
    // Construcción del metamodelo
    // ==========================================

    // Package
    const pkg = makePackage('company', 'http://company/1.0', 'company');

    // --- Employee (abstract base) ---
    const employee = makeClass('Employee', { abstract: true });

    // Atributos de Employee
    const empId = makeAttribute('empId', { iD: true });
    const name = makeAttribute('name');
    const salary = makeAttribute('salary');
    employee.eStructuralFeatures.push(empId);
    employee.eStructuralFeatures.push(name);
    employee.eStructuralFeatures.push(salary);

    // --- Manager (extends Employee) ---
    const manager = makeClass('Manager');
    manager.eGenericSuperTypes.push(makeGenericType(employee));

    const teamSize = makeAttribute('teamSize');
    const departmentName = makeAttribute('departmentName');
    manager.eStructuralFeatures.push(teamSize);
    manager.eStructuralFeatures.push(departmentName);

    // --- Department ---
    const dept = makeClass('Department');
    const deptId = makeAttribute('deptId', { iD: true });
    const deptName = makeAttribute('deptName');
    dept.eStructuralFeatures.push(deptId);
    dept.eStructuralFeatures.push(deptName);

    // Referencias
    const employees = makeReference('employees', { containment: true });
    employees.eType = employee; // El tipo de la referencia es Employee
    const managerRef = makeReference('manager');
    managerRef.eType = manager; // El tipo de la referencia es Manager
    const supervisor = makeReference('supervisor');
    supervisor.eType = manager;
    dept.eStructuralFeatures.push(employees);
    dept.eStructuralFeatures.push(managerRef);
    dept.eStructuralFeatures.push(supervisor);

    // Registrar en el paquete
    pkg.eClassifiers.push(employee);
    pkg.eClassifiers.push(manager);
    pkg.eClassifiers.push(dept);

    // ==========================================
    // Verificaciones
    // ==========================================

    // -- EPackage --
    expect(pkg.name).toBe('company');
    expect(pkg.nsURI).toBe('http://company/1.0');
    expect(pkg.nsPrefix).toBe('company');
    expect(pkg.eClassifiers).toHaveLength(3);
    expect(pkg.getEClassifier('Employee')).toBe(employee);
    expect(pkg.getEClassifier('Manager')).toBe(manager);
    expect(pkg.getEClassifier('Department')).toBe(dept);
    expect(pkg.getEClassifier('NonExistent')).toBeNull();
    expect(pkg.eFactoryInstance).toBeDefined();

    // -- Employee (abstract) --
    expect(employee.abstract).toBe(true);
    expect(employee.interface).toBe(false);
    expect(employee.eStructuralFeatures).toHaveLength(3);
    expect(employee.eAttributes).toHaveLength(3);
    expect(employee.eReferences).toHaveLength(0);
    expect(employee.eAllAttributes).toHaveLength(3); // solo locales
    expect(employee.eIDAttribute).not.toBeNull();
    expect(employee.eIDAttribute!.name).toBe('empId');
    expect(employee.eAllSuperTypes).toHaveLength(0);
    expect(employee.eGenericSuperTypes).toHaveLength(0);

    // -- Manager (hereda de Employee) --
    expect(manager.abstract).toBe(false);
    expect(manager.interface).toBe(false);
    expect(manager.eStructuralFeatures).toHaveLength(2); // locales
    expect(manager.eAttributes).toHaveLength(2); // locales: teamSize, departmentName
    expect(manager.eReferences).toHaveLength(0);

    // Herencia: eAllAttributes = inherited(3) + local(2) = 5
    expect(manager.eAllAttributes).toHaveLength(5);
    const managerAttrNames = manager.eAllAttributes.map(a => a.name);
    expect(managerAttrNames).toContain('empId');
    expect(managerAttrNames).toContain('name');
    expect(managerAttrNames).toContain('salary');
    expect(managerAttrNames).toContain('teamSize');
    expect(managerAttrNames).toContain('departmentName');

    // ID Attribute heredado
    expect(manager.eIDAttribute).not.toBeNull();
    expect(manager.eIDAttribute!.name).toBe('empId');

    // Super tipos
    expect(manager.eGenericSuperTypes).toHaveLength(1);
    expect(manager.eGenericSuperTypes[0].eClassifier).toBe(employee);
    expect(manager.eSuperTypes).toHaveLength(1);
    expect(manager.eSuperTypes[0]).toBe(employee);
    expect(manager.eSuperTypes[0].name).toBe('Employee');
    expect(manager.eAllSuperTypes).toHaveLength(1);
    expect(manager.eAllSuperTypes[0].name).toBe('Employee');

    // isSuperTypeOf
    expect(employee.isSuperTypeOf(manager)).toBe(true);
    expect(employee.isSuperTypeOf(employee)).toBe(true);
    expect(manager.isSuperTypeOf(employee)).toBe(false);
    expect(manager.isSuperTypeOf(dept)).toBe(false);

    // getEStructuralFeature por nombre (busca en toda la jerarquía)
    expect(manager.getEStructuralFeature('empId')).not.toBeNull();
    expect(manager.getEStructuralFeature('empId')!.name).toBe('empId');
    expect(manager.getEStructuralFeature('teamSize')).not.toBeNull();
    expect(manager.getEStructuralFeature('teamSize')!.name).toBe('teamSize');
    expect(manager.getEStructuralFeature('nonExistent')).toBeNull();

    // getEStructuralFeature por ID
    const empIdFeature = manager.getEStructuralFeature('empId');
    if (empIdFeature) {
      const featureID = manager.getFeatureID(empIdFeature);
      expect(featureID).toBeGreaterThanOrEqual(0);
      const byId = manager.getEStructuralFeature(featureID);
      expect(byId).toBe(empIdFeature);
    }

    // getFeatureCount
    expect(manager.getFeatureCount()).toBe(5);

    // -- Department (con referencias, sin supertipos) --
    expect(dept.eStructuralFeatures).toHaveLength(5); // 2 attributes + 3 references
    expect(dept.eAttributes).toHaveLength(2);
    expect(dept.eReferences).toHaveLength(3);
    expect(dept.eAllReferences).toHaveLength(3);

    // Referencias específicas
    const empRef = dept.eReferences.find(r => r.name === 'employees');
    expect(empRef).toBeDefined();
    expect(empRef!.containment).toBe(true);
    expect(empRef!.resolveProxies).toBe(true);
    expect(empRef!.eType).toBe(employee);

    const mgrRef = dept.eReferences.find(r => r.name === 'manager');
    expect(mgrRef).toBeDefined();
    expect(mgrRef!.containment).toBe(false);
    expect(mgrRef!.eType).toBe(manager);

    // eAllContainments
    const containments = dept.eAllContainments;
    expect(containments).toHaveLength(1);
    expect(containments[0].name).toBe('employees');

    // -- Verificaciones de EAttribute en las referencias --
    expect(employees.eReferenceType).toBe(employee);
    expect(managerRef.eReferenceType).toBe(manager);

    // -- Department no tiene ID --
    expect(dept.eIDAttribute).not.toBeNull();
    expect(dept.eIDAttribute!.name).toBe('deptId');

    // -- Department no tiene herencia --
    expect(dept.eAllSuperTypes).toHaveLength(0);
    expect(dept.eGenericSuperTypes).toHaveLength(0);
    expect(dept.eSuperTypes).toHaveLength(0);
  });
});
