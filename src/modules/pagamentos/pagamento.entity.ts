import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn,
} from 'typeorm';
import { Fatura } from '../faturas/fatura.entity';

@Entity('pagamentos')
export class Pagamento {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Fatura, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fatura_id' })
  fatura: Fatura;

  @Column('decimal', { precision: 10, scale: 2 })
  valor_pago: number;

  @Column({ length: 50, default: 'pix' })
  forma_pagamento: string;

  @Column({ length: 100, nullable: true })
  asaas_payment_id: string;

  @Column({ type: 'date', nullable: true })
  data_pagamento: Date;

  @CreateDateColumn()
  created_at: Date;
}