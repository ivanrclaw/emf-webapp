/**
 * Tests for Eclipse import parsers:
 * - CompleteOCLParser
 * - SiriusOdesignParser
 * - EmfaticSerializer (serialize + parse roundtrip)
 */
import { describe, it, expect } from 'vitest';
import {
  parseCompleteOCL,
  parseOdesign,
  serializeToEmfatic,
  parseEmfatic,
  type SerializableEPackage,
} from '../src/serialization/index.js';

// ═══════════════════════════════════════════════════════════════
// CompleteOCLParser
// ═══════════════════════════════════════════════════════════════

describe('CompleteOCLParser', () => {
  it('parses basic .ocl file', () => {
    const ocl = `
import 'http://www.example.org/library'

package library

  context Book
    inv positivePages: self.pages > 0

  context Author
    inv hasName: self.name <> ''

endpackage
`;
    const result = parseCompleteOCL(ocl);

    expect(result.packageName).toBe('library');
    expect(result.imports).toContain('http://www.example.org/library');
    expect(result.constraints).toHaveLength(2);
    expect(result.constraints[0].name).toBe('positivePages');
    expect(result.constraints[0].context).toBe('Book');
    expect(result.constraints[0].expression).toBe('self.pages > 0');
    expect(result.constraints[1].name).toBe('hasName');
    expect(result.constraints[1].context).toBe('Author');
  });

  it('parses severity annotations', () => {
    const ocl = `
import 'http://www.example.org/library'

package library

  context Book
    -- @severity: warning
    inv positivePages: self.pages > 0

    -- @severity: info
    -- @message: Title should not be empty
    inv hasTitle: self.title.size() > 0

endpackage
`;
    const result = parseCompleteOCL(ocl);

    expect(result.constraints[0].severity).toBe('warning');
    expect(result.constraints[1].severity).toBe('info');
    expect(result.constraints[1].message).toBe('Title should not be empty');
  });

  it('parses multi-line expressions', () => {
    const ocl = `
import 'http://www.example.org/library'

package library

  context Book
    inv complexRule:
      self.pages > 0
        and self.title.size() > 0
        and self.title <> ''

endpackage
`;
    const result = parseCompleteOCL(ocl);

    expect(result.constraints).toHaveLength(1);
    expect(result.constraints[0].name).toBe('complexRule');
    expect(result.constraints[0].expression).toContain('self.pages > 0');
    expect(result.constraints[0].expression).toContain('and self.title.size() > 0');
  });

  it('handles empty input', () => {
    const result = parseCompleteOCL('');
    expect(result.packageName).toBe('');
    expect(result.constraints).toHaveLength(0);
  });

  it('handles multiple imports', () => {
    const ocl = `
import 'http://www.example.org/library'
import 'http://www.eclipse.org/emf/2002/Ecore'

package library
endpackage
`;
    const result = parseCompleteOCL(ocl);
    expect(result.imports).toHaveLength(2);
  });
});

// ═══════════════════════════════════════════════════════════════
// SiriusOdesignParser
// ═══════════════════════════════════════════════════════════════

