import { Router, Request, Response } from 'express';
import { AppDataSource } from '../../database/data-source';
import { Geracao } from './geracao.entity';
import { Rateio } from './rateio.entity';
import { Usina } from './usina.entity';
import { Beneficiario } from './beneficiario.entity';

const router = Router();

// Listar todas as gerações
router.get('/', async (req: Request, res: Response) => {
  try {
    const where: any = {}
    if (req.query.usina_id) where.usina = { id: String(req.query.usina_id) }
    const geracoes = await AppDataSource.getRepository(Geracao).find({
      where,
      relations: ['usina'],
      order: { competencia: 'DESC' },
    });
    res.json({ sucesso: true, data: geracoes });
  } catch (err: any) {
    res.status(500).json({ sucesso: false, erro: err.message });
  }
});

// Registrar geração mensal e calcular rateio automaticamente
router.post('/', async (req: Request, res: Response) => {
  try {
    const { usina_id, competencia, energia_gerada_kwh, tarifa_kwh } = req.body;

    const usina = await AppDataSource.getRepository(Usina).findOne({
      where: { id: usina_id }
    });
    if (!usina) return res.status(404).json({ sucesso: false, erro: 'Usina não encontrada' });

    const geracao = AppDataSource.getRepository(Geracao).create({
      usina,
      competencia,
      energia_gerada_kwh,
      tarifa_kwh,
      fonte: 'manual'
    });
    await AppDataSource.getRepository(Geracao).save(geracao);

    const beneficiarios = await AppDataSource.getRepository(Beneficiario).find({
      where: { usina: { id: usina_id }, ativo: true },
      relations: ['cliente']
    });

    if (beneficiarios.length === 0) {
      return res.status(400).json({ sucesso: false, erro: 'Nenhum beneficiário ativo' });
    }

    const totalPercentual = beneficiarios.reduce(
      (acc, b) => acc + Number(b.percentual_rateio), 0
    );
    if (Math.abs(totalPercentual - 100) > 0.01) {
      return res.status(400).json({
        sucesso: false,
        erro: `Percentuais somam ${totalPercentual.toFixed(2)}%, devem somar 100%`
      });
    }

    const rateios = [];
    for (const beneficiario of beneficiarios) {
      const kwh_alocado = parseFloat(
        (Number(energia_gerada_kwh) * (Number(beneficiario.percentual_rateio) / 100)).toFixed(2)
      );
      const valor_sem_desconto = parseFloat((kwh_alocado * Number(tarifa_kwh)).toFixed(2));
      const valor_desconto = parseFloat(
        (valor_sem_desconto * (Number(beneficiario.desconto_percentual) / 100)).toFixed(2)
      );
      const valor_final = parseFloat((valor_sem_desconto - valor_desconto).toFixed(2));

      const rateio = AppDataSource.getRepository(Rateio).create({
        geracao,
        beneficiario,
        kwh_alocado,
        tarifa_kwh,
        valor_credito: valor_final,
        competencia,
      });
      await AppDataSource.getRepository(Rateio).save(rateio);

      rateios.push({
        cliente: beneficiario.cliente.nome,
        uc: beneficiario.uc_beneficiaria,
        kwh_alocado,
        tarifa_kwh: Number(tarifa_kwh),
        valor_final,
      });
    }

    res.status(201).json({
      sucesso: true,
      geracao: { id: geracao.id, competencia, energia_gerada_kwh, tarifa_kwh },
      rateios,
    });
  } catch (err: any) {
    res.status(400).json({ sucesso: false, erro: err.message });
  }
});

// Listar gerações de uma usina específica
router.get('/usina/:usina_id', async (req: Request, res: Response) => {
  try {
    const geracoes = await AppDataSource.getRepository(Geracao).find({
      where: { usina: { id: String(req.params.usina_id) } },
      order: { competencia: 'DESC' }
    });
    res.json({ sucesso: true, data: geracoes });
  } catch (err: any) {
    res.status(500).json({ sucesso: false, erro: err.message });
  }
});

export default router;