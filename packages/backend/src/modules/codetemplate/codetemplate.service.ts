/**
 * @emf-webapp/backend — CodeTemplateService
 *
 * CRUD de plantillas MTL y ejecución de generadores (predefinidos y personalizados).
 *
 * Los 5 generadores predefinidos (HTML, SQL, TypeScript, JSON Schema, PlantUML)
 * producen salida directamente SIN usar el motor MTL.
 * El método `generate()` con plantillas personalizadas SÍ usa MTLParser + MTLExecutor.
 */
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CodeTemplate, TemplateLanguage } from './codetemplate.entity.js';
import { Metamodel } from '../metamodel/metamodel.entity.js';
import { MTLParser, MTLExecutor } from '@emf-webapp/core';
import type { MTLExecutionResult } from '@emf-webapp/core';

@Injectable()
export class CodeTemplateService {
  constructor(
    @InjectRepository(CodeTemplate)
    private readonly repo: Repository<CodeTemplate>,
    @InjectRepository(Metamodel)
    private readonly metamodelRepo: Repository<Metamodel>,
  ) {}

  // ================================================================
  // CRUD
  // ================================================================

  async findAll(mmid: string): Promise<CodeTemplate[]> {
    return this.repo.find({
      where: { metamodel_id: mmid },
      order: { name: 'ASC' },
    });
  }

  async findOne(mmid: string, id: string): Promise<CodeTemplate> {
    const template = await this.repo.findOne({
      where: { id, metamodel_id: mmid },
    });
    if (!template) {
      throw new NotFoundException(
        `CodeTemplate "${id}" not found in metamodel "${mmid}"`,
      );
    }
    return template;
  }

  async create(
    mmid: string,
    data: {
      name: string;
      description?: string;
      template: string;
      language?: TemplateLanguage;
      is_predefined?: boolean;
    },
  ): Promise<CodeTemplate> {
    const template = this.repo.create({
      metamodel_id: mmid,
      name: data.name,
      description: data.description ?? null,
      template: data.template,
      language: data.language || 'html',
      is_predefined: data.is_predefined ?? false,
    });
    return this.repo.save(template);
  }

  async update(
    mmid: string,
    id: string,
    data: {
      name?: string;
      description?: string;
      template?: string;
      language?: TemplateLanguage;
      is_predefined?: boolean;
    },
  ): Promise<CodeTemplate> {
    const template = await this.findOne(mmid, id);
    if (data.name !== undefined) template.name = data.name;
    if (data.description !== undefined) template.description = data.description;
    if (data.template !== undefined) template.template = data.template;
    if (data.language !== undefined) template.language = data.language;
    if (data.is_predefined !== undefined) template.is_predefined = data.is_predefined;
    return this.repo.save(template);
  }

  async remove(mmid: string, id: string): Promise<void> {
    const template = await this.findOne(mmid, id);
    await this.repo.remove(template);
  }

  // ================================================================
  // Custom template generation (uses MTL engine)
  // ================================================================

  /**
   * Execute a custom MTL template against a metamodel's content.
   *
   * 1. Loads the template entity from DB
   * 2. Loads the metamodel's content (EPackage/EClass hierarchy)
   * 3. Converts the content to a simplified model object for the MTL executor
   * 4. Parses the template with MTLParser.parse()
   * 5. Executes with MTLExecutor.execute()
   *
   * @returns Generated files array
   */
  async generate(
    mmid: string,
    templateId: string,
  ): Promise<{ files: Array<{ name: string; content: string }> }> {
    // 1. Load template
    const template = await this.findOne(mmid, templateId);

    // 2. Load metamodel content
    const metamodel = await this.metamodelRepo.findOne({
      where: { id: mmid },
    });
    if (!metamodel) {
      throw new NotFoundException(`Metamodel "${mmid}" not found`);
    }

    // 3. Convert metamodel content to a simplified model object
    const modelObject = this.buildModelFromMetamodel(metamodel);

    // 4. Parse the MTL template
    const ast = MTLParser.parse(template.template);
    if (ast.length === 0) {
      return { files: [] };
    }

    // 5. Execute the template against the model
    const executor = new MTLExecutor();
    const result: MTLExecutionResult = executor.execute(ast, modelObject as any);

    if (result.error) {
      throw new BadRequestException(`Template execution error: ${result.error}`);
    }

    return { files: result.files };
  }

