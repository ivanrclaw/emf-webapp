/**
 * @emf-webapp/core — XMISerializer
 *
 * Serialización/deserialización de EObject a XMI 2.0 compatible con Eclipse.
 *
 * Formato XMI 2.0:
 * - xmlns:xmi="http://www.omg.org/XMI", xmi:version="2.0"
 * - xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore" (para metadatos Ecore)
 * - xmlns:prefix="nsURI" para instancias M1
 * - eSuperTypes como inline attribute (xsi:type)
 * - eOpposite como fragment path "#//ClassName/featureName"
 * - EDataType href para primitivas estándar
 * - Fragment paths para cross-references
 */
import { EListImpl } from '../util/EList.js';
// ============================================================
// Constantes
// ============================================================
const XMI_NS = 'http://www.omg.org/XMI';
const XMI_VERSION = '2.0';
const ECORE_NS = 'http://www.eclipse.org/emf/2002/Ecore';
const XSI_NS = 'http://www.w3.org/2001/XMLSchema-instance';
// Mapeo de EDataType primitivos Ecore a hrefs
const ECORE_DATA_TYPE_HREF = {
    EString: 'http://www.eclipse.org/emf/2002/Ecore#//EString',
    EBoolean: 'http://www.eclipse.org/emf/2002/Ecore#//EBoolean',
    EInt: 'http://www.eclipse.org/emf/2002/Ecore#//EInt',
    ELong: 'http://www.eclipse.org/emf/2002/Ecore#//ELong',
    EFloat: 'http://www.eclipse.org/emf/2002/Ecore#//EFloat',
    EDouble: 'http://www.eclipse.org/emf/2002/Ecore#//EDouble',
    EByte: 'http://www.eclipse.org/emf/2002/Ecore#//EByte',
    EByteArray: 'http://www.eclipse.org/emf/2002/Ecore#//EByteArray',
    EChar: 'http://www.eclipse.org/emf/2002/Ecore#//EChar',
    EShort: 'http://www.eclipse.org/emf/2002/Ecore#//EShort',
    EBigDecimal: 'http://www.eclipse.org/emf/2002/Ecore#//EBigDecimal',
    EBigInteger: 'http://www.eclipse.org/emf/2002/Ecore#//EBigInteger',
    EDate: 'http://www.eclipse.org/emf/2002/Ecore#//EDate',
    EJavaObject: 'http://www.eclipse.org/emf/2002/Ecore#//EJavaObject',
    EJavaClass: 'http://www.eclipse.org/emf/2002/Ecore#//EJavaClass',
};
// ============================================================
// Helpers XML
// ============================================================
/**
 * Escapa caracteres especiales XML en un string.
 */
function escapeXml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
/**
 * Serializa un valor de atributo a string XML.
 */
function attributeValueToString(value, eDataType) {
    if (value === null || value === undefined)
        return '';
    if (typeof value === 'boolean')
        return value ? 'true' : 'false';
    if (typeof value === 'number') {
        if (Number.isInteger(value))
            return value.toString();
        return value.toString();
    }
    if (value instanceof Date)
        return value.toISOString();
    if (typeof value === 'string')
        return value;
    // Arrays (byte arrays)
    if (Array.isArray(value)) {
        return value.map(v => String(v)).join(' ');
    }
    return String(value);
}
/**
 * Convierte un valor de string XML a un valor tipado.
 */
function stringToAttributeValue(str, eDataType) {
    if (str === '' || str === undefined || str === null)
        return null;
    if (!eDataType)
        return str;
    const typeName = eDataType.name;
    switch (typeName) {
        case 'EString':
            return str;
        case 'EBoolean':
            return str.toLowerCase() === 'true';
        case 'EInt':
            return parseInt(str, 10);
        case 'ELong':
        case 'EFloat':
        case 'EDouble':
            return Number(str);
        case 'EByte':
        case 'EShort':
            return parseInt(str, 10);
        case 'EChar':
            return str.charAt(0);
        case 'EDate':
            return new Date(str);
        default:
            return str;
    }
}
// ============================================================
// Serialización a XMI
// ============================================================
/**
 * Serializa un EObject a XMI 2.0.
 *
 * @param obj - El EObject raíz a serializar
 * @param options - Opciones de serialización
 * @param options.nsURI - nsURI para el namespace del modelo (por defecto usa el del paquete)
 * @param options.nsPrefix - nsPrefix para el namespace del modelo (por defecto usa el del paquete)
 * @returns String XMI 2.0
 */
export function serializeToXMI(obj, options) {
    const eClass = obj.eClass();
    const pkg = eClass.ePackage;
    const nsURI = options?.nsURI ?? (pkg ? pkg.nsURI : '');
    const nsPrefix = options?.nsPrefix ?? (pkg ? pkg.nsPrefix : '');
    // Recopilar todos los namespace necesarios
    const namespaces = collectNamespaces(obj);
    // Generar declaraciones xmlns
    const xmlnsDeclarations = [];
    xmlnsDeclarations.push(`xmlns:xmi="${XMI_NS}"`);
    xmlnsDeclarations.push(`xmlns:xsi="${XSI_NS}"`);
    // Siempre incluir xmlns:ecore para metadatos del metamodelo Ecore
    xmlnsDeclarations.push(`xmlns:ecore="${ECORE_NS}"`);
    // Si el modelo tiene su propio nsURI, agregarlo
    if (nsURI && nsPrefix) {
        const xmlnsKey = `xmlns:${nsPrefix}`;
        if (!xmlnsDeclarations.some(d => d.startsWith(xmlnsKey + '='))) {
            xmlnsDeclarations.push(`${xmlnsKey}="${nsURI}"`);
        }
    }
    // Namespaces adicionales de paquetes referenciados (instancias M1)
    for (const [prefix, uri] of Object.entries(namespaces)) {
        const xmlnsKey = `xmlns:${prefix}`;
        if (!xmlnsDeclarations.some(d => d.startsWith(xmlnsKey + '='))) {
            xmlnsDeclarations.push(`${xmlnsKey}="${uri}"`);
        }
    }
    // Serializar contenido
    const visited = new Set();
    const bodyLines = [];
    serializeToXMILines(obj, nsPrefix, visited, bodyLines, 0);
    // Inyectar xmlns en el elemento raíz
    const xmiHeader = `<?xml version="1.0" encoding="UTF-8"?>`;
    if (bodyLines.length > 0) {
        // bodyLines[0] es el opening del elemento raíz (e.g., <handletestmm:EPackage ...>)
        // Inyectamos xmlns entre xmi:version y el resto de atributos
        const firstLine = bodyLines[0];
        // Buscar dónde insertar xmlns (después del nombre del tag y antes de >)
        const tagEnd = firstLine.lastIndexOf('>');
        if (tagEnd > 0 && firstLine.startsWith('<')) {
            const tagNameEnd = firstLine.indexOf(' ');
            if (tagNameEnd > 0) {
                const before = firstLine.substring(0, tagNameEnd);
                const after = firstLine.substring(tagNameEnd);
                bodyLines[0] = `${before} xmi:version="${XMI_VERSION}" ${xmlnsDeclarations.join(' ')}${after}`;
            }
        }
    }
    const lines = [xmiHeader, ...bodyLines];
    return lines.join('\n');
}
/**
 * Recopila todos los prefijos de namespace necesarios para el objeto y sus hijos.
 */
