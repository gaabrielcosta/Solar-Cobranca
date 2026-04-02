/**
 * Testes unitários — RateioService
 * Lógica de distribuição de kWh entre beneficiários
 */

jest.mock('../database/data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}))

import { AppDataSource } from '../database/data-source'

function makeRepo(overrides: Record<string, jest.Mock> = {}) {
  return {
    findOne:              jest.fn(),
    find:                 jest.fn(),
    create:               jest.fn((data: any) => ({ ...data })),
    save:                 jest.fn(async (e: any) => e),
    createQueryBuilder:   jest.fn(),
    ...overrides,
  }
}

function makeQB(beneficiarios: any[]) {
  const qb: any = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where:             jest.fn().mockReturnThis(),
    andWhere:          jest.fn().mockReturnThis(),
    getMany:           jest.fn().mockResolvedValue(beneficiarios),
  }
  return qb
}

describe('RateioService — distribuição de kWh', () => {

  beforeEach(() => jest.clearAllMocks())

  const geracao = {
    id: 'ger-1',
    energia_gerada_kwh: 1000,
    tarifa_kwh: 0.75,
    competencia: '2026-03-01',
    usina: { id: 'usina-1', nome: 'Usina Guanandi' },
  }

  const beneficiarios = [
    { id: 'b1', uc_beneficiaria: '111', percentual_rateio: 60, desconto_percentual: 30, cliente: { id: 'c1', nome: 'João' } },
    { id: 'b2', uc_beneficiaria: '222', percentual_rateio: 40, desconto_percentual: 25, cliente: { id: 'c2', nome: 'Maria' } },
  ]

  function setupMocks(bens = beneficiarios) {
    const geracaoRepo      = makeRepo({ findOne: jest.fn().mockResolvedValue(geracao) })
    const beneficiarioRepo = makeRepo({ createQueryBuilder: jest.fn().mockReturnValue(makeQB(bens)) })
    const rateioRepo       = makeRepo()

    ;(AppDataSource.getRepository as jest.Mock).mockImplementation((entity: any) => {
      const name = typeof entity === 'function' ? entity.name : String(entity)
      if (name === 'Geracao')      return geracaoRepo
      if (name === 'Beneficiario') return beneficiarioRepo
      if (name === 'Rateio')       return rateioRepo
      return makeRepo()
    })

    return { geracaoRepo, beneficiarioRepo, rateioRepo }
  }

  it('distribui kWh proporcionalmente ao percentual de rateio', async () => {
    setupMocks()
    const { RateioService } = await import('../modules/usinas/rateio.service')
    const service = new RateioService()
    const result = await service.calcularRateio('ger-1')

    expect(result).toHaveLength(2)
    expect(result[0].kwh_alocado).toBe(600)  // 60% de 1000
    expect(result[1].kwh_alocado).toBe(400)  // 40% de 1000
  })

  it('calcula valor com desconto corretamente', async () => {
    setupMocks()
    const { RateioService } = await import('../modules/usinas/rateio.service')
    const service = new RateioService()
    const result = await service.calcularRateio('ger-1')

    // b1: 600kWh * 0.75 = 450 sem desconto; 450 * 0.70 = 315 com 30% desconto
    expect(result[0].valor_sem_desconto).toBe(450)
    expect(result[0].valor_credito).toBe(315)
    expect(result[0].economia_desconto).toBe(135)

    // b2: 400kWh * 0.75 = 300 sem desconto; 300 * 0.75 = 225 com 25% desconto
    expect(result[1].valor_sem_desconto).toBe(300)
    expect(result[1].valor_credito).toBe(225)
    expect(result[1].economia_desconto).toBe(75)
  })

  it('lança erro se geração não existe', async () => {
    const geracaoRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) })
    ;(AppDataSource.getRepository as jest.Mock).mockReturnValue(geracaoRepo)

    const { RateioService } = await import('../modules/usinas/rateio.service')
    const service = new RateioService()

    await expect(service.calcularRateio('inexistente'))
      .rejects.toThrow('Geração não encontrada')
  })

  it('lança erro se nenhum beneficiário ativo', async () => {
    setupMocks([])
    const { RateioService } = await import('../modules/usinas/rateio.service')
    const service = new RateioService()

    await expect(service.calcularRateio('ger-1'))
      .rejects.toThrow('Nenhum beneficiário ativo')
  })

  it('lança erro se percentuais não somam 100%', async () => {
    const bensInvalidos = [
      { ...beneficiarios[0], percentual_rateio: 60 },
      { ...beneficiarios[1], percentual_rateio: 30 }, // soma 90, não 100
    ]
    setupMocks(bensInvalidos)

    const { RateioService } = await import('../modules/usinas/rateio.service')
    const service = new RateioService()

    await expect(service.calcularRateio('ger-1'))
      .rejects.toThrow('devem somar 100%')
  })

  it('salva um rateio por beneficiário', async () => {
    const { rateioRepo } = setupMocks()
    const { RateioService } = await import('../modules/usinas/rateio.service')
    const service = new RateioService()
    await service.calcularRateio('ger-1')

    expect(rateioRepo.save).toHaveBeenCalledTimes(2)
  })

  it('retorna percentual e tarifa corretos no resultado', async () => {
    setupMocks()
    const { RateioService } = await import('../modules/usinas/rateio.service')
    const service = new RateioService()
    const result = await service.calcularRateio('ger-1')

    expect(result[0].percentual).toBe(60)
    expect(result[0].tarifa_kwh).toBe(0.75)
    expect(result[1].percentual).toBe(40)
  })
})