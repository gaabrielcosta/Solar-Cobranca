import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn
} from 'typeorm';
import { Usina } from './usina.entity';
import { Cliente } from '../clientes/cliente.entity';

@Entity('beneficiarios')
export class Beneficiario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Usina, (u) => u.beneficiarios, { eager: false })
  @JoinColumn({ name: 'usina_id' })
  usina: Usina;

  @Column({ name: 'usina_id', nullable: true })
  usina_id: string;

  @ManyToOne(() => Cliente, { eager: false })
  @JoinColumn({ name: 'cliente_id' })
  cliente: Cliente;

  @Column({ name: 'cliente_id', nullable: true })
  cliente_id: string;

  @Column()
  uc_beneficiaria: string;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  percentual_rateio: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  desconto_percentual: number;

  @Column({ type: 'int', default: 10 })
  dia_vencimento: number;

  @Column({ type: 'date' })
  vigencia_inicio: Date;

  @Column({ type: 'date', nullable: true })
  vigencia_fim: Date;

  @Column({ default: true })
  ativo: boolean;

  @CreateDateColumn()
  created_at: Date;
}