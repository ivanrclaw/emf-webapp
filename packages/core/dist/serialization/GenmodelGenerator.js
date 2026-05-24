/**
 * @emf-webapp/core — GenmodelGenerator
 *
 * Generates Eclipse .genmodel XML from a SerializableEPackage.
 * The .genmodel is required by Eclipse EMF for Java code generation
 * and is referenced by Sirius, Acceleo, and other Eclipse tools.
 *
 * Format: EMF GenModel XMI (genmodel namespace 2.0)
 * Reference: http://www.eclipse.org/emf/2002/GenModel
 */
// ═══════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════
const GENMODEL_NS = 'http://www.eclipse.org/emf/2002/GenModel';
const XMI_NS = 'http://www.omg.org/XMI';
const ECORE_NS = 'http://www.eclipse.org/emf/2002/Ecore';
/** Maps Ecore primitive types to GenModel type names */
const ECORE_TYPE_TO_GENMODEL = {
    EString: 'ecore:EDataType http://www.eclipse.org/emf/2002/Ecore#//EString',
    EBoolean: 'ecore:EDataType http://www.eclipse.org/emf/2002/Ecore#//EBoolean',
    EInt: 'ecore:EDataType http://www.eclipse.org/emf/2002/Ecore#//EInt',
    ELong: 'ecore:EDataType http://www.eclipse.org/emf/2002/Ecore#//ELong',
    EFloat: 'ecore:EDataType http://www.eclipse.org/emf/2002/Ecore#//EFloat',
    EDouble: 'ecore:EDataType http://www.eclipse.org/emf/2002/Ecore#//EDouble',
    EByte: 'ecore:EDataType http://www.eclipse.org/emf/2002/Ecore#//EByte',
    EByteArray: 'ecore:EDataType http://www.eclipse.org/emf/2002/Ecore#//EByteArray',
    EChar: 'ecore:EDataType http://www.eclipse.org/emf/2002/Ecore#//EChar',
    EShort: 'ecore:EDataType http://www.eclipse.org/emf/2002/Ecore#//EShort',
    EBigDecimal: 'ecore:EDataType http://www.eclipse.org/emf/2002/Ecore#//EBigDecimal',
    EBigInteger: 'ecore:EDataType http://www.eclipse.org/emf/2002/Ecore#//EBigInteger',
    EDate: 'ecore:EDataType http://www.eclipse.org/emf/2002/Ecore#//EDate',
    EJavaObject: 'ecore:EDataType http://www.eclipse.org/emf/2002/Ecore#//EJavaObject',
    EJavaClass: 'ecore:EDataType http://www.eclipse.org/emf/2002/Ecore#//EJavaClass',
};
// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════
function escapeXml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
function indent(depth) {
    return '  '.repeat(depth);
}
function capitalize(str) {
    if (!str)
        return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}
function toJavaPackage(nsPrefix, basePackage) {
    if (basePackage)
        return basePackage;
    // Convert nsPrefix to a valid Java package name
    return nsPrefix.toLowerCase().replace(/[^a-z0-9.]/g, '');
}
// ═══════════════════════════════════════════════════════════════
// Main Generator
// ═══════════════════════════════════════════════════════════════
/**
 * Generates a .genmodel XML string from a SerializableEPackage.
 *
 * @param pkg - The serializable EPackage
 * @param options - Generation options
 * @returns Complete .genmodel XML string
 */
