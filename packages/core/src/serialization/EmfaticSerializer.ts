/**
 * @emf-webapp/core — EmfaticSerializer
 *
 * Serializes SerializableEPackage to Emfatic textual syntax and
 * parses Emfatic text back to SerializableEPackage.
 *
 * Emfatic is a human-readable textual syntax for Ecore metamodels
 * used by Eclipse EMF.
 */
import type {
  SerializableEPackage,
  SerializableEClass,
  SerializableEEnum,
  SerializableEDataType,
  SerializableEAttribute,
  SerializableEReference,
  SerializableEEnumLiteral,
  SerializableAnnotation,
} from './SerializableToEcoreConverter.js';

// ═══════════════════════════════════════════════════════════════
// Type Guards
// ═══════════════════════════════════════════════════════════════

function isEClass(c: any): c is SerializableEClass {
  return c && 'eAttributes' in c;
}

function isEEnum(c: any): c is SerializableEEnum {
  return c && 'eLiterals' in c && !('eAttributes' in c);
}

function isEDataType(c: any): c is SerializableEDataType {
  return c && !('eAttributes' in c) && !('eLiterals' in c);
}

// ═══════════════════════════════════════════════════════════════
// Ecore ↔ Emfatic type mappings
// ═══════════════════════════════════════════════════════════════

/** Maps Ecore type names to Emfatic shorthand type names */
const ECORE_TO_EMFATIC: Record<string, string> = {
  EString: 'String',
  EInt: 'int',
  EBoolean: 'boolean',
  EDouble: 'double',
  EFloat: 'float',
  ELong: 'long',
  EByte: 'byte',
  EChar: 'char',
  EShort: 'short',
  EBigDecimal: 'BigDecimal',
  EBigInteger: 'BigInteger',
  EDate: 'EDate',
  EJavaObject: 'EJavaObject',
  EJavaClass: 'EJavaClass',
};

/** Maps Emfatic shorthand type names back to Ecore type names */
const EMFATIC_TO_ECORE: Record<string, string> = {
  String: 'EString',
  int: 'EInt',
  boolean: 'EBoolean',
  double: 'EDouble',
  float: 'EFloat',
  long: 'ELong',
  byte: 'EByte',
  char: 'EChar',
  short: 'EShort',
  BigDecimal: 'EBigDecimal',
  BigInteger: 'EBigInteger',
  EDate: 'EDate',
  EJavaObject: 'EJavaObject',
  EJavaClass: 'EJavaClass',
  // Also accept Ecore names directly
  EString: 'EString',
  EInt: 'EInt',
  EBoolean: 'EBoolean',
  EDouble: 'EDouble',
  EFloat: 'EFloat',
  ELong: 'ELong',
  EByte: 'EByte',
  EChar: 'EChar',
  EShort: 'EShort',
  EBigDecimal: 'EBigDecimal',
  EBigInteger: 'EBigInteger',
};

// ═══════════════════════════════════════════════════════════════
// Serializer: SerializableEPackage → Emfatic text
// ═══════════════════════════════════════════════════════════════

/**
 * Converts a SerializableEPackage to Emfatic textual syntax.
 */