function collectNamespaces(obj) {
    const namespaces = {};
    const visited = new Set();
    collectNamespacesInternal(obj, visited, namespaces);
    return namespaces;
}
function collectNamespacesInternal(obj, visited, namespaces) {
    if (visited.has(obj))
        return;
    visited.add(obj);
    const eClass = obj.eClass();
    const pkg = eClass.ePackage;
    if (pkg && pkg.nsURI && pkg.nsPrefix) {
        if (!namespaces[pkg.nsPrefix]) {
            namespaces[pkg.nsPrefix] = pkg.nsURI;
        }
    }
    // Recorrer features
    for (const feature of eClass.eAllStructuralFeatures) {
        if (feature.transient || feature.derived || feature.volatile)
            continue;
        if ('containment' in feature) {
            const ref = feature;
            const value = obj.eGet(ref);
            if (ref.containment) {
                if (ref.many) {
                    for (const item of Array.from(value)) {
                        if (item)
                            collectNamespacesInternal(item, visited, namespaces);
                    }
                }
                else if (value) {
                    collectNamespacesInternal(value, visited, namespaces);
                }
            }
            else {
                // Non-containment: también puede tener namespace del tipo referenciado
                if (ref.eReferenceType) {
                    const refPkg = ref.eReferenceType.ePackage;
                    if (refPkg && refPkg.nsURI && refPkg.nsPrefix && !namespaces[refPkg.nsPrefix]) {
                        namespaces[refPkg.nsPrefix] = refPkg.nsURI;
                    }
                }
            }
        }
    }
}
/**
 * Obtiene el nombre de tag XMI para una EClass.
 */
function getXMITagName(eClass, defaultPrefix) {
    const pkg = eClass.ePackage;
    if (pkg && pkg.nsPrefix) {
        return `${pkg.nsPrefix}:${eClass.name}`;
    }
    if (defaultPrefix) {
        return `${defaultPrefix}:${eClass.name}`;
    }
    return eClass.name;
}
/**
 * Serializa un EObject a líneas XMI recursivamente.
 *
 * @param obj - El EObject a serializar
 * @param nsPrefix - Prefijo de namespace por defecto
 * @param visited - Set de objetos ya serializados (para evitar ciclos)
 * @param lines - Array de líneas de salida
 * @param depth - Profundidad de indentación
 * @param featureName - Nombre del feature contenedor (si es hijo); se usa como tag XML
 * @param parentFeature - Feature de referencia del padre (para determinar xsi:type)
 */
function serializeToXMILines(obj, nsPrefix, visited, lines, depth, featureName, parentFeature) {
    if (visited.has(obj)) {
        // Ya serializado — emitiir referencia
        const ref = getXMIReference(obj, nsPrefix);
        const indent = '  '.repeat(depth);
        lines.push(`${indent}${ref}`);
        return;
    }
    visited.add(obj);
    const eClass = obj.eClass();
    // Si hay featureName, usarlo como nombre del tag; si no, usar prefijo:EClassName
    let tagName;
    if (featureName) {
        tagName = featureName;
    }
    else {
        tagName = getXMITagName(eClass, nsPrefix);
    }
    const indent = '  '.repeat(depth);
    // Recopilar atributos
    const attrs = [];
    const childElements = [];
    // Atributo xmi:id — solo para EClassifiers (EClass, EEnum, EDataType) y EPackage
    // Features (EAttribute, EReference) NO llevan xmi:id en Eclipse
    const eClassName = eClass.name;
    const isClassifier = eClassName === 'EClass' || eClassName === 'EEnum' || eClassName === 'EDataType' || eClassName === 'EPackage';
    if (isClassifier) {
        const objName = obj.name;
        if (objName && typeof objName === 'string') {
            attrs.push(`xmi:id="${escapeXml(objName)}"`);
        }
    }
    // xsi:type para elementos hijo — siempre para eClassifiers (el parser lo necesita)
    if (featureName && parentFeature) {
        const declaredType = parentFeature.eReferenceType;
        if (declaredType && (declaredType !== eClass || featureName === 'eClassifiers')) {
            const pkg = eClass.ePackage;
            const prefix = pkg?.nsPrefix ?? nsPrefix;
            attrs.push(`xsi:type="${prefix}:${eClass.name}"`);
        }
    }
    // eSuperTypes como inline attribute (solo para EClass)
    if ('eSuperTypes' in obj) {
        const eClassObj = obj;
        const supTypes = eClassObj.eSuperTypes;
        if (supTypes && supTypes.length > 0) {
            const supRefs = eClassObj.eSuperTypes
                .map(sup => {
                const name = sup.name;
                return name ? `#//${name}` : getXMIReference(sup, nsPrefix);
            })
                .join(' ');
            attrs.push(`eSuperTypes="${escapeXml(supRefs)}"`);
        }
    }
    // abstract/interface para EClass
    if ('abstract' in obj) {
        const eClassObj = obj;
        if (eClassObj.abstract) {
            attrs.push('abstract="true"');
        }
        if (eClassObj.interface) {
            attrs.push('interface="true"');
        }
    }
    // eOpposite como fragment path (para EReference)
    if ('eOpposite' in obj) {
        const ref = obj;
        if (ref.eOpposite) {
            const oppEClass = ref.eOpposite.eContainingClass;
            if (oppEClass) {
                const fragmentPath = `#//${oppEClass.name}/${ref.eOpposite.name}`;
                attrs.push(`eOpposite="${escapeXml(fragmentPath)}"`);
            }
        }
    }
    // EDataType href (para EDataType primitivos — NOT EEnum which also has 'serializable')
    if ('serializable' in obj && !('eLiterals' in obj)) {
        const dt = obj;
        if (dt.name in ECORE_DATA_TYPE_HREF) {
            attrs.push(`href="${ECORE_DATA_TYPE_HREF[dt.name]}"`);
        }
        else {
            // Para EDataType personalizados, href al clasificador en su paquete
            const pkg = dt.ePackage;
            if (pkg && pkg.nsURI) {
                attrs.push(`href="${pkg.nsURI}#//${dt.name}"`);
            }
        }
    }
    // Procesar features estructurales
    for (const feature of eClass.eAllStructuralFeatures) {
        if (feature.transient || feature.derived || feature.volatile)
            continue;
        const value = obj.eGet(feature);
        if (feature.eReferenceType != null) {
            const ref = feature;
            if (feature.name === 'eType') {
                // eType: formato especial según el tipo de elemento
                if (value != null) {
                    const typedObj = value;
                    const typedName = typedObj.name || '';
                    if ('containment' in obj) {
                        // EReference: eType -> "#//ClassName"
                        attrs.push(`eType="#//${typedName}"`);
                    }
                    else if ('iD' in obj) {
                        // EAttribute: eType -> "ecore:EDataType href"
                        if (typedName in ECORE_DATA_TYPE_HREF) {
                            attrs.push(`eType="ecore:EDataType ${ECORE_DATA_TYPE_HREF[typedName]}"`);
                        }
                        else if ('eLiterals' in typedObj) {
                            // Local EEnum — use fragment path
                            attrs.push(`eType="#//${typedName}"`);
                        }
                        else {
                            // Custom EDataType — check if it's in the same package (local) or external
                            const typePkg = typedObj.ePackage;
                            if (typePkg && typePkg.nsURI && typePkg.nsURI !== ECORE_NS) {
                                // External custom datatype
                                attrs.push(`eType="ecore:EDataType ${typePkg.nsURI}#//${typedName}"`);
                            }
                            else {
                                // Local custom type — use fragment path
                                attrs.push(`eType="#//${typedName}"`);
                            }
                        }
                    }
                    else {
                        attrs.push(`eType="${escapeXml(getXMIReference(typedObj, nsPrefix))}"`);
                    }
                }
                continue;
            }
            if (ref.containment) {
                // Containment: serializar como elementos hijo
                if (ref.many) {
                    const list = Array.from(value).filter(v => v != null);
                    if (list.length > 0) {
                        childElements.push({ name: feature.name, isMany: true, items: list });
                    }
                }
                else {
                    if (value != null) {
                        childElements.push({ name: feature.name, isMany: false, items: [value] });
                    }
                }
            }
            else {
                // Non-containment: serializar como atributo (fragment path)
                if (feature.name === 'eSuperTypes')
                    continue; // manejado por el bloque especial
                if (ref.many) {
                    const list = Array.from(value).filter(v => v != null);
                    if (list.length > 0) {
                        const paths = list
                            .map(item => getXMIReference(item, nsPrefix))
                            .join(' ');
                        attrs.push(`${feature.name}="${escapeXml(paths)}"`);
                    }
                }
                else {
                    if (value != null) {
                        // Para EAnnotation.eModelElement y references, emitir como fragment path
                        if (feature.name === 'eModelElement' || feature.name === 'references') {
                            // Estos son cross-references a otros objetos — se emiten como fragment path
                            const refPath = getXMIReference(value, nsPrefix);
                            attrs.push(`${feature.name}="${escapeXml(refPath)}"`);
                        }
                        else {
                            attrs.push(`${feature.name}="${escapeXml(getXMIReference(value, nsPrefix))}"`);
                        }
                    }
                }
            }
        }
        else if ('iD' in feature) {
            // EAttribute
            const attr = feature;
            if (attr.many) {
                const list = Array.from(value).filter(v => v != null);
                if (list.length > 0) {
                    const strValues = list
                        .map(v => attributeValueToString(v, attr.eAttributeType))
                        .join(' ');
                    attrs.push(`${feature.name}="${escapeXml(strValues)}"`);
                }
            }
            else {
                if (value != null && value !== undefined) {
                    const strValue = attributeValueToString(value, attr.eAttributeType);
                    // Skip default values that Eclipse omits
                    if (feature.name === 'lowerBound' && strValue === '0')
                        continue;
                    if (feature.name === 'upperBound' && strValue === '1')
                        continue;
                    if (feature.name === 'iD' && strValue === 'false')
                        continue;
                    if (feature.name === 'changeable' && strValue === 'true')
                        continue;
                    if (feature.name === 'derived' && strValue === 'false')
                        continue;
                    if (feature.name === 'transient' && strValue === 'false')
                        continue;
                    if (feature.name === 'defaultValueLiteral' && strValue === '')
                        continue;
                    if (feature.name === 'serializable' && strValue === 'true')
                        continue;
                    if (feature.name === 'containment' && strValue === 'false')
                        continue;
                    if (feature.name === 'value' && strValue === '0')
                        continue;
                    attrs.push(`${feature.name}="${escapeXml(strValue)}"`);
                }
            }
        }
    }
    // EAnnotation details: serializar como hijos <details key="..." value="..."/>
    const rawChildLines = [];
    if ('details' in obj && obj.eClass().name === 'EAnnotation') {
        const details = obj.details;
        if (details && typeof details === 'object' && !Array.isArray(details)) {
            for (const [key, value] of Object.entries(details)) {
                rawChildLines.push(`<details key="${escapeXml(key)}" value="${escapeXml(value)}"/>`);
            }
        }
    }
    // Emitir el elemento
    if (childElements.length === 0 && rawChildLines.length === 0) {
        // Self-closing tag
        if (attrs.length > 0) {
            lines.push(`${indent}<${tagName} ${attrs.join(' ')}/>`);
        }
        else {
            lines.push(`${indent}<${tagName}/>`);
        }
    }
    else {
        // Tag con hijos
        if (attrs.length > 0) {
            lines.push(`${indent}<${tagName} ${attrs.join(' ')}>`);
        }
        else {
            lines.push(`${indent}<${tagName}>`);
        }
        // Emitir hijos EObject (containment)
        for (const child of childElements) {
            // Buscar el feature EReference del padre para pasar parentFeature
            const childFeatureRef = eClass.eAllStructuralFeatures.find(f => f.name === child.name && 'containment' in f && f.containment);
            if (child.isMany) {
                for (const item of child.items) {
                    serializeToXMILines(item, nsPrefix, visited, lines, depth + 1, child.name, childFeatureRef);
                }
            }
            else {
                serializeToXMILines(child.items[0], nsPrefix, visited, lines, depth + 1, child.name, childFeatureRef);
            }
        }
        // Emitir líneas XML raw (EAnnotation details)
        for (const rawLine of rawChildLines) {
            lines.push(`${indent}  ${rawLine}`);
        }
        lines.push(`${indent}</${tagName}>`);
    }
}
/**
 * Obtiene una referencia XMI (fragment path) para un EObject.
 */
