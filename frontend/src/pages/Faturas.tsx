import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Search, Download, Trash2, Edit, QrCode } from 'lucide-react'
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
  kwh_alocado: number
  tarifa_kwh: number
  desconto_percentual: number
  pix_copia_cola: string
  beneficiario?: {
    uc_beneficiaria: string
    cliente?: { nome: string }
    usina?: { nome: string }
  }
}

const statusConfig: Record<string, { label: string; cor: string; bg: string; dot: string }> = {
  pendente:  { label: 'Pendente',  cor: 'text-yellow-500', bg: 'bg-yellow-500/10', dot: 'bg-yellow-500' },
  paga:      { label: 'Paga',      cor: 'text-green-500',  bg: 'bg-green-500/10',  dot: 'bg-green-500' },
  atrasada:  { label: 'Atrasada',  cor: 'text-red-500',    bg: 'bg-red-500/10',    dot: 'bg-red-500' },
  enviada:   { label: 'Enviada',   cor: 'text-blue-500',   bg: 'bg-blue-500/10',   dot: 'bg-blue-500' },
  negociada: { label: 'Negociada', cor: 'text-purple-500', bg: 'bg-purple-500/10', dot: 'bg-purple-500' },
}


function fmtMoeda(v: number) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtData(d: string) {
  if (!d) return '—'
  const [yyyy, mm, dd] = d.substring(0, 10).split('-')
  return `${dd}/${mm}/${yyyy}`
}

function fmtComp(d: string) {
  if (!d) return '—'
  const dt = new Date(d + 'T12:00:00')
  return `${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`
}

