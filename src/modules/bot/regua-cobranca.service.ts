import * as cron from 'node-cron';
import { AppDataSource } from '../../database/data-source';
import { Fatura, StatusFatura } from '../faturas/fatura.entity';
import { EventoCobranca } from './evento-cobranca.entity';
import { BotConfig } from './bot-config.entity';
import { logService } from '../logs/log.service';
import { LessThan, In } from 'typeorm';

export type TipoEvento =
  | 'fatura_enviada' | 'fatura_visualizada' | 'pix_gerado' | 'boleto_gerado'
  | 'pagamento_confirmado' | 'comprovante_recebido' | 'negociacao_iniciada'
  | 'acordo_fechado' | 'escalonado_humano' | 'sem_resposta_7dias'
  | 'aviso_d5' | 'aviso_d0' | 'aviso_d1' | 'aviso_d3' | 'aviso_d7' | 'aviso_d15'
  | 'multa_aplicada' | 'status_atualizado';

const MSGS_PADRAO: Record<string, string> = {
  msg_aviso_d5:
    `Olá, *{nome}*! 👋 Mensagem automática da ACELIVRE.\n\n` +
    `Sua fatura de *{mes_ano}* está disponível:\n` +
    `📍 {uc_label}\n` +
    `☀️ {kwh} kWh de energia solar compensados\n` +
    `💸 Desconto de {desc}% — economia de R$ {eco}\n` +
    `💰 Valor: R$ {val}\n` +
    `📅 Vence em {vencimento}\n\n` +
    `Quando efetuar o pagamento, responda *PAGUEI*. 😊`,
  msg_aviso_d0:
    `Olá, *{nome}*! Lembrete: sua fatura vence *hoje*.\n` +
    `📍 {uc_label}\n` +
    `💰 Valor: R$ {val}\n\n` +
    `Já pagou? Responde *PAGUEI* que registramos aqui!`,
  msg_aviso_d1:
    `Oi, *{nome}*! Sua fatura de *{mes_ano}* ainda consta em aberto.\n` +
    `📍 {uc_label}\n` +
    `☀️ {kwh} kWh compensados\n\n` +
    `Quando efetuar o pagamento, responde *PAGUEI*.\n` +
    `Dúvidas? Entre em contato pelo {tel}.`,
  msg_aviso_d3:
    `*{nome}*, sua fatura de *{mes_ano}* ainda está em aberto.\n` +
    `📍 {uc_label}\n` +
    `☀️ {kwh} kWh compensados\n\n` +
    `Quando realizar o pagamento, responde *PAGUEI*.\n` +
    `Dúvidas? {tel}`,
  msg_aviso_d7:
    `*{nome}*, sua fatura de *{mes_ano}* segue em aberto.\n` +
    `📍 {uc_label}\n` +
    `☀️ {kwh} kWh compensados\n\n` +
    `Efetuou o pagamento? Responde *PAGUEI*.\n` +
    `Precisa de ajuda? {tel}`,
  msg_aviso_d15:
    `*{nome}*, sua fatura de *{mes_ano}* ainda não foi quitada.\n` +
    `📍 {uc_label}\n` +
    `☀️ {kwh} kWh compensados\n\n` +
    `Responde *PAGUEI* se já quitou, ou entre em contato pelo {tel}.`,
};

interface SessaoCliente { faturaIds: string[]; expiraEm: number; }
const sessoes = new Map<string, SessaoCliente>();
function salvarSessao(telefone: string, faturaIds: string[]): void { sessoes.set(telefone, { faturaIds, expiraEm: Date.now() + 10 * 60 * 1000 }); }
function buscarSessao(telefone: string): SessaoCliente | null { const s = sessoes.get(telefone); if (!s) return null; if (Date.now() > s.expiraEm) { sessoes.delete(telefone); return null; } return s; }
function limparSessao(telefone: string): void { sessoes.delete(telefone); }

