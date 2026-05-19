/**
 * @emf-webapp/backend — OCLConstraintService
 *
 * CRUD de restricciones OCL, scoped bajo metamodelo.
 * Incluye un endpoint `validate` que evalúa todas las constraints
 * de un metamodelo contra un modelo concreto.
 */
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OCLConstraint } from './oclconstraint.entity.js';
import type { OCLEObject } from '@emf-webapp/core';
import { OCLParser, OCLEvaluator, OCLSemanticValidator } from '@emf-webapp/core';
import type { OCLDiagnostic } from '@emf-webapp/core';

@Injectable()
export class OCLConstraintService {
  constructor(
    @InjectRepository(OCLConstraint)
    private readonly repo: Repository<OCLConstraint>,
  ) {}

  async findAll(mmid: string): Promise<OCLConstraint[]> {
    return this.repo.find({
      where: { metamodel_id: mmid },
      order: { name: 'ASC' },
    });
  }

  async findOne(mmid: string, id: string): Promise<OCLConstraint> {
    const constraint = await this.repo.findOne({
      where: { id, metamodel_id: mmid },
    });
    if (!constraint) {
      throw new NotFoundException(
        `OCLConstraint "${id}" not found in metamodel "${mmid}"`,
      );
    }
    return constraint;
  }

  async create(
    mmid: string,
    data: {
      name: string;
      context: string;
      expression: string;
      severity?: 'error' | 'warning' | 'info';
    },
  ): Promise<OCLConstraint> {
    if (!data.expression || data.expression.trim().length === 0) {
      throw new BadRequestException('OCL expression cannot be empty');
    }
    if (!data.name || data.name.trim().length === 0) {
      throw new BadRequestException('Constraint name cannot be empty');
    }
    if (!data.context || data.context.trim().length === 0) {
      throw new BadRequestException('Constraint context cannot be empty');
    }
    const constraint = this.repo.create({
      metamodel_id: mmid,
      name: data.name,
      context: data.context,
      expression: data.expression,
      severity: data.severity || 'error',
    });
    return this.repo.save(constraint);
  }

  async update(
    mmid: string,
    id: string,
    data: {
      name?: string;
      context?: string;
      expression?: string;
      severity?: 'error' | 'warning' | 'info';
    },
  ): Promise<OCLConstraint> {
    const constraint = await this.findOne(mmid, id);
    if (data.name !== undefined) constraint.name = data.name;
    if (data.context !== undefined) constraint.context = data.context;
    if (data.expression !== undefined) constraint.expression = data.expression;
    if (data.severity !== undefined) constraint.severity = data.severity;
    return this.repo.save(constraint);
  }

  async remove(mmid: string, id: string): Promise<void> {
    const constraint = await this.findOne(mmid, id);
    await this.repo.remove(constraint);
  }

  /**
   * Validate all OCL constraints for a metamodel against a model.
   *
   * @param mmid - Metamodel ID
   * @param modelContent - JSON string of the model to validate
   * @returns Array of validation results per constraint
   */
  async validate(
    mmid: string,
    modelContent: string,
  ): Promise<
    Array<{
      constraintId: string;
      name: string;
      context: string;
      expression: string;
      passed: boolean;
      error?: string;
    }>
  > {
    // 1. Parse model JSON
    let modelData: any;
    try {
      modelData = JSON.parse(modelContent);
    } catch {
      throw new Error('Invalid model JSON');
    }

    // 2. Load all constraints for this metamodel
    const constraints = await this.findAll(mmid);

    if (constraints.length === 0) {
      return [];
    }

    // 3. Build eclass map from model metadata (if available in the JSON)
    const eclassMap = new Map<string, import('@emf-webapp/core').OCLEClassInfo>();
    if (modelData.eClassMap || modelData.eclasses) {
      const classes: Array<{ name: string; abstract?: boolean; eStructuralFeatures?: Array<{ name: string; type: string; kind: 'attribute' | 'reference'; many: boolean }> }> =
        modelData.eClassMap || modelData.eclasses || [];
      for (const cls of classes) {
        eclassMap.set(cls.name, {
          name: cls.name,
          abstract: cls.abstract,
          eStructuralFeatures: cls.eStructuralFeatures || [],
        });
      }
    }

    // 4. Parse model objects into OCLEObject[]
    const objects = this.extractObjects(modelData);

    // 5. Evaluate each constraint
    const parser = new OCLParser();
    const results: Array<{
      constraintId: string;
      name: string;
      context: string;
      expression: string;
      passed: boolean;
      error?: string;
    }> = [];

    for (const constraint of constraints) {
      // Find matching objects for the constraint's context (EClass)
      const matchingObjects = objects.filter(
        (obj) => obj.eClass === constraint.context,
      );

      if (matchingObjects.length === 0) {
        // No objects of the constraint's context — constraint is vacuously true or skip
        results.push({
          constraintId: constraint.id,
          name: constraint.name,
          context: constraint.context,
          expression: constraint.expression,
          passed: true,
          error: undefined,
        });
        continue;
      }

      // Parse the OCL expression
      const ast = parser.tryParse(constraint.expression);
      if (!ast) {
        results.push({
          constraintId: constraint.id,
          name: constraint.name,
          context: constraint.context,
          expression: constraint.expression,
          passed: false,
          error: `Failed to parse OCL expression: "${constraint.expression}"`,
        });
        continue;
      }

      // Evaluate for each matching object
      const evaluator = new OCLEvaluator(eclassMap);
      let allPassed = true;
      let firstError: string | undefined;

      for (const obj of matchingObjects) {
        const result = evaluator.evaluate(ast, obj);
        if (!result.success) {
          allPassed = false;
          firstError = (result as { success: false; error: string }).error;
          break;
        }
        // For boolean constraints, the value must be true
        if (typeof result.value === 'boolean' && !result.value) {
          allPassed = false;
          firstError = `Constraint "${constraint.expression}" evaluated to false for object ${obj.eClass}`;
          break;
        }
      }

      results.push({
        constraintId: constraint.id,
        name: constraint.name,
        context: constraint.context,
        expression: constraint.expression,
        passed: allPassed,
        error: allPassed ? undefined : firstError,
      });
    }

    return results;
  }