function getXMIReference(obj, defaultPrefix) {
    const eClass = obj.eClass();
    const pkg = eClass.ePackage;
    // Para objetos Ecore (metamodelo), usar ecore: prefix
    if (pkg && pkg.nsURI === ECORE_NS) {
        const name = obj.name;
        if (name && typeof name === 'string') {
            return `ecore:${eClass.name} ${name}`;
        }
        return `ecore:${eClass.name}`;
    }
    // Para objetos del modelo, usar namespace del paquete
    const prefix = pkg?.nsPrefix ?? defaultPrefix;
    const name = obj.name;
    if (name && typeof name === 'string') {
        return `${prefix}:${eClass.name} ${name}`;
    }
    return `${prefix ?? 'ecore'}:${eClass.name}`;
}
// ============================================================
// Deserialización desde XMI
// ============================================================
/**
 * Deserializa un EObject desde XMI 2.0.
 *
 * @param xml - String XML en formato XMI 2.0
 * @param registry - PackageRegistry para resolver paquetes por nsURI
 * @returns El EObject deserializado
 */
export function deserializeFromXMI(xml, registry) {
    // Parsear XML básico (sin dependencias externas)
    const parser = new XMIParser(xml, registry);
    return parser.parse();
}
// ============================================================
// Parser XMI (sin dependencias externas)
// ============================================================
/**
 * Parser XML/XMI mínimo para deserialización.
 */
