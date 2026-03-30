import * as fs from 'fs';
import * as path from 'path';
import { Fatura } from './fatura.entity';

const TEMPLATE_PATH = path.join(__dirname, '../../../public/fatura_template.html');

function brl(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function brlSemSifrao(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatarData(d: Date): string {
  return parseDateSemFuso(d).toLocaleDateString('pt-BR');
}

function formatarDataExtenso(d: Date): string {
  return parseDateSemFuso(d).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function parseDateSemFuso(d: Date | string): Date {
  // Evita conversão de fuso — interpreta a data como local
  const str = typeof d === 'string' ? d : d.toISOString();
  const [ano, mes, dia] = str.substring(0, 10).split('-').map(Number);
  return new Date(ano, mes - 1, dia);
}

function formatarCompetencia(d: Date): string {
  const dt = parseDateSemFuso(d);
  return dt.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
    .replace('.', '').replace(/^\w/, c => c.toUpperCase());
}

function formatarCpf(cpf: string): string {
  const n = cpf.replace(/\D/g, '');
  if (n.length === 11) return n.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (n.length === 14) return n.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return cpf;
}

function numeroFatura(id: string): string {
  const hash = id.replace(/-/g, '').substring(0, 8).toUpperCase();
  return `#${hash}`;
}

function montarEndereco(cliente: any): string {
  const partes = [];
  if (cliente.logradouro) {
    let rua = cliente.logradouro;
    if (cliente.numero) rua += `, ${cliente.numero}`;
    if (cliente.complemento) rua += ` — ${cliente.complemento}`;
    partes.push(rua);
  }
  const cidade = [cliente.cidade, cliente.estado_endereco].filter(Boolean).join(' — ');
  if (cidade) partes.push(cidade + (cliente.cep ? `, ${cliente.cep}` : ''));
  return partes.join('<br>') || 'Endereço não informado';
}

function valorFinalDisplay(valor: number): string {
  const str = brlSemSifrao(valor);
  const [int, dec] = str.split(',');
  return `R$ ${int}<span style="font-size:18px">,${dec}</span>`;
}

export class FaturaHtmlService {

  gerarHtml(fatura: Fatura): string {
    let template = fs.readFileSync(TEMPLATE_PATH, 'utf-8');

    const benef   = (fatura as any).beneficiario;
    const cliente = benef?.cliente || {};
    const usina   = benef?.usina   || {};

    const valor          = Number(fatura.valor);
    const valorBruto     = Number(fatura.valor_sem_desconto);
    const valorDesconto  = Number(fatura.valor_desconto);
    const descontoPct    = Number(fatura.desconto_percentual);
    const kwh            = Number(fatura.kwh_alocado);
    const tarifa         = Number(fatura.tarifa_kwh);
    const vencimento     = parseDateSemFuso(fatura.data_vencimento as any);
    const competencia    = parseDateSemFuso(fatura.competencia as any);
    const emissao        = new Date(fatura.created_at || new Date());

    const pixCode = fatura.pix_copia_cola || '00020126580014br.gov.bcb.pix013600000000-0000-0000-0000-000000000000520400005303986540' + valor.toFixed(2).replace('.','') + '5802BR5913ACELIVRE6013Campo Grande62140510' + fatura.id.substring(0,10) + '6304ABCD';

    // Campos calculados para o detalhamento
    const kwhConsumo       = Number((fatura as any).kwh_consumo_energisa || 0);
    const tarifaComDesconto = parseFloat((tarifa * (1 - descontoPct / 100)).toFixed(6));
    const valorCompensado  = parseFloat((kwh * tarifaComDesconto).toFixed(2));
    const valorConsumoBruto = parseFloat((kwhConsumo * tarifa).toFixed(2));
    const cip              = Number((fatura as any).cip_municipal || 0);
    const outros           = Number((fatura as any).outros_energisa || 0);
    const saldo            = Number((fatura as any).saldo_credito || 0);
    const totalEnergisa    = Number((fatura as any).total_fatura_energisa || 0);
    // Valor integral = consumo bruto + CIP + outros (sem a compensação)
    const valorIntegral    = parseFloat((valorConsumoBruto + cip + outros).toFixed(2));

    const saldoRow = saldo > 0
      ? `<tr class="info-row"><td>Saldo de créditos</td><td style="text-align:right">${saldo.toLocaleString('pt-BR')} kWh</td><td></td><td></td></tr>`
      : '';

    const replacements: Record<string, string> = {
      '{{NUMERO_FATURA}}':          numeroFatura(fatura.id),
      '{{DATA_EMISSAO}}':           formatarData(emissao),
      '{{COMPETENCIA}}':            formatarCompetencia(competencia),
      '{{DATA_VENCIMENTO}}':        formatarData(vencimento),
      '{{DATA_VENCIMENTO_EXTENSO}}': formatarDataExtenso(vencimento),
      '{{CLIENTE_NOME}}':           cliente.nome || 'Cliente',
      '{{CLIENTE_ENDERECO}}':       montarEndereco(cliente),
      '{{CLIENTE_CPF}}':            formatarCpf(cliente.cpf_cnpj || ''),
      '{{UC_BENEFICIARIA}}':        benef?.uc_beneficiaria || '—',
      '{{USINA_NOME}}':             usina.nome || '—',
      '{{KWH_COMPENSADO}}':         kwh.toLocaleString('pt-BR'),
      '{{KWH_ALOCADO}}':            kwh.toLocaleString('pt-BR'),
      '{{KWH_CONSUMO}}':            kwhConsumo.toLocaleString('pt-BR'),
      '{{TARIFA_KWH}}':             tarifa.toLocaleString('pt-BR', { minimumFractionDigits: 4 }),
      '{{TARIFA_COM_DESCONTO}}':    tarifaComDesconto.toLocaleString('pt-BR', { minimumFractionDigits: 4 }),
      '{{VALOR_SEM_DESCONTO}}':     brl(valorBruto),
      '{{VALOR_DESCONTO}}':         brl(valorDesconto),
      '{{VALOR_FINAL}}':            brl(valor),
      '{{VALOR_FINAL_DISPLAY}}':    valorFinalDisplay(valor),
      '{{DESCONTO_PCT}}':           descontoPct.toString(),
      '{{VALOR_COMPENSADO}}':       brl(valorCompensado),
      '{{VALOR_CONSUMO_BRUTO}}':    brl(valorConsumoBruto),
      '{{VALOR_INTEGRAL}}':         brl(valorIntegral),
      '{{CIP_MUNICIPAL}}':          brl(cip),
      '{{OUTROS_ENERGISA}}':        brl(outros),
      '{{TOTAL_ENERGISA}}':         brl(totalEnergisa),
      '{{SALDO_ROW}}':              saldoRow,
      '{{PIX_COPIA_COLA}}':         pixCode,
    };

    for (const [key, val] of Object.entries(replacements)) {
      template = template.split(key).join(val);
    }

    return template;
  }
}