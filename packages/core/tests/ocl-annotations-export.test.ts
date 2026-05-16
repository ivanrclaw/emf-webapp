/**
 * @emf-webapp/core — OCLAnnotationExporter tests
 *
 * Tests for OCLAnnotationExporter and XMI OCL annotation serialization.
 */
import { describe, it, expect } from 'vitest';
import { OCLAnnotationExporter } from '../src/serialization/OCLAnnotationExporter.js';
import { serializeToXMI } from '../src/serialization/XMISerializer.js';
import { serializableToXmiCompatible } from '../src/serialization/SerializableToXmiObject.js';
import { parseEcoreXmi } from '../src/serialization/EcoreXmiParser.js';
import type { OCLConstraintInfo, EAnnotationData } from '../src/serialization/OCLAnnotationExporter.js';

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

let idCounter = 0;
function nextId(prefix = 'x'): string {
  return `${prefix}_${++idCounter}`;
}

// ═══════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════

describe('OCLAnnotationExporter', () => {
  const exporter = new OCLAnnotationExporter();

  describe('a) Package-level annotations', () => {
    it('should return annotations with all three OCL delegates', () => {
      // Create constraints for 2 classes with mixed types to trigger all delegates
      const constraints: OCLConstraintInfo[] = [
        {
          name: 'nameNotEmpty',
          context: 'Person',
          expression: 'self.name.size() > 0',
          // No type → invariant → validationDelegates
        },
        {
          name: 'agePositive',
          context: 'Person',
          expression: 'self.age > 0',
          // No type → invariant → validationDelegates
        },
        {
          name: 'calcBody',
          context: 'Calculator',
          expression: 'self.x + self.y',
          type: 'body', // → invocationDelegates
        },
        {
          name: 'deriveField',
          context: 'Person',
          expression: 'self.firstName.concat(" ").concat(self.lastName)',
          type: 'derive', // → settingDelegates
        },
      ];

      const result = exporter.exportPackageAnnotations(constraints);

      expect(result).toHaveLength(1);
      expect(result[0].source).toBe('http://www.eclipse.org/emf/2002/Ecore');
      expect(result[0].details).toBeDefined();
      expect(result[0].details['invocationDelegates']).toBe(
        'http://www.eclipse.org/emf/2002/Ecore/OCL/Pivot'
      );
      expect(result[0].details['settingDelegates']).toBe(
        'http://www.eclipse.org/emf/2002/Ecore/OCL/Pivot'
      );
      expect(result[0].details['validationDelegates']).toBe(
        'http://www.eclipse.org/emf/2002/Ecore/OCL/Pivot'
      );
    });

    it('should return empty array for empty constraints', () => {
      const result = exporter.exportPackageAnnotations([]);
      expect(result).toEqual([]);
    });
  });

  describe('b) Class-level constraint annotations', () => {
    it('should export 2 annotations for Person with 2 invariants', () => {
      const constraints: OCLConstraintInfo[] = [
        {
          name: 'nameNotEmpty',
          context: 'Person',
          expression: 'self.name.size() > 0',
        },
        {
          name: 'agePositive',
          context: 'Person',
          expression: 'self.age > 0',
        },
        {
          name: 'otherConstraint',
          context: 'Address',
          expression: 'self.street.size() > 0',
        },
      ];

      const result = exporter.exportClassAnnotations('Person', constraints);

      expect(result).toHaveLength(2);

      // First annotation: Ecore constraints list
      const ecoreAnn = result.find(
        (a) => a.source === 'http://www.eclipse.org/emf/2002/Ecore'
      );
      expect(ecoreAnn).toBeDefined();
      expect(ecoreAnn!.details.constraints).toBe('nameNotEmpty agePositive');

      // Second annotation: OCL/Pivot with constraint bodies
      const oclAnn = result.find(
        (a) => a.source === 'http://www.eclipse.org/emf/2002/Ecore/OCL/Pivot'
      );
      expect(oclAnn).toBeDefined();
      expect(oclAnn!.details.nameNotEmpty).toBe('self.name.size() > 0');
      expect(oclAnn!.details.agePositive).toBe('self.age > 0');
    });

    it('should return empty array for class with no constraints', () => {
      const result = exporter.exportClassAnnotations('NonExistent', []);
      expect(result).toEqual([]);
    });
  });

  describe('c) Operation body annotation', () => {
    it('should export an OCL/Pivot annotation with body detail', () => {
      const result = exporter.exportOperationAnnotation(
        'self.firstName.concat(" ").concat(self.lastName)'
      );

      expect(result.source).toBe('http://www.eclipse.org/emf/2002/Ecore/OCL/Pivot');
      expect(result.details.body).toBe(
        'self.firstName.concat(" ").concat(self.lastName)'
      );
    });
  });

  describe('d) Full integration with XMI serialization', () => {
    it('should produce XMI with OCL annotations that survive round-trip', () => {
      const exporter = new OCLAnnotationExporter();

      // Create package-level annotations
      const constraints: OCLConstraintInfo[] = [
        {
          name: 'nameNotEmpty',
          context: 'Person',
          expression: 'self.name.size() > 0',
        },
        {
          name: 'agePositive',
          context: 'Person',
          expression: 'self.age > 0',
        },
      ];
      const pkgAnnotations = exporter.exportPackageAnnotations(constraints);

      // Create class-level annotations for Person
      const classAnnotations = exporter.exportClassAnnotations('Person', constraints);

      // Build a full SerializableEPackage with OCL annotations
      const pkg: any = {
        name: 'OCLTest',
        nsURI: 'http://ocltest/1.0',
        nsPrefix: 'ocl',
        annotations: pkgAnnotations,
        eClassifiers: [
          {
            id: nextId('ec'),
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
            eReferences: [],
            annotations: classAnnotations,
          },
        ],
      };

      // Round-trip through XMI
      const xmiObj = serializableToXmiCompatible(pkg);
      const xmi = serializeToXMI(xmiObj);

      // Verify XMI contains OCL annotation elements
      expect(xmi).toContain('source="http://www.eclipse.org/emf/2002/Ecore"');
      expect(xmi).toContain('<details key="constraints"');

      // Parse back and verify annotations survived
      const result = parseEcoreXmi(xmi) as any;

      // Check package-level annotations
      expect(result.annotations).toBeDefined();
      expect(result.annotations.length).toBeGreaterThanOrEqual(1);
      const pkgAnn = result.annotations[0];
      expect(pkgAnn.source).toBe('http://www.eclipse.org/emf/2002/Ecore');

      // Check class-level annotations on Person
      const person = result.eClassifiers.find((c: any) => c.name === 'Person');
      expect(person).toBeDefined();
      expect(person.annotations).toBeDefined();
      expect(person.annotations.length).toBeGreaterThanOrEqual(1);

      // Verify constraint names survived
      const ecoreAnn = person.annotations.find(
        (a: any) => a.source === 'http://www.eclipse.org/emf/2002/Ecore'
      );
      if (ecoreAnn) {
        expect(ecoreAnn.details.constraints).toBeDefined();
        expect(ecoreAnn.details.constraints).toContain('nameNotEmpty');
        expect(ecoreAnn.details.constraints).toContain('agePositive');
      }

      // Verify OCL expressions survived
      const oclAnn = person.annotations.find(
        (a: any) => a.source === 'http://www.eclipse.org/emf/2002/Ecore/OCL/Pivot'
      );
      if (oclAnn) {
        expect(oclAnn.details.nameNotEmpty).toBe('self.name.size() > 0');
        expect(oclAnn.details.agePositive).toBe('self.age > 0');
      }
    });
  });
});
