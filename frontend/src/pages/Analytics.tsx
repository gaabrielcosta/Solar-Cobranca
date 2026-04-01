import { useEffect, useState } from 'react'
import { apiFetch } from '@/hooks/useApi'
import { TrendingUp, TrendingDown, Users, Percent } from 'lucide-react'

interface Fatura {
  id: string
  valor: number
  valor_desconto: number
  valor_sem_desconto: number
  desconto_percentual: number
  status: string
  competencia: string
  kwh_alocado: number
  beneficiario?: {
    cliente?: { id: string; nome: string }
    usina?: { nome: string }
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

const COMP_COLORS = [
  'bg-blue-500', 'bg-purple-500', 'bg-cyan-500',
  'bg-indigo-500', 'bg-violet-500', 'bg-sky-500',
]

export default function Analytics() {
  const [faturas, setFaturas] = useState<Fatura[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch<{ data: Fatura[] }>('/api/faturas')
      .then(r => setFaturas(r.data || []))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-muted-foreground text-sm">Carregando...</div>

  const total     = faturas.length
  const pagas     = faturas.filter(f => f.status === 'paga')
  const atrasadas = faturas.filter(f => f.status === 'atrasada')

  const economiaTotal = faturas.reduce((acc, f) => acc + Number(f.valor_desconto || 0), 0)
  const inadimplencia = total > 0 ? ((atrasadas.length / total) * 100).toFixed(1) : '0.0'
  const ticketMedio   = pagas.length > 0 ? pagas.reduce((acc, f) => acc + Number(f.valor), 0) / pagas.length : 0
  const descontoMedio = faturas.length > 0 ? faturas.reduce((acc, f) => acc + Number(f.desconto_percentual || 0), 0) / faturas.length : 0

  const economiaPorCliente: Record<string, { nome: string; economia: number; faturas: number }> = {}
  faturas.forEach(f => {
    const id   = f.beneficiario?.cliente?.id || 'sem-cliente'
    const nome = f.beneficiario?.cliente?.nome || '—'
    if (!economiaPorCliente[id]) economiaPorCliente[id] = { nome, economia: 0, faturas: 0 }
    economiaPorCliente[id].economia += Number(f.valor_desconto || 0)
    economiaPorCliente[id].faturas  += 1
  })
  const rankEconomia = Object.values(economiaPorCliente)
    .sort((a, b) => b.economia - a.economia)
    .slice(0, 10)

  const porComp: Record<string, { total: number; pagas: number; atrasadas: number; valor: number }> = {}
  faturas.forEach(f => {
    const comp = fmtComp(f.competencia)
    if (!porComp[comp]) porComp[comp] = { total: 0, pagas: 0, atrasadas: 0, valor: 0 }
    porComp[comp].total++
    porComp[comp].valor += Number(f.valor)
    if (f.status === 'paga') porComp[comp].pagas++
    if (f.status === 'atrasada') porComp[comp].atrasadas++
  })
  const comps = Object.entries(porComp)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-6)

  const maxValor = Math.max(...comps.map(([, v]) => v.valor), 1)
  const maxEco   = rankEconomia[0]?.economia || 1

  const kpis = [
    { label: 'Economia Gerada',  valor: fmtMoeda(economiaTotal),         sub: 'total de descontos concedidos',          icon: TrendingUp,  cor: 'text-green-500',  bg: 'bg-green-500/10',  border: 'border-green-500/20' },
    { label: 'Inadimplência',    valor: `${inadimplencia}%`,              sub: `${atrasadas.length} fatura${atrasadas.length !== 1 ? 's' : ''} em atraso`, icon: TrendingDown, cor: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20' },
    { label: 'Ticket Médio',     valor: fmtMoeda(ticketMedio),            sub: 'valor médio das faturas pagas',          icon: Users,       cor: 'text-blue-500',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20' },
    { label: 'Desconto Médio',   valor: `${descontoMedio.toFixed(1)}%`,   sub: 'média da carteira',                      icon: Percent,     cor: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <p className="text-muted-foreground text-sm mt-1">Visão financeira da carteira</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map(k => {
          const Icon = k.icon
          return (
            <div key={k.label} className={`rounded-xl border ${k.border} bg-card p-5 flex flex-col gap-4`}>
              <div className="flex items-center justify-between">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${k.bg}`}>
                  <Icon size={20} className={k.cor} />
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{k.label}</p>
                <p className={`text-lg sm:text-2xl font-bold mt-1 leading-tight ${k.cor}`}>{k.valor}</p>
                <p className="text-xs text-muted-foreground mt-1">{k.sub}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-5">
            <h2 className="text-sm font-semibold">Faturamento por Competência</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Valor total faturado por mês</p>
          </div>
          <div className="flex flex-col gap-4">
            {comps.map(([comp, v], idx) => (
              <div key={comp}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium">{comp}</span>
                  <span className="text-xs font-semibold">{fmtMoeda(v.valor)}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${COMP_COLORS[idx % COMP_COLORS.length]}`}
                    style={{ width: `${(v.valor / maxValor) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-5">
            <h2 className="text-sm font-semibold">Status por Competência</h2>
            <p className="text-xs text-muted-foreground mt-0.5">% de faturas pagas por mês</p>
          </div>
          <div className="flex flex-col gap-4">
            {comps.map(([comp, v]) => {
              const pct      = v.total > 0 ? (v.pagas / v.total) * 100 : 0
              const pctAtr   = v.total > 0 ? (v.atrasadas / v.total) * 100 : 0
              return (
                <div key={comp}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium">{comp}</span>
                    <span className="text-xs text-muted-foreground">{v.pagas}/{v.total} pagas</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden flex">
                    <div className="h-full bg-green-500 transition-all" style={{ width: `${pct}%` }} />
                    <div className="h-full bg-red-500 transition-all" style={{ width: `${pctAtr}%` }} />
                  </div>
                  <div className="flex gap-3 mt-1">
                    <span className="text-[10px] text-green-500">{pct.toFixed(0)}% pagas</span>
                    {pctAtr > 0 && <span className="text-[10px] text-red-500">{pctAtr.toFixed(0)}% atrasadas</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Ranking economia */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-5">
          <h2 className="text-sm font-semibold">Economia por Cliente</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Total de descontos acumulados por beneficiário</p>
        </div>
        <div className="flex flex-col gap-4">
          {rankEconomia.map((c, i) => (
            <div key={i}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs text-muted-foreground w-4 flex-shrink-0">{i + 1}</span>
                  <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center text-[9px] font-bold text-green-500 flex-shrink-0">
                    {c.nome.substring(0, 2).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium truncate">{c.nome}</span>
                </div>
                <span className="text-sm font-semibold text-green-500 flex-shrink-0 ml-4">{fmtMoeda(c.economia)}</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${(c.economia / maxEco) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}