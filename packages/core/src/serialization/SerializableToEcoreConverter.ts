/**
 * @emf-webapp/core — SerializableToEcoreConverter
 *
 * Convierte el formato SerializableEPackage (JSON plano almacenado en DB)
 * a objetos EObject/EPackageImpl completos para usar con XMISerializer.
 *
 * Esto permite exportar metamodelos a XMI 2.0 compatible con Eclipse EMF.
 *
 * Formato de entrada: SerializableEPackage (desde frontend/types.ts)
 * Formato de salida: EPackageImpl (desde ecore/EPackageImpl.ts)
 */
import {
  EPackageImpl,
  EClassImpl,
  EEnumImpl,
  EDataTypeImpl,
  EAttributeImpl,
  EReferenceImpl,
  EOperationImpl,
  EParameterImpl,
  EEnumLiteralImpl,
  EAnnotationImpl,
} from '../ecore/index.js';
import type {
  EPackage,
  EClass,
  EEnum,
  EDataType,
  EAttribute,
  EReference,
  EEnumLiteral,
  EClassifier,
  EObject,
} from '../ecore/interfaces.js';

// ═══════════════════════════════════════════════════════════════
// Tipos de entrada (copiados de frontend/types.ts para uso backend)
// ═══════════════════════════════════════════════════════════════

export interface SerializableAnnotation {
  source: string;
  details: Record<string, string>;
}

export interface SerializableEAttribute {
  id: string;
  name: string;
  eType: string; // nombre del EDataType
  lowerBound: number;
  upperBound: number;
  iD: boolean;
  defaultValueLiteral: string;
  changeable: boolean;
  derived: boolean;
  transient: boolean;
  annotations?: SerializableAnnotation[];
}

export interface SerializableEReference {
  id: string;
  name: string;
  targetId: string; // ID del EClass destino
  containment: boolean;
  lowerBound: number;
  upperBound: number;
  eOpposite: string | null;
  changeable: boolean;
  derived: boolean;
  annotations?: SerializableAnnotation[];
}

export interface SerializableEParameter {
  id: string;
  name: string;
  eType: string;
  lowerBound: number;
  upperBound: number;
}

export interface SerializableEOperation {
  id: string;
  name: string;
  eType: string;  // return type name
  lowerBound: number;
  upperBound: number;
  eParameters: SerializableEParameter[];
  annotations?: SerializableAnnotation[];
}

export interface SerializableEClass {
  id: string;
  name: string;
  abstract: boolean;
  interface: boolean;
  eSuperTypes: string[]; // IDs de supertipos
  eAttributes: SerializableEAttribute[];
  eReferences: SerializableEReference[];
  eOperations?: SerializableEOperation[];
  annotations?: SerializableAnnotation[];
  position?: { x: number; y: number };
}

export interface SerializableEEnumLiteral {
  id: string;
  name: string;
  value: number;
  literal: string;
}

export interface SerializableEEnum {
  id: string;
  name: string;
  eLiterals: SerializableEEnumLiteral[];
  annotations?: SerializableAnnotation[];
  position?: { x: number; y: number };
}

export interface SerializableEDataType {
  id: string;
  name: string;
  instanceClassName: string;
  serializable: boolean;
  annotations?: SerializableAnnotation[];
  position?: { x: number; y: number };
}

export interface SerializableEPackage {
  name: string;
  nsURI: string;
  nsPrefix: string;
  eClassifiers: (SerializableEClass | SerializableEEnum | SerializableEDataType)[];
  annotations?: SerializableAnnotation[];
}

// ═══════════════════════════════════════════════════════════════
// Type Guards
// ═══════════════════════════════════════════════════════════════

function isSerializableEClass(c: any): c is SerializableEClass {
  return c && 'eAttributes' in c;
}

function isSerializableEEnum(c: any): c is SerializableEEnum {
  return c && 'eLiterals' in c && !('eAttributes' in c);
}

function isSerializableEDataType(c: any): c is SerializableEDataType {
  return c && !('eAttributes' in c) && !('eLiterals' in c);
}

// ═══════════════════════════════════════════════════════════════
// Constantes de tipos primitivos Ecore
// ═══════════════════════════════════════════════════════════════

