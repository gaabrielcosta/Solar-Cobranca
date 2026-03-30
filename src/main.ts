import 'reflect-metadata';
import express, { Request, Response, NextFunction } from 'express';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as crypto from 'crypto';
import { AppDataSource } from './database/data-source';
import { RegraCobrancaService } from './modules/bot/regua-cobranca.service';
import clientesRouter    from './modules/clientes/clientes.controller';
import importacaoRouter  from './modules/clientes/importacao.controller';
import usinasRouter      from './modules/usinas/usinas.controller';
import faturasRouter     from './modules/faturas/faturas.controller';
import logsRouter        from './modules/logs/logs.controller';
import uploadRouter      from './upload.controller';
import geracoesRouter    from './modules/usinas/geracoes.controller';
import reguaRouter       from './modules/bot/regua.controller';
import creditosRouter    from './modules/usinas/credito-uc.controller';
import swaggerUi from 'swagger-ui-express'
import { swaggerSpec } from './swagger'

dotenv.config();
const app   = express();
const regua = new RegraCobrancaService();

app.use(express.json());
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

// ─────────────────────────────────────────────
//  CORS
// ─────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ─────────────────────────────────────────────
//  AUTH
//  Defina no .env:
//    ADMIN_PASSWORD=suasenhaaqui
//    JWT_SECRET=chaveSecretaAleatoria
//    JWT_EXPIRES_IN=8h
// ─────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET || 'solar_secret_mude_isso';
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '8h';

function parseDuration(d: string): number {
  const match = d.match(/^(\d+)([smhd])$/);
  if (!match) return 28800;
  const n = parseInt(match[1]);
  const u = match[2];
  return u === 's' ? n : u === 'm' ? n * 60 : u === 'h' ? n * 3600 : n * 86400;
}

function gerarToken(payload: object, expiresIn: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now    = Math.floor(Date.now() / 1000);
  const exp    = now + parseDuration(expiresIn);
  const body   = Buffer.from(JSON.stringify({ ...payload, iat: now, exp })).toString('base64url');
  const sig    = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function verificarToken(token: string): any {
  const [header, body, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  if (sig !== expected) throw new Error('Token inválido');
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
  if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error('Token expirado');
  return payload;
}

// ─────────────────────────────────────────────
//  ROTA DE LOGIN
// ─────────────────────────────────────────────
/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Autenticação do sistema
 *     tags:
 *       - Auth
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - senha
 *             properties:
 *               senha:
 *                 type: string
 *                 example: minhasenha
 *     responses:
 *       200:
 *         description: Login bem sucedido
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sucesso:
 *                   type: boolean
 *                 token:
 *                   type: string
 *                 expires_in:
 *                   type: string
 *       401:
 *         description: Senha incorreta
 */
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { senha } = req.body;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

  if (!ADMIN_PASSWORD) {
    return res.status(500).json({ sucesso: false, erro: 'ADMIN_PASSWORD não configurada no .env' });
  }

  if (!senha || senha !== ADMIN_PASSWORD) {
    return res.status(401).json({ sucesso: false, erro: 'Senha incorreta' });
  }

  const token = gerarToken({ role: 'admin' }, JWT_EXPIRES);
  res.json({ sucesso: true, token, expires_in: JWT_EXPIRES });
}); 

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Status do servidor
 *     tags:
 *       - Sistema
 *     security: []
 *     responses:
 *       200:
 *         description: Servidor online
 */
app.get('/health', (_, res) => res.json({ status: 'ok', timestamp: new Date() }))

// ─────────────────────────────────────────────
//  MIDDLEWARE DE AUTENTICAÇÃO
// ─────────────────────────────────────────────
function autenticar(req: Request, res: Response, next: NextFunction) {
  const auth  = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';

  if (!token) {
    return res.status(401).json({ sucesso: false, erro: 'Token não fornecido' });
  }

  try {
    verificarToken(token);
    next();
  } catch (e: any) {
    return res.status(401).json({ sucesso: false, erro: e.message });
  }
}

// ─────────────────────────────────────────────
//  ARQUIVOS ESTÁTICOS (públicos — login.html, dashboard.html)
// ─────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../public')));

// ─────────────────────────────────────────────
//  ROTAS PROTEGIDAS
// ─────────────────────────────────────────────
app.use('/api/clientes',      autenticar, clientesRouter);
app.use('/api/clientes',      autenticar, importacaoRouter);
app.use('/api/usinas',        autenticar, usinasRouter);
app.use('/api/faturas',       autenticar, faturasRouter);
app.use('/api/beneficiarios', autenticar, (req, res, next) => {
  req.url = '/beneficiarios' + (req.url === '/' ? '' : req.url);
  usinasRouter(req, res, next);
});
app.use('/api/upload',        autenticar, uploadRouter);
app.use('/api/geracoes',      autenticar, geracoesRouter);
app.use('/api/regua',         reguaRouter); // webhook público
app.use('/api/logs',          autenticar, logsRouter);
app.use('/api/creditos',      autenticar, creditosRouter);

// Health check (público)
app.get('/health', (_, res) => res.json({ status: 'ok', timestamp: new Date() }));

async function inicializar() {
  try {
    await AppDataSource.initialize();
    console.log('✅ Banco de dados conectado');
    regua.iniciarCrons();
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`🚀 Servidor: http://localhost:${PORT}`);
      console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard.html`);
      console.log(`❤️  Health:    http://localhost:${PORT}/health`);
    });
  } catch (err) {
    console.error('❌ Erro ao inicializar:', err);
    process.exit(1);
  }
}

inicializar();