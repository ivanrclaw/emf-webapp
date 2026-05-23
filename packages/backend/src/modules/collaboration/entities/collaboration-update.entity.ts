/**
 * @emf-webapp/backend — CollaborationUpdate Entity
 *
 * Stores incremental Y.Doc updates between compactions.
 * These are applied on top of the snapshot when loading a room.
 */
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('collaboration_updates')
export class CollaborationUpdate {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  roomId!: string;

  @Column({ type: 'blob' })
  data!: Buffer;

  @CreateDateColumn()
  createdAt!: Date;
}
