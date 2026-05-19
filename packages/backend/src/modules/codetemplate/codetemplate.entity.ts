/**
 * @emf-webapp/backend — CodeTemplate Entity
 *
 * Almacena plantillas MTL (Acceleo-like) asociadas a un metamodelo
 * para generación de código/documentación.
 *
 * Soporta tanto plantillas personalizadas (almacenadas en DB) como
 * generadores predefinidos (HTML, SQL, TypeScript, JSON Schema, PlantUML).
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
import { Metamodel } from '../metamodel/metamodel.entity.js';
import { TemplateProject } from './template-project.entity.js';

export type TemplateLanguage = 'html' | 'sql' | 'typescript' | 'json-schema' | 'plantuml';

@Entity('code_templates')
export class CodeTemplate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'metamodel_id', type: 'uuid' })
  metamodel_id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'text' })
  template!: string;

  @Column({
    type: 'text',
    default: 'html',
  })
  language!: TemplateLanguage;

  @Column({ name: 'is_predefined', type: 'boolean', default: false })
  is_predefined!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;

  @ManyToOne(() => Metamodel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'metamodel_id' })
  metamodel!: Metamodel;

  @Column({ name: 'project_id', type: 'text', nullable: true })
  project_id!: string | null;

  @Column({ type: 'varchar', length: 255, default: 'main.mtl' })
  filename!: string;

  @Column({ name: 'file_order', type: 'integer', default: 0 })
  file_order!: number;

  @ManyToOne(() => TemplateProject, (p) => p.files, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'project_id' })
  templateProject!: TemplateProject | null;
}
