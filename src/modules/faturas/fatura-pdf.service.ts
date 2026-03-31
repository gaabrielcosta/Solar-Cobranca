import * as fs from 'fs';
import * as path from 'path';
import * as puppeteer from 'puppeteer';

// ─────────────────────────────────────────────
//  TIPOS
// ─────────────────────────────────────────────

export interface DadosFaturaPDF {
  // Fatura
  numero_fatura:         string;   // ex: "FAT-2026-0001"
  competencia:           string;   // "02/2026"
  data_emissao:          string;   // "DD/MM/YYYY"
  data_vencimento:       string;   // "DD/MM/YYYY" → convertido p/ extenso

  // Cliente
  cliente_nome:          string;
  cliente_cpf:           string;
  cliente_endereco:      string;
  uc_beneficiaria:       string;

  // kWh e tarifa (do parser)
  kwh_compensado:        number;   // kWh da usina
  tarifa_kwh:            number;   // tarifa GDII (cobrança ACELIVRE)
  tarifa_b1:             number;   // tarifa B1 Energisa (compensação)
  kwh_consumo_energisa:  number;   // consumo total do cliente na Energisa
  desconto_pct:          number;   // % desconto ACELIVRE (ex: 13)

  // Valores da fatura Energisa (do parser)
  cip_municipal:         number;
  outros_energisa:       number;   // multa + juros + atualização monetária + outros
  total_energisa:        number;
  saldo_credito:         number;   // 0 = sem saldo

  // PIX (opcional)
  pix_copia_cola?:       string;
}

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────

function brl(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function brlFmt(v: number): string {
  return `R$ ${brl(v)}`;
}

function dataExtenso(ddmmyyyy: string): string {
  if (!ddmmyyyy) return '';
  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                 'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const [dd, mm, yyyy] = ddmmyyyy.split('/');
  return `${parseInt(dd)} de ${meses[parseInt(mm) - 1]} de ${yyyy}`;
}

function competenciaExtenso(mmyyyy: string): string {
  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                 'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const [mm, yyyy] = mmyyyy.split('/');
  return `${meses[parseInt(mm) - 1]} / ${yyyy}`;
}

// ─────────────────────────────────────────────
//  GERADOR
// ─────────────────────────────────────────────

export async function gerarFaturaPDF(dados: DadosFaturaPDF): Promise<Buffer> {
  const html = renderizarHTML(dados);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      width: '210mm',
      height: '580px',
    })
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

// ─────────────────────────────────────────────
//  RENDERIZAÇÃO
// ─────────────────────────────────────────────

