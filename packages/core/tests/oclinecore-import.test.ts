/**
 * @emf-webapp/core — OCLinEcore Import Tests
 *
 * Verifica que parseEcoreXmi extrae correctamente las EAnnotations OCL
 * de archivos .ecore con restricciones OCLinEcore embebidas.
 */
import { describe, it, expect } from 'vitest';
import { parseEcoreXmi } from '../src/serialization/EcoreXmiParser.js';

// ═══════════════════════════════════════════════════════════════
// Fixtures: .ecore XML con OCLinEcore constraints
// ═══════════════════════════════════════════════════════════════

const ECORE_WITH_OCL_PIVOT = `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmi:version="2.0"
    xmlns:xmi="http://www.omg.org/XMI"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore"
    name="AuditMM" nsURI="http://example.org/audit" nsPrefix="audit">
  <eClassifiers xsi:type="ecore:EClass" name="Employee">
    <eAnnotations source="http://www.eclipse.org/emf/2002/Ecore">
      <details key="constraints" value="EmployeeSalaryValid NameNotEmpty"/>
    </eAnnotations>
    <eAnnotations source="http://www.eclipse.org/emf/2002/Ecore/OCL/Pivot">
      <details key="EmployeeSalaryValid" value="self.salary &gt; 0"/>
      <details key="NameNotEmpty" value="self.name &lt;&gt; &apos;&apos;"/>
    </eAnnotations>
    <eStructuralFeatures xsi:type="ecore:EAttribute" name="name" eType="ecore:EDataType http://www.eclipse.org/emf/2002/Ecore#//EString"/>
    <eStructuralFeatures xsi:type="ecore:EAttribute" name="salary" eType="ecore:EDataType http://www.eclipse.org/emf/2002/Ecore#//EInt"/>
  </eClassifiers>
  <eClassifiers xsi:type="ecore:EClass" name="Department">
    <eAnnotations source="http://www.eclipse.org/emf/2002/Ecore">
      <details key="constraints" value="HasManager"/>
    </eAnnotations>
    <eAnnotations source="http://www.eclipse.org/emf/2002/Ecore/OCL/Pivot">
      <details key="HasManager" value="not self.manager.oclIsUndefined()"/>
    </eAnnotations>
    <eStructuralFeatures xsi:type="ecore:EReference" name="manager" eType="#//Employee"/>
    <eStructuralFeatures xsi:type="ecore:EReference" name="employees" upperBound="-1" eType="#//Employee" containment="true"/>
  </eClassifiers>
</ecore:EPackage>`;

const ECORE_WITH_OCL_LEGACY = `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmi:version="2.0"
    xmlns:xmi="http://www.omg.org/XMI"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore"
    name="LegacyMM" nsURI="http://example.org/legacy" nsPrefix="legacy">
  <eClassifiers xsi:type="ecore:EClass" name="Person">
    <eAnnotations source="http://www.eclipse.org/emf/2002/Ecore">
      <details key="constraints" value="AgeValid"/>
    </eAnnotations>
    <eAnnotations source="http://www.eclipse.org/emf/2002/Ecore/OCL">
      <details key="AgeValid" value="self.age &gt;= 0 and self.age &lt;= 150"/>
    </eAnnotations>
    <eStructuralFeatures xsi:type="ecore:EAttribute" name="age" eType="ecore:EDataType http://www.eclipse.org/emf/2002/Ecore#//EInt"/>
  </eClassifiers>
</ecore:EPackage>`;

const ECORE_WITHOUT_OCL = `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmi:version="2.0"
    xmlns:xmi="http://www.omg.org/XMI"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore"
    name="SimpleMM" nsURI="http://example.org/simple" nsPrefix="simple">
  <eClassifiers xsi:type="ecore:EClass" name="Item">
    <eStructuralFeatures xsi:type="ecore:EAttribute" name="title" eType="ecore:EDataType http://www.eclipse.org/emf/2002/Ecore#//EString"/>
  </eClassifiers>
</ecore:EPackage>`;

