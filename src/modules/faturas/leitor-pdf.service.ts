import * as fs from 'fs';

// ─────────────────────────────────────────────
//  INTERFACES
// ─────────────────────────────────────────────

export interface DadosFaturaEnergisa {
  uc:                    string;
  competencia:           string;   // "MM/YYYY"
  data_leitura:          string;   // "DD/MM/YYYY" — data da leitura atual do medidor
  kwh_compensado:        number;
  tarifa_kwh:            number;   // tarifa GDII (usada para cobrar ACELIVRE)
  tarifa_b1:             number;   // tarifa B1 (usada pela Energisa para compensar)
  kwh_consumo_energisa:  number;
  cip:                   number;
  multa:                 number;   // multa + juros + atualização monetária
  outros:                number;
  saldo_credito:         number;
  total_fatura_energisa: number;
  data_vencimento:       string;   // "DD/MM/YYYY"
}

export interface RateioUC {
  uc:              string;
  percentual:      number;
  kwh_transferido: number;
  ciclo:           string;  // "MM/YYYY"
}

export interface DadosDemonstrativo {
  uc_geradora:         string;
  competencia:         string;   // "MM/YYYY"
  kwh_injetado:        number;
  saldo_anterior:      number;
  saldo_disponivel:    number;
  expiracao_creditos:  string;   // "MM/YYYY"
  beneficiarios:       RateioUC[];
}

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────

function parseBR(v: string): number {
  if (!v) return 0;
  return parseFloat(v.replace(/\./g, '').replace(',', '.')) || 0;
}

