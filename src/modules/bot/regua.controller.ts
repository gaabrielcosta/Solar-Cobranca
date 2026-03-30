import { Router, Request, Response } from 'express';
import { RegraCobrancaService } from './regua-cobranca.service';
import { AppDataSource } from '../../database/data-source';
import { BotConfig } from './bot-config.entity';

const router = Router();
const regua  = new RegraCobrancaService();

const MENSAGENS_PADRAO: Record<string, { descricao: string; valor: string }> = {
  msg_aviso_d5: {
    descricao: 'Aviso D-5 (5 dias antes do vencimento)',
    valor:
      `Olá, *{nome}*! 👋 Mensagem automática da ACELIVRE.\n\n` +
      `Sua fatura de *{mes_ano}* está disponível:\n` +
      `📍 {uc_label}\n` +
      `☀️ {kwh} kWh de energia solar compensados\n` +
      `💸 Desconto de {desc}% — economia de R$ {eco}\n` +
      `💰 Valor: R$ {val}\n` +
      `📅 Vence em {vencimento}\n\n` +
      `Quando efetuar o pagamento, responda *PAGUEI*. 😊`,
  },
  msg_aviso_d0: {
    descricao: 'Aviso D0 (dia do vencimento)',
    valor:
      `Olá, *{nome}*! Lembrete: sua fatura vence *hoje*.\n` +
      `📍 {uc_label}\n` +
      `💰 Valor: R$ {val}\n\n` +
      `Já pagou? Responde *PAGUEI* que registramos aqui!`,
  },
  msg_aviso_d1: {
    descricao: 'Aviso D+1 (1 dia após vencimento)',
    valor:
      `Oi, *{nome}*! Sua fatura de *{mes_ano}* ainda consta em aberto.\n` +
      `📍 {uc_label}\n` +
      `☀️ {kwh} kWh compensados\n\n` +
      `Quando efetuar o pagamento, responde *PAGUEI*.\n` +
      `Dúvidas? Entre em contato pelo {tel}.`,
  },
  msg_aviso_d3: {
    descricao: 'Aviso D+3',
    valor:
      `*{nome}*, sua fatura de *{mes_ano}* ainda está em aberto.\n` +
      `📍 {uc_label}\n` +
      `☀️ {kwh} kWh compensados\n\n` +
      `Quando realizar o pagamento, responde *PAGUEI*.\n` +
      `Dúvidas? {tel}`,
  },
  msg_aviso_d7: {
    descricao: 'Aviso D+7',
    valor:
      `*{nome}*, sua fatura de *{mes_ano}* segue em aberto.\n` +
      `📍 {uc_label}\n` +
      `☀️ {kwh} kWh compensados\n\n` +
      `Efetuou o pagamento? Responde *PAGUEI*.\n` +
      `Precisa de ajuda? {tel}`,
  },
  msg_aviso_d15: {
    descricao: 'Aviso D+15',
    valor:
      `*{nome}*, sua fatura de *{mes_ano}* ainda não foi quitada.\n` +
      `📍 {uc_label}\n` +
      `☀️ {kwh} kWh compensados\n\n` +
      `Responde *PAGUEI* se já quitou, ou entre em contato pelo {tel}.`,
  },
};

// GET /api/regua/status
router.get('/status', async (req: Request, res: Response) => {
  const url = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instance = process.env.EVOLUTION_INSTANCE;

  if (!url || !apiKey || !instance) {
    return res.json({ sucesso: true, configurado: false, status: 'nao_configurado', mensagem: 'Evolution API não configurada no .env' });
  }

  try {
    const resp = await fetch(`${url}/instance/fetchInstances`, { headers: { 'apikey': apiKey } });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const inst = Array.isArray(data) ? data.find((i: any) => i.instance?.instanceName === instance || i.name === instance) : data;
    const conectado = inst?.instance?.state === 'open' || inst?.state === 'open';
    res.json({ sucesso: true, configurado: true, status: conectado ? 'conectado' : 'desconectado', instancia: instance, mensagem: conectado ? 'WhatsApp conectado' : 'WhatsApp desconectado — escaneie o QR Code' });
  } catch (e: any) {
    res.json({ sucesso: true, configurado: true, status: 'erro', mensagem: `Erro ao conectar: ${e.message}` });
  }
});

// GET /api/regua/config
router.get('/config', async (req: Request, res: Response) => {
  try {
    const repo = AppDataSource.getRepository(BotConfig);
    const salvas = await repo.find();
    const salvasMap: Record<string, string> = {};
    salvas.forEach(c => { salvasMap[c.chave] = c.valor; });
    const config = Object.entries(MENSAGENS_PADRAO).map(([chave, { descricao, valor }]) => ({
      chave, descricao, valor: salvasMap[chave] ?? valor, personalizado: !!salvasMap[chave],
    }));
    res.json({ sucesso: true, data: config });
  } catch (err: any) {
    res.status(500).json({ sucesso: false, erro: err.message });
  }
});

