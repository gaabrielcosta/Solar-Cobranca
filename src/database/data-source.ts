import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { Cliente } from '../modules/clientes/cliente.entity';
import { Usina } from '../modules/usinas/usina.entity';
import { Beneficiario } from '../modules/usinas/beneficiario.entity';
import { Geracao } from '../modules/usinas/geracao.entity';
import { Rateio } from '../modules/usinas/rateio.entity';
import { CreditoUC } from '../modules/usinas/credito-uc.entity';
import { Fatura } from '../modules/faturas/fatura.entity';
import { Log } from '../modules/logs/log.entity';
import { EventoCobranca } from '../modules/bot/evento-cobranca.entity';
import { BotConfig } from '../modules/bot/bot-config.entity';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS,
  database: process.env.DB_NAME || 'solar_cobranca',
  synchronize: true,
  logging: false,
  entities: [Cliente, Usina, Beneficiario, Geracao, Rateio, CreditoUC, Fatura, Log, EventoCobranca, BotConfig],
});