  // ================================================================
  // Predefined generators (hardcoded, no MTL engine)
  // ================================================================

  /**
   * List the 5 predefined generator types available.
   * These are generated on-the-fly, not stored in DB.
   */
  getPredefinedTemplates(): Array<{
    type: string;
    name: string;
    description: string;
    language: TemplateLanguage;
  }> {
    return [
      {
        type: 'html',
        name: 'HTML Documentation',
        description: 'Generates HTML documentation of the metamodel classes, attributes, and references',
        language: 'html',
      },
      {
        type: 'sql',
        name: 'SQL DDL',
        description: 'Generates CREATE TABLE statements for each EClass',
        language: 'sql',
      },
      {
        type: 'typescript',
        name: 'TypeScript Interfaces',
        description: 'Generates TypeScript interfaces for each EClass',
        language: 'typescript',
      },
      {
        type: 'json-schema',
        name: 'JSON Schema',
        description: 'Generates JSON Schema from the metamodel',
        language: 'json-schema',
      },
      {
        type: 'plantuml',
        name: 'PlantUML Class Diagram',
        description: 'Generates PlantUML class diagram markup',
        language: 'plantuml',
      },
    ];
  }

  /**
   * Run a specific predefined generator by type.
   * These are hardcoded generators that produce output without MTL.
   */
  async runPredefined(
    mmid: string,
    type: string,
  ): Promise<{ files: Array<{ name: string; content: string }> }> {
    // Load metamodel content
    const metamodel = await this.metamodelRepo.findOne({
      where: { id: mmid },
    });
    if (!metamodel) {
      throw new NotFoundException(`Metamodel "${mmid}" not found`);
    }

    const metamodelContent = metamodel.content;

    switch (type) {
      case 'html':
        return { files: [{ name: `${metamodel.name}-docs.html`, content: this.generateHTML(metamodelContent) }] };
      case 'sql':
        return { files: [{ name: `${metamodel.name}-schema.sql`, content: this.generateSQL(metamodelContent) }] };
      case 'typescript':
        return { files: [{ name: `${metamodel.name}.types.ts`, content: this.generateTypeScript(metamodelContent) }] };
      case 'json-schema':
        return { files: [{ name: `${metamodel.name}.schema.json`, content: this.generateJSONSchema(metamodelContent) }] };
      case 'plantuml':
        return { files: [{ name: `${metamodel.name}.puml`, content: this.generatePlantUML(metamodelContent) }] };
      default:
        throw new BadRequestException(
          `Unknown predefined generator type "${type}". Valid types: html, sql, typescript, json-schema, plantuml`,
        );
    }
  }

  // ================================================================
  // Predefined generator implementations
  // ================================================================

