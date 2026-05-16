/**
 * @emf-webapp/core — Round-trip test: Serializable → XMI → Serializable
 *
 * Verifica que un SerializableEPackage complejo sobrevive al ciclo:
 *   1. serializableToXmiCompatible() → serializeToXMI() → XMI 2.0
 *   2. parseEcoreXmi() → SerializableEPackage
 *   3. Verificar que el resultado coincide con el original
 */
import { describe, it, expect } from 'vitest';
import { serializeToXMI } from '../src/serialization/XMISerializer.js';
import { serializableToXmiCompatible } from '../src/serialization/SerializableToXmiObject.js';
import { parseEcoreXmi } from '../src/serialization/EcoreXmiParser.js';

// ═══════════════════════════════════════════════════════════════
// Helper to create deterministic IDs
// ═══════════════════════════════════════════════════════════════

let idCounter = 0;
function nextId(prefix = 'x'): string {
  return `${prefix}_${++idCounter}`;
}

function createComplexPackage(): any {
  return {
    name: 'Library',
    nsURI: 'http://library/1.0',
    nsPrefix: 'lib',
    eClassifiers: [
      {
        id: nextId('dt'),
        name: 'CustomString',
        instanceClassName: 'java.lang.String',
        serializable: true,
      },
      {
        id: nextId('enum'),
        name: 'Status',
        eLiterals: [
          { id: nextId('lit'), name: 'ACTIVE', value: 0, literal: 'Active' },
          { id: nextId('lit'), name: 'INACTIVE', value: 1, literal: 'Inactive' },
          { id: nextId('lit'), name: 'PENDING', value: 3, literal: 'Pending' },
        ],
      },
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
        ],
        eReferences: [],
        eAnnotations: [],
      },
      {
        id: nextId('ec'),
        name: 'Author',
        abstract: false,
        interface: false,
        eSuperTypes: ['Person'],
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
            name: 'books',
            lowerBound: 0,
            upperBound: -1,
            containment: true,
            changeable: true,
            derived: false,
            targetId: 'ec_book',
          },
        ],
        eAnnotations: [],
      },
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
        eAnnotations: [],
      },
    ],
  };
}

// ═══════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════

