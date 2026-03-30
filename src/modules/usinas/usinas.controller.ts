import { Router, Request, Response } from 'express';
import { UsinaService } from './usina.service';
import { BeneficiarioService } from './beneficiario.service';
import { AppDataSource } from '../../database/data-source';
import { Beneficiario } from './beneficiario.entity';
import { RateioService } from './rateio.service';

const router = Router();
const usinaService        = new UsinaService();
const beneficiarioService = new BeneficiarioService();
const rateioService       = new RateioService();

// ── Rotas fixas PRIMEIRO (antes de /:id) ─────────────────────

// GET /api/usinas
router.get('/', async (req: Request, res: Response) => {
  try {
    const data = await usinaService.listAll();
    res.json({ sucesso: true, data });
  } catch (err: any) { res.status(500).json({ sucesso: false, erro: err.message }); }
});

// POST /api/usinas
router.post('/', async (req: Request, res: Response) => {
  try {
    const { nome, potencia_kwp, distribuidora, uc_geradora, cidade, estado, tipo } = req.body;
    if (!nome || !potencia_kwp || !distribuidora || !uc_geradora)
      return res.status(400).json({ sucesso: false, erro: 'nome, potencia_kwp, distribuidora e uc_geradora são obrigatórios' });
    const usina = await usinaService.create({ nome, potencia_kwp, distribuidora, uc_geradora, cidade, estado, tipo: tipo || 'propria' });
    res.status(201).json({ sucesso: true, data: usina });
  } catch (err: any) { res.status(400).json({ sucesso: false, erro: err.message }); }
});

// GET /api/beneficiarios (compat.) — ANTES de /:id
router.get('/beneficiarios', async (req: Request, res: Response) => {
  try {
    const data = await AppDataSource.getRepository(Beneficiario).find({
      relations: ['cliente', 'usina'],
      where: { ativo: true },
      order: { created_at: 'DESC' },
    });
    res.json({ sucesso: true, data });
  } catch (err: any) { res.status(500).json({ sucesso: false, erro: err.message }); }
});

// POST /api/beneficiarios (compat.)
router.post('/beneficiarios', async (req: Request, res: Response) => {
  try {
    const { cliente_id, usina_id, uc_beneficiaria, desconto_percentual, percentual_rateio, dia_vencimento, vigencia_inicio } = req.body;
    if (!cliente_id || !usina_id || !uc_beneficiaria)
      return res.status(400).json({ sucesso: false, erro: 'cliente_id, usina_id e uc_beneficiaria são obrigatórios' });
    const benef = await beneficiarioService.addByUsina(String(usina_id), {
      cliente_id, uc_beneficiaria,
      desconto_percentual: Number(desconto_percentual) || 0,
      percentual_rateio:   Number(percentual_rateio)   || 0,
      dia_vencimento:      Number(dia_vencimento)      || 10,
      vigencia_inicio:     vigencia_inicio ? new Date(vigencia_inicio) : undefined,
    });
    res.status(201).json({ sucesso: true, data: benef });
  } catch (err: any) { res.status(400).json({ sucesso: false, erro: err.message }); }
});

// PATCH /api/beneficiarios/:id (compat.)
router.patch('/beneficiarios/:id', async (req: Request, res: Response) => {
  try {
    const repo = AppDataSource.getRepository(Beneficiario);
    const b = await repo.findOneBy({ id: String(req.params.id) });
    if (!b) return res.status(404).json({ sucesso: false, erro: 'Beneficiário não encontrado' });
    const { desconto_percentual, percentual_rateio, dia_vencimento, ativo } = req.body;
    if (desconto_percentual !== undefined) b.desconto_percentual = desconto_percentual;
    if (percentual_rateio   !== undefined) b.percentual_rateio   = percentual_rateio;
    if (dia_vencimento      !== undefined) b.dia_vencimento      = dia_vencimento;
    if (ativo               !== undefined) b.ativo               = ativo;
    await repo.save(b);
    res.json({ sucesso: true, data: b });
  } catch (err: any) { res.status(400).json({ sucesso: false, erro: err.message }); }
});

// POST /api/geracoes/:id/rateio (compat.)
router.post('/geracoes/:id/rateio', async (req: Request, res: Response) => {
  try {
    const resultados = await rateioService.calcularRateio(String(req.params.id));
    res.json({ sucesso: true, data: resultados });
  } catch (err: any) { res.status(400).json({ sucesso: false, erro: err.message }); }
});


// ── Rotas com parâmetro /:id DEPOIS ──────────────────────────

// DELETE /api/usinas/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await usinaService.delete(String(req.params.id));
    res.json({ sucesso: true, mensagem: 'Usina removida com sucesso' });
  } catch (err: any) {
    const status = err.message.includes('beneficiário') ? 409 : 500;
    res.status(status).json({ sucesso: false, erro: err.message });
  }
});

// GET /api/usinas/:id/beneficiarios
router.get('/:id/beneficiarios', async (req: Request, res: Response) => {
  try {
    const usina = await usinaService.getByIdWithBeneficiaries(String(req.params.id));
    if (!usina) return res.status(404).json({ sucesso: false, erro: 'Usina não encontrada' });
    res.json({ sucesso: true, data: usina });
  } catch (err: any) { res.status(500).json({ sucesso: false, erro: err.message }); }
});

// POST /api/usinas/:id/beneficiarios
router.post('/:id/beneficiarios', async (req: Request, res: Response) => {
  try {
    const { cliente_id, uc_beneficiaria, desconto_percentual, percentual_rateio, dia_vencimento, vigencia_inicio } = req.body;
    if (!cliente_id || !uc_beneficiaria)
      return res.status(400).json({ sucesso: false, erro: 'cliente_id e uc_beneficiaria são obrigatórios' });
    const benef = await beneficiarioService.addByUsina(String(req.params.id), {
      cliente_id, uc_beneficiaria,
      desconto_percentual: Number(desconto_percentual) || 0,
      percentual_rateio:   Number(percentual_rateio)   || 0,
      dia_vencimento:      Number(dia_vencimento)      || 10,
      vigencia_inicio:     vigencia_inicio ? new Date(vigencia_inicio) : undefined,
    });
    res.status(201).json({ sucesso: true, data: benef });
  } catch (err: any) { res.status(400).json({ sucesso: false, erro: err.message }); }
});

// DELETE /api/usinas/:usinaId/beneficiarios/:id
router.delete('/:usinaId/beneficiarios/:id', async (req: Request, res: Response) => {
  try {
    await beneficiarioService.remove(String(req.params.id));
    res.json({ sucesso: true, mensagem: 'Beneficiário desativado' });
  } catch (err: any) { res.status(400).json({ sucesso: false, erro: err.message }); }
});

export default router;