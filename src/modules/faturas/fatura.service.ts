import { AppDataSource } from '../../database/data-source';
import { Fatura } from './fatura.entity';

export class FaturaService {
  private repo = AppDataSource.getRepository(Fatura);

  async listar(): Promise<Fatura[]> {
    return this.repo.find({ order: { created_at: 'DESC' } });
  }

  async buscarPorId(id: string): Promise<Fatura | null> {
    return this.repo.findOneBy({ id });
  }
} 