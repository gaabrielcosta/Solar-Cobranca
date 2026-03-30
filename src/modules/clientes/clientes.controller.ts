import { Router, Request, Response } from 'express';
import { AppDataSource } from '../../database/data-source';
import { Cliente } from './cliente.entity';
import { Beneficiario } from '../usinas/beneficiario.entity';
import { logService } from '../logs/log.service';

const router = Router();

function sanitizeCpf(v: string): string { return (v || '').replace(/\D/g, ''); }
function validarDesconto(v: any): number | null {
  const n = parseFloat(v);
  if (isNaN(n) || n < 0 || n > 100) return null;
  return Math.round(n * 100) / 100;
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const data = await AppDataSource.getRepository(Cliente).find({ order: { nome: 'ASC' } });
    res.json({ sucesso: true, data });
  } catch (err: any) { res.status(500).json({ sucesso: false, erro: err.message }); }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const repo = AppDataSource.getRepository(Cliente);
    const { nome, cpf_cnpj, email, telefone, cep, logradouro, numero, complemento,
            bairro, cidade, estado_endereco, endereco, uc_beneficiaria, desconto_percentual, dia_vencimento } = req.body;

    if (!nome || !cpf_cnpj || !telefone)
      return res.status(400).json({ sucesso: false, erro: 'nome, cpf_cnpj e telefone são obrigatórios' });

    const desc = validarDesconto(desconto_percentual ?? 0);
    if (desc === null)
      return res.status(400).json({ sucesso: false, erro: 'desconto_percentual deve ser entre 0 e 100' });

    if (uc_beneficiaria) {
      const ucExiste = await repo.findOne({ where: { uc_beneficiaria: String(uc_beneficiaria) } });
      if (ucExiste)
        return res.status(400).json({ sucesso: false, erro: `UC ${uc_beneficiaria} já cadastrada para "${ucExiste.nome}"` });
    }

    const cliente = await repo.save(repo.create({
      nome, cpf_cnpj: sanitizeCpf(cpf_cnpj), email: email || '', telefone,
      cep: cep || null, logradouro: logradouro || null, numero: numero || null,
      complemento: complemento || null, bairro: bairro || null, cidade: cidade || null,
      estado_endereco: estado_endereco || null, endereco: endereco || null,
      uc_beneficiaria: uc_beneficiaria || null, desconto_percentual: desc,
      dia_vencimento: Number(dia_vencimento) || 10,
    }));

    await logService.registrar({
      acao: 'CLIENTE_CRIADO', descricao: `Cliente "${nome}" cadastrado`,
      entidade: 'cliente', entidade_id: cliente.id, cliente_nome: nome,
    });

    res.status(201).json({ sucesso: true, data: cliente });
  } catch (err: any) {
    const msg = err.code === '23505' ? 'CPF/CNPJ já cadastrado' : err.message;
    res.status(400).json({ sucesso: false, erro: msg });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const repo = AppDataSource.getRepository(Cliente);
    const c = await repo.findOneBy({ id: String(req.params.id) });
    if (!c) return res.status(404).json({ sucesso: false, erro: 'Cliente não encontrado' });

    if (req.body.cpf_cnpj) req.body.cpf_cnpj = sanitizeCpf(req.body.cpf_cnpj);
    if (req.body.desconto_percentual !== undefined) {
      const desc = validarDesconto(req.body.desconto_percentual);
      if (desc === null)
        return res.status(400).json({ sucesso: false, erro: 'desconto_percentual deve ser entre 0 e 100' });
      req.body.desconto_percentual = desc;
    }
    if (req.body.uc_beneficiaria) {
      const ucExiste = await repo.findOne({ where: { uc_beneficiaria: String(req.body.uc_beneficiaria) } });
      if (ucExiste && ucExiste.id !== req.params.id)
        return res.status(400).json({ sucesso: false, erro: `UC ${req.body.uc_beneficiaria} já cadastrada para "${ucExiste.nome}"` });
    }

    const nomeAntes = c.nome;
    await repo.save(Object.assign(c, req.body));

    // Sincroniza desconto e dia_vencimento nos beneficiários ativos do cliente
    if (req.body.desconto_percentual !== undefined || req.body.dia_vencimento !== undefined) {
      const camposSync: any = {};
      if (req.body.desconto_percentual !== undefined) camposSync.desconto_percentual = req.body.desconto_percentual;
      if (req.body.dia_vencimento      !== undefined) camposSync.dia_vencimento      = Number(req.body.dia_vencimento);

      await AppDataSource.getRepository(Beneficiario)
        .createQueryBuilder()
        .update()
        .set(camposSync)
        .where('cliente_id = :id', { id: req.params.id })
        .execute();
    }

    await logService.registrar({
      acao: 'CLIENTE_EDITADO', descricao: `Cliente "${nomeAntes}" atualizado`,
      entidade: 'cliente', entidade_id: c.id, cliente_nome: nomeAntes,
    });

    res.json({ sucesso: true, data: c });
  } catch (err: any) { res.status(400).json({ sucesso: false, erro: err.message }); }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const repo = AppDataSource.getRepository(Cliente);
    const c = await repo.findOneBy({ id: String(req.params.id) });
    if (!c) return res.status(404).json({ sucesso: false, erro: 'Cliente não encontrado' });

    if (req.query.force === 'true') {
      await AppDataSource.query(`DELETE FROM beneficiarios WHERE cliente_id = $1`, [req.params.id]);
      await repo.delete({ id: String(req.params.id) });
      await logService.registrar({
        acao: 'CLIENTE_EXCLUIDO', descricao: `Cliente "${c.nome}" excluído permanentemente`,
        entidade: 'cliente', entidade_id: c.id, cliente_nome: c.nome,
      });
      res.json({ sucesso: true, mensagem: 'Cliente excluído permanentemente' });
    } else {
      c.ativo = false;
      await repo.save(c);
      await AppDataSource.query(`DELETE FROM beneficiarios WHERE cliente_id = $1`, [req.params.id]);
      await logService.registrar({
        acao: 'CLIENTE_DESATIVADO', descricao: `Cliente "${c.nome}" desativado`,
        entidade: 'cliente', entidade_id: c.id, cliente_nome: c.nome,
      });
      res.json({ sucesso: true, mensagem: 'Cliente desativado' });
    }
  } catch (err: any) { res.status(400).json({ sucesso: false, erro: err.message }); }
});

export default router;