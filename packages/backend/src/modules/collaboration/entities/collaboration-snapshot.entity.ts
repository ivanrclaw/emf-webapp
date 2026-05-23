/**
 * @emf-webapp/backend — CollaborationSnapshot Entity
 *
 * Stores the compacted Y.Doc state for a room.
 * One snapshot per room, updated on compaction.
 */
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('collaboration_snapshots')
export class CollaborationSnapshot {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  roomId!: string;

  @Column({ type: 'blob' })
  state!: Buffer;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