function hoje(): Date { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function diffDias(a: Date, b: Date): number { return Math.floor((b.getTime() - a.getTime()) / 86_400_000); }
function brl(v: number): string { return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtVencCurto(data: any): string { const d = new Date(data + 'T12:00:00'); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`; }
function fmtVencLongo(data: any): string { const d = new Date(data + 'T12:00:00'); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`; }
function enderecoFatura(fatura: Fatura): string { const cl = fatura.beneficiario?.cliente; return [cl?.logradouro, cl?.numero].filter(Boolean).join(', '); }
function labelFatura(fatura: Fatura): string { const uc = fatura.beneficiario?.uc_beneficiaria || '—'; const end = enderecoFatura(fatura); const val = brl(Number(fatura.valor)); const venc = fmtVencCurto(fatura.data_vencimento); return `UC ${uc}${end ? ` · ${end}` : ''} — R$ ${val} · vence ${venc}`; }

async function getMensagem(chave: string, vars: Record<string, string>): Promise<string> {
  let template = MSGS_PADRAO[chave] || '';
  try {
    const config = await AppDataSource.getRepository(BotConfig).findOneBy({ chave });
    if (config?.valor) template = config.valor;
  } catch (_) {}
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

export class RegraCobrancaService {

  async registrarEvento(faturaId: string, tipo: TipoEvento, dados?: Record<string, any>): Promise<void> {
    try { const repo = AppDataSource.getRepository(EventoCobranca); await repo.save(repo.create({ fatura_id: faturaId, tipo, dados: dados || {} })); }
    catch (e) { console.error('[REGUA] Erro ao registrar evento:', e); }
  }

  async ultimoEvento(faturaId: string, tipo: TipoEvento): Promise<EventoCobranca | null> {
    return AppDataSource.getRepository(EventoCobranca).findOne({ where: { fatura_id: faturaId, tipo }, order: { created_at: 'DESC' } });
  }

  async eventoDispararadoHoje(faturaId: string, tipo: TipoEvento): Promise<boolean> {
    const ev = await this.ultimoEvento(faturaId, tipo);
    if (!ev) return false;
    const d = new Date(ev.created_at); d.setHours(0, 0, 0, 0);
    return d.getTime() === hoje().getTime();
  }

  calcularEncargos(valorOriginal: number, diasAtraso: number) {
    const multa = valorOriginal * 0.02; const juros = valorOriginal * 0.01 * (diasAtraso / 30); const total = parseFloat((valorOriginal + multa + juros).toFixed(2));
    return { multa: parseFloat(multa.toFixed(2)), juros: parseFloat(juros.toFixed(2)), total, opcoes_parcelamento: [{ descricao: 'À vista com desconto de 5%', parcelas: 1, valor_parcela: parseFloat((total * 0.95).toFixed(2)), total: parseFloat((total * 0.95).toFixed(2)) }, { descricao: '2x sem juros', parcelas: 2, valor_parcela: parseFloat((total / 2).toFixed(2)), total }, { descricao: '3x com juros de 2%', parcelas: 3, valor_parcela: parseFloat(((total * 1.02) / 3).toFixed(2)), total: parseFloat((total * 1.02).toFixed(2)) }] };
  }

  private async enviarWhatsApp(telefone: string, texto: string): Promise<boolean> {
    const url = process.env.EVOLUTION_API_URL; const apiKey = process.env.EVOLUTION_API_KEY; const instance = process.env.EVOLUTION_INSTANCE;
    if (!url || !apiKey || !instance) { console.log('[WHATSAPP] Não configurado.'); return false; }
    const numero = telefone.replace(/\D/g, ''); if (numero.length < 10) return false;
    const jid = numero.startsWith('55') ? `${numero}@s.whatsapp.net` : `55${numero}@s.whatsapp.net`;
    try {
      const resp = await fetch(`${url}/message/sendText/${instance}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': apiKey }, body: JSON.stringify({ number: jid, text: texto }) });
      if (!resp.ok) { console.error(`[WHATSAPP] Erro ${resp.status}: ${await resp.text()}`); return false; }
      console.log(`[WHATSAPP] Texto enviado para ${jid}`); return true;
    } catch (e) { console.error('[WHATSAPP] Erro:', e); return false; }
  }

  private async enviarBotoes(telefone: string, titulo: string, corpo: string, rodape: string, botoes: Array<{ id: string; texto: string }>): Promise<boolean> {
    const url = process.env.EVOLUTION_API_URL; const apiKey = process.env.EVOLUTION_API_KEY; const instance = process.env.EVOLUTION_INSTANCE;
    if (!url || !apiKey || !instance) { console.log('[WHATSAPP] Não configurado.'); return false; }
    const numero = telefone.replace(/\D/g, ''); if (numero.length < 10) return false;
    const jid = numero.startsWith('55') ? `${numero}@s.whatsapp.net` : `55${numero}@s.whatsapp.net`;
    try {
      let resp = await fetch(`${url}/message/sendButtons/${instance}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': apiKey }, body: JSON.stringify({ number: jid, title: titulo, description: corpo, footer: rodape, buttons: botoes.map(b => ({ type: 'reply', displayText: b.texto, id: b.id })) }) });
      if (!resp.ok) { resp = await fetch(`${url}/message/sendButtons/${instance}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': apiKey }, body: JSON.stringify({ number: jid, buttonMessage: { title: titulo, description: corpo, footer: rodape, buttons: botoes.map(b => ({ buttonId: b.id, buttonText: { displayText: b.texto }, type: 1 })), headerType: 1 } }) }); }
      if (!resp.ok) { console.warn('[WHATSAPP] Botões não suportados — texto simples'); return this.enviarWhatsApp(telefone, `${titulo}\n\n${corpo}\n\n${botoes.map(b => `👉 Responda *${b.id}*`).join('\n')}\n\n${rodape}`); }
      console.log(`[WHATSAPP] Botões enviados para ${jid}`); return true;
    } catch (e) { console.error('[WHATSAPP] Erro botões:', e); return false; }
  }

  private async enviarPixFatura(telefone: string, fatura: Fatura, nomeCliente: string): Promise<void> {
    const tel = '(67) 9 9236-0220'; const uc = fatura.beneficiario?.uc_beneficiaria || '—'; const end = enderecoFatura(fatura); const ucLabel = `UC ${uc}${end ? ` · ${end}` : ''}`;
    if (fatura.pix_copia_cola) {
      await this.enviarWhatsApp(telefone, `Segue o PIX da *${ucLabel}*:\n\n💰 R$ ${brl(Number(fatura.valor))} · vence ${fmtVencLongo(fatura.data_vencimento)}\n\n*Código PIX (copia e cola):*\n\`\`\`${fatura.pix_copia_cola}\`\`\`\n\nApós pagar, responda *PAGUEI* para confirmarmos. 😊`);
      await this.registrarEvento(fatura.id, 'pix_gerado', { telefone, solicitado_pelo_cliente: true });
    } else {
      await this.enviarWhatsApp(telefone, `Olá, *${nomeCliente}*! 😊\n\nAinda não temos o código PIX disponível para *${ucLabel}*.\nEntre em contato pelo ${tel}.`);
    }
  }

  private async dispararMensagem(fatura: Fatura, etapa: TipoEvento): Promise<void> {
    const b = fatura.beneficiario; const cl = b?.cliente; if (!cl) return;
    const nomeMes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const comp = new Date((fatura.competencia as any)+'T12:00:00');
    const mesAno = `${nomeMes[comp.getMonth()]}/${comp.getFullYear()}`;
    const venc = new Date((fatura.data_vencimento as any)+'T12:00:00');
    const vencFmt = `${String(venc.getDate()).padStart(2,'0')}/${String(venc.getMonth()+1).padStart(2,'0')}/${venc.getFullYear()}`;
    const end = [cl.logradouro, cl.numero].filter(Boolean).join(', ');

    const vars: Record<string, string> = {
      nome:       cl.nome.split(' ')[0],
      mes_ano:    mesAno,
      uc_label:   `UC ${b.uc_beneficiaria}${end ? ` · ${end}` : ''}`,
      kwh:        Number(fatura.kwh_alocado).toFixed(0),
      desc:       String(Number(fatura.desconto_percentual)),
      eco:        brl(Number(fatura.valor_desconto)),
      val:        brl(Number(fatura.valor)),
      vencimento: vencFmt,
      tel:        '(67) 9 9236-0220',
    };

    const chave = `msg_${etapa}`;
    const texto = await getMensagem(chave, vars);
    if (!texto) return;

    let enviado = false;
    if (cl.telefone) { enviado = await this.enviarWhatsApp(cl.telefone, texto); }
    else { console.warn(`[REGUA] ${cl.nome} sem telefone — mensagem não enviada`); }

    console.log(`[REGUA] ${etapa.toUpperCase()} → ${cl.nome} (${cl.telefone || 'sem tel'}) — ${enviado ? '✓' : '✗'}\n${texto}\n`);
    await this.registrarEvento(fatura.id, etapa, { cliente: cl.nome, telefone: cl.telefone, valor: Number(fatura.valor), mensagem: texto, whatsapp_enviado: enviado });
    await logService.registrar({ acao: `COBRANCA_${etapa.toUpperCase()}`, descricao: `${etapa} → ${cl.nome} — R$ ${brl(Number(fatura.valor))} — WhatsApp: ${enviado ? 'enviado' : 'não enviado'}`, entidade: 'fatura', entidade_id: fatura.id, cliente_nome: cl.nome });
  }

  async processarResposta(telefone: string, mensagem: string): Promise<void> {
    const texto = mensagem.trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const tel = '(67) 9 9236-0220';

    const sessao = buscarSessao(telefone);
    if (sessao) {
      const num = parseInt(texto);
      if (!isNaN(num) && num >= 1 && num <= sessao.faturaIds.length) {
        limparSessao(telefone);
        const fatura = await AppDataSource.getRepository(Fatura).findOne({ where: { id: sessao.faturaIds[num - 1] }, relations: ['beneficiario', 'beneficiario.cliente'] });
        if (fatura) { const nome = fatura.beneficiario?.cliente?.nome?.split(' ')[0] || ''; await this.enviarPixFatura(telefone, fatura, nome); }
        return;
      }
      limparSessao(telefone);
    }

    const clicouUC = texto.startsWith('BTN_UC_') ? texto.replace('BTN_UC_', '') : null;
    const clicouPaguei = texto === 'BTN_PAGUEI';
    const clicouPix = texto === 'BTN_PIX';
    const pedindoPix = clicouPix || clicouUC !== null || texto.includes('PIX') || texto.includes('CODIGO') || texto.includes('COPIA') || texto.includes('SEGUNDA VIA') || texto.includes('2 VIA') || texto.includes('BOLETO') || texto.includes('PAGAR') || texto.includes('COMO PAGO') || texto.includes('COMO PAGAR');
    const confirmandoPagamento = clicouPaguei || texto === 'PAGUEI' || texto === 'JA PAGUEI' || texto.includes('PAGUEI') || texto.includes('JA PAGUEI') || texto.includes('EFETUEI') || texto.includes('REALIZEI O PAGAMENTO') || texto.includes('FIZ O PAGAMENTO');
    const naoReconhecida = !pedindoPix && !confirmandoPagamento;

    const numero = telefone.replace(/\D/g, '');
    const benefs = await AppDataSource.query(`SELECT b.id, b.uc_beneficiaria, c.nome, c.telefone, c.logradouro, c.numero as num_end FROM beneficiarios b JOIN clientes c ON c.id = b.cliente_id WHERE REGEXP_REPLACE(c.telefone, '[^0-9]', '', 'g') LIKE $1 AND b.ativo = true`, [`%${numero.slice(-8)}`]);
    if (!benefs.length) { console.warn(`[BOT] Telefone ${telefone} não encontrado`); return; }

    const faturas = await AppDataSource.getRepository(Fatura).find({ where: { beneficiario: { id: In(benefs.map((b: any) => b.id)) }, status: In([StatusFatura.PENDENTE, StatusFatura.ATRASADA]) }, order: { data_vencimento: 'ASC' }, relations: ['beneficiario', 'beneficiario.cliente'] });
    const nomeCliente = benefs[0].nome.split(' ')[0];

    if (!faturas.length) { if (pedindoPix || naoReconhecida) { await this.enviarWhatsApp(telefone, `Olá, *${nomeCliente}*! 😊\n\nNão encontrei nenhuma fatura em aberto para você.\nDúvidas? Entre em contato pelo ${tel}.`); } return; }

    if (confirmandoPagamento) {
      const fatura = faturas.length === 1 ? faturas[0] : faturas[faturas.length - 1];
      await this.registrarEvento(fatura.id, 'comprovante_recebido', { telefone, mensagem_original: mensagem, aguardando_confirmacao: true });
      await logService.registrar({ acao: 'PAGUEI_RECEBIDO', descricao: `${benefs[0].nome} informou pagamento via WhatsApp — aguardando confirmação manual`, entidade: 'fatura', entidade_id: fatura.id, cliente_nome: benefs[0].nome });
      await this.enviarWhatsApp(telefone, `Obrigado, *${nomeCliente}*! 😊\n\nRecebemos sua confirmação e vamos verificar o pagamento em breve.\nQualquer dúvida, entre em contato pelo ${tel}.`);
      console.log(`[BOT] PAGUEI registrado para ${benefs[0].nome} — fatura ${fatura.id}`); return;
    }

    if (clicouUC) { const fatura = faturas.find(f => f.beneficiario?.uc_beneficiaria === clicouUC); if (fatura) await this.enviarPixFatura(telefone, fatura, nomeCliente); return; }

    if (pedindoPix || naoReconhecida) {
      if (faturas.length === 1) {
        const f = faturas[0];
        if (naoReconhecida) { await this.enviarBotoes(telefone, `☀️ ACELIVRE — Olá, *${nomeCliente}*!`, `Você tem uma fatura em aberto:\n${labelFatura(f)}\n\nComo posso te ajudar?`, 'ACELIVRE Energia Solar', [{ id: 'BTN_PIX', texto: '💰 Ver código PIX' }, { id: 'BTN_PAGUEI', texto: '✅ Já efetuei o pagamento' }]); }
        else { await this.enviarPixFatura(telefone, f, nomeCliente); }
        return;
      }
      if (faturas.length <= 3) {
        const lista = faturas.map(f => labelFatura(f)).join('\n');
        await this.enviarBotoes(telefone, `☀️ ACELIVRE — Olá, *${nomeCliente}*!`, `Você tem *${faturas.length} faturas em aberto*. Qual deseja pagar?\n\n${lista}`, 'ACELIVRE Energia Solar', faturas.map(f => ({ id: `BTN_UC_${f.beneficiario?.uc_beneficiaria}`, texto: `UC ${f.beneficiario?.uc_beneficiaria} — R$ ${brl(Number(f.valor))}` })));
        salvarSessao(telefone, faturas.map(f => f.id)); return;
      }
      const emojis = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣'];
      const lista = faturas.map((f, i) => `${emojis[i] || `${i+1}.`} ${labelFatura(f)}`).join('\n');
      await this.enviarWhatsApp(telefone, `Olá, *${nomeCliente}*! Você tem *${faturas.length} faturas em aberto*.\nResponda o *número* da que deseja pagar:\n\n${lista}`);
      salvarSessao(telefone, faturas.map(f => f.id));
    }
  }

  private async atualizarAtrasadas(): Promise<void> {
    const repo = AppDataSource.getRepository(Fatura);
    const atrasadas = await repo.find({ where: { status: StatusFatura.PENDENTE, data_vencimento: LessThan(hoje()) }, relations: ['beneficiario', 'beneficiario.cliente'] });
    for (const f of atrasadas) { await repo.update(f.id, { status: StatusFatura.ATRASADA }); await this.registrarEvento(f.id, 'status_atualizado', { de: 'pendente', para: 'atrasada' }); }
    if (atrasadas.length > 0) console.log(`[REGUA] ${atrasadas.length} fatura(s) marcadas como atrasadas`);
  }

  async processarReguaDiaria(): Promise<void> {
    if (!AppDataSource.isInitialized) return;
    console.log('[REGUA] Iniciando processamento diário...');
    await this.atualizarAtrasadas();
    const faturas = await AppDataSource.getRepository(Fatura).find({ where: { status: In([StatusFatura.PENDENTE, StatusFatura.ATRASADA]) }, relations: ['beneficiario', 'beneficiario.cliente', 'beneficiario.usina'] });
    let disparos = 0;
    for (const f of faturas) {
      const venc = new Date((f.data_vencimento as any)+'T12:00:00'); const diasVenc = diffDias(hoje(), venc); const diasAtr = -diasVenc;
      if      (diasVenc === 5  && !await this.eventoDispararadoHoje(f.id, 'aviso_d5'))  { await this.dispararMensagem(f, 'aviso_d5');  disparos++; }
      else if (diasVenc === 0  && !await this.eventoDispararadoHoje(f.id, 'aviso_d0'))  { await this.dispararMensagem(f, 'aviso_d0');  disparos++; }
      else if (diasAtr  === 1  && !await this.eventoDispararadoHoje(f.id, 'aviso_d1'))  { await this.dispararMensagem(f, 'aviso_d1');  disparos++; }
      else if (diasAtr  === 3  && !await this.eventoDispararadoHoje(f.id, 'aviso_d3'))  { await this.dispararMensagem(f, 'aviso_d3');  disparos++; }
      else if (diasAtr  === 7  && !await this.eventoDispararadoHoje(f.id, 'aviso_d7'))  { await this.dispararMensagem(f, 'aviso_d7');  disparos++; }
      else if (diasAtr  === 15 && !await this.eventoDispararadoHoje(f.id, 'aviso_d15')) { await this.dispararMensagem(f, 'aviso_d15'); disparos++; }
    }
    console.log(`[REGUA] Processamento concluído — ${disparos} disparo(s), ${faturas.length} fatura(s) analisadas`);
  }

  iniciarCrons(): void {
    cron.schedule('0 8 * * *', () => { this.processarReguaDiaria().catch(e => console.error('[REGUA] Erro cron diário:', e)); }, { timezone: 'America/Campo_Grande' });
    cron.schedule('5 0 * * *', () => { this.atualizarAtrasadas().catch(e => console.error('[REGUA] Erro atrasadas:', e)); }, { timezone: 'America/Campo_Grande' });
    console.log('✅ Régua de cobrança iniciada (crons ativos) — 08:00 diário / America/Campo_Grande');
  }
}