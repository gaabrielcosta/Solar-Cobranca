import * as puppeteer from 'puppeteer';
import { AppDataSource } from '../../database/data-source';
import { Fatura, StatusFatura } from './fatura.entity';
import { Geracao } from '../usinas/geracao.entity';
import { CreditoUC } from '../usinas/credito-uc.entity';
import { In } from 'typeorm';
import { Beneficiario } from '../usinas/beneficiario.entity';

function brl(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function competenciaExtenso(comp: string): string {
  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                 'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const [yyyy, mm] = comp.split('-');
  return `${meses[parseInt(mm) - 1]} / ${yyyy}`;
}

export async function gerarRelatorioPDF(competencia: string, usinaId?: string): Promise<Buffer> {
  const { Usina } = await import('../usinas/usina.entity');

  // Busca nome da usina para o relatório
  let usinaNome = 'Todas as Usinas';
  if (usinaId) {
    const usina = await AppDataSource.getRepository(Usina).findOneBy({ id: usinaId });
    if (usina) usinaNome = usina.nome;
  }

  // ── Busca dados filtrados por usina ──────────────────────────
  const faturas = await AppDataSource.getRepository(Fatura).find({
    where: {
      competencia: competencia as any,
      ...(usinaId ? { beneficiario: { usina_id: usinaId } } : {}),
    },
    relations: ['beneficiario', 'beneficiario.cliente', 'beneficiario.usina'],
    order: { beneficiario: { uc_beneficiaria: 'ASC' } } as any,
  });

  const geracoes = await AppDataSource.getRepository(Geracao).find({
    where: {
      competencia: competencia as any,
      ...(usinaId ? { usina: { id: usinaId } } : {}),
    },
    relations: ['usina'],
  });

  const creditos = await AppDataSource.getRepository(CreditoUC).find({
    where: {
      competencia: competencia as any,
      ...(usinaId ? { beneficiario: { usina_id: usinaId } } : {}),
    },
    relations: ['beneficiario', 'beneficiario.cliente'],
  });

  // Busca beneficiários ativos filtrados por usina
  const beneficiarios = await AppDataSource.getRepository(Beneficiario).find({
    where: { ativo: true, ...(usinaId ? { usina_id: usinaId } : {}) },
    relations: ['cliente'],
    order: { uc_beneficiaria: 'ASC' } as any,
  });

  // ── KPIs ─────────────────────────────────────────────────────
  const totalFaturado  = faturas.reduce((a, f) => a + Number(f.valor || 0), 0);
  const totalRecebido  = faturas.filter(f => f.status === StatusFatura.PAGA).reduce((a, f) => a + Number(f.valor || 0), 0);
  const totalPendente  = faturas.filter(f => f.status === StatusFatura.PENDENTE).reduce((a, f) => a + Number(f.valor || 0), 0);
  const totalAtrasado  = faturas.filter(f => f.status === StatusFatura.ATRASADA).reduce((a, f) => a + Number(f.valor || 0), 0);
  const totalEconomia  = faturas.reduce((a, f) => a + Number(f.valor_desconto || 0), 0);
  const totalKwh       = faturas.reduce((a, f) => a + Number(f.kwh_alocado || 0), 0);
  const totalGerado    = geracoes.reduce((a, g) => a + Number(g.energia_gerada_kwh || 0), 0);
  const totalCreditos  = creditos.reduce((a, c) => a + Number(c.saldo_atual || 0), 0);
  const qtdPagas       = faturas.filter(f => f.status === StatusFatura.PAGA).length;
  const qtdPendentes   = faturas.filter(f => f.status === StatusFatura.PENDENTE).length;
  const qtdAtrasadas   = faturas.filter(f => f.status === StatusFatura.ATRASADA).length;
  const inadimplencia  = faturas.length > 0 ? ((qtdAtrasadas / faturas.length) * 100).toFixed(1) : '0.0';
  const descontoMedio  = faturas.length > 0 ? (faturas.reduce((a, f) => a + Number(f.desconto_percentual || 0), 0) / faturas.length).toFixed(1) : '0.0';

  const dataGeracao = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  // ── Status badge ─────────────────────────────────────────────
  const statusBadge = (s: string) => {
    const map: Record<string, [string, string]> = {
      paga:      ['#52b788', 'Pago'],
      pendente:  ['#fbbf24', 'Pendente'],
      atrasada:  ['#f87171', 'Atrasado'],
      negociada: ['#c4b5fd', 'Negociado'],
    };
    const [cor, label] = map[s] || ['#94a3b8', s];
    return `<span style="display:inline-block;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700;background:${cor}22;color:${cor};border:1px solid ${cor}44">${label}</span>`;
  };

  // ── Linhas da tabela — todos os beneficiários ativos ────────
  const linhas = beneficiarios.map(b => {
    const fatura = faturas.find(f => f.beneficiario?.id === b.id);
    const nome   = b.cliente?.nome || '—';
    const uc     = b.uc_beneficiaria || '—';
    const cred   = creditos.find(c => c.beneficiario_id === b.id);
    const saldo  = cred ? Number(cred.saldo_atual || 0).toFixed(0) + ' kWh' : '—';

    if (!fatura) {
      // Beneficiário sem fatura gerada
      return `
        <tr style="opacity:0.6">
          <td>${nome.split(' ').slice(0,2).join(' ')}<br><span style="font-size:10px;color:#64748b">UC ${uc}</span></td>
          <td style="text-align:right;color:#94a3b8">—</td>
          <td style="text-align:center;color:#94a3b8">—</td>
          <td style="text-align:right;color:#94a3b8">—</td>
          <td style="text-align:right;color:#94a3b8">—</td>
          <td style="text-align:center">${saldo}</td>
          <td style="text-align:center"><span style="display:inline-block;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700;background:#94a3b822;color:#94a3b8;border:1px solid #94a3b844">Não gerado</span></td>
        </tr>`;
    }

    const kwh  = Number(fatura.kwh_alocado || 0).toFixed(0);
    const desc = Number(fatura.desconto_percentual || 0).toFixed(0);
    const val  = brl(Number(fatura.valor || 0));
    const eco  = brl(Number(fatura.valor_desconto || 0));
    return `
      <tr>
        <td>${nome.split(' ').slice(0,2).join(' ')}<br><span style="font-size:10px;color:#64748b">UC ${uc}</span></td>
        <td style="text-align:right">${kwh} kWh</td>
        <td style="text-align:center">${desc}%</td>
        <td style="text-align:right;color:#52b788">R$ ${eco}</td>
        <td style="text-align:right;font-weight:600">R$ ${val}</td>
        <td style="text-align:center">${saldo}</td>
        <td style="text-align:center">${statusBadge(fatura.status)}</td>
      </tr>`;
  }).join('');

  // ── HTML do relatório ─────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #1e293b; background: #fff; }
  .page { padding: 32px 36px; }

  /* Cabeçalho */
  .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 20px; border-bottom: 2px solid #52b788; margin-bottom: 24px; }
  .logo-area { display: flex; align-items: center; gap: 12px; }
  .logo-icon { width: 44px; height: 44px; background: #52b788; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
  .logo-icon span { color: #fff; font-size: 22px; font-weight: 900; }
  .logo-name { font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; }
  .logo-sub { font-size: 10px; color: #64748b; font-weight: 500; text-transform: uppercase; letter-spacing: 1px; }
  .header-right { text-align: right; }
  .rel-title { font-size: 18px; font-weight: 700; color: #0f172a; }
  .rel-comp { font-size: 13px; color: #52b788; font-weight: 600; margin-top: 2px; }
  .rel-data { font-size: 10px; color: #94a3b8; margin-top: 4px; }

  /* KPI grid */
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
  .kpi { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; }
  .kpi-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #94a3b8; margin-bottom: 4px; }
  .kpi-val { font-size: 20px; font-weight: 700; color: #0f172a; line-height: 1; }
  .kpi-sub { font-size: 10px; color: #64748b; margin-top: 3px; }
  .kpi.green { border-left: 3px solid #52b788; }
  .kpi.yellow { border-left: 3px solid #fbbf24; }
  .kpi.red { border-left: 3px solid #f87171; }
  .kpi.blue { border-left: 3px solid #60a5fa; }

  /* Seções */
  .sec-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #64748b; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px solid #e2e8f0; }
  .sec { margin-bottom: 24px; }

  /* Tabela */
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  thead tr { background: #f1f5f9; }
  th { padding: 8px 10px; text-align: left; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #64748b; }
  td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; color: #374151; }
  tr:hover td { background: #f8fafc; }

  /* Mini grid financeiro */
  .fin-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 24px; }
  .fin-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; }
  .fin-val { font-size: 18px; font-weight: 700; margin: 4px 0; }

  /* Rodapé */
  .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
  .footer-left { font-size: 10px; color: #94a3b8; }
  .footer-right { font-size: 10px; color: #94a3b8; text-align: right; }
</style>
</head>
<body>
<div class="page">

  <!-- Cabeçalho -->
  <div class="header">
    <div class="logo-area">
      <div class="logo-icon"><span>☀</span></div>
      <div>
        <div class="logo-name">ACELIVRE</div>
        <div class="logo-sub">Energia Solar Compartilhada</div>
      </div>
    </div>
    <div class="header-right">
      <div class="rel-title">Relatório Mensal</div>
      <div class="rel-comp">${competenciaExtenso(competencia)}</div>
      <div class="rel-data" style="color:#52b788;font-weight:600">${usinaNome}</div>
      <div class="rel-data">Gerado em ${dataGeracao}</div>
    </div>
  </div>

  <!-- KPIs principais -->
  <div class="kpi-grid">
    <div class="kpi green">
      <div class="kpi-label">Total Faturado</div>
      <div class="kpi-val" style="color:#52b788">R$ ${brl(totalFaturado)}</div>
      <div class="kpi-sub">${faturas.length} faturas emitidas</div>
    </div>
    <div class="kpi green">
      <div class="kpi-label">Total Recebido</div>
      <div class="kpi-val" style="color:#52b788">R$ ${brl(totalRecebido)}</div>
      <div class="kpi-sub">${qtdPagas} faturas pagas</div>
    </div>
    <div class="kpi yellow">
      <div class="kpi-label">Em Aberto</div>
      <div class="kpi-val" style="color:#fbbf24">R$ ${brl(totalPendente + totalAtrasado)}</div>
      <div class="kpi-sub">${qtdPendentes + qtdAtrasadas} faturas pendentes</div>
    </div>
    <div class="kpi blue">
      <div class="kpi-label">Economia Gerada</div>
      <div class="kpi-val" style="color:#60a5fa">R$ ${brl(totalEconomia)}</div>
      <div class="kpi-sub">Desconto médio ${descontoMedio}%</div>
    </div>
  </div>

  <!-- Seção Energia -->
  <div class="sec">
    <div class="sec-title">☀️ Energia</div>
    <div class="kpi-grid">
      <div class="kpi green">
        <div class="kpi-label">kWh Gerados</div>
        <div class="kpi-val">${totalGerado.toLocaleString('pt-BR')}</div>
        <div class="kpi-sub">pela usina no mês</div>
      </div>
      <div class="kpi green">
        <div class="kpi-label">kWh Compensados</div>
        <div class="kpi-val">${totalKwh.toLocaleString('pt-BR')}</div>
        <div class="kpi-sub">distribuídos aos clientes</div>
      </div>
      <div class="kpi blue">
        <div class="kpi-label">Créditos Acumulados</div>
        <div class="kpi-val">${totalCreditos.toLocaleString('pt-BR')}</div>
        <div class="kpi-sub">kWh total da carteira</div>
      </div>
      <div class="kpi ${Number(inadimplencia) > 20 ? 'red' : Number(inadimplencia) > 5 ? 'yellow' : 'green'}">
        <div class="kpi-label">Inadimplência</div>
        <div class="kpi-val" style="color:${Number(inadimplencia) > 20 ? '#f87171' : Number(inadimplencia) > 5 ? '#fbbf24' : '#52b788'}">${inadimplencia}%</div>
        <div class="kpi-sub">${qtdAtrasadas} faturas em atraso</div>
      </div>
    </div>
  </div>

  <!-- Tabela clientes -->
  <div class="sec">
    <div class="sec-title">👥 Clientes — Nome / UC</div>
    <table>
      <thead>
        <tr>
          <th>Nome / UC</th>
          <th style="text-align:right">kWh</th>
          <th style="text-align:center">Desconto</th>
          <th style="text-align:right">Economia</th>
          <th style="text-align:right">Valor</th>
          <th style="text-align:center">Crédito</th>
          <th style="text-align:center">Status</th>
        </tr>
      </thead>
      <tbody>
        ${linhas}
      </tbody>
      <tfoot>
        <tr style="background:#f1f5f9;font-weight:700">
          <td>Total</td>
          <td style="text-align:right">${totalKwh.toLocaleString('pt-BR')} kWh</td>
          <td style="text-align:center">${descontoMedio}%</td>
          <td style="text-align:right;color:#52b788">R$ ${brl(totalEconomia)}</td>
          <td style="text-align:right">R$ ${brl(totalFaturado)}</td>
          <td style="text-align:center">${totalCreditos.toLocaleString('pt-BR')} kWh</td>
          <td></td>
        </tr>
      </tfoot>
    </table>
  </div>

  <!-- Rodapé -->
  <div class="footer">
    <div class="footer-left">
      ACELIVRE — Energia Solar por Geração Compartilhada<br>
      Documento gerado automaticamente pelo sistema de backoffice
    </div>
    <div class="footer-right">
      Competência: ${competenciaExtenso(competencia)}<br>
      ${dataGeracao}
    </div>
  </div>

</div>
</body>
</html>`;

  // ── Gera PDF ──────────────────────────────────────────────────
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}