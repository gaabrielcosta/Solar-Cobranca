import {
  Entity, PrimaryGeneratedColumn, Column,
  OneToMany, CreateDateColumn
} from 'typeorm';
import { Beneficiario } from './beneficiario.entity';
import { Geracao } from './geracao.entity';

@Entity('usinas')
export class Usina {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nome: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  potencia_kwp: number;

  @Column()
  distribuidora: string;

  @Column()
  uc_geradora: string;

  @Column({ nullable: true })
  cidade: string;

  @Column({ nullable: true, length: 2 })
  estado: string;

  @Column({ default: true })
  ativa: boolean;

  @Column({ default: 'propria' })
  tipo: string; // 'propria' | 'gerenciada'

  @Column({ nullable: true, default: 'NONE' })
  provider_marca: string; // 'SAJ' | 'GROWATT' | 'HUAWEI' | 'NONE'

  @Column({ nullable: true })
  provider_station_id: string; // ID da usina na plataforma do provider

  @OneToMany(() => Beneficiario, (b) => b.usina)
  beneficiarios: Beneficiario[];

  @OneToMany(() => Geracao, (g) => g.usina)
  geracoes: Geracao[];

  @CreateDateColumn()
  created_at: Date;
}