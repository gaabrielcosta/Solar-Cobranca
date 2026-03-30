import { Router, Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import { LeitorPDFService } from './modules/faturas/leitor-pdf.service';
import { AppDataSource } from './database/data-source';
import { Usina } from './modules/usinas/usina.entity';
import { Geracao } from './modules/usinas/geracao.entity';
import { Beneficiario } from './modules/usinas/beneficiario.entity';
import { Rateio } from './modules/usinas/rateio.entity';
import { Fatura, StatusFatura } from './modules/faturas/fatura.entity';
import { LogService } from './modules/logs/log.service';

const router = Router();
const leitor = new LeitorPDFService();

const upload = multer({
  dest: 'uploads/',
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Apenas arquivos PDF são aceitos'));
  },
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/upload/demonstrativo
//  Lê o PDF do demonstrativo de compensação e retorna preview para confirmação
// ─────────────────────────────────────────────────────────────────────────────
router.post('/demonstrativo', upload.single('pdf'), async (req: Request, res: Response) => {
  const arquivo = req.file;
  if (!arquivo) return res.status(400).json({ sucesso: false, erro: 'Nenhum arquivo enviado' });

  try {
    const dados = await leitor.lerDemonstrativo(arquivo.path);
    fs.unlinkSync(arquivo.path);

    if (!dados.uc_geradora) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Não foi possível identificar a UC geradora no PDF. Verifique se é o demonstrativo correto.',
      });
    }

    const usina = await AppDataSource.getRepository(Usina).findOne({
      where: { uc_geradora: dados.uc_geradora },
    });

    if (!usina) {
      return res.status(404).json({
        sucesso: false,
        erro: `Usina com UC geradora ${dados.uc_geradora} não encontrada no sistema.`,
        dica: 'Cadastre a usina antes de processar o demonstrativo.',
        dados_extraidos: dados,
      });
    }

    res.json({
      sucesso: true,
      mensagem: 'Demonstrativo lido com sucesso!',
      usina_id: usina.id,
      usina_nome: usina.nome,
      dados_extraidos: dados,
    });

  } catch (err: any) {
    if (arquivo && fs.existsSync(arquivo.path)) fs.unlinkSync(arquivo.path);
    res.status(500).json({ sucesso: false, erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/upload/processar-demonstrativo
//  Processa o demonstrativo confirmado: salva Geracao + Rateios
// ─────────────────────────────────────────────────────────────────────────────
router.post('/processar-demonstrativo', async (req: Request, res: Response) => {
  try {
    const { usina_id, dados_extraidos, tarifa_kwh } = req.body;

    if (!usina_id || !dados_extraidos)
      return res.status(400).json({ sucesso: false, erro: 'Informe usina_id e dados_extraidos' });

    const usina = await AppDataSource.getRepository(Usina).findOne({ where: { id: usina_id } });
    if (!usina) return res.status(404).json({ sucesso: false, erro: 'Usina não encontrada' });

    // Converte "MM/YYYY" → "YYYY-MM-01"
    const [mes, ano] = dados_extraidos.competencia.split('/');
    const competencia = `${ano}-${mes}-01` as any;

    // Verifica se já existe geração para esta usina/competência
    const geracaoExistente = await AppDataSource.getRepository(Geracao).findOne({
      where: { usina: { id: usina_id }, competencia: competencia as any },
    });
    if (geracaoExistente) {
      return res.status(409).json({
        sucesso: false,
        ja_processado: true,
        erro: `Demonstrativo de ${dados_extraidos.competencia} já foi processado para esta usina.`,
      });
    }

    // Salva a geração
    const geracao = AppDataSource.getRepository(Geracao).create({
      usina,
      competencia,
      energia_gerada_kwh: dados_extraidos.kwh_injetado,
      tarifa_kwh: parseFloat(tarifa_kwh) || 0,
      saldo_anterior: dados_extraidos.saldo_anterior || 0,
      saldo_disponivel: dados_extraidos.saldo_disponivel || 0,
      fonte: 'pdf',
    });
    await AppDataSource.getRepository(Geracao).save(geracao);

    // Salva os rateios
    const rateiosCriados = [];
    const ucs_nao_encontradas: string[] = [];

    for (const b of dados_extraidos.beneficiarios) {
      const beneficiario = await AppDataSource.getRepository(Beneficiario).findOne({
        where: { uc_beneficiaria: b.uc, ativo: true },
        relations: ['cliente'],
      });

      if (!beneficiario) {
        ucs_nao_encontradas.push(b.uc);
        continue;
      }

      const tarifa   = parseFloat(tarifa_kwh) || 0;
      const bruto    = parseFloat((b.kwh_transferido * tarifa).toFixed(2));
      const descPct  = Number(beneficiario.desconto_percentual) || 0;
      const descValor= parseFloat((bruto * descPct / 100).toFixed(2));
      const liquido  = parseFloat((bruto - descValor).toFixed(2));

      const rateio = AppDataSource.getRepository(Rateio).create({
        geracao,
        beneficiario,
        competencia,
        kwh_alocado: b.kwh_transferido,
        tarifa_kwh: tarifa,
        valor_credito: liquido,
      });
      await AppDataSource.getRepository(Rateio).save(rateio);

      rateiosCriados.push({
        cliente: beneficiario.cliente?.nome || '—',
        uc: b.uc,
        percentual: b.percentual,
        kwh: b.kwh_transferido,
        valor: liquido,
      });
    }

    res.status(201).json({
      sucesso: true,
      mensagem: `${rateiosCriados.length} rateios gerados!`,
      rateios: rateiosCriados,
      ucs_nao_encontradas: ucs_nao_encontradas.length ? ucs_nao_encontradas : undefined,
    });

  } catch (err: any) {
    res.status(500).json({ sucesso: false, erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/upload/fatura          (processa PDF de fatura do cliente)
//  POST /api/upload/faturas-lote    (múltiplos PDFs)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/fatura', upload.single('pdf'), async (req: Request, res: Response) => {
  const arquivo = req.file;
  if (!arquivo) return res.status(400).json({ sucesso: false, erro: 'Nenhum arquivo enviado' });

  try {
    const dados = await leitor.lerFatura(arquivo.path);
    fs.unlinkSync(arquivo.path);

    if (!dados.uc) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Não foi possível identificar a UC no PDF.',
        dados_extraidos: dados,
      });
    }

    const result = await processarFaturaCliente(dados);
    res.status(result.status).json(result.body);

  } catch (err: any) {
    if (arquivo && fs.existsSync(arquivo.path)) fs.unlinkSync(arquivo.path);
    res.status(500).json({ sucesso: false, erro: err.message });
  }
});

router.post('/faturas-lote', upload.array('pdfs', 50), async (req: Request, res: Response) => {
  const arquivos = req.files as Express.Multer.File[];
  if (!arquivos?.length) return res.status(400).json({ sucesso: false, erro: 'Nenhum arquivo enviado' });

  const resultados = [];

  for (const arquivo of arquivos) {
    try {
      const dados = await leitor.lerFatura(arquivo.path);
      fs.unlinkSync(arquivo.path);
      const result = await processarFaturaCliente(dados);
      resultados.push({ arquivo: arquivo.originalname, ...result.body });
    } catch (err: any) {
      if (fs.existsSync(arquivo.path)) fs.unlinkSync(arquivo.path);
      resultados.push({ arquivo: arquivo.originalname, sucesso: false, erro: err.message });
    }
  }

  const sucesso = resultados.filter(r => r.sucesso).length;
  res.status(207).json({
    sucesso: sucesso > 0,
    mensagem: `${sucesso}/${resultados.length} faturas processadas`,
    resultados,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  Função interna: processa dados de uma fatura e gera Fatura no banco
// ─────────────────────────────────────────────────────────────────────────────
async function processarFaturaCliente(dados: Awaited<ReturnType<LeitorPDFService['lerFatura']>>) {
  // Busca beneficiário pela UC
  const beneficiario = await AppDataSource.getRepository(Beneficiario).findOne({
    where: { uc_beneficiaria: dados.uc, ativo: true },
    relations: ['cliente', 'usina'],
  });

  if (!beneficiario) {
    return {
      status: 404,
      body: {
        sucesso: false,
        erro: `UC ${dados.uc} não encontrada ou sem beneficiário ativo.`,
        dica: 'Vincule esta UC a um cliente antes de processar a fatura.',
        dados_extraidos: dados,
      },
    };
  }

  // Converte competencia "MM/YYYY" → "YYYY-MM-01"
  const [mes, ano] = dados.competencia.split('/');
  const competencia = `${ano}-${mes}-01` as any;

  // Busca o rateio correspondente (gerado pelo demonstrativo)
  const rateio = await AppDataSource.getRepository(Rateio).findOne({
    where: {
      beneficiario: { id: beneficiario.id },
      competencia: competencia as any,
    },
    relations: ['geracao'],
  });

  // Calcula o valor da fatura
  const descPct   = Number(beneficiario.desconto_percentual) || 0;
  const bruto     = parseFloat((dados.kwh_compensado * dados.tarifa_kwh).toFixed(2));
  const descValor = parseFloat((bruto * descPct / 100).toFixed(2));
  const liquido   = parseFloat((bruto - descValor).toFixed(2));

  // Data de vencimento — usa a do PDF ou calcula pelo dia cadastrado
  let data_vencimento: string;
  if (dados.data_vencimento) {
    const [dd, mm, yyyy] = dados.data_vencimento.split('/');
    data_vencimento = `${yyyy}-${mm}-${dd}`;
  } else {
    const dvenc = Number(beneficiario.dia_vencimento) || 10;
    const dStr  = String(dvenc).padStart(2, '0');
    const mNext = parseInt(mes) === 12 ? '01' : String(parseInt(mes) + 1).padStart(2, '0');
    const yNext = parseInt(mes) === 12 ? String(parseInt(ano) + 1) : ano;
    data_vencimento = `${yNext}-${mNext}-${dStr}`;
  }

  // Data de leitura
  let data_leitura: string | null = null;
  if (dados.data_leitura) {
    const [dd, mm, yyyy] = dados.data_leitura.split('/');
    data_leitura = `${yyyy}-${mm}-${dd}`;
  }

  // Verifica se já existe fatura para esta UC/competência (evita duplicata)
  const faturaExistente = await AppDataSource.getRepository(Fatura).findOne({
    where: {
      beneficiario: { id: beneficiario.id },
      competencia: competencia as any,
    },
  });

  if (faturaExistente) {
    return {
      status: 409,
      body: {
        sucesso: false,
        erro: `Já existe fatura para UC ${dados.uc} na competência ${dados.competencia}.`,
        fatura_id: faturaExistente.id,
      },
    };
  }

  // Cria a fatura
  const fatura = AppDataSource.getRepository(Fatura).create({
    beneficiario,
    rateio: rateio || undefined,
    competencia,
    valor: liquido,
    data_vencimento,
    status: StatusFatura.PENDENTE,
    data_leitura,
    kwh_alocado:           dados.kwh_compensado,
    tarifa_kwh:            dados.tarifa_kwh,
    tarifa_b1:             dados.tarifa_b1 || 0,
    valor_sem_desconto:    bruto,
    desconto_percentual:   descPct,
    valor_desconto:        descValor,
    kwh_consumo_energisa:  dados.kwh_consumo_energisa,
    cip_municipal:         dados.cip,
    outros_energisa:       dados.multa,
    saldo_credito:         dados.saldo_credito,
    total_fatura_energisa: dados.total_fatura_energisa,
  });

  await AppDataSource.getRepository(Fatura).save(fatura);

  return {
    status: 201,
    body: {
      sucesso: true,
      mensagem: 'Fatura gerada com sucesso!',
      fatura_id: fatura.id,
      cliente: beneficiario.cliente?.nome,
      uc: dados.uc,
      competencia: dados.competencia,
      kwh: dados.kwh_compensado,
      valor: liquido,
      vencimento: data_vencimento,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/upload/debug  — ver texto bruto extraído do PDF
// ─────────────────────────────────────────────────────────────────────────────
router.post('/debug', upload.single('pdf'), async (req: Request, res: Response) => {
  const arquivo = req.file;
  if (!arquivo) return res.status(400).json({ erro: 'Nenhum arquivo enviado' });

  try {
    const { extractText } = await import('unpdf');
    const buffer = fs.readFileSync(arquivo.path);
    const { text } = await extractText(new Uint8Array(buffer), { mergePages: true });
    fs.unlinkSync(arquivo.path);
    res.json({ texto: text });
  } catch (err: any) {
    res.status(500).json({ erro: err.message });
  }
});

export default router;