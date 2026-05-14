/**
 * @emf-webapp/backend — Metamodel Entity
 *
 * Entidad TypeORM que representa un metamodelo (EPackage) asociado a un proyecto.
 * La columna `content` almacena el JSON serializado del EPackage.
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Project } from '../project/project.entity.js';

@Entity('metamodels')
export class Metamodel {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'project_id' })
  project_id!: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project?: Project;

  @Column()
  name!: string;

  @Column({ name: 'ns_uri' })
  ns_uri!: string;

  @Column({ name: 'ns_prefix' })
  ns_prefix!: string;

  @Column({ type: 'simple-json' })
  content!: Record<string, any>;
}
