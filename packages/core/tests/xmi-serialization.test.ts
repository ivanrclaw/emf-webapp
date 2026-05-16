/**
 * XMI serialization/deserialization tests.
 */
import { describe, it, expect } from 'vitest';
import {
  serializeToXMI,
  deserializeFromXMI,
  getDefaultEcoreRegistry,
} from '../src/serialization/XMISerializer.js';

// ============================================================
// Globals
// ============================================================

const ECORE_REGISTRY = getDefaultEcoreRegistry();

// ============================================================
// Test Data — XMI strings
// ============================================================

const EMPTY_PACKAGE_XMI = `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmi:version="2.0"
    xmlns:xmi="http://www.omg.org/XMI"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore"
    name="mylib" nsURI="http://mylib/1.0" nsPrefix="mylib"/>`;

const ECLASS_WITH_EATTRIBUTE_XMI = `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmi:version="2.0"
    xmlns:xmi="http://www.omg.org/XMI"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore"
    name="mylib" nsURI="http://mylib/1.0" nsPrefix="mylib">
  <eClassifiers xsi:type="ecore:EClass" name="Person">
    <eStructuralFeatures xsi:type="ecore:EAttribute" name="name"
        lowerBound="0" upperBound="1"
        iD="true"/>
  </eClassifiers>
</ecore:EPackage>`;

const ECLASS_WITH_EREFERENCE_XMI = `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmi:version="2.0"
    xmlns:xmi="http://www.omg.org/XMI"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore"
    name="mylib" nsURI="http://mylib/1.0" nsPrefix="mylib">
  <eClassifiers xsi:type="ecore:EClass" name="Agent">
    <eStructuralFeatures xsi:type="ecore:EReference" name="agents"
        lowerBound="0" upperBound="-1"
        containment="true"/>
  </eClassifiers>
</ecore:EPackage>`;

const ECLASS_WITH_ESUPERTYPES_XMI = `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmi:version="2.0"
    xmlns:xmi="http://www.omg.org/XMI"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore"
    name="mylib" nsURI="http://mylib/1.0" nsPrefix="mylib">
  <eClassifiers xsi:type="ecore:EClass" name="Base"/>
  <eClassifiers xsi:type="ecore:EClass" name="Derived"
      eSuperTypes="#//Base"/>
</ecore:EPackage>`;

const EENUM_XMI = `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmi:version="2.0"
    xmlns:xmi="http://www.omg.org/XMI"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore"
    name="mylib" nsURI="http://mylib/1.0" nsPrefix="mylib">
  <eClassifiers xsi:type="ecore:EEnum" name="Status">
    <eLiterals name="ACTIVE" value="0" literal="Active"/>
    <eLiterals name="INACTIVE" value="1" literal="Inactive"/>
  </eClassifiers>
</ecore:EPackage>`;

const EANNOTATION_XMI = `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmi:version="2.0"
    xmlns:xmi="http://www.omg.org/XMI"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore"
    name="mylib" nsURI="http://mylib/1.0" nsPrefix="mylib">
  <eAnnotations source="http://www.eclipse.org/emf/2002/Ecore">
    <details key="invocationDelegates" value="http://www.eclipse.org/emf/2002/Ecore/OCL/Pivot"/>
  </eAnnotations>
</ecore:EPackage>`;

const EOPERATION_XMI = `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmi:version="2.0"
    xmlns:xmi="http://www.omg.org/XMI"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore"
    name="mylib" nsURI="http://mylib/1.0" nsPrefix="mylib">
  <eClassifiers xsi:type="ecore:EClass" name="Service">
    <eOperations xsi:type="ecore:EOperation" name="doSomething">
      <eParameters name="input"/>
    </eOperations>
  </eClassifiers>
</ecore:EPackage>`;

// ============================================================
// Tests: Deserialization
// ============================================================

