/**
 * @emf-webapp/backend — ModelVersion Entity
 *
 * Almacena snapshots del contenido de metamodelos o modelos M1
 * para el historial de versiones. Cada snapshot captura el JSON
 * completo del `content` en el momento de guardar.
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type VersionEntityType = 'metamodel' | 'm1model';

@Entity('model_versions')
@Index(['entity_type', 'entity_id'])
@Index(['entity_type', 'entity_id', 'createdAt'])
export class ModelVersion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  entity_type!: VersionEntityType;

  @Column({ type: 'text' })
  entity_id!: string;

  @Column({ type: 'int', default: 1 })
  version_number!: number;

  @Column({ type: 'simple-json' })
  snapshot!: Record<string, any>;

  @Column({ type: 'text', nullable: true, default: '' })
  description!: string;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;
}
