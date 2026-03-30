export class BotService {
  constructor() {
    console.log('✅ BotService iniciado');
  }

  async processarMensagem(telefone: string, mensagem: string): Promise<void> {
    console.log(`[BotService] Mensagem de ${telefone}: ${mensagem}`);
    // TODO: implementar lógica de resposta automática via WhatsApp
  }
}