  /**
   * Diagnose OCL expression(s) — returns semantic diagnostics (errors, warnings)
   * without executing against a model. Used for real-time editor feedback.
   *
   * @param expression - The OCL expression to diagnose
   * @param contextClass - The context EClass name
   * @param metamodelContent - The metamodel JSON content
   * @returns Array of diagnostics with position, severity, and message
   */
  diagnose(
    expression: string,
    contextClass: string,
    metamodelContent: any,
  ): OCLDiagnostic[] {
    const classifiers = metamodelContent?.eClassifiers || [];

    // Build MetamodelInfo for the semantic validator
    const idToName: Record<string, string> = {};
    for (const cls of classifiers) {
      if (cls.id) idToName[cls.id] = cls.name;
      idToName[cls.name] = cls.name;
    }

    const classes = classifiers.map((cls: any) => ({
      name: cls.name,
      abstract: cls.abstract,
      attributes: (cls.eAttributes || []).map((a: any) => ({
        name: a.name,
        type: a.eType || 'EString',
        many: a.upperBound === -1 || (a.upperBound != null && a.upperBound > 1),
      })),
      references: (cls.eReferences || []).map((r: any) => ({
        name: r.name,
        targetClass: idToName[r.targetId || ''] || r.targetId || 'EObject',
        many: r.upperBound === -1 || (r.upperBound != null && r.upperBound > 1),
        containment: !!r.containment,
      })),
      operations: (cls.eOperations || []).map((op: any) => ({
        name: op.name,
        returnType: op.eType || 'EString',
        params: (op.eParameters || []).map((p: any) => ({
          name: p.name,
          type: p.eType || 'EString',
        })),
      })),
    }));

    // Build hierarchy map (eSuperTypes reference from IDs to names)
    const hierarchy = new Map<string, string[]>();
    for (const cls of classifiers) {
      if (cls.eSuperTypes && cls.eSuperTypes.length > 0) {
        const parents = cls.eSuperTypes.map((st: string) => idToName[st] || st);
        hierarchy.set(cls.name, parents);
      }
    }

    const metamodelInfo = { classes, hierarchy };
    const validator = new OCLSemanticValidator(metamodelInfo);
    const result = validator.validate(expression, contextClass);
    return result.diagnostics;
  }

  /**
   * Recursively extract OCLEObject instances from the parsed model data.
   * Expects either an array of objects or a top-level object with `elements` or `objects` key.
   */
  private extractObjects(data: any): OCLEObject[] {
    const objects: OCLEObject[] = [];

    if (Array.isArray(data)) {
      for (const item of data) {
        objects.push(...this.extractObjects(item));
      }
      return objects;
    }

    // Top-level keys that might contain model elements
    if (data.elements && Array.isArray(data.elements)) {
      for (const el of data.elements) {
        objects.push(...this.extractObjects(el));
      }
      return objects;
    }

    if (data.objects && Array.isArray(data.objects)) {
      for (const obj of data.objects) {
        objects.push(...this.extractObjects(obj));
      }
      return objects;
    }

    // If this object has eClass, treat it as an OCLEObject
    if (data.eClass) {
      objects.push({
        eClass: data.eClass,
        attributes: data.attributes || {},
        references: data.references || {},
      });
    }

    // Recurse into any nested object values that might contain eClass objects
    for (const key of Object.keys(data)) {
      if (key === 'attributes' || key === 'references' || key === 'eClass') continue;
      if (typeof data[key] === 'object' && data[key] !== null) {
        objects.push(...this.extractObjects(data[key]));
      }
    }

    return objects;
  }
}