export function generateGenmodel(pkg, options) {
    const pkgName = pkg.name || 'model';
    const nsPrefix = pkg.nsPrefix || pkgName;
    const nsURI = pkg.nsURI || `http://www.example.org/${pkgName}`;
    const basePackage = options.basePackage || toJavaPackage(nsPrefix);
    const pluginID = options.modelPluginID || `${basePackage}.${pkgName}`;
    const complianceLevel = options.complianceLevel || '8.0';
    const importerID = options.importerID || 'org.eclipse.emf.importer.ecore';
    const modelDir = options.modelDirectory || `/${pluginID}/src-gen`;
    const editDir = options.editDirectory || `/${pluginID}.edit/src-gen`;
    const editorDir = options.editorDirectory || `/${pluginID}.editor/src-gen`;
    const testsDir = options.testsDirectory || `/${pluginID}.tests/src-gen`;
    const lines = [];
    // XML header
    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    // Root element
    lines.push(`<genmodel:GenModel xmi:version="2.0"`);
    lines.push(`    xmlns:xmi="${XMI_NS}"`);
    lines.push(`    xmlns:ecore="${ECORE_NS}"`);
    lines.push(`    xmlns:genmodel="${GENMODEL_NS}"`);
    lines.push(`    modelDirectory="${escapeXml(modelDir)}"`);
    lines.push(`    modelPluginID="${escapeXml(pluginID)}"`);
    lines.push(`    modelName="${escapeXml(capitalize(pkgName))}"`);
    lines.push(`    rootExtendsClass="org.eclipse.emf.ecore.impl.MinimalEObjectImpl$Container"`);
    lines.push(`    importerID="${escapeXml(importerID)}"`);
    lines.push(`    complianceLevel="${escapeXml(complianceLevel)}"`);
    if (options.copyrightText) {
        lines.push(`    copyrightText="${escapeXml(options.copyrightText)}"`);
    }
    lines.push(`    editDirectory="${escapeXml(editDir)}"`);
    lines.push(`    editorDirectory="${escapeXml(editorDir)}"`);
    lines.push(`    testsDirectory="${escapeXml(testsDir)}">`);
    // Foreign model (reference to .ecore)
    lines.push(`${indent(1)}<foreignModel>${escapeXml(options.ecoreFilePath)}</foreignModel>`);
    // GenPackage
    lines.push(`${indent(1)}<genPackages prefix="${escapeXml(capitalize(nsPrefix))}"`);
    lines.push(`${indent(3)}basePackage="${escapeXml(basePackage)}"`);
    lines.push(`${indent(3)}disposableProviderFactory="true"`);
    lines.push(`${indent(3)}ecorePackage="${escapeXml(options.ecoreFilePath)}#/">`);
    // GenClassifiers
    for (const classifier of pkg.eClassifiers) {
        if ('eAttributes' in classifier) {
            // GenClass
            generateGenClass(lines, classifier, pkg, options);
        }
        else if ('eLiterals' in classifier) {
            // GenEnum
            generateGenEnum(lines, classifier);
        }
        else {
            // GenDataType
            generateGenDataType(lines, classifier);
        }
    }
    // Close genPackages
    lines.push(`${indent(1)}</genPackages>`);
    // Close root
    lines.push('</genmodel:GenModel>');
    return lines.join('\n');
}
// ═══════════════════════════════════════════════════════════════
// GenClass generation
// ═══════════════════════════════════════════════════════════════
function generateGenClass(lines, cls, pkg, options) {
    const attrs = [];
    const ecorePath = options.ecoreFilePath;
    // Image attribute (false for abstract/interface classes)
    if (cls.abstract || cls.interface) {
        attrs.push('image="false"');
    }
    attrs.push(`ecoreClass="${escapeXml(ecorePath)}#//${cls.name}"`);
    const hasFeatures = (cls.eAttributes && cls.eAttributes.length > 0) ||
        (cls.eReferences && cls.eReferences.length > 0);
    if (!hasFeatures) {
        lines.push(`${indent(2)}<genClasses ${attrs.join(' ')}/>`);
        return;
    }
    lines.push(`${indent(2)}<genClasses ${attrs.join(' ')}>`);
    // GenFeatures for EAttributes
    if (cls.eAttributes) {
        for (const attr of cls.eAttributes) {
            generateGenFeatureForAttribute(lines, attr, cls, ecorePath);
        }
    }
    // GenFeatures for EReferences
    if (cls.eReferences) {
        for (const ref of cls.eReferences) {
            generateGenFeatureForReference(lines, ref, cls, ecorePath);
        }
    }
    // GenOperations
    if (cls.eOperations) {
        for (const op of cls.eOperations) {
            generateGenOperation(lines, op, cls, ecorePath);
        }
    }
    lines.push(`${indent(2)}</genClasses>`);
}
function generateGenFeatureForAttribute(lines, attr, cls, ecorePath) {
    const featureAttrs = [];
    // createChild is false for attributes
    featureAttrs.push('createChild="false"');
    featureAttrs.push(`ecoreFeature="ecore:EAttribute ${escapeXml(ecorePath)}#//${cls.name}/${attr.name}"`);
    lines.push(`${indent(3)}<genFeatures ${featureAttrs.join(' ')}/>`);
}
function generateGenFeatureForReference(lines, ref, cls, ecorePath) {
    const featureAttrs = [];
    // createChild for containment references
    if (ref.containment) {
        featureAttrs.push('property="None"');
        featureAttrs.push('children="true"');
        featureAttrs.push('createChild="true"');
    }
    else {
        featureAttrs.push('notify="false"');
        featureAttrs.push('createChild="false"');
        featureAttrs.push('propertySortChoices="true"');
    }
    featureAttrs.push(`ecoreFeature="ecore:EReference ${escapeXml(ecorePath)}#//${cls.name}/${ref.name}"`);
    lines.push(`${indent(3)}<genFeatures ${featureAttrs.join(' ')}/>`);
}
function generateGenOperation(lines, op, cls, ecorePath) {
    lines.push(`${indent(3)}<genOperations ecoreOperation="${escapeXml(ecorePath)}#//${cls.name}/${op.name}"/>`);
}
// ═══════════════════════════════════════════════════════════════
// GenEnum generation
// ═══════════════════════════════════════════════════════════════
function generateGenEnum(lines, enm) {
    const hasLiterals = enm.eLiterals && enm.eLiterals.length > 0;
    if (!hasLiterals) {
        lines.push(`${indent(2)}<genEnums typeSafeEnumCompatible="false" ecoreEnum="${escapeXml('#//' + enm.name)}"/>`);
        return;
    }
    lines.push(`${indent(2)}<genEnums typeSafeEnumCompatible="false" ecoreEnum="${escapeXml('#//' + enm.name)}">`);
    for (const lit of enm.eLiterals) {
        lines.push(`${indent(3)}<genEnumLiterals ecoreEnumLiteral="${escapeXml('#//' + enm.name + '/' + lit.name)}"/>`);
    }
    lines.push(`${indent(2)}</genEnums>`);
}
// ═══════════════════════════════════════════════════════════════
// GenDataType generation
// ═══════════════════════════════════════════════════════════════
function generateGenDataType(lines, dt) {
    const attrs = [];
    attrs.push(`ecoreDataType="${escapeXml('#//' + dt.name)}"`);
    lines.push(`${indent(2)}<genDataTypes ${attrs.join(' ')}/>`);
}
//# sourceMappingURL=GenmodelGenerator.js.map