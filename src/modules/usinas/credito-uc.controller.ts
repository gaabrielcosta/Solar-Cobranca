import { Router, Request, Response } from 'express';
import { creditoUCService } from './credito-uc.service';

const router = Router();

// GET /api/creditos — saldo atual de todas as UCs
router.get('/', async (req: Request, res: Response) => {
  try {
    const data = await creditoUCService.buscarSaldoAtual();
    res.json({ sucesso: true, data });
  } catch (err: any) {
    res.status(500).json({ sucesso: false, erro: err.message });
  }
});

// GET /api/creditos/:beneficiarioId — histórico de uma UC
router.get('/:beneficiarioId', async (req: Request, res: Response) => {
  try {
    const data = await creditoUCService.buscarHistoricoUC(String(req.params.beneficiarioId));
    res.json({ sucesso: true, data });
  } catch (err: any) {
    res.status(500).json({ sucesso: false, erro: err.message });
  }
});

// POST /api/creditos/recalcular — recalcula todos para uma competência
// Body: { "competencia": "2026-03-01" }
router.post('/recalcular', async (req: Request, res: Response) => {
  try {
    const { competencia } = req.body;
    if (!competencia) return res.status(400).json({ sucesso: false, erro: 'Informe a competência (YYYY-MM-01)' });
    const result = await creditoUCService.recalcularTodos(competencia);
    res.json({ sucesso: true, ...result });
  } catch (err: any) {
    res.status(500).json({ sucesso: false, erro: err.message });
  }
});

// PATCH /api/creditos/:beneficiarioId/consumo — edita kWh consumido manualmente
// Body: { "competencia": "2026-03-01", "kwh_consumido": 400 }
router.patch('/:beneficiarioId/consumo', async (req: Request, res: Response) => {
  try {
    const { competencia, kwh_consumido } = req.body;
    if (!competencia || kwh_consumido == null)
      return res.status(400).json({ sucesso: false, erro: 'Informe competencia e kwh_consumido' });
    const data = await creditoUCService.atualizarConsumo(String(req.params.beneficiarioId), competencia, Number(kwh_consumido));
    res.json({ sucesso: true, data });
  } catch (err: any) {
    res.status(500).json({ sucesso: false, erro: err.message });
  }
});

export default router;
