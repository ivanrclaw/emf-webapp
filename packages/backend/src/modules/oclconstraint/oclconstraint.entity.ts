/**
 * @emf-webapp/backend — OCLConstraint Entity
 *
 * Almacena restricciones OCL asociadas a un metamodelo.
 * Cada constraint tiene un nombre, contexto (EClass), expresión OCL y severidad.
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

@Entity('ocl_constraints')
export class OCLConstraint {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'metamodel_id', type: 'uuid' })
  metamodel_id!: string;

  @Column({ length: 255 })
  name!: string;

  @Column({ length: 255 })
  context!: string;

  @Column({ type: 'text' })
  expression!: string;

  @Column({
    type: 'text',
    default: 'error',
  })
  severity!: 'error' | 'warning' | 'info';

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;

  @ManyToOne(() => Metamodel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'metamodel_id' })
  metamodel!: Metamodel;
}