export default function Faturas() {
  const [faturas, setFaturas] = useState<Fatura[]>([])
  const [usinas, setUsinas] = useState<{ id: string; nome: string }[]>([])
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [filtroMes, setFiltroMes] = useState('all')
  const [filtroAno, setFiltroAno] = useState('all')

  // Modal pagar
  const [modalPagar, setModalPagar] = useState(false)
  const [faturaSelecionada, setFaturaSelecionada] = useState<Fatura | null>(null)
  const [formaPagamento, setFormaPagamento] = useState('pix')
  const [loadingPagar, setLoadingPagar] = useState(false)

  // Modal editar valor
  const [modalEditar, setModalEditar] = useState(false)
  const [formEditar, setFormEditar] = useState({ valor: '', kwh_alocado: '', tarifa_kwh: '', desconto_percentual: '' })
  const [loadingEditar, setLoadingEditar] = useState(false)

  // Modal excluir
  const [modalExcluir, setModalExcluir] = useState(false)
  const [loadingExcluir, setLoadingExcluir] = useState(false)

  // Modal PIX
  const [modalPix, setModalPix] = useState(false)
  const [pixCopied, setPixCopied] = useState(false)

  // Modal relatório
  const [modalRelatorio, setModalRelatorio] = useState(false)
  const [relMes, setRelMes] = useState(String(new Date().getMonth() + 1).padStart(2, '0'))
  const [relAno, setRelAno] = useState(String(new Date().getFullYear()))
  const [relUsina, setRelUsina] = useState('all')
  const [loadingRel, setLoadingRel] = useState(false)
  const [statusRel, setStatusRel] = useState('')

  async function carregar() {
    const r = await apiFetch<{ data: Fatura[] }>('/api/faturas')
    setFaturas(r.data || [])
  }

  useEffect(() => {
    carregar().finally(() => setLoading(false))
    apiFetch<{ data: { id: string; nome: string }[] }>('/api/usinas')
      .then(r => setUsinas(r.data || []))
  }, [])

  function abrirFatura(f: Fatura) {
    setFaturaSelecionada(f)
    if (f.status !== 'paga') {
      setFormaPagamento('pix')
      setModalPagar(true)
    }
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

  function abrirEditar(f: Fatura, e: React.MouseEvent) {
    e.stopPropagation()
    setFaturaSelecionada(f)
    setFormEditar({
      valor: String(f.valor),
      kwh_alocado: String(f.kwh_alocado),
      tarifa_kwh: String(f.tarifa_kwh),
      desconto_percentual: String(f.desconto_percentual),
    })
    setModalEditar(true)
  }

  async function salvarEdicao() {
    if (!faturaSelecionada) return
    setLoadingEditar(true)
    try {
      await apiFetch(`/api/faturas/${faturaSelecionada.id}/valor`, {
        method: 'PATCH',
        body: JSON.stringify({
          valor: Number(formEditar.valor),
          kwh_alocado: Number(formEditar.kwh_alocado),
          tarifa_kwh: Number(formEditar.tarifa_kwh),
          desconto_percentual: Number(formEditar.desconto_percentual),
        }),
      })
      setModalEditar(false)
      await carregar()
    } finally {
      setLoadingEditar(false)
    }
  }

  function abrirExcluir(f: Fatura, e: React.MouseEvent) {
    e.stopPropagation()
    setFaturaSelecionada(f)
    setModalExcluir(true)
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

  function abrirPix(f: Fatura, e: React.MouseEvent) {
    e.stopPropagation()
    setFaturaSelecionada(f)
    setPixCopied(false)
    setModalPix(true)
  }

  function copiarPix() {
    if (!faturaSelecionada?.pix_copia_cola) return
    navigator.clipboard.writeText(faturaSelecionada.pix_copia_cola)
    setPixCopied(true)
    setTimeout(() => setPixCopied(false), 2000)
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

      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (!res.ok) {
        setStatusRel('Erro ao gerar relatório')
        return
      }

      const pdfBlob = await res.blob()
      const pdfUrl = URL.createObjectURL(pdfBlob)
      const a = document.createElement('a')
      a.href = pdfUrl
      a.download = `relatorio-acelivre-${relMes}-${relAno}.pdf`
      a.click()
      URL.revokeObjectURL(pdfUrl)
      setStatusRel('Relatório gerado com sucesso')
      setTimeout(() => setModalRelatorio(false), 1500)
    } finally {
      setLoadingRel(false)
    }
  }

  const filtradas = faturas.filter(f => {
  const nome = f.beneficiario?.cliente?.nome?.toLowerCase() || ''
  const uc   = f.beneficiario?.uc_beneficiaria?.toLowerCase() || ''
  const q    = busca.toLowerCase()
  const comp = f.competencia ? f.competencia.substring(0, 7) : ''
  const matchBusca  = nome.includes(q) || uc.includes(q)
  const matchStatus = filtroStatus === 'todos' || f.status === filtroStatus
  const matchMes = filtroMes === 'all' || !filtroMes || comp.substring(5, 7) === filtroMes
  const matchAno = filtroAno === 'all' || !filtroAno || comp.substring(0, 4) === filtroAno
  return matchBusca && matchStatus && matchMes && matchAno
})

const total     = faturas.length
const pendentes = faturas.filter(f => f.status === 'pendente').length
const pagas     = faturas.filter(f => f.status === 'paga').length
const atrasadas = faturas.filter(f => f.status === 'atrasada').length

return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Faturas</h1>
          <p className="text-muted-foreground text-sm mt-1">{total} faturas no total</p>
        </div>
        <Button variant="outline" onClick={() => setModalRelatorio(true)}>
          <Download size={16} />
          Relatório PDF
        </Button>
      </div>


      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs text-muted-foreground">Filtrar por</span>

        <Select value={filtroMes} onValueChange={setFiltroMes}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Todos os meses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os meses</SelectItem>
            {['01','02','03','04','05','06','07','08','09','10','11','12'].map((m, i) => (
              <SelectItem key={m} value={m}>
                {['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'][i]}
              </SelectItem>
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

        <span className="text-xs text-muted-foreground">{filtradas.length} fatura{filtradas.length !== 1 ? 's' : ''}</span>

        {(filtroMes !== 'all' || filtroAno !== 'all' || filtroStatus !== 'todos' || busca) && (
          <button
            onClick={() => { setFiltroMes('all'); setFiltroAno('all'); setFiltroStatus('todos'); setBusca('') }}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            ✕ Limpar
          </button>
        )}
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total',     valor: total,     cor: 'text-foreground',  bg: 'bg-muted/50',        border: 'border-border' },
          { label: 'Pendentes', valor: pendentes, cor: 'text-yellow-500',  bg: 'bg-yellow-500/5',    border: 'border-yellow-500/20' },
          { label: 'Pagas',     valor: pagas,     cor: 'text-green-500',   bg: 'bg-green-500/5',     border: 'border-green-500/20' },
          { label: 'Atrasadas', valor: atrasadas, cor: 'text-red-500',     bg: 'bg-red-500/5',       border: 'border-red-500/20' },
        ].map(card => (
          <div key={card.label} className={`rounded-xl border ${card.border} ${card.bg} p-4`}>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">{card.label}</p>
            <p className={cn('text-3xl font-bold', card.cor)}>{card.valor}</p>
          </div>
        ))}
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por cliente ou UC..."
          className="pl-9"
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="text-muted-foreground text-sm">Carregando...</div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted text-muted-foreground">
                <th className="text-left px-4 py-3 font-medium">Cliente</th>
                <th className="text-left px-4 py-3 font-medium">UC</th>
                <th className="text-left px-4 py-3 font-medium">Competência</th>
                <th className="text-left px-4 py-3 font-medium">Vencimento</th>
                <th className="text-left px-4 py-3 font-medium">kWh</th>
                <th className="text-left px-4 py-3 font-medium">Valor</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted-foreground">
                    Nenhuma fatura encontrada
                  </td>
                </tr>
              ) : (
                filtradas.map((f, i) => {
                  const st = statusConfig[f.status] || { label: f.status, variant: 'outline' as const }
                  return (
                    <tr
                      key={f.id}
                      onClick={() => abrirFatura(f)}
                      className={cn(
                        'border-t border-border transition-colors hover:bg-muted/50',
                        f.status !== 'paga' ? 'cursor-pointer' : 'cursor-default',
                        i % 2 === 0 ? 'bg-background' : 'bg-muted/20'
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">
                            {(f.beneficiario?.cliente?.nome || '?').substring(0, 2).toUpperCase()}
                          </div>
                          <span className="font-medium">{f.beneficiario?.cliente?.nome || '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{f.beneficiario?.uc_beneficiaria || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{fmtComp(f.competencia)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{fmtData(f.data_vencimento)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{Number(f.kwh_alocado).toFixed(0)} kWh</td>
                      <td className="px-4 py-3 font-medium">{fmtMoeda(f.valor)}</td>
                      <td className="px-4 py-3">
                        {(() => {
                          const st = statusConfig[f.status] || { label: f.status, cor: 'text-muted-foreground', bg: 'bg-muted', dot: 'bg-muted-foreground' }
                          return (
                            <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${st.bg} ${st.cor}`}>
                              <div className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                              {st.label}
                            </div>
                          )
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {f.pix_copia_cola && (
                            <button
                              onClick={e => abrirPix(f, e)}
                              className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                              title="Ver PIX"
                            >
                              <QrCode size={15} />
                            </button>
                          )}
                          {f.status !== 'paga' && (
                            <button
                              onClick={e => abrirEditar(f, e)}
                              className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                              title="Editar valor"
                            >
                              <Edit size={15} />
                            </button>
                          )}
                          <button
                            onClick={e => abrirExcluir(f, e)}
                            className="p-1.5 rounded hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                            title="Excluir fatura"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal pagar */}
      <Dialog open={modalPagar} onOpenChange={setModalPagar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar como paga</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div>
              <p className="text-sm text-muted-foreground">Cliente</p>
              <p className="font-medium">{faturaSelecionada?.beneficiario?.cliente?.nome}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Valor</p>
              <p className="font-medium text-lg">{fmtMoeda(faturaSelecionada?.valor || 0)}</p>
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
              {loadingPagar ? 'Salvando...' : 'Confirmar pagamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal editar valor */}
      <Dialog open={modalEditar} onOpenChange={setModalEditar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar valor da fatura</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div>
              <p className="text-sm text-muted-foreground">Cliente</p>
              <p className="font-medium">{faturaSelecionada?.beneficiario?.cliente?.nome}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>kWh alocado</Label>
                <Input
                  type="number"
                  value={formEditar.kwh_alocado}
                  onChange={e => setFormEditar(p => ({ ...p, kwh_alocado: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Tarifa kWh</Label>
                <Input
                  type="number"
                  step="0.000001"
                  value={formEditar.tarifa_kwh}
                  onChange={e => setFormEditar(p => ({ ...p, tarifa_kwh: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Desconto (%)</Label>
                <Input
                  type="number"
                  min={0} max={100}
                  value={formEditar.desconto_percentual}
                  onChange={e => setFormEditar(p => ({ ...p, desconto_percentual: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Valor final (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formEditar.valor}
                  onChange={e => setFormEditar(p => ({ ...p, valor: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalEditar(false)}>Cancelar</Button>
            <Button onClick={salvarEdicao} disabled={loadingEditar}>
              {loadingEditar ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal excluir */}
      <Dialog open={modalExcluir} onOpenChange={setModalExcluir}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir fatura</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir a fatura de{' '}
            <span className="font-medium text-foreground">
              {faturaSelecionada?.beneficiario?.cliente?.nome}
            </span>
            {' '}no valor de{' '}
            <span className="font-medium text-foreground">
              {fmtMoeda(faturaSelecionada?.valor || 0)}
            </span>?
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
          <DialogHeader>
            <DialogTitle>PIX copia e cola</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div>
              <p className="text-sm text-muted-foreground">Cliente</p>
              <p className="font-medium">{faturaSelecionada?.beneficiario?.cliente?.nome}</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Código PIX</Label>
              <div className="p-3 rounded-lg bg-muted font-mono text-xs break-all select-all">
                {faturaSelecionada?.pix_copia_cola}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalPix(false)}>Fechar</Button>
            <Button onClick={copiarPix}>
              {pixCopied ? 'Copiado!' : 'Copiar código'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal relatório */}
      <Dialog open={modalRelatorio} onOpenChange={setModalRelatorio}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Gerar relatório PDF</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>Usina</Label>
              <Select value={relUsina} onValueChange={setRelUsina}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as usinas</SelectItem>
                  {usinas.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                  ))}
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
                      <SelectItem key={m} value={m}>
                        {['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'][i]}
                      </SelectItem>
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
            {statusRel && (
              <p className={`text-sm ${statusRel.includes('Erro') ? 'text-destructive' : 'text-green-500'}`}>
                {statusRel}
              </p>
            )}
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