function renderizarHTML(d: DadosFaturaPDF): string {
  const tarifaB1   = d.tarifa_b1 && d.tarifa_b1 > 0 ? d.tarifa_b1 : d.tarifa_kwh;
  const tarifaFioB = parseFloat((d.tarifa_kwh - tarifaB1).toFixed(6));
  const temFioB    = tarifaFioB > 0.0001;

  // Cálculos Energisa
  const valorConsumoBruto = parseFloat((d.kwh_consumo_energisa * d.tarifa_kwh).toFixed(2));
  const valorCompensado   = parseFloat((d.kwh_compensado * tarifaB1).toFixed(2));
  const valorFioB         = parseFloat((d.kwh_compensado * tarifaFioB).toFixed(2));
  const valorIntegral     = parseFloat((valorConsumoBruto + d.cip_municipal + d.outros_energisa).toFixed(2));

  // Cálculos ACELIVRE — desconto sobre tarifa GDII
  const valorSemDesconto = parseFloat((d.kwh_compensado * d.tarifa_kwh).toFixed(2));
  const valorDesconto    = parseFloat((valorSemDesconto * d.desconto_pct / 100).toFixed(2));
  const valorFinal       = parseFloat((valorSemDesconto - valorDesconto).toFixed(2));

  // Linha Fio B (condicional)
  const fioBRow = temFioB
    ? `<tr class="info-row">
         <td>Fio B</td>
         <td style="text-align:right">${d.kwh_compensado.toLocaleString('pt-BR')} kWh</td>
         <td style="text-align:right">R$ ${brl(tarifaFioB)}</td>
         <td style="text-align:right">${brlFmt(valorFioB)}</td>
       </tr>`
    : '';

  // Linha de saldo (condicional)
  const saldoRow = d.saldo_credito > 0
    ? `<tr class="info-row">
         <td>Saldo de créditos utilizados</td>
         <td></td><td></td>
         <td style="text-align:right; color:var(--green-mid)">− ${brlFmt(d.saldo_credito)}</td>
       </tr>`
    : '';

  const template = fs.readFileSync(
    path.join(__dirname, '..', '..', '..', 'public', 'fatura_template.html'),
    'utf8'
  );

  const logoPath = path.join(__dirname, '..', '..', '..', 'public', 'acelivre_logo.png')
  const logoBase64 = `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`

  return template
    .replace(/{{LOGO_BASE64}}/g, logoBase64)
    // Identificação
    .replace(/{{NUMERO_FATURA}}/g,           d.numero_fatura)
    .replace(/{{COMPETENCIA}}/g,             competenciaExtenso(d.competencia))
    .replace(/{{DATA_EMISSAO}}/g,            d.data_emissao)
    .replace(/{{DATA_VENCIMENTO_EXTENSO}}/g, dataExtenso(d.data_vencimento))

    // Cliente
    .replace(/{{CLIENTE_NOME}}/g,            d.cliente_nome)
    .replace(/{{CLIENTE_CPF}}/g,             d.cliente_cpf)
    .replace(/{{CLIENTE_ENDERECO}}/g,        d.cliente_endereco)
    .replace(/{{UC_BENEFICIARIA}}/g,         d.uc_beneficiaria)

    // kWh
    .replace(/{{KWH_COMPENSADO}}/g,          d.kwh_compensado.toLocaleString('pt-BR'))
    .replace(/{{KWH_CONSUMO}}/g,             d.kwh_consumo_energisa.toLocaleString('pt-BR'))

    // Tarifas
    .replace(/{{TARIFA_KWH}}/g, d.tarifa_kwh.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 6 }))
    .replace(/{{TARIFA_B1}}/g,               brl(tarifaB1))
    .replace(/{{TARIFA_COM_DESCONTO}}/g,     brl(tarifaB1))
    .replace(/{{DESCONTO_PCT}}/g,            d.desconto_pct.toString())

    // Valores Energisa
    .replace(/{{VALOR_CONSUMO_BRUTO}}/g,     brlFmt(valorConsumoBruto))
    .replace(/{{VALOR_COMPENSADO}}/g,        brlFmt(valorCompensado))
    .replace(/{{FIO_B_ROW}}/g,               fioBRow)
    .replace(/{{CIP_MUNICIPAL}}/g,           brlFmt(d.cip_municipal))
    .replace(/{{OUTROS_ENERGISA}}/g,         brlFmt(d.outros_energisa))
    .replace(/{{TOTAL_ENERGISA}}/g,          brlFmt(d.total_energisa))
    .replace(/{{VALOR_INTEGRAL}}/g,          brlFmt(valorIntegral))
    .replace(/{{SALDO_ROW}}/g,               saldoRow)

    // Valores ACELIVRE
    .replace(/{{VALOR_SEM_DESCONTO}}/g,      brlFmt(valorSemDesconto))
    .replace(/{{VALOR_DESCONTO}}/g,          brlFmt(valorDesconto))
    .replace(/{{VALOR_FINAL}}/g,             brlFmt(valorFinal))
    .replace(/{{VALOR_FINAL_DISPLAY}}/g,     brlFmt(valorFinal))

    // PIX
    .replace(/{{PIX_COPIA_COLA}}/g,          d.pix_copia_cola || 'A configurar');
}