const ECORE_PRIMITIVE_TYPES: Record<string, string> = {
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
// Converter
// ═══════════════════════════════════════════════════════════════

export class SerializableToEcoreConverter {
  private readonly idToClassifier = new Map<string, EClassifier>();
  private readonly idToEClass = new Map<string, EClass>();
  private readonly idToEDataType = new Map<string, EDataType>();
  private readonly ePackage: EPackageImpl;
  private readonly staticPackages: EPackageImpl[] = [];

  constructor() {
    this.ePackage = new EPackageImpl();
    // Create static Ecore package classifiers for primitive types
    this.initStaticDataTypes();
  }

  /**
   * Inicializa los EDataType estándar de Ecore como si fueran
   * parte del paquete http://www.eclipse.org/emf/2002/Ecore.
   */
  private initStaticDataTypes(): void {
    for (const [name, className] of Object.entries(ECORE_PRIMITIVE_TYPES)) {
      const dt = new EDataTypeImpl();
      dt.name = name;
      dt.instanceClassName = className;
      dt.serializable = true;
      this.idToEDataType.set(name, dt);
      this.idToClassifier.set(name, dt);
    }
  }

  /**
   * Convierte un SerializableEPackage a EPackageImpl.
   * @returns EPackage listo para usar con XMISerializer
   */
  convert(serializable: SerializableEPackage): EPackageImpl {
    this.ePackage.name = serializable.name || 'model';
    this.ePackage.nsURI = serializable.nsURI || '';
    this.ePackage.nsPrefix = serializable.nsPrefix || 'model';

    // Fase 1: Crear todos los classifiers vacíos
    for (const sc of serializable.eClassifiers) {
      if (isSerializableEClass(sc)) {
        const cls = new EClassImpl();
        cls.name = sc.name;
        cls.abstract = sc.abstract ?? false;
        cls.interface = sc.interface ?? false;
        this.idToClassifier.set(sc.id, cls);
        this.idToEClass.set(sc.id, cls);
      } else if (isSerializableEEnum(sc)) {
        const enm = new EEnumImpl();
        enm.name = sc.name;
        enm.serializable = true;
        enm.instanceClassName = sc.name;
        for (const lit of sc.eLiterals) {
          const literal = new EEnumLiteralImpl();
          literal.name = lit.name;
          literal.value = lit.value;
          literal.literal = lit.literal || lit.name;
          enm.eLiterals.push(literal);
        }
        this.idToClassifier.set(sc.id, enm);
      } else if (isSerializableEDataType(sc)) {
        const dt = new EDataTypeImpl();
        dt.name = sc.name;
        dt.instanceClassName = sc.instanceClassName || 'java.lang.String';
        dt.serializable = sc.serializable ?? true;
        this.idToClassifier.set(sc.id, dt);
        this.idToEDataType.set(sc.id, dt);
      }
    }

    // Fase 2: Poblar features y conexiones
    for (const sc of serializable.eClassifiers) {
      if (!isSerializableEClass(sc)) continue;
      const cls = this.idToEClass.get(sc.id);
      if (!cls) continue;

      // eSuperTypes
      for (const superId of sc.eSuperTypes || []) {
        const supCls = this.idToEClass.get(superId);
        if (supCls) {
          cls.eSuperTypes = [...cls.eSuperTypes, supCls];
        }
      }

      // eAttributes
      for (const sa of sc.eAttributes || []) {
        const attr = new EAttributeImpl();
        attr.name = sa.name;
        attr.lowerBound = sa.lowerBound;
        attr.upperBound = sa.upperBound;
        attr.iD = sa.iD ?? false;
        attr.changeable = sa.changeable ?? true;
        attr.derived = sa.derived ?? false;
        attr.transient = sa.transient ?? false;
        attr.defaultValueLiteral = sa.defaultValueLiteral ?? '';
        attr.ordered = true;
        attr.unique = true;
        attr.unsettable = false;
        attr.volatile = false;

        // Resolver eType
        const dt = this.idToEDataType.get(sa.eType);
        if (dt) {
          attr.eType = dt;
        } else {
          // Buscar en primitivas estándar
          const prim = this.idToEDataType.get(sa.eType);
          attr.eType = prim || null;
        }

        // EAnnotations
        if (sa.annotations) {
          for (const ann of sa.annotations) {
            attr.eAnnotations.push(this.createAnnotation(ann));
          }
        }

        cls.eStructuralFeatures.push(attr);
      }

      // eReferences
      for (const sr of sc.eReferences || []) {
        const ref = new EReferenceImpl();
        ref.name = sr.name;
        ref.lowerBound = sr.lowerBound;
        ref.upperBound = sr.upperBound;
        ref.containment = sr.containment ?? false;
        ref.changeable = sr.changeable ?? true;
        ref.derived = sr.derived ?? false;
        ref.ordered = true;
        ref.unique = true;
        ref.resolveProxies = true;
        ref.unsettable = false;
        ref.volatile = false;

        // Resolver target type
        const targetCls = this.idToEClass.get(sr.targetId);
        if (targetCls) {
          ref.eType = targetCls;
        }

        // eOpposite
        if (sr.eOpposite) {
          // Buscar la referencia opuesta por ID
          for (const otherSc of serializable.eClassifiers) {
            if (!isSerializableEClass(otherSc)) continue;
            const oppRef = otherSc.eReferences.find(r => r.id === sr.eOpposite);
            if (oppRef) {
              const oppEClass = this.idToEClass.get(otherSc.id);
              if (oppEClass) {
                const opp = oppEClass.eReferences.find(r => r.name === oppRef.name);
                if (opp) {
                  ref.eOpposite = opp as EReference;
                }
              }
            }
          }
        }

        // EAnnotations
        if (sr.annotations) {
          for (const ann of sr.annotations) {
            ref.eAnnotations.push(this.createAnnotation(ann));
          }
        }

        cls.eStructuralFeatures.push(ref);
      }
    }

    // Fase 3: Asignar cada classifier al paquete
    this.idToClassifier.forEach((classifier, id) => {
      // Skip primitive types
      if (id in ECORE_PRIMITIVE_TYPES) return;
      this.ePackage.eClassifiers.push(classifier);
    });

    return this.ePackage;
  }

  private createAnnotation(sa: SerializableAnnotation): EAnnotationImpl {
    const ann = new EAnnotationImpl();
    ann.source = sa.source || '';
    if (sa.details) {
      for (const [key, value] of Object.entries(sa.details)) {
        (ann as any).details[key] = value;
      }
    }
    return ann;
  }
}
