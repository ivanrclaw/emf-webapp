/**
 * Tests for Eclipse compatibility exporters:
 * - GenmodelGenerator
 * - CompleteOCLExporter
 * - EclipseProjectGenerator
 * - SiriusOdesignGenerator
 * - SiriusAirdGenerator
 * - EuGENiaAnnotationGenerator
 * - AcceleoMtlGenerator
 */
import { describe, it, expect } from 'vitest';
import {
  generateGenmodel,
  generateCompleteOCL,
  generateInlineOCLAnnotations,
  generateOCLDelegationAnnotations,
  generateEclipseProjectFiles,
  generateOdesign,
  generateAird,
  generateEuGENiaAnnotations,
  viewpointSpecToEuGENia,
  serializeEuGENiaAnnotationXml,
  generateAcceleoModule,
  generateAcceleoSingleTemplate,
} from '../src/serialization/index.js';
import type {
  SerializableEPackage,
  OCLConstraintInput,
  OdesignViewpointSpec,
  EuGENiaSpec,
  CodeTemplateInput,
} from '../src/serialization/index.js';

// ═══════════════════════════════════════════════════════════════
// Test fixtures
// ═══════════════════════════════════════════════════════════════

const LIBRARY_PACKAGE: SerializableEPackage = {
  name: 'library',
  nsURI: 'http://www.example.org/library',
  nsPrefix: 'library',
  eClassifiers: [
    {
      id: 'cls_library',
      name: 'Library',
      abstract: false,
      interface: false,
      eAttributes: [
        { name: 'name', eType: 'EString', lowerBound: 1, upperBound: 1 },
        { name: 'address', eType: 'EString', lowerBound: 0, upperBound: 1 },
      ],
      eReferences: [
        { name: 'books', targetId: 'cls_book', containment: true, lowerBound: 0, upperBound: -1 },
        { name: 'authors', targetId: 'cls_author', containment: true, lowerBound: 0, upperBound: -1 },
      ],
      eSuperTypes: [],
    },
    {
      id: 'cls_book',
      name: 'Book',
      abstract: false,
      interface: false,
      eAttributes: [
        { name: 'title', eType: 'EString', lowerBound: 1, upperBound: 1 },
        { name: 'pages', eType: 'EInt', lowerBound: 0, upperBound: 1 },
        { name: 'isbn', eType: 'EString', lowerBound: 0, upperBound: 1, iD: true },
      ],
      eReferences: [
        { name: 'author', targetId: 'cls_author', containment: false, lowerBound: 1, upperBound: 1 },
      ],
      eSuperTypes: [],
    },
    {
      id: 'cls_author',
      name: 'Author',
      abstract: false,
      interface: false,
      eAttributes: [
        { name: 'name', eType: 'EString', lowerBound: 1, upperBound: 1 },
      ],
      eReferences: [
        { name: 'books', targetId: 'cls_book', containment: false, lowerBound: 0, upperBound: -1 },
      ],
      eSuperTypes: [],
    },
    {
      id: 'enum_genre',
      name: 'Genre',
      eLiterals: [
        { name: 'FICTION', value: 0, literal: 'Fiction' },
        { name: 'NON_FICTION', value: 1, literal: 'Non-Fiction' },
        { name: 'SCIENCE', value: 2, literal: 'Science' },
      ],
    },
  ] as any[],
};

// ═══════════════════════════════════════════════════════════════
// GenmodelGenerator
// ═══════════════════════════════════════════════════════════════

