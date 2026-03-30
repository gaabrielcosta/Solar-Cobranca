import { AppDataSource } from '../../database/data-source';
import { Usina } from './usina.entity';
import { Beneficiario } from './beneficiario.entity';

export class UsinaService {

  private get repo() { return AppDataSource.getRepository(Usina); }
  private get benefRepo() { return AppDataSource.getRepository(Beneficiario); }

  async listAll(): Promise<Usina[]> {
    return this.repo.find({ order: { nome: 'ASC' } });
  }

  async create(dados: Partial<Usina>): Promise<Usina> {
    const usina = this.repo.create(dados);
    return this.repo.save(usina);
  }

  async getByIdWithBeneficiaries(id: string): Promise<Usina | null> {
    const usina = await this.repo.findOne({ where: { id } });
    if (!usina) return null;

    // Filtra apenas beneficiários ativos E vinculados à usina
    usina.beneficiarios = await this.benefRepo.find({
      where: { usina_id: id, ativo: true },
      relations: ['cliente'],
      order: { created_at: 'ASC' },
    });

    return usina;
  }

  async delete(id: string): Promise<void> {
    // Regra: impede exclusão se houver beneficiários ativos
    const count = await this.benefRepo.count({
      where: { usina_id: id, ativo: true },
    });

    if (count > 0) {
      throw new Error(
        `Não é possível excluir a usina: existem ${count} beneficiário(s) ativo(s) vinculados. ` +
        `Desative-os primeiro.`
      );
    }

    await this.repo.delete(id);
  }
}