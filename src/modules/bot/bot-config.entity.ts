import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('bot_config')
export class BotConfig {
  @PrimaryColumn()
  chave: string; // ex: 'msg_aviso_d5', 'msg_aviso_d0', etc.

  @Column({ type: 'text' })
  valor: string;

  @Column({ nullable: true })
  descricao: string;

  @UpdateDateColumn()
  updated_at: Date;
}