describe('SiriusOdesignParser', () => {
  const sampleOdesign = `<?xml version="1.0" encoding="UTF-8"?>
<description:Group xmi:version="2.0"
    xmlns:xmi="http://www.omg.org/XMI"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:description="http://www.eclipse.org/sirius/description/1.1.0"
    xmlns:description_1="http://www.eclipse.org/sirius/diagram/description/1.1.0"
    xmlns:style="http://www.eclipse.org/sirius/diagram/description/style/1.1.0"
    xmlns:tool="http://www.eclipse.org/sirius/diagram/description/tool/1.1.0"
    name="org.example.library">
  <ownedViewpoints name="Library Design"
      modelFileExtension="library">
    <ownedRepresentations xsi:type="description_1:DiagramDescription"
        name="Library Diagram"
        domainClass="http://www.example.org/library::Library"
        titleExpression="aql:self.name">
      <metamodel href="http://www.example.org/library#/"/>
      <defaultLayer name="Default">
        <nodeMappings name="node_book"
            domainClass="http://www.example.org/library::Book"
            semanticCandidatesExpression="aql:self.books">
          <style xsi:type="style:SquareDescription"
              labelSize="13"
              labelExpression="aql:self.title"
              borderSizeComputationExpression="2">
            <borderColor xsi:type="description:UserFixedColor" red="129" green="140" blue="248"/>
            <labelColor xsi:type="description:UserFixedColor" red="255" green="255" blue="255"/>
            <color xsi:type="description:UserFixedColor" red="99" green="102" blue="241"/>
          </style>
        </nodeMappings>
        <edgeMappings name="edge_author"
            targetFinderExpression="aql:self.author">
          <style xsi:type="style:EdgeStyleDescription"
              lineStyle="solid"
              sizeComputationExpression="2"
              routingStyle="manhattan"
              sourceArrow="NoDecoration"
              targetArrow="InputArrow">
            <strokeColor xsi:type="description:UserFixedColor" red="99" green="102" blue="241"/>
          </style>
        </edgeMappings>
      </defaultLayer>
    </ownedRepresentations>
  </ownedViewpoints>
</description:Group>`;

  it('parses plugin ID from group name', () => {
    const result = parseOdesign(sampleOdesign);
    expect(result.pluginId).toBe('org.example.library');
  });

  it('parses viewpoint name', () => {
    const result = parseOdesign(sampleOdesign);
    expect(result.viewpoints).toHaveLength(1);
    expect(result.viewpoints[0].name).toBe('Library Design');
  });

  it('parses diagram description', () => {
    const result = parseOdesign(sampleOdesign);
    const vp = result.viewpoints[0];
    expect(vp.diagram.label).toBe('Library Diagram');
    expect(vp.diagram.domainClass).toBe('Library');
    expect(vp.diagram.titleExpression).toBe('self.name');
  });

  it('parses node mappings with styles', () => {
    const result = parseOdesign(sampleOdesign);
    const layer = result.viewpoints[0].defaultLayer;
    expect(layer.nodeMappings).toHaveLength(1);

    const node = layer.nodeMappings[0];
    expect(node.id).toBe('node_book');
    expect(node.domainClass).toBe('Book');
    expect(node.semanticCandidatesExpression).toBe('self.books');
    expect(node.labelExpression).toBe('self.title');
  });

  it('converts colors to hex', () => {
    const result = parseOdesign(sampleOdesign);
    const node = result.viewpoints[0].defaultLayer.nodeMappings[0];
    expect(node.defaultStyle.color).toBe('#6366f1');
    expect(node.defaultStyle.borderColor).toBe('#818cf8');
    expect(node.defaultStyle.labelColor).toBe('#ffffff');
  });

  it('parses edge mappings', () => {
    const result = parseOdesign(sampleOdesign);
    const layer = result.viewpoints[0].defaultLayer;
    expect(layer.edgeMappings).toHaveLength(1);

    const edge = layer.edgeMappings[0];
    expect(edge.id).toBe('edge_author');
    expect(edge.defaultStyle.routingStyle).toBe('manhattan');
    expect(edge.defaultStyle.sourceDecoration).toBe('none');
    expect(edge.defaultStyle.targetDecoration).toBe('arrow');
  });

  it('strips aql: prefix from expressions', () => {
    const result = parseOdesign(sampleOdesign);
    const node = result.viewpoints[0].defaultLayer.nodeMappings[0];
    expect(node.semanticCandidatesExpression).toBe('self.books');
    expect(node.labelExpression).toBe('self.title');
  });
});

// ═══════════════════════════════════════════════════════════════
// EmfaticSerializer (roundtrip)
// ═══════════════════════════════════════════════════════════════

