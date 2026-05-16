/**
 * @emf-webapp/backend — GraphicalSpec Entity
 *
 * Almacena especificaciones de sintaxis gráfica (Sirius-like) para un metamodelo.
 * El spec JSON define mappings de EClasses a estilos visuales, capas, etc.
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

@Entity('graphical_specs')
export class GraphicalSpec {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'metamodel_id', type: 'uuid' })
  metamodel_id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text', default: '{}' })
  spec!: string;

  @ManyToOne(() => Metamodel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'metamodel_id' })
  metamodel!: Metamodel;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;
}
