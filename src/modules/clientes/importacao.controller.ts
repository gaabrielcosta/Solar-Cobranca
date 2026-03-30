import { Router, Request, Response } from 'express';
import { AppDataSource } from '../../database/data-source';
import { Cliente } from './cliente.entity';
import { logService } from '../logs/log.service';

const router = Router();

function sanitizeCpf(v: string): string {
  return (v || '').replace(/\D/g, '');
}

function sanitizeTel(v: string): string {
  return (v || '').replace(/\D/g, '');
}

function normalizeHeader(h: string): string {
  // Remove prefixo A_, B_, C_... se existir
  return h.trim().replace(/^[A-Z]_/, '');
}

function detectSeparator(line: string): string {
  const semicolons = (line.match(/;/g) || []).length;
  const commas     = (line.match(/,/g) || []).length;
  return semicolons >= commas ? ';' : ',';
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const sep = detectSeparator(lines[0]);
  const headers = lines[0].split(sep).map(h => normalizeHeader(h));
  return lines.slice(1).map(line => {
    // Suporte a vírgulas dentro de aspas
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes; }
      else if (char === sep && !inQuotes) { values.push(current.trim()); current = ''; }
      else { current += char; }
    }
    values.push(current.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (values[i] || '').trim(); });
    return row;
  });
}

// POST /api/clientes/importar
router.post('/importar', async (req: Request, res: Response) => {
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString('utf-8');

    let csvText = raw;
    const ct = req.headers['content-type'] || '';
    if (ct.includes('multipart/form-data')) {
      const bm = ct.match(/boundary=(.+)$/);
      if (bm) {
        const boundary = '--' + bm[1].trim();
        const parts = raw.split(boundary);
        for (const part of parts) {
          if (part.includes('filename=') || part.includes('name="csv"')) {
            const sep = part.indexOf('\r\n\r\n');
            if (sep !== -1) { csvText = part.slice(sep + 4).replace(/\r\n--$/, '').trim(); break; }
          }
        }
      }
    }

    const rows = parseCSV(csvText);
    if (!rows.length)
      return res.status(400).json({ sucesso: false, erro: 'CSV vazio ou formato inválido' });

    const repo = AppDataSource.getRepository(Cliente);
    const resultados = { importados: 0, atualizados: 0, pulados: 0, erros: [] as string[] };

    for (const row of rows) {
      const nome     = row['nome']?.trim();
      const cpf_raw  = row['cpf_cnpj']?.trim();
      const telefone = row['telefone']?.trim();

      if (!nome || !cpf_raw || !telefone) {
        resultados.erros.push(`Linha ignorada — dados obrigatórios ausentes: nome="${nome}", cpf="${cpf_raw}", tel="${telefone}"`);
        continue;
      }

      const cpf_cnpj = sanitizeCpf(cpf_raw);
      const uc       = row['uc_beneficiaria']?.trim() || null;
      const desc     = parseFloat(row['desconto_percentual'] || '0');
      const dvenc    = parseInt(row['dia_vencimento'] || '10');

      const dados = {
        nome,
        cpf_cnpj,
        telefone:            sanitizeTel(telefone),
        email:               row['email']?.trim()            || '',
        uc_beneficiaria:     uc,
        desconto_percentual: isNaN(desc)  ? 0  : Math.min(Math.max(desc, 0), 100),
        dia_vencimento:      isNaN(dvenc) ? 10 : Math.min(Math.max(dvenc, 1), 28),
        cep:                 row['cep']?.trim()              || null,
        logradouro:          row['logradouro']?.trim()       || null,
        numero:              row['numero']?.trim()           || null,
        complemento:         row['complemento']?.trim()      || null,
        bairro:              row['bairro']?.trim()           || null,
        cidade:              row['cidade']?.trim()           || null,
        estado_endereco:     row['estado_endereco']?.trim()  || null,
      };

      // Validar UC duplicada (apenas para novos clientes ou se UC mudou)
      if (uc) {
        const ucExiste = await repo.findOne({ where: { uc_beneficiaria: uc } });
        const clienteExistente = await repo.findOne({ where: { cpf_cnpj } });
        if (ucExiste && ucExiste.cpf_cnpj !== cpf_cnpj) {
          resultados.erros.push(`UC ${uc} já pertence ao cliente "${ucExiste.nome}" — linha de ${nome} importada sem UC`);
          dados.uc_beneficiaria = null;
        }
      }

      // Atualiza se CPF já existe, cria se não existe
      const jaExiste = await repo.findOne({ where: { cpf_cnpj } });
      if (jaExiste) {
        await repo.save(Object.assign(jaExiste, dados));
        resultados.atualizados++;
      } else {
        await repo.save(repo.create(dados));
        resultados.importados++;
      }
    }

    const total = resultados.importados + resultados.atualizados;

    if (total > 0) {
      await logService.registrar({
        acao: 'CLIENTES_IMPORTADOS',
        descricao: `Importação CSV: ${resultados.importados} novo(s), ${resultados.atualizados} atualizado(s)`,
        entidade: 'cliente',
        dados: { importados: resultados.importados, atualizados: resultados.atualizados, erros: resultados.erros },
      });
    }

    res.json({
      sucesso: true,
      mensagem: `${resultados.importados} importado(s), ${resultados.atualizados} atualizado(s)${resultados.pulados ? `, ${resultados.pulados} pulado(s)` : ''}`,
      ...resultados,
      total,
    });
  } catch (err: any) {
    console.error('[IMPORTAR]', err);
    res.status(500).json({ sucesso: false, erro: err.message });
  }
});

export default router;