describe('XMI Deserialization', () => {

  it('1. debe deserializar EPackage vacío con name/nsURI/nsPrefix', () => {
    const pkg = deserializeFromXMI(EMPTY_PACKAGE_XMI, ECORE_REGISTRY) as any;
    expect(pkg.name).toBe('mylib');
    expect(pkg.nsURI).toBe('http://mylib/1.0');
    expect(pkg.nsPrefix).toBe('mylib');
  });

  it('2. debe deserializar EClass con EAttribute', () => {
    const pkg = deserializeFromXMI(ECLASS_WITH_EATTRIBUTE_XMI, ECORE_REGISTRY) as any;
    expect(pkg.name).toBe('mylib');
    expect(pkg.eClassifiers).toHaveLength(1);

    const person = pkg.eClassifiers[0];
    expect(person.name).toBe('Person');
    expect(person.eStructuralFeatures).toHaveLength(1);

    const nameAttr = person.eStructuralFeatures[0];
    expect(nameAttr.name).toBe('name');
    expect(nameAttr.iD).toBe(true);
    expect(nameAttr.lowerBound).toBe(0);
    expect(nameAttr.upperBound).toBe(1);
  });

  it('3. debe deserializar EReference con containment', () => {
    const pkg = deserializeFromXMI(ECLASS_WITH_EREFERENCE_XMI, ECORE_REGISTRY) as any;
    const agent = pkg.eClassifiers[0];
    expect(agent.name).toBe('Agent');
    expect(agent.eStructuralFeatures).toHaveLength(1);

    const ref = agent.eStructuralFeatures[0];
    expect(ref.name).toBe('agents');
    expect(ref.containment).toBe(true);
    expect(ref.lowerBound).toBe(0);
    expect(ref.upperBound).toBe(-1);
  });

  it('4. debe deserializar eSuperTypes como referencia', () => {
    const pkg = deserializeFromXMI(ECLASS_WITH_ESUPERTYPES_XMI, ECORE_REGISTRY) as any;
    const derived = pkg.eClassifiers[1];
    expect(derived.name).toBe('Derived');

    // Verify re-serialization references eSuperTypes
    const xmi2 = serializeToXMI(pkg);
    expect(xmi2).toContain('eSuperTypes="#//Base"');
  });

  it('5. debe deserializar EEnum con literales', () => {
    const pkg = deserializeFromXMI(EENUM_XMI, ECORE_REGISTRY) as any;
    const enumType = pkg.eClassifiers[0];
    expect(enumType.name).toBe('Status');
    expect(enumType.eLiterals).toHaveLength(2);

    const lit0 = enumType.eLiterals[0];
    expect(lit0.name).toBe('ACTIVE');
    expect(lit0.value).toBe(0);
    expect(lit0.literal).toBe('Active');

    const lit1 = enumType.eLiterals[1];
    expect(lit1.name).toBe('INACTIVE');
    expect(lit1.value).toBe(1);
    expect(lit1.literal).toBe('Inactive');
  });

  it('6. debe deserializar EAnnotation con details key/value', () => {
    const pkg = deserializeFromXMI(EANNOTATION_XMI, ECORE_REGISTRY) as any;
    expect(pkg.eAnnotations).toHaveLength(1);

    const ann = pkg.eAnnotations[0];
    expect(ann.source).toBe('http://www.eclipse.org/emf/2002/Ecore');
    expect(ann.details).toBeTruthy();
    expect(ann.details['invocationDelegates']).toBe(
      'http://www.eclipse.org/emf/2002/Ecore/OCL/Pivot'
    );
  });

  it('7. debe deserializar EOperation con EParameter', () => {
    const pkg = deserializeFromXMI(EOPERATION_XMI, ECORE_REGISTRY) as any;
    const svc = pkg.eClassifiers[0];
    expect(svc.name).toBe('Service');
    expect(svc.eOperations).toHaveLength(1);

    const op = svc.eOperations[0];
    expect(op.name).toBe('doSomething');
    expect(op.eParameters).toHaveLength(1);

    const param = op.eParameters[0];
    expect(param.name).toBe('input');
  });

});

// ============================================================
// Tests: Roundtrip
// ============================================================

describe('XMI Roundtrip', () => {

  it('8. roundtrip EPackage vacío: deserializar → serializar', () => {
    const pkg = deserializeFromXMI(EMPTY_PACKAGE_XMI, ECORE_REGISTRY);
    const xmi = serializeToXMI(pkg);

    expect(xmi).toContain('xmi:version="2.0"');
    expect(xmi).toContain('name="mylib"');
    expect(xmi).toContain('nsURI="http://mylib/1.0"');
    expect(xmi).toContain('nsPrefix="mylib"');
    expect(xmi).toContain('<ecore:EPackage');
    // Empty EPackage puede ser self-closing (/>) o con closing tag
    expect(xmi).toMatch(/(?:<\/ecore:EPackage>|\/>)/);
  });

  it('9. roundtrip EClass + EAttribute preserva estructura', () => {
    const pkg = deserializeFromXMI(ECLASS_WITH_EATTRIBUTE_XMI, ECORE_REGISTRY);
    const xmi = serializeToXMI(pkg);

    expect(xmi).toContain('name="Person"');
    expect(xmi).toContain('xsi:type="ecore:EClass"');
    expect(xmi).toContain('xsi:type="ecore:EAttribute"');
    expect(xmi).toContain('name="name"');
    expect(xmi).toContain('iD="true"');
    expect(xmi).toContain('lowerBound="0"');
    expect(xmi).toContain('upperBound="1"');
  });

  it('10. roundtrip EReference: containment y eType preservados', () => {
    const pkg = deserializeFromXMI(ECLASS_WITH_EREFERENCE_XMI, ECORE_REGISTRY);
    const xmi = serializeToXMI(pkg);

    expect(xmi).toContain('xsi:type="ecore:EReference"');
    expect(xmi).toContain('name="agents"');
    expect(xmi).toContain('containment="true"');
  });

  it('11. roundtrip EEnum: literales preservados', () => {
    const pkg = deserializeFromXMI(EENUM_XMI, ECORE_REGISTRY);
    const xmi = serializeToXMI(pkg);

    expect(xmi).toContain('xsi:type="ecore:EEnum"');
    expect(xmi).toContain('name="ACTIVE"');
    expect(xmi).toContain('value="0"');
    expect(xmi).toContain('literal="Active"');
    expect(xmi).toContain('name="INACTIVE"');
    expect(xmi).toContain('value="1"');
    expect(xmi).toContain('literal="Inactive"');
  });

  it('12. roundtrip EAnnotation: source y details preservados', () => {
    const pkg = deserializeFromXMI(EANNOTATION_XMI, ECORE_REGISTRY);
    const xmi = serializeToXMI(pkg);

    expect(xmi).toContain('source="http://www.eclipse.org/emf/2002/Ecore"');
    expect(xmi).toContain('<details');
    expect(xmi).toContain('key="invocationDelegates"');
    expect(xmi).toContain('value="http://www.eclipse.org/emf/2002/Ecore/OCL/Pivot"');
  });

  it('13. el XMI re-serializado debe tener formato XML bien formado', () => {
    const pkg = deserializeFromXMI(ECLASS_WITH_EATTRIBUTE_XMI, ECORE_REGISTRY);
    const xmi = serializeToXMI(pkg);

    expect(xmi.startsWith('<?xml')).toBe(true);
    expect(xmi).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xmi).toContain('<ecore:EPackage');
    expect(xmi).toContain('</ecore:EPackage>');
  });

});