const ECORE_MULTIPLE_CONSTRAINTS_SAME_CLASS = `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmi:version="2.0"
    xmlns:xmi="http://www.omg.org/XMI"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore"
    name="OrderMM" nsURI="http://example.org/order" nsPrefix="order">
  <eClassifiers xsi:type="ecore:EClass" name="Order">
    <eAnnotations source="http://www.eclipse.org/emf/2002/Ecore">
      <details key="constraints" value="HasItems TotalPositive ValidStatus"/>
    </eAnnotations>
    <eAnnotations source="http://www.eclipse.org/emf/2002/Ecore/OCL/Pivot">
      <details key="HasItems" value="self.items-&gt;notEmpty()"/>
      <details key="TotalPositive" value="self.total &gt; 0"/>
      <details key="ValidStatus" value="Set{&apos;pending&apos;, &apos;shipped&apos;, &apos;delivered&apos;}-&gt;includes(self.status)"/>
    </eAnnotations>
    <eStructuralFeatures xsi:type="ecore:EAttribute" name="total" eType="ecore:EDataType http://www.eclipse.org/emf/2002/Ecore#//EDouble"/>
    <eStructuralFeatures xsi:type="ecore:EAttribute" name="status" eType="ecore:EDataType http://www.eclipse.org/emf/2002/Ecore#//EString"/>
    <eStructuralFeatures xsi:type="ecore:EReference" name="items" upperBound="-1" eType="#//OrderItem" containment="true"/>
  </eClassifiers>
  <eClassifiers xsi:type="ecore:EClass" name="OrderItem">
    <eStructuralFeatures xsi:type="ecore:EAttribute" name="quantity" eType="ecore:EDataType http://www.eclipse.org/emf/2002/Ecore#//EInt"/>
  </eClassifiers>
</ecore:EPackage>`;

// ═══════════════════════════════════════════════════════════════
// Helper: extract OCL constraints from parsed package (mirrors backend logic)
// ═══════════════════════════════════════════════════════════════

