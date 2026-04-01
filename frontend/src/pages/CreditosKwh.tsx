import { useEffect, useState } from 'react'
import { apiFetch } from '@/hooks/useApi'
import { Zap, DollarSign, TrendingUp, Users, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface Credito {
  id: string
  saldo_atual: number
  kwh_compensado: number
  kwh_consumido: number
  saldo_anterior: number
  competencia: string
  beneficiario?: {
    id: string
    uc_beneficiaria: string
    cliente?: { id: string; nome: string }
  }
}

function fmtMoeda(v: number) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtComp(d: string) {
  if (!d) return '—'
  const dt = new Date(d + 'T12:00:00')
  return `${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`
}

export default function CreditosKwh() {
  const [creditos,     setCreditos]     = useState<Credito[]>([])
  const [loading,      setLoading]      = useState(true)
  const [tarifa,       setTarifa]       = useState(0.75)
  const [tarifaInput,  setTarifaInput]  = useState('0.7500')
  const [recalculando, setRecalculando] = useState(false)

  async function carregar() {
    const r = await apiFetch<{ data: Credito[] }>('/api/creditos')
    setCreditos(r.data || [])
  }

  async function recalcularCreditos() {
    setRecalculando(true)
    try {
      const hoje = new Date()
      const comp = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`
      await apiFetch('/api/creditos/recalcular', {
        method: 'POST',
        body: JSON.stringify({ competencia: comp }),
      })
      await carregar()
    } finally {
      setRecalculando(false)
    }
  }

  useEffect(() => {
    carregar().finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-muted-foreground text-sm p-6">Carregando...</div>

  const totalKwh      = creditos.reduce((a, c) => a + Number(c.saldo_atual || 0), 0)
  const valorEstimado = totalKwh * tarifa
  const maiorSaldo    = creditos.reduce((a, c) => Number(c.saldo_atual) > Number(a.saldo_atual) ? c : a, creditos[0] || {} as Credito)
  const comSaldo      = creditos.filter(c => Number(c.saldo_atual) > 0).length
  const maxSaldo      = Math.max(...creditos.map(c => Number(c.saldo_atual)), 1)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Créditos kWh</h1>
          <p className="text-muted-foreground text-sm mt-1">Saldo de energia acumulado por UC</p>
        </div>
        <Button variant="outline" onClick={recalcularCreditos} disabled={recalculando}>
          <RefreshCw size={16} className={recalculando ? 'animate-spin' : ''} />
          {recalculando ? 'Recalculando...' : 'Recalcular'}
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Acumulado',    valor: `${totalKwh.toLocaleString('pt-BR')} kWh`, sub: 'saldo Energisa dos clientes',            icon: Zap,        cor: 'text-green-500',  bg: 'bg-green-500/10',  border: 'border-green-500/20' },
          { label: 'Valor Estimado',     valor: fmtMoeda(valorEstimado),                   sub: `pela tarifa R$ ${tarifa.toFixed(4)}/kWh`, icon: DollarSign, cor: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
          { label: 'Maior Saldo',        valor: `${Number(maiorSaldo?.saldo_atual || 0).toLocaleString('pt-BR')} kWh`, sub: maiorSaldo?.beneficiario?.cliente?.nome || '—', icon: TrendingUp, cor: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
          { label: 'Clientes com Saldo', valor: comSaldo,                                  sub: 'UCs com crédito > 0',                    icon: Users,      cor: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
        ].map(k => {
          const Icon = k.icon
          return (
            <div key={k.label} className={`rounded-xl border ${k.border} bg-card p-5 flex flex-col gap-3`}>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${k.bg}`}>
                <Icon size={18} className={k.cor} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{k.label}</p>
                <p className={`text-lg sm:text-2xl font-bold mt-0.5 leading-tight ${k.cor}`}>{k.valor}</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{k.sub}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Simulador */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-sm font-semibold">Simulador de Valor</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Altere a tarifa para simular o valor financeiro dos créditos acumulados em R$</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-muted-foreground">Tarifa kWh (R$):</span>
            <input
              type="number"
              step="0.0001"
              className="w-28 h-8 px-3 rounded-lg border border-border bg-background text-sm font-mono"
              value={tarifaInput}
              onChange={e => setTarifaInput(e.target.value)}
            />
            <button
              onClick={() => setTarifa(parseFloat(tarifaInput) || 0)}
              className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
            >
              Atualizar
            </button>
          </div>
        </div>
        <div className="mt-4 p-4 rounded-lg bg-muted/50 flex items-center gap-3">
          <Zap size={16} className="text-green-500" />
          <span className="text-sm">
            <span className="font-medium text-green-500">{totalKwh.toLocaleString('pt-BR')} kWh</span>
            <span className="text-muted-foreground"> × R$ {tarifa.toFixed(4)}/kWh = </span>
            <span className="font-bold text-yellow-500">{fmtMoeda(valorEstimado)}</span>
          </span>
        </div>
      </div>

      {/* Ranking */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold">Ranking por Saldo</h2>
          <span className="text-xs text-muted-foreground">última fatura de cada UC</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="text-left pb-3 pr-4 text-xs font-medium w-8">#</th>
                <th className="text-left pb-3 pr-4 text-xs font-medium">UC</th>
                <th className="text-left pb-3 pr-4 text-xs font-medium">Cliente</th>
                <th className="text-left pb-3 pr-4 text-xs font-medium">Compensado</th>
                <th className="text-left pb-3 pr-8 text-xs font-medium w-64">Saldo</th>
                <th className="text-left pb-3 pl-4 text-xs font-medium min-w-[100px]">R$</th>
              </tr>
            </thead>
            <tbody>
              {creditos.map((c, i) => {
                const saldo = Number(c.saldo_atual || 0)
                const comp  = Number(c.kwh_compensado || 0)
                const cons  = Number(c.kwh_consumido || 0)
                const pct   = maxSaldo > 0 ? (saldo / maxSaldo) * 100 : 0
                const valor = saldo * tarifa

                return (
                  <tr key={c.id} className={cn('border-b border-border/50', i % 2 === 0 ? '' : 'bg-muted/10')}>
                    <td className="py-3 pr-4">
                      <span className="text-xs text-muted-foreground font-medium">{i + 1}</span>
                    </td>
                    <td className="py-3 pr-4">
                      <p className="font-mono text-xs font-medium text-primary">UC {c.beneficiario?.uc_beneficiaria || '—'}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{fmtComp(c.competencia)}</p>
                    </td>
                    <td className="py-3 pr-4">
                      <p className="text-sm font-medium">{c.beneficiario?.cliente?.nome || '—'}</p>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="text-xs text-green-500 font-medium">+{comp.toLocaleString('pt-BR')}</span>
                      {cons > 0 && <span className="text-xs text-red-400 ml-1">/ -{cons.toLocaleString('pt-BR')}</span>}
                    </td>
                    <td className="py-3 pr-8">
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="w-32 h-1.5 bg-white/10 rounded-full overflow-hidden flex-shrink-0">
                          <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className={cn('text-xs font-bold whitespace-nowrap ml-2', saldo > 0 ? 'text-green-500' : 'text-muted-foreground')}>
                          {saldo.toLocaleString('pt-BR')} kWh
                        </span>
                      </div>
                    </td>
                    <td className="py-3 pl-4 whitespace-nowrap min-w-[100px]">
                      <span className="text-sm font-semibold text-yellow-500">{fmtMoeda(valor)}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}