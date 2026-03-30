import { LeitorPDFService, DadosFaturaEnergisa } from '../modules/faturas/leitor-pdf.service'

const leitor = new LeitorPDFService()

// Acessa os métodos privados via cast — só para testes
const l = leitor as any

describe('LeitorPDFService — extração de dados da fatura', () => {

  describe('fatura_uc', () => {
    it('extrai UC no padrão MATRÍCULA', () => {
      const texto = 'MATRÍCULA: 3647072-2026-2-1'
      expect(l.fatura_uc(texto)).toBe('3647072')
    })

    it('extrai UC no padrão 10/UC-digito', () => {
      const texto = '10/3647072-2'
      expect(l.fatura_uc(texto)).toBe('3647072')
    })

    it('retorna string vazia se não encontrar', () => {
      expect(l.fatura_uc('texto sem uc')).toBe('')
    })
  })

  describe('fatura_competencia', () => {
    it('extrai competência de fevereiro', () => {
      const texto = '18/02/2026 R$ 2.916,94Fevereiro / 2026'
      expect(l.fatura_competencia(texto)).toBe('02/2026')
    })

    it('extrai competência de janeiro', () => {
      const texto = '10/01/2026 R$ 1.200,00Janeiro / 2026'
      expect(l.fatura_competencia(texto)).toBe('01/2026')
    })

    it('retorna string vazia se não encontrar', () => {
      expect(l.fatura_competencia('texto inválido')).toBe('')
    })
  })

  describe('fatura_vencimento', () => {
    it('extrai data de vencimento corretamente', () => {
      const texto = '18/02/2026 R$ 2.916,94Fevereiro / 2026'
      expect(l.fatura_vencimento(texto)).toBe('18/02/2026')
    })
  })

  describe('fatura_total', () => {
    it('extrai valor total do boleto', () => {
      const texto = '109/56785924-4 2.916,94 texto seguinte'
      expect(l.fatura_total(texto)).toBe(2916.94)
    })

    it('usa fallback do VENCIMENTO se padrão principal falhar', () => {
      const texto = 'VENCIMENTO) 1.500,00'
      expect(l.fatura_total(texto)).toBe(1500.00)
    })

    it('retorna 0 se não encontrar', () => {
      expect(l.fatura_total('sem valor')).toBe(0)
    })
  })

  describe('fatura_cip', () => {
    it('extrai CIP como segundo valor positivo na sequência', () => {
      const texto = 'Consumo em kWh 0,878100 -527,73 65,37 0,209180 125,71 839,371,092920'
      const cip = l.fatura_cip(texto)
      expect(cip).toBe(65.37)
    })
  })

  describe('fatura_saldo', () => {
    it('extrai saldo acumulado', () => {
      const texto = 'Saldo Acumulado: 1234 kWh'
      expect(l.fatura_saldo(texto)).toBe(1234)
    })

    it('retorna 0 se não houver saldo', () => {
      expect(l.fatura_saldo('sem saldo')).toBe(0)
    })
  })

  describe('fatura_dataLeitura', () => {
    it('extrai data de leitura atual — padrão principal', () => {
      const texto = '05/02/2026Leitura Atual:07/01/2026Leitura Anterior:'
      expect(l.fatura_dataLeitura(texto)).toBe('05/02/2026')
    })

    it('extrai data de leitura atual — fallback', () => {
      const texto = 'Leitura Atual: 05/02/2026'
      expect(l.fatura_dataLeitura(texto)).toBe('05/02/2026')
    })
  })
})

describe('LeitorPDFService — demonstrativo da usina', () => {

  describe('dem_ucGeradora', () => {
    it('extrai UC geradora com prefixo 10/', () => {
      const texto = 'UC: 10/3652109-4'
      expect(l.dem_ucGeradora(texto)).toBe('3652109')
    })

    it('extrai UC geradora sem prefixo', () => {
      const texto = 'UC: 3652109-4'
      expect(l.dem_ucGeradora(texto)).toBe('3652109')
    })
  })

  describe('dem_competencia', () => {
    it('extrai referência do demonstrativo', () => {
      const texto = 'Referência: 02/2026'
      expect(l.dem_competencia(texto)).toBe('02/2026')
    })
  })

  describe('dem_saldoAnterior', () => {
    it('extrai saldo anterior da linha GD II', () => {
      const texto = 'GD II 12845 5012 0 0 5012 0 12845 0  02/2031'
      expect(l.dem_saldoAnterior(texto)).toBe(12845)
    })
  })

  describe('dem_saldoDisponivel', () => {
    it('extrai saldo disponível da linha GD II', () => {
      const texto = 'GD II 12845 5012 0 0 5012 0 12845 0  02/2031'
      expect(l.dem_saldoDisponivel(texto)).toBe(12845)
    })
  })

  describe('dem_expiracao', () => {
    it('extrai data de expiração dos créditos', () => {
      const texto = 'GD II 12845 5012 0 0 5012 0 12845 0  02/2031'
      expect(l.dem_expiracao(texto)).toBe('02/2031')
    })
  })

  describe('dem_rateios', () => {
    it('extrai rateios dos beneficiários', () => {
      const texto = `Discriminação das Transferências
        6 3785960 0 -300 0 0 0 0 0 0 0 0 0 0 02/2026
        31 2947736 0 -1553 0 0 0 0 0 0 0 0 0 0 02/2026
        TOTAL`
      const rateios = l.dem_rateios(texto)
      expect(rateios).toHaveLength(2)
      expect(rateios[0].uc).toBe('3785960')
      expect(rateios[0].kwh_transferido).toBe(300)
      expect(rateios[0].percentual).toBe(6)
      expect(rateios[1].kwh_transferido).toBe(1553)
    })

    it('retorna array vazio se seção não existir', () => {
      expect(l.dem_rateios('texto sem seção')).toEqual([])
    })
  })
})