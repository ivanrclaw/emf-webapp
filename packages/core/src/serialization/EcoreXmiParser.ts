/**
 * @emf-webapp/core — EcoreXmiParser
 *
 * Parsea archivos .ecore (XMI 2.0) generados por Eclipse EMF
 * y los convierte a SerializableEPackage para usar en el editor web.
 *
 * Formato soportado:
 *   <ecore:EPackage xmi:version="2.0" ...>
 *     <eClassifiers xsi:type="ecore:EClass" name="ClassName" .../>
 *     <eClassifiers xsi:type="ecore:EEnum" name="EnumName" .../>
 *     <eClassifiers xsi:type="ecore:EDataType" name="TypeName" .../>
 *   </ecore:EPackage>
 *
 * Referencia: https://eclipse.dev/emf/docs/XMI_Format
 */
import type { SerializableEPackage, SerializableEClass, SerializableEEnum, SerializableEDataType, SerializableEOperation, SerializableEParameter, SerializableAnnotation } from './SerializableToEcoreConverter.js';

let _counter = 0;
function genId(prefix: string): string {
  return `${prefix}_import_${Date.now()}_${++_counter}`;
}

/**
 * Parsea un string XML .ecore a SerializableEPackage.
 * @throws Error si el XML no es válido o no contiene un EPackage
 */
export function parseEcoreXmi(xml: string): SerializableEPackage {
  const cleaned = xml.replace(/<\?xml[^>]*\?>/, '').trim();

  // Extraer atributos del EPackage
  const nsUri = extractAttr(cleaned, 'nsURI') || '';
  const nsPrefix = extractAttr(cleaned, 'nsPrefix') || '';
  const pkgName = extractAttr(cleaned, 'name') || 'ImportedModel';

  const result: SerializableEPackage = {
    name: pkgName,
    nsURI: nsUri,
    nsPrefix: nsPrefix,
    eClassifiers: [],
  };

  // Parse package-level EAnnotations (OCL constraints, Ecore metadata)
  const pkgAnnotations = parseEAnnotations(cleaned);
  if (pkgAnnotations.length > 0) {
    result.annotations = pkgAnnotations;
  }

  // Extraer bloques de classifiers
  const classifierBlocks = extractBlocks(cleaned, 'eClassifiers');

  for (const block of classifierBlocks) {
    const type = extractAttr(block, 'xsi:type') || extractAttr(block, 'type') || '';
    const name = extractAttr(block, 'name') || 'Unnamed';

    if (type.includes('EClass')) {
      const cls = parseEClass(block, name);
      result.eClassifiers.push(cls);
    } else if (type.includes('EEnum')) {
      const enm = parseEEnum(block, name);
      result.eClassifiers.push(enm);
    } else if (type.includes('EDataType')) {
      const dt = parseEDataType(block, name);
      result.eClassifiers.push(dt);
    }
  }

  // Fase 2: resolver referencias entre clases
  resolveCrossReferences(result);

  return result;
}

