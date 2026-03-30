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

  const economiaTotal  = faturas.reduce((acc, f) => acc + Number(f.valor_desconto || 0), 0)
  const inadimplencia  = total > 0 ? ((atrasadas.length / total) * 100).toFixed(1) : '0.0'
  const ticketMedio    = pagas.length > 0 ? pagas.reduce((acc, f) => acc + Number(f.valor), 0) / pagas.length : 0
  const descontoMedio  = faturas.length > 0 ? faturas.reduce((acc, f) => acc + Number(f.desconto_percentual || 0), 0) / faturas.length : 0

  // Agrupa por cliente para economia acumulada
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

  // Agrupa por competência para gráfico simples
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

  const kpis = [
    { label: 'Economia gerada', valor: fmtMoeda(economiaTotal), sub: 'total de descontos concedidos', icon: TrendingUp, cor: 'text-green-500', bg: 'bg-green-500/10' },
    { label: 'Inadimplência', valor: `${inadimplencia}%`, sub: `${atrasadas.length} fatura${atrasadas.length !== 1 ? 's' : ''} em atraso`, icon: TrendingDown, cor: 'text-red-500', bg: 'bg-red-500/10' },
    { label: 'Ticket médio', valor: fmtMoeda(ticketMedio), sub: 'valor médio das faturas pagas', icon: Users, cor: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'Desconto médio', valor: `${descontoMedio.toFixed(1)}%`, sub: 'média da carteira', icon: Percent, cor: 'text-purple-500', bg: 'bg-purple-500/10' },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <p className="text-muted-foreground text-sm mt-1">Visão financeira da carteira</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map(k => {
          const Icon = k.icon
          return (
            <div key={k.label} className="rounded-lg border border-border bg-card p-4 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${k.bg}`}>
                <Icon size={20} className={k.cor} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className={`text-xl font-semibold ${k.cor}`}>{k.valor}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{k.sub}</p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-medium mb-4">Faturamento por competência</h2>
          <div className="flex flex-col gap-3">
            {comps.map(([comp, v]) => (
              <div key={comp} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-14 flex-shrink-0">{comp}</span>
                <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${(v.valor / maxValor) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-medium w-24 text-right">{fmtMoeda(v.valor)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-medium mb-4">Status por competência</h2>
          <div className="flex flex-col gap-2">
            {comps.map(([comp, v]) => {
              const pct = v.total > 0 ? (v.pagas / v.total) * 100 : 0
              return (
                <div key={comp} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-14 flex-shrink-0">{comp}</span>
                  <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground w-24 text-right">
                    {v.pagas}/{v.total} pagas
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-medium mb-4">Economia por cliente</h2>
        <div className="flex flex-col gap-2">
          {rankEconomia.map((c, i) => {
            const maxEco = rankEconomia[0]?.economia || 1
            return (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-5">{i + 1}</span>
                <span className="text-sm w-48 truncate">{c.nome}</span>
                <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: `${(c.economia / maxEco) * 100}%` }} />
                </div>
                <span className="text-xs font-medium w-24 text-right text-green-500">{fmtMoeda(c.economia)}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}