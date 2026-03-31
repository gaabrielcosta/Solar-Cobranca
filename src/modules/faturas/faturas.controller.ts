import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AppDataSource } from '../../database/data-source';
import { Fatura, StatusFatura, FormaPagamento } from './fatura.entity';
import { Beneficiario } from '../usinas/beneficiario.entity';
import { LeitorPDFService } from './leitor-pdf.service';
import { FaturaHtmlService } from './fatura-html.service';
import { gerarFaturaPDF } from './fatura-pdf.service';
import { boletoPixService } from './boleto-pix.service';
import { gerarRelatorioPDF } from './relatorio-pdf.service';
import { logService } from '../logs/log.service';

const faturaHtmlService = new FaturaHtmlService();
const router = Router();
const leitor = new LeitorPDFService();

// GET /api/faturas
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const query = AppDataSource.getRepository(Fatura)
      .createQueryBuilder('f')
      .leftJoinAndSelect('f.beneficiario', 'beneficiario')
      .leftJoinAndSelect('beneficiario.cliente', 'cliente')
      .orderBy('f.data_vencimento', 'ASC');
    if (status) query.where('f.status = :status', { status });
    const data = await query.getMany();
    res.json({ sucesso: true, data });
  } catch (err: any) { res.status(500).json({ sucesso: false, erro: err.message }); }
});

// GET /api/faturas/historico
router.get('/historico', async (req: Request, res: Response) => {
  try {
    const { cliente_id, mes, ano, forma_pagamento } = req.query;

    const query = AppDataSource.getRepository(Fatura)
      .createQueryBuilder('f')
      .leftJoinAndSelect('f.beneficiario', 'b')
      .leftJoinAndSelect('b.cliente', 'c')
      .leftJoinAndSelect('b.usina', 'u')
      .where('f.status = :status', { status: StatusFatura.PAGA })
      .orderBy('f.data_pagamento', 'DESC');

    if (cliente_id) query.andWhere('c.id = :cliente_id', { cliente_id });
    if (forma_pagamento) query.andWhere('f.forma_pagamento = :forma_pagamento', { forma_pagamento });
    if (mes && ano) {
      query.andWhere(`TO_CHAR(f.data_pagamento, 'YYYY-MM') = :periodo`, {
        periodo: `${ano}-${String(mes).padStart(2, '0')}`,
      });
    } else if (ano) {
      query.andWhere(`EXTRACT(YEAR FROM f.data_pagamento) = :ano`, { ano: Number(ano) });
    }

    const data = await query.getMany();
    const total = data.reduce((acc, f) => acc + Number(f.valor), 0);
    res.json({ sucesso: true, data, total, quantidade: data.length });
  } catch (err: any) { res.status(500).json({ sucesso: false, erro: err.message }); }
});

