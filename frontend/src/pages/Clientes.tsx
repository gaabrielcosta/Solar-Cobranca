import { useEffect, useState, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Search, UserPlus, ChevronDown, ChevronUp, Sun, Edit, Trash2, BarChart2, TrendingUp, Zap, DollarSign } from 'lucide-react'
import { cn } from '@/lib/utils'
import { apiFetch } from '@/hooks/useApi'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

interface Cliente {
  id: string
  nome: string
  telefone: string
  email: string
  cidade: string
  ativo: boolean
  cpf_cnpj: string
  cep: string
  logradouro: string
  numero: string
  bairro: string
  estado_endereco: string
  uc_beneficiaria: string
  dia_vencimento: number
  desconto_percentual: number
}

interface Usina {
  id: string
  nome: string
  potencia_kwp: number
  distribuidora: string
  uc_geradora: string
  cidade: string
  estado: string
}

interface Beneficiario {
  id: string
  uc_beneficiaria: string
  desconto_percentual: number
  percentual_rateio: number
  ativo: boolean
  cliente?: Cliente
}

interface GrupoUsina {
  usina: Usina | null
  beneficiarios: Beneficiario[]
}

interface NovoCliente {
  nome: string; telefone: string; email: string; cpf_cnpj: string
  cep: string; logradouro: string; numero: string; bairro: string
  cidade: string; estado_endereco: string; uc_beneficiaria: string
  dia_vencimento: string; desconto_percentual: string
}

