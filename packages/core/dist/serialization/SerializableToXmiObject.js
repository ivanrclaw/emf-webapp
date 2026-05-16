// ═══════════════════════════════════════════════════════════════
// Ecore package constants
// ═══════════════════════════════════════════════════════════════
const ECORE_NS = 'http://www.eclipse.org/emf/2002/Ecore';
const ECORE_DATA_TYPES = {
    EString: 'java.lang.String',
    EBoolean: 'java.lang.Boolean',
    EInt: 'int',
    ELong: 'long',
    EFloat: 'float',
    EDouble: 'double',
    EByte: 'byte',
    EByteArray: 'byte[]',
    EChar: 'char',
    EShort: 'short',
    EBigDecimal: 'java.math.BigDecimal',
    EBigInteger: 'java.math.BigInteger',
    EDate: 'java.util.Date',
    EJavaObject: 'java.lang.Object',
    EJavaClass: 'java.lang.Class',
};
function makeMinimalEClass(name, features = []) {
    const eAllAttributes = features.filter((f) => !f.containment && !f.eReferenceType);
    const eAllReferences = features.filter((f) => f.containment || f.eReferenceType);
    const eAllContainments = features.filter((f) => f.containment);
    return {
        name,
        ePackage: null,
        eSuperTypes: [],
        eAllSuperTypes: [],
        eStructuralFeatures: features,
        eAllStructuralFeatures: features,
        eOperations: [],
        getEStructuralFeature: (n) => features.find((f) => f.name === n) || null,
        getFeatureID: () => -1,
        getFeatureCount: () => features.length,
        eAllAttributes,
        eAllReferences,
        eAllContainments,
        eAllOperations: [],
        eAttributes: eAllAttributes,
        eReferences: eAllReferences,
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
// Pre-built Ecore EClasses with proper structural features for XMI serialization
function makeEcoreFeature(name, containment = false, eReferenceType = null) {
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
        many: containment,
        required: false,
        eType: null,
        eContainingClass: null,
        iD: false,
        containment,
        container: false,
        resolveProxies: true,
        eOpposite: null,
        eReferenceType,
        eAttributeType: null,
        eKeys: [],
    };
}
const EPACKAGE_FEATURES = [
    makeEcoreFeature('name'),
    makeEcoreFeature('nsURI'),
    makeEcoreFeature('nsPrefix'),
    makeEcoreFeature('eClassifiers', true),
    makeEcoreFeature('eSubpackages', true),
    makeEcoreFeature('eAnnotations', true),
    makeEcoreFeature('eFactoryInstance'),
];
const EPACKAGE_ECLASS = makeMinimalEClass('EPackage', EPACKAGE_FEATURES);
const ECLASS_FEATURES = [
    makeEcoreFeature('name'),
    makeEcoreFeature('abstract'),
    makeEcoreFeature('interface'),
    makeEcoreFeature('eSuperTypes', false),
    makeEcoreFeature('eStructuralFeatures', true),
    makeEcoreFeature('eOperations', true),
    makeEcoreFeature('eAnnotations', true),
];
const ECLASS_ECLASS = makeMinimalEClass('EClass', ECLASS_FEATURES);
const EENUM_FEATURES = [
    makeEcoreFeature('name'),
    makeEcoreFeature('serializable'),
    makeEcoreFeature('eLiterals', true),
];
const EENUM_ECLASS = makeMinimalEClass('EEnum', EENUM_FEATURES);
const EDATATYPE_FEATURES = [
    makeEcoreFeature('name'),
    makeEcoreFeature('serializable'),
    makeEcoreFeature('instanceClassName'),
];
const EDATATYPE_ECLASS = makeMinimalEClass('EDataType', EDATATYPE_FEATURES);
const EATTRIBUTE_FEATURES = [
    makeEcoreFeature('name'),
    makeEcoreFeature('lowerBound'),
    makeEcoreFeature('upperBound'),
    makeEcoreFeature('iD'),
    makeEcoreFeature('changeable'),
    makeEcoreFeature('derived'),
    makeEcoreFeature('transient'),
    makeEcoreFeature('defaultValueLiteral'),
    makeEcoreFeature('eType'),
    makeEcoreFeature('eAttributeType'),
];
const EATTRIBUTE_ECLASS = makeMinimalEClass('EAttribute', EATTRIBUTE_FEATURES);
const EREFERENCE_FEATURES = [
    makeEcoreFeature('name'),
    makeEcoreFeature('lowerBound'),
    makeEcoreFeature('upperBound'),
    makeEcoreFeature('containment'),
    makeEcoreFeature('changeable'),
    makeEcoreFeature('derived'),
    makeEcoreFeature('eType'),
    makeEcoreFeature('eOpposite'),
    makeEcoreFeature('eReferenceType'),
];
const EREFERENCE_ECLASS = makeMinimalEClass('EReference', EREFERENCE_FEATURES);
const EENUMLITERAL_FEATURES = [
    makeEcoreFeature('name'),
    makeEcoreFeature('value'),
    makeEcoreFeature('literal'),
];
const EENUMLITERAL_ECLASS = makeMinimalEClass('EEnumLiteral', EENUMLITERAL_FEATURES);
const EOPERATION_FEATURES = [
    makeEcoreFeature('name'),
    makeEcoreFeature('eType'),
    makeEcoreFeature('lowerBound'),
    makeEcoreFeature('upperBound'),
    makeEcoreFeature('eParameters', true),
    makeEcoreFeature('eAnnotations', true),
];
const EOPERATION_ECLASS = makeMinimalEClass('EOperation', EOPERATION_FEATURES);
const EPARAMETER_FEATURES = [
    makeEcoreFeature('name'),
    makeEcoreFeature('eType'),
    makeEcoreFeature('lowerBound'),
    makeEcoreFeature('upperBound'),
];
const EPARAMETER_ECLASS = makeMinimalEClass('EParameter', EPARAMETER_FEATURES);
const EANNOTATION_FEATURES = [
    makeEcoreFeature('source'),
    makeEcoreFeature('details', true),
];
const EANNOTATION_ECLASS = makeMinimalEClass('EAnnotation', EANNOTATION_FEATURES);
// ── Post-init: wire eReferenceType for containment features ──
// (needed by XMISerializer to detect containment references)
function setRefType(features, refType) {
    for (const f of features) {
        if (f.containment || f.name === 'eSuperTypes') {
            f.eReferenceType = refType;
        }
    }
}
setRefType(EPACKAGE_FEATURES, ECLASS_ECLASS);
setRefType(ECLASS_FEATURES, ECLASS_ECLASS);
setRefType(EENUM_FEATURES, EENUMLITERAL_ECLASS);
setRefType(EATTRIBUTE_FEATURES, null); // Not a reference
setRefType(EREFERENCE_FEATURES, ECLASS_ECLASS);
setRefType(EOPERATION_FEATURES, EPARAMETER_ECLASS);
setRefType(EANNOTATION_FEATURES, null);
// Set eReferenceType for reference-type features (eType, eAttributeType, eOpposite)
function setRefFeatureType(features, featureName, refType) {
    const f = features.find((x) => x.name === featureName);
    if (f)
        f.eReferenceType = refType;
}
setRefFeatureType(EATTRIBUTE_FEATURES, 'eType', EDATATYPE_ECLASS);
setRefFeatureType(EATTRIBUTE_FEATURES, 'eAttributeType', EDATATYPE_ECLASS);
setRefFeatureType(EREFERENCE_FEATURES, 'eType', ECLASS_ECLASS);
setRefFeatureType(EREFERENCE_FEATURES, 'eOpposite', ECLASS_ECLASS);
setRefFeatureType(EOPERATION_FEATURES, 'eType', EDATATYPE_ECLASS);
setRefFeatureType(EPARAMETER_FEATURES, 'eType', EDATATYPE_ECLASS);
// ── Set ePackage on meta-EClasses for proper ecore: namespace prefix ──
const ECORE_PACKAGE = { name: 'ecore', nsURI: ECORE_NS, nsPrefix: 'ecore' };
EPACKAGE_ECLASS.ePackage = ECORE_PACKAGE;
ECLASS_ECLASS.ePackage = ECORE_PACKAGE;
EENUM_ECLASS.ePackage = ECORE_PACKAGE;
EDATATYPE_ECLASS.ePackage = ECORE_PACKAGE;
EATTRIBUTE_ECLASS.ePackage = ECORE_PACKAGE;
EREFERENCE_ECLASS.ePackage = ECORE_PACKAGE;
EENUMLITERAL_ECLASS.ePackage = ECORE_PACKAGE;
EOPERATION_ECLASS.ePackage = ECORE_PACKAGE;
EPARAMETER_ECLASS.ePackage = ECORE_PACKAGE;
EANNOTATION_ECLASS.ePackage = ECORE_PACKAGE;
// ── Standard Ecore data type objects (for eType resolution) ──
function makeEcoreDataType(name, instanceClassName) {
    return {
        name,
        instanceClassName,
        serializable: true,
        ePackage: ECORE_PACKAGE,
        eClass: () => EDATATYPE_ECLASS,
        eGet: (feature) => undefined,
    };
}
const ECORE_DATA_TYPE_OBJECTS = {};
for (const [name, clsName] of Object.entries(ECORE_DATA_TYPES)) {
    ECORE_DATA_TYPE_OBJECTS[name] = makeEcoreDataType(name, clsName);
}
// ═══════════════════════════════════════════════════════════════
// Main conversion function
// ═══════════════════════════════════════════════════════════════
export function serializableToXmiCompatible(serializable) {
    const eClassifiers = [];
    const idToClassifier = new Map();
    // Phase 1: Create all classifiers
    for (const sc of serializable.eClassifiers) {
        const name = sc.name || 'Unnamed';
        const serializableDT = sc;
        if ('eAttributes' in sc) {
            // It's an EClass
            const cls = {
                name,
                ePackage: null,
                eSuperTypes: [],
                eAllSuperTypes: [],
                eStructuralFeatures: [],
                eAllStructuralFeatures: [],
                eOperations: [],
                eAnnotations: [],
                eAttributes: [],
                eReferences: [],
                eAllAttributes: [],
                eAllReferences: [],
                eAllContainments: [],
                eIDAttribute: null,
                abstract: sc.abstract ?? false,
                interface: sc.interface ?? false,
                default: false,
                instanceClass: null,
                instanceClassName: null,
                instanceTypeName: null,
                eGenericSuperTypes: [],
                isSuperTypeOf: () => false,
                getFeatureType: () => null,
                getOverride: () => null,
                getOperation: () => null,
                eClass: () => ECLASS_ECLASS,
                eGet: (feature) => cls[feature.name],
                eContainer: null,
                eResource: null,
                eIsProxy: false,
                // Will be populated in phase 2
                _superTypeNames: sc.eSuperTypes || [],
            };
            cls.getEStructuralFeature = (n) => cls.eStructuralFeatures.find((f) => f.name === n) || null;
            cls.getFeatureID = () => -1;
            cls.getFeatureCount = () => cls.eStructuralFeatures.length;
            // Add features (attributes + references)
            for (const attr of sc.eAttributes) {
                const eTypeName = attr.eType || 'EString';
                const a = {
                    name: attr.name,
                    changeable: attr.changeable ?? true,
                    volatile: false,
                    transient: attr.transient ?? false,
                    defaultValueLiteral: attr.defaultValueLiteral ?? '',
                    defaultValue: attr.defaultValueLiteral || null,
                    unsettable: false,
                    derived: attr.derived ?? false,
                    ordered: true,
                    unique: true,
                    lowerBound: attr.lowerBound ?? 0,
                    upperBound: attr.upperBound ?? 1,
                    many: (attr.upperBound ?? 1) !== 1,
                    required: (attr.lowerBound ?? 0) > 0,
                    eType: null,
                    eContainingClass: cls,
                    iD: attr.iD ?? false,
                    // Do NOT set containment on EAttribute — serializer differentiates
                    // by checking 'containment' in feature (ERef only) vs 'iD' in feature (EAttr)
                    container: false,
                    resolveProxies: false,
                    eOpposite: null,
                    eReferenceType: null,
                    eAttributeType: null,
                    eKeys: [],
                    eClass: () => EATTRIBUTE_ECLASS,
                    eGet: (feature) => a[feature.name],
                    _typeName: eTypeName, // stored for resolution in phase 2
                };
                cls.eStructuralFeatures.push(a);
                cls.eAttributes.push(a);
                cls.eAllAttributes.push(a);
            }
            for (const ref of sc.eReferences) {
                const r = {
                    name: ref.name,
                    changeable: ref.changeable ?? true,
                    volatile: false,
                    transient: false,
                    defaultValueLiteral: '',
                    defaultValue: null,
                    unsettable: false,
                    derived: ref.derived ?? false,
                    ordered: true,
                    unique: true,
                    lowerBound: ref.lowerBound ?? 0,
                    upperBound: ref.upperBound ?? -1,
                    many: (ref.upperBound ?? -1) !== 1,
                    required: (ref.lowerBound ?? 0) > 0,
                    eType: null,
                    eContainingClass: cls,
                    iD: false,
                    containment: ref.containment ?? false,
                    container: false,
                    resolveProxies: true,
                    eOpposite: null,
                    eReferenceType: null,
                    eAttributeType: null,
                    eKeys: [],
                    eClass: () => EREFERENCE_ECLASS,
                    eGet: (feature) => r[feature.name],
                    _targetId: ref.targetId,
                };
                cls.eStructuralFeatures.push(r);
                cls.eReferences.push(r);
                cls.eAllReferences.push(r);
                if (r.containment)
                    cls.eAllContainments.push(r);
            }
            cls.eAllStructuralFeatures = cls.eStructuralFeatures;
            eClassifiers.push(cls);
            idToClassifier.set(sc.id, cls);
        }
        else if ('eLiterals' in sc) {
            // It's an EEnum
            const enm = {
                name,
                serializable: true,
                instanceClassName: name,
                instanceClass: null,
                instanceTypeName: null,
                defaultValue: null,
                eLiterals: [],
                ePackage: null,
                eClass: () => EENUM_ECLASS,
                eGet: (feature) => enm[feature.name],
            };
            for (const lit of sc.eLiterals) {
                const litObj = {
                    name: lit.name,
                    value: lit.value,
                    literal: lit.literal || lit.name,
                    eClass: () => EENUMLITERAL_ECLASS,
                    eGet: (feature) => litObj[feature.name],
                };
                enm.eLiterals.push(litObj);
            }
            eClassifiers.push(enm);
            idToClassifier.set(sc.id, enm);
        }
        else {
            // It's an EDataType
            const dt = {
                name,
                serializable: serializableDT.serializable ?? true,
                instanceClassName: serializableDT.instanceClassName || 'java.lang.String',
                instanceClass: null,
                instanceTypeName: null,
                defaultValue: null,
                ePackage: null,
                eClass: () => EDATATYPE_ECLASS,
                eGet: (feature) => dt[feature.name],
            };
            eClassifiers.push(dt);
            idToClassifier.set(sc.id, dt);
        }
    }
    // Phase 2: Resolve references and types
    // Build a map of all available types (standard Ecore types + our classifiers)
    const allTypes = { ...ECORE_DATA_TYPE_OBJECTS };
    for (const c of eClassifiers) {
        allTypes[c.name] = c;
    }
    // EEnum types are also valid eTypes for attributes
    for (const enm of eClassifiers.filter((c) => 'eLiterals' in c && !('eAttributes' in c))) {
        allTypes[enm.name] = enm;
    }
    for (const cls of eClassifiers) {
        if (!cls._superTypeNames && !cls._typeName && !cls.eAttributes?.some?.((a) => a._typeName))
            continue;
        // Resolve eSuperTypes
        if (cls._superTypeNames) {
            for (const superName of cls._superTypeNames) {
                const target = findClassifierByName(eClassifiers, superName);
                if (target) {
                    cls.eSuperTypes.push(target);
                    cls.eAllSuperTypes.push(target);
                }
            }
            delete cls._superTypeNames;
        }
        // Resolve eReferences target
        if (cls.eReferences) {
            for (const ref of cls.eReferences) {
                if (ref._targetId) {
                    const target = idToClassifier.get(ref._targetId) ||
                        findClassifierByName(eClassifiers, ref._targetId);
                    if (target) {
                        ref.eReferenceType = target;
                        ref.eType = target;
                    }
                    delete ref._targetId;
                }
            }
        }
        // Resolve eType/eAttributeType for EAttributes
        if (cls.eAttributes) {
            for (const attr of cls.eAttributes) {
                if (attr._typeName) {
                    const typeObj = allTypes[attr._typeName];
                    if (typeObj) {
                        attr.eAttributeType = typeObj;
                        attr.eType = typeObj;
                    }
                    delete attr._typeName;
                }
            }
        }
    }
    // Phase 3: Process EOperations and EAnnotations (needs allTypes from Phase 2)
    for (const cls of eClassifiers) {
        if (!cls.eOperations)
            continue;
        const scMatch = serializable.eClassifiers.find((sc) => sc.name === cls.name);
        if (!scMatch || !('eAttributes' in scMatch))
            continue;
        const scClass = scMatch;
        if (scClass.eOperations && Array.isArray(scClass.eOperations)) {
            for (const op of scClass.eOperations) {
                const opObj = {
                    name: op.name,
                    eType: null,
                    lowerBound: op.lowerBound ?? 0,
                    upperBound: op.upperBound ?? 1,
                    eParameters: [],
                    eAnnotations: [],
                    eClass: () => EOPERATION_ECLASS,
                    eGet: (feature) => opObj[feature.name],
                };
                // Resolve return type
                if (op.eType) {
                    const retType = allTypes[op.eType];
                    if (retType)
                        opObj.eType = retType;
                }
                // Process parameters
                if (op.eParameters && Array.isArray(op.eParameters)) {
                    for (const param of op.eParameters) {
                        const paramObj = {
                            name: param.name,
                            eType: null,
                            lowerBound: param.lowerBound ?? 0,
                            upperBound: param.upperBound ?? 1,
                            eClass: () => EPARAMETER_ECLASS,
                            eGet: (feature) => paramObj[feature.name],
                        };
                        if (param.eType) {
                            const paramType = allTypes[param.eType];
                            if (paramType)
                                paramObj.eType = paramType;
                        }
                        opObj.eParameters.push(paramObj);
                    }
                }
                // Process annotations (for OCL body)
                if (op.annotations && Array.isArray(op.annotations)) {
                    for (const ann of op.annotations) {
                        const annObj = {
                            source: ann.source || '',
                            details: ann.details || {},
                            eClass: () => EANNOTATION_ECLASS,
                            eGet: (feature) => annObj[feature.name],
                        };
                        opObj.eAnnotations.push(annObj);
                    }
                }
                cls.eOperations.push(opObj);
            }
        }
        // Process class-level annotations
        if (scClass.annotations && Array.isArray(scClass.annotations)) {
            for (const ann of scClass.annotations) {
                const annObj = {
                    source: ann.source || '',
                    details: ann.details || {},
                    eClass: () => EANNOTATION_ECLASS,
                    eGet: (feature) => annObj[feature.name],
                };
                cls.eAnnotations.push(annObj);
            }
        }
    }
    // Build EPackage
    // Process package-level annotations (OCL delegation)
    const pkgAnnotations = [];
    if (serializable.annotations && Array.isArray(serializable.annotations)) {
        for (const ann of serializable.annotations) {
            const annObj = {
                source: ann.source || '',
                details: ann.details || {},
                eClass: () => EANNOTATION_ECLASS,
                eGet: (feature) => annObj[feature.name],
            };
            pkgAnnotations.push(annObj);
        }
    }
    const pkg = {
        name: serializable.name || 'model',
        nsURI: serializable.nsURI || '',
        nsPrefix: serializable.nsPrefix || 'model',
        eClassifiers,
        eSubpackages: [],
        eAnnotations: pkgAnnotations,
        eFactoryInstance: null,
        eSuperPackage: null,
        getEClassifier: (name) => eClassifiers.find((c) => c.name === name) || null,
        eClass: () => EPACKAGE_ECLASS,
        eGet: (feature) => {
            if (feature.name === 'eClassifiers')
                return eClassifiers;
            if (feature.name === 'eSubpackages')
                return [];
            if (feature.name === 'eAnnotations')
                return pkgAnnotations;
            return pkg[feature.name];
        },
        eContainer: null,
        eResource: null,
        eIsProxy: false,
    };
    // Wire ePackage back to classifiers
    for (const c of eClassifiers) {
        c.ePackage = pkg;
    }
    return pkg;
}
function findClassifierByName(classifiers, name) {
    return classifiers.find((c) => c.name === name) || null;
}
//# sourceMappingURL=SerializableToXmiObject.js.map