// PUT /api/faturas/:id/pagar
router.put('/:id/pagar', async (req: Request, res: Response) => {
  try {
    const repo = AppDataSource.getRepository(Fatura);
    const f = await repo.findOneBy({ id: String(req.params.id) });
    if (!f) return res.status(404).json({ sucesso: false, erro: 'Fatura não encontrada' });

    const { forma_pagamento, data_pagamento, observacao } = req.body;

    f.status = StatusFatura.PAGA;
    f.data_pagamento = data_pagamento ? new Date(data_pagamento) : new Date();
    f.forma_pagamento = forma_pagamento || FormaPagamento.PIX;
    f.observacao_pagamento = observacao || null;

    await repo.save(f);

    const fComCliente = await repo.findOne({
      where: { id: String(req.params.id) },
      relations: ['beneficiario', 'beneficiario.cliente', 'beneficiario.usina'],
    });
    const clienteNome = fComCliente?.beneficiario?.cliente?.nome || '';
    const usinaNome   = fComCliente?.beneficiario?.usina?.nome   || '';
    const usinaId     = fComCliente?.beneficiario?.usina_id      || undefined;

    await logService.registrar({
      acao: 'FATURA_PAGA',
      descricao: `Fatura de "${clienteNome}" marcada como paga (${forma_pagamento?.toUpperCase() || 'PIX'})`,
      entidade: 'fatura', entidade_id: f.id,
      usina_id: usinaId, usina_nome: usinaNome, cliente_nome: clienteNome,
      dados: { forma_pagamento, data_pagamento, valor: f.valor },
    });

    try {
      const telefone = fComCliente?.beneficiario?.cliente?.telefone;
      const nome     = clienteNome.split(' ')[0];
      const val      = Number(f.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
      const uc       = fComCliente?.beneficiario?.uc_beneficiaria || '';
      const end      = [fComCliente?.beneficiario?.cliente?.logradouro, fComCliente?.beneficiario?.cliente?.numero].filter(Boolean).join(', ');
      const ucLabel  = `UC ${uc}${end ? ` · ${end}` : ''}`;

      if (telefone) {
        const { RegraCobrancaService } = await import('../bot/regua-cobranca.service');
        const regua = new RegraCobrancaService();
        await (regua as any).enviarWhatsApp(telefone,
          `✅ Pagamento confirmado, *${nome}*!\n\n` +
          `📍 ${ucLabel}\n` +
          `💰 R$ ${val} — recebido com sucesso.\n\n` +
          `Obrigado por estar com a ACELIVRE! ☀️`
        );
      }
    } catch (e) {
      console.warn('[PAGAR] Falha ao enviar confirmação WhatsApp:', e);
    }

    res.json({ sucesso: true, data: f });
  } catch (err: any) { res.status(400).json({ sucesso: false, erro: err.message }); }
});

// DELETE /api/faturas/:id/estornar
router.delete('/:id/estornar', async (req: Request, res: Response) => {
  try {
    const repo = AppDataSource.getRepository(Fatura);
    const f = await repo.findOneBy({ id: String(req.params.id) });
    if (!f) return res.status(404).json({ sucesso: false, erro: 'Fatura não encontrada' });
    if (f.status !== StatusFatura.PAGA)
      return res.status(400).json({ sucesso: false, erro: 'Apenas faturas pagas podem ser estornadas' });

    f.status = StatusFatura.PENDENTE;
    f.data_pagamento = null;
    f.forma_pagamento = null;
    f.observacao_pagamento = null;

    await repo.save(f);
    res.json({ sucesso: true, data: f });
  } catch (err: any) { res.status(400).json({ sucesso: false, erro: err.message }); }
});

// DELETE /api/faturas/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const repo = AppDataSource.getRepository(Fatura);
    const f = await repo.findOneBy({ id: String(req.params.id) });
    if (!f) return res.status(404).json({ sucesso: false, erro: 'Fatura não encontrada' });
    await repo.delete({ id: String(req.params.id) });
    res.json({ sucesso: true, mensagem: 'Fatura excluída' });
  } catch (err: any) { res.status(400).json({ sucesso: false, erro: err.message }); }
});

// GET /api/faturas/:id/html
router.get('/:id/html', async (req: Request, res: Response) => {
  try {
    const fatura = await AppDataSource.getRepository(Fatura).findOne({
      where: { id: String(req.params.id) },
      relations: ['beneficiario', 'beneficiario.cliente', 'beneficiario.usina'],
    });
    if (!fatura) return res.status(404).json({ sucesso: false, erro: 'Fatura não encontrada' });

    const html = faturaHtmlService.gerarHtml(fatura);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err: any) { res.status(500).json({ sucesso: false, erro: err.message }); }
});

