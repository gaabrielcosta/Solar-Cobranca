import { AppDataSource } from '../../database/data-source';
import { Beneficiario } from './beneficiario.entity';
import { Usina } from './usina.entity';
import { Cliente } from '../clientes/cliente.entity';
import { logService } from '../logs/log.service';

export class BeneficiarioService {

  private get repo() { return AppDataSource.getRepository(Beneficiario); }

  async addByUsina(usinaId: string, dados: {
    cliente_id: string;
    uc_beneficiaria: string;
    desconto_percentual?: number;
    percentual_rateio?: number;
    dia_vencimento?: number;
    vigencia_inicio?: Date;
  }): Promise<Beneficiario> {
    const usina = await AppDataSource.getRepository(Usina).findOneBy({ id: usinaId });
    if (!usina) throw new Error('Usina não encontrada');

    const cliente = await AppDataSource.getRepository(Cliente).findOneBy({ id: dados.cliente_id });
    if (!cliente) throw new Error('Cliente não encontrado');

    const ucExiste = await this.repo.findOne({
      where: { uc_beneficiaria: dados.uc_beneficiaria, ativo: true },
      relations: ['cliente'],
    });
    if (ucExiste)
      throw new Error(`UC ${dados.uc_beneficiaria} já vinculada ao cliente "${ucExiste.cliente?.nome}"`);

    const benef = this.repo.create({
      usina, cliente,
      uc_beneficiaria:     dados.uc_beneficiaria,
      desconto_percentual: dados.desconto_percentual ?? 0,
      percentual_rateio:   dados.percentual_rateio   ?? 0,
      dia_vencimento:      dados.dia_vencimento       ?? 10,
      vigencia_inicio:     dados.vigencia_inicio      ?? new Date(),
    });

    const saved = await this.repo.save(benef);
    await AppDataSource.getRepository(Cliente).update({ id: dados.cliente_id }, { ativo: true });

    await logService.registrar({
      acao: 'BENEFICIARIO_ADICIONADO',
      descricao: `Cliente "${cliente.nome}" vinculado à usina "${usina.nome}" (UC: ${dados.uc_beneficiaria})`,
      entidade: 'beneficiario', entidade_id: saved.id,
      usina_id: usina.id, usina_nome: usina.nome, cliente_nome: cliente.nome,
    });

    return saved;
  }

  async remove(id: string): Promise<void> {
    const benef = await this.repo.findOne({ where: { id }, relations: ['cliente', 'usina'] });
    if (!benef) throw new Error('Beneficiário não encontrado');

    const clienteId   = benef.cliente_id;
    const clienteNome = benef.cliente?.nome || '';
    const usinaNome   = benef.usina?.nome   || '';
    const usinaId     = benef.usina_id;

    await this.repo.delete({ id });
    if (clienteId) await AppDataSource.getRepository(Cliente).update({ id: clienteId }, { ativo: true });

    await logService.registrar({
      acao: 'BENEFICIARIO_REMOVIDO',
      descricao: `Cliente "${clienteNome}" removido da usina "${usinaNome}"`,
      entidade: 'beneficiario', entidade_id: id,
      usina_id: usinaId, usina_nome: usinaNome, cliente_nome: clienteNome,
    });
  }

  async listByUsina(usinaId: string): Promise<Beneficiario[]> {
    return this.repo.find({
      where: { usina_id: usinaId, ativo: true },
      relations: ['cliente'],
      order: { created_at: 'ASC' },
    });
  }
}