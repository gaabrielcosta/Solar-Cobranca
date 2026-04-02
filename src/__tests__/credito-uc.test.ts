/**
 * Testes unitários — CreditoUCService
 * Lógica de cálculo de saldo de kWh por UC
 */

// Mock do AppDataSource antes de importar o service
jest.mock('../database/data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}))

import { AppDataSource } from '../database/data-source'

// ── helpers ──────────────────────────────────────────────────────────────────

function makeRepo(overrides: Record<string, jest.Mock> = {}) {
  return {
    findOne: jest.fn(),
    find:    jest.fn(),
    create:  jest.fn((data: any) => ({ ...data })),
    save:    jest.fn(async (e: any) => e),
    ...overrides,
  }
}

function mockGetRepository(repoMap: Record<string, ReturnType<typeof makeRepo>>) {
  ;(AppDataSource.getRepository as jest.Mock).mockImplementation((entity: any) => {
    const name = typeof entity === 'function' ? entity.name : String(entity)
    return repoMap[name] ?? makeRepo()
  })
}

// ── testes ────────────────────────────────────────────────────────────────────

describe('CreditoUCService — cálculo de saldo', () => {

  beforeEach(() => jest.clearAllMocks())

  it('calcula saldo_atual = saldo_anterior + kwh_compensado - kwh_consumido', async () => {
    const creditoRepo    = makeRepo({ findOne: jest.fn().mockResolvedValue(null) })
    const rateioRepo     = makeRepo({ findOne: jest.fn().mockResolvedValue({ kwh_alocado: 500 }) })
    const faturaRepo     = makeRepo({ findOne: jest.fn().mockResolvedValue({ kwh_alocado: 200 }) })
    const beneficiarioRepo = makeRepo()

    // Primeiro findOne = creditoAnterior (saldo_anterior = 100)
    // Segundo findOne = upsert (não existe ainda)
    creditoRepo.findOne
      .mockResolvedValueOnce({ saldo_atual: 100 })   // mês anterior
      .mockResolvedValueOnce(null)                    // upsert — não existe

    mockGetRepository({
      CreditoUC:    creditoRepo,
      Rateio:       rateioRepo,
      Fatura:       faturaRepo,
      Beneficiario: beneficiarioRepo,
    })

    const { CreditoUCService } = await import('../modules/usinas/credito-uc.service')
    const service = new CreditoUCService()

    const result = await service.recalcularCredito('benef-1', '2026-03-01')

    // 100 + 500 - 200 = 400
    expect(result.saldo_atual).toBe(400)
    expect(result.saldo_anterior).toBe(100)
    expect(result.kwh_compensado).toBe(500)
    expect(result.kwh_consumido).toBe(200)
    expect(creditoRepo.save).toHaveBeenCalledTimes(1)
  })

  it('saldo_atual nunca fica negativo', async () => {
    const creditoRepo = makeRepo({
      findOne: jest.fn()
        .mockResolvedValueOnce({ saldo_atual: 50 })  // anterior
        .mockResolvedValueOnce(null),
    })
    const rateioRepo  = makeRepo({ findOne: jest.fn().mockResolvedValue({ kwh_alocado: 100 }) })
    const faturaRepo  = makeRepo({ findOne: jest.fn().mockResolvedValue({ kwh_alocado: 999 }) })

    mockGetRepository({ CreditoUC: creditoRepo, Rateio: rateioRepo, Fatura: faturaRepo, Beneficiario: makeRepo() })

    const { CreditoUCService } = await import('../modules/usinas/credito-uc.service')
    const service = new CreditoUCService()
    const result = await service.recalcularCredito('benef-2', '2026-03-01')

    expect(result.saldo_atual).toBe(0)
  })

  it('usa saldo_anterior = 0 quando não há crédito no mês anterior', async () => {
    const creditoRepo = makeRepo({
      findOne: jest.fn()
        .mockResolvedValueOnce(null)  // sem crédito anterior
        .mockResolvedValueOnce(null),
    })
    const rateioRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ kwh_alocado: 300 }) })
    const faturaRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ kwh_alocado: 100 }) })

    mockGetRepository({ CreditoUC: creditoRepo, Rateio: rateioRepo, Fatura: faturaRepo, Beneficiario: makeRepo() })

    const { CreditoUCService } = await import('../modules/usinas/credito-uc.service')
    const service = new CreditoUCService()
    const result = await service.recalcularCredito('benef-3', '2026-03-01')

    expect(result.saldo_anterior).toBe(0)
    expect(result.saldo_atual).toBe(200)
  })

  it('atualiza crédito existente em vez de criar novo', async () => {
    const creditoExistente = { id: 'cred-1', saldo_anterior: 0, kwh_compensado: 0, kwh_consumido: 0, saldo_atual: 0 }
    const creditoRepo = makeRepo({
      findOne: jest.fn()
        .mockResolvedValueOnce(null)             // anterior
        .mockResolvedValueOnce(creditoExistente), // upsert — já existe
    })
    const rateioRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ kwh_alocado: 200 }) })
    const faturaRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ kwh_alocado: 50 }) })

    mockGetRepository({ CreditoUC: creditoRepo, Rateio: rateioRepo, Fatura: faturaRepo, Beneficiario: makeRepo() })

    const { CreditoUCService } = await import('../modules/usinas/credito-uc.service')
    const service = new CreditoUCService()
    await service.recalcularCredito('benef-4', '2026-03-01')

    // create NÃO deve ser chamado — usa o existente
    expect(creditoRepo.create).not.toHaveBeenCalled()
    expect(creditoRepo.save).toHaveBeenCalledTimes(1)
  })

  it('atualizarConsumo recalcula saldo corretamente', async () => {
    const credito = {
      saldo_anterior: 200,
      kwh_compensado: 300,
      kwh_consumido:  0,
      saldo_atual:    500,
    }
    const creditoRepo = makeRepo({
      findOne: jest.fn().mockResolvedValue(credito),
    })

    mockGetRepository({ CreditoUC: creditoRepo, Rateio: makeRepo(), Fatura: makeRepo(), Beneficiario: makeRepo() })

    const { CreditoUCService } = await import('../modules/usinas/credito-uc.service')
    const service = new CreditoUCService()
    const result = await service.atualizarConsumo('benef-5', '2026-03-01', 150)

    // 200 + 300 - 150 = 350
    expect(result.saldo_atual).toBe(350)
    expect(result.kwh_consumido).toBe(150)
  })

  it('atualizarConsumo lança erro se crédito não existe', async () => {
    const creditoRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) })
    mockGetRepository({ CreditoUC: creditoRepo, Rateio: makeRepo(), Fatura: makeRepo(), Beneficiario: makeRepo() })

    const { CreditoUCService } = await import('../modules/usinas/credito-uc.service')
    const service = new CreditoUCService()

    await expect(service.atualizarConsumo('benef-x', '2026-03-01', 100))
      .rejects.toThrow('Crédito não encontrado')
  })

  it('recalcularTodos retorna contagem correta de sucessos e erros', async () => {
    const beneficiarios = [
      { id: 'b1', uc_beneficiaria: '111', ativo: true },
      { id: 'b2', uc_beneficiaria: '222', ativo: true },
      { id: 'b3', uc_beneficiaria: '333', ativo: true },
    ]

    const beneficiarioRepo = makeRepo({ find: jest.fn().mockResolvedValue(beneficiarios) })
    const rateioRepo       = makeRepo({ findOne: jest.fn().mockResolvedValue({ kwh_alocado: 100 }) })
    const faturaRepo       = makeRepo({ findOne: jest.fn().mockResolvedValue({ kwh_alocado: 50 }) })
    const creditoRepo      = makeRepo({
      findOne: jest.fn()
        // b1: sucesso
        .mockResolvedValueOnce(null).mockResolvedValueOnce(null)
        // b2: sucesso
        .mockResolvedValueOnce(null).mockResolvedValueOnce(null)
        // b3: erro
        .mockRejectedValueOnce(new Error('DB error')),
    })

    mockGetRepository({
      CreditoUC:    creditoRepo,
      Rateio:       rateioRepo,
      Fatura:       faturaRepo,
      Beneficiario: beneficiarioRepo,
    })

    const { CreditoUCService } = await import('../modules/usinas/credito-uc.service')
    const service = new CreditoUCService()
    const result = await service.recalcularTodos('2026-03-01')

    expect(result.total).toBe(2)
    expect(result.erros).toBe(1)
  })
})