export function serializeToEmfatic(pkg: SerializableEPackage): string {
  const lines: string[] = [];

  // Package-level annotations (non-namespace)
  if (pkg.annotations) {
    for (const ann of pkg.annotations) {
      if (ann.source !== 'namespace') {
        lines.push(serializeAnnotation(ann));
      }
    }
  }

  // @namespace annotation
  lines.push(`@namespace(uri="${escapeString(pkg.nsURI)}", prefix="${escapeString(pkg.nsPrefix)}")`);
  lines.push(`package ${pkg.name};`);
  lines.push('');

  // Build a map of classifier IDs to names for reference resolution
  const idToName = new Map<string, string>();
  for (const classifier of pkg.eClassifiers) {
    idToName.set(classifier.id, classifier.name);
  }

  // Serialize each classifier
  for (const classifier of pkg.eClassifiers) {
    if (isEClass(classifier)) {
      lines.push(...serializeClass(classifier, idToName));
    } else if (isEEnum(classifier)) {
      lines.push(...serializeEnum(classifier));
    } else if (isEDataType(classifier)) {
      lines.push(...serializeDataType(classifier));
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd() + '\n';
}

function serializeAnnotation(ann: SerializableAnnotation, indent = ''): string {
  const details = Object.entries(ann.details);
  if (details.length === 0) {
    return `${indent}@${ann.source}`;
  }
  const pairs = details.map(([k, v]) => `${k}="${escapeString(v)}"`).join(', ');
  return `${indent}@${ann.source}(${pairs})`;
}

function serializeClass(cls: SerializableEClass, idToName: Map<string, string>): string[] {
  const lines: string[] = [];

  // Class-level annotations
  if (cls.annotations) {
    for (const ann of cls.annotations) {
      lines.push(serializeAnnotation(ann));
    }
  }

  // Class declaration
  let decl = '';
  if (cls.abstract && cls.interface) {
    decl = 'interface';
  } else if (cls.interface) {
    decl = 'interface';
  } else if (cls.abstract) {
    decl = 'abstract class';
  } else {
    decl = 'class';
  }

  decl += ` ${cls.name}`;

  // Super types
  if (cls.eSuperTypes && cls.eSuperTypes.length > 0) {
    const superNames = cls.eSuperTypes
      .map(id => idToName.get(id) || id)
      .join(', ');
    decl += ` extends ${superNames}`;
  }

  decl += ' {';
  lines.push(decl);

  // Attributes
  for (const attr of cls.eAttributes) {
    lines.push(serializeAttribute(attr));
  }

  // References
  for (const ref of cls.eReferences) {
    lines.push(serializeReference(ref, idToName));
  }

  lines.push('}');
  return lines;
}

function serializeAttribute(attr: SerializableEAttribute): string {
  const parts: string[] = [];

  // Annotations for the attribute
  const annotationLines: string[] = [];
  if (attr.annotations) {
    for (const ann of attr.annotations) {
      annotationLines.push(serializeAnnotation(ann, '  '));
    }
  }

  // Modifiers
  const modifiers: string[] = [];
  if (attr.derived) modifiers.push('derived');
  if (attr.transient) modifiers.push('transient');
  if (attr.changeable === false) modifiers.push('readonly');

  // Type name (convert Ecore to Emfatic shorthand)
  const typeName = ECORE_TO_EMFATIC[attr.eType] || attr.eType;

  // Multiplicity
  const mult = serializeMultiplicity(attr.lowerBound, attr.upperBound);

  // iD keyword
  const idKeyword = attr.iD ? 'id ' : '';

  // Build the line
  const modStr = modifiers.length > 0 ? modifiers.join(' ') + ' ' : '';
  const line = `  ${modStr}attr ${typeName}${mult} ${idKeyword}${attr.name};`;

  const result: string[] = [...annotationLines, line];
  return result.join('\n');
}

function serializeReference(ref: SerializableEReference, idToName: Map<string, string>): string {
  const annotationLines: string[] = [];
  if (ref.annotations) {
    for (const ann of ref.annotations) {
      annotationLines.push(serializeAnnotation(ann, '  '));
    }
  }

  const modifiers: string[] = [];
  if (ref.derived) modifiers.push('derived');
  if (ref.changeable === false) modifiers.push('readonly');

  const keyword = ref.containment ? 'val' : 'ref';
  const targetName = idToName.get(ref.targetId) || ref.targetId;
  const mult = serializeMultiplicity(ref.lowerBound, ref.upperBound);

  const modStr = modifiers.length > 0 ? modifiers.join(' ') + ' ' : '';
  const line = `  ${modStr}${keyword} ${targetName}${mult} ${ref.name};`;

  const result: string[] = [...annotationLines, line];
  return result.join('\n');
}

function serializeMultiplicity(lower?: number, upper?: number): string {
  const lo = lower ?? 0;
  const up = upper ?? 1;

  if (lo === 0 && up === 1) return '';        // default, no brackets
  if (lo === 1 && up === 1) return '[1]';
  if (lo === 0 && up === -1) return '[*]';
  if (lo === 1 && up === -1) return '[+]';
  if (lo === 0 && up === 1) return '[0..1]';
  return `[${lo}..${up === -1 ? '*' : up}]`;
}

function serializeEnum(enm: SerializableEEnum): string[] {
  const lines: string[] = [];

  if (enm.annotations) {
    for (const ann of enm.annotations) {
      lines.push(serializeAnnotation(ann));
    }
  }

  lines.push(`enum ${enm.name} {`);
  for (const lit of enm.eLiterals) {
    if (lit.literal && lit.literal !== lit.name) {
      lines.push(`  ${lit.name} = ${lit.value}; // literal="${lit.literal}"`);
    } else {
      lines.push(`  ${lit.name} = ${lit.value};`);
    }
  }
  lines.push('}');
  return lines;
}

function serializeDataType(dt: SerializableEDataType): string[] {
  const lines: string[] = [];

  if (dt.annotations) {
    for (const ann of dt.annotations) {
      lines.push(serializeAnnotation(ann));
    }
  }

  const instanceClass = dt.instanceClassName || 'java.lang.Object';
  lines.push(`datatype ${dt.name} : "${escapeString(instanceClass)}";`);
  return lines;
}

function escapeString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

// ═══════════════════════════════════════════════════════════════
// Parser: Emfatic text → SerializableEPackage
// ═══════════════════════════════════════════════════════════════

/**
 * Parses Emfatic textual syntax back to a SerializableEPackage.
 */
export function parseEmfatic(text: string): SerializableEPackage {
  const lines = text.split('\n');
  const parser = new EmfaticParser(lines);
  return parser.parse();
}

class EmfaticParser {
  private lines: string[];
  private pos = 0;
  private pendingAnnotations: SerializableAnnotation[] = [];
  private classifierNames: Map<string, string> = new Map(); // name → id

  constructor(lines: string[]) {
    this.lines = lines;
  }

  parse(): SerializableEPackage {
    const pkg: SerializableEPackage = {
      name: '',
      nsURI: '',
      nsPrefix: '',
      eClassifiers: [],
    };

    // First pass: collect all classifier names for ID resolution
    this.collectClassifierNames();

    // Reset position for actual parsing
    this.pos = 0;
    this.pendingAnnotations = [];

    while (this.pos < this.lines.length) {
      const line = this.currentLine();

      if (line === '' || line.startsWith('//')) {
        this.pos++;
        continue;
      }

      // Annotation
      if (line.startsWith('@')) {
        const ann = this.parseAnnotationLine(line);
        if (ann) {
          // Check if this is the @namespace annotation
          if (ann.source === 'namespace') {
            pkg.nsURI = ann.details['uri'] || '';
            pkg.nsPrefix = ann.details['prefix'] || '';
            this.pos++;
            continue;
          }
          this.pendingAnnotations.push(ann);
        }
        this.pos++;
        continue;
      }

      // Package declaration
      if (line.startsWith('package ')) {
        pkg.name = line.replace(/^package\s+/, '').replace(/;$/, '').trim();
        this.pos++;
        continue;
      }

      // Class / abstract class / interface
      if (
        line.startsWith('class ') ||
        line.startsWith('abstract class ') ||
        line.startsWith('interface ')
      ) {
        const cls = this.parseClass(line);
        if (cls) {
          pkg.eClassifiers.push(cls);
        }
        continue;
      }

      // Enum
      if (line.startsWith('enum ')) {
        const enm = this.parseEnum(line);
        if (enm) {
          pkg.eClassifiers.push(enm);
        }
        continue;
      }

      // Datatype
      if (line.startsWith('datatype ')) {
        const dt = this.parseDataType(line);
        if (dt) {
          pkg.eClassifiers.push(dt);
        }
        this.pos++;
        continue;
      }

      // Skip unrecognized lines
      this.pos++;
    }

    // Attach package-level annotations
    if (this.pendingAnnotations.length > 0) {
      pkg.annotations = this.pendingAnnotations;
      this.pendingAnnotations = [];
    }

    return pkg;
  }

  /**
   * First pass to collect all classifier names so we can resolve
   * references by name to IDs.
   */
  private collectClassifierNames(): void {
    for (const rawLine of this.lines) {
      const line = rawLine.trim();

      // Match class declarations
      const classMatch = line.match(
        /^(?:abstract\s+)?(?:class|interface)\s+(\w+)/
      );
      if (classMatch) {
        const name = classMatch[1];
        this.classifierNames.set(name, `cls_${name}`);
        continue;
      }

      // Match enum declarations
      const enumMatch = line.match(/^enum\s+(\w+)/);
      if (enumMatch) {
        const name = enumMatch[1];
        this.classifierNames.set(name, `enum_${name}`);
        continue;
      }

      // Match datatype declarations
      const dtMatch = line.match(/^datatype\s+(\w+)/);
      if (dtMatch) {
        const name = dtMatch[1];
        this.classifierNames.set(name, `dt_${name}`);
        continue;
      }
    }
  }

  private currentLine(): string {
    return this.lines[this.pos].trim();
  }

  private parseAnnotationLine(line: string): SerializableAnnotation | null {
    // Match @source or @source(key="value", ...)
    const match = line.match(/^@([\w.]+)(?:\((.+)\))?$/);
    if (!match) return null;

    const source = match[1];
    const details: Record<string, string> = {};

    if (match[2]) {
      // Parse key="value" pairs
      const pairsStr = match[2];
      const pairRegex = /(\w+)\s*=\s*"((?:[^"\\]|\\.)*)"/g;
      let pairMatch: RegExpExecArray | null;
      while ((pairMatch = pairRegex.exec(pairsStr)) !== null) {
        details[pairMatch[1]] = unescapeString(pairMatch[2]);
      }
    }

    return { source, details };
  }

  private parseClass(firstLine: string): SerializableEClass | null {
    // Parse the class header
    const isAbstract = firstLine.startsWith('abstract ');
    const isInterface = firstLine.startsWith('interface ');

    // Extract name and super types
    let headerStr = firstLine;
    // Remove trailing {
    headerStr = headerStr.replace(/\s*\{?\s*$/, '');

    // Remove leading keywords
    headerStr = headerStr
      .replace(/^abstract\s+class\s+/, '')
      .replace(/^class\s+/, '')
      .replace(/^interface\s+/, '');

    // Split on 'extends'
    let name: string;
    let superTypeNames: string[] = [];

    const extendsIdx = headerStr.indexOf(' extends ');
    if (extendsIdx >= 0) {
      name = headerStr.substring(0, extendsIdx).trim();
      const superStr = headerStr.substring(extendsIdx + 9).trim();
      superTypeNames = superStr.split(',').map(s => s.trim()).filter(Boolean);
    } else {
      name = headerStr.trim();
    }

    // Resolve super type names to IDs
    const eSuperTypes = superTypeNames.map(
      sn => this.classifierNames.get(sn) || `cls_${sn}`
    );

    const cls: SerializableEClass = {
      id: `cls_${name}`,
      name,
      abstract: isAbstract,
      interface: isInterface,
      eSuperTypes,
      eAttributes: [],
      eReferences: [],
    };

    // Attach pending annotations
    if (this.pendingAnnotations.length > 0) {
      cls.annotations = this.pendingAnnotations;
      this.pendingAnnotations = [];
    }

    this.pos++;

    // Parse body until closing }
    const memberAnnotations: SerializableAnnotation[] = [];

    while (this.pos < this.lines.length) {
      const line = this.currentLine();

      if (line === '}') {
        this.pos++;
        break;
      }

      if (line === '' || line.startsWith('//')) {
        this.pos++;
        continue;
      }

      // Member annotation
      if (line.startsWith('@')) {
        const ann = this.parseAnnotationLine(line);
        if (ann) {
          memberAnnotations.push(ann);
        }
        this.pos++;
        continue;
      }

      // Attribute
      if (line.includes('attr ')) {
        const attr = this.parseAttribute(line);
        if (attr) {
          if (memberAnnotations.length > 0) {
            attr.annotations = [...memberAnnotations];
            memberAnnotations.length = 0;
          }
          cls.eAttributes.push(attr);
        }
        this.pos++;
        continue;
      }

      // Reference (val or ref)
      if (line.startsWith('val ') || line.startsWith('ref ') ||
          line.includes(' val ') || line.includes(' ref ')) {
        const ref = this.parseReference(line);
        if (ref) {
          if (memberAnnotations.length > 0) {
            ref.annotations = [...memberAnnotations];
            memberAnnotations.length = 0;
          }
          cls.eReferences.push(ref);
        }
        this.pos++;
        continue;
      }

      // Skip unrecognized member lines
      this.pos++;
    }

    return cls;
  }

  private parseAttribute(line: string): SerializableEAttribute | null {
    // Remove trailing semicolon and comments
    let content = line.replace(/;.*$/, '').trim();

    // Parse modifiers
    let derived = false;
    let transient_ = false;
    let changeable = true;

    if (content.includes('derived')) {
      derived = true;
      content = content.replace(/\bderived\b\s*/, '');
    }
    if (content.includes('transient')) {
      transient_ = true;
      content = content.replace(/\btransient\b\s*/, '');
    }
    if (content.includes('readonly')) {
      changeable = false;
      content = content.replace(/\breadonly\b\s*/, '');
    }

    // Remove 'attr' keyword
    content = content.replace(/\battr\b\s*/, '').trim();

    // Parse type with optional multiplicity: Type[mult] or Type
    const typeMultMatch = content.match(/^(\w+)(\[[^\]]*\])?\s+(.+)$/);
    if (!typeMultMatch) return null;

    const rawType = typeMultMatch[1];
    const multStr = typeMultMatch[2] || '';
    let nameStr = typeMultMatch[3].trim();

    // Check for 'id' keyword before name
    let isID = false;
    if (nameStr.startsWith('id ')) {
      isID = true;
      nameStr = nameStr.substring(3).trim();
    }

    // Convert Emfatic type to Ecore type
    const eType = EMFATIC_TO_ECORE[rawType] || rawType;

    // Parse multiplicity
    const { lowerBound, upperBound } = parseMultiplicity(multStr);

    return {
      id: `attr_${nameStr}`,
      name: nameStr,
      eType,
      lowerBound,
      upperBound,
      iD: isID,
      defaultValueLiteral: '',
      changeable,
      derived,
      transient: transient_,
    };
  }

  private parseReference(line: string): SerializableEReference | null {
    // Remove trailing semicolon and comments
    let content = line.replace(/;.*$/, '').trim();

    // Parse modifiers
    let derived = false;
    let changeable = true;

    if (content.includes('derived')) {
      derived = true;
      content = content.replace(/\bderived\b\s*/, '');
    }
    if (content.includes('readonly')) {
      changeable = false;
      content = content.replace(/\breadonly\b\s*/, '');
    }

    // Determine containment
    const isContainment = content.includes('val ');
    content = content.replace(/\b(val|ref)\b\s*/, '').trim();

    // Parse type with optional multiplicity: Type[mult] name
    const typeMultMatch = content.match(/^(\w+)(\[[^\]]*\])?\s+(.+)$/);
    if (!typeMultMatch) return null;

    const targetName = typeMultMatch[1];
    const multStr = typeMultMatch[2] || '';
    const refName = typeMultMatch[3].trim();

    // Resolve target name to ID
    const targetId = this.classifierNames.get(targetName) || `cls_${targetName}`;

    // Parse multiplicity
    const { lowerBound, upperBound } = parseMultiplicity(multStr);

    return {
      id: `ref_${refName}`,
      name: refName,
      targetId,
      containment: isContainment,
      lowerBound,
      upperBound,
      eOpposite: null,
      changeable,
      derived,
    };
  }

  private parseEnum(firstLine: string): SerializableEEnum | null {
    // Extract enum name
    let headerStr = firstLine.replace(/\s*\{?\s*$/, '');
    headerStr = headerStr.replace(/^enum\s+/, '').trim();
    const name = headerStr;

    const enm: SerializableEEnum = {
      id: `enum_${name}`,
      name,
      eLiterals: [],
    };

    // Attach pending annotations
    if (this.pendingAnnotations.length > 0) {
      enm.annotations = this.pendingAnnotations;
      this.pendingAnnotations = [];
    }

    this.pos++;

    // Parse literals until closing }
    while (this.pos < this.lines.length) {
      const line = this.currentLine();

      if (line === '}') {
        this.pos++;
        break;
      }

      if (line === '' || line.startsWith('//')) {
        this.pos++;
        continue;
      }

      // Parse literal: NAME = value;
      const litMatch = line.match(/^(\w+)\s*=\s*(\d+)\s*;/);
      if (litMatch) {
        const literal: SerializableEEnumLiteral = {
          id: `lit_${name}_${litMatch[1]}`,
          name: litMatch[1],
          value: parseInt(litMatch[2], 10),
          literal: litMatch[1],
        };
        enm.eLiterals.push(literal);
      }

      this.pos++;
    }

    return enm;
  }

  private parseDataType(line: string): SerializableEDataType | null {
    // datatype Name : "instanceClassName";
    const match = line.match(
      /^datatype\s+(\w+)\s*:\s*"((?:[^"\\]|\\.)*)"\s*;?$/
    );
    if (!match) return null;

    const name = match[1];
    const instanceClassName = unescapeString(match[2]);

    const dt: SerializableEDataType = {
      id: `dt_${name}`,
      name,
      instanceClassName,
      serializable: true,
    };

    // Attach pending annotations
    if (this.pendingAnnotations.length > 0) {
      dt.annotations = this.pendingAnnotations;
      this.pendingAnnotations = [];
    }

    return dt;
  }
}