function parseEClass(block: string, name: string): SerializableEClass {
  const abstract = extractAttr(block, 'abstract') === 'true';
  const isInterface = extractAttr(block, 'interface') === 'true';
  const id = genId('ec');

  const cls: SerializableEClass = {
    id,
    name,
    abstract,
    interface: isInterface,
    eSuperTypes: [],
    eAttributes: [],
    eReferences: [],
    position: { x: 100 + (Math.random() * 200), y: 100 + (Math.random() * 200) },
  };

  // Extraer eSuperTypes (inline href)
  const superTypeRefs = extractAttrArray(block, 'eSuperTypes');
  for (const ref of superTypeRefs) {
    if (ref.startsWith('#//')) {
      cls.eSuperTypes.push(ref.substring(3)); // #//ClassName → ClassName
    }
  }

  // Extraer eStructuralFeatures
  const featureBlocks = extractBlocks(block, 'eStructuralFeatures');
  for (const fBlock of featureBlocks) {
    const fType = extractAttr(fBlock, 'xsi:type') || '';
    const fName = extractAttr(fBlock, 'name') || 'unnamed';

    if (fType.includes('EAttribute')) {
      cls.eAttributes.push(parseEAttribute(fBlock, fName));
    } else if (fType.includes('EReference')) {
      cls.eReferences.push(parseEReference(fBlock, fName));
    }
  }

  // Parse eOperations
  const operationBlocks = extractBlocks(block, 'eOperations');
  for (const opBlock of operationBlocks) {
    cls.eOperations = cls.eOperations || [];
    cls.eOperations.push(parseEOperation(opBlock));
  }

  // Parse class-level EAnnotations (OCL constraints, Ecore metadata)
  const classAnnotations = parseEAnnotations(block);
  if (classAnnotations.length > 0) {
    cls.annotations = classAnnotations;
  }

  return cls;
}

function parseEAttribute(block: string, name: string): import('./SerializableToEcoreConverter.js').SerializableEAttribute {
  const eTypeRaw = extractAttr(block, 'eType') || 'EString';
  const lowerBound = parseInt(extractAttr(block, 'lowerBound') || '0', 10);
  const upperBound = parseInt(extractAttr(block, 'upperBound') || '1', 10);
  const isID = extractAttr(block, 'iD') === 'true' || extractAttr(block, 'unique') === 'true';

  // Parse eType: "ecore:EDataType http://...#//EString" → "EString"
  const eType = eTypeRaw.includes('#//') ? eTypeRaw.split('#//').pop() || 'EString' : eTypeRaw;

  return {
    id: genId('attr'),
    name,
    eType,
    lowerBound: isNaN(lowerBound) ? 0 : lowerBound,
    upperBound: isNaN(upperBound) ? 1 : upperBound,
    iD: isID,
    defaultValueLiteral: extractAttr(block, 'defaultValueLiteral') || '',
    changeable: extractAttr(block, 'changeable') !== 'false',
    derived: extractAttr(block, 'derived') === 'true',
    transient: extractAttr(block, 'transient') === 'true',
  };
}

function parseEReference(block: string, name: string): import('./SerializableToEcoreConverter.js').SerializableEReference {
  const eTypeRaw = extractAttr(block, 'eType') || '';
  const containment = extractAttr(block, 'containment') === 'true';
  const lowerBound = parseInt(extractAttr(block, 'lowerBound') || '0', 10);
  const upperBound = parseInt(extractAttr(block, 'upperBound') || '-1', 10);

  // Parse eType: "#//TargetClass" → "TargetClass"
  let targetId = '';
  if (eTypeRaw.startsWith('#//')) {
    targetId = eTypeRaw.substring(3);
  } else if (eTypeRaw.startsWith('#')) {
    targetId = eTypeRaw.substring(1);
  }

  // eOpposite
  const eOppositeRaw = extractAttr(block, 'eOpposite') || '';
  let eOpposite: string | null = null;
  if (eOppositeRaw.startsWith('#//')) {
    eOpposite = eOppositeRaw.substring(3);
  }

  return {
    id: genId('ref'),
    name,
    targetId,
    containment,
    lowerBound: isNaN(lowerBound) ? 0 : lowerBound,
    upperBound: isNaN(upperBound) ? -1 : upperBound,
    eOpposite,
    changeable: extractAttr(block, 'changeable') !== 'false',
    derived: extractAttr(block, 'derived') === 'true',
  };
}

