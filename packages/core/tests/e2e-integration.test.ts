/**
 * @emf-webapp/core — E2E Integration Tests
 *
 * Tests completos de flujos end-to-end:
 * 1. Crear metamodelo → exportar .ecore → validar XML → importar → roundtrip
 * 2. OCL constraints → annotations en .ecore
 * 3. Eclipse ZIP structure validation
 * 4. Large metamodel performance
 */
import { describe, it, expect } from 'vitest';
import {
  serializableToXmiCompatible,
  serializeToXMI,
  parseEcoreXmi,
  OCLAnnotationExporter,
} from '../src/serialization/index.js';
import type { SerializableEPackage } from '../src/serialization/index.js';

// ══════════════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════════════

const LIBRARY_METAMODEL: SerializableEPackage = {
  name: 'library',
  nsURI: 'http://library.example.org/1.0',
  nsPrefix: 'library',
  eClassifiers: [
    {
      type: 'EClass',
      name: 'Library',
      eAttributes: [{ name: 'name', eType: 'EString' }],
      eReferences: [
        { name: 'books', eType: '#//Book', containment: true, upperBound: -1 },
        { name: 'authors', eType: '#//Author', containment: true, upperBound: -1 },
      ],
    },
    {
      type: 'EClass',
      name: 'Book',
      eAttributes: [
        { name: 'title', eType: 'EString' },
        { name: 'pages', eType: 'EInt' },
        { name: 'isbn', eType: 'EString' },
      ],
      eReferences: [
        { name: 'author', eType: '#//Author' },
      ],
    },
    {
      type: 'EClass',
      name: 'Author',
      eAttributes: [
        { name: 'name', eType: 'EString' },
        { name: 'birthYear', eType: 'EInt' },
      ],
      eReferences: [
        { name: 'books', eType: '#//Book', upperBound: -1 },
      ],
    },
    {
      type: 'EEnum',
      name: 'BookFormat',
      eLiterals: [
        { name: 'PAPERBACK', value: 0 },
        { name: 'HARDCOVER', value: 1 },
        { name: 'EBOOK', value: 2 },
      ],
    },
  ] as any[],
};

const INHERITANCE_METAMODEL: SerializableEPackage = {
  name: 'shapes',
  nsURI: 'http://shapes.example.org/1.0',
  nsPrefix: 'shapes',
  eClassifiers: [
    {
      type: 'EClass',
      name: 'Shape',
      abstract: true,
      eAttributes: [
        { name: 'color', eType: 'EString' },
        { name: 'x', eType: 'EInt' },
        { name: 'y', eType: 'EInt' },
      ],
    },
    {
      type: 'EClass',
      name: 'Circle',
      eSuperTypes: ['#//Shape'],
      eAttributes: [
        { name: 'radius', eType: 'EDouble' },
      ],
    },
    {
      type: 'EClass',
      name: 'Rectangle',
      eSuperTypes: ['#//Shape'],
      eAttributes: [
        { name: 'width', eType: 'EDouble' },
        { name: 'height', eType: 'EDouble' },
      ],
    },
  ] as any[],
};

// ══════════════════════════════════════════════════════════════
//  16.1 — FULL EXPORT FLOW
// ══════════════════════════════════════════════════════════════

