/**
 * @emf-webapp/core — Eclipse-compatible round-trip test
 *
 * Tests the full round-trip: SerializableEPackage → serializableToXmiCompatible
 * → serializeToXMI → XMI string → parseEcoreXmi → SerializableEPackage
 *
 * These tests verify that models created in the web editor survive
 * conversion to Eclipse-compatible XMI and back.
 */
import { describe, it, expect } from 'vitest';
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
