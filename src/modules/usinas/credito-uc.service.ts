import { AppDataSource } from '../../database/data-source';
import { CreditoUC } from './credito-uc.entity';
import { Rateio } from './rateio.entity';
import { Fatura } from '../faturas/fatura.entity';
import { Beneficiario } from './beneficiario.entity';

export class CreditoUCService {

  // ─────────────────────────────────────────────────────────────────
  //  Recalcula o crédito de uma UC para uma competência específica
  //  Chamado após importar demonstrativo ou atualizar fatura
  // ─────────────────────────────────────────────────────────────────
  async recalcularCredito(beneficiarioId: string, competencia: string): Promise<CreditoUC> {
    const repo = AppDataSource.getRepository(CreditoUC);

    // Busca o rateio do mês (kwh_compensado)
    const rateio = await AppDataSource.getRepository(Rateio).findOne({
      where: {
        beneficiario: { id: beneficiarioId },
        competencia: competencia as any,
      },
    });

    // Busca a fatura do mês (kwh_consumido)
    const fatura = await AppDataSource.getRepository(Fatura).findOne({
      where: {
        beneficiario: { id: beneficiarioId },
        competencia: competencia as any,
      },
    });

    const kwh_compensado = Number(rateio?.kwh_alocado || 0);
    const kwh_consumido  = Number(fatura?.kwh_alocado || 0);

    // Busca saldo do mês anterior
    const compDate  = new Date(competencia + 'T12:00:00');
    const mesAnterior = new Date(compDate.getFullYear(), compDate.getMonth() - 1, 1);
    const mesAnteriorStr = `${mesAnterior.getFullYear()}-${String(mesAnterior.getMonth() + 1).padStart(2, '0')}-01`;

    const creditoAnterior = await repo.findOne({
      where: {
        beneficiario: { id: beneficiarioId },
        competencia: mesAnteriorStr as any,
      },
    });

    const saldo_anterior = Number(creditoAnterior?.saldo_atual || 0);
    const saldo_atual    = parseFloat((saldo_anterior + kwh_compensado - kwh_consumido).toFixed(2));

    // Upsert — cria ou atualiza
    let credito = await repo.findOne({
      where: {
        beneficiario: { id: beneficiarioId },
        competencia: competencia as any,
      },
    });

    if (!credito) {
      credito = repo.create({
        beneficiario: { id: beneficiarioId } as Beneficiario,
        competencia: competencia as any,
      });
    }

    credito.saldo_anterior  = saldo_anterior;
    credito.kwh_compensado  = kwh_compensado;
    credito.kwh_consumido   = kwh_consumido;
    credito.saldo_atual     = Math.max(0, saldo_atual); // nunca negativo

    await repo.save(credito);
    return credito;
  }

  // ─────────────────────────────────────────────────────────────────
  //  Recalcula créditos de TODOS os beneficiários de uma competência
  //  Chamado após importar demonstrativo
  // ─────────────────────────────────────────────────────────────────
  async recalcularTodos(competencia: string): Promise<{ total: number; erros: number }> {
    const beneficiarios = await AppDataSource.getRepository(Beneficiario).find({
      where: { ativo: true },
    });

    let total = 0;
    let erros = 0;

    for (const b of beneficiarios) {
      try {
        await this.recalcularCredito(b.id, competencia);
        total++;
      } catch (e) {
        console.error(`[CREDITO] Erro ao calcular UC ${b.uc_beneficiaria}:`, e);
        erros++;
      }
    }

    console.log(`[CREDITO] Recálculo concluído — ${total} UCs, ${erros} erros`);
    return { total, erros };
  }

  // ─────────────────────────────────────────────────────────────────
  //  Busca saldo atual de todas as UCs
  // ─────────────────────────────────────────────────────────────────
  async buscarSaldoAtual(): Promise<CreditoUC[]> {
    // Para cada beneficiário, pega o crédito mais recente
    return AppDataSource.getRepository(CreditoUC)
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.beneficiario', 'b')
      .leftJoinAndSelect('b.cliente', 'cl')
      .leftJoinAndSelect('b.usina', 'u')
      .where(qb => {
        const sub = qb.subQuery()
          .select('MAX(c2.competencia)')
          .from(CreditoUC, 'c2')
          .where('c2.beneficiario_id = c.beneficiario_id')
          .getQuery();
        return `c.competencia = ${sub}`;
      })
      .orderBy('c.saldo_atual', 'DESC')
      .getMany();
  }

  // ─────────────────────────────────────────────────────────────────
  //  Busca histórico de uma UC específica
  // ─────────────────────────────────────────────────────────────────
  async buscarHistoricoUC(beneficiarioId: string): Promise<CreditoUC[]> {
    return AppDataSource.getRepository(CreditoUC).find({
      where: { beneficiario: { id: beneficiarioId } },
      order: { competencia: 'ASC' },
    });
  }

  // ─────────────────────────────────────────────────────────────────
  //  Atualiza kwh_consumido manualmente (edição no dashboard)
  // ─────────────────────────────────────────────────────────────────
  async atualizarConsumo(beneficiarioId: string, competencia: string, kwh_consumido: number): Promise<CreditoUC> {
    const repo = AppDataSource.getRepository(CreditoUC);
    const credito = await repo.findOne({
      where: { beneficiario: { id: beneficiarioId }, competencia: competencia as any },
    });

    if (!credito) throw new Error('Crédito não encontrado para esta UC/competência');

    credito.kwh_consumido = kwh_consumido;
    credito.saldo_atual   = Math.max(0, parseFloat(
      (Number(credito.saldo_anterior) + Number(credito.kwh_compensado) - kwh_consumido).toFixed(2)
    ));

    await repo.save(credito);
    return credito;
  }
}

export const creditoUCService = new CreditoUCService();