// ── Multipart parser ─────────────────────────────────────────
function parseMultipart(req: Request): Promise<{ fields: Record<string, string>; filePath: string }> {
  return new Promise((resolve, reject) => {
    let body = Buffer.alloc(0);
    req.on('data', (chunk: Buffer) => { body = Buffer.concat([body, chunk]); });
    req.on('end', () => {
      try {
        const ct = req.headers['content-type'] || '';
        const bm = ct.match(/boundary=(.+)$/);
        if (!bm) return reject(new Error('Boundary não encontrado no Content-Type'));
        const boundary = '--' + bm[1].trim();
        const parts = body.toString('binary').split(boundary);
        const fields: Record<string, string> = {};
        let filePath = '';
        for (const part of parts) {
          if (!part.includes('Content-Disposition')) continue;
          const nameMatch = part.match(/name="([^"]+)"/);
          const fileMatch = part.match(/filename="([^"]+)"/);
          const sep = part.indexOf('\r\n\r\n');
          if (sep === -1) continue;
          const content = part.slice(sep + 4, part.endsWith('\r\n') ? -2 : undefined);
          if (fileMatch && nameMatch?.[1] === 'pdf') {
            filePath = path.join(os.tmpdir(), `pdf_${Date.now()}.pdf`);
            fs.writeFileSync(filePath, Buffer.from(content, 'binary'));
          } else if (nameMatch) {
            fields[nameMatch[1]] = content.trim();
          }
        }
        resolve({ fields, filePath });
      } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

// POST /api/faturas/processar-pdf
router.post('/processar-pdf', async (req: Request, res: Response) => {
  let tempFile = '';
  try {
    const { fields, filePath } = await parseMultipart(req);
    tempFile = filePath;
    if (!filePath) return res.status(400).json({ sucesso: false, erro: 'Nenhum arquivo PDF enviado' });

    const dados = await leitor.lerFaturaBuffer(fs.readFileSync(filePath));
    console.log('[PDF] Dados extraídos:', JSON.stringify(dados, null, 2));

    if (!dados.uc) return res.status(400).json({ sucesso: false, erro: 'Não foi possível identificar a UC no PDF' });
    if (!dados.kwh_compensado || dados.kwh_compensado === 0)
      return res.status(400).json({ sucesso: false, erro: 'Não foi possível identificar os kWh compensados no PDF' });

    const benefRepo = AppDataSource.getRepository(Beneficiario);
    const benef = await benefRepo.findOne({
      where: { uc_beneficiaria: dados.uc, ativo: true },
      relations: ['cliente', 'usina'],
    });

    if (!benef) {
      return res.status(404).json({
        sucesso: false,
        erro: `UC ${dados.uc} não encontrada no sistema. Verifique o cadastro do beneficiário.`,
        uc_lida: dados.uc,
      });
    }

    let competencia = new Date();
    if (dados.competencia) {
      const [m, y] = dados.competencia.split('/');
      competencia = new Date(parseInt(y), parseInt(m) - 1, 1);
    }

    const faturaRepo = AppDataSource.getRepository(Fatura);
    const jaExiste = await faturaRepo.findOne({ where: { beneficiario: { id: benef.id }, competencia } });
    if (jaExiste) {
      return res.status(409).json({
        sucesso: false,
        erro: `Fatura já existe para ${benef.cliente.nome} em ${dados.competencia}`,
      });
    }

    const kwh      = dados.kwh_compensado;
    const tarifa   = dados.tarifa_kwh;
    const desconto = Number(benef.cliente?.desconto_percentual ?? benef.desconto_percentual) || 0;

    const valor_sem_desconto = parseFloat((kwh * tarifa).toFixed(2));
    const valor_desconto     = parseFloat((valor_sem_desconto * desconto / 100).toFixed(2));
    const valor_final        = parseFloat((valor_sem_desconto - valor_desconto).toFixed(2));

    const dia_venc   = Number(benef.cliente?.dia_vencimento ?? benef.dia_vencimento) || 10;
    const vencimento = new Date(competencia.getFullYear(), competencia.getMonth() + 1, dia_venc);

    const f = faturaRepo.create({
      beneficiario:          benef,
      competencia,
      valor:                 valor_final,
      data_vencimento:       vencimento,
      status:                StatusFatura.PENDENTE,
      kwh_alocado:           kwh,
      tarifa_kwh:            tarifa,
      valor_sem_desconto,
      desconto_percentual:   desconto,
      valor_desconto,
      kwh_consumo_energisa:  dados.kwh_consumo_energisa,
      cip_municipal:         dados.cip,
      outros_energisa:       dados.outros,
      saldo_credito:         dados.saldo_credito,
      total_fatura_energisa: dados.total_fatura_energisa,
    } as any);

    await faturaRepo.save(f);
    if (tempFile) { try { fs.unlinkSync(tempFile); } catch (_) {} }

    const compStr = competencia.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    await logService.registrar({
      acao: 'PDF_PROCESSADO',
      descricao: `PDF processado: fatura de ${benef.cliente.nome} (UC ${dados.uc}) para ${compStr}`,
      entidade: 'fatura', entidade_id: (f as any).id,
      usina_id: benef.usina?.id, usina_nome: benef.usina?.nome,
      cliente_nome: benef.cliente.nome,
      dados: { uc: dados.uc, kwh, tarifa, desconto, valor_final },
    });

    res.json({
      sucesso:    true,
      mensagem:   `Fatura gerada para ${benef.cliente.nome}`,
      cliente:    benef.cliente.nome,
      uc:         dados.uc,
      usina:      benef.usina?.nome || '—',
      competencia: compStr,
      kwh_compensado: kwh,
      tarifa_kwh:  tarifa,
      desconto_pct: desconto,
      valor_bruto:  valor_sem_desconto,
      economia:     valor_desconto,
      valor_final,
      vencimento:   vencimento.toLocaleDateString('pt-BR'),
      kwh_consumo_energisa: dados.kwh_consumo_energisa,
      cip:                  dados.cip,
      outros:               dados.outros,
      saldo_credito:        dados.saldo_credito,
      total_fatura_energisa: dados.total_fatura_energisa,
    });

  } catch (err: any) {
    if (tempFile) { try { fs.unlinkSync(tempFile); } catch (_) {} }
    console.error('[PROCESSAR-PDF]', err);
    res.status(500).json({ sucesso: false, erro: err.message });
  }
});

// POST /api/faturas/manual
router.post('/manual', async (req: Request, res: Response) => {
  try {
    const { uc, competencia, kwh_compensado, tarifa_kwh,
            kwh_consumo_energisa=0, cip=0, outros=0,
            total_fatura_energisa=0, saldo_credito=0 } = req.body;

    if (!uc || !competencia || !kwh_compensado || !tarifa_kwh)
      return res.status(400).json({ sucesso: false, erro: 'UC, competência, kWh e tarifa são obrigatórios' });

    const benefRepo = AppDataSource.getRepository(Beneficiario);
    const benef = await benefRepo.findOne({
      where: { uc_beneficiaria: String(uc), ativo: true },
      relations: ['cliente', 'usina'],
    });
    if (!benef)
      return res.status(404).json({ sucesso: false, erro: `UC ${uc} não encontrada. Verifique o cadastro.` });

    const [mm, yyyy] = String(competencia).split('/');
    const compDate = new Date(parseInt(yyyy), parseInt(mm) - 1, 1);

    const faturaRepo = AppDataSource.getRepository(Fatura);
    const jaExiste = await faturaRepo.findOne({ where: { beneficiario: { id: benef.id }, competencia: compDate } });
    if (jaExiste)
      return res.status(409).json({ sucesso: false, erro: `Fatura já existe para ${benef.cliente.nome} em ${competencia}` });

    const desconto           = Number(benef.cliente?.desconto_percentual ?? 0);
    const valor_sem_desconto = parseFloat((kwh_compensado * tarifa_kwh).toFixed(2));
    const valor_desconto     = parseFloat((valor_sem_desconto * desconto / 100).toFixed(2));
    const valor_final        = parseFloat((valor_sem_desconto - valor_desconto).toFixed(2));
    const dia_venc           = Number(benef.cliente?.dia_vencimento) || 10;
    const vencimento         = new Date(compDate.getFullYear(), compDate.getMonth() + 1, dia_venc);

    const f = faturaRepo.create({
      beneficiario: benef, competencia: compDate,
      valor: valor_final, data_vencimento: vencimento,
      status: StatusFatura.PENDENTE,
      kwh_alocado: kwh_compensado, tarifa_kwh,
      valor_sem_desconto, desconto_percentual: desconto, valor_desconto,
      kwh_consumo_energisa, cip_municipal: cip, outros_energisa: outros,
      total_fatura_energisa, saldo_credito,
    } as any);
    await faturaRepo.save(f);

    const compStr = compDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    await logService.registrar({
      acao: 'PDF_PROCESSADO', descricao: `Fatura manual: ${benef.cliente.nome} (UC ${uc}) para ${compStr}`,
      entidade: 'fatura', entidade_id: (f as any).id,
      usina_id: benef.usina?.id, usina_nome: benef.usina?.nome, cliente_nome: benef.cliente.nome,
      dados: { uc, kwh_compensado, tarifa_kwh, desconto, valor_final, modo: 'manual' },
    });

    res.json({
      sucesso: true, mensagem: `Fatura gerada para ${benef.cliente.nome}`,
      cliente: benef.cliente.nome, uc, competencia: compStr,
      valor_bruto: valor_sem_desconto, economia: valor_desconto, valor_final,
      vencimento: vencimento.toLocaleDateString('pt-BR'),
    });
  } catch (err: any) {
    res.status(500).json({ sucesso: false, erro: err.message });
  }
});

// PATCH /api/faturas/:id/valor
router.patch('/:id/valor', async (req: Request, res: Response) => {
  try {
    const { valor, kwh_alocado, tarifa_kwh, desconto_percentual } = req.body;
    if (!valor || valor <= 0)
      return res.status(400).json({ sucesso: false, erro: 'Valor inválido' });

    const faturaRepo = AppDataSource.getRepository(Fatura);
    const fatura = await faturaRepo.findOneBy({ id: String(req.params.id) });
    if (!fatura) return res.status(404).json({ sucesso: false, erro: 'Fatura não encontrada' });
    if (fatura.status === StatusFatura.PAGA)
      return res.status(400).json({ sucesso: false, erro: 'Fatura paga não pode ser editada' });

    const novoValor = parseFloat(parseFloat(valor).toFixed(2));
    const kwh    = kwh_alocado   != null ? parseFloat(kwh_alocado)   : Number(fatura.kwh_alocado);
    const tarifa = tarifa_kwh    != null ? parseFloat(tarifa_kwh)    : Number(fatura.tarifa_kwh);
    const desc   = desconto_percentual != null ? parseFloat(desconto_percentual) : Number(fatura.desconto_percentual);

    const valor_sem_desconto = parseFloat((kwh * tarifa).toFixed(2));
    const valor_desconto     = parseFloat((valor_sem_desconto * desc / 100).toFixed(2));

    fatura.valor               = novoValor;
    fatura.kwh_alocado         = kwh;
    fatura.tarifa_kwh          = tarifa;
    fatura.desconto_percentual = desc;
    fatura.valor_sem_desconto  = valor_sem_desconto;
    fatura.valor_desconto      = valor_desconto;

    await faturaRepo.save(fatura);
    res.json({ sucesso: true, valor: novoValor });
  } catch (err: any) {
    res.status(500).json({ sucesso: false, erro: err.message });
  }
});

// PATCH /api/faturas/:id/kwh
router.patch('/:id/kwh', async (req: Request, res: Response) => {
  try {
    const { kwh_alocado } = req.body;
    if (!kwh_alocado || kwh_alocado <= 0)
      return res.status(400).json({ sucesso: false, erro: 'kWh inválido' });

    const faturaRepo = AppDataSource.getRepository(Fatura);
    const fatura = await faturaRepo.findOne({
      where: { id: String(req.params.id) },
      relations: ['beneficiario', 'beneficiario.cliente'],
    });
    if (!fatura) return res.status(404).json({ sucesso: false, erro: 'Fatura não encontrada' });

    const tarifa  = Number(fatura.tarifa_kwh);
    const desconto = Number(fatura.desconto_percentual);
    const valor_sem_desconto = parseFloat((kwh_alocado * tarifa).toFixed(2));
    const valor_desconto     = parseFloat((valor_sem_desconto * desconto / 100).toFixed(2));
    const valor_final        = parseFloat((valor_sem_desconto - valor_desconto).toFixed(2));

    fatura.kwh_alocado        = kwh_alocado;
    fatura.valor_sem_desconto = valor_sem_desconto;
    fatura.valor_desconto     = valor_desconto;
    fatura.valor              = valor_final;

    await faturaRepo.save(fatura);

    try {
      const { creditoUCService } = await import('../usinas/credito-uc.service');
      const comp = (fatura.competencia instanceof Date
        ? fatura.competencia.toISOString()
        : new Date(fatura.competencia).toISOString()).substring(0, 10);
      const compStr = comp.substring(0, 7) + '-01';
      await creditoUCService.recalcularCredito(fatura.beneficiario.id, compStr);
    } catch (e) {
      console.warn('[KWH] Recálculo de crédito falhou:', e);
    }

    res.json({ sucesso: true, kwh_alocado, valor_final, valor_sem_desconto, valor_desconto });
  } catch (err: any) {
    res.status(500).json({ sucesso: false, erro: err.message });
  }
});

router.post('/processar-completo', (req, res, next) => {
  req.url = '/processar-pdf';
  router(req, res, next);
});

// GET /api/faturas/:id/pdf
router.get('/:id/pdf', async (req: Request, res: Response) => {
  try {
    const fatura = await AppDataSource.getRepository(Fatura).findOne({
      where: { id: String(req.params.id) },
      relations: ['beneficiario', 'beneficiario.cliente', 'beneficiario.usina', 'rateio'],
    });

    if (!fatura) return res.status(404).json({ erro: 'Fatura não encontrada' });

    const b  = fatura.beneficiario;
    const cl = b.cliente;

    function fmtData(d: any): string {
      if (!d) return '';
      const s = typeof d === 'string' ? d : d.toISOString();
      const [yyyy, mm, dd] = s.substring(0, 10).split('-');
      return `${dd}/${mm}/${yyyy}`;
    }

    function fmtComp(d: any): string {
      if (!d) return '';
      const s = typeof d === 'string' ? d : d.toISOString();
      const dt = new Date(s + 'T12:00:00');
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      return `${mm}/${dt.getFullYear()}`;
    }

    const dados = {
      numero_fatura:        `FAT-${fatura.id.substring(0, 8).toUpperCase()}`,
      competencia:          fmtComp(fatura.competencia),
      data_emissao:         fmtData(fatura.created_at),
      data_vencimento:      fatura.data_vencimento ? fmtData(fatura.data_vencimento) : fmtData(fatura.competencia),
      cliente_nome:         cl.nome,
      cliente_cpf: cl.cpf_cnpj 
        ? cl.cpf_cnpj.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.***.***-$4')
        : '',
      cliente_endereco:     [cl.logradouro, cl.numero, cl.bairro, cl.cidade, cl.estado_endereco].filter(Boolean).join(', '),
      uc_beneficiaria:      b.uc_beneficiaria,
      kwh_compensado:       Number(fatura.kwh_alocado),
      tarifa_kwh:           Number(fatura.tarifa_kwh),
      tarifa_b1:            Number((fatura as any).tarifa_b1 || 0),
      kwh_consumo_energisa: Number(fatura.kwh_consumo_energisa || 0),
      desconto_pct:         Number(b.desconto_percentual),
      cip_municipal:        Number(fatura.cip_municipal || 0),
      outros_energisa:      Number(fatura.outros_energisa || 0),
      total_energisa:       Number(fatura.total_fatura_energisa || 0),
      saldo_credito:        Number(fatura.saldo_credito || 0),
      pix_copia_cola:       process.env.PIX_CHAVE || '',
    };

    const pdfBuffer = await gerarFaturaPDF(dados);
    const nomeArquivo = `fatura-${b.uc_beneficiaria}-${fmtComp(fatura.competencia).replace('/', '-')}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
    res.send(pdfBuffer);

  } catch (err: any) {
    console.error('[PDF Fatura]', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// POST /api/faturas/:id/boleto-pdf
router.post('/:id/boleto-pdf', async (req: Request, res: Response) => {
  let tempFile = '';
  try {
    const { filePath } = await parseMultipart(req);
    tempFile = filePath;

    if (!filePath)
      return res.status(400).json({ sucesso: false, erro: 'Nenhum arquivo PDF enviado' });

    const faturaRepo = AppDataSource.getRepository(Fatura);
    const fatura = await faturaRepo.findOneBy({ id: String(req.params.id) });
    if (!fatura)
      return res.status(404).json({ sucesso: false, erro: 'Fatura não encontrada' });

    const pix = await boletoPixService.extrairPixDoPDF(filePath);
    if (!pix) {
      return res.status(422).json({
        sucesso: false,
        erro: 'Não foi possível encontrar um QR Code PIX válido no PDF enviado',
      });
    }

    fatura.pix_copia_cola = pix;
    await faturaRepo.save(fatura);

    await logService.registrar({
      acao: 'PIX_EXTRAIDO',
      descricao: `PIX copia e cola extraído do boleto e salvo na fatura`,
      entidade: 'fatura',
      entidade_id: fatura.id,
    });

    res.json({ sucesso: true, mensagem: 'PIX copia e cola extraído e salvo com sucesso', pix_copia_cola: pix });

  } catch (err: any) {
    console.error('[BOLETO-PIX]', err.message);
    res.status(500).json({ sucesso: false, erro: err.message });
  } finally {
    if (tempFile) { try { require('fs').unlinkSync(tempFile); } catch {} }
  }
});

// PATCH /api/faturas/:id/pix
router.patch('/:id/pix', async (req: Request, res: Response) => {
  try {
    const { pix_copia_cola } = req.body;
    if (!pix_copia_cola || !pix_copia_cola.startsWith('000201'))
      return res.status(400).json({ sucesso: false, erro: 'Código PIX inválido' });

    const faturaRepo = AppDataSource.getRepository(Fatura);
    const fatura = await faturaRepo.findOneBy({ id: String(req.params.id) });
    if (!fatura) return res.status(404).json({ sucesso: false, erro: 'Fatura não encontrada' });

    fatura.pix_copia_cola = pix_copia_cola;
    await faturaRepo.save(fatura);

    res.json({ sucesso: true, mensagem: 'PIX salvo com sucesso' });
  } catch (err: any) {
    res.status(500).json({ sucesso: false, erro: err.message });
  }
});

// GET /api/faturas/relatorio/:competencia
router.get('/relatorio/:competencia', async (req: Request, res: Response) => {
  try {
    const competencia = String(req.params.competencia);

    if (!/^\d{4}-\d{2}-01$/.test(competencia))
      return res.status(400).json({ erro: 'Formato inválido. Use YYYY-MM-01' });

    const usinaId   = req.query.usina as string | undefined;
    const pdfBuffer = await gerarRelatorioPDF(competencia, usinaId || undefined);

    const [yyyy, mm] = competencia.split('-');
    const nomeArquivo = `relatorio-acelivre-${mm}-${yyyy}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
    res.send(pdfBuffer);

  } catch (err: any) {
    console.error('[RELATORIO]', err.message);
    res.status(500).json({ erro: err.message });
  }
});

export default router;