  private generateHTML(content: Record<string, any>): string {
    const pkgName = content.name || 'UnnamedPackage';
    const classes = this.extractClasses(content);
    const lines: string[] = [];

    lines.push('<!DOCTYPE html>');
    lines.push('<html lang="en">');
    lines.push('<head><meta charset="UTF-8">');
    lines.push(`<title>${pkgName} — Metamodel Documentation</title>`);
    lines.push('<style>body{font-family:sans-serif;max-width:960px;margin:0 auto;padding:2em}');
    lines.push('h1{border-bottom:2px solid #333}');
    lines.push('.class{margin:1.5em 0;padding:1em;border:1px solid #ccc;border-radius:6px}');
    lines.push('.class h3{margin:0 0 0.5em}.feature{margin:0.25em 0;font-size:0.9em}');
    lines.push('.attr{color:#2a7}.ref{color:#27a}.type{font-style:italic;color:#666}');
    lines.push('</style></head><body>');
    lines.push(`<h1>${this.escapeHtml(pkgName)}</h1>`);

    if (content.nsURI) {
      lines.push(`<p><strong>NS URI:</strong> ${this.escapeHtml(content.nsURI)}</p>`);
    }
    if (content.nsPrefix) {
      lines.push(`<p><strong>NS Prefix:</strong> ${this.escapeHtml(content.nsPrefix)}</p>`);
    }

    lines.push(`<h2>Classes (${classes.length})</h2>`);

    for (const cls of classes) {
      const className = cls.name || 'Unnamed';
      lines.push('<div class="class">');
      lines.push(`<h3>${this.escapeHtml(className)}${cls.abstract ? ' <em>(abstract)</em>' : ''}</h3>`);

      // Super types
      if (cls.eSuperTypes && cls.eSuperTypes.length > 0) {
        lines.push(`<p><strong>extends:</strong> ${cls.eSuperTypes.map((s: string) => this.escapeHtml(s)).join(', ')}</p>`);
      }

      // Attributes
      const attrs = cls.eStructuralFeatures?.filter((f: any) => f.kind === 'attribute') || [];
      if (attrs.length > 0) {
        lines.push('<p><strong>Attributes:</strong></p>');
        for (const attr of attrs) {
          const cardinality = attr.many ? '[*]' : attr.required ? '[1]' : '[0..1]';
          lines.push(`<div class="feature attr">${this.escapeHtml(attr.name)}: ${this.escapeHtml(attr.type || 'string')} ${cardinality}</div>`);
        }
      }

      // References
      const refs = cls.eStructuralFeatures?.filter((f: any) => f.kind === 'reference') || [];
      if (refs.length > 0) {
        lines.push('<p><strong>References:</strong></p>');
        for (const ref of refs) {
          const cardinality = ref.many ? '[*]' : ref.required ? '[1]' : '[0..1]';
          const containment = ref.containment ? ' (containment)' : '';
          lines.push(`<div class="feature ref">${this.escapeHtml(ref.name)}: ${this.escapeHtml(ref.type || 'EObject')} ${cardinality}${containment}</div>`);
        }
      }

      lines.push('</div>');
    }

    lines.push('</body></html>');
    return lines.join('\n');
  }

  private generateSQL(content: Record<string, any>): string {
    const pkgName = content.name || 'UnnamedPackage';
    const classes = this.extractClasses(content);
    const lines: string[] = [];

    lines.push(`-- ============================================`);
    lines.push(`-- DDL for package: ${pkgName}`);
    lines.push(`-- Generated by emf-webapp code generator`);
    lines.push(`-- ============================================`);
    lines.push('');

    for (const cls of classes) {
      const tableName = this.toSnakeCase(cls.name || 'unnamed');
      lines.push(`-- Table: ${cls.name}`);
      lines.push(`CREATE TABLE ${tableName} (`);
      lines.push(`  id TEXT PRIMARY KEY,`);

      const attrs = cls.eStructuralFeatures?.filter((f: any) => f.kind === 'attribute') || [];
      const refs = cls.eStructuralFeatures?.filter((f: any) => f.kind === 'reference') || [];

      for (const attr of attrs) {
        const colName = this.toSnakeCase(attr.name || 'unnamed');
        const sqlType = this.toSQLType(attr.type || 'EString');
        const nullable = attr.required ? 'NOT NULL' : 'NULL';
        lines.push(`  ${colName} ${sqlType} ${nullable},`);
      }

      for (const ref of refs) {
        if (ref.containment) {
          const colName = this.toSnakeCase(ref.name || 'unnamed') + '_id';
          const refType = this.toSnakeCase(ref.type || '');
          lines.push(`  ${colName} TEXT REFERENCES ${refType}(id),`);
        } else {
          const colName = this.toSnakeCase(ref.name || 'unnamed') + '_id';
          const refType = this.toSnakeCase(ref.type || '');
          lines.push(`  ${colName} TEXT REFERENCES ${refType}(id),`);
        }
      }

      // Remove trailing comma and close
      if (lines[lines.length - 1].endsWith(',')) {
        lines[lines.length - 1] = lines[lines.length - 1].slice(0, -1);
      }

      lines.push(');');
      lines.push('');
    }

    // Junction tables for many-to-many
    for (const cls of classes) {
      const refs = cls.eStructuralFeatures?.filter((f: any) => f.kind === 'reference') || [];
      for (const ref of refs) {
        if (ref.many && !ref.containment) {
          const sourceTable = this.toSnakeCase(cls.name || 'unnamed');
          const targetTable = this.toSnakeCase(ref.type || '');
          const jtName = `${sourceTable}_${this.toSnakeCase(ref.name || 'ref')}`;
          lines.push(`-- Junction table: ${cls.name}.${ref.name}`);
          lines.push(`CREATE TABLE ${jtName} (`);
          lines.push(`  ${sourceTable}_id TEXT REFERENCES ${sourceTable}(id),`);
          lines.push(`  ${targetTable}_id TEXT REFERENCES ${targetTable}(id),`);
          lines.push(`  PRIMARY KEY (${sourceTable}_id, ${targetTable}_id)`);
          lines.push(');');
          lines.push('');
        }
      }
    }

    return lines.join('\n');
  }

