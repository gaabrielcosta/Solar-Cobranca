import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { apiFetch } from '@/hooks/useApi'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Download } from 'lucide-react'

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

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pendente:  { label: 'Pendente',  variant: 'outline' },
  paga:      { label: 'Paga',      variant: 'default' },
  atrasada:  { label: 'Atrasada',  variant: 'destructive' },
  enviada:   { label: 'Enviada',   variant: 'secondary' },
  negociada: { label: 'Negociada', variant: 'secondary' },
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
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(true)
  const [modalPagar, setModalPagar] = useState(false)
  const [faturaSelecionada, setFaturaSelecionada] = useState<Fatura | null>(null)
  const [formaPagamento, setFormaPagamento] = useState('pix')
  const [loadingPagar, setLoadingPagar] = useState(false)
  const [modalRelatorio, setModalRelatorio] = useState(false)
  const [relMes, setRelMes] = useState(String(new Date().getMonth() + 1).padStart(2, '0'))
  const [relAno, setRelAno] = useState(String(new Date().getFullYear()))
  const [loadingRel, setLoadingRel] = useState(false)
  const [statusRel, setStatusRel] = useState('')
  const [usinas, setUsinas] = useState<{ id: string; nome: string }[]>([])
  const [relUsina, setRelUsina] = useState('all')

  async function carregar() {
    const r = await apiFetch<{ data: Fatura[] }>('/api/faturas')
    setFaturas(r.data || [])
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
      setFaturaSelecionada(null)
      await carregar()
    } finally {
      setLoadingPagar(false)
    }
  }

  async function gerarRelatorio() {
  setLoadingRel(true)
  setStatusRel('')
  try {
    const comp = `${relAno}-${relMes}-01`
    const token = localStorage.getItem('token')
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) {
      setStatusRel('Erro ao gerar relatório')
      return
    }
    const blob = await res.blob()
    const url = relUsina && relUsina !== 'all'
      ? `/api/faturas/relatorio/${comp}?usina=${relUsina}`
      : `/api/faturas/relatorio/${comp}`
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

  useEffect(() => {
  carregar().finally(() => setLoading(false))
  apiFetch<{ data: { id: string; nome: string }[] }>('/api/usinas')
    .then(r => setUsinas(r.data || []))
}, [])

  const filtradas = faturas.filter(f => {
    const nome = f.beneficiario?.cliente?.nome?.toLowerCase() || ''
    const uc   = f.beneficiario?.uc_beneficiaria?.toLowerCase() || ''
    const q    = busca.toLowerCase()
    return nome.includes(q) || uc.includes(q)
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

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total',     valor: total,     cor: 'text-foreground' },
          { label: 'Pendentes', valor: pendentes,  cor: 'text-yellow-500' },
          { label: 'Pagas',     valor: pagas,      cor: 'text-green-500' },
          { label: 'Atrasadas', valor: atrasadas,  cor: 'text-red-500' },
        ].map(card => (
          <div key={card.label} className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">{card.label}</p>
            <p className={cn('text-2xl font-semibold', card.cor)}>{card.valor}</p>
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
              </tr>
            </thead>
            <tbody>
              {filtradas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground">
                    Nenhuma fatura encontrada
                  </td>
                </tr>
              ) : (
                filtradas.map((f, i) => {
                  const st = statusConfig[f.status] || { label: f.status, variant: 'outline' as const }
                  return (
                    <tr
                      key={f.id}
                      onClick={() => {
                        if (f.status !== 'paga') {
                          setFaturaSelecionada(f)
                          setModalPagar(true)
                        }
                      }}
                      className={cn(
                        'border-t border-border transition-colors hover:bg-muted/50',
                        f.status !== 'paga' ? 'cursor-pointer' : 'cursor-default',
                        i % 2 === 0 ? 'bg-background' : 'bg-muted/20'
                      )}
                    >
                      <td className="px-4 py-3 font-medium">{f.beneficiario?.cliente?.nome || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{f.beneficiario?.uc_beneficiaria || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{fmtComp(f.competencia)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{fmtData(f.data_vencimento)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{Number(f.kwh_alocado).toFixed(0)} kWh</td>
                      <td className="px-4 py-3 font-medium">{fmtMoeda(f.valor)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

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
              <label className="text-sm font-medium">Forma de pagamento</label>
              <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
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
            <Button variant="outline" onClick={() => setModalPagar(false)}>
              Cancelar
            </Button>
            <Button onClick={marcarPaga} disabled={loadingPagar}>
              {loadingPagar ? 'Salvando...' : 'Confirmar pagamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={modalRelatorio} onOpenChange={setModalRelatorio}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerar relatório PDF</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-sm font-medium">Mês</label>
                <Select value={relMes} onValueChange={setRelMes}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(m => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium">Ano</label>
                <Select value={relAno} onValueChange={setRelAno}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i)).map(a => (
                      <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label>Usina</label>
                <Select value={relUsina} onValueChange={setRelUsina}>
                    <SelectTrigger>
                    <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                    <SelectItem value="all">Todas as usinas</SelectItem>
                    {usinas.map(u => (
                        <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                    ))}
                    </SelectContent>
                </Select>
                </div>
            </div>
            {statusRel && <p className="text-sm text-muted-foreground">{statusRel}</p>}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalRelatorio(false)}>Cancelar</Button>
            <Button onClick={gerarRelatorio} disabled={loadingRel}>
              {loadingRel ? 'Gerando...' : 'Gerar PDF'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}