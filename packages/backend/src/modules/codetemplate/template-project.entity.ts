/**
 * @emf-webapp/backend — TemplateProject Entity
 *
 * Represents a multi-file template project associated with a metamodel.
 * Groups multiple CodeTemplate files for coordinated code generation.
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Metamodel } from '../metamodel/metamodel.entity.js';
import { CodeTemplate } from './codetemplate.entity.js';

@Entity('template_projects')
export class TemplateProject {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'metamodel_id', type: 'text' })
  metamodel_id!: string;

  @ManyToOne(() => Metamodel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'metamodel_id' })
  metamodel!: Metamodel;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @OneToMany(() => CodeTemplate, (t) => t.templateProject)
  files!: CodeTemplate[];

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;
}