function extractOCLConstraintsFromPackage(
  pkg: any,
): Array<{ name: string; context: string; expression: string }> {
  const results: Array<{ name: string; context: string; expression: string }> = [];

  const OCL_SOURCES = [
    'http://www.eclipse.org/emf/2002/Ecore/OCL/Pivot',
    'http://www.eclipse.org/emf/2002/Ecore/OCL',
  ];

  for (const classifier of pkg.eClassifiers || []) {
    if (!classifier.eAttributes && !classifier.eReferences) continue;
    if (!classifier.annotations || classifier.annotations.length === 0) continue;

    const className = classifier.name;

    const oclAnnotation = classifier.annotations.find((a: any) =>
      OCL_SOURCES.includes(a.source),
    );

    if (!oclAnnotation?.details) continue;

    for (const [key, value] of Object.entries(oclAnnotation.details)) {
      if (!key || !value) continue;
      if (key === 'body' || key === 'derivation' || key === 'init') continue;

      results.push({
        name: key,
        context: className,
        expression: value as string,
      });
    }
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════

describe('OCLinEcore Import — Annotation Parsing', () => {
  it('parses OCL/Pivot annotations from Employee class', () => {
    const pkg = parseEcoreXmi(ECORE_WITH_OCL_PIVOT);

    const employee = pkg.eClassifiers.find((c) => c.name === 'Employee') as any;
    expect(employee).toBeDefined();
    expect(employee.annotations).toBeDefined();
    expect(employee.annotations.length).toBeGreaterThanOrEqual(2);

    // Ecore annotation with constraint names
    const ecoreAnn = employee.annotations.find(
      (a: any) => a.source === 'http://www.eclipse.org/emf/2002/Ecore',
    );
    expect(ecoreAnn).toBeDefined();
    expect(ecoreAnn.details.constraints).toBe('EmployeeSalaryValid NameNotEmpty');

    // OCL/Pivot annotation with expressions
    const oclAnn = employee.annotations.find(
      (a: any) => a.source === 'http://www.eclipse.org/emf/2002/Ecore/OCL/Pivot',
    );
    expect(oclAnn).toBeDefined();
    expect(oclAnn.details.EmployeeSalaryValid).toBe('self.salary > 0');
    expect(oclAnn.details.NameNotEmpty).toBe("self.name <> ''");
  });

  it('parses OCL/Pivot annotations from Department class', () => {
    const pkg = parseEcoreXmi(ECORE_WITH_OCL_PIVOT);

    const dept = pkg.eClassifiers.find((c) => c.name === 'Department') as any;
    expect(dept).toBeDefined();
    expect(dept.annotations).toBeDefined();

    const oclAnn = dept.annotations.find(
      (a: any) => a.source === 'http://www.eclipse.org/emf/2002/Ecore/OCL/Pivot',
    );
    expect(oclAnn).toBeDefined();
    expect(oclAnn.details.HasManager).toBe('not self.manager.oclIsUndefined()');
  });

  it('parses legacy OCL annotations (without /Pivot)', () => {
    const pkg = parseEcoreXmi(ECORE_WITH_OCL_LEGACY);

    const person = pkg.eClassifiers.find((c) => c.name === 'Person') as any;
    expect(person).toBeDefined();

    const oclAnn = person.annotations.find(
      (a: any) => a.source === 'http://www.eclipse.org/emf/2002/Ecore/OCL',
    );
    expect(oclAnn).toBeDefined();
    expect(oclAnn.details.AgeValid).toBe('self.age >= 0 and self.age <= 150');
  });

  it('handles .ecore without OCL annotations gracefully', () => {
    const pkg = parseEcoreXmi(ECORE_WITHOUT_OCL);

    const item = pkg.eClassifiers.find((c) => c.name === 'Item') as any;
    expect(item).toBeDefined();
    expect(item.annotations).toBeUndefined();
  });

  it('unescapes XML entities in OCL expressions', () => {
    const pkg = parseEcoreXmi(ECORE_WITH_OCL_PIVOT);

    const employee = pkg.eClassifiers.find((c) => c.name === 'Employee') as any;
    const oclAnn = employee.annotations.find(
      (a: any) => a.source === 'http://www.eclipse.org/emf/2002/Ecore/OCL/Pivot',
    );

    // &gt; should be unescaped to >
    expect(oclAnn.details.EmployeeSalaryValid).toBe('self.salary > 0');
    // &lt;&gt; should be unescaped to <>
    expect(oclAnn.details.NameNotEmpty).toContain('<>');
  });
});

describe('OCLinEcore Import — Constraint Extraction', () => {
  it('extracts constraints from OCL/Pivot annotations', () => {
    const pkg = parseEcoreXmi(ECORE_WITH_OCL_PIVOT);
    const constraints = extractOCLConstraintsFromPackage(pkg);

    expect(constraints).toHaveLength(3);

    const salaryConstraint = constraints.find((c) => c.name === 'EmployeeSalaryValid');
    expect(salaryConstraint).toBeDefined();
    expect(salaryConstraint!.context).toBe('Employee');
    expect(salaryConstraint!.expression).toBe('self.salary > 0');

    const nameConstraint = constraints.find((c) => c.name === 'NameNotEmpty');
    expect(nameConstraint).toBeDefined();
    expect(nameConstraint!.context).toBe('Employee');
    expect(nameConstraint!.expression).toBe("self.name <> ''");

    const managerConstraint = constraints.find((c) => c.name === 'HasManager');
    expect(managerConstraint).toBeDefined();
    expect(managerConstraint!.context).toBe('Department');
    expect(managerConstraint!.expression).toBe('not self.manager.oclIsUndefined()');
  });

  it('extracts constraints from legacy OCL annotations', () => {
    const pkg = parseEcoreXmi(ECORE_WITH_OCL_LEGACY);
    const constraints = extractOCLConstraintsFromPackage(pkg);

    expect(constraints).toHaveLength(1);
    expect(constraints[0].name).toBe('AgeValid');
    expect(constraints[0].context).toBe('Person');
    expect(constraints[0].expression).toBe('self.age >= 0 and self.age <= 150');
  });

  it('returns empty array for .ecore without OCL', () => {
    const pkg = parseEcoreXmi(ECORE_WITHOUT_OCL);
    const constraints = extractOCLConstraintsFromPackage(pkg);

    expect(constraints).toHaveLength(0);
  });

  it('extracts multiple constraints from same class', () => {
    const pkg = parseEcoreXmi(ECORE_MULTIPLE_CONSTRAINTS_SAME_CLASS);
    const constraints = extractOCLConstraintsFromPackage(pkg);

    expect(constraints).toHaveLength(3);

    const names = constraints.map((c) => c.name).sort();
    expect(names).toEqual(['HasItems', 'TotalPositive', 'ValidStatus']);

    // All should have context 'Order'
    for (const c of constraints) {
      expect(c.context).toBe('Order');
    }

    // Verify XML entity unescaping in complex expressions
    const hasItems = constraints.find((c) => c.name === 'HasItems');
    expect(hasItems!.expression).toBe('self.items->notEmpty()');

    const validStatus = constraints.find((c) => c.name === 'ValidStatus');
    expect(validStatus!.expression).toContain("'pending'");
    expect(validStatus!.expression).toContain('->includes');
  });

  it('preserves constraint-to-class mapping across multiple classes', () => {
    const pkg = parseEcoreXmi(ECORE_WITH_OCL_PIVOT);
    const constraints = extractOCLConstraintsFromPackage(pkg);

    const employeeConstraints = constraints.filter((c) => c.context === 'Employee');
    const deptConstraints = constraints.filter((c) => c.context === 'Department');

    expect(employeeConstraints).toHaveLength(2);
    expect(deptConstraints).toHaveLength(1);
  });
});