describe('GenmodelGenerator', () => {
  it('generates valid .genmodel XML', () => {
    const result = generateGenmodel(LIBRARY_PACKAGE, {
      ecoreFilePath: 'library.ecore',
      basePackage: 'org.example',
      modelPluginID: 'org.example.library',
    });

    expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(result).toContain('xmlns:genmodel="http://www.eclipse.org/emf/2002/GenModel"');
    expect(result).toContain('modelPluginID="org.example.library"');
    expect(result).toContain('modelName="Library"');
    expect(result).toContain('foreignModel>library.ecore</foreignModel>');
    expect(result).toContain('ecorePackage="library.ecore#/"');
  });

  it('generates genClasses for each EClass', () => {
    const result = generateGenmodel(LIBRARY_PACKAGE, {
      ecoreFilePath: 'library.ecore',
    });

    expect(result).toContain('ecoreClass="library.ecore#//Library"');
    expect(result).toContain('ecoreClass="library.ecore#//Book"');
    expect(result).toContain('ecoreClass="library.ecore#//Author"');
  });

  it('generates genFeatures for attributes and references', () => {
    const result = generateGenmodel(LIBRARY_PACKAGE, {
      ecoreFilePath: 'library.ecore',
    });

    expect(result).toContain('ecore:EAttribute library.ecore#//Book/title');
    expect(result).toContain('ecore:EReference library.ecore#//Library/books');
    expect(result).toContain('createChild="true"'); // containment ref
    expect(result).toContain('createChild="false"'); // attribute
  });

  it('generates genEnums with literals', () => {
    const result = generateGenmodel(LIBRARY_PACKAGE, {
      ecoreFilePath: 'library.ecore',
    });

    expect(result).toContain('genEnums');
    expect(result).toContain('#//Genre');
    expect(result).toContain('#//Genre/FICTION');
    expect(result).toContain('#//Genre/NON_FICTION');
  });

  it('sets compliance level and importer', () => {
    const result = generateGenmodel(LIBRARY_PACKAGE, {
      ecoreFilePath: 'library.ecore',
      complianceLevel: '17.0',
      importerID: 'org.eclipse.emf.importer.ecore',
    });

    expect(result).toContain('complianceLevel="17.0"');
    expect(result).toContain('importerID="org.eclipse.emf.importer.ecore"');
  });
});

// ═══════════════════════════════════════════════════════════════
// CompleteOCLExporter
// ═══════════════════════════════════════════════════════════════

describe('CompleteOCLExporter', () => {
  const constraints: OCLConstraintInput[] = [
    { name: 'positivePages', context: 'Book', expression: 'self.pages > 0', severity: 'error' },
    { name: 'hasTitle', context: 'Book', expression: 'self.title.size() > 0', severity: 'warning' },
    { name: 'hasName', context: 'Author', expression: 'self.name <> \'\'', severity: 'error' },
  ];

  it('generates valid Complete OCL document', () => {
    const result = generateCompleteOCL(constraints, {
      packageName: 'library',
      nsURI: 'http://www.example.org/library',
    });

    expect(result).toContain("import 'http://www.example.org/library'");
    expect(result).toContain('package library');
    expect(result).toContain('endpackage');
  });

  it('groups constraints by context', () => {
    const result = generateCompleteOCL(constraints, {
      packageName: 'library',
      nsURI: 'http://www.example.org/library',
    });

    expect(result).toContain('context Book');
    expect(result).toContain('context Author');
    expect(result).toContain('inv positivePages: self.pages > 0');
    expect(result).toContain('inv hasTitle: self.title.size() > 0');
    expect(result).toContain("inv hasName: self.name <> ''");
  });

  it('adds severity annotations for non-error constraints', () => {
    const result = generateCompleteOCL(constraints, {
      packageName: 'library',
      nsURI: 'http://www.example.org/library',
    });

    expect(result).toContain('-- @severity: warning');
    // error severity should NOT have annotation
    const lines = result.split('\n');
    const positivePageIdx = lines.findIndex(l => l.includes('inv positivePages'));
    expect(lines[positivePageIdx - 1]).not.toContain('@severity');
  });

  it('includes header comment', () => {
    const result = generateCompleteOCL(constraints, {
      packageName: 'library',
      nsURI: 'http://www.example.org/library',
      headerComment: 'Generated by emf-webapp',
    });

    expect(result).toContain('-- Generated by emf-webapp');
  });

  it('generates inline OCL annotations', () => {
    const annotations = generateInlineOCLAnnotations(constraints);

    expect(annotations).toHaveLength(2); // Book and Author contexts
    const bookAnn = annotations.find(a => a.context === 'Book');
    expect(bookAnn).toBeDefined();
    expect(bookAnn!.constraintNames).toBe('positivePages hasTitle');
    expect(bookAnn!.constraintBodies['positivePages']).toBe('self.pages > 0');
  });

  it('generates OCL delegation annotations', () => {
    const delegations = generateOCLDelegationAnnotations();

    expect(delegations).toHaveLength(1);
    expect(delegations[0].source).toBe('http://www.eclipse.org/emf/2002/Ecore');
    expect(delegations[0].details.validationDelegates).toContain('OCL/Pivot');
  });
});

