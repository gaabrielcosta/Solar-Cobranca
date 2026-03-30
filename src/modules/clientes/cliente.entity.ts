import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn
} from 'typeorm';

@Entity('clientes')
export class Cliente {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nome: string;

  @Column()
  cpf_cnpj: string; // salvo sempre sem máscara: 00000000000

  @Column({ nullable: true })
  email: string;

  @Column()
  telefone: string;

  // ── Endereço completo ─────────────────────────────────────
  @Column({ nullable: true, length: 20 })
  cep: string;

  @Column({ nullable: true })
  logradouro: string; // Rua, Av, etc.

  @Column({ nullable: true })
  numero: string;

  @Column({ nullable: true })
  complemento: string;

  @Column({ nullable: true })
  bairro: string;

  @Column({ nullable: true })
  cidade: string;

  @Column({ nullable: true, length: 50 })
  estado_endereco: string;

  // ── Legado (mantido para compatibilidade) ─────────────────
  @Column({ nullable: true })
  endereco: string;

  // ── Dados solares (opcionais no cadastro do cliente) ──────
  @Column({ nullable: true })
  uc_beneficiaria: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  desconto_percentual: number;

  @Column({ type: 'int', default: 10 })
  dia_vencimento: number;

  @Column({ default: true })
  ativo: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}