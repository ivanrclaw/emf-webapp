/**
 * @emf-webapp/core — SerializableToXmiObject
 *
 * Convierte SerializableEPackage a un objeto compatible con
 * serializeToXMI() del XMISerializer.
 *
 * En lugar de usar las clases Impl (que requieren _initStaticClass),
 * crea objetos planos con método eClass() que devuelve la EClass
 * apropiada, mismo patrón que usa deserializeFromXMI internamente.
 */
import type {
  SerializableEPackage,
  SerializableEClass,
  SerializableEEnum,
  SerializableEDataType,
  SerializableEAttribute,
  SerializableEReference,
  SerializableEEnumLiteral,
} from './SerializableToEcoreConverter.js';

// ═══════════════════════════════════════════════════════════════
// Ecore package constants
// ═══════════════════════════════════════════════════════════════

const ECORE_NS = 'http://www.eclipse.org/emf/2002/Ecore';

const ECORE_DATA_TYPES: Record<string, string> = {
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

// ═══════════════════════════════════════════════════════════════
// Helpers — minimal EClass factory (same pattern as XMISerializer)
// ═══════════════════════════════════════════════════════════════

type MinimalEClass = {
  name: string;
  ePackage: any;
  eSuperTypes: any[];
  eAllSuperTypes: any[];
  eStructuralFeatures: any[];
  eAllStructuralFeatures: any[];
  eOperations: any[];
  getEStructuralFeature: (name: string) => any;
  getFeatureID: (feature: any) => number;
  getFeatureCount: () => number;
  eAllAttributes: any[];
  eAllReferences: any[];
  eAllContainments: any[];
  eAllOperations: any[];
  eAttributes: any[];
  eReferences: any[];
  eIDAttribute: any;
  eGenericSuperTypes: any[];
  instanceClass: any;
  instanceClassName: string | null;
  instanceTypeName: string | null;
  abstract: boolean;
  interface: boolean;
  default: boolean;
  isSuperTypeOf: (other: any) => boolean;
  getFeatureType: (feature: any) => any;
  getOverride: (operation: any) => any;
  getOperation: (name: string) => any;
};

function makeMinimalEClass(name: string, features: any[] = []): MinimalEClass {
  const eAllAttributes = features.filter((f: any) => !f.containment && !f.eReferenceType);
  const eAllReferences = features.filter((f: any) => f.containment || f.eReferenceType);
  const eAllContainments = features.filter((f: any) => f.containment);
  return {
    name,
    ePackage: null,
    eSuperTypes: [],
    eAllSuperTypes: [],
    eStructuralFeatures: features,
    eAllStructuralFeatures: features,
    eOperations: [],
    getEStructuralFeature: (n: string) => features.find((f: any) => f.name === n) || null,
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
function makeEcoreFeature(name: string, containment: boolean = false, eReferenceType: any = null): any {
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
  { ...makeEcoreFeature('abstract'), derived: true },      // handled by special block
  { ...makeEcoreFeature('interface'), derived: true },     // handled by special block
  { ...makeEcoreFeature('eSuperTypes', false), derived: true }, // handled by special block
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
  { ...makeEcoreFeature('eAttributeType'), derived: true }, // same as eType, don't serialize
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
  { ...makeEcoreFeature('eReferenceType'), derived: true }, // same as eType, don't serialize
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
function setRefType(features: any[], refType: any) {
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
function setRefFeatureType(features: any[], featureName: string, refType: any) {
  const f = features.find((x: any) => x.name === featureName);
  if (f) f.eReferenceType = refType;
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
function makeEcoreDataType(name: string, instanceClassName: string): any {
  return {
    name,
    instanceClassName,
    serializable: true,
    ePackage: ECORE_PACKAGE,
    eClass: () => EDATATYPE_ECLASS,
    eGet: (feature: any) => undefined,
  };
}
const ECORE_DATA_TYPE_OBJECTS: Record<string, any> = {};
for (const [name, clsName] of Object.entries(ECORE_DATA_TYPES)) {
  ECORE_DATA_TYPE_OBJECTS[name] = makeEcoreDataType(name, clsName);
}

// ═══════════════════════════════════════════════════════════════
// Main conversion function
// ═══════════════════════════════════════════════════════════════

export function serializableToXmiCompatible(
  serializable: SerializableEPackage,
): any {
  const eClassifiers: any[] = [];
  const idToClassifier = new Map<string, any>();

  // Phase 1: Create all classifiers
  for (const sc of serializable.eClassifiers) {
    const name = sc.name || 'Unnamed';
    const serializableDT = sc as any;

    if ('eAttributes' in sc) {
      // It's an EClass
      const cls: any = {
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
        eGet: (feature: any) => (cls as any)[feature.name],
        eContainer: null,
        eResource: null,
        eIsProxy: false,
        // Will be populated in phase 2
        _superTypeNames: sc.eSuperTypes || [],
      };
      (cls as any).getEStructuralFeature = (n: string) =>
        cls.eStructuralFeatures.find((f: any) => f.name === n) || null;
      (cls as any).getFeatureID = () => -1;
      (cls as any).getFeatureCount = () => cls.eStructuralFeatures.length;

      // Add features (attributes + references)
      for (const attr of (sc as SerializableEClass).eAttributes) {
        const eTypeName = attr.eType || 'EString';
        const a: any = {
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
          eGet: (feature: any) => (a as any)[feature.name],
          _typeName: eTypeName, // stored for resolution in phase 2
        };
        cls.eStructuralFeatures.push(a);
        cls.eAttributes.push(a);
        cls.eAllAttributes.push(a);
      }

      for (const ref of (sc as SerializableEClass).eReferences) {
        const r: any = {
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
          eGet: (feature: any) => (r as any)[feature.name],
          _targetId: ref.targetId,
        };
        cls.eStructuralFeatures.push(r);
        cls.eReferences.push(r);
        cls.eAllReferences.push(r);
        if (r.containment) cls.eAllContainments.push(r);
      }

      cls.eAllStructuralFeatures = cls.eStructuralFeatures;
      eClassifiers.push(cls);
      idToClassifier.set(sc.id, cls);
    } else if ('eLiterals' in sc) {
      // It's an EEnum
      const enm: any = {
        name,
        serializable: true,
        instanceClassName: name,
        instanceClass: null,
        instanceTypeName: null,
        defaultValue: null,
        eLiterals: [],
        ePackage: null,
        eClass: () => EENUM_ECLASS,
        eGet: (feature: any) => (enm as any)[feature.name],
      };
      for (const lit of (sc as SerializableEEnum).eLiterals) {
        const litObj: any = {
          name: lit.name,
          value: lit.value,
          literal: lit.literal || lit.name,
          eClass: () => EENUMLITERAL_ECLASS,
          eGet: (feature: any) => (litObj as any)[feature.name],
        };
        enm.eLiterals.push(litObj);
      }
      eClassifiers.push(enm);
      idToClassifier.set(sc.id, enm);
    } else {
      // It's an EDataType
      const dt: any = {
        name,
        serializable: (serializableDT as any).serializable ?? true,
        instanceClassName: (serializableDT as any).instanceClassName || 'java.lang.String',
        instanceClass: null,
        instanceTypeName: null,
        defaultValue: null,
        ePackage: null,
        eClass: () => EDATATYPE_ECLASS,
        eGet: (feature: any) => (dt as any)[feature.name],
      };
      eClassifiers.push(dt);
      idToClassifier.set(sc.id, dt);
    }
  }

  // Phase 2: Resolve references and types
  // Build a map of all available types (standard Ecore types + our classifiers)
  const allTypes: Record<string, any> = { ...ECORE_DATA_TYPE_OBJECTS };
  for (const c of eClassifiers) {
    allTypes[c.name] = c;
  }
  // EEnum types are also valid eTypes for attributes
  for (const enm of eClassifiers.filter((c: any) => 'eLiterals' in c && !('eAttributes' in c))) {
    allTypes[enm.name] = enm;
  }

  for (const cls of eClassifiers) {
    if (!cls._superTypeNames && !cls._typeName && !cls.eAttributes?.some?.((a: any) => a._typeName)) continue;

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
    if (!cls.eOperations) continue;
    const scMatch = serializable.eClassifiers.find((sc: any) => sc.name === cls.name);
    if (!scMatch || !('eAttributes' in scMatch)) continue;
    const scClass = scMatch as any;

    if (scClass.eOperations && Array.isArray(scClass.eOperations)) {
      for (const op of scClass.eOperations) {
        const opObj: any = {
          name: op.name,
          eType: null,
          lowerBound: op.lowerBound ?? 0,
          upperBound: op.upperBound ?? 1,
          eParameters: [],
          eAnnotations: [],
          eClass: () => EOPERATION_ECLASS,
          eGet: (feature: any) => (opObj as any)[feature.name],
        };
        // Resolve return type
        if (op.eType) {
          const retType = allTypes[op.eType];
          if (retType) opObj.eType = retType;
        }
        // Process parameters
        if (op.eParameters && Array.isArray(op.eParameters)) {
          for (const param of op.eParameters) {
            const paramObj: any = {
              name: param.name,
              eType: null,
              lowerBound: param.lowerBound ?? 0,
              upperBound: param.upperBound ?? 1,
              eClass: () => EPARAMETER_ECLASS,
              eGet: (feature: any) => (paramObj as any)[feature.name],
            };
            if (param.eType) {
              const paramType = allTypes[param.eType];
              if (paramType) paramObj.eType = paramType;
            }
            opObj.eParameters.push(paramObj);
          }
        }
        // Process annotations (for OCL body)
        if (op.annotations && Array.isArray(op.annotations)) {
          for (const ann of op.annotations) {
            const annObj: any = {
              source: ann.source || '',
              details: ann.details || {},
              eClass: () => EANNOTATION_ECLASS,
              eGet: (feature: any) => (annObj as any)[feature.name],
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
        const annObj: any = {
          source: ann.source || '',
          details: ann.details || {},
          eClass: () => EANNOTATION_ECLASS,
          eGet: (feature: any) => (annObj as any)[feature.name],
        };
        cls.eAnnotations.push(annObj);
      }
    }
  }

  // Build EPackage
  // Process package-level annotations (OCL delegation)
  const pkgAnnotations: any[] = [];
  if (serializable.annotations && Array.isArray(serializable.annotations)) {
    for (const ann of serializable.annotations) {
      const annObj: any = {
        source: ann.source || '',
        details: ann.details || {},
        eClass: () => EANNOTATION_ECLASS,
        eGet: (feature: any) => (annObj as any)[feature.name],
      };
      pkgAnnotations.push(annObj);
    }
  }

  const pkg: any = {
    name: serializable.name || 'model',
    nsURI: serializable.nsURI || '',
    nsPrefix: serializable.nsPrefix || 'model',
    eClassifiers,
    eSubpackages: [],
    eAnnotations: pkgAnnotations,
    eFactoryInstance: null,
    eSuperPackage: null,
    getEClassifier: (name: string) => eClassifiers.find((c: any) => c.name === name) || null,
    eClass: () => EPACKAGE_ECLASS,
    eGet: (feature: any) => {
      if (feature.name === 'eClassifiers') return eClassifiers;
      if (feature.name === 'eSubpackages') return [];
      if (feature.name === 'eAnnotations') return pkgAnnotations;
      return (pkg as any)[feature.name];
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

function findClassifierByName(classifiers: any[], name: string): any {
  return classifiers.find((c) => c.name === name) || null;
}
