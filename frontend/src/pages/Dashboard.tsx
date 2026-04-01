import { useEffect, useState } from 'react'
import { FileText, Users, Sun, Zap, TrendingUp, CheckCircle, AlertCircle, Activity } from 'lucide-react'
import { apiFetch } from '@/hooks/useApi'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts'

interface Fatura {
  id: string
  valor: number
  status: string
  competencia: string
  data_vencimento: string
  kwh_alocado: number
  beneficiario?: {
    uc_beneficiaria: string
    cliente?: { nome: string }
    usina?: { nome: string }
  }
}

interface Usina {
  id: string
  nome: string
  potencia_kwp: number
  distribuidora: string
}

interface Geracao {
  id: string
  energia_gerada_kwh: number
  saldo_disponivel: number
  saldo_anterior: number
  competencia: string
  tarifa_kwh: number
  usina?: { nome: string }
}

const statusConfig: Record<string, { label: string; cor: string; dot: string }> = {
  pendente: { label: 'Pendente', cor: 'text-yellow-500', dot: 'bg-yellow-500' },
  paga:     { label: 'Paga',     cor: 'text-green-500',  dot: 'bg-green-500' },
  atrasada: { label: 'Atrasada', cor: 'text-red-500',    dot: 'bg-red-500' },
  enviada:  { label: 'Enviada',  cor: 'text-blue-500',   dot: 'bg-blue-500' },
}

function fmtMoeda(v: number) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtData(d: string) {
  if (!d) return '—'
  return d.substring(0, 10).split('-').reverse().join('/')
}

function fmtComp(d: string) {
  if (!d) return '—'
  const dt = new Date(d + 'T12:00:00')
  return `${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`
}

const CustomTooltipArea = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border border-border rounded-lg p-3 text-xs shadow-lg">
      <p className="font-medium mb-2">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: {Number(p.value).toLocaleString('pt-BR')} {p.name === 'Receita' ? 'R$' : 'kWh'}</p>
      ))}
    </div>
  )
}