export default function Clientes() {
  const [grupos,    setGrupos]    = useState<GrupoUsina[]>([])
  const [clientes,  setClientes]  = useState<Cliente[]>([])
  const [busca,     setBusca]     = useState('')
  const [loading,   setLoading]   = useState(true)
  const [abertos,   setAbertos]   = useState<Set<string>>(new Set(['sem-usina']))

  const [loadingCSV,    setLoadingCSV]    = useState(false)
  const csvRef = useRef<HTMLInputElement>(null)

  const [modalHistorico,    setModalHistorico]    = useState(false)
  const [clienteHistorico,  setClienteHistorico]  = useState<Cliente | null>(null)
  const [historicoFaturas,  setHistoricoFaturas]  = useState<any[]>([])
  const [loadingHistorico,  setLoadingHistorico]  = useState(false)

  const [modalNovo,     setModalNovo]     = useState(false)
  const [loadingSalvar, setLoadingSalvar] = useState(false)
  const [erro,          setErro]          = useState('')
  const [form, setForm] = useState<NovoCliente>({
    nome: '', telefone: '', email: '', cpf_cnpj: '',
    cep: '', logradouro: '', numero: '', bairro: '',
    cidade: '', estado_endereco: '', uc_beneficiaria: '',
    dia_vencimento: '10', desconto_percentual: '0'
  })

  const [modalEditar,       setModalEditar]       = useState(false)
  const [clienteSelecionado,setClienteSelecionado] = useState<Cliente | null>(null)
  const [formEditar,        setFormEditar]         = useState<NovoCliente>({
    nome: '', telefone: '', email: '', cpf_cnpj: '',
    cep: '', logradouro: '', numero: '', bairro: '',
    cidade: '', estado_endereco: '', uc_beneficiaria: '',
    dia_vencimento: '10', desconto_percentual: '0'
  })
  const [loadingEditar, setLoadingEditar] = useState(false)
  const [erroEditar,    setErroEditar]    = useState('')
  const [modalExcluir,  setModalExcluir]  = useState(false)
  const [loadingExcluir,setLoadingExcluir]= useState(false)

  async function carregar() {
    const [clientesRes, usinasRes] = await Promise.all([
      apiFetch<{ data: Cliente[] }>('/api/clientes'),
      apiFetch<{ data: Usina[] }>('/api/usinas'),
    ])

    const clientesData = clientesRes.data || []
    const usinasData   = usinasRes.data || []
    setClientes(clientesData)

    // Busca beneficiários de cada usina
    const gruposTemp: GrupoUsina[] = []
    const clientesVinculados = new Set<string>()

    for (const usina of usinasData) {
      const r = await apiFetch<any>(`/api/usinas/${usina.id}/beneficiarios`)
      const benefs: Beneficiario[] = r?.data?.beneficiarios || []
      benefs.forEach(b => { if (b.cliente?.id) clientesVinculados.add(b.cliente.id) })
      gruposTemp.push({ usina, beneficiarios: benefs })
    }

    // Clientes sem usina
    const semUsina = clientesData.filter(c => !clientesVinculados.has(c.id))
    if (semUsina.length > 0) {
      gruposTemp.push({
        usina: null,
        beneficiarios: semUsina.map(c => ({
          id: c.id,
          uc_beneficiaria: c.uc_beneficiaria || '—',
          desconto_percentual: c.desconto_percentual || 0,
          percentual_rateio: 0,
          ativo: c.ativo,
          cliente: c,
        }))
      })
    }

    setGrupos(gruposTemp)
    // Abre todos os grupos por padrão
    setAbertos(new Set(gruposTemp.map(g => g.usina?.id || 'sem-usina')))
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

  function abrirEditar(c: Cliente) {
    setClienteSelecionado(c)
    setFormEditar({
      nome: c.nome || '', telefone: c.telefone || '', email: c.email || '',
      cpf_cnpj: c.cpf_cnpj || '', cep: c.cep || '', logradouro: c.logradouro || '',
      numero: c.numero || '', bairro: c.bairro || '', cidade: c.cidade || '',
      estado_endereco: c.estado_endereco || '', uc_beneficiaria: c.uc_beneficiaria || '',
      dia_vencimento: String(c.dia_vencimento || 10),
      desconto_percentual: String(c.desconto_percentual || 0),
    })
    setErroEditar('')
    setModalEditar(true)
  }

  async function abrirHistorico(c: Cliente) {
    setClienteHistorico(c)
    setModalHistorico(true)
    setLoadingHistorico(true)
    try {
      const r = await apiFetch<{ data: any[] }>('/api/faturas')
      const faturas = (r.data || []).filter((f: any) => f.beneficiario?.cliente?.id === c.id)
      setHistoricoFaturas(faturas)
    } finally {
      setLoadingHistorico(false)
    }
  }

  async function importarCSV(file: File) {
    setLoadingCSV(true)
    const token = localStorage.getItem('token')
    const formData = new FormData()
    formData.append('csv', file)
    try {
      const res = await fetch('/api/clientes/importar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const data = await res.json()
      if (!res.ok || !data.sucesso) {
        alert(data.erro || 'Erro ao importar CSV')
        return
      }
      alert(`Importados: ${data.importados || 0}, Atualizados: ${data.atualizados || 0}`)
      await carregar()
    } catch {
      alert('Erro ao importar CSV')
    } finally {
      setLoadingCSV(false)
      if (csvRef.current) csvRef.current.value = ''
    }
  }

  async function salvarCliente() {
    if (!form.nome || !form.cpf_cnpj || !form.telefone) {
      setErro('Nome, CPF/CNPJ e telefone são obrigatórios')
      return
    }
    setErro('')
    setLoadingSalvar(true)
    try {
      await apiFetch('/api/clientes', {
        method: 'POST',
        body: JSON.stringify({ ...form, dia_vencimento: Number(form.dia_vencimento), desconto_percentual: Number(form.desconto_percentual) }),
      })
      setModalNovo(false)
      setForm({ nome: '', telefone: '', email: '', cpf_cnpj: '', cep: '', logradouro: '', numero: '', bairro: '', cidade: '', estado_endereco: '', uc_beneficiaria: '', dia_vencimento: '10', desconto_percentual: '0' })
      await carregar()
    } catch {
      setErro('Erro ao salvar cliente')
    } finally {
      setLoadingSalvar(false)
    }
  }

  async function salvarEdicao() {
    if (!formEditar.nome || !formEditar.cpf_cnpj || !formEditar.telefone) {
      setErroEditar('Nome, CPF/CNPJ e telefone são obrigatórios')
      return
    }
    setLoadingEditar(true)
    try {
      await apiFetch(`/api/clientes/${clienteSelecionado?.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...formEditar, dia_vencimento: Number(formEditar.dia_vencimento), desconto_percentual: Number(formEditar.desconto_percentual) }),
      })
      setModalEditar(false)
      await carregar()
    } catch {
      setErroEditar('Erro ao salvar alterações')
    } finally {
      setLoadingEditar(false)
    }
  }

  async function excluirCliente() {
    if (!clienteSelecionado) return
    setLoadingExcluir(true)
    try {
      await apiFetch(`/api/clientes/${clienteSelecionado.id}`, { method: 'DELETE' })
      setModalExcluir(false)
      setModalEditar(false)
      await carregar()
    } finally {
      setLoadingExcluir(false)
    }
  }

  const q = busca.toLowerCase()
  const gruposFiltrados = grupos.map(g => ({
    ...g,
    beneficiarios: g.beneficiarios.filter(b =>
      !q ||
      b.cliente?.nome?.toLowerCase().includes(q) ||
      b.uc_beneficiaria?.includes(q) ||
      b.cliente?.cpf_cnpj?.includes(q) ||
      b.cliente?.telefone?.includes(q)
    )
  })).filter(g => g.beneficiarios.length > 0)

  const totalClientes = clientes.length

  const FormFields = ({ f, setF }: { f: NovoCliente; setF: (fn: (p: NovoCliente) => NovoCliente) => void }) => (
    <div className="flex flex-col gap-4 py-2">
      <div className="flex flex-col gap-1.5">
        <Label>Nome *</Label>
        <Input placeholder="Nome completo" value={f.nome} onChange={e => setF(p => ({ ...p, nome: e.target.value }))} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>Telefone *</Label>
          <Input placeholder="(67) 99999-9999" value={f.telefone} onChange={e => setF(p => ({ ...p, telefone: e.target.value }))} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>CPF/CNPJ *</Label>
          <Input placeholder="000.000.000-00" value={f.cpf_cnpj} onChange={e => setF(p => ({ ...p, cpf_cnpj: e.target.value }))} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Email</Label>
        <Input placeholder="email@exemplo.com" value={f.email} onChange={e => setF(p => ({ ...p, email: e.target.value }))} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>UC Beneficiária</Label>
        <Input placeholder="3647072" value={f.uc_beneficiaria} onChange={e => setF(p => ({ ...p, uc_beneficiaria: e.target.value }))} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="flex flex-col gap-1.5 col-span-2">
          <Label>Logradouro</Label>
          <Input placeholder="Rua, Av..." value={f.logradouro} onChange={e => setF(p => ({ ...p, logradouro: e.target.value }))} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Número</Label>
          <Input placeholder="123" value={f.numero} onChange={e => setF(p => ({ ...p, numero: e.target.value }))} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>Bairro</Label>
          <Input value={f.bairro} onChange={e => setF(p => ({ ...p, bairro: e.target.value }))} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Cidade</Label>
          <Input placeholder="Bataguassu" value={f.cidade} onChange={e => setF(p => ({ ...p, cidade: e.target.value }))} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>UF</Label>
          <Input placeholder="MS" maxLength={2} value={f.estado_endereco} onChange={e => setF(p => ({ ...p, estado_endereco: e.target.value.toUpperCase() }))} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>Dia de vencimento</Label>
          <Input type="number" min={1} max={28} value={f.dia_vencimento} onChange={e => setF(p => ({ ...p, dia_vencimento: e.target.value }))} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Desconto (%)</Label>
          <Input type="number" min={0} max={100} value={f.desconto_percentual} onChange={e => setF(p => ({ ...p, desconto_percentual: e.target.value }))} />
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Clientes</h1>
          <p className="text-muted-foreground text-sm mt-1">{totalClientes} clientes cadastrados</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={csvRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) importarCSV(f) }}
          />
          <Button variant="outline" onClick={() => csvRef.current?.click()} disabled={loadingCSV}>
            {loadingCSV ? 'Importando...' : 'Importar CSV'}
          </Button>
          <Button onClick={() => setModalNovo(true)}>
            <UserPlus size={16} />
            Novo cliente
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, UC, CPF ou telefone..."
          className="pl-9"
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="text-muted-foreground text-sm">Carregando...</div>
      ) : (
        <div className="flex flex-col gap-3">
          {gruposFiltrados.map(g => {
            const gId    = g.usina?.id || 'sem-usina'
            const aberto = abertos.has(gId)
            const descontoMedio = g.beneficiarios.length > 0
              ? g.beneficiarios.reduce((a, b) => a + Number(b.desconto_percentual || 0), 0) / g.beneficiarios.length
              : 0

            return (
              <div key={gId} className="rounded-xl border border-border bg-card overflow-hidden">
                {/* Header do grupo */}
                <div
                  className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => toggleGrupo(gId)}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', g.usina ? 'bg-yellow-500/10' : 'bg-muted')}>
                      <Sun size={16} className={g.usina ? 'text-yellow-500' : 'text-muted-foreground'} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{g.usina?.nome || 'Sem Usina Atribuída'}</p>
                      {g.usina && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {g.usina.distribuidora} · UC {g.usina.uc_geradora} · {Number(g.usina.potencia_kwp).toFixed(1)} kWp · {g.usina.cidade}/{g.usina.estado}
                        </p>
                      )}
                      {!g.usina && (
                        <p className="text-xs text-muted-foreground mt-0.5">Clientes não vinculados a nenhuma usina</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">{g.beneficiarios.length} cliente{g.beneficiarios.length !== 1 ? 's' : ''}</p>
                      {g.usina && <p className="text-xs text-muted-foreground">{descontoMedio.toFixed(1)}% desc. médio</p>}
                    </div>
                    <div className={cn('inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium', g.usina ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500')}>
                      <div className={cn('w-1.5 h-1.5 rounded-full', g.usina ? 'bg-green-500' : 'bg-yellow-500')} />
                      {g.usina ? 'Ativa' : 'Pendente vínculo'}
                    </div>
                    {aberto ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
                  </div>
                </div>

                {/* Tabela de clientes */}
                {aberto && (
                  <div className="border-t border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
                          <th className="text-left px-5 py-2.5 font-medium">Nome</th>
                          <th className="text-left px-5 py-2.5 font-medium">UC</th>
                          <th className="text-left px-5 py-2.5 font-medium">CPF/CNPJ</th>
                          <th className="text-left px-5 py-2.5 font-medium">Desconto</th>
                          <th className="text-left px-5 py-2.5 font-medium">Telefone</th>
                          <th className="text-left px-5 py-2.5 font-medium">Email</th>
                          <th className="text-left px-5 py-2.5 font-medium">Status</th>
                          <th className="text-left px-5 py-2.5 font-medium">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.beneficiarios.map((b, i) => {
                          const c = b.cliente
                          if (!c) return null
                          return (
                            <tr key={b.id} className={cn('border-t border-border/50 hover:bg-muted/20 transition-colors', i % 2 === 0 ? '' : 'bg-muted/10')}>
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">
                                    {c.nome.substring(0, 2).toUpperCase()}
                                  </div>
                                  <span className="font-medium">{c.nome}</span>
                                </div>
                              </td>
                              <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{b.uc_beneficiaria || '—'}</td>
                              <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{c.cpf_cnpj || '—'}</td>
                              <td className="px-5 py-3">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-500">
                                  ↓ {Number(b.desconto_percentual || 0).toFixed(0)}%
                                </span>
                              </td>
                              <td className="px-5 py-3 text-muted-foreground text-xs">{c.telefone || '—'}</td>
                              <td className="px-5 py-3 text-muted-foreground text-xs">{c.email || '—'}</td>
                              <td className="px-5 py-3">
                                <div className={cn(
                                  'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium',
                                  b.ativo ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'
                                )}>
                                  <div className={cn('w-1.5 h-1.5 rounded-full', b.ativo ? 'bg-green-500' : 'bg-muted-foreground')} />
                                  {b.ativo ? 'Ativo' : 'Inativo'}
                                </div>
                              </td>
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => abrirHistorico(c)}
                                    className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                                    title="Histórico do cliente"
                                  >
                                    <BarChart2 size={14} />
                                  </button>
                                  <button
                                    onClick={() => abrirEditar(c)}
                                    className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                                    title="Editar cliente"
                                  >
                                    <Edit size={14} />
                                  </button>
                                  <button
                                    onClick={() => { setClienteSelecionado(c); setModalExcluir(true) }}
                                    className="p-1.5 rounded hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                                    title="Excluir cliente"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                        {/* Rodapé do grupo */}
                        {g.usina && (
                          <tr className="border-t border-border/50 bg-muted/20">
                            <td colSpan={3} className="px-5 py-2 text-xs text-muted-foreground">
                              Total desta usina
                            </td>
                            <td className="px-5 py-2">
                              <span className="text-xs font-medium text-green-500">{g.beneficiarios.length} clientes</span>
                            </td>
                            <td className="px-5 py-2">
                              <span className="text-xs text-muted-foreground">{descontoMedio.toFixed(1)}% desc. médio</span>
                            </td>
                            <td colSpan={3} />
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal histórico cliente */}
      <Dialog open={modalHistorico} onOpenChange={setModalHistorico}>
        <DialogContent className="!max-w-2xl">
          <DialogHeader>
            <DialogTitle>Histórico · {clienteHistorico?.nome}</DialogTitle>
          </DialogHeader>
          {loadingHistorico ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Carregando...</p>
          ) : (() => {
            const totalRecebido = historicoFaturas.filter(f => f.status === 'paga').reduce((a, f) => a + Number(f.valor || 0), 0)
            const emAberto = historicoFaturas
              .filter(f => f.status === 'pendente' || f.status === 'atrasada')
              .reduce((a, f) => a + Number(f.valor || 0), 0)
            const kwhTotal      = historicoFaturas.reduce((a, f) => a + Number(f.kwh_alocado || 0), 0)
            const economia      = historicoFaturas.reduce((a, f) => a + Number(f.valor_desconto || 0), 0)

            return (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: 'Total recebido', valor: Number(totalRecebido).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), icon: DollarSign, cor: 'text-green-500', bg: 'bg-green-500/10' },
                    { label: 'Em aberto',      valor: Number(emAberto).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),      icon: TrendingUp,  cor: 'text-yellow-500', bg: 'bg-yellow-500/10' },
                    { label: 'kWh totais',     valor: `${kwhTotal.toLocaleString('pt-BR')} kWh`,                                             icon: Zap,         cor: 'text-blue-500',   bg: 'bg-blue-500/10' },
                    { label: 'Economia total', valor: Number(economia).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),       icon: BarChart2,   cor: 'text-purple-500', bg: 'bg-purple-500/10' },
                  ].map(k => {
                    const Icon = k.icon
                    return (
                      <div key={k.label} className={`rounded-lg border bg-card p-3 flex flex-col gap-2`}>
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${k.bg}`}>
                          <Icon size={14} className={k.cor} />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{k.label}</p>
                          <p className={`text-sm font-bold ${k.cor}`}>{k.valor}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {historicoFaturas.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhuma fatura encontrada</p>
                ) : (
                  <div className="rounded-lg border border-border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted text-muted-foreground text-xs">
                          <th className="text-left px-4 py-2.5 font-medium">Leitura</th>
                          <th className="text-left px-4 py-2.5 font-medium">kWh</th>
                          <th className="text-left px-4 py-2.5 font-medium">Desconto</th>
                          <th className="text-left px-4 py-2.5 font-medium">Valor</th>
                          <th className="text-left px-4 py-2.5 font-medium">Vencimento</th>
                          <th className="text-left px-4 py-2.5 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historicoFaturas.map((f: any, i: number) => {
                          const comp = f.competencia ? new Date(f.competencia + 'T12:00:00') : null
                          const compStr = comp ? `${String(comp.getMonth() + 1).padStart(2,'0')}/${comp.getFullYear()}` : '—'
                          const venc = f.data_vencimento ? f.data_vencimento.substring(0,10).split('-').reverse().join('/') : '—'
                          const stCor: Record<string, string> = { paga: 'text-green-500', pendente: 'text-yellow-500', atrasada: 'text-red-500', enviada: 'text-blue-500' }
                          return (
                            <tr key={f.id} className={cn('border-t border-border', i % 2 === 0 ? '' : 'bg-muted/10')}>
                              <td className="px-4 py-2.5 text-muted-foreground">{compStr}</td>
                              <td className="px-4 py-2.5">{Number(f.kwh_alocado || 0).toFixed(0)} kWh</td>
                              <td className="px-4 py-2.5 text-green-500">{Number(f.desconto_percentual || 0).toFixed(0)}%</td>
                              <td className="px-4 py-2.5 font-medium">{Number(f.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                              <td className="px-4 py-2.5 text-muted-foreground">{venc}</td>
                              <td className="px-4 py-2.5">
                                <span className={cn('text-xs font-medium capitalize', stCor[f.status] || 'text-muted-foreground')}>{f.status}</span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalHistorico(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal novo cliente */}
      <Dialog open={modalNovo} onOpenChange={setModalNovo}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Novo cliente</DialogTitle></DialogHeader>
          <FormFields f={form} setF={setForm} />
          {erro && <p className="text-sm text-destructive mt-2">{erro}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalNovo(false)}>Cancelar</Button>
            <Button onClick={salvarCliente} disabled={loadingSalvar}>{loadingSalvar ? 'Salvando...' : 'Salvar cliente'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal editar cliente */}
      <Dialog open={modalEditar} onOpenChange={setModalEditar}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Editar cliente</DialogTitle></DialogHeader>
          <FormFields f={formEditar} setF={setFormEditar} />
          {erroEditar && <p className="text-sm text-destructive mt-2">{erroEditar}</p>}
          <DialogFooter className="flex justify-between">
            <Button variant="destructive" onClick={() => setModalExcluir(true)}>Excluir cliente</Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setModalEditar(false)}>Cancelar</Button>
              <Button onClick={salvarEdicao} disabled={loadingEditar}>{loadingEditar ? 'Salvando...' : 'Salvar alterações'}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal excluir */}
      <Dialog open={modalExcluir} onOpenChange={setModalExcluir}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Excluir cliente</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir <span className="font-medium text-foreground">{clienteSelecionado?.nome}</span>? Esta ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalExcluir(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={excluirCliente} disabled={loadingExcluir}>
              {loadingExcluir ? 'Excluindo...' : 'Confirmar exclusão'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}