describe('Round-trip: Serializable → XMI → Serializable', () => {
  const original = createComplexPackage();

  it('1. debe convertir a XMI sin errores', () => {
    const xmiObj = serializableToXmiCompatible(original);
    const xmi = serializeToXMI(xmiObj);
    expect(xmi).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xmi).toContain('xmi:version="2.0"');
    expect(xmi).toContain('xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore"');
    expect(xmi).toContain('name="Library"');
    expect(xmi).toContain('nsURI="http://library/1.0"');
    expect(xmi).toContain('nsPrefix="lib"');
  });

  it('2. XMI debe contener eClassifiers como elementos hijo', () => {
    const xmiObj = serializableToXmiCompatible(original);
    const xmi = serializeToXMI(xmiObj);
    expect(xmi).not.toContain('eClassifiers="[object');
    expect(xmi).toContain('<eClassifiers');
    expect(xmi).toContain('name="Person"');
    expect(xmi).toContain('name="Author"');
    expect(xmi).toContain('name="Book"');
    expect(xmi).toContain('name="Status"');
    expect(xmi).toContain('name="CustomString"');
  });

  it('3. XMI debe contener atributos y referencias como hijos', () => {
    const xmiObj = serializableToXmiCompatible(original);
    const xmi = serializeToXMI(xmiObj);
    expect(xmi).toContain('name="fullName"');
    expect(xmi).toContain('name="age"');
    expect(xmi).toContain('name="penName"');
    expect(xmi).toContain('name="title"');
    expect(xmi).toContain('name="pages"');
    expect(xmi).toContain('name="books"');
  });

  it('4. round-trip preserva nombre y ns del paquete', () => {
    const xmiObj = serializableToXmiCompatible(original);
    const xmi = serializeToXMI(xmiObj);
    const result = parseEcoreXmi(xmi) as any;
    expect(result.name).toBe('Library');
    expect(result.nsURI).toBe('http://library/1.0');
    expect(result.nsPrefix).toBe('lib');
  });

  it('5. round-trip preserva todos los classifiers', () => {
    const xmiObj = serializableToXmiCompatible(original);
    const xmi = serializeToXMI(xmiObj);
    const result = parseEcoreXmi(xmi) as any;
    const names = result.eClassifiers.map((c: any) => c.name).sort();
    expect(names).toEqual(['Author', 'Book', 'CustomString', 'Person', 'Status']);
  });

  it('6. round-trip preserva atributos en EClasses', () => {
    const xmiObj = serializableToXmiCompatible(original);
    const xmi = serializeToXMI(xmiObj);
    const result = parseEcoreXmi(xmi) as any;
    const person = result.eClassifiers.find((c: any) => c.name === 'Person');
    expect(person).toBeTruthy();
    expect(person.eAttributes).toBeDefined();
    expect(person.eAttributes.length).toBe(2);
    expect(person.eAttributes[0].name).toBe('fullName');
    expect(person.eAttributes[1].name).toBe('age');
  });

  it('7. round-trip preserva referencias', () => {
    const xmiObj = serializableToXmiCompatible(original);
    const xmi = serializeToXMI(xmiObj);
    const result = parseEcoreXmi(xmi) as any;
    const author = result.eClassifiers.find((c: any) => c.name === 'Author');
    expect(author).toBeTruthy();
    expect(author.eReferences).toBeDefined();
    expect(author.eReferences.length).toBe(1);
    expect(author.eReferences[0].name).toBe('books');
    expect(author.eReferences[0].containment).toBe(true);
  });

  it('8. round-trip preserva EEnum con literales', () => {
    const xmiObj = serializableToXmiCompatible(original);
    const xmi = serializeToXMI(xmiObj);
    const result = parseEcoreXmi(xmi) as any;
    const status = result.eClassifiers.find((c: any) => c.name === 'Status');
    expect(status).toBeTruthy();
    expect(status.eLiterals).toBeDefined();
    expect(status.eLiterals.length).toBe(3);
    const names = status.eLiterals.map((l: any) => l.name);
    expect(names).toContain('ACTIVE');
    expect(names).toContain('INACTIVE');
    expect(names).toContain('PENDING');
  });

  it('9. round-trip preserva eSuperTypes', () => {
    const xmiObj = serializableToXmiCompatible(original);
    const xmi = serializeToXMI(xmiObj);
    const result = parseEcoreXmi(xmi) as any;
    const author = result.eClassifiers.find((c: any) => c.name === 'Author');
    expect(author).toBeTruthy();
    expect(author.eSuperTypes).toBeDefined();
    expect(author.eSuperTypes.length).toBeGreaterThanOrEqual(1);
    // eSuperTypes are resolved to IDs; verify it points to a valid classifier
    const superTypeId = author.eSuperTypes[0];
    const superType = result.eClassifiers.find((c: any) => c.id === superTypeId);
    expect(superType).toBeTruthy();
    expect(superType.name).toEqual('Person');
  });

  it('10. round-trip preserva EDataType', () => {
    const xmiObj = serializableToXmiCompatible(original);
    const xmi = serializeToXMI(xmiObj);
    const result = parseEcoreXmi(xmi) as any;
    const cs = result.eClassifiers.find((c: any) => c.name === 'CustomString');
    expect(cs).toBeTruthy();
    expect(cs.instanceClassName).toBeDefined();
  });

  it('11. XML bien formado (un solo root tag)', () => {
    const xmiObj = serializableToXmiCompatible(original);
    const xmi = serializeToXMI(xmiObj);
    // Root tag uses ecore: namespace because EClass is from Ecore registry
    const rootOpens = (xmi.match(/<ecore:EPackage/g) || []).length;
    if (xmi.includes('/>') && !xmi.includes('</ecore:EPackage>')) {
      expect(rootOpens).toBe(1);
    } else {
      const rootCloses = (xmi.match(/<\/ecore:EPackage>/g) || []).length;
      expect(rootOpens).toBe(1);
      expect(rootCloses).toBe(1);
    }
  });
});
