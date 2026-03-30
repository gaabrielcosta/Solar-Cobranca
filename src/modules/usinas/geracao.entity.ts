import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, CreateDateColumn
} from 'typeorm';
import { Usina } from './usina.entity';

@Entity('geracoes')
export class Geracao {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Usina)
  usina: Usina;

  @Column({ type: 'date' })
  competencia: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  energia_gerada_kwh: number;

  @Column({ type: 'decimal', precision: 10, scale: 4 })
  tarifa_kwh: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  saldo_anterior: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  saldo_disponivel: number;

  @Column({ default: 'manual' })
  fonte: string; // 'manual' | 'pdf'

  @CreateDateColumn()
  created_at: Date;
}