// ═══════════════════════════════════════════════════════════════
// EclipseProjectGenerator
// ═══════════════════════════════════════════════════════════════

describe('EclipseProjectGenerator', () => {
  it('generates all required files', () => {
    const files = generateEclipseProjectFiles({
      pluginId: 'org.example.library',
      projectName: 'Library Model',
      packageName: 'library',
      nsURI: 'http://www.example.org/library',
      nsPrefix: 'library',
    });

    expect(files['.project']).toBeDefined();
    expect(files['.classpath']).toBeDefined();
    expect(files['META-INF/MANIFEST.MF']).toBeDefined();
    expect(files['plugin.xml']).toBeDefined();
    expect(files['build.properties']).toBeDefined();
  });

  it('.project has correct natures and builders', () => {
    const files = generateEclipseProjectFiles({
      pluginId: 'org.example.library',
      projectName: 'Library',
      packageName: 'library',
      nsURI: 'http://www.example.org/library',
      nsPrefix: 'library',
      hasSirius: true,
    });

    expect(files['.project']).toContain('org.eclipse.jdt.core.javanature');
    expect(files['.project']).toContain('org.eclipse.pde.PluginNature');
    expect(files['.project']).toContain('org.eclipse.sirius.nature.modelingproject');
    expect(files['.project']).toContain('org.eclipse.jdt.core.javabuilder');
  });

  it('MANIFEST.MF has correct bundle info', () => {
    const files = generateEclipseProjectFiles({
      pluginId: 'org.example.library',
      projectName: 'Library',
      packageName: 'library',
      nsURI: 'http://www.example.org/library',
      nsPrefix: 'library',
      hasOCL: true,
    });

    expect(files['META-INF/MANIFEST.MF']).toContain('Bundle-SymbolicName: org.example.library;singleton:=true');
    expect(files['META-INF/MANIFEST.MF']).toContain('org.eclipse.emf.ecore;visibility:=reexport');
    expect(files['META-INF/MANIFEST.MF']).toContain('org.eclipse.ocl.pivot');
  });

  it('plugin.xml registers EPackage', () => {
    const files = generateEclipseProjectFiles({
      pluginId: 'org.example.library',
      projectName: 'Library',
      packageName: 'library',
      nsURI: 'http://www.example.org/library',
      nsPrefix: 'library',
    });

    expect(files['plugin.xml']).toContain('org.eclipse.emf.ecore.generated_package');
    expect(files['plugin.xml']).toContain('uri="http://www.example.org/library"');
    expect(files['plugin.xml']).toContain('LibraryPackage');
  });

  it('build.properties includes model/ and description/ for Sirius', () => {
    const files = generateEclipseProjectFiles({
      pluginId: 'org.example.library',
      projectName: 'Library',
      packageName: 'library',
      nsURI: 'http://www.example.org/library',
      nsPrefix: 'library',
      hasSirius: true,
    });

    expect(files['build.properties']).toContain('model/');
    expect(files['build.properties']).toContain('description/');
  });
});

// ═══════════════════════════════════════════════════════════════
// SiriusOdesignGenerator
// ═══════════════════════════════════════════════════════════════