// Remove acentos para facilitar regex (unpdf às vezes embaralha encoding)
function semAcento(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// ─────────────────────────────────────────────
//  SERVIÇO
// ─────────────────────────────────────────────

export class LeitorPDFService {

  // ── Fatura do cliente ──────────────────────────────────────────

  async lerFatura(caminhoArquivo: string): Promise<DadosFaturaEnergisa> {
    const buffer = fs.readFileSync(caminhoArquivo);
    return this.lerFaturaBuffer(buffer);
  }

  async lerFaturaBuffer(buffer: Buffer): Promise<DadosFaturaEnergisa> {
    const { extractText } = await import('unpdf');
    const { text } = await extractText(new Uint8Array(buffer), { mergePages: true });
    const dados = this.extrairFatura(text);
    console.log('[PDF Fatura] Dados extraídos:', JSON.stringify(dados, null, 2));
    return dados;
  }

  private extrairFatura(texto: string): DadosFaturaEnergisa {
    return {
      uc:                    this.fatura_uc(texto),
      competencia:           this.fatura_competencia(texto),
      data_leitura:          this.fatura_dataLeitura(texto),
      kwh_compensado:        this.fatura_kwhCompensado(texto),
      tarifa_kwh:            this.fatura_tarifaKwh(texto),
      tarifa_b1:             this.fatura_tarifaB1(texto),
      kwh_consumo_energisa:  this.fatura_kwhConsumo(texto),
      cip:                   this.fatura_cip(texto),
      multa:                 this.fatura_multa(texto),
      outros:                0,
      saldo_credito:         this.fatura_saldo(texto),
      total_fatura_energisa: this.fatura_total(texto),
      data_vencimento:       this.fatura_vencimento(texto),
    };
  }

  // Data de leitura atual — "Leitura Atual:05/02/2026Leitura Anterior:07/01/2026"
private fatura_dataLeitura(texto: string): string {
  // No unpdf o texto fica: "05/02/2026Leitura Atual:07/01/2026Leitura Anterior:"
  // A data ANTES de "Leitura Atual:" é a leitura atual (mais recente)
  const m = texto.match(/(\d{2}\/\d{2}\/\d{4})Leitura\s+Atual:/i);
  if (m) return m[1];
  // Fallback: pega DEPOIS de "Leitura Atual:"
  const m2 = texto.match(/Leitura\s+Atual[:\s]+(\d{2}\/\d{2}\/\d{4})/i);
  return m2 ? m2[1] : '';
}

  // UC — "MATRÍCULA: 3647072-2026-2-1" → "3647072"
  private fatura_uc(texto: string): string {
    const m = texto.match(/MATR[IÍ]CULA:\s*(\d+)-\d{4}/i);
    if (m) return m[1];
    // Fallback: "10/3647072-2"
    const m2 = texto.match(/10\/(\d{6,8})-\d/);
    return m2 ? m2[1] : '';
  }

  // Competência e vencimento — unpdf junta tudo:
  // "18/02/2026 R$ 2.916,94Fevereiro / 2026"
  // Normaliza acentos e extrai os dois juntos
  private fatura_competencia(texto: string): string {
    const t = semAcento(texto);
    const meses: Record<string,string> = {
      janeiro:'01',fevereiro:'02',marco:'03',abril:'04',maio:'05',junho:'06',
      julho:'07',agosto:'08',setembro:'09',outubro:'10',novembro:'11',dezembro:'12',
    };
    const m = t.match(/\d{2}\/\d{2}\/\d{4}\s+R\$\s*[\d.,]+(Janeiro|Fevereiro|Marco|Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro)\s*\/\s*(20\d{2})/i);
    if (m) return `${meses[m[1].toLowerCase()]}/${m[2]}`;
    return '';
  }

  private fatura_vencimento(texto: string): string {
    const t = semAcento(texto);
    const m = t.match(/(\d{2}\/\d{2}\/\d{4})\s+R\$\s*[\d.,]+(Janeiro|Fevereiro|Marco|Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro)/i);
    return m ? m[1] : '';
  }

  // kWh compensados GDII — no unpdf aparecem como "2.520,00 2.520,00" perto de "chave de acesso"
  private fatura_kwhCompensado(texto: string): number {
    // Padrão 1: dois valores iguais consecutivos perto de "chave de acesso"
    const idx = texto.indexOf('chave de acesso');
    if (idx >= 0) {
      const bloco = texto.substring(idx, idx + 100);
      const m = bloco.match(/([\d.]+,\d{2})\s+\1/);
      if (m) return parseBR(m[1]);
    }
    // Padrão 2: qualquer par de valores iguais >= 100,00
    const m2 = texto.match(/\b(\d{1,3}(?:\.\d{3})+,\d{2})\s+\1\b/);
    if (m2) return parseBR(m2[1]);
    return 0;
  }

  // Tarifa kWh GDII — 1,092920
  // Problema unpdf: tarifa aparece colada ao valor anterior: "839,371,092920"
  // Padrão colado: \d+,\d{2}(\d+,\d{6}) → captura a tarifa do sufixo
  private fatura_tarifaKwh(texto: string): number {
    const idxConsumo = texto.indexOf('Consumo em kWh');
    const bloco = idxConsumo >= 0
      ? texto.substring(idxConsumo, idxConsumo + 500)
      : texto;

    // Padrão 1: tarifa colada após valor de 2 decimais — "839,371,092920" → captura "1,092920"
    const colado = bloco.match(/\d+,\d{2}(\d+,\d{6})/);
    if (colado) return parseBR(colado[1]);

    // Padrão 2: tarifa isolada precedida por espaço
    const isolado = [...bloco.matchAll(/ (\d{1,2},\d{6})/g)].map(m => parseBR(m[1]));
    if (isolado.length > 0) return Math.max(...isolado);

    // Padrão 3: após "Ajuste GDII"
    const idxAjuste = texto.search(/Ajuste\s+GD\s*II/i);
    if (idxAjuste >= 0) {
      const b = texto.substring(idxAjuste, idxAjuste + 300);
      const m = b.match(/\d+,\d{2}(\d+,\d{6})/) || b.match(/ (\d{1,2},\d{6})/);
      if (m) return parseBR(m[1]);
    }

    return 0;
  }

  // Consumo total em kWh — "4.349,00" aparece em "KWH Ponta 4.349,0065.973,00 4.349,001,00..."
  // Ou busca pelo medidor: "Energia ativa em kWh Ponta ... 4349"
  private fatura_kwhConsumo(texto: string): number {
    // Padrão 1: "Energia ativa em kWh Ponta leitura_ant leitura_at k consumo"
    // texto: "PontaEnergia ativa em kWh 1 43496597361624" → consumo=4349
    const m = texto.match(/Energia\s+ativa\s+em\s+kWh\s+\w+\s+\d+\s+(\d+)(\d{5})\d+/i);
    if (m) return parseInt(m[1]);
    // Padrão 2: "4.349,00" isolado perto do fim (linha do boleto)
    const m2 = texto.match(/\b([\d.]+,00)\s+Protocolo/i);
    if (m2) return parseBR(m2[1]);
    return 0;
  }

  // Tarifa B1 — primeira tarifa com 6 decimais no bloco "Consumo em kWh" (menor valor)
  private fatura_tarifaB1(texto: string): number {
    const idxConsumo = texto.indexOf('Consumo em kWh');
    if (idxConsumo >= 0) {
      const bloco = texto.substring(idxConsumo, idxConsumo + 200);
      // Pega o primeiro número com 6 decimais isolado (precedido por espaço)
      const m = bloco.match(/ (\d+,\d{6})/);
      if (m) return parseBR(m[1]);
    }
    return 0;
  }
  // Texto bruto: "Consumo em kWh 0,878100 -527,73 65,37 0,209180 125,71 839,371,092920 ..."
  // Valores positivos com 2 decimais: [0]=527,73 [1]=65,37 [2]=125,71 [3]=839,37
  // CIP = nums[1] (segundo valor positivo)
  // Multa/juros só existem se houver atraso — busca por label explícito no texto
  private fatura_valoresSequencia(texto: string): { juros: number; atualizacao: number; multa: number; cip: number } {
    const idx = texto.indexOf('Consumo em kWh');
    if (idx < 0) return { juros: 0, atualizacao: 0, multa: 0, cip: 0 };
    const bloco = texto.substring(idx, idx + 400);

    // Pega valores positivos com exatamente 2 decimais (exclui tarifas com 6 decimais)
    const nums = [...bloco.matchAll(/(?<![,\d])(\d{1,3}(?:\.\d{3})?,\d{2})(?!\d)/g)]
      .map(m => parseBR(m[1]))
      .filter(v => v > 0);

    // CIP é o segundo valor positivo na sequência
    const cip = nums[1] || 0;

    // Multa/juros: só cobrados em atraso — busca label explícito
    const multa_m = texto.match(/Multa\s+[^R\d]*([\d.]+,\d{2})/i);
    const juros_m = texto.match(/Juros\s+[^R\d]*([\d.]+,\d{2})/i);
    const multa = multa_m ? parseBR(multa_m[1]) : 0;
    const juros = juros_m ? parseBR(juros_m[1]) : 0;

    return { juros, atualizacao: 0, multa, cip };
  }

  private fatura_cip(texto: string): number {
    return this.fatura_valoresSequencia(texto).cip;
  }

  private fatura_multa(texto: string): number {
    const { juros, atualizacao, multa } = this.fatura_valoresSequencia(texto);
    return parseFloat((juros + atualizacao + multa).toFixed(2));
  }

  // Saldo acumulado
  private fatura_saldo(texto: string): number {
    const m = texto.match(/Saldo\s+Acumulado:\s*(\d+)/i);
    return m ? parseInt(m[1]) : 0;
  }

  // Total da fatura — pega do boleto: "109/56785924-4 2.916,94"
  private fatura_total(texto: string): number {
    const m = texto.match(/\d{3}\/\d+[-\d]+\s+([\d.]+,\d{2})\s/);
    if (m) return parseBR(m[1]);
    // Fallback: valor após VENCIMENTO no boleto
    const m2 = texto.match(/VENCIMENTO\s*\)?\s*([\d.]+,\d{2})/i);
    return m2 ? parseBR(m2[1]) : 0;
  }

  // ── Demonstrativo de Compensação da Usina ─────────────────────

  async lerDemonstrativo(caminhoArquivo: string): Promise<DadosDemonstrativo> {
    const buffer = fs.readFileSync(caminhoArquivo);
    return this.lerDemonstrativoBuffer(buffer);
  }

  async lerDemonstrativoBuffer(buffer: Buffer): Promise<DadosDemonstrativo> {
    const { extractText } = await import('unpdf');
    const { text } = await extractText(new Uint8Array(buffer), { mergePages: true });
    const dados = this.extrairDemonstrativo(text);
    console.log('[PDF Demonstrativo] Dados extraídos:', JSON.stringify(dados, null, 2));
    return dados;
  }

  private extrairDemonstrativo(texto: string): DadosDemonstrativo {
    return {
      uc_geradora:        this.dem_ucGeradora(texto),
      competencia:        this.dem_competencia(texto),
      kwh_injetado:       this.dem_kwhInjetado(texto),
      saldo_anterior:     this.dem_saldoAnterior(texto),
      saldo_disponivel:   this.dem_saldoDisponivel(texto),
      expiracao_creditos: this.dem_expiracao(texto),
      beneficiarios:      this.dem_rateios(texto),
    };
  }

  // UC Geradora — "UC: 10/3652109-4" → "3652109"
  private dem_ucGeradora(texto: string): string {
    const m = texto.match(/UC:\s*(?:10\/)?(\d+)(?:-\d+)?/);
    return m ? m[1] : '';
  }

  // Referência — "Referência: 02/2026" → "02/2026"
  private dem_competencia(texto: string): string {
    const m = texto.match(/Referência:\s*(\d{2}\/\d{4})/);
    return m ? m[1] : '';
  }

  // kWh injetado no mês — tabela Consumo Convencional, coluna "Injetado"
  // Linha: "2026 02 100 0 5012 0 5012 100"
  // Colunas: Ano Mês Med.KWh Irr. Injetado Injet.Comp. Sobra Bruto
  private dem_kwhInjetado(texto: string): number {
    const comp = this.dem_competencia(texto); // "MM/YYYY"
    if (!comp) return 0;
    const [mes, ano] = comp.split('/');
    // Linha começa com "YYYY MM" e tem o injetado na 5ª coluna
    const re = new RegExp(`${ano}\\s+0?${parseInt(mes)}\\s+\\d+\\s+\\d+\\s+(\\d+)`);
    const m = texto.match(re);
    return m ? parseInt(m[1]) : 0;
  }

  // Saldo anterior GD II Conv — tabela Movimentações
  // Linha: "GD II 12845 5012 0 0 5012 0 12845 0  02/2031"
  // Colunas: Saldo_Ant Injetado Recebido Compensado Transferido Expirado Disponivel Consumo
  private dem_saldoAnterior(texto: string): number {
    // Pega a primeira linha "GD II" com números (seção Conv)
    const m = texto.match(/GD\s+II\s+(\d+)\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+/);
    return m ? parseInt(m[1]) : 0;
  }

  // Saldo disponível GD II Conv — 7ª coluna da linha GD II
  private dem_saldoDisponivel(texto: string): number {
    const m = texto.match(/GD\s+II\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+(\d+)/);
    return m ? parseInt(m[1]) : 0;
  }

  // Data de expiração dos créditos — "02/2031" no final da linha GD II
  private dem_expiracao(texto: string): string {
    const m = texto.match(/GD\s+II[\d\s]+(\d{2}\/\d{4})/);
    return m ? m[1] : '';
  }

  // Rateios por UC — seção "Discriminação das Transferências"
  // Linha: "31 2947736 0 -1553 0 0 0 0 0 0 0 0 0 0 02/2026"
  // Colunas: % | UC | GDI_conv | GDII_conv(negativo=kWh transferido) | ... | MM/YYYY
  private dem_rateios(texto: string): RateioUC[] {
    const rateios: RateioUC[] = [];

    const inicio = texto.indexOf('Discriminação das Transferências');
    if (inicio < 0) return rateios;

    const totalIdx = texto.indexOf('TOTAL', inicio);
    const secao = texto.substring(inicio, totalIdx > 0 ? totalIdx : inicio + 2000);

    // Regex global — busca padrão diretamente no bloco, sem depender de \n
    // "6 378596 0 -300 0 0 0 0 0 0 0 0 0 0 02/2026"
    // Grupo 1: %  Grupo 2: UC  Grupo 3: GDII_conv (negativo)  Grupo 4: ciclo MM/YYYY
    const re = /\b(\d{1,3})\s+(\d{5,8})\s+0\s+(-\d+)\s+[\d\s-]+?(\d{2}\/\d{4})/g;
    let m: RegExpExecArray | null;

    while ((m = re.exec(secao)) !== null) {
      const percentual      = parseInt(m[1]);
      const uc              = m[2];
      const kwh_transferido = Math.abs(parseInt(m[3]));
      const ciclo           = m[4];

      if (uc && kwh_transferido > 0) {
        rateios.push({ uc, percentual, kwh_transferido, ciclo });
      }
    }

    return rateios;
  }
}