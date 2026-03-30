import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { Beneficiario } from './beneficiario.entity';

@Entity('creditos_uc')
export class CreditoUC {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Beneficiario, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'beneficiario_id' })
  beneficiario: Beneficiario;

  @Column({ name: 'beneficiario_id', nullable: true })
  beneficiario_id: string;

  // Competência de referência (YYYY-MM-01)
  @Column({ type: 'date' })
  competencia: Date;

  // Saldo que veio do mês anterior
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  saldo_anterior: number;

  // kWh compensado (entrada) — vem do rateio do demonstrativo
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  kwh_compensado: number;

  // kWh consumido (saída) — vem da fatura Energisa (editável)
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  kwh_consumido: number;

  // Saldo final = saldo_anterior + kwh_compensado - kwh_consumido
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  saldo_atual: number;

  // Observação manual (opcional)
  @Column({ nullable: true })
  observacao: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