describe('SiriusOdesignGenerator', () => {
  const spec: OdesignViewpointSpec = {
    id: 'vsp_test',
    name: 'Library Design',
    metamodelNsURI: 'http://www.example.org/library',
    diagram: {
      id: 'diag_main',
      label: 'Library Diagram',
      domainClass: 'Library',
    },
    defaultLayer: {
      id: 'layer_default',
      name: 'Default',
      isDefault: true,
      activeByDefault: true,
      nodeMappings: [
        {
          id: 'node_book',
          domainClass: 'Book',
          semanticCandidatesExpression: 'self.books',
          labelExpression: 'self.title',
          defaultStyle: {
            shape: 'rectangle',
            color: '#6366f1',
            borderColor: '#818cf8',
            borderSize: 2,
            borderLineStyle: 'solid',
            labelExpression: 'self.title',
            labelColor: '#ffffff',
            labelSize: 13,
            labelPosition: 'inside',
            labelBold: false,
            labelItalic: false,
          },
        },
      ],
      containerMappings: [],
      edgeMappings: [
        {
          id: 'edge_author',
          type: 'relation-based',
          sourceMappingIds: ['node_book'],
          targetMappingIds: ['node_author'],
          targetFinderExpression: 'self.author',
          defaultStyle: {
            lineStyle: 'solid',
            lineWidth: 2,
            color: '#6366f1',
            sourceDecoration: 'none',
            targetDecoration: 'arrow',
            routingStyle: 'manhattan',
            labelColor: '#a1a1aa',
            labelSize: 11,
          },
        },
      ],
      toolSections: [],
    },
    additionalLayers: [],
  };

  it('generates valid .odesign XML', () => {
    const result = generateOdesign(spec, {
      pluginId: 'org.example.library',
      packageName: 'library',
      nsURI: 'http://www.example.org/library',
    });

    expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(result).toContain('xmlns:description="http://www.eclipse.org/sirius/description/1.1.0"');
    expect(result).toContain('xmlns:description_1="http://www.eclipse.org/sirius/diagram/description/1.1.0"');
  });

  it('contains viewpoint and diagram description', () => {
    const result = generateOdesign(spec, {
      pluginId: 'org.example.library',
      packageName: 'library',
      nsURI: 'http://www.example.org/library',
    });

    expect(result).toContain('ownedViewpoints name="Library Design"');
    expect(result).toContain('DiagramDescription');
    expect(result).toContain('Library Diagram');
    expect(result).toContain('http://www.example.org/library::Library');
  });

  it('contains node mappings with styles', () => {
    const result = generateOdesign(spec, {
      pluginId: 'org.example.library',
      packageName: 'library',
      nsURI: 'http://www.example.org/library',
    });

    expect(result).toContain('nodeMappings name="node_book"');
    expect(result).toContain('http://www.example.org/library::Book');
    expect(result).toContain('aql:self.books');
    expect(result).toContain('SquareDescription');
  });

  it('contains edge mappings', () => {
    const result = generateOdesign(spec, {
      pluginId: 'org.example.library',
      packageName: 'library',
      nsURI: 'http://www.example.org/library',
    });

    expect(result).toContain('edgeMappings');
    expect(result).toContain('aql:self.author');
    expect(result).toContain('EdgeStyleDescription');
    expect(result).toContain('targetArrow="InputArrow"');
  });

  it('converts expressions to AQL format', () => {
    const result = generateOdesign(spec, {
      pluginId: 'org.example.library',
      packageName: 'library',
      nsURI: 'http://www.example.org/library',
    });

    expect(result).toContain('aql:self.title');
    expect(result).toContain('aql:self.books');
  });
});

// ═══════════════════════════════════════════════════════════════
// SiriusAirdGenerator
// ═══════════════════════════════════════════════════════════════

