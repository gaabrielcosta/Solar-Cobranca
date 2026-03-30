import { AppDataSource } from '../../database/data-source';
import { Geracao } from './geracao.entity';
import { Beneficiario } from './beneficiario.entity';
import { Rateio } from './rateio.entity';

interface ResultadoRateio {
  beneficiario_id: string;
  cliente_id: string;
  uc_beneficiaria: string;
  percentual: number;
  kwh_alocado: number;
  tarifa_kwh: number;
  desconto_percentual: number;
  valor_sem_desconto: number;
  economia_desconto: number;
  valor_credito: number;
}

export class RateioService {
  private geracaoRepo      = AppDataSource.getRepository(Geracao);
  private beneficiarioRepo = AppDataSource.getRepository(Beneficiario);
  private rateioRepo       = AppDataSource.getRepository(Rateio);

  async calcularRateio(geracaoId: string): Promise<ResultadoRateio[]> {
    const geracao = await this.geracaoRepo.findOne({
      where: { id: geracaoId },
      relations: ['usina'],
    });
    if (!geracao) throw new Error('Geração não encontrada');

    const beneficiarios = await this.beneficiarioRepo
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.cliente', 'cliente')
      .where('b.usina_id = :usinaId', { usinaId: geracao.usina.id })
      .andWhere('b.ativo = true')
      .andWhere('b.vigencia_inicio <= :competencia', { competencia: geracao.competencia })
      .andWhere('(b.vigencia_fim IS NULL OR b.vigencia_fim >= :competencia)', {
        competencia: geracao.competencia,
      })
      .getMany();

    if (beneficiarios.length === 0)
      throw new Error('Nenhum beneficiário ativo encontrado para esta usina');

    const totalPercentual = beneficiarios.reduce(
      (acc, b) => acc + Number(b.percentual_rateio), 0
    );
    if (Math.abs(totalPercentual - 100) > 0.01)
      throw new Error(`Percentuais somam ${totalPercentual.toFixed(2)}%, devem somar 100%`);

    const resultados: ResultadoRateio[] = [];

    for (const beneficiario of beneficiarios) {
      const kwh_alocado = parseFloat(
        (Number(geracao.energia_gerada_kwh) * (Number(beneficiario.percentual_rateio) / 100)).toFixed(2)
      );
      const desconto = Number(beneficiario.desconto_percentual) || 0;
      const valor_sem_desconto = parseFloat((kwh_alocado * Number(geracao.tarifa_kwh)).toFixed(2));
      const valor_credito = parseFloat((valor_sem_desconto * (1 - desconto / 100)).toFixed(2));
      const economia_desconto = parseFloat((valor_sem_desconto - valor_credito).toFixed(2));

      const rateio = this.rateioRepo.create({
        geracao,
        beneficiario,
        kwh_alocado,
        tarifa_kwh: geracao.tarifa_kwh,
        valor_credito,
        competencia: geracao.competencia,
      });
      await this.rateioRepo.save(rateio);

      resultados.push({
        beneficiario_id:     beneficiario.id,
        cliente_id:          beneficiario.cliente.id,
        uc_beneficiaria:     beneficiario.uc_beneficiaria,
        percentual:          Number(beneficiario.percentual_rateio),
        kwh_alocado,
        tarifa_kwh:          Number(geracao.tarifa_kwh),
        desconto_percentual: desconto,
        valor_sem_desconto,
        economia_desconto,
        valor_credito,
      });
    }

    return resultados;
  }
}