// PATCH /api/regua/config/:chave
router.patch('/config/:chave', async (req: Request, res: Response) => {
  try {
    const { valor } = req.body;
    const chave = String(req.params.chave);
    if (!valor) return res.status(400).json({ sucesso: false, erro: 'Informe o valor' });
    if (!MENSAGENS_PADRAO[chave]) return res.status(404).json({ sucesso: false, erro: 'Chave inválida' });
    const repo = AppDataSource.getRepository(BotConfig);
    let config = await repo.findOneBy({ chave });
    if (!config) config = repo.create({ chave, descricao: MENSAGENS_PADRAO[chave].descricao, valor });
    else config.valor = valor;
    await repo.save(config);
    res.json({ sucesso: true, mensagem: 'Mensagem salva com sucesso' });
  } catch (err: any) {
    res.status(500).json({ sucesso: false, erro: err.message });
  }
});

// DELETE /api/regua/config/:chave — restaura padrão
router.delete('/config/:chave', async (req: Request, res: Response) => {
  try {
    await AppDataSource.getRepository(BotConfig).delete({ chave: String(req.params.chave) });
    res.json({ sucesso: true, mensagem: 'Mensagem restaurada ao padrão' });
  } catch (err: any) {
    res.status(500).json({ sucesso: false, erro: err.message });
  }
});

// GET /api/regua/historico
router.get('/historico', async (req: Request, res: Response) => {
  try {
    const { EventoCobranca } = await import('./evento-cobranca.entity');
    const eventos = await AppDataSource.getRepository(EventoCobranca).find({
      order: { created_at: 'DESC' }, take: 50,
    });
    res.json({ sucesso: true, data: eventos });
  } catch (err: any) {
    res.status(500).json({ sucesso: false, erro: err.message });
  }
});

// POST /api/regua/testar
router.post('/testar', async (req: Request, res: Response) => {
  try {
    console.log('[REGUA] Execução manual iniciada...');
    await regua.processarReguaDiaria();
    res.json({ sucesso: true, mensagem: 'Régua processada — verifique o console.' });
  } catch (err: any) {
    res.status(500).json({ sucesso: false, erro: err.message });
  }
});

// GET /api/regua/eventos/:faturaId
router.get('/eventos/:faturaId', async (req: Request, res: Response) => {
  try {
    const { EventoCobranca } = await import('./evento-cobranca.entity');
    const eventos = await AppDataSource.getRepository(EventoCobranca).find({
      where: { fatura_id: String(req.params.faturaId) }, order: { created_at: 'DESC' },
    });
    res.json({ sucesso: true, data: eventos });
  } catch (err: any) {
    res.status(500).json({ sucesso: false, erro: err.message });
  }
});

// POST /api/regua/simular
router.post('/simular', async (req: Request, res: Response) => {
  try {
    const { telefone, mensagem } = req.body;
    if (!telefone || !mensagem) return res.status(400).json({ sucesso: false, erro: 'Informe telefone e mensagem' });
    const mensagensCapturadas: Array<{ tipo: string; conteudo: any }> = [];
    const s = regua as any;
    const enviarOrig = s.enviarWhatsApp.bind(s);
    const botoesOrig = s.enviarBotoes.bind(s);
    s.enviarWhatsApp = async (_: string, texto: string) => { mensagensCapturadas.push({ tipo: 'texto', conteudo: texto }); return true; };
    s.enviarBotoes = async (_: string, titulo: string, corpo: string, rodape: string, botoes: any[]) => { mensagensCapturadas.push({ tipo: 'botoes', conteudo: { titulo, corpo, rodape, botoes } }); return true; };
    await regua.processarResposta(telefone, mensagem);
    s.enviarWhatsApp = enviarOrig;
    s.enviarBotoes = botoesOrig;
    res.json({ sucesso: true, telefone, mensagem_recebida: mensagem, respostas: mensagensCapturadas, total: mensagensCapturadas.length });
  } catch (err: any) {
    res.status(500).json({ sucesso: false, erro: err.message });
  }
});

// POST /api/regua/webhook
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const body = req.body;
    if (body?.event !== 'messages.upsert') return res.status(200).json({ ok: true });
    const msg = body?.data?.message;
    if (!msg || body?.data?.key?.fromMe) return res.status(200).json({ ok: true });
    const telefone = body?.data?.key?.remoteJid?.replace('@s.whatsapp.net', '') || '';
    const texto = msg?.conversation || msg?.extendedTextMessage?.text || '';
    if (!telefone || !texto) return res.status(200).json({ ok: true });
    console.log(`[WEBHOOK] Mensagem recebida de ${telefone}: "${texto}"`);
    await regua.processarResposta(telefone, texto);
    res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('[WEBHOOK] Erro:', err.message);
    res.status(200).json({ ok: true });
  }
});

export default router;