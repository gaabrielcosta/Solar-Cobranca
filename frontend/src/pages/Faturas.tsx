import { useEffect, useState, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Search, Download, Trash2, Edit, QrCode, ChevronDown, ChevronUp, CheckCircle, FileText, Sun, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { apiFetch } from '@/hooks/useApi'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Fatura {
  id: string
  valor: number
  status: string
  competencia: string
  data_vencimento: string
  data_leitura: string
  kwh_alocado: number
  tarifa_kwh: number
  desconto_percentual: number
  pix_copia_cola: string
  beneficiario?: {
    id: string
    uc_beneficiaria: string
    cliente?: { id: string; nome: string }
    usina?: { id: string; nome: string }
  }
}

interface Usina {
  id: string
  nome: string
}

interface GrupoUsina {
  usina: Usina | null
  faturas: Fatura[]
}

const statusConfig: Record<string, { label: string; cor: string; bg: string; dot: string }> = {
  pendente:  { label: 'Pendente',  cor: 'text-yellow-500', bg: 'bg-yellow-500/10', dot: 'bg-yellow-500' },
  paga:      { label: 'Pago',      cor: 'text-green-500',  bg: 'bg-green-500/10',  dot: 'bg-green-500' },
  atrasada:  { label: 'Atrasada',  cor: 'text-red-500',    bg: 'bg-red-500/10',    dot: 'bg-red-500' },
  enviada:   { label: 'Enviada',   cor: 'text-blue-500',   bg: 'bg-blue-500/10',   dot: 'bg-blue-500' },
  negociada: { label: 'Negociada', cor: 'text-purple-500', bg: 'bg-purple-500/10', dot: 'bg-purple-500' },
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

export default function Faturas() {
  const [faturas,    setFaturas]    = useState<Fatura[]>([])
  const [usinas,     setUsinas]     = useState<Usina[]>([])
  const [grupos,     setGrupos]     = useState<GrupoUsina[]>([])
  const [abertos,    setAbertos]    = useState<Set<string>>(new Set())
  const [busca,      setBusca]      = useState('')
  const [loading,    setLoading]    = useState(true)
  const [filtroMes,    setFiltroMes]    = useState('all')
  const [filtroAno,    setFiltroAno]    = useState('all')
  const [filtroStatus, setFiltroStatus] = useState('todos')

  const [faturaSelecionada, setFaturaSelecionada] = useState<Fatura | null>(null)

  // Modal pagar
  const [modalPagar,    setModalPagar]    = useState(false)
  const [formaPagamento,setFormaPagamento]= useState('pix')
  const [loadingPagar,  setLoadingPagar]  = useState(false)

  // Modal editar valor
  const [modalEditar,    setModalEditar]    = useState(false)
  const [formEditar,     setFormEditar]     = useState({ valor: '', kwh_alocado: '', tarifa_kwh: '', desconto_percentual: '' })
  const [loadingEditar,  setLoadingEditar]  = useState(false)

  // Modal excluir
  const [modalExcluir,   setModalExcluir]   = useState(false)
  const [loadingExcluir, setLoadingExcluir] = useState(false)

  // Modal PIX
  const [modalPix,  setModalPix]  = useState(false)
  const [pixCopied, setPixCopied] = useState(false)

  // Modal boleto upload
  const [modalBoleto,    setModalBoleto]    = useState(false)
  const [loadingBoleto,  setLoadingBoleto]  = useState(false)
  const [erroBoleto,     setErroBoleto]     = useState('')
  const boletoRef = useRef<HTMLInputElement>(null)

  // Modal relatório
  const [modalRelatorio, setModalRelatorio] = useState(false)
  const [relMes,   setRelMes]   = useState(String(new Date().getMonth() + 1).padStart(2, '0'))
  const [relAno,   setRelAno]   = useState(String(new Date().getFullYear()))
  const [relUsina, setRelUsina] = useState('all')
  const [loadingRel, setLoadingRel] = useState(false)
  const [statusRel,  setStatusRel]  = useState('')

  async function carregar() {
    const [fRes, uRes] = await Promise.all([
      apiFetch<{ data: Fatura[] }>('/api/faturas'),
      apiFetch<{ data: Usina[] }>('/api/usinas'),
    ])
    const fs = fRes.data || []
    const us = uRes.data || []
    setFaturas(fs)
    setUsinas(us)

    // Agrupa por usina
    const map: Record<string, GrupoUsina> = {}
    fs.forEach(f => {
      const uid  = f.beneficiario?.usina?.id || 'sem-usina'
      const unome = f.beneficiario?.usina?.nome || 'Sem Usina'
      if (!map[uid]) map[uid] = { usina: uid === 'sem-usina' ? null : { id: uid, nome: unome }, faturas: [] }
      map[uid].faturas.push(f)
    })
    const gs = Object.values(map)
    setGrupos(gs)
    setAbertos(new Set(gs.map(g => g.usina?.id || 'sem-usina')))
  }

  useEffect(() => {
    carregar().finally(() => setLoading(false))
  }, [])

  function toggleGrupo(id: string) {
    setAbertos(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function marcarPaga() {
    if (!faturaSelecionada) return
    setLoadingPagar(true)
    try {
      await apiFetch(`/api/faturas/${faturaSelecionada.id}/pagar`, {
        method: 'PUT',
        body: JSON.stringify({ forma_pagamento: formaPagamento }),
      })
      setModalPagar(false)
      await carregar()
    } finally {
      setLoadingPagar(false)
    }
  }

  async function salvarEdicao() {
    if (!faturaSelecionada) return
    setLoadingEditar(true)
    try {
      const kwh      = parseFloat(formEditar.kwh_alocado) || 0
      const tarifa   = parseFloat(formEditar.tarifa_kwh) || 0
      const desc     = parseFloat(formEditar.desconto_percentual) || 0
      const bruto    = kwh * tarifa
      const calculado = parseFloat((bruto - bruto * desc / 100).toFixed(2))
      const valorFinal = formEditar.valor ? parseFloat(formEditar.valor) : calculado
      await apiFetch(`/api/faturas/${faturaSelecionada.id}/valor`, {
        method: 'PATCH',
        body: JSON.stringify({
          valor: valorFinal,
          kwh_alocado: kwh,
          tarifa_kwh: tarifa,
          desconto_percentual: desc,
        }),
      })
      setModalEditar(false)
      await carregar()
    } finally {
      setLoadingEditar(false)
    }
  }

  async function excluirFatura() {
    if (!faturaSelecionada) return
    setLoadingExcluir(true)
    try {
      await apiFetch(`/api/faturas/${faturaSelecionada.id}`, { method: 'DELETE' })
      setModalExcluir(false)
      await carregar()
    } finally {
      setLoadingExcluir(false)
    }
  }

  function copiarPix() {
    if (!faturaSelecionada?.pix_copia_cola) return
    navigator.clipboard.writeText(faturaSelecionada.pix_copia_cola)
    setPixCopied(true)
    setTimeout(() => setPixCopied(false), 2000)
  }

  async function uploadBoleto(file: File) {
    if (!faturaSelecionada) return
    setLoadingBoleto(true)
    setErroBoleto('')
    const token = localStorage.getItem('token')
    const formData = new FormData()
    formData.append('pdf', file)
    try {
      const res = await fetch(`/api/faturas/${faturaSelecionada.id}/boleto-pdf`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const data = await res.json()
      if (!res.ok || !data.sucesso) {
        setErroBoleto(data.erro || 'Erro ao processar boleto')
        return
      }
      setModalBoleto(false)
      await carregar()
      // Abre modal PIX com o novo código
      const fAtualizada = faturas.find(f => f.id === faturaSelecionada.id)
      if (fAtualizada) { setFaturaSelecionada({ ...fAtualizada, pix_copia_cola: data.pix_copia_cola }); setModalPix(true) }
    } finally {
      setLoadingBoleto(false)
      if (boletoRef.current) boletoRef.current.value = ''
    }
  }

  async function baixarPDF(f: Fatura, e: React.MouseEvent) {
    e.stopPropagation()
    const token = localStorage.getItem('token')
    const res = await fetch(`/api/faturas/${f.id}/pdf`, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fatura-${f.beneficiario?.cliente?.nome || f.id}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function gerarRelatorio() {
    setLoadingRel(true)
    setStatusRel('')
    try {
      const comp = `${relAno}-${relMes}-01`
      const token = localStorage.getItem('token')
      const endpoint = relUsina && relUsina !== 'all'
        ? `/api/faturas/relatorio/${comp}?usina=${relUsina}`
        : `/api/faturas/relatorio/${comp}`
      const res = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) { setStatusRel('Erro ao gerar relatório'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `relatorio-acelivre-${relMes}-${relAno}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      setStatusRel('Relatório gerado com sucesso')
      setTimeout(() => setModalRelatorio(false), 1500)
    } finally {
      setLoadingRel(false)
    }
  }

  const q = busca.toLowerCase()
  const gruposFiltrados = grupos.map(g => ({
    ...g,
    faturas: g.faturas.filter(f => {
      const comp = f.competencia ? f.competencia.substring(0, 7) : ''
      const nome = f.beneficiario?.cliente?.nome?.toLowerCase() || ''
      const uc   = f.beneficiario?.uc_beneficiaria?.toLowerCase() || ''
      return (
        (!q || nome.includes(q) || uc.includes(q)) &&
        (filtroStatus === 'todos' || f.status === filtroStatus) &&
        (filtroMes === 'all' || comp.substring(5, 7) === filtroMes) &&
        (filtroAno === 'all' || comp.substring(0, 4) === filtroAno)
      )
    })
  })).filter(g => g.faturas.length > 0)

  const total     = faturas.length
  const pendentes = faturas.filter(f => f.status === 'pendente').length
  const pagas     = faturas.filter(f => f.status === 'paga').length
  const atrasadas = faturas.filter(f => f.status === 'atrasada').length

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Faturas</h1>
          <p className="text-muted-foreground text-sm mt-1">Cobranças geradas por usina e beneficiário</p>
        </div>
        <Button variant="outline" onClick={() => setModalRelatorio(true)}>
          <Download size={16} />
          Relatório PDF
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs text-muted-foreground">Filtrar por</span>
        <Select value={filtroMes} onValueChange={setFiltroMes}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Todos os meses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os meses</SelectItem>
            {['01','02','03','04','05','06','07','08','09','10','11','12'].map((m, i) => (
              <SelectItem key={m} value={m}>{['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'][i]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroAno} onValueChange={setFiltroAno}>
          <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="Todos os anos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os anos</SelectItem>
            <SelectItem value="2024">2024</SelectItem>
            <SelectItem value="2025">2025</SelectItem>
            <SelectItem value="2026">2026</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Todos os status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="paga">Paga</SelectItem>
            <SelectItem value="atrasada">Atrasada</SelectItem>
            <SelectItem value="enviada">Enviada</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{gruposFiltrados.reduce((a, g) => a + g.faturas.length, 0)} faturas</span>
        {(filtroMes !== 'all' || filtroAno !== 'all' || filtroStatus !== 'todos' || busca) && (
          <button onClick={() => { setFiltroMes('all'); setFiltroAno('all'); setFiltroStatus('todos'); setBusca('') }} className="text-xs text-muted-foreground hover:text-foreground">✕ Limpar</button>
        )}
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total',     valor: total,     cor: 'text-foreground',  bg: 'bg-muted/50',      border: 'border-border' },
          { label: 'Pendentes', valor: pendentes, cor: 'text-yellow-500',  bg: 'bg-yellow-500/5',  border: 'border-yellow-500/20' },
          { label: 'Pagas',     valor: pagas,     cor: 'text-green-500',   bg: 'bg-green-500/5',   border: 'border-green-500/20' },
          { label: 'Atrasadas', valor: atrasadas, cor: 'text-red-500',     bg: 'bg-red-500/5',     border: 'border-red-500/20' },
        ].map(card => (
          <div key={card.label} className={`rounded-xl border ${card.border} ${card.bg} p-4`}>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">{card.label}</p>
            <p className={cn('text-2xl sm:text-3xl font-bold', card.cor)}>{card.valor}</p>
          </div>
        ))}
      </div>

      {/* Busca */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar por cliente ou UC..." className="pl-9" value={busca} onChange={e => setBusca(e.target.value)} />
      </div>

      {loading ? (
        <div className="text-muted-foreground text-sm">Carregando...</div>
      ) : (
        <div className="flex flex-col gap-3">
          {gruposFiltrados.map(g => {
            const gId    = g.usina?.id || 'sem-usina'
            const aberto = abertos.has(gId)
            const totalKwh = g.faturas.reduce((a, f) => a + Number(f.kwh_alocado || 0), 0)
            const totalVal = g.faturas.reduce((a, f) => a + Number(f.valor || 0), 0)
            const nPagas   = g.faturas.filter(f => f.status === 'paga').length
            const nPend    = g.faturas.filter(f => f.status === 'pendente' || f.status === 'atrasada').length

            return (
              <div key={gId} className="rounded-xl border border-border bg-card overflow-hidden">
                {/* Header grupo */}
                <div className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => toggleGrupo(gId)}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
                      <Sun size={16} className="text-yellow-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{g.usina?.nome || 'Sem Usina'}</p>
                      <p className="text-xs text-muted-foreground">{g.faturas.length} fatura{g.faturas.length !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-4">
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-semibold">{totalKwh.toLocaleString('pt-BR')} kWh</p>
                      <p className="text-xs text-muted-foreground">Total kWh</p>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-semibold text-green-500">{fmtMoeda(totalVal)}</p>
                      <p className="text-xs text-muted-foreground">Total R$</p>
                    </div>
                    <div className="hidden sm:flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-500/10 text-green-500">● {nPagas} PAGOS</span>
                      {nPend > 0 && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-yellow-500/10 text-yellow-500">● {nPend} PENDENTES</span>}
                    </div>
                    <div className="sm:hidden text-right">
                      <p className="text-sm font-semibold text-green-500">{fmtMoeda(totalVal)}</p>
                      <p className="text-[10px] text-muted-foreground">{nPagas}p · {nPend}pend</p>
                    </div>
                    {aberto ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
                  </div>
                </div>

                {/* Tabela */}
                {aberto && (
                  <div className="border-t border-border overflow-x-auto">
                    <table className="w-full text-sm min-w-[700px]">
                      <thead>
                        <tr className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
                          <th className="text-left px-4 py-2.5 font-medium">Cliente</th>
                          <th className="text-left px-4 py-2.5 font-medium">UC</th>
                          <th className="text-left px-4 py-2.5 font-medium">Leitura</th>
                          <th className="text-left px-4 py-2.5 font-medium">kWh</th>
                          <th className="text-left px-4 py-2.5 font-medium">Desconto</th>
                          <th className="text-left px-4 py-2.5 font-medium">Valor</th>
                          <th className="text-left px-4 py-2.5 font-medium">Vencimento</th>
                          <th className="text-left px-4 py-2.5 font-medium">Status</th>
                          <th className="text-left px-4 py-2.5 font-medium">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.faturas.map((f, i) => {
                          const st = statusConfig[f.status] || { label: f.status, cor: 'text-muted-foreground', bg: 'bg-muted', dot: 'bg-muted-foreground' }
                          const isPendente = f.status === 'pendente' || f.status === 'atrasada'
                          return (
                            <tr key={f.id} className={cn('border-t border-border/50 hover:bg-muted/20 transition-colors', i % 2 === 0 ? '' : 'bg-muted/10')}>
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary flex-shrink-0">
                                    {(f.beneficiario?.cliente?.nome || '?').substring(0, 2).toUpperCase()}
                                  </div>
                                  <span className="font-medium text-xs">{f.beneficiario?.cliente?.nome || '—'}</span>
                                </div>
                              </td>
                              <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{f.beneficiario?.uc_beneficiaria || '—'}</td>
                              <td className="px-4 py-2.5 text-xs text-muted-foreground">{fmtData(f.data_leitura)}</td>
                              <td className="px-4 py-2.5 text-xs">{Number(f.kwh_alocado).toFixed(0)} kWh</td>
                              <td className="px-4 py-2.5">
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-500/10 text-green-500">
                                  ↓ {Number(f.desconto_percentual || 0).toFixed(0)}%
                                </span>
                              </td>
                              <td className="px-4 py-2.5 font-semibold text-xs">{fmtMoeda(f.valor)}</td>
                              <td className="px-4 py-2.5 text-xs text-muted-foreground">{fmtData(f.data_vencimento)}</td>
                              <td className="px-4 py-2.5">
                                <div className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium', st.bg, st.cor)}>
                                  <div className={cn('w-1.5 h-1.5 rounded-full', st.dot)} />
                                  {st.label}
                                </div>
                              </td>
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-1">
                                  {/* PDF fatura */}
                                  <button onClick={e => baixarPDF(f, e)} className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="Baixar PDF">
                                    <FileText size={13} />
                                  </button>
                                  {/* Editar */}
                                  {isPendente && (
                                    <button onClick={e => { e.stopPropagation(); setFaturaSelecionada(f); setFormEditar({ valor: String(f.valor), kwh_alocado: String(f.kwh_alocado), tarifa_kwh: String(f.tarifa_kwh), desconto_percentual: String(f.desconto_percentual) }); setModalEditar(true) }}
                                      className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="Editar valor">
                                      <Edit size={13} />
                                    </button>
                                  )}
                                  {/* Boleto/PIX */}
                                  {f.pix_copia_cola ? (
                                    <button onClick={e => { e.stopPropagation(); setFaturaSelecionada(f); setPixCopied(false); setModalPix(true) }}
                                      className="p-1.5 rounded hover:bg-muted transition-colors text-green-500 hover:text-green-400" title="Ver PIX">
                                      <QrCode size={13} />
                                    </button>
                                  ) : isPendente ? (
                                    <button onClick={e => { e.stopPropagation(); setFaturaSelecionada(f); setErroBoleto(''); setModalBoleto(true) }}
                                      className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="Extrair PIX do boleto">
                                      <QrCode size={13} />
                                    </button>
                                  ) : null}
                                  {/* Confirmar */}
                                  {isPendente ? (
                                    <button onClick={e => { e.stopPropagation(); setFaturaSelecionada(f); setFormaPagamento('pix'); setModalPagar(true) }}
                                      className="px-2 py-1 rounded text-[10px] font-medium bg-green-500/10 text-green-500 hover:bg-green-500/20 transition-colors whitespace-nowrap" title="Confirmar pagamento">
                                      CONFIRMAR
                                    </button>
                                  ) : (
                                    <span className="px-2 py-1 rounded text-[10px] font-medium text-muted-foreground/50 whitespace-nowrap">
                                      PIX · {fmtComp(f.data_vencimento)}
                                    </span>
                                  )}
                                  {/* Excluir */}
                                  <button onClick={e => { e.stopPropagation(); setFaturaSelecionada(f); setModalExcluir(true) }}
                                    className="p-1.5 rounded hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive" title="Excluir">
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                        {/* Subtotal */}
                        <tr className="border-t border-border/50 bg-muted/20">
                          <td colSpan={3} className="px-4 py-2 text-xs text-muted-foreground">Subtotal do grupo</td>
                          <td className="px-4 py-2 text-xs font-medium text-green-500">{totalKwh.toLocaleString('pt-BR')} kWh</td>
                          <td />
                          <td className="px-4 py-2 text-xs font-medium text-green-500">{fmtMoeda(totalVal)}</td>
                          <td colSpan={3} />
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal pagar */}
      <Dialog open={modalPagar} onOpenChange={setModalPagar}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirmar pagamento</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div>
              <p className="text-sm text-muted-foreground">Cliente</p>
              <p className="font-medium">{faturaSelecionada?.beneficiario?.cliente?.nome}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Valor</p>
              <p className="font-medium text-lg text-green-500">{fmtMoeda(faturaSelecionada?.valor || 0)}</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Forma de pagamento</Label>
              <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="ted">TED</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalPagar(false)}>Cancelar</Button>
            <Button onClick={marcarPaga} disabled={loadingPagar}>
              <CheckCircle size={16} />
              {loadingPagar ? 'Confirmando...' : 'Confirmar pagamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal editar valor */}
      <Dialog open={modalEditar} onOpenChange={setModalEditar}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar valor da fatura</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <p className="text-xs text-muted-foreground">
              Altere o valor cobrado desta fatura. Os demais campos (kWh, tarifa, desconto) não serão afetados.
            </p>
            <div>
              <p className="text-sm text-muted-foreground">Cliente</p>
              <p className="font-medium">{faturaSelecionada?.beneficiario?.cliente?.nome}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>kWh alocado</Label>
                <Input type="number" value={formEditar.kwh_alocado} onChange={e => setFormEditar(p => ({ ...p, kwh_alocado: e.target.value, valor: '' }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Tarifa (R$/kWh)</Label>
                <Input type="number" step="0.000001" value={formEditar.tarifa_kwh} onChange={e => setFormEditar(p => ({ ...p, tarifa_kwh: e.target.value, valor: '' }))} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Desconto (%)</Label>
              <Input type="number" min={0} max={100} value={formEditar.desconto_percentual} onChange={e => setFormEditar(p => ({ ...p, desconto_percentual: e.target.value, valor: '' }))} />
            </div>

            {/* Preview calculado ao vivo */}
            {(() => {
              const kwh     = parseFloat(formEditar.kwh_alocado) || 0
              const tarifa  = parseFloat(formEditar.tarifa_kwh) || 0
              const desc    = parseFloat(formEditar.desconto_percentual) || 0
              const bruto   = kwh * tarifa
              const calculado = parseFloat((bruto - bruto * desc / 100).toFixed(2))
              return (
                <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-muted/50 border border-border">
                  <span className="text-sm text-muted-foreground">Valor calculado</span>
                  <span className="text-lg font-bold text-green-500">
                    {calculado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
              )
            })()}

            <div className="flex flex-col gap-1.5">
              <Label>Ou informe o valor manualmente (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={formEditar.valor}
                onChange={e => setFormEditar(p => ({ ...p, valor: e.target.value }))}
                placeholder="Deixe em branco para usar o valor calculado"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalEditar(false)}>Cancelar</Button>
            <Button onClick={salvarEdicao} disabled={loadingEditar}>
              {loadingEditar ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal excluir */}
      <Dialog open={modalExcluir} onOpenChange={setModalExcluir}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Excluir fatura</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir a fatura de{' '}
            <span className="font-medium text-foreground">{faturaSelecionada?.beneficiario?.cliente?.nome}</span>
            {' '}no valor de{' '}
            <span className="font-medium text-foreground">{fmtMoeda(faturaSelecionada?.valor || 0)}</span>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalExcluir(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={excluirFatura} disabled={loadingExcluir}>
              {loadingExcluir ? 'Excluindo...' : 'Confirmar exclusão'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal PIX */}
      <Dialog open={modalPix} onOpenChange={setModalPix}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>PIX copia e cola</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div>
              <p className="text-sm text-muted-foreground">Cliente</p>
              <p className="font-medium">{faturaSelecionada?.beneficiario?.cliente?.nome}</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Código PIX</Label>
              <div className="p-3 rounded-lg bg-muted font-mono text-xs break-all select-all">{faturaSelecionada?.pix_copia_cola}</div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalPix(false)}>Fechar</Button>
            <Button onClick={copiarPix}>
              <Copy size={14} />
              {pixCopied ? 'Copiado!' : 'Copiar código'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal boleto */}
      <Dialog open={modalBoleto} onOpenChange={setModalBoleto}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Extrair PIX do boleto</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <p className="text-sm text-muted-foreground">
              Envie o PDF do boleto Energisa para extrair o código PIX automaticamente.
            </p>
            <input ref={boletoRef} type="file" accept=".pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadBoleto(f) }} />
            <Button variant="outline" onClick={() => boletoRef.current?.click()} disabled={loadingBoleto}>
              {loadingBoleto ? 'Processando...' : 'Selecionar PDF do boleto'}
            </Button>
            {erroBoleto && <p className="text-sm text-destructive">{erroBoleto}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalBoleto(false)}>Cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal relatório */}
      <Dialog open={modalRelatorio} onOpenChange={setModalRelatorio}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Gerar relatório PDF</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>Usina</Label>
              <Select value={relUsina} onValueChange={setRelUsina}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as usinas</SelectItem>
                  {usinas.map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Mês</Label>
                <Select value={relMes} onValueChange={setRelMes}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['01','02','03','04','05','06','07','08','09','10','11','12'].map((m, i) => (
                      <SelectItem key={m} value={m}>{['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'][i]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Ano</Label>
                <Select value={relAno} onValueChange={setRelAno}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2025">2025</SelectItem>
                    <SelectItem value="2026">2026</SelectItem>
                    <SelectItem value="2027">2027</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {statusRel && <p className={`text-sm ${statusRel.includes('Erro') ? 'text-destructive' : 'text-green-500'}`}>{statusRel}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalRelatorio(false)}>Cancelar</Button>
            <Button onClick={gerarRelatorio} disabled={loadingRel}>
              <Download size={16} />
              {loadingRel ? 'Gerando...' : 'Gerar e baixar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}