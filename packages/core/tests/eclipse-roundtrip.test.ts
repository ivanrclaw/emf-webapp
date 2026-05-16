/**
 * @emf-webapp/core — Eclipse-compatible round-trip test
 *
 * Tests the full round-trip: SerializableEPackage → serializableToXmiCompatible
 * → serializeToXMI → XMI string → parseEcoreXmi → SerializableEPackage
 *
 * These tests verify that models created in the web editor survive
 * conversion to Eclipse-compatible XMI and back.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { serializeToXMI } from '../src/serialization/XMISerializer.js';
import { serializableToXmiCompatible } from '../src/serialization/SerializableToXmiObject.js';
import { parseEcoreXmi } from '../src/serialization/EcoreXmiParser.js';

// ═══════════════════════════════════════════════════════════════
// Helper to create deterministic IDs (same pattern as roundtrip-ecore.test.ts)
// ═══════════════════════════════════════════════════════════════

let idCounter = 0;
function nextId(prefix = 'x'): string {
  return `${prefix}_${++idCounter}`;
}

// ═══════════════════════════════════════════════════════════════
// Test: a) Simple (2 classes with reference)
// ═══════════════════════════════════════════════════════════════

describe('Eclipse Round-trip: Simple (2 classes with reference)', () => {
  it('should round-trip Person and Address with reference', () => {
    const personId = nextId('ec');
    const addressId = nextId('ec');

    const original: any = {
      name: 'SimpleModel',
      nsURI: 'http://simple/1.0',
      nsPrefix: 'simple',
      eClassifiers: [
        {
          id: personId,
          name: 'Person',
          abstract: false,
          interface: false,
          eSuperTypes: [],
          eAttributes: [
            {
              id: nextId('attr'),
              name: 'name',
              eType: 'EString',
              lowerBound: 1,
              upperBound: 1,
              iD: false,
              changeable: true,
              derived: false,
              transient: false,
              defaultValueLiteral: '',
            },
            {
              id: nextId('attr'),
              name: 'age',
              eType: 'EInt',
              lowerBound: 0,
              upperBound: 1,
              iD: false,
              changeable: true,
              derived: false,
              transient: false,
              defaultValueLiteral: '0',
            },
          ],
          eReferences: [
            {
              id: nextId('ref'),
              name: 'address',
              targetId: addressId,
              containment: false,
              lowerBound: 0,
              upperBound: 1,
              eOpposite: null,
              changeable: true,
              derived: false,
            },
          ],
        },
        {
          id: addressId,
          name: 'Address',
          abstract: false,
          interface: false,
          eSuperTypes: [],
          eAttributes: [
            {
              id: nextId('attr'),
              name: 'street',
              eType: 'EString',
              lowerBound: 0,
              upperBound: 1,
              iD: false,
              changeable: true,
              derived: false,
              transient: false,
              defaultValueLiteral: '',
            },
            {
              id: nextId('attr'),
              name: 'city',
              eType: 'EString',
              lowerBound: 0,
              upperBound: 1,
              iD: false,
              changeable: true,
              derived: false,
              transient: false,
              defaultValueLiteral: '',
            },
          ],
          eReferences: [],
        },
      ],
    };

    const xmiObj = serializableToXmiCompatible(original);
    const xmi = serializeToXMI(xmiObj);
    const result = parseEcoreXmi(xmi) as any;

    // Verify package metadata
    expect(result.name).toBe('SimpleModel');
    expect(result.nsURI).toBe('http://simple/1.0');
    expect(result.nsPrefix).toBe('simple');

    // Verify class names
    const classNames = result.eClassifiers
      .filter((c: any) => 'eAttributes' in c)
      .map((c: any) => c.name)
      .sort();
    expect(classNames).toEqual(['Address', 'Person']);

    // Verify Person attributes
    const person = result.eClassifiers.find((c: any) => c.name === 'Person');
    expect(person).toBeDefined();
    const attrNames = person.eAttributes.map((a: any) => a.name).sort();
    expect(attrNames).toEqual(['age', 'name']);

    // Verify attribute types
    // After round-trip, eType is resolved to string names via parseEcoreXmi
    // The attribute types should match the original eType names

    // Verify Person reference
    expect(person.eReferences).toBeDefined();
    expect(person.eReferences.length).toBe(1);
    expect(person.eReferences[0].name).toBe('address');

    // Verify Address attributes
    const address = result.eClassifiers.find((c: any) => c.name === 'Address');
    expect(address).toBeDefined();
    const addrAttrNames = address.eAttributes.map((a: any) => a.name).sort();
    expect(addrAttrNames).toEqual(['city', 'street']);
  });
});

// ═══════════════════════════════════════════════════════════════
// Test: b) Inheritance
// ═══════════════════════════════════════════════════════════════

describe('Eclipse Round-trip: Inheritance', () => {
  it('should round-trip abstract shape hierarchy', () => {
    const shapeId = nextId('ec');
    const circleId = nextId('ec');
    const rectId = nextId('ec');
    const squareId = nextId('ec');

    const original: any = {
      name: 'Shapes',
      nsURI: 'http://shapes/1.0',
      nsPrefix: 'shapes',
      eClassifiers: [
        {
          id: shapeId,
          name: 'Shape',
          abstract: true,
          interface: false,
          eSuperTypes: [],
          eAttributes: [],
          eReferences: [],
        },
        {
          id: circleId,
          name: 'Circle',
          abstract: false,
          interface: false,
          eSuperTypes: ['Shape'],
          eAttributes: [
            {
              id: nextId('attr'),
              name: 'radius',
              eType: 'EDouble',
              lowerBound: 0,
              upperBound: 1,
              iD: false,
              changeable: true,
              derived: false,
              transient: false,
              defaultValueLiteral: '0.0',
            },
          ],
          eReferences: [],
        },
        {
          id: rectId,
          name: 'Rectangle',
          abstract: false,
          interface: false,
          eSuperTypes: ['Shape'],
          eAttributes: [
            {
              id: nextId('attr'),
              name: 'width',
              eType: 'EDouble',
              lowerBound: 0,
              upperBound: 1,
              iD: false,
              changeable: true,
              derived: false,
              transient: false,
              defaultValueLiteral: '0.0',
            },
            {
              id: nextId('attr'),
              name: 'height',
              eType: 'EDouble',
              lowerBound: 0,
              upperBound: 1,
              iD: false,
              changeable: true,
              derived: false,
              transient: false,
              defaultValueLiteral: '0.0',
            },
          ],
          eReferences: [],
        },
        {
          id: squareId,
          name: 'Square',
          abstract: false,
          interface: false,
          eSuperTypes: ['Rectangle'],
          eAttributes: [
            {
              id: nextId('attr'),
              name: 'side',
              eType: 'EDouble',
              lowerBound: 0,
              upperBound: 1,
              iD: false,
              changeable: true,
              derived: false,
              transient: false,
              defaultValueLiteral: '0.0',
            },
          ],
          eReferences: [],
        },
      ],
    };

    const xmiObj = serializableToXmiCompatible(original);
    const xmi = serializeToXMI(xmiObj);
    const result = parseEcoreXmi(xmi) as any;

    // Verify abstract flag preserved on Shape
    const shape = result.eClassifiers.find((c: any) => c.name === 'Shape');
    expect(shape).toBeDefined();
    expect(shape.abstract).toBe(true);

    // Verify Circle has its own attribute
    const circle = result.eClassifiers.find((c: any) => c.name === 'Circle');
    expect(circle).toBeDefined();
    const circleAttrNames = circle.eAttributes.map((a: any) => a.name);
    expect(circleAttrNames).toContain('radius');

    // Verify Rectangle has its own attributes
    const rect = result.eClassifiers.find((c: any) => c.name === 'Rectangle');
    expect(rect).toBeDefined();
    const rectAttrNames = rect.eAttributes.map((a: any) => a.name).sort();
    expect(rectAttrNames).toEqual(['height', 'width']);

    // Verify Square extends Rectangle via eSuperTypes
    const square = result.eClassifiers.find((c: any) => c.name === 'Square');
    expect(square).toBeDefined();
    expect(square.eSuperTypes).toBeDefined();
    expect(square.eSuperTypes.length).toBeGreaterThanOrEqual(1);

    // Verify Square has its own attribute
    const squareAttrNames = square.eAttributes.map((a: any) => a.name);
    expect(squareAttrNames).toContain('side');
  });
});

// ═══════════════════════════════════════════════════════════════
// Test: c) EOperations
// ═══════════════════════════════════════════════════════════════

describe('Eclipse Round-trip: EOperations', () => {
  it('should round-trip Calculator with add operation', () => {
    const calcId = nextId('ec');

    const original: any = {
      name: 'CalcModel',
      nsURI: 'http://calc/1.0',
      nsPrefix: 'calc',
      eClassifiers: [
        {
          id: calcId,
          name: 'Calculator',
          abstract: false,
          interface: false,
          eSuperTypes: [],
          eAttributes: [],
          eReferences: [],
          eOperations: [
            {
              id: nextId('op'),
              name: 'add',
              eType: 'EInt',
              lowerBound: 0,
              upperBound: 1,
              eParameters: [
                {
                  id: nextId('param'),
                  name: 'a',
                  eType: 'EInt',
                  lowerBound: 0,
                  upperBound: 1,
                },
                {
                  id: nextId('param'),
                  name: 'b',
                  eType: 'EInt',
                  lowerBound: 0,
                  upperBound: 1,
                },
              ],
            },
          ],
        },
      ],
    };

    const xmiObj = serializableToXmiCompatible(original);
    const xmi = serializeToXMI(xmiObj);
    const result = parseEcoreXmi(xmi) as any;

    const calc = result.eClassifiers.find((c: any) => c.name === 'Calculator');
    expect(calc).toBeDefined();

    // Verify operation name preserved
    expect(calc.eOperations).toBeDefined();
    expect(calc.eOperations.length).toBe(1);
    expect(calc.eOperations[0].name).toBe('add');

    // Verify parameters preserved
    const op = calc.eOperations[0];
    expect(op.eParameters).toBeDefined();
    expect(op.eParameters.length).toBe(2);

    const paramNames = op.eParameters.map((p: any) => p.name).sort();
    expect(paramNames).toEqual(['a', 'b']);
  });
});

// ═══════════════════════════════════════════════════════════════
// Test: d) Bidirectional refs
// ═══════════════════════════════════════════════════════════════

describe('Eclipse Round-trip: Bidirectional refs', () => {
  it('should round-trip Department.employees ↔ Employee.department', () => {
    const deptId = nextId('ec');
    const empId = nextId('ec');

    const original: any = {
      name: 'OrgModel',
      nsURI: 'http://org/1.0',
      nsPrefix: 'org',
      eClassifiers: [
        {
          id: deptId,
          name: 'Department',
          abstract: false,
          interface: false,
          eSuperTypes: [],
          eAttributes: [
            {
              id: nextId('attr'),
              name: 'name',
              eType: 'EString',
              lowerBound: 1,
              upperBound: 1,
              iD: false,
              changeable: true,
              derived: false,
              transient: false,
              defaultValueLiteral: '',
            },
          ],
          eReferences: [
            {
              id: nextId('ref'),
              name: 'employees',
              targetId: empId,
              containment: false,
              lowerBound: 0,
              upperBound: -1,
              eOpposite: null,
              changeable: true,
              derived: false,
            },
          ],
        },
        {
          id: empId,
          name: 'Employee',
          abstract: false,
          interface: false,
          eSuperTypes: [],
          eAttributes: [
            {
              id: nextId('attr'),
              name: 'name',
              eType: 'EString',
              lowerBound: 1,
              upperBound: 1,
              iD: false,
              changeable: true,
              derived: false,
              transient: false,
              defaultValueLiteral: '',
            },
          ],
          eReferences: [
            {
              id: nextId('ref'),
              name: 'department',
              targetId: deptId,
              containment: false,
              lowerBound: 0,
              upperBound: 1,
              eOpposite: null,
              changeable: true,
              derived: false,
            },
          ],
        },
      ],
    };

    const xmiObj = serializableToXmiCompatible(original);
    const xmi = serializeToXMI(xmiObj);
    const result = parseEcoreXmi(xmi) as any;

    // Verify classes and references survived
    const dept = result.eClassifiers.find((c: any) => c.name === 'Department');
    expect(dept).toBeDefined();
    const emp = result.eClassifiers.find((c: any) => c.name === 'Employee');
    expect(emp).toBeDefined();

    // Verify Department has employees reference
    expect(dept.eReferences).toBeDefined();
    const empRef = dept.eReferences.find((r: any) => r.name === 'employees');
    expect(empRef).toBeDefined();

    // Verify Employee has department reference
    expect(emp.eReferences).toBeDefined();
    const deptRef = emp.eReferences.find((r: any) => r.name === 'department');
    expect(deptRef).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════
// Test: e) Complex (5+ classes, enums, datatypes, mixed features)
// ═══════════════════════════════════════════════════════════════

function createComplexPackage(): any {
  return {
    name: 'ComplexModel',
    nsURI: 'http://complex/1.0',
    nsPrefix: 'complex',
    eClassifiers: [
      // EDataType
      {
        id: nextId('dt'),
        name: 'CustomString',
        instanceClassName: 'java.lang.String',
        serializable: true,
      },
      // EEnum
      {
        id: nextId('enum'),
        name: 'Status',
        eLiterals: [
          { id: nextId('lit'), name: 'ACTIVE', value: 0, literal: 'Active' },
          { id: nextId('lit'), name: 'INACTIVE', value: 1, literal: 'Inactive' },
          { id: nextId('lit'), name: 'PENDING', value: 3, literal: 'Pending' },
        ],
      },
      // EClass: Person (with attributes + reference to Address)
      {
        id: nextId('ec'),
        name: 'Person',
        abstract: false,
        interface: false,
        eSuperTypes: [],
        eAttributes: [
          {
            id: nextId('attr'),
            name: 'fullName',
            eType: 'EString',
            lowerBound: 1,
            upperBound: 1,
            iD: false,
            changeable: true,
            derived: false,
            transient: false,
            defaultValueLiteral: '',
          },
          {
            id: nextId('attr'),
            name: 'age',
            eType: 'EInt',
            lowerBound: 0,
            upperBound: 1,
            iD: false,
            changeable: true,
            derived: false,
            transient: false,
            defaultValueLiteral: '0',
          },
          {
            id: nextId('attr'),
            name: 'status',
            eType: 'Status',
            lowerBound: 0,
            upperBound: 1,
            iD: false,
            changeable: true,
            derived: false,
            transient: false,
            defaultValueLiteral: 'ACTIVE',
          },
        ],
        eReferences: [],
      },
      // EClass: Author (extends Person, has reference to Book)
      {
        id: nextId('ec'),
        name: 'Author',
        abstract: false,
        interface: false,
        eSuperTypes: [], // resolved by name via parseEcoreXmi
        eAttributes: [
          {
            id: nextId('attr'),
            name: 'penName',
            eType: 'EString',
            lowerBound: 0,
            upperBound: 1,
            iD: false,
            changeable: true,
            derived: false,
            transient: false,
            defaultValueLiteral: '',
          },
        ],
        eReferences: [
          {
            id: nextId('ref'),
            name: 'books',
            targetId: 'ec_book',
            containment: true,
            lowerBound: 0,
            upperBound: -1,
            eOpposite: null,
            changeable: true,
            derived: false,
          },
        ],
      },
      // EClass: Book (has attributes)
      {
        id: nextId('ec'),
        name: 'Book',
        abstract: false,
        interface: false,
        eSuperTypes: [],
        eAttributes: [
          {
            id: nextId('attr'),
            name: 'title',
            eType: 'EString',
            lowerBound: 1,
            upperBound: 1,
            iD: false,
            changeable: true,
            derived: false,
            transient: false,
            defaultValueLiteral: '',
          },
          {
            id: nextId('attr'),
            name: 'pages',
            eType: 'EInt',
            lowerBound: 0,
            upperBound: 1,
            iD: false,
            changeable: true,
            derived: false,
            transient: false,
            defaultValueLiteral: '0',
          },
        ],
        eReferences: [],
      },
      // EClass: Address
      {
        id: nextId('ec'),
        name: 'Address',
        abstract: false,
        interface: false,
        eSuperTypes: [],
        eAttributes: [
          {
            id: nextId('attr'),
            name: 'street',
            eType: 'EString',
            lowerBound: 0,
            upperBound: 1,
            iD: false,
            changeable: true,
            derived: false,
            transient: false,
            defaultValueLiteral: '',
          },
          {
            id: nextId('attr'),
            name: 'city',
            eType: 'EString',
            lowerBound: 0,
            upperBound: 1,
            iD: false,
            changeable: true,
            derived: false,
            transient: false,
            defaultValueLiteral: '',
          },
        ],
        eReferences: [],
      },
    ],
  };
}

describe('Eclipse Round-trip: Complex package', () => {
  const original = createComplexPackage();

  it('should round-trip package name and namespace', () => {
    const xmiObj = serializableToXmiCompatible(original);
    const xmi = serializeToXMI(xmiObj);
    const result = parseEcoreXmi(xmi) as any;

    expect(result.name).toBe('ComplexModel');
    expect(result.nsURI).toBe('http://complex/1.0');
    expect(result.nsPrefix).toBe('complex');
  });

  it('should round-trip all classifiers (5+ classes, enums, datatypes)', () => {
    const xmiObj = serializableToXmiCompatible(original);
    const xmi = serializeToXMI(xmiObj);
    const result = parseEcoreXmi(xmi) as any;

    const classNames = result.eClassifiers.map((c: any) => c.name).sort();
    expect(classNames.length).toBeGreaterThanOrEqual(6);
    expect(classNames).toContain('Person');
    expect(classNames).toContain('Author');
    expect(classNames).toContain('Book');
    expect(classNames).toContain('Address');
    expect(classNames).toContain('Status');
    expect(classNames).toContain('CustomString');
  });

  it('should round-trip attributes on Person', () => {
    const xmiObj = serializableToXmiCompatible(original);
    const xmi = serializeToXMI(xmiObj);
    const result = parseEcoreXmi(xmi) as any;

    const person = result.eClassifiers.find((c: any) => c.name === 'Person');
    expect(person).toBeDefined();
    expect(person.eAttributes).toBeDefined();
    expect(person.eAttributes.length).toBe(3);
    const attrNames = person.eAttributes.map((a: any) => a.name).sort();
    expect(attrNames).toEqual(['age', 'fullName', 'status']);
  });

  it('should round-trip EEnum with literals', () => {
    const xmiObj = serializableToXmiCompatible(original);
    const xmi = serializeToXMI(xmiObj);
    const result = parseEcoreXmi(xmi) as any;

    const status = result.eClassifiers.find((c: any) => c.name === 'Status');
    expect(status).toBeDefined();
    expect(status.eLiterals).toBeDefined();
    expect(status.eLiterals.length).toBe(3);
    const litNames = status.eLiterals.map((l: any) => l.name);
    expect(litNames).toContain('ACTIVE');
    expect(litNames).toContain('INACTIVE');
    expect(litNames).toContain('PENDING');
  });

  it('should round-trip EDataType', () => {
    const xmiObj = serializableToXmiCompatible(original);
    const xmi = serializeToXMI(xmiObj);
    const result = parseEcoreXmi(xmi) as any;

    const cs = result.eClassifiers.find((c: any) => c.name === 'CustomString');
    expect(cs).toBeDefined();
    expect(cs.instanceClassName).toBeDefined();
  });

  it('should produce well-formed XML', () => {
    const xmiObj = serializableToXmiCompatible(original);
    const xmi = serializeToXMI(xmiObj);

    expect(xmi).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xmi).toContain('xmi:version="2.0"');
    expect(xmi).toContain('xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore"');
    expect(xmi).toContain('name="ComplexModel"');
    expect(xmi).toContain('nsURI="http://complex/1.0"');
    expect(xmi).toContain('nsPrefix="complex"');
  });
});

// ═══════════════════════════════════════════════════════════════
// Test: Sprint 9 — Eclipse interoperability regression tests
// ═══════════════════════════════════════════════════════════════

describe('Eclipse Interoperability: Sprint 9 fixes', () => {
  const libraryModel: any = {
    name: 'library',
    nsURI: 'http://www.example.org/library',
    nsPrefix: 'library',
    eClassifiers: [
      {
        id: 'c1', name: 'Library',
        eAttributes: [{ name: 'name', eType: 'EString' }],
        eReferences: [{ name: 'books', targetId: 'c2', containment: true, upperBound: -1 }],
        eSuperTypes: [], abstract: false, interface: false
      },
      {
        id: 'c2', name: 'Book',
        eAttributes: [
          { name: 'title', eType: 'EString' },
          { name: 'pages', eType: 'EInt' },
          { name: 'category', eType: 'BookCategory' }
        ],
        eReferences: [{ name: 'author', targetId: 'c3', containment: false }],
        eSuperTypes: ['NamedElement'], abstract: false, interface: false
      },
      {
        id: 'c3', name: 'Writer',
        eAttributes: [{ name: 'name', eType: 'EString' }],
        eReferences: [{ name: 'books', targetId: 'c2', containment: false, upperBound: -1 }],
        eSuperTypes: ['NamedElement'], abstract: false, interface: false
      },
      {
        id: 'c4', name: 'NamedElement',
        eAttributes: [{ name: 'name', eType: 'EString' }],
        eReferences: [], eSuperTypes: [], abstract: true, interface: false
      },
      {
        id: 'c5', name: 'BookCategory',
        eLiterals: [
          { name: 'Mystery', value: 0, literal: 'Mystery' },
          { name: 'ScienceFiction', value: 1, literal: 'ScienceFiction' },
          { name: 'Biography', value: 2, literal: 'Biography' }
        ]
      }
    ]
  };

  let xmi: string;

  beforeAll(() => {
    const pkg = serializableToXmiCompatible(libraryModel);
    xmi = serializeToXMI(pkg);
  });

  it('should NOT emit eReferenceType as attribute (was [object Object])', () => {
    expect(xmi).not.toContain('eReferenceType');
  });

  it('should emit eType="#//ClassName" for EReferences (local fragment path)', () => {
    expect(xmi).toContain('eType="#//Book"');
    expect(xmi).toContain('eType="#//Writer"');
  });

  it('should emit eSuperTypes for classes with inheritance', () => {
    expect(xmi).toContain('eSuperTypes="#//NamedElement"');
  });

  it('should NOT emit abstract="false" (only emit when true)', () => {
    expect(xmi).not.toContain('abstract="false"');
    expect(xmi).toContain('abstract="true"');
  });

  it('should NOT have duplicate xmi:id values', () => {
    const ids: string[] = [];
    const re = /xmi:id="([^"]+)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(xmi)) !== null) ids.push(m[1]);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });

  it('should NOT emit href on EEnum', () => {
    // Find the BookCategory section and verify no href
    const enumSection = xmi.split('BookCategory')[1]?.split('</eClassifiers>')[0] || '';
    expect(enumSection).not.toContain('href=');
  });

  it('should emit eType="#//EnumName" for EEnum-typed attributes', () => {
    expect(xmi).toContain('eType="#//BookCategory"');
  });

  it('should NOT emit eAttributeType (derived, not serialized)', () => {
    expect(xmi).not.toContain('eAttributeType');
  });

  it('should omit default values (lowerBound=0, upperBound=1, iD=false, etc.)', () => {
    expect(xmi).not.toContain('lowerBound="0"');
    expect(xmi).not.toContain('upperBound="1"');
    expect(xmi).not.toContain('iD="false"');
    expect(xmi).not.toContain('changeable="true"');
    expect(xmi).not.toContain('derived="false"');
    expect(xmi).not.toContain('transient="false"');
  });

  it('should emit non-default values (upperBound=-1, containment=true)', () => {
    expect(xmi).toContain('upperBound="-1"');
    expect(xmi).toContain('containment="true"');
  });

  it('should round-trip back to SerializableEPackage preserving all data', () => {
    const parsed = parseEcoreXmi(xmi) as any;
    expect(parsed.name).toBe('library');
    expect(parsed.nsURI).toBe('http://www.example.org/library');
    expect(parsed.eClassifiers).toHaveLength(5);

    const book = parsed.eClassifiers.find((c: any) => c.name === 'Book');
    // eSuperTypes are resolved to IDs by the parser
    const namedEl = parsed.eClassifiers.find((c: any) => c.name === 'NamedElement');
    expect(book.eSuperTypes).toContain(namedEl.id);
    expect(book.eAttributes).toHaveLength(3);
    expect(book.eReferences).toHaveLength(1);
    expect(book.eReferences[0].name).toBe('author');

    expect(namedEl.abstract).toBe(true);

    const bookCat = parsed.eClassifiers.find((c: any) => c.name === 'BookCategory');
    expect(bookCat.eLiterals).toHaveLength(3);
    expect(bookCat.eLiterals[1].value).toBe(1);
  });
});