describe('SiriusAirdGenerator', () => {
  it('generates valid .aird XML', () => {
    const result = generateAird({
      odesignPath: 'description/library.odesign',
      semanticModelPath: 'instances/example.xmi',
      ecorePath: 'model/library.ecore',
      viewpointName: 'Library Design',
      diagramName: 'Library Diagram',
    });

    expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(result).toContain('xmlns:viewpoint="http://www.eclipse.org/sirius/1.1.0"');
    expect(result).toContain('DAnalysis');
  });

  it('references semantic resources', () => {
    const result = generateAird({
      odesignPath: 'description/library.odesign',
      semanticModelPath: 'instances/example.xmi',
      ecorePath: 'model/library.ecore',
      viewpointName: 'Library Design',
      diagramName: 'Library Diagram',
    });

    expect(result).toContain('<semanticResources>instances/example.xmi</semanticResources>');
    expect(result).toContain('<semanticResources>model/library.ecore</semanticResources>');
  });

  it('references the .odesign viewpoint', () => {
    const result = generateAird({
      odesignPath: 'description/library.odesign',
      semanticModelPath: 'instances/example.xmi',
      ecorePath: 'model/library.ecore',
      viewpointName: 'Library Design',
      diagramName: 'Library Diagram',
    });

    expect(result).toContain('href="description/library.odesign#/Library Design"');
  });

  it('creates a representation descriptor', () => {
    const result = generateAird({
      odesignPath: 'description/library.odesign',
      semanticModelPath: 'instances/example.xmi',
      ecorePath: 'model/library.ecore',
      viewpointName: 'Library Design',
      diagramName: 'Library Diagram',
      representationName: 'My Library Diagram',
    });

    expect(result).toContain('DRepresentationDescriptor');
    expect(result).toContain('name="My Library Diagram"');
    expect(result).toContain('DSemanticDiagram');
  });
});

// ═══════════════════════════════════════════════════════════════
// EuGENiaAnnotationGenerator
// ═══════════════════════════════════════════════════════════════

describe('EuGENiaAnnotationGenerator', () => {
  it('generates gmf.diagram annotation for package', () => {
    const spec: EuGENiaSpec = {
      diagram: { name: 'library' },
      nodes: [],
      links: [],
      compartments: [],
    };

    const result = generateEuGENiaAnnotations(spec);
    const pkgAnnotations = result.get('__package__');
    expect(pkgAnnotations).toBeDefined();
    expect(pkgAnnotations![0].source).toBe('gmf.diagram');
  });

  it('generates gmf.node annotations', () => {
    const spec: EuGENiaSpec = {
      diagram: { name: 'library' },
      nodes: [
        {
          className: 'Book',
          label: 'title',
          figure: 'rectangle',
          color: '99,102,241',
          borderWidth: 2,
        },
      ],
      links: [],
      compartments: [],
    };

    const result = generateEuGENiaAnnotations(spec);
    const bookAnnotations = result.get('Book');
    expect(bookAnnotations).toBeDefined();
    expect(bookAnnotations![0].source).toBe('gmf.node');
    expect(bookAnnotations![0].details['label']).toBe('title');
    expect(bookAnnotations![0].details['figure']).toBe('rectangle');
    expect(bookAnnotations![0].details['color']).toBe('99,102,241');
  });

  it('generates gmf.link annotations', () => {
    const spec: EuGENiaSpec = {
      diagram: { name: 'library' },
      nodes: [],
      links: [
        {
          name: 'author',
          type: 'reference',
          style: 'solid',
          targetDecoration: 'arrow',
        },
      ],
      compartments: [],
    };

    const result = generateEuGENiaAnnotations(spec);
    const linkAnnotations = result.get('__ref__author');
    expect(linkAnnotations).toBeDefined();
    expect(linkAnnotations![0].source).toBe('gmf.link');
    expect(linkAnnotations![0].details['target.decoration']).toBe('arrow');
  });

  it('generates gmf.compartment annotations', () => {
    const spec: EuGENiaSpec = {
      diagram: { name: 'library' },
      nodes: [],
      links: [],
      compartments: [
        { className: 'Library', referenceName: 'books', layout: 'list' },
      ],
    };

    const result = generateEuGENiaAnnotations(spec);
    const compAnnotations = result.get('__ref__Library__books');
    expect(compAnnotations).toBeDefined();
    expect(compAnnotations![0].source).toBe('gmf.compartment');
    expect(compAnnotations![0].details['layout']).toBe('list');
  });

  it('serializes annotation to XML', () => {
    const xml = serializeEuGENiaAnnotationXml({
      source: 'gmf.node',
      details: { label: 'title', figure: 'rectangle' },
    }, '  ');

    expect(xml).toContain('<eAnnotations source="gmf.node">');
    expect(xml).toContain('<details key="label" value="title"/>');
    expect(xml).toContain('<details key="figure" value="rectangle"/>');
    expect(xml).toContain('</eAnnotations>');
  });

  it('viewpointSpecToEuGENia converts node mappings', () => {
    const result = viewpointSpecToEuGENia(
      LIBRARY_PACKAGE,
      [{ domainClass: 'Book', defaultStyle: { shape: 'rectangle', color: '#6366f1', borderColor: '#818cf8', borderSize: 2 } }],
      [],
      [],
    );

    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].className).toBe('Book');
    expect(result.nodes[0].color).toBe('99,102,241');
  });
});