function parseEEnum(block: string, name: string): SerializableEEnum {
  const id = genId('enm');
  const enm: SerializableEEnum = {
    id,
    name,
    eLiterals: [],
    position: { x: 100 + (Math.random() * 200), y: 100 + (Math.random() * 200) },
  };

  const literalBlocks = extractBlocks(block, 'eLiterals');
  for (const lBlock of literalBlocks) {
    const litName = extractAttr(lBlock, 'name') || 'UNKNOWN';
    const litValue = parseInt(extractAttr(lBlock, 'value') || '0', 10);
    enm.eLiterals.push({
      id: genId('lit'),
      name: litName,
      value: isNaN(litValue) ? 0 : litValue,
      literal: litName,
    });
  }

  // Fallback: if no eLiterals block, try inline attributes
  if (enm.eLiterals.length === 0) {
    const inlineLit = extractAttr(block, 'literals');
    if (inlineLit) {
      enm.eLiterals.push({
        id: genId('lit'),
        name: inlineLit,
        value: 0,
        literal: inlineLit,
      });
    }
  }

  return enm;
}

function parseEDataType(block: string, name: string): SerializableEDataType {
  return {
    id: genId('dt'),
    name,
    instanceClassName: extractAttr(block, 'instanceClassName') || 'java.lang.String',
    serializable: extractAttr(block, 'serializable') !== 'false',
    position: { x: 100 + (Math.random() * 200), y: 100 + (Math.random() * 200) },
  };
}

/**
 * Resuelve referencias entre clases (eSuperTypes, targetId).
 * Las referencias se almacenan como nombres de clase durante el parseo.
 * Esta función las convierte a IDs reales.
 */
