/**
 * @emf-webapp/backend — M1Model (Model Instance) Entity
 *
 * Representa una instancia de modelo M1, basada en un metamodelo .ecore.
 * El content guarda la lista de objetos EObject del modelo.
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Project } from '../project/project.entity.js';
import { Metamodel } from '../../modules/metamodel/metamodel.entity.js';

@Entity('m1_models')
export class M1Model {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'project_id', type: 'uuid' })
  project_id!: string;

  @Column({ name: 'metamodel_id', type: 'uuid' })
  metamodel_id!: string;

  @Column({ length: 255 })
  name!: string;

  @Column({
    type: 'text',
    default: '[]',
    transformer: {
      to: (value: any): string => {
        if (value === null || value === undefined) return '[]';
        if (typeof value === 'string') return value;
        return JSON.stringify(value);
      },
      from: (value: string): any => {
        if (!value) return [];
        try {
          return JSON.parse(value);
        } catch {
          return [];
        }
      },
    },
  })
  content!: any;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project!: Project;

  @ManyToOne(() => Metamodel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'metamodel_id' })
  metamodel!: Metamodel;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;
}