// ═══════════════════════════════════════════════════════════════
// AcceleoMtlGenerator
// ═══════════════════════════════════════════════════════════════

describe('AcceleoMtlGenerator', () => {
  it('generates valid .mtl module', () => {
    const templates: CodeTemplateInput[] = [
      {
        name: 'generateClass',
        context: 'EClass',
        body: 'public class ${self.name} {\n}',
        outputFile: "self.name + '.java'",
        isMain: true,
      },
    ];

    const result = generateAcceleoModule(templates, {
      moduleName: 'generate',
      nsURI: 'http://www.example.org/library',
    });

    expect(result).toContain('[comment encoding = UTF-8 /]');
    expect(result).toContain("[module generate('http://www.example.org/library')/]");
  });

  it('converts template body expressions', () => {
    const templates: CodeTemplateInput[] = [
      {
        name: 'generateClass',
        context: 'EClass',
        body: 'public class ${self.name} {\n  // fields\n}',
        isMain: false,
      },
    ];

    const result = generateAcceleoModule(templates, {
      moduleName: 'generate',
      nsURI: 'http://www.example.org/library',
    });

    expect(result).toContain('[eClass.name/]');
    expect(result).toContain('[template public generateClass(eClass : EClass)]');
  });

  it('generates file output for main templates', () => {
    const templates: CodeTemplateInput[] = [
      {
        name: 'generateClass',
        context: 'EClass',
        body: 'class ${self.name} {}',
        outputFile: "self.name + '.java'",
        isMain: true,
      },
    ];

    const result = generateAcceleoModule(templates, {
      moduleName: 'generate',
      nsURI: 'http://www.example.org/library',
    });

    expect(result).toContain('[comment @main /]');
    expect(result).toContain("[file (eClass.name.concat('.java'), false, 'UTF-8')]");
    expect(result).toContain('[/file]');
  });

  it('includes module documentation', () => {
    const result = generateAcceleoModule([], {
      moduleName: 'generate',
      nsURI: 'http://www.example.org/library',
      description: 'Code generation for Library',
      author: 'emf-webapp',
    });

    expect(result).toContain('[**');
    expect(result).toContain(' * Code generation for Library');
    expect(result).toContain(' * @author emf-webapp');
    expect(result).toContain(' */]');
  });

  it('generateAcceleoSingleTemplate works', () => {
    const result = generateAcceleoSingleTemplate(
      {
        name: 'generateBean',
        context: 'Book',
        body: 'public class ${self.name}Bean {}',
      },
      { moduleName: 'generateBean', nsURI: 'http://www.example.org/library' },
    );

    expect(result).toContain("[module generateBean('http://www.example.org/library')/]");
    expect(result).toContain('[template public generateBean(book : Book)]');
  });
});