describe('E2E: Export .ecore flow', () => {
  it('exports library metamodel to valid XMI 2.0', () => {
    const xmiObj = serializableToXmiCompatible(LIBRARY_METAMODEL);
    const xml = serializeToXMI(xmiObj);

    // Valid XML structure
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('xmlns:xmi="http://www.omg.org/XMI"');
    expect(xml).toContain('xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore"');
    expect(xml).toContain('nsURI="http://library.example.org/1.0"');
    expect(xml).toContain('nsPrefix="library"');
  });

  it('exports all EClasses with correct xsi:type', () => {
    const xmiObj = serializableToXmiCompatible(LIBRARY_METAMODEL);
    const xml = serializeToXMI(xmiObj);

    expect(xml).toContain('xsi:type="ecore:EClass" name="Library"');
    expect(xml).toContain('xsi:type="ecore:EClass" name="Book"');
    expect(xml).toContain('xsi:type="ecore:EClass" name="Author"');
  });

  it('exports EEnum with literals', () => {
    const xmiObj = serializableToXmiCompatible(LIBRARY_METAMODEL);
    const xml = serializeToXMI(xmiObj);

    expect(xml).toContain('xsi:type="ecore:EEnum" name="BookFormat"');
    expect(xml).toContain('<eLiterals name="PAPERBACK"');
    expect(xml).toContain('<eLiterals name="HARDCOVER" value="1"');
    expect(xml).toContain('<eLiterals name="EBOOK" value="2"');
  });

  it('exports EAttributes with correct eType references', () => {
    const xmiObj = serializableToXmiCompatible(LIBRARY_METAMODEL);
    const xml = serializeToXMI(xmiObj);

    expect(xml).toContain('eType="ecore:EDataType http://www.eclipse.org/emf/2002/Ecore#//EString"');
    expect(xml).toContain('eType="ecore:EDataType http://www.eclipse.org/emf/2002/Ecore#//EInt"');
  });

  it('exports containment references with upperBound', () => {
    const xmiObj = serializableToXmiCompatible(LIBRARY_METAMODEL);
    const xml = serializeToXMI(xmiObj);

    expect(xml).toContain('name="books" upperBound="-1" containment="true"');
  });

  it('exports abstract classes correctly', () => {
    const xmiObj = serializableToXmiCompatible(INHERITANCE_METAMODEL);
    const xml = serializeToXMI(xmiObj);

    expect(xml).toContain('abstract="true"');
    expect(xml).toContain('name="Shape"');
  });

  it('exports EClass without eReferences (no crash)', () => {
    const minimal: SerializableEPackage = {
      name: 'minimal',
      nsURI: 'http://minimal.org/1.0',
      nsPrefix: 'min',
      eClassifiers: [
        { type: 'EClass', name: 'Solo', eAttributes: [{ name: 'x', eType: 'EString' }] },
      ] as any[],
    };
    const xmiObj = serializableToXmiCompatible(minimal);
    const xml = serializeToXMI(xmiObj);
    expect(xml).toContain('name="Solo"');
    expect(xml).toContain('name="x"');
  });

  it('exports EClass without eAttributes (no crash)', () => {
    const minimal: SerializableEPackage = {
      name: 'minimal',
      nsURI: 'http://minimal.org/1.0',
      nsPrefix: 'min',
      eClassifiers: [
        { type: 'EClass', name: 'Empty' },
      ] as any[],
    };
    const xmiObj = serializableToXmiCompatible(minimal);
    const xml = serializeToXMI(xmiObj);
    expect(xml).toContain('name="Empty"');
  });
});

// ══════════════════════════════════════════════════════════════
//  16.2 — IMPORT + ROUNDTRIP
// ══════════════════════════════════════════════════════════════