const CustomTooltipLine = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border border-border rounded-lg p-3 text-xs shadow-lg">
      <p className="font-medium mb-2">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: {fmtMoeda(Number(p.value))}</p>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()

  const [faturas,     setFaturas]     = useState<Fatura[]>([])
  const [usinas,      setUsinas]      = useState<Usina[]>([])
  const [geracoes,    setGeracoes]    = useState<Geracao[]>([])
  const [loading,     setLoading]     = useState(true)
  const [filtroUsina, setFiltroUsina] = useState('all')
  const [filtroMes,   setFiltroMes]   = useState('all')
  const [filtroAno,   setFiltroAno]   = useState(String(new Date().getFullYear()))

  useEffect(() => {
    Promise.all([
      apiFetch<{ data: Fatura[] }>('/api/faturas'),
      apiFetch<{ data: Usina[] }>('/api/usinas'),
      apiFetch<{ data: Geracao[] }>('/api/geracoes'),
    ]).then(([f, u, g]) => {
      setFaturas(f.data || [])
      setUsinas(u.data || [])
      setGeracoes(g.data || [])
    }).finally(() => setLoading(false))
  }, [])

  const fs = faturas.filter(f => {
    const comp       = f.competencia ? f.competencia.substring(0, 7) : ''
    const matchUsina = filtroUsina === 'all' || f.beneficiario?.usina?.nome === filtroUsina
    const matchMes   = filtroMes === 'all' || comp.substring(5, 7) === filtroMes
    const matchAno   = filtroAno === 'all' || comp.substring(0, 4) === filtroAno
    return matchUsina && matchMes && matchAno
  })

  const gs = geracoes.filter(g =>
  filtroUsina === 'all' || g.usina?.nome === filtroUsina
)

  const pendentes = fs.filter(f => f.status === 'pendente')
  const pagas     = fs.filter(f => f.status === 'paga')
  const atrasadas = fs.filter(f => f.status === 'atrasada')

  const valorPendente = [...pendentes, ...atrasadas].reduce((a, f) => a + Number(f.valor), 0)
  const kwh_total   = gs.reduce((a, g) => a + Number(g.energia_gerada_kwh || 0), 0)
  const saldo_total = gs.reduce((a, g) => a + Number(g.saldo_disponivel || 0), 0)
  const kwh_faturado  = fs.reduce((a, f) => a + Number(f.kwh_alocado || 0), 0)
  const clientesFiltrados = new Set(fs.map(f => f.beneficiario?.cliente?.nome).filter(Boolean)).size

  const ultimasFaturas = [...fs]
    .sort((a, b) => new Date(b.competencia).getTime() - new Date(a.competencia).getTime())
    .slice(0, 6)

  // Dados para gráfico de produção mensal
  const geracaoPorComp: Record<string, { comp: string; geracao: number; compensacao: number }> = {}
  gs.forEach(g => {
    const comp = fmtComp(g.competencia)
    if (!geracaoPorComp[comp]) geracaoPorComp[comp] = { comp, geracao: 0, compensacao: 0 }
    geracaoPorComp[comp].geracao += Number(g.energia_gerada_kwh || 0)
  })
  fs.forEach(f => {
    const comp = fmtComp(f.competencia)
    if (!geracaoPorComp[comp]) geracaoPorComp[comp] = { comp, geracao: 0, compensacao: 0 }
    geracaoPorComp[comp].compensacao += Number(f.kwh_alocado || 0)
  })
  const dadosProducao = Object.values(geracaoPorComp)
    .sort((a, b) => a.comp.localeCompare(b.comp))
    .slice(-8)
    .map(d => ({ name: d.comp, Geração: Math.round(d.geracao), Compensação: Math.round(d.compensacao) }))

  // Dados para gráfico de receita
  const receitaPorComp: Record<string, { comp: string; realizado: number; projecao: number }> = {}
  fs.forEach(f => {
    const comp = fmtComp(f.competencia)
    if (!receitaPorComp[comp]) receitaPorComp[comp] = { comp, realizado: 0, projecao: 0 }
    receitaPorComp[comp].projecao += Number(f.valor || 0)
    if (f.status === 'paga') receitaPorComp[comp].realizado += Number(f.valor || 0)
  })
  const dadosReceita = Object.values(receitaPorComp)
    .sort((a, b) => a.comp.localeCompare(b.comp))
    .slice(-8)
    .map(d => ({ name: d.comp, Realizado: parseFloat(d.realizado.toFixed(2)), Projeção: parseFloat(d.projecao.toFixed(2)) }))

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">Carregando...</div>
  )

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Visão geral do sistema</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          <Select value={filtroUsina} onValueChange={setFiltroUsina}>
            <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Todas as usinas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as usinas</SelectItem>
              {usinas.map(u => <SelectItem key={u.id} value={u.nome}>{u.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filtroMes} onValueChange={setFiltroMes}>
            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Todos os meses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os meses</SelectItem>
              {['01','02','03','04','05','06','07','08','09','10','11','12'].map((m, i) => (
                <SelectItem key={m} value={m}>{['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][i]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filtroAno} onValueChange={setFiltroAno}>
            <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="2024">2024</SelectItem>
              <SelectItem value="2025">2025</SelectItem>
              <SelectItem value="2026">2026</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-green-500/30 bg-green-500/5">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-green-500 font-medium">Ao vivo</span>
          </div>
        </div>
      </div>

      {/* KPIs energia */}
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground/60 tracking-widest mb-3">INDICADORES DE ENERGIA</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Geração Total',        valor: `${kwh_total.toLocaleString('pt-BR')} kWh`,    sub: 'kWh injetados na rede',     icon: Zap,        cor: 'text-green-500',  bg: 'bg-green-500/10',  barra: 100 },
            { label: 'kWh Faturados',        valor: `${kwh_faturado.toLocaleString('pt-BR')} kWh`, sub: 'distribuídos aos clientes', icon: Activity,   cor: 'text-blue-500',   bg: 'bg-blue-500/10',   barra: kwh_total > 0 ? (kwh_faturado / kwh_total) * 100 : 0 },
            { label: 'Créditos Disponíveis', valor: `${saldo_total.toLocaleString('pt-BR')} kWh`,  sub: 'saldo acumulado',           icon: TrendingUp, cor: 'text-purple-500', bg: 'bg-purple-500/10', barra: kwh_total > 0 ? (saldo_total / kwh_total) * 100 : 0 },
            { label: 'Usinas Ativas',        valor: `${usinas.length}`,                            sub: `${usinas.reduce((a, u) => a + Number(u.potencia_kwp), 0).toFixed(1)} kWp total`, icon: Sun, cor: 'text-yellow-500', bg: 'bg-yellow-500/10', barra: 100 },
          ].map(k => {
            const Icon = k.icon
            return (
              <div key={k.label} className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${k.bg}`}>
                  <Icon size={18} className={k.cor} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">{k.label}</p>
                  <p className={`text-lg sm:text-2xl font-bold mt-0.5 leading-tight ${k.cor}`}>{k.valor}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{k.sub}</p>
                </div>
                <div className="h-1 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${k.cor.replace('text-', 'bg-')}`} style={{ width: `${Math.min(k.barra, 100)}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* KPIs financeiros */}
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground/60 tracking-widest mb-3">INDICADORES FINANCEIROS</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total a Receber', valor: fmtMoeda(valorPendente), sub: `${pendentes.length} faturas pendentes`, icon: FileText,    cor: 'text-orange-500', bg: 'bg-orange-500/10' },
            { label: 'Faturas Pagas',   valor: pagas.length,            sub: 'este período',                          icon: CheckCircle, cor: 'text-green-500',  bg: 'bg-green-500/10' },
            { label: 'Clientes Ativos', valor: clientesFiltrados,                sub: 'beneficiários',                         icon: Users,       cor: 'text-blue-500',   bg: 'bg-blue-500/10' },
            { label: 'Em Atraso',       valor: atrasadas.length,        sub: 'faturas vencidas',                      icon: AlertCircle, cor: 'text-red-500',    bg: 'bg-red-500/10' },
          ].map(k => {
            const Icon = k.icon
            return (
              <div key={k.label} className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${k.bg}`}>
                  <Icon size={18} className={k.cor} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">{k.label}</p>
                  <p className={`text-lg sm:text-2xl font-bold mt-0.5 leading-tight ${k.cor}`}>{k.valor}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{k.sub}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Produção Mensal */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold">Produção Mensal de Energia</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Geração vs. compensação (kWh)</p>
          </div>
          {dadosProducao.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-xs text-muted-foreground">Sem dados de geração</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={dadosProducao} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorGeracao" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorCompensacao" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--hc-divider)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip content={<CustomTooltipArea />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="Geração" stroke="#22c55e" fill="url(#colorGeracao)" strokeWidth={2} dot={{ r: 3, fill: '#22c55e' }} />
                <Area type="monotone" dataKey="Compensação" stroke="#3b82f6" fill="url(#colorCompensacao)" strokeWidth={2} dot={{ r: 3, fill: '#3b82f6' }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Projeção de Receita */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold">Projeção de Receita</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Realizado vs. projeção (R$)</p>
          </div>
          {dadosReceita.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-xs text-muted-foreground">Sem dados de receita</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={dadosReceita} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--hc-divider)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltipLine />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="Realizado" stroke="#22c55e" strokeWidth={2} dot={{ r: 4, fill: '#22c55e' }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="Projeção" stroke="#a855f7" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 4, fill: '#a855f7' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Últimas cobranças + Usinas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold">Últimas Cobranças</h2>
            <button onClick={() => navigate('/faturas')} className="text-xs text-primary hover:underline">Ver todas</button>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="text-left px-5 py-3 text-xs font-medium">Beneficiário</th>
                <th className="text-left px-5 py-3 text-xs font-medium">Valor (R$)</th>
                <th className="text-left px-5 py-3 text-xs font-medium">Vencimento</th>
                <th className="text-left px-5 py-3 text-xs font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {ultimasFaturas.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-8 text-muted-foreground text-xs">Nenhuma fatura no período</td></tr>
              ) : ultimasFaturas.map((f, i) => {
                const st = statusConfig[f.status] || { label: f.status, cor: 'text-muted-foreground', dot: 'bg-muted-foreground' }
                return (
                  <tr key={f.id} onClick={() => navigate('/faturas')}
                    className={cn('border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors', i % 2 === 0 ? 'bg-background' : 'bg-muted/10')}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">
                          {(f.beneficiario?.cliente?.nome || '?').substring(0, 2).toUpperCase()}
                        </div>
                        <span className="font-medium truncate max-w-[80px] sm:max-w-[160px]">{f.beneficiario?.cliente?.nome || '—'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 font-medium">{fmtMoeda(f.valor)}</td>
                    <td className="px-5 py-3 text-muted-foreground">{fmtData(f.data_vencimento)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <div className={cn('w-1.5 h-1.5 rounded-full', st.dot)} />
                        <span className={cn('text-xs font-medium', st.cor)}>{st.label}</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold">Usinas</h2>
            <button onClick={() => navigate('/usinas')} className="text-xs text-primary hover:underline">Gerenciar</button>
          </div>
          <div className="flex flex-col divide-y divide-border">
            {usinas.map(u => (
              <div key={u.id} className="flex items-center gap-3 px-5 py-3">
                <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
                  <Sun size={14} className="text-yellow-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{u.nome}</p>
                  <p className="text-xs text-muted-foreground">{Number(u.potencia_kwp).toFixed(1)} kWp</p>
                </div>
                <Badge variant="outline" className="text-green-500 border-green-500/30 text-[10px]">Ativa</Badge>
              </div>
            ))}
            {usinas.length === 0 && <p className="text-sm text-muted-foreground px-5 py-6 text-center">Nenhuma usina</p>}
          </div>
        </div>
      </div>
    </div>
  )
}