// ═══════════════════════════════════════════════════════════════
// Utility functions
// ═══════════════════════════════════════════════════════════════

function parseMultiplicity(mult: string): { lowerBound: number; upperBound: number } {
  if (!mult) return { lowerBound: 0, upperBound: 1 };

  const inner = mult.replace(/[\[\]]/g, '').trim();

  switch (inner) {
    case '*':
      return { lowerBound: 0, upperBound: -1 };
    case '+':
      return { lowerBound: 1, upperBound: -1 };
    case '1':
      return { lowerBound: 1, upperBound: 1 };
    case '?':
    case '0..1':
      return { lowerBound: 0, upperBound: 1 };
    default: {
      // Parse N..M format
      const rangeMatch = inner.match(/^(\d+)\.\.(\d+|\*)$/);
      if (rangeMatch) {
        const lo = parseInt(rangeMatch[1], 10);
        const up = rangeMatch[2] === '*' ? -1 : parseInt(rangeMatch[2], 10);
        return { lowerBound: lo, upperBound: up };
      }
      // Single number
      const num = parseInt(inner, 10);
      if (!isNaN(num)) {
        return { lowerBound: num, upperBound: num };
      }
      return { lowerBound: 0, upperBound: 1 };
    }
  }
}

function unescapeString(s: string): string {
  return s.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}
