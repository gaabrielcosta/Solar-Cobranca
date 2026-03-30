import { BoletoPixService } from '../modules/faturas/boleto-pix.service'

describe('BoletoPixService', () => {
  
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('lança erro para arquivo inexistente', async () => {
    const service = new BoletoPixService()
    await expect(service.extrairPixDoPDF('nao-existe.pdf'))
      .rejects
      .toThrow('Falha ao extrair PIX')
  })
})