class XMIParser {
    xml;
    pos = 0;
    registry;
    namespaces = {};
    allObjects = new Map();
    allObjectsByQName = new Map();
    allObjectsByName = new Map();
    constructor(xml, registry) {
        this.xml = xml;
        this.registry = registry;
    }
    parse() {
        this.namespaces = {};
        this.allObjects = new Map();
        this.allObjectsByQName = new Map();
        // Leer declaración XML (opcional)
        this.skipWhitespace();
        if (this.peek() === '<' && this.xml.substring(this.pos, this.pos + 2) === '<?') {
            this.skipXmlDeclaration();
        }
        // Leer elemento raíz
        this.skipWhitespace();
        const rootEl = this.parseElement();
        // Procesar namespaces del elemento raíz
        if (rootEl.attrs) {
            for (const [key, value] of Object.entries(rootEl.attrs)) {
                if (key === 'xmi:version')
                    continue;
                if (key.startsWith('xmlns:')) {
                    const prefix = key.substring(6); // Remove 'xmlns:'
                    this.namespaces[prefix] = value;
                }
            }
        }
        // Construir objetos bottom-up: primero procesar hijos, luego padres
        const root = this.buildEObject(rootEl);
        return root;
    }
    /**
     * Construye un EObject a partir de un elemento XMI parseado.
     */
    buildEObject(el, parentEClass) {
        const eClass = resolveEClassFromXMITag(el.name, this, this.registry, el.attrs, parentEClass);
        if (!eClass) {
            throw new Error(`Cannot resolve EClass for XMI element: ${el.name}`);
        }
        const factory = eClass.ePackage?.eFactoryInstance;
        const obj = factory ? factory.create(eClass) : createMinimalEObject(eClass);
        // Inicializar contenedor details para EAnnotation (no es una feature EMF, es un Record)
        if (eClass.name === 'EAnnotation') {
            obj.details = {};
        }
        // Registrar por xmi:id
        const xmiId = el.attrs['xmi:id'];
        if (xmiId) {
            this.allObjects.set(xmiId, obj);
        }
        // Registrar por qname (nsPrefix:ClassName name) para referencias
        const nameAttr = el.attrs['name'];
        const tagParts = el.name.split(':');
        const tagPrefix = tagParts.length > 1 ? tagParts[0] : '';
        const tagClassName = tagParts.length > 1 ? tagParts[1] : tagParts[0];
        if (tagPrefix && nameAttr) {
            const qname = `${tagPrefix}:${tagClassName} ${nameAttr}`;
            this.allObjectsByQName.set(qname, obj);
        }
        // Registrar por nombre simple para referencias intra-documento (#//Name)
        if (nameAttr) {
            this.allObjectsByName.set(nameAttr, obj);
        }
        // Procesar atributos del elemento
        setAttributesFromXMIAttrs(obj, eClass, el.attrs, this, this.registry);
        // Procesar eSuperTypes inline
        if (el.attrs['eSuperTypes'] && 'eSuperTypes' in obj) {
            const supRefs = el.attrs['eSuperTypes'].split(/\s+/);
            const supTypes = [];
            for (const supRef of supRefs) {
                const sup = resolveEClassFromXMIReference(supRef, this, this.registry);
                if (sup) {
                    supTypes.push(sup);
                }
            }
            obj.eSuperTypes = supTypes;
        }
        // Procesar eOpposite como fragment path
        if (el.attrs['eOpposite'] && 'eOpposite' in obj) {
            const fragmentPath = el.attrs['eOpposite'];
            // Formato: "#//ClassName/featureName"
            const match = fragmentPath.match(/^#\/\/([^/]+)\/(.+)$/);
            if (match) {
                const oppClassName = match[1];
                const oppFeatureName = match[2];
                // Buscar la EClass opuesta en el paquete de la EClass actual
                const currentEClass = obj.eClass();
                const pkg = currentEClass.ePackage;
                if (pkg) {
                    const classifier = pkg.getEClassifier(oppClassName);
                    if (classifier && 'eStructuralFeatures' in classifier) {
                        const oppClass = classifier;
                        const oppFeature = oppClass.eStructuralFeatures.find(f => f.name === oppFeatureName);
                        if (oppFeature && 'eOpposite' in oppFeature) {
                            obj.eOpposite = oppFeature;
                        }
                    }
                }
            }
        }
        // Procesar hijos (containment)
        for (const childEl of el.children) {
            // Si el hijo tiene tag 'details' y el padre es EAnnotation, manejarlo como entry detail
            if (childEl.name === 'details') {
                const parentEClass = obj.eClass();
                if (parentEClass && parentEClass.name === 'EAnnotation') {
                    const key = childEl.attrs['key'] || '';
                    const value = childEl.attrs['value'] || '';
                    const details = obj.details;
                    if (details && typeof details === 'object') {
                        details[key] = value;
                    }
                    continue;
                }
            }
            const child = this.buildEObject(childEl, eClass);
            // Determinar qué feature contiene a este hijo
            const childEClass = child.eClass();
            const feature = findContainmentFeature(eClass, childEClass, childEl.name);
            if (feature) {
                const existing = obj.eGet(feature);
                if (feature.many) {
                    if (Array.isArray(existing)) {
                        const list = existing;
                        list.push(child);
                    }
                    else if (existing && typeof existing.add === 'function') {
                        existing.add(child);
                    }
                    else {
                        obj.eSet(feature, [child]);
                    }
                }
                else {
                    obj.eSet(feature, child);
                }
            }
        }
        return obj;
    }
    skipWhitespace() {
        while (this.pos < this.xml.length && /\s/.test(this.xml[this.pos])) {
            this.pos++;
        }
    }
    skipXmlDeclaration() {
        const end = this.xml.indexOf('?>', this.pos);
        if (end >= 0) {
            this.pos = end + 2;
        }
    }
    peek() {
        return this.pos < this.xml.length ? this.xml[this.pos] : '';
    }
    peekN(n) {
        return this.xml.substring(this.pos, this.pos + n);
    }
    consumeChar() {
        return this.xml[this.pos++];
    }
    expectChar(ch) {
        const c = this.consumeChar();
        if (c !== ch) {
            throw new Error(`Expected '${ch}' but found '${c}' at position ${this.pos}`);
        }
    }
    /**
     * Parsea un nombre XML (tag o attribute name).
     */
    parseName() {
        this.skipWhitespace();
        let name = '';
        while (this.pos < this.xml.length && /[a-zA-Z0-9_:.\-]/.test(this.xml[this.pos])) {
            name += this.xml[this.pos++];
        }
        return name;
    }
    /**
     * Parsea el valor de un atributo (entre comillas).
     */
    parseAttributeValue() {
        this.skipWhitespace();
        this.expectChar('"');
        let value = '';
        while (this.pos < this.xml.length) {
            const ch = this.xml[this.pos];
            if (ch === '"') {
                this.pos++;
                return value;
            }
            if (ch === '&') {
                value += this.parseEntity();
            }
            else {
                value += ch;
                this.pos++;
            }
        }
        throw new Error('Unterminated attribute value');
    }
    /**
     * Parsea una entidad XML.
     */
    parseEntity() {
        const start = this.pos;
        const end = this.xml.indexOf(';', start);
        if (end < 0)
            throw new Error('Unterminated XML entity');
        const entity = this.xml.substring(start, end + 1);
        this.pos = end + 1;
        switch (entity) {
            case '&amp;': return '&';
            case '&lt;': return '<';
            case '&gt;': return '>';
            case '&quot;': return '"';
            case '&apos;': return "'";
            default:
                // Soporte para entidades numéricas &#xx; y &#xHH;
                if (entity.startsWith('&#x')) {
                    return String.fromCodePoint(parseInt(entity.substring(3, entity.length - 1), 16));
                }
                if (entity.startsWith('&#')) {
                    return String.fromCodePoint(parseInt(entity.substring(2, entity.length - 1), 10));
                }
                return entity;
        }
    }
    /**
     * Parsea un elemento XML completo (con o sin hijos).
     */
    parseElement() {
        this.skipWhitespace();
        this.expectChar('<');
        const el = {
            name: '',
            attrs: {},
            children: [],
            text: '',
        };
        // Si es comentario, saltarlo
        if (this.peekN(3) === '!--') {
            this.pos += 3;
            const endComment = this.xml.indexOf('-->', this.pos);
            if (endComment >= 0) {
                this.pos = endComment + 3;
            }
            return this.parseElement(); // Recursivo: siguiente elemento
        }
        el.name = this.parseName();
        // Parsea atributos
        this.skipWhitespace();
        while (this.pos < this.xml.length && this.peek() !== '>' && this.peekN(2) !== '/>') {
            if (this.peek() === '/')
                break;
            const attrName = this.parseName();
            if (!attrName)
                break;
            this.skipWhitespace();
            if (this.peek() === '=') {
                this.pos++; // skip '='
                const attrValue = this.parseAttributeValue();
                el.attrs[attrName] = attrValue;
            }
            this.skipWhitespace();
        }
        // Self-closing tag
        if (this.peekN(2) === '/>') {
            this.pos += 2;
            return el;
        }
        this.expectChar('>');
        // Parsear hijos (texto y elementos)
        let text = '';
        while (this.pos < this.xml.length && this.peekN(2) !== '</') {
            if (this.peek() === '<') {
                // Hijo elemento
                if (text.trim()) {
                    el.text = text.trim();
                    text = '';
                }
                const child = this.parseElement();
                el.children.push(child);
            }
            else {
                // Texto
                text += this.consumeChar();
            }
        }
        if (text.trim()) {
            el.text = text.trim();
        }
        // Closing tag
        this.skipWhitespace();
        this.expectChar('<');
        this.expectChar('/');
        const closeName = this.parseName();
        // Verificar que coincida
        if (closeName !== el.name) {
            // En XMI a veces los namespaces varían; intentar coincidencia flexible
            const closeSimple = closeName.includes(':') ? closeName.split(':')[1] : closeName;
            const elSimple = el.name.includes(':') ? el.name.split(':')[1] : el.name;
            if (closeSimple !== elSimple) {
                throw new Error(`Mismatched tags: opening ${el.name}, closing ${closeName} at pos ${this.pos}`);
            }
        }
        this.skipWhitespace();
        this.expectChar('>');
        return el;
    }
}
// ============================================================
// Building EObjects from XMI
// ============================================================
/**
 * Encuentra la referencia de containment que puede contener un objeto de childEClass.
 * Primero empareja por compatibilidad de tipos; como fallback empareja por nombre del feature.
 */
function findContainmentFeature(eClass, childEClass, childTagName) {
    // Primero buscar por compatibilidad de tipos
    for (const feature of eClass.eAllStructuralFeatures) {
        if (!('containment' in feature))
            continue;
        const ref = feature;
        if (!ref.containment)
            continue;
        if (childEClass) {
            const refType = ref.eReferenceType;
            if (refType === childEClass || childEClass.eAllSuperTypes?.includes(refType) || refType?.eAllSuperTypes?.includes(childEClass)) {
                return ref;
            }
        }
    }
    // Fallback: buscar por nombre del tag del elemento hijo (feature name)
    if (childTagName) {
        for (const feature of eClass.eAllStructuralFeatures) {
            if (!('containment' in feature))
                continue;
            const ref = feature;
            if (!ref.containment)
                continue;
            if (feature.name === childTagName) {
                return ref;
            }
        }
    }
    return null;
}
/**
 * Establece atributos EMF desde los atributos XMI de un elemento.
 */
function setAttributesFromXMIAttrs(obj, eClass, attrs, parser, registry) {
    for (const [attrName, attrValue] of Object.entries(attrs)) {
        // Saltar atributos XMI/xsi especiales
        if (attrName.startsWith('xmi:') || attrName.startsWith('xsi:') || attrName === 'href')
            continue;
        if (attrName === 'eSuperTypes' || attrName === 'eOpposite')
            continue;
        // Buscar el feature correspondiente
        const feature = eClass.getEStructuralFeature(attrName);
        if (!feature)
            continue;
        // Saltar containment features (se manejan como hijos)
        if (feature.containment)
            continue;
        // EAttribute: tiene eAttributeType, NO eReferenceType
        if (feature.eReferenceType != null) {
            // Non-containment reference
            const ref = feature;
            // eType: formato especial en XMI 2.0 compatible con EMF
            if (attrName === 'eType') {
                if ('iD' in obj) {
                    // EAttribute: eType="ecore:EDataType http://...#//ETypeName"
                    // Extraer el nombre del tipo desde el href
                    const hashIndex = attrValue.lastIndexOf('#//');
                    if (hashIndex >= 0) {
                        const typeName = attrValue.substring(hashIndex + 3);
                        // Buscar en objetos creados
                        let resolved = null;
                        const existingObjects = parser ? Array.from(parser.allObjects.values()) : [];
                        for (const existingObj of existingObjects) {
                            if (existingObj.name === typeName && existingObj.eClass().name === 'EDataType') {
                                resolved = existingObj;
                                break;
                            }
                        }
                        if (!resolved && registry) {
                            // Buscar en el registry Ecore
                            const ecorePkg = registry.getEPackage(ECORE_NS);
                            if (ecorePkg) {
                                const classifier = ecorePkg.getEClassifier(typeName);
                                if (classifier)
                                    resolved = classifier;
                            }
                        }
                        if (resolved)
                            obj.eSet(ref, resolved);
                    }
                    else {
                        // Fallback: formato simple "ecore:EDataType name"
                        const resolved = resolveXMIReference(attrValue, parser, registry);
                        if (resolved)
                            obj.eSet(ref, resolved);
                    }
                }
                else if ('containment' in obj) {
                    // EReference: eType="#//ClassName"
                    const className = attrValue.replace('#//', '');
                    // Buscar la EClass en el paquete del objeto actual
                    const currentEClass = obj.eClass();
                    const pkg = currentEClass.ePackage;
                    let resolved = null;
                    if (pkg) {
                        const classifier = pkg.getEClassifier(className);
                        if (classifier)
                            resolved = classifier;
                    }
                    if (!resolved && registry) {
                        // Fallback: buscar en todos los paquetes
                        for (const p of registry.values()) {
                            const classifier = p.getEClassifier(className);
                            if (classifier) {
                                resolved = classifier;
                                break;
                            }
                        }
                    }
                    if (resolved)
                        obj.eSet(ref, resolved);
                }
                else {
                    const resolved = resolveXMIReference(attrValue, parser, registry);
                    if (resolved)
                        obj.eSet(ref, resolved);
                }
                continue;
            }
            if (ref.many) {
                const paths = attrValue.split(/\s+/).filter(p => p.length > 0);
                const resolvedObjects = [];
                for (const path of paths) {
                    const resolved = resolveXMIReference(path, parser, registry);
                    if (resolved)
                        resolvedObjects.push(resolved);
                }
                if (resolvedObjects.length > 0) {
                    obj.eSet(ref, resolvedObjects);
                }
            }
            else {
                const resolved = resolveXMIReference(attrValue, parser, registry);
                if (resolved) {
                    obj.eSet(ref, resolved);
                }
            }
        }
        else if ('iD' in feature) {
            // EAttribute
            const attr = feature;
            const deserialized = stringToAttributeValue(attrValue, attr.eAttributeType);
            obj.eSet(attr, deserialized);
        }
    }
}
/**
 * Resuelve una referencia XMI a un EObject.
 */
function resolveXMIReference(ref, parser, registry) {
    // Formato: "nsPrefix:EClassName name" o "ecore:EClass name"
    const parts = ref.split(/\s+/);
    if (parts.length < 1)
        return null;
    const typePart = parts[0]; // e.g., "ecore:EClass"
    const namePart = parts.length > 1 ? parts.slice(1).join(' ') : '';
    // Buscar en objetos ya creados por xmi:id
    if (parser && parser.allObjects.has(ref)) {
        return parser.allObjects.get(ref);
    }
    // Buscar por qname (nsPrefix:ClassName name)
    if (parser && namePart) {
        const qname = `${typePart} ${namePart}`;
        if (parser.allObjectsByQName.has(qname)) {
            return parser.allObjectsByQName.get(qname);
        }
    }
    // Buscar en registry como referencia a EClass (para metadatos)
    // Formato simplificado: "ecore:EClass"
    return null;
}
/**
 * Resuelve una EClass desde un tag XMI (e.g. "ecore:EClass", "mypkg:MyClass").
 * Primero verifica el atributo xsi:type (para elementos con tag basado en feature name).
 * Luego intenta resolver el tag directamente como prefijo:ClassName.
 */
function resolveEClassFromXMITag(tagName, parser, registry, attrs, parentEClass) {
    // 1. Verificar xsi:type primero (p.ej. xsi:type="ecore:EAttribute")
    if (attrs && attrs['xsi:type']) {
        const xsiType = attrs['xsi:type'];
        const parts = xsiType.split(':');
        const prefix = parts.length > 1 ? parts[0] : '';
        const className = parts.length > 1 ? parts[1] : parts[0];
        let nsURI = '';
        if (parser && parser.namespaces[prefix]) {
            nsURI = parser.namespaces[prefix];
        }
        else if (prefix === 'ecore') {
            nsURI = ECORE_NS;
        }
        if (registry && nsURI) {
            const pkg = registry.getEPackage(nsURI);
            if (pkg) {
                const classifier = pkg.getEClassifier(className);
                if (classifier && 'eSuperTypes' in classifier) {
                    return classifier;
                }
            }
        }
        // Fallback: buscar en todos los paquetes
        if (registry) {
            for (const pkg of registry.values()) {
                const classifier = pkg.getEClassifier(className);
                if (classifier && 'eSuperTypes' in classifier) {
                    return classifier;
                }
            }
        }
    }
    // 2. Intentar resolver el tag como prefijo:ClassName
    const parts = tagName.split(':');
    const prefix = parts.length > 1 ? parts[0] : '';
    const className = parts.length > 1 ? parts[1] : parts[0];
    // Resolver nsURI desde el prefijo
    let nsURI = '';
    if (parser && parser.namespaces[prefix]) {
        nsURI = parser.namespaces[prefix];
    }
    else if (prefix === 'ecore') {
        nsURI = ECORE_NS;
    }
    // Buscar el paquete
    if (registry && nsURI) {
        const pkg = registry.getEPackage(nsURI);
        if (pkg) {
            const classifier = pkg.getEClassifier(className);
            if (classifier && 'eSuperTypes' in classifier) {
                return classifier;
            }
        }
    }
    // Fallback: buscar en todos los paquetes del registry
    if (registry) {
        for (const pkg of registry.values()) {
            const classifier = pkg.getEClassifier(className);
            if (classifier && 'eSuperTypes' in classifier) {
                return classifier;
            }
        }
    }
    // Fallback: buscar en los containment features del padre
    if (parentEClass) {
        const parentFeatures = parentEClass.eAllStructuralFeatures;
        if (parentFeatures) {
            for (const f of parentFeatures) {
                if (f.name === className && 'eReferenceType' in f && f.eReferenceType) {
                    return f.eReferenceType;
                }
            }
        }
    }
    return null;
}
/**
 * Resuelve una EClass desde una referencia XMI (e.g. "ecore:EClass").
 */
function resolveEClassFromXMIReference(ref, parser, registry) {
    // Formato: "ecore:EClass" o "ecore:EClass name"
    const parts = ref.split(/\s+/);
    if (parts.length < 1)
        return null;
    const typePart = parts[0]; // e.g., "ecore:EClass" or "#//Base"
    // Formato "#//ClassName": buscar por nombre en objetos ya creados
    if (typePart.startsWith('#//')) {
        const className = typePart.substring(3);
        if (parser) {
            // Buscar en allObjects por xmi:id
            const allObjects = Array.from(parser.allObjects.values());
            for (const obj of allObjects) {
                if (obj.name === className)
                    return obj;
            }
            // Buscar en allObjectsByQName (formato "prefix:TypeName Name")
            const qnameEntries = Array.from(parser.allObjectsByQName.entries());
            for (const [qname, obj] of qnameEntries) {
                if (qname.endsWith(' ' + className))
                    return obj;
            }
            // Buscar en allObjectsByName (registro por nombre simple)
            if (parser.allObjectsByName.has(className)) {
                return parser.allObjectsByName.get(className);
            }
        }
        return null;
    }
    // Intentar resolver usando el mismo método que los tags
    return resolveEClassFromXMITag(typePart, parser, registry);
}
// ============================================================
// Re-export de createMinimalEObject desde JSONSerializer
// ============================================================
/**
 * Crea un EObject mínimo sin fábrica.
 * Versión inline para auto-contención de XMISerializer.
 */
function createMinimalEObject(eClass) {
    const handler = {
        _eClass: eClass,
        _featureValues: new Map(),
        _isSet: new Set(),
        _lists: new Map(),
        _eContainer: null,
        _eContainingFeature: null,
        _eResource: null,
        _eAdapters: [],
        _eDeliver: true,
        _eGetList: (feature, fid) => {
            let list = handler._lists.get(fid);
            if (!list) {
                list = new EListImpl({ unique: true });
                handler._lists.set(fid, list);
            }
            return list;
        },
    };
    const proto = {
        eClass: () => eClass,
        eContainer: () => handler._eContainer,
        eContainingFeature: () => handler._eContainingFeature,
        eContainmentFeature: () => handler._eContainingFeature && 'containment' in handler._eContainingFeature
            ? handler._eContainingFeature
            : null,
        eResource: () => handler._eResource || (handler._eContainer ? handler._eContainer.eResource() : null),
        eContents: () => {
            const result = [];
            for (const f of eClass.eAllStructuralFeatures) {
                if (!('containment' in f))
                    continue;
                const ref = f;
                if (!ref.containment)
                    continue;
                const value = handler._featureValues.get(eClass.getFeatureID(f));
                if (ref.many && Array.isArray(value))
                    result.push(...value);
                else if (value)
                    result.push(value);
            }
            return result;
        },
        eAllContents: function* () {
            const stack = [...this.eContents()];
            while (stack.length > 0) {
                const current = stack.shift();
                stack.unshift(...current.eContents());
                yield current;
            }
        },
        eCrossReferences: () => {
            const result = [];
            for (const f of eClass.eAllStructuralFeatures) {
                if (!('containment' in f))
                    continue;
                const ref = f;
                if (ref.containment)
                    continue;
                const value = handler._featureValues.get(eClass.getFeatureID(f));
                if (ref.many && Array.isArray(value))
                    result.push(...value);
                else if (value)
                    result.push(value);
            }
            return result;
        },
        eGet: (feature, resolve) => {
            const fid = eClass.getFeatureID(feature);
            if (feature.many)
                return handler._eGetList(feature, fid);
            if (handler._featureValues.has(fid))
                return handler._featureValues.get(fid);
            return feature.defaultValue;
        },
        eSet: (feature, value) => {
            if (!feature.changeable)
                throw new Error(`Feature ${feature.name} is not changeable`);
            const fid = eClass.getFeatureID(feature);
            const isContainment = 'containment' in feature && feature.containment;
            if (feature.many) {
                const list = handler._eGetList(feature, fid);
                if (Array.isArray(value)) {
                    for (const v of value)
                        list.add(v);
                }
                else if (value != null)
                    list.add(value);
                return;
            }
            if (isContainment) {
                const old = handler._featureValues.get(fid);
                if (old && typeof old.eSetContainer === 'function')
                    old.eSetContainer(null, null);
                if (value && typeof value.eSetContainer === 'function')
                    value.eSetContainer(obj, feature);
            }
            handler._featureValues.set(fid, value);
            handler._isSet.add(fid);
        },
        eIsSet: (feature) => {
            const fid = eClass.getFeatureID(feature);
            if (feature.many) {
                const list = handler._lists.get(fid);
                return list ? !list.isEmpty() : false;
            }
            if (feature.unsettable)
                return handler._isSet.has(fid);
            return handler._featureValues.has(fid) || handler._isSet.has(fid);
        },
        eUnset: (feature) => {
            const fid = eClass.getFeatureID(feature);
            if (feature.many) {
                const list = handler._lists.get(fid);
                if (list)
                    list.clear();
                return;
            }
            handler._featureValues.delete(fid);
            handler._isSet.delete(fid);
        },
        eInvoke: (_op, _args) => { throw new Error('eInvoke not supported on deserialized objects'); },
        eIsProxy: () => false,
        eAdapters: () => handler._eAdapters,
        eDeliver: () => handler._eDeliver,
        eSetDeliver: (d) => { handler._eDeliver = d; },
        eNotify: (_n) => { },
    };
    const obj = Object.create(proto);
    // Wrap in a Proxy that routes direct property access through eGet/eSet
    // so pkg.name works like obj.eGet(nameFeature)
    const proxied = new Proxy(obj, {
        get(target, prop, receiver) {
            // 1. Own properties defined by Object.defineProperty (eStructuralFeatures, etc.)
            if (target.hasOwnProperty(prop)) {
                return Reflect.get(target, prop, receiver);
            }
            // 2. Prototype methods (eClass, eGet, eSet, etc.)
            if (prop in proto) {
                return Reflect.get(target, prop, receiver);
            }
            // 3. Route feature names through eGet so pkg.name works like eGet(name)
            if (typeof prop === 'string' && !prop.startsWith('_') && prop !== 'then') {
                const feature = eClass.getEStructuralFeature(prop);
                if (feature) {
                    return target.eGet(feature);
                }
            }
            return Reflect.get(target, prop, receiver);
        },
        set(target, prop, value, receiver) {
            if (target.hasOwnProperty(prop)) {
                return Reflect.set(target, prop, value, receiver);
            }
            if (typeof prop === 'string' && !prop.startsWith('_')) {
                const feature = eClass.getEStructuralFeature(prop);
                if (feature) {
                    target.eSet(feature, value);
                    return true;
                }
            }
            return Reflect.set(target, prop, value, receiver);
        },
        has(target, prop) {
            if (target.hasOwnProperty(prop))
                return true;
            if (prop in proto)
                return true;
            if (typeof prop === 'string' && eClass.getEStructuralFeature(prop))
                return true;
            return Reflect.has(target, prop);
        },
    });
    return proxied;
}
// ============================================================
// Built-in Ecore Registry (self-bootstrapping)
// ============================================================
/**
 * Creates a default PackageRegistry containing the Ecore metamodel types.
 *
 * This enables deserialization of .ecore files without an external registry.
 * Each EClass is built using createMinimalEObject so no static class setup
 * is needed — the registry is self-contained.
 *
 * @returns A PackageRegistry mapping ECORE_NS to an EPackage with
 *          EPackage, EClass, EAttribute, EReference, EEnum, EOperation,
 *          EParameter, and EAnnotation EClasses.
 */
export function getDefaultEcoreRegistry() {
    // Registry store
    const store = new Map();
    // -- Helper: create a minimal EClass with structural features --
    function makeEClass(name, features) {
        const cls = createMinimalEObject(makeEClassEClass());
        cls.name = name;
        // Use a writable property so it can be overridden (for circular refs)
        let _features = features;
        Object.defineProperty(cls, 'eStructuralFeatures', {
            get: () => _features,
            set: (val) => { _features = val; },
            enumerable: true,
            configurable: true,
        });
        Object.defineProperty(cls, 'eAllStructuralFeatures', {
            get: () => _features,
            enumerable: true,
            configurable: true,
        });
        Object.defineProperty(cls, 'getEStructuralFeature', {
            value: (featName) => _features.find(f => f.name === featName) || null,
        });
        Object.defineProperty(cls, 'getFeatureID', {
            value: (feature) => _features.indexOf(feature),
        });
        Object.defineProperty(cls, 'getFeatureCount', {
            value: () => _features.length,
        });
        Object.defineProperty(cls, 'eSuperTypes', {
            get: () => [],
            enumerable: true,
        });
        Object.defineProperty(cls, 'eAllSuperTypes', {
            get: () => [],
            enumerable: true,
        });
        return cls;
    }
    // Lazy singleton for the EClass EClass
    let _eclassEClass = null;
    function makeEClassEClass() {
        if (!_eclassEClass) {
            _eclassEClass = {
                name: 'EClass',
                ePackage: null,
                eSuperTypes: [],
                eAllSuperTypes: [],
                eStructuralFeatures: [],
                eAllStructuralFeatures: [],
                eOperations: [],
                getEStructuralFeature: () => null,
                getFeatureID: () => -1,
                getFeatureCount: () => 0,
                eAllAttributes: [],
                eAllReferences: [],
                eAllContainments: [],
                eAllOperations: [],
                eAttributes: [],
                eReferences: [],
                eIDAttribute: null,
                eGenericSuperTypes: [],
                instanceClass: null,
                instanceClassName: null,
                instanceTypeName: null,
                abstract: false,
                interface: false,
                default: false,
                isSuperTypeOf: () => false,
                getFeatureType: () => null,
                getOverride: () => null,
                getOperation: () => null,
            };
        }
        return _eclassEClass;
    }
    // -- Data types (must be before makeAttr) --
    const stringDT = { name: 'EString', serializable: true, instanceClassName: 'java.lang.String', instanceClass: null, instanceTypeName: null, defaultValue: null };
    const booleanDT = { name: 'EBoolean', serializable: true, instanceClassName: 'boolean', instanceClass: null, instanceTypeName: null, defaultValue: null };
    const intDT = { name: 'EInt', serializable: true, instanceClassName: 'int', instanceClass: null, instanceTypeName: null, defaultValue: null };
    // -- Helper: create a minimal EStructuralFeature --
    function makeAttr(name, defaultValue) {
        // Infer eAttributeType from default value type
        let _eAttributeType = null;
        if (typeof defaultValue === 'string')
            _eAttributeType = stringDT;
        else if (typeof defaultValue === 'boolean')
            _eAttributeType = booleanDT;
        else if (typeof defaultValue === 'number')
            _eAttributeType = intDT;
        return {
            name,
            changeable: true,
            volatile: false,
            transient: false,
            defaultValueLiteral: defaultValue !== undefined ? String(defaultValue) : '',
            defaultValue,
            unsettable: false,
            derived: false,
            ordered: true,
            unique: true,
            lowerBound: 0,
            upperBound: 1,
            many: false,
            required: false,
            eType: null,
            eContainingClass: null,
            iD: false,
            containment: false,
            container: false,
            resolveProxies: false,
            eOpposite: null,
            eReferenceType: null,
            eKeys: [],
            eAttributeType: _eAttributeType,
        };
    }
    function makeRef(name, eType, containment) {
        return {
            name,
            changeable: true,
            volatile: false,
            transient: false,
            defaultValueLiteral: '',
            defaultValue: null,
            unsettable: false,
            derived: false,
            ordered: true,
            unique: true,
            lowerBound: 0,
            upperBound: containment ? -1 : 1,
            many: containment ? true : false,
            required: false,
            eType,
            eContainingClass: null,
            iD: false,
            containment: !!containment,
            container: false,
            resolveProxies: true,
            eOpposite: null,
            eReferenceType: eType,
            eKeys: [],
            eAttributeType: null,
        };
    }
    // EAnnotation EClass
    const eannotationCls = makeEClass('EAnnotation', [
        makeAttr('source', ''),
        makeRef('eAnnotations', makeEClass('EAnnotation', []), true),
    ]);
    const epackageCls = makeEClass('EPackage', [
        makeAttr('name', ''),
        makeAttr('nsURI', ''),
        makeAttr('nsPrefix', ''),
        makeRef('eClassifiers', makeEClass('EClassifier', []), true),
        makeRef('eSubpackages', makeEClass('EPackage', []), true),
        makeRef('eAnnotations', eannotationCls, true),
    ]);
    const eobjectCls = makeEClass('EObject', []);
    const eclassifierCls = makeEClass('EClassifier', [
        makeAttr('name', ''),
        makeAttr('instanceClassName', ''),
        makeAttr('instanceClass', ''),
        makeAttr('defaultValue', ''),
        makeRef('eAnnotations', eannotationCls, true),
    ]);
    const edatatypeCls = makeEClass('EDataType', [
        makeAttr('name', ''),
        makeAttr('serializable', true),
        makeRef('eAnnotations', eannotationCls, true),
    ]);
    const eenumCls = makeEClass('EEnum', [
        makeAttr('name', ''),
        makeAttr('serializable', true),
        makeRef('eLiterals', makeEClass('EEnumLiteral', [
            makeAttr('name', ''),
            makeAttr('value', 0),
            makeAttr('literal', ''),
        ]), true),
        makeRef('eAnnotations', eannotationCls, true),
    ]);
    const eenumliteralCls = makeEClass('EEnumLiteral', [
        makeAttr('name', ''),
        makeAttr('value', 0),
        makeAttr('literal', ''),
    ]);
    const estructuralfeatureCls = makeEClass('EStructuralFeature', [
        makeAttr('name', ''),
        makeAttr('ordered', true),
        makeAttr('unique', true),
        makeAttr('lowerBound', 0),
        makeAttr('upperBound', 1),
        makeAttr('changeable', true),
        makeAttr('volatile', false),
        makeAttr('transient', false),
        makeAttr('defaultValueLiteral', ''),
        makeAttr('unsettable', false),
        makeAttr('derived', false),
    ]);
    const eattCls = makeEClass('EAttribute', [
        makeAttr('name', ''),
        makeAttr('ordered', true),
        makeAttr('unique', true),
        makeAttr('lowerBound', 0),
        makeAttr('upperBound', 1),
        makeAttr('changeable', true),
        makeAttr('volatile', false),
        makeAttr('transient', false),
        makeAttr('defaultValueLiteral', ''),
        makeAttr('unsettable', false),
        makeAttr('derived', false),
        makeAttr('iD', false),
    ]);
    const erefCls = makeEClass('EReference', [
        makeAttr('name', ''),
        makeAttr('ordered', true),
        makeAttr('unique', true),
        makeAttr('lowerBound', 0),
        makeAttr('upperBound', 1),
        makeAttr('changeable', true),
        makeAttr('volatile', false),
        makeAttr('transient', false),
        makeAttr('defaultValueLiteral', ''),
        makeAttr('unsettable', false),
        makeAttr('derived', false),
        makeAttr('containment', false),
        makeAttr('resolveProxies', true),
    ]);
    const eclassCls = makeEClass('EClass', [
        makeAttr('name', ''),
        makeAttr('abstract', false),
        makeAttr('interface', false),
        makeRef('eSuperTypes', makeEClass('PlaceholderEClass', []), false),
        makeRef('eStructuralFeatures', estructuralfeatureCls, true),
        makeRef('eOperations', makeEClass('EOperation', [
            makeAttr('name', ''),
            makeAttr('ordered', true),
            makeAttr('unique', true),
            makeAttr('lowerBound', 0),
            makeAttr('upperBound', 1),
            makeRef('eParameters', makeEClass('EParameter', [
                makeAttr('name', ''),
                makeAttr('ordered', true),
                makeAttr('unique', true),
                makeAttr('lowerBound', 0),
                makeAttr('upperBound', 1),
            ]), true),
        ]), true),
        makeRef('eAnnotations', eannotationCls, true),
    ]);
    const eopCls = makeEClass('EOperation', [
        makeAttr('name', ''),
        makeAttr('ordered', true),
        makeAttr('unique', true),
        makeAttr('lowerBound', 0),
        makeAttr('upperBound', 1),
        makeRef('eParameters', makeEClass('EParameter', [
            makeAttr('name', ''),
            makeAttr('ordered', true),
            makeAttr('unique', true),
            makeAttr('lowerBound', 0),
            makeAttr('upperBound', 1),
        ]), true),
        makeRef('eAnnotations', eannotationCls, true),
    ]);
    const eparamCls = makeEClass('EParameter', [
        makeAttr('name', ''),
        makeAttr('ordered', true),
        makeAttr('unique', true),
        makeAttr('lowerBound', 0),
        makeAttr('upperBound', 1),
        makeRef('eAnnotations', eannotationCls, true),
    ]);
    const allEClasses = [epackageCls, eobjectCls, eclassifierCls, edatatypeCls,
        eenumCls, eenumliteralCls, eattCls, erefCls, eclassCls,
        eopCls, eparamCls, eannotationCls];
    // Set ePackage on all EClasses
    const ecorePkg = createMinimalEObject(epackageCls);
    ecorePkg.name = 'ecore';
    ecorePkg.nsURI = ECORE_NS;
    ecorePkg.nsPrefix = 'ecore';
    // Add getEClassifier that searches all classifiers in the ecore pkg
    ecorePkg.getEClassifier = (className) => {
        return allEClasses.find((c) => c.name === className) || null;
    };
    // Fix self-references: EPackage.eSubpackages → EPackage, EClass.eSuperTypes → EClass
    const epackageFeatures = epackageCls.eStructuralFeatures;
    const esubpackagesFeature = epackageFeatures.find(f => f.name === 'eSubpackages');
    if (esubpackagesFeature)
        esubpackagesFeature.eReferenceType = epackageCls;
    const eclassFeatures = eclassCls.eStructuralFeatures;
    const esuperTypesFeature = eclassFeatures.find(f => f.name === 'eSuperTypes');
    if (esuperTypesFeature)
        esuperTypesFeature.eReferenceType = eclassCls;
    for (const cls of allEClasses) {
        cls.ePackage = ecorePkg;
    }
    // EClass for ecore types (self-referential)
    const ecoreEClassCls = makeEClass('EClass', []);
    ecoreEClassCls.ePackage = ecorePkg;
    // Register
    store.set(ECORE_NS, ecorePkg);
    return {
        getEPackage: (nsURI) => store.get(nsURI) || null,
        putEPackage: (nsURI, pkg) => { store.set(nsURI, pkg); },
        removeEPackage: (pkg) => {
            store.forEach((storedPkg, uri) => {
                if (storedPkg === pkg) {
                    store.delete(uri);
                }
            });
        },
        values: () => Array.from(store.values()),
        entries: () => Array.from(store.entries()),
        has: (nsURI) => store.has(nsURI),
        get: (nsURI) => store.get(nsURI),
        forEach: (fn) => store.forEach(fn),
        size: store.size,
        [Symbol.iterator]: store[Symbol.iterator].bind(store),
        clear: () => store.clear(),
        delete: (nsURI) => store.delete(nsURI),
    };
}
//# sourceMappingURL=XMISerializer.js.map