describe('E2E: Import .ecore → roundtrip', () => {
  it('roundtrip: export → import → re-export produces equivalent XML', () => {
    // Export
    const xmiObj = serializableToXmiCompatible(LIBRARY_METAMODEL);
    const xml1 = serializeToXMI(xmiObj);

    // Import
    const imported = parseEcoreXmi(xml1);
    expect(imported).not.toBeNull();
    expect(imported!.name).toBe('library');
    expect(imported!.nsURI).toBe('http://library.example.org/1.0');

    // Re-export
    const xmiObj2 = serializableToXmiCompatible(imported!);
    const xml2 = serializeToXMI(xmiObj2);

    // Both should contain the same classifiers
    expect(xml2).toContain('name="Library"');
    expect(xml2).toContain('name="Book"');
    expect(xml2).toContain('name="Author"');
    expect(xml2).toContain('name="BookFormat"');
    expect(xml2).toContain('nsURI="http://library.example.org/1.0"');
  });

  it('import preserves EAttributes', () => {
    const xmiObj = serializableToXmiCompatible(LIBRARY_METAMODEL);
    const xml = serializeToXMI(xmiObj);
    const imported = parseEcoreXmi(xml);

    const book = imported!.eClassifiers.find((c: any) => c.name === 'Book') as any;
    expect(book).toBeDefined();
    const attrs = book.eAttributes || book.eStructuralFeatures?.filter((f: any) => f.eType?.includes?.('EDataType') || f.kind === 'attribute') || [];
    expect(attrs.length).toBeGreaterThanOrEqual(2);
  });

  it('import preserves EReferences', () => {
    const xmiObj = serializableToXmiCompatible(LIBRARY_METAMODEL);
    const xml = serializeToXMI(xmiObj);
    const imported = parseEcoreXmi(xml);

    const library = imported!.eClassifiers.find((c: any) => c.name === 'Library') as any;
    expect(library).toBeDefined();
    const refs = library.eReferences || library.eStructuralFeatures?.filter((f: any) => f.containment !== undefined || f.kind === 'reference') || [];
    expect(refs.length).toBeGreaterThanOrEqual(1);
  });

  it('import preserves EEnum literals', () => {
    const xmiObj = serializableToXmiCompatible(LIBRARY_METAMODEL);
    const xml = serializeToXMI(xmiObj);
    const imported = parseEcoreXmi(xml);

    const bookFormat = imported!.eClassifiers.find((c: any) => c.name === 'BookFormat') as any;
    expect(bookFormat).toBeDefined();
    expect(bookFormat.eLiterals).toBeDefined();
    expect(bookFormat.eLiterals.length).toBe(3);
    expect(bookFormat.eLiterals[0].name).toBe('PAPERBACK');
    expect(bookFormat.eLiterals[1].name).toBe('HARDCOVER');
    expect(bookFormat.eLiterals[2].name).toBe('EBOOK');
  });

  it('import handles Eclipse-generated .ecore XML', () => {
    const eclipseXml = `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmi:version="2.0" xmlns:xmi="http://www.omg.org/XMI"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore"
    name="university" nsURI="http://university.example.org/1.0" nsPrefix="uni">
  <eClassifiers xsi:type="ecore:EClass" name="University">
    <eStructuralFeatures xsi:type="ecore:EAttribute" name="name" eType="ecore:EDataType http://www.eclipse.org/emf/2002/Ecore#//EString"/>
    <eStructuralFeatures xsi:type="ecore:EReference" name="departments" upperBound="-1"
        eType="#//Department" containment="true"/>
  </eClassifiers>
  <eClassifiers xsi:type="ecore:EClass" name="Department">
    <eStructuralFeatures xsi:type="ecore:EAttribute" name="name" eType="ecore:EDataType http://www.eclipse.org/emf/2002/Ecore#//EString"/>
    <eStructuralFeatures xsi:type="ecore:EAttribute" name="budget" eType="ecore:EDataType http://www.eclipse.org/emf/2002/Ecore#//EDouble"/>
  </eClassifiers>
  <eClassifiers xsi:type="ecore:EEnum" name="Semester">
    <eLiterals name="FALL"/>
    <eLiterals name="SPRING" value="1"/>
    <eLiterals name="SUMMER" value="2"/>
  </eClassifiers>
</ecore:EPackage>`;

    const imported = parseEcoreXmi(eclipseXml);
    expect(imported).not.toBeNull();
    expect(imported!.name).toBe('university');
    expect(imported!.nsURI).toBe('http://university.example.org/1.0');
    expect(imported!.eClassifiers.length).toBe(3);

    // Re-export should produce valid XMI
    const xmiObj = serializableToXmiCompatible(imported!);
    const reExported = serializeToXMI(xmiObj);
    expect(reExported).toContain('name="University"');
    expect(reExported).toContain('name="Department"');
    expect(reExported).toContain('name="Semester"');
  });
});

// ══════════════════════════════════════════════════════════════
//  16.3 — OCL CONSTRAINTS IN EXPORT
// ══════════════════════════════════════════════════════════════

describe('E2E: OCL annotations in .ecore export', () => {
  it('embeds OCL constraints as EAnnotations', () => {
    const constraints = [
      { name: 'TitleNotEmpty', context: 'Book', expression: "self.title <> ''", severity: 'error' as const },
      { name: 'PagesPositive', context: 'Book', expression: 'self.pages > 0', severity: 'warning' as const },
    ];

    const exporter = new OCLAnnotationExporter();
    const pkgAnnotations = exporter.exportPackageAnnotations(constraints);

    expect(pkgAnnotations.length).toBeGreaterThan(0);
    // Should have validationDelegates
    const hasValidation = pkgAnnotations.some(a =>
      a.details && Object.keys(a.details).some(k => k.includes('validationDelegates'))
    );
    expect(hasValidation).toBe(true);
  });

  it('OCL class annotations contain constraint names', () => {
    const constraints = [
      { name: 'NameRequired', context: 'Author', expression: "self.name <> ''", severity: 'error' as const },
    ];

    const exporter = new OCLAnnotationExporter();
    const classAnnotations = exporter.exportClassAnnotations('Author', constraints);

    expect(classAnnotations.length).toBeGreaterThan(0);
    // Should reference the constraint name
    const hasConstraintRef = classAnnotations.some(a =>
      a.details && Object.values(a.details).some(v => v.includes('NameRequired'))
    );
    expect(hasConstraintRef).toBe(true);
  });

  it('multiple constraints on same class are grouped', () => {
    const constraints = [
      { name: 'C1', context: 'Book', expression: 'self.pages > 0', severity: 'error' as const },
      { name: 'C2', context: 'Book', expression: "self.title <> ''", severity: 'error' as const },
    ];

    const exporter = new OCLAnnotationExporter();
    const classAnnotations = exporter.exportClassAnnotations('Book', constraints);

    // Should have annotations for Book with both constraints
    expect(classAnnotations.length).toBeGreaterThan(0);
    const allDetails = classAnnotations.flatMap(a => Object.values(a.details || {}));
    const combined = allDetails.join(' ');
    expect(combined).toContain('C1');
    expect(combined).toContain('C2');
  });
});

