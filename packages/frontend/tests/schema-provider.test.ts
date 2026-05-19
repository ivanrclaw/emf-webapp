import { describe, it, expect, beforeEach } from 'vitest';
import { MetamodelSchemaProvider } from '../src/components/ide/language/MetamodelSchemaProvider';

const sampleMetamodel = {
  eClassifiers: [
    {
      name: 'Person',
      abstract: false,
      interface: false,
      eAttributes: [
        { name: 'name', eType: 'EString' },
        { name: 'age', eType: 'EInt' },
      ],
      eReferences: [
        { name: 'address', targetId: 'Address', containment: true, upperBound: 1 },
        { name: 'friends', targetId: 'Person', containment: false, upperBound: -1 },
      ],
    },
    {
      name: 'Address',
      abstract: false,
      interface: false,
      eAttributes: [
        { name: 'street', eType: 'EString' },
        { name: 'city', eType: 'EString' },
      ],
      eReferences: [],
    },
    {
      name: 'Employee',
      abstract: false,
      interface: false,
      eSuperTypes: ['Person'],
      eAttributes: [
        { name: 'salary', eType: 'EDouble' },
      ],
      eReferences: [
        { name: 'company', targetId: 'Company', containment: false, upperBound: 1 },
      ],
    },
    {
      name: 'Company',
      abstract: false,
      interface: false,
      eAttributes: [
        { name: 'name', eType: 'EString' },
      ],
      eReferences: [
        { name: 'employees', targetId: 'Employee', containment: true, upperBound: -1 },
      ],
    },
  ],
};

const metamodelWithEnum = {
  eClassifiers: [
    ...sampleMetamodel.eClassifiers,
    {
      name: 'Gender',
      eLiterals: [{ name: 'MALE' }, { name: 'FEMALE' }, { name: 'OTHER' }],
    },
  ],
};

describe('MetamodelSchemaProvider', () => {
  let provider: MetamodelSchemaProvider;

  beforeEach(() => {
    provider = new MetamodelSchemaProvider(sampleMetamodel);
  });

  describe('getClasses', () => {
    it('returns all classes', () => {
      const classes = provider.getClasses();
      expect(classes).toHaveLength(4);
      const names = classes.map((c) => c.name);
      expect(names).toContain('Person');
      expect(names).toContain('Address');
      expect(names).toContain('Employee');
      expect(names).toContain('Company');
    });

    it('does not include enums in classes', () => {
      const providerWithEnum = new MetamodelSchemaProvider(metamodelWithEnum);
      const classes = providerWithEnum.getClasses();
      const names = classes.map((c) => c.name);
      expect(names).not.toContain('Gender');
    });
  });

  describe('getClass', () => {
    it('returns class by name', () => {
      const cls = provider.getClass('Person');
      expect(cls).toBeDefined();
      expect(cls!.name).toBe('Person');
    });

    it('returns undefined for unknown class', () => {
      const cls = provider.getClass('NonExistent');
      expect(cls).toBeUndefined();
    });

    it('correctly parses abstract flag', () => {
      const cls = provider.getClass('Person');
      expect(cls!.isAbstract).toBe(false);
    });

    it('correctly parses attributes', () => {
      const cls = provider.getClass('Person');
      expect(cls!.attributes).toHaveLength(2);
      expect(cls!.attributes[0]).toMatchObject({ name: 'name', type: 'EString' });
      expect(cls!.attributes[1]).toMatchObject({ name: 'age', type: 'EInt' });
    });

    it('correctly parses references', () => {
      const cls = provider.getClass('Person');
      expect(cls!.references).toHaveLength(2);
      expect(cls!.references[0]).toMatchObject({
        name: 'address',
        targetClass: 'Address',
        containment: true,
        isMany: false,
      });
      expect(cls!.references[1]).toMatchObject({
        name: 'friends',
        targetClass: 'Person',
        containment: false,
        isMany: true,
      });
    });

    it('correctly parses superTypes', () => {
      const cls = provider.getClass('Employee');
      expect(cls!.superTypes).toContain('Person');
    });
  });

  describe('getFeaturesOf (includes inherited)', () => {
    it('returns own attributes', () => {
      const features = provider.getFeaturesOf('Person');
      const attrNames = features.attributes.map((a) => a.name);
      expect(attrNames).toContain('name');
      expect(attrNames).toContain('age');
    });

    it('returns own references', () => {
      const features = provider.getFeaturesOf('Person');
      const refNames = features.references.map((r) => r.name);
      expect(refNames).toContain('address');
      expect(refNames).toContain('friends');
    });

    it('includes inherited attributes for subclass', () => {
      const features = provider.getFeaturesOf('Employee');
      const attrNames = features.attributes.map((a) => a.name);
      // Own attribute
      expect(attrNames).toContain('salary');
      // Inherited from Person
      expect(attrNames).toContain('name');
      expect(attrNames).toContain('age');
    });

    it('includes inherited references for subclass', () => {
      const features = provider.getFeaturesOf('Employee');
      const refNames = features.references.map((r) => r.name);
      // Own reference
      expect(refNames).toContain('company');
      // Inherited from Person
      expect(refNames).toContain('address');
      expect(refNames).toContain('friends');
    });

    it('returns empty for unknown class', () => {
      const features = provider.getFeaturesOf('NonExistent');
      expect(features.attributes).toHaveLength(0);
      expect(features.references).toHaveLength(0);
    });
  });

  describe('getEnums', () => {
    it('returns enums', () => {
      const providerWithEnum = new MetamodelSchemaProvider(metamodelWithEnum);
      const enums = providerWithEnum.getEnums();
      expect(enums).toHaveLength(1);
      expect(enums[0].name).toBe('Gender');
      expect(enums[0].literals).toEqual(['MALE', 'FEMALE', 'OTHER']);
    });

    it('returns empty array when no enums', () => {
      const enums = provider.getEnums();
      expect(enums).toHaveLength(0);
    });
  });

  describe('getClassNames / getEnumNames / getAllTypeNames', () => {
    it('getClassNames returns all class names', () => {
      const names = provider.getClassNames();
      expect(names).toHaveLength(4);
      expect(names).toContain('Person');
      expect(names).toContain('Employee');
    });

    it('getEnumNames returns enum names', () => {
      const providerWithEnum = new MetamodelSchemaProvider(metamodelWithEnum);
      const names = providerWithEnum.getEnumNames();
      expect(names).toContain('Gender');
    });

    it('getAllTypeNames includes classes, enums, and primitives', () => {
      const providerWithEnum = new MetamodelSchemaProvider(metamodelWithEnum);
      const names = providerWithEnum.getAllTypeNames();
      expect(names).toContain('Person');
      expect(names).toContain('Gender');
      expect(names).toContain('EString');
      expect(names).toContain('EInt');
      expect(names).toContain('EBoolean');
    });
  });
});
