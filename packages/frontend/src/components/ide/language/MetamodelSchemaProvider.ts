/**
 * MetamodelSchemaProvider — Provides typed access to metamodel classes,
 * attributes, references, and enums for the language service.
 */

export interface SchemaAttribute {
  name: string;
  type: string; // EString, EInt, EBoolean, EFloat, EDouble, EDate, or custom EEnum name
  derived?: boolean;
}

export interface SchemaReference {
  name: string;
  targetClass: string; // name of the target EClass
  containment: boolean;
  isMany: boolean; // upperBound === -1
}

export interface SchemaClass {
  name: string;
  isAbstract: boolean;
  isInterface: boolean;
  attributes: SchemaAttribute[];
  references: SchemaReference[];
  superTypes: string[];
}

export interface SchemaEnum {
  name: string;
  literals: string[];
}

export class MetamodelSchemaProvider {
  private classes: Map<string, SchemaClass> = new Map();
  private enums: Map<string, SchemaEnum> = new Map();

  constructor(content: Record<string, unknown>) {
    this.parse(content);
  }

  private parse(content: Record<string, unknown>): void {
    const classifiers = (content.eClassifiers || []) as Record<string, unknown>[];
    for (const c of classifiers) {
      const name = c.name as string;
      if (!name) continue;

      if (c.eLiterals) {
        // It's an EEnum
        const literals = (c.eLiterals as Array<{ name: string }>).map((l) => l.name);
        this.enums.set(name, { name, literals });
      } else {
        // It's an EClass
        const attrs: SchemaAttribute[] = ((c.eAttributes || []) as Array<Record<string, unknown>>).map(
          (a) => ({
            name: a.name as string,
            type: (a.eType || a.type || 'EString') as string,
            derived: (a.derived as boolean) || false,
          }),
        );
        const refs: SchemaReference[] = ((c.eReferences || []) as Array<Record<string, unknown>>).map(
          (r) => ({
            name: r.name as string,
            targetClass: (r.targetId || 'EObject') as string,
            containment: (r.containment as boolean) || false,
            isMany: r.upperBound === -1,
          }),
        );
        this.classes.set(name, {
          name,
          isAbstract: (c.abstract as boolean) || false,
          isInterface: (c.interface as boolean) || false,
          attributes: attrs,
          references: refs,
          superTypes: (c.eSuperTypes as string[]) || [],
        });
      }
    }
  }

  getClasses(): SchemaClass[] {
    return [...this.classes.values()];
  }

  getClass(name: string): SchemaClass | undefined {
    return this.classes.get(name);
  }

  getEnums(): SchemaEnum[] {
    return [...this.enums.values()];
  }

  getEnum(name: string): SchemaEnum | undefined {
    return this.enums.get(name);
  }

  getClassNames(): string[] {
    return [...this.classes.keys()];
  }

  getEnumNames(): string[] {
    return [...this.enums.keys()];
  }

  getAllTypeNames(): string[] {
    return [
      ...this.classes.keys(),
      ...this.enums.keys(),
      'EString',
      'EInt',
      'EBoolean',
      'EFloat',
      'EDouble',
      'EDate',
    ];
  }

  /** Get all features (attributes + references) of a class, including inherited */
  getFeaturesOf(className: string): { attributes: SchemaAttribute[]; references: SchemaReference[] } {
    const cls = this.classes.get(className);
    if (!cls) return { attributes: [], references: [] };

    // Collect own features
    const allAttrs = [...cls.attributes];
    const allRefs = [...cls.references];

    // Collect inherited features (with cycle protection)
    const visited = new Set<string>([className]);
    for (const superName of cls.superTypes) {
      if (!visited.has(superName)) {
        visited.add(superName);
        const superFeatures = this.getFeaturesOfInternal(superName, visited);
        allAttrs.push(...superFeatures.attributes);
        allRefs.push(...superFeatures.references);
      }
    }

    return { attributes: allAttrs, references: allRefs };
  }

  private getFeaturesOfInternal(
    className: string,
    visited: Set<string>,
  ): { attributes: SchemaAttribute[]; references: SchemaReference[] } {
    const cls = this.classes.get(className);
    if (!cls) return { attributes: [], references: [] };

    const allAttrs = [...cls.attributes];
    const allRefs = [...cls.references];

    for (const superName of cls.superTypes) {
      if (!visited.has(superName)) {
        visited.add(superName);
        const superFeatures = this.getFeaturesOfInternal(superName, visited);
        allAttrs.push(...superFeatures.attributes);
        allRefs.push(...superFeatures.references);
      }
    }

    return { attributes: allAttrs, references: allRefs };
  }
}