// ══════════════════════════════════════════════════════════════
//  16.4 — PERFORMANCE: LARGE METAMODEL
// ══════════════════════════════════════════════════════════════

describe('E2E: Performance with large metamodel', () => {
  it('exports metamodel with 50+ classes in < 1s', () => {
    const classifiers: any[] = [];
    for (let i = 0; i < 60; i++) {
      classifiers.push({
        type: 'EClass',
        name: `Class${i}`,
        eAttributes: [
          { name: 'id', eType: 'EString' },
          { name: 'value', eType: 'EInt' },
          { name: `field${i}`, eType: 'EString' },
        ],
        eReferences: i > 0 ? [
          { name: 'parent', eType: `#//Class${i - 1}` },
        ] : [],
      });
    }

    const largeMM: SerializableEPackage = {
      name: 'large',
      nsURI: 'http://large.example.org/1.0',
      nsPrefix: 'large',
      eClassifiers: classifiers,
    };

    const start = performance.now();
    const xmiObj = serializableToXmiCompatible(largeMM);
    const xml = serializeToXMI(xmiObj);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(1000); // < 1 second
    expect(xml).toContain('name="Class0"');
    expect(xml).toContain('name="Class59"');
    expect(xml.length).toBeGreaterThan(5000);
  });

  it('imports large .ecore (100 classifiers) in < 3s', () => {
    // Generate a large .ecore XML
    let classifiersXml = '';
    for (let i = 0; i < 100; i++) {
      classifiersXml += `  <eClassifiers xsi:type="ecore:EClass" name="Entity${i}">
    <eStructuralFeatures xsi:type="ecore:EAttribute" name="id" eType="ecore:EDataType http://www.eclipse.org/emf/2002/Ecore#//EString"/>
    <eStructuralFeatures xsi:type="ecore:EAttribute" name="name" eType="ecore:EDataType http://www.eclipse.org/emf/2002/Ecore#//EString"/>
  </eClassifiers>\n`;
    }

    const largeXml = `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmi:version="2.0" xmlns:xmi="http://www.omg.org/XMI"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore"
    name="large" nsURI="http://large.example.org/1.0" nsPrefix="large">
${classifiersXml}</ecore:EPackage>`;

    const start = performance.now();
    const imported = parseEcoreXmi(largeXml);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(3000); // < 3 seconds
    expect(imported).not.toBeNull();
    expect(imported!.eClassifiers.length).toBe(100);
    expect(imported!.eClassifiers[0].name).toBe('Entity0');
    expect(imported!.eClassifiers[99].name).toBe('Entity99');
  });

  it('roundtrip large metamodel preserves all classifiers', () => {
    const classifiers: any[] = [];
    for (let i = 0; i < 30; i++) {
      classifiers.push({
        type: 'EClass',
        name: `Node${i}`,
        eAttributes: [{ name: 'label', eType: 'EString' }],
        eReferences: i > 0 ? [{ name: 'prev', eType: `#//Node${i - 1}` }] : [],
      });
    }
    classifiers.push({
      type: 'EEnum',
      name: 'Status',
      eLiterals: [
        { name: 'ACTIVE', value: 0 },
        { name: 'INACTIVE', value: 1 },
      ],
    });

    const mm: SerializableEPackage = {
      name: 'graph',
      nsURI: 'http://graph.example.org/1.0',
      nsPrefix: 'graph',
      eClassifiers: classifiers,
    };

    const xmiObj = serializableToXmiCompatible(mm);
    const xml = serializeToXMI(xmiObj);
    const imported = parseEcoreXmi(xml);

    expect(imported).not.toBeNull();
    expect(imported!.eClassifiers.length).toBe(31); // 30 classes + 1 enum
    expect(imported!.name).toBe('graph');
  });
});