  private generateTypeScript(content: Record<string, any>): string {
    const classes = this.extractClasses(content);
    const lines: string[] = [];

    lines.push('// ============================================');
    lines.push(`// TypeScript interfaces for: ${content.name || 'UnnamedPackage'}`);
    lines.push('// Generated by emf-webapp code generator');
    lines.push('// ============================================');
    lines.push('');

    // Generate interfaces
    for (const cls of classes) {
      const className = cls.name || 'Unnamed';

      // Collect all features (own + inherited via eSuperTypes)
      const allAttrs = cls.eStructuralFeatures?.filter((f: any) => f.kind === 'attribute') || [];
      const allRefs = cls.eStructuralFeatures?.filter((f: any) => f.kind === 'reference') || [];

      const extendsClause = cls.eSuperTypes?.length
        ? ` extends ${cls.eSuperTypes.join(', ')}`
        : '';

      lines.push(`export interface ${className}${extendsClause} {`);

      for (const attr of allAttrs) {
        const tsType = this.toTSType(attr.type || 'string');
        const optional = !attr.required ? '?' : '';
        const array = attr.many ? '[]' : '';
        lines.push(`  ${attr.name || 'unnamed'}${optional}: ${tsType}${array};`);
      }

      for (const ref of allRefs) {
        const tsType = ref.type || 'EObject';
        const optional = !attrRequired(ref) ? '?' : '';
        const array = ref.many ? '[]' : '';
        lines.push(`  ${ref.name || 'unnamed'}${optional}: ${tsType}${array};`);
      }

      lines.push('}');
      lines.push('');
    }

    return lines.join('\n');

    function attrRequired(f: any): boolean {
      return f.lowerBound && f.lowerBound > 0;
    }
  }

  private generateJSONSchema(content: Record<string, any>): string {
    const pkgName = content.name || 'UnnamedPackage';
    const classes = this.extractClasses(content);

    const definitions: Record<string, any> = {};

    for (const cls of classes) {
      const properties: Record<string, any> = {};
      const required: string[] = [];

      const attrs = cls.eStructuralFeatures?.filter((f: any) => f.kind === 'attribute') || [];
      const refs = cls.eStructuralFeatures?.filter((f: any) => f.kind === 'reference') || [];

      for (const attr of attrs) {
        const jsType = this.toJSONSchemaType(attr.type || 'EString');
        if (attr.required || attr.lowerBound > 0) {
          required.push(attr.name || 'unnamed');
        }
        if (attr.many) {
          properties[attr.name || 'unnamed'] = {
            type: 'array',
            items: jsType,
          };
        } else {
          properties[attr.name || 'unnamed'] = jsType;
        }
      }

      for (const ref of refs) {
        const refType = ref.type || 'EObject';
        if (ref.many) {
          properties[ref.name || 'unnamed'] = {
            type: 'array',
            items: { $ref: `#/definitions/${refType}` },
          };
        } else {
          properties[ref.name || 'unnamed'] = { $ref: `#/definitions/${refType}` };
        }
        if (ref.required || ref.lowerBound > 0) {
          required.push(ref.name || 'unnamed');
        }
      }

      const schema: Record<string, any> = {
        type: 'object',
        properties,
      };
      if (required.length > 0) {
        schema.required = required;
      }
      if (cls.abstract) {
        schema.title = `${cls.name} (abstract)`;
      }

      definitions[cls.name || 'Unnamed'] = schema;
    }

    const schema = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      title: pkgName,
      description: `JSON Schema for ${pkgName}`,
      definitions,
      anyOf: classes.map((cls) => ({ $ref: `#/definitions/${cls.name}` })),
    };

