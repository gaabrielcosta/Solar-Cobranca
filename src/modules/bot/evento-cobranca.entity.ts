import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, Index,
} from 'typeorm';

@Entity('eventos_cobranca')
export class EventoCobranca {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  fatura_id: string;

  @Column({ type: 'varchar' })
  tipo: string; // TipoEvento

  @Column({ type: 'jsonb', default: {} })
  dados: Record<string, any>;

  @CreateDateColumn()
  created_at: Date;
}
