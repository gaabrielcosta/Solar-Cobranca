import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn,
} from 'typeorm';
import { Geracao } from './geracao.entity';
import { Beneficiario } from './beneficiario.entity';

@Entity('rateios')
export class Rateio {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Geracao, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'geracao_id' })
  geracao: Geracao;

  @ManyToOne(() => Beneficiario, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'beneficiario_id' })
  beneficiario: Beneficiario;

  @Column({ type: 'date' })
  competencia: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  kwh_alocado: number;

  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0 })
  tarifa_kwh: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  valor_credito: number;

  @CreateDateColumn()
  created_at: Date;
}