    return JSON.stringify(schema, null, 2);
  }

  private generatePlantUML(content: Record<string, any>): string {
    const pkgName = content.name || 'UnnamedPackage';
    const classes = this.extractClasses(content);
    const lines: string[] = [];

    lines.push('@startuml');
    lines.push(`' ${pkgName} — Class Diagram`);
    lines.push(`package "${pkgName}" {`);
    lines.push('');

    for (const cls of classes) {
      const className = cls.name || 'Unnamed';
      const stereo = cls.abstract ? 'abstract' : 'class';
      lines.push(`  ${stereo} "${className}" as ${className} {`);

      const attrs = cls.eStructuralFeatures?.filter((f: any) => f.kind === 'attribute') || [];
      const refs = cls.eStructuralFeatures?.filter((f: any) => f.kind === 'reference') || [];

      for (const attr of attrs) {
        const cardinality = attr.many ? '[*]' : attr.required ? '[1]' : '[0..1]';
        lines.push(`    + ${attr.name || 'unnamed'} : ${attr.type || 'string'} ${cardinality}`);
      }

      for (const ref of refs) {
        const cardinality = ref.many ? '[*]' : attrRequired(ref) ? '[1]' : '[0..1]';
        lines.push(`    + ${ref.name || 'unnamed'} : ${ref.type || 'EObject'} ${cardinality}`);
      }

      lines.push('  }');
      lines.push('');
    }

    // Relationships (inheritance + references)
    for (const cls of classes) {
      const className = cls.name || 'Unnamed';

      // Inheritance
      if (cls.eSuperTypes && cls.eSuperTypes.length > 0) {
        for (const parent of cls.eSuperTypes) {
          lines.push(`  ${parent} <|-- ${className}`);
        }
      }

      // References
      const refs = cls.eStructuralFeatures?.filter((f: any) => f.kind === 'reference') || [];
      for (const ref of refs) {
        if (!ref.type) continue;
        if (ref.containment) {
          lines.push(`  ${className} *--> "${ref.name}" ${ref.type}`);
        } else {
          lines.push(`  ${className} --> "${ref.name}" ${ref.type}`);
        }
      }
    }

    lines.push('}');
    lines.push('@enduml');
    return lines.join('\n');

    function attrRequired(f: any): boolean {
      return f.lowerBound && f.lowerBound > 0;
    }
  }

  // ================================================================
  // Helpers
  // ================================================================

  /**
   * Extract a flat list of classes from the metamodel content.
   * Supports both EPackage structure (content.eClassifiers) and
   * raw array formats.
   */
  private extractClasses(content: Record<string, any>): any[] {
    let raw: any[] = [];
    if (Array.isArray(content)) {
      raw = content;
    } else if (content.eClassifiers && Array.isArray(content.eClassifiers)) {
      raw = content.eClassifiers.filter(
        (c: any) =>
          c.type === 'EClass' ||
          c._type === 'EClass' ||
          c._type === 'ecore.EClass' ||
          (!c.type && !c._type),
      );
    } else if (content.classes && Array.isArray(content.classes)) {
      raw = content.classes;
    }

    // Build id→name map for resolving targetId references
    const allClassifiers = Array.isArray(content)
      ? content
      : content.eClassifiers || content.classes || [];
    const idToName = new Map<string, string>();
    for (const c of allClassifiers) {
      if (c.id && c.name) idToName.set(c.id, c.name);
    }

    // Normalize: merge eAttributes/eReferences into eStructuralFeatures if missing
    return raw.map((cls) => {
      if (cls.eStructuralFeatures) return cls;
      const features: any[] = [];
      if (cls.eAttributes && Array.isArray(cls.eAttributes)) {
        for (const attr of cls.eAttributes) {
          features.push({
            name: attr.name,
            type: attr.type || 'EString',
            kind: 'attribute',
            many: attr.many ?? false,
            required: attr.required ?? false,
            lowerBound: attr.lowerBound ?? 0,
            upperBound: attr.upperBound ?? 1,
          });
        }
      }
      if (cls.eReferences && Array.isArray(cls.eReferences)) {
        for (const ref of cls.eReferences) {
          // Resolve targetId to class name
          const targetType = ref.targetId
            ? (idToName.get(ref.targetId) || ref.targetId)
            : (ref.type || 'EObject');
          features.push({
            name: ref.name,
            type: targetType,
            kind: 'reference',
            many: ref.upperBound === -1 || ref.many || false,
            containment: ref.containment ?? false,
            required: ref.required ?? false,
            lowerBound: ref.lowerBound ?? 0,
            upperBound: ref.upperBound ?? 1,
          });
        }
      }
      return { ...cls, eStructuralFeatures: features };
    });
  }

  /**
   * Build a simplified model object from a Metamodel entity
   * suitable for the MTL executor (duck-typed EObject).
   */
  private buildModelFromMetamodel(metamodel: Metamodel): Record<string, any> {
    const content = metamodel.content;
    return {
      name: metamodel.name,
      nsURI: metamodel.ns_uri,
      nsPrefix: metamodel.ns_prefix,
      ...content,
    };
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private toSnakeCase(str: string): string {
    return str
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '')
      .replace(/[^a-z0-9_]/g, '');
  }

  private toSQLType(emfType: string): string {
    const map: Record<string, string> = {
      EString: 'TEXT',
      EBoolean: 'BOOLEAN',
      EInt: 'INTEGER',
      ELong: 'BIGINT',
      EFloat: 'REAL',
      EDouble: 'REAL',
      EByte: 'INTEGER',
      EChar: 'TEXT',
      EShort: 'INTEGER',
      EBigDecimal: 'REAL',
      EBigInteger: 'TEXT',
      EDate: 'TEXT',
      EObject: 'TEXT',
      string: 'TEXT',
      boolean: 'BOOLEAN',
      number: 'REAL',
      integer: 'INTEGER',
    };
    return map[emfType] || 'TEXT';
  }

  private toTSType(emfType: string): string {
    const map: Record<string, string> = {
      EString: 'string',
      EBoolean: 'boolean',
      EInt: 'number',
      ELong: 'number',
      EFloat: 'number',
      EDouble: 'number',
      EByte: 'number',
      EChar: 'string',
      EShort: 'number',
      EBigDecimal: 'number',
      EBigInteger: 'string',
      EDate: 'string',
      EObject: 'any',
      string: 'string',
      boolean: 'boolean',
      number: 'number',
      integer: 'number',
    };
    return map[emfType] || 'any';
  }

  private toJSONSchemaType(emfType: string): Record<string, any> {
    const map: Record<string, any> = {
      EString: { type: 'string' },
      EBoolean: { type: 'boolean' },
      EInt: { type: 'integer' },
      ELong: { type: 'integer' },
      EFloat: { type: 'number' },
      EDouble: { type: 'number' },
      EByte: { type: 'integer' },
      EChar: { type: 'string' },
      EShort: { type: 'integer' },
      EBigDecimal: { type: 'number' },
      EBigInteger: { type: 'string' },
      EDate: { type: 'string', format: 'date-time' },
      EObject: { type: 'object' },
      string: { type: 'string' },
      boolean: { type: 'boolean' },
      number: { type: 'number' },
      integer: { type: 'integer' },
    };
    return map[emfType] || { type: 'string' };
  }
}
