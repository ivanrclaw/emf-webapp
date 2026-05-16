/**
 * @emf-webapp/backend — ModelVersionService
 *
 * CRUD de versiones + diff + revert para historial de metamodelos/modelos.
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModelVersion, VersionEntityType } from './modelversion.entity.js';

export interface VersionSummary {
  id: string;
  versionNumber: number;
  description: string;
  createdAt: Date;
  snapshotSize: number;
}

export interface VersionDiff {
  versionA: { id: string; versionNumber: number; createdAt: Date };
  versionB: { id: string; versionNumber: number; createdAt: Date };
  /** Array de cambios: paths añadidos, eliminados o modificados */
  changes: { path: string; type: 'added' | 'removed' | 'modified'; oldValue?: any; newValue?: any }[];
  /** Número de añadidos */
  added: number;
  /** Número de eliminados */
  removed: number;
  /** Número de modificados */
  modified: number;
}

@Injectable()
export class ModelVersionService {
  constructor(
    @InjectRepository(ModelVersion)
    private readonly repo: Repository<ModelVersion>,
  ) {}

  /**
   * Lista versiones de una entidad, ordenadas descendente.
   */
  async list(entityType: VersionEntityType, entityId: string): Promise<VersionSummary[]> {
    const versions = await this.repo.find({
      where: { entity_type: entityType, entity_id: entityId },
      order: { version_number: 'DESC' },
    });
    return versions.map((v) => ({
      id: v.id,
      versionNumber: v.version_number,
      description: v.description,
      createdAt: v.createdAt,
      snapshotSize: JSON.stringify(v.snapshot).length,
    }));
  }

  /**
   * Obtiene una versión específica por ID.
   */
  async getById(id: string): Promise<ModelVersion> {
    const version = await this.repo.findOne({ where: { id } });
    if (!version) throw new NotFoundException(`Version ${id} not found`);
    return version;
  }

  /**
   * Crea un snapshot a partir del contenido actual de la entidad.
   * Calcula automáticamente el version_number basado en el último snapshot.
   */
  async createSnapshot(
    entityType: VersionEntityType,
    entityId: string,
    snapshot: Record<string, any>,
    description?: string,
  ): Promise<ModelVersion> {
    const lastVersion = await this.repo.findOne({
      where: { entity_type: entityType, entity_id: entityId },
      order: { version_number: 'DESC' },
    });
    const nextNumber = lastVersion ? lastVersion.version_number + 1 : 1;
    const version = this.repo.create({
      entity_type: entityType,
      entity_id: entityId,
      version_number: nextNumber,
      snapshot,
      description: description || `v${nextNumber}`,
    });
    return this.repo.save(version);
  }

  /**
   * Revierte una entidad a una versión anterior.
   * Devuelve el snapshot al que revertir.
   */
  async revertTo(id: string): Promise<Record<string, any>> {
    const version = await this.getById(id);
    return version.snapshot;
  }

  /**
   * Compara dos versiones y devuelve un diff detallado.
   * Si onlyVersionId se proporciona, compara esa versión con la inmediatamente anterior.
   */
  async diff(
    entityType: VersionEntityType,
    entityId: string,
    versionIdA: string,
    versionIdB?: string,
  ): Promise<VersionDiff> {
    const vA = await this.getById(versionIdA);
    let vB: ModelVersion;

    if (versionIdB) {
      vB = await this.getById(versionIdB);
    } else {
      // Comparar con la inmediatamente anterior
      const prev = await this.repo.findOne({
        where: {
          entity_type: entityType,
          entity_id: entityId,
          version_number: vA.version_number - 1,
        },
      });
      if (!prev) {
        throw new NotFoundException(`No previous version to diff against v${vA.version_number}`);
      }
      vB = prev;
    }

    // Simple shallow diff del primer nivel
    const changes: VersionDiff['changes'] = [];
    const keysA = Object.keys(vA.snapshot);
    const keysB = Object.keys(vB.snapshot);
    const allKeys = [...new Set([...keysA, ...keysB])];

    for (const key of allKeys) {
      const inA = keysA.includes(key);
      const inB = keysB.includes(key);
      if (inA && !inB) {
        changes.push({ path: key, type: 'added', newValue: vA.snapshot[key] });
      } else if (!inA && inB) {
        changes.push({ path: key, type: 'removed', oldValue: vB.snapshot[key] });
      } else if (JSON.stringify(vA.snapshot[key]) !== JSON.stringify(vB.snapshot[key])) {
        changes.push({ path: key, type: 'modified', oldValue: vB.snapshot[key], newValue: vA.snapshot[key] });
      }
    }

    return {
      versionA: { id: vA.id, versionNumber: vA.version_number, createdAt: vA.createdAt },
      versionB: { id: vB.id, versionNumber: vB.version_number, createdAt: vB.createdAt },
      changes,
      added: changes.filter((c) => c.type === 'added').length,
      removed: changes.filter((c) => c.type === 'removed').length,
      modified: changes.filter((c) => c.type === 'modified').length,
    };
  }
}