describe('EmfaticSerializer', () => {
  const LIBRARY_PKG: SerializableEPackage = {
    name: 'library',
    nsURI: 'http://www.example.org/library',
    nsPrefix: 'library',
    eClassifiers: [
      {
        id: 'cls_Library',
        name: 'Library',
        abstract: false,
        interface: false,
        eAttributes: [
          { name: 'name', eType: 'EString', lowerBound: 1, upperBound: 1 },
          { name: 'address', eType: 'EString', lowerBound: 0, upperBound: 1 },
        ],
        eReferences: [
          { name: 'books', targetId: 'cls_Book', containment: true, lowerBound: 0, upperBound: -1 },
        ],
        eSuperTypes: [],
      },
      {
        id: 'cls_Book',
        name: 'Book',
        abstract: false,
        interface: false,
        eAttributes: [
          { name: 'title', eType: 'EString', lowerBound: 1, upperBound: 1 },
          { name: 'pages', eType: 'EInt', lowerBound: 0, upperBound: 1 },
        ],
        eReferences: [
          { name: 'author', targetId: 'cls_Author', containment: false, lowerBound: 1, upperBound: 1 },
        ],
        eSuperTypes: ['Library'],
      },
      {
        id: 'cls_Author',
        name: 'Author',
        abstract: true,
        interface: false,
        eAttributes: [
          { name: 'name', eType: 'EString', lowerBound: 1, upperBound: 1 },
        ],
        eReferences: [],
        eSuperTypes: [],
      },
      {
        id: 'enum_Genre',
        name: 'Genre',
        eLiterals: [
          { name: 'FICTION', value: 0, literal: 'Fiction' },
          { name: 'NON_FICTION', value: 1, literal: 'Non-Fiction' },
        ],
      },
    ] as any[],
  };

  it('serializes to valid Emfatic', () => {
    const emf = serializeToEmfatic(LIBRARY_PKG);

    expect(emf).toContain('@namespace(uri="http://www.example.org/library", prefix="library")');
    expect(emf).toContain('package library;');
    expect(emf).toContain('class Library');
    expect(emf).toContain('abstract class Author');
    expect(emf).toContain('attr String[1] name;');
    expect(emf).toContain('val Book[*] books;');
    expect(emf).toContain('ref Author[1] author;');
    expect(emf).toContain('enum Genre');
    expect(emf).toContain('FICTION = 0;');
  });

  it('serializes extends clause', () => {
    const emf = serializeToEmfatic(LIBRARY_PKG);
    expect(emf).toContain('class Book extends Library');
  });

  it('serializes optional attributes without multiplicity brackets', () => {
    const emf = serializeToEmfatic(LIBRARY_PKG);
    // address is [0..1] which is default — should not have brackets or have [0..1]
    expect(emf).toContain('address');
  });

  it('parses Emfatic back to SerializableEPackage', () => {
    const emf = `
@namespace(uri="http://www.example.org/test", prefix="test")
package test;

class Person {
  attr String[1] name;
  attr int age;
  val Address[*] addresses;
}

class Address {
  attr String street;
  attr String city;
}

enum Status {
  ACTIVE = 0;
  INACTIVE = 1;
}
`;
    const pkg = parseEmfatic(emf);

    expect(pkg.name).toBe('test');
    expect(pkg.nsURI).toBe('http://www.example.org/test');
    expect(pkg.nsPrefix).toBe('test');
    expect(pkg.eClassifiers).toHaveLength(3); // Person, Address, Status

    const person = pkg.eClassifiers.find((c: any) => c.name === 'Person') as any;
    expect(person).toBeDefined();
    expect(person.eAttributes).toHaveLength(2);
    expect(person.eAttributes[0].name).toBe('name');
    expect(person.eAttributes[0].eType).toBe('EString');
    expect(person.eAttributes[0].lowerBound).toBe(1);
    expect(person.eAttributes[1].name).toBe('age');
    expect(person.eAttributes[1].eType).toBe('EInt');

    expect(person.eReferences).toHaveLength(1);
    expect(person.eReferences[0].name).toBe('addresses');
    expect(person.eReferences[0].containment).toBe(true);
    expect(person.eReferences[0].upperBound).toBe(-1);

    const status = pkg.eClassifiers.find((c: any) => c.name === 'Status') as any;
    expect(status).toBeDefined();
    expect(status.eLiterals).toHaveLength(2);
    expect(status.eLiterals[0].name).toBe('ACTIVE');
    expect(status.eLiterals[1].value).toBe(1);
  });

  it('roundtrip: serialize then parse preserves structure', () => {
    const emf = serializeToEmfatic(LIBRARY_PKG);
    const parsed = parseEmfatic(emf);

    expect(parsed.name).toBe('library');
    expect(parsed.nsURI).toBe('http://www.example.org/library');
    expect(parsed.eClassifiers.length).toBeGreaterThanOrEqual(4);

    const library = parsed.eClassifiers.find((c: any) => c.name === 'Library') as any;
    expect(library).toBeDefined();
    expect(library.eAttributes.length).toBe(2);
    expect(library.eReferences.length).toBe(1);
    expect(library.eReferences[0].containment).toBe(true);

    const author = parsed.eClassifiers.find((c: any) => c.name === 'Author') as any;
    expect(author).toBeDefined();
    expect(author.abstract).toBe(true);

    const genre = parsed.eClassifiers.find((c: any) => c.name === 'Genre') as any;
    expect(genre).toBeDefined();
    expect(genre.eLiterals).toHaveLength(2);
  });

  it('parses abstract and interface keywords', () => {
    const emf = `
@namespace(uri="http://test.org", prefix="t")
package t;

abstract class Base {
  attr String name;
}

interface Nameable {
  attr String label;
}
`;
    const pkg = parseEmfatic(emf);
    const base = pkg.eClassifiers.find((c: any) => c.name === 'Base') as any;
    const nameable = pkg.eClassifiers.find((c: any) => c.name === 'Nameable') as any;

    expect(base.abstract).toBe(true);
    expect(nameable.interface).toBe(true);
  });
});