function resolveCrossReferences(pkg: SerializableEPackage): void {
  // Build name→id map
  const nameToId = new Map<string, string>();
  for (const c of pkg.eClassifiers) {
    nameToId.set(c.name, c.id);
  }

  for (const c of pkg.eClassifiers) {
    if (!('eAttributes' in c)) continue;
    const cls = c as SerializableEClass;

    // Resolve eSuperTypes
    cls.eSuperTypes = cls.eSuperTypes
      .map((name) => nameToId.get(name) || '')
      .filter(Boolean);

    // Resolve eReferences targetId
    for (const ref of cls.eReferences) {
      if (ref.targetId && !ref.targetId.startsWith('ec_import_')) {
        // It's a class name, resolve to ID
        const resolvedId = nameToId.get(ref.targetId);
        if (resolvedId) {
          ref.targetId = resolvedId;
        }
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// EOperation & EAnnotation Parsers
// ═══════════════════════════════════════════════════════════════

function parseEOperation(block: string): SerializableEOperation {
  const name = extractAttr(block, 'name') || 'unnamed';
  const eTypeRaw = extractAttr(block, 'eType') || '';
  const lowerBound = parseInt(extractAttr(block, 'lowerBound') || '0', 10);
  const upperBound = parseInt(extractAttr(block, 'upperBound') || '1', 10);

  // Parse eType: "ecore:EDataType http://...#//EString" → "EString"
  const eType = eTypeRaw.includes('#//') ? eTypeRaw.split('#//').pop() || '' : eTypeRaw;

  // Parse eParameters
  const eParameters: SerializableEParameter[] = [];
  const paramBlocks = extractBlocks(block, 'eParameters');
  for (const pBlock of paramBlocks) {
    const pName = extractAttr(pBlock, 'name') || 'param';
    const pTypeRaw = extractAttr(pBlock, 'eType') || '';
    const pType = pTypeRaw.includes('#//') ? pTypeRaw.split('#//').pop() || '' : pTypeRaw;
    const pLower = parseInt(extractAttr(pBlock, 'lowerBound') || '0', 10);
    const pUpper = parseInt(extractAttr(pBlock, 'upperBound') || '1', 10);

    eParameters.push({
      id: genId('param'),
      name: pName,
      eType: pType,
      lowerBound: isNaN(pLower) ? 0 : pLower,
      upperBound: isNaN(pUpper) ? 1 : pUpper,
    });
  }

  // Parse eAnnotations on the operation (e.g. OCL body expressions)
  const annotations = parseEAnnotations(block);

  const op: SerializableEOperation = {
    id: genId('op'),
    name,
    eType,
    lowerBound: isNaN(lowerBound) ? 0 : lowerBound,
    upperBound: isNaN(upperBound) ? 1 : upperBound,
    eParameters,
  };

  if (annotations.length > 0) {
    op.annotations = annotations;
  }

  return op;
}

/**
 * Parses eAnnotations blocks from an XML fragment.
 * Handles both Ecore metadata annotations and OCL/Pivot constraint annotations.
 */
function parseEAnnotations(xml: string): SerializableAnnotation[] {
  const annotations: SerializableAnnotation[] = [];
  const annotationBlocks = extractBlocks(xml, 'eAnnotations');

  for (const aBlock of annotationBlocks) {
    const source = extractAttr(aBlock, 'source') || '';

    // Only process known annotation sources
    if (
      source === 'http://www.eclipse.org/emf/2002/Ecore' ||
      source === 'http://www.eclipse.org/emf/2002/Ecore/OCL/Pivot' ||
      source === 'http://www.eclipse.org/emf/2002/Ecore/OCL'
    ) {
      const details: Record<string, string> = {};

      // Extract <details> elements (key/value pairs)
      const detailBlocks = extractBlocks(aBlock, 'details');
      for (const dBlock of detailBlocks) {
        const key = extractAttr(dBlock, 'key') || '';
        const value = extractAttr(dBlock, 'value') || '';
        if (key) {
          details[key] = value;
        }
      }

      annotations.push({ source, details });
    }
  }

  return annotations;
}

// ═══════════════════════════════════════════════════════════════
// XML Helpers (lightweight, no external deps)
// ═══════════════════════════════════════════════════════════════

/**
 * Desescapa entidades XML en un string.
 */
function unescapeXml(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * Extrae el valor de un atributo XML.
 * Maneja comillas simples y dobles. Desescapa entidades XML.
 */
function extractAttr(xml: string, attrName: string): string {
  const regex = new RegExp(`${attrName}\\s*=\\s*"([^"]*?)"`, 'i');
  const singleRegex = new RegExp(`${attrName}\\s*=\\s*'([^']*?)'`, 'i');

  const m = regex.exec(xml) || singleRegex.exec(xml);
  if (!m) return '';
  // Only unescape for detail values (OCL expressions, etc. may contain XML entities)
  const raw = m[1].trim();
  if (attrName === 'value') {
    return unescapeXml(raw);
  }
  return raw;
}

/**
 * Extrae múltiples valores de un atributo XML (separados por espacio).
 */
function extractAttrArray(xml: string, attrName: string): string[] {
  const val = extractAttr(xml, attrName);
  if (!val) return [];
  return val.split(/\s+/).filter(Boolean);
}

/**
 * Extrae bloques XML anidados para un tag específico.
 * Maneja tags autocerrados y anidados correctamente.
 */
function extractBlocks(xml: string, tagName: string): string[] {
  const results: string[] = [];
  const regex = new RegExp(`<${tagName}[^>]*\\/?>`, 'gi');

  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    const full = match[0];
    const startIdx = match.index;

    // Self-closing: <tagName ... /> — include directly
    if (full.endsWith('/>')) {
      results.push(full);
      continue;
    }

    // Regular tag: find matching closing tag
    const openLen = full.length;
    let depth = 1;
    let endIdx = startIdx + openLen;
    const closeTag = `</${tagName}>`;

    while (depth > 0 && endIdx < xml.length) {
      const nextOpen = xml.indexOf(`<${tagName}`, endIdx);
      const nextClose = xml.indexOf(closeTag, endIdx);

      if (nextClose === -1) break;

      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        endIdx = nextOpen + openLen;
      } else {
        depth--;
        endIdx = nextClose + closeTag.length;
      }
    }

    results.push(xml.substring(startIdx, endIdx));
  }

  return results;
}
