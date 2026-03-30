import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, CreateDateColumn, UpdateDateColumn
} from 'typeorm';
import { Beneficiario } from '../usinas/beneficiario.entity';
import { Rateio } from '../usinas/rateio.entity';

export enum StatusFatura {
  PENDENTE  = 'pendente',
  ENVIADA   = 'enviada',
  PAGA      = 'paga',
  ATRASADA  = 'atrasada',
  NEGOCIADA = 'negociada',
}

export enum FormaPagamento {
  PIX     = 'pix',
  BOLETO  = 'boleto',
  TED     = 'ted',
  DINHEIRO = 'dinheiro',
  OUTRO   = 'outro',
}

@Entity('faturas')
export class Fatura {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Beneficiario)
  beneficiario: Beneficiario;

  @ManyToOne(() => Rateio)
  rateio: Rateio;

  @Column({ type: 'date' })
  competencia: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  valor: number;

  @Column({ type: 'date' })
  data_vencimento: Date;

  @Column({ type: 'varchar', nullable: true })
  data_leitura: string | null;

  @Column({ type: 'enum', enum: StatusFatura, default: StatusFatura.PENDENTE })
  status: StatusFatura;

  // Pagamento
  @Column({ type: 'date', nullable: true })
  data_pagamento: Date | null;

  @Column({ type: 'enum', enum: FormaPagamento, nullable: true })
  forma_pagamento: FormaPagamento | null;

  @Column({ nullable: true })
  observacao_pagamento: string | null;

  // Cobrança
  @Column({ nullable: true })
  pix_copia_cola: string;

  @Column({ nullable: true })
  link_boleto: string;

  @Column({ nullable: true })
  banco_id: string;

  // Resumo
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  kwh_alocado: number;

  @Column({ type: 'decimal', precision: 10, scale: 4 })
  tarifa_kwh: number;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true, default: 0 })
  tarifa_b1: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  valor_sem_desconto: number;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  desconto_percentual: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  valor_desconto: number;

  // Informativos da fatura Energisa (não cobrados)
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, default: 0 })
  kwh_consumo_energisa: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, default: 0 })
  kwh_fio_b: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, default: 0 })
  cip_municipal: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, default: 0 })
  outros_energisa: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, default: 0 })
  saldo_credito: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, default: 0 })
  total_fatura_energisa: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}