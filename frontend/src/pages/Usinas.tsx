import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, Plus, Sun, Zap, Users, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { apiFetch } from '@/hooks/useApi'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Usina {
  id: string
  nome: string
  potencia_kwp: number
  distribuidora: string
  uc_geradora: string
  cidade: string
  estado: string
  tipo: string
  beneficiarios?: { id: string }[]
}

export default function Usinas() {
  const [usinas,          setUsinas]          = useState<Usina[]>([])
  const [busca,           setBusca]           = useState('')
  const [loading,         setLoading]         = useState(true)
  const [subTab,          setSubTab]          = useState<'usinas' | 'geracao'>('usinas')
  const [geracoes,        setGeracoes]        = useState<any[]>([])
  const [loadingGeracoes, setLoadingGeracoes] = useState(false)
  const [usinaFiltroGer,  setUsinaFiltroGer]  = useState('all')
  const [mesFiltroGer,    setMesFiltroGer]    = useState('all')
  const [anoFiltroGer,    setAnoFiltroGer]    = useState(new Date().getFullYear().toString())
  const [removendoBenef,  setRemovendoBenef]  = useState<string | null>(null)
  const [removendoUsina,  setRemovendoUsina]  = useState<string | null>(null)

  const [modalNova,     setModalNova]     = useState(false)
  const [loadingSalvar, setLoadingSalvar] = useState(false)
  const [erro,          setErro]          = useState('')
  const [form, setForm] = useState({
    nome: '', potencia_kwp: '', distribuidora: '',
    uc_geradora: '', cidade: '', estado: '', tipo: 'propria'
  })

  const [modalBenef,    setModalBenef]    = useState(false)
  const [usinaSelecionada, setUsinaSelecionada] = useState<Usina | null>(null)
  const [beneficiarios, setBeneficiarios] = useState<any[]>([])
  const [loadingBenef,  setLoadingBenef]  = useState(false)

  const [modalAddBenef,  setModalAddBenef]  = useState(false)
  const [clientes,       setClientes]       = useState<{ id: string; nome: string }[]>([])
  const [loadingAddBenef,setLoadingAddBenef]= useState(false)
  const [erroAddBenef,   setErroAddBenef]   = useState('')
  const [formBenef, setFormBenef] = useState({
    cliente_id: '', uc_beneficiaria: '', desconto_percentual: '0', dia_vencimento: '10',
  })

  async function excluirUsina(id: string, nome: string) {
    if (!confirm(`Excluir a usina "${nome}"?`)) return
    setRemovendoUsina(id)
    try {
      await apiFetch(`/api/usinas/${id}`, { method: 'DELETE' })
      await carregar()
    } catch (e: any) {
      alert(e.message || 'Erro ao excluir usina')
    } finally {
      setRemovendoUsina(null)
    }
  }

  async function carregar() {
    const r = await apiFetch<{ data: Usina[] }>('/api/usinas')
    setUsinas(r.data || [])
  }

  async function carregarGeracoes(usinaId: string) {
    if (!usinaId) return
    setLoadingGeracoes(true)
    const r = await apiFetch<{ data: any[] }>(`/api/geracoes/usina/${usinaId}`)
    setGeracoes(r.data || [])
    setLoadingGeracoes(false)
  }

  async function salvarUsina() {
    if (!form.nome || !form.potencia_kwp || !form.distribuidora || !form.uc_geradora) {
      setErro('Nome, potência, distribuidora e UC geradora são obrigatórios')
      return
    }
    setErro('')
    setLoadingSalvar(true)
    try {
      await apiFetch('/api/usinas', {
        method: 'POST',
        body: JSON.stringify({ ...form, potencia_kwp: Number(form.potencia_kwp) }),
      })
      setModalNova(false)
      setForm({ nome: '', potencia_kwp: '', distribuidora: '', uc_geradora: '', cidade: '', estado: '', tipo: 'propria' })
      await carregar()
    } catch {
      setErro('Erro ao salvar usina')
    } finally {
      setLoadingSalvar(false)
    }
  }

  async function abrirBeneficiarios(u: Usina) {
    setUsinaSelecionada(u)
    setModalBenef(true)
    setLoadingBenef(true)
    try {
      const r = await apiFetch<{ data: any[] }>(`/api/usinas/${u.id}/beneficiarios`)
      setBeneficiarios((r as any).data?.beneficiarios || [])
    } finally {
      setLoadingBenef(false)
    }
  }

  async function salvarBeneficiario() {
    if (!formBenef.cliente_id || !formBenef.uc_beneficiaria) {
      setErroAddBenef('Cliente e UC beneficiária são obrigatórios')
      return
    }
    setErroAddBenef('')
    setLoadingAddBenef(true)
    try {
      await apiFetch(`/api/usinas/${usinaSelecionada?.id}/beneficiarios`, {
        method: 'POST',
        body: JSON.stringify({
          cliente_id: formBenef.cliente_id,
          uc_beneficiaria: formBenef.uc_beneficiaria,
          desconto_percentual: Number(formBenef.desconto_percentual),
          dia_vencimento: Number(formBenef.dia_vencimento),
        }),
      })
      setModalAddBenef(false)
      setFormBenef({ cliente_id: '', uc_beneficiaria: '', desconto_percentual: '0', dia_vencimento: '10' })
      const r = await apiFetch<{ data: any[] }>(`/api/usinas/${usinaSelecionada?.id}/beneficiarios`)
      setBeneficiarios((r as any).data?.beneficiarios || [])
      setModalBenef(true)
    } finally {
      setLoadingAddBenef(false)
    }
  }

  async function removerBeneficiario(benefId: string) {
    if (!usinaSelecionada) return
    setRemovendoBenef(benefId)
    try {
      await apiFetch(`/api/usinas/${usinaSelecionada.id}/beneficiarios/${benefId}`, { method: 'DELETE' })
      const r = await apiFetch<{ data: any[] }>(`/api/usinas/${usinaSelecionada.id}/beneficiarios`)
      setBeneficiarios((r as any).data?.beneficiarios || [])
    } finally {
      setRemovendoBenef(null)
    }
  }

  useEffect(() => {
    carregar().finally(() => setLoading(false))
    apiFetch<{ data: { id: string; nome: string }[] }>('/api/clientes')
      .then(r => setClientes(r.data || []))
  }, [])

  const filtradas = usinas.filter(u =>
    u.nome.toLowerCase().includes(busca.toLowerCase()) ||
    u.cidade?.toLowerCase().includes(busca.toLowerCase()) ||
    u.uc_geradora?.includes(busca)
  )

  const potenciaTotal = usinas.reduce((acc, u) => acc + Number(u.potencia_kwp), 0)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Usinas</h1>
          <p className="text-muted-foreground text-sm mt-1">{usinas.length} usinas cadastradas</p>
        </div>
        <Button onClick={() => setModalNova(true)}>
          <Plus size={16} />
          Nova usina
        </Button>
      </div>

      <div className="flex gap-0 border border-border rounded-lg overflow-hidden w-fit">
        {[
          { label: 'Usinas', value: 'usinas' },
          { label: 'Histórico Geração', value: 'geracao' },
        ].map((t, i) => (
          <button
            key={t.value}
            onClick={() => setSubTab(t.value as any)}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors',
              i > 0 && 'border-l border-border',
              subTab === t.value ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === 'usinas' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Total de usinas', valor: usinas.length, sub: 'plantas cadastradas', icon: Sun, cor: 'text-yellow-500', bg: 'bg-yellow-500/10' },
              { label: 'Potência total', valor: `${potenciaTotal.toFixed(1)} kWp`, sub: 'capacidade instalada', icon: Zap, cor: 'text-blue-500', bg: 'bg-blue-500/10' },
              { label: 'Distribuidoras', valor: new Set(usinas.map(u => u.distribuidora)).size, sub: 'concessionárias', icon: Users, cor: 'text-green-500', bg: 'bg-green-500/10' },
            ].map(k => {
              const Icon = k.icon
              return (
                <div key={k.label} className="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${k.bg}`}>
                    <Icon size={18} className={k.cor} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{k.label}</p>
                    <p className={`text-lg sm:text-2xl font-bold leading-tight ${k.cor}`}>{k.valor}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{k.sub}</p>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, cidade ou UC geradora..."
              className="pl-9"
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="text-muted-foreground text-sm">Carregando...</div>
          ) : (
            <div className="rounded-lg border border-border overflow-x-auto">
              <table className="w-full text-sm min-w-[500px]">
                <thead>
                  <tr className="bg-muted text-muted-foreground">
                    <th className="text-left px-4 py-3 font-medium">Nome</th>
                    <th className="text-left px-4 py-3 font-medium">UC Geradora</th>
                    <th className="text-left px-4 py-3 font-medium">Potência</th>
                    <th className="text-left px-4 py-3 font-medium">Cidade</th>
                    <th className="text-left px-4 py-3 font-medium">Distribuidora</th>
                    <th className="text-left px-4 py-3 font-medium">Tipo</th>
                    <th className="text-left px-4 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-muted-foreground">Nenhuma usina encontrada</td>
                    </tr>
                  ) : (
                    filtradas.map((u, i) => (
                      <tr
                        key={u.id}
                        onClick={() => abrirBeneficiarios(u)}
                        className={cn('border-t border-border transition-colors hover:bg-muted/50 cursor-pointer', i % 2 === 0 ? 'bg-background' : 'bg-muted/20')}
                      >
                        <td className="px-4 py-3 font-medium">{u.nome}</td>
                        <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{u.uc_geradora}</td>
                        <td className="px-4 py-3 text-muted-foreground">{Number(u.potencia_kwp).toFixed(1)} kWp</td>
                        <td className="px-4 py-3 text-muted-foreground">{u.cidade || '—'}{u.estado ? ` / ${u.estado}` : ''}</td>
                        <td className="px-4 py-3 text-muted-foreground">{u.distribuidora}</td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                            u.tipo === 'propria' ? 'bg-green-500/10 text-green-500' :
                            'bg-blue-500/10 text-blue-500'
                          )}>
                            {u.tipo === 'propria' ? 'Própria' : 'Gerenciada'}
                          </span>
                        </td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => excluirUsina(u.id, u.nome)}
                            disabled={removendoUsina === u.id}
                            className="p-1.5 rounded hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive disabled:opacity-50"
                            title="Excluir usina"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {subTab === 'geracao' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={usinaFiltroGer} onValueChange={async v => {
              setUsinaFiltroGer(v)
              if (v && v !== 'all') carregarGeracoes(v)
              else {
                setLoadingGeracoes(true)
                const r = await apiFetch<{ data: any[] }>('/api/geracoes')
                setGeracoes(r.data || [])
                setLoadingGeracoes(false)
              }
            }}>
              <SelectTrigger className="w-52"><SelectValue placeholder="Selecione a usina" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as usinas</SelectItem>
                {usinas.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={mesFiltroGer} onValueChange={setMesFiltroGer}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Todos os meses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os meses</SelectItem>
                {['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'].map((m, i) => (
                  <SelectItem key={i} value={String(i + 1).padStart(2, '0')}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={anoFiltroGer} onValueChange={setAnoFiltroGer}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1].map(a => (
                  <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loadingGeracoes ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            (() => {
              const MESES_CURTO = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
              const filtradas = geracoes.filter(g => {
                const comp = g.competencia?.substring(0, 7) || ''
                const [y, m] = comp.split('-')
                if (mesFiltroGer && mesFiltroGer !== 'all' && m !== mesFiltroGer) return false
                if (anoFiltroGer && y !== anoFiltroGer) return false
                return true
              })
              if (filtradas.length === 0) return <p className="text-sm text-muted-foreground py-12 text-center">Nenhuma geração registrada para o período</p>
              return (
                <div className="rounded-lg border border-border overflow-x-auto">
                  <table className="w-full text-sm min-w-[400px]">
                    <thead>
                      <tr className="bg-muted text-muted-foreground">
                        <th className="text-left px-4 py-3 font-medium">Competência</th>
                        <th className="text-left px-4 py-3 font-medium">kWh Gerado</th>
                        <th className="text-left px-4 py-3 font-medium">Saldo Anterior</th>
                        <th className="text-left px-4 py-3 font-medium">Saldo Disponível</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtradas.map((g: any, i: number) => {
                        const comp = g.competencia?.substring(0, 7) || '—'
                        const [y, m] = comp.split('-')
                        const label = m ? `${MESES_CURTO[parseInt(m) - 1]}/${y?.substring(2)}` : comp
                        return (
                          <tr key={g.id || i} className={cn('border-t border-border', i % 2 === 0 ? 'bg-background' : 'bg-muted/20')}>
                            <td className="px-4 py-3 font-semibold">{label}</td>
                            <td className="px-4 py-3 font-bold text-green-500 font-mono">{Number(g.energia_gerada_kwh || 0).toLocaleString('pt-BR')} kWh</td>
                            <td className="px-4 py-3 text-muted-foreground font-mono">{Number(g.saldo_anterior || 0).toLocaleString('pt-BR')} kWh</td>
                            <td className="px-4 py-3 font-bold text-blue-400 font-mono">{Number(g.saldo_disponivel || 0).toLocaleString('pt-BR')} kWh</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )
            })()
          )}
        </div>
      )}

      {/* Modal nova usina */}
      <Dialog open={modalNova} onOpenChange={setModalNova}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nova usina</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>Nome *</Label>
              <Input placeholder="Nome da usina" value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Potência (kWp) *</Label>
                <Input type="number" placeholder="50.0" value={form.potencia_kwp} onChange={e => setForm(p => ({ ...p, potencia_kwp: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>UC Geradora *</Label>
                <Input placeholder="3652109" value={form.uc_geradora} onChange={e => setForm(p => ({ ...p, uc_geradora: e.target.value }))} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Distribuidora *</Label>
              <Input placeholder="Energisa MS" value={form.distribuidora} onChange={e => setForm(p => ({ ...p, distribuidora: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5 col-span-2">
                <Label>Cidade</Label>
                <Input placeholder="Bataguassu" value={form.cidade} onChange={e => setForm(p => ({ ...p, cidade: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>UF</Label>
                <Input placeholder="MS" maxLength={2} value={form.estado} onChange={e => setForm(p => ({ ...p, estado: e.target.value.toUpperCase() }))} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={v => setForm(p => ({ ...p, tipo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="propria">Própria</SelectItem>
                  <SelectItem value="gerenciada">Gerenciada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {erro && <p className="text-sm text-destructive">{erro}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalNova(false)}>Cancelar</Button>
            <Button onClick={salvarUsina} disabled={loadingSalvar}>{loadingSalvar ? 'Salvando...' : 'Salvar usina'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal beneficiários */}
      <Dialog open={modalBenef} onOpenChange={setModalBenef}>
        <DialogContent className="!max-w-3xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Beneficiários — {usinaSelecionada?.nome}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            {loadingBenef ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : beneficiarios.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Nenhum beneficiário cadastrado</p>
            ) : (
              <div className="rounded-lg border border-border overflow-x-auto max-h-[60vh]">
                <table className="w-full text-sm min-w-[500px]">
                  <thead>
                    <tr className="bg-muted text-muted-foreground whitespace-nowrap">
                      <th className="text-left px-4 py-3 font-medium">Cliente</th>
                      <th className="text-left px-4 py-3 font-medium">UC</th>
                      <th className="text-left px-4 py-3 font-medium">Rateio</th>
                      <th className="text-left px-4 py-3 font-medium">Desconto</th>
                      <th className="text-left px-4 py-3 font-medium">Status</th>
                      <th className="text-left px-4 py-3 font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {beneficiarios.map((b: any, i: number) => (
                      <tr key={b.id} className={cn('border-t border-border', i % 2 === 0 ? 'bg-background' : 'bg-muted/20')}>
                        <td className="px-4 py-3 font-medium whitespace-nowrap">{b.cliente?.nome || '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground font-mono text-xs whitespace-nowrap">{b.uc_beneficiaria}</td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{Number(b.percentual_rateio).toFixed(1)}%</td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{Number(b.desconto_percentual).toFixed(1)}%</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Badge variant={b.ativo ? 'default' : 'secondary'}>{b.ativo ? 'Ativo' : 'Inativo'}</Badge>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button
                            onClick={() => removerBeneficiario(b.id)}
                            disabled={removendoBenef === b.id}
                            className="p-1.5 rounded hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive disabled:opacity-50"
                            title="Remover beneficiário"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalBenef(false)}>Fechar</Button>
            <Button onClick={() => { setModalBenef(false); setModalAddBenef(true) }}>Adicionar beneficiário</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal adicionar beneficiário */}
      <Dialog open={modalAddBenef} onOpenChange={setModalAddBenef}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar beneficiário — {usinaSelecionada?.nome}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>Cliente *</Label>
              <Select value={formBenef.cliente_id} onValueChange={v => setFormBenef(p => ({ ...p, cliente_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                <SelectContent>
                  {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>UC Beneficiária *</Label>
              <Input placeholder="3647072" value={formBenef.uc_beneficiaria} onChange={e => setFormBenef(p => ({ ...p, uc_beneficiaria: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Desconto (%)</Label>
                <Input type="number" min={0} max={100} value={formBenef.desconto_percentual} onChange={e => setFormBenef(p => ({ ...p, desconto_percentual: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Dia vencimento</Label>
                <Input type="number" min={1} max={28} value={formBenef.dia_vencimento} onChange={e => setFormBenef(p => ({ ...p, dia_vencimento: e.target.value }))} />
              </div>
            </div>
            {erroAddBenef && <p className="text-sm text-destructive">{erroAddBenef}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setModalAddBenef(false); setModalBenef(true) }}>Cancelar</Button>
            <Button onClick={salvarBeneficiario} disabled={loadingAddBenef}>{loadingAddBenef ? 'Salvando...' : 'Adicionar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}