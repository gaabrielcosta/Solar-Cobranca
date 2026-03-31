import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Search, UserPlus } from 'lucide-react'
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

interface NovoCliente {
  nome: string
  telefone: string
  email: string
  cpf_cnpj: string
  cep: string
  logradouro: string
  numero: string
  bairro: string
  cidade: string
  estado_endereco: string
  uc_beneficiaria: string
  dia_vencimento: string
  desconto_percentual: string
}

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(true)
  const [modalNovo, setModalNovo] = useState(false)
  const [loadingSalvar, setLoadingSalvar] = useState(false)
  const [erro, setErro] = useState('')
  const [form, setForm] = useState({
    nome: '', telefone: '', email: '', cpf_cnpj: '',
    cep: '', logradouro: '', numero: '', bairro: '',
    cidade: '', estado_endereco: '', uc_beneficiaria: '',
    dia_vencimento: '10', desconto_percentual: '0'
  })
  const [modalEditar, setModalEditar] = useState(false)
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null)
  const [formEditar, setFormEditar] = useState<NovoCliente>({
    nome: '', telefone: '', email: '', cpf_cnpj: '',
    cep: '', logradouro: '', numero: '', bairro: '',
    cidade: '', estado_endereco: '', uc_beneficiaria: '',
    dia_vencimento: '10', desconto_percentual: '0'
  })
  const [loadingEditar, setLoadingEditar] = useState(false)
  const [erroEditar, setErroEditar] = useState('')
  const [modalExcluir, setModalExcluir] = useState(false)
  const [loadingExcluir, setLoadingExcluir] = useState(false)

  async function carregar() {
    const r = await apiFetch<{ data: Cliente[] }>('/api/clientes')
    setClientes(r.data || [])
  }

  const [idsAlocados, setIdsAlocados] = useState<Set<string>>(new Set())

  useEffect(() => {
    carregar().finally(() => setLoading(false))
    apiFetch<{ data: any[] }>('/api/usinas')
      .then(async r => {
        const ids = new Set<string>()
        for (const u of r.data || []) {
          const benef = await apiFetch<any>(`/api/usinas/${u.id}/beneficiarios`)
          const lista = benef?.data?.beneficiarios || []
          lista.filter((b: any) => b.ativo).forEach((b: any) => {
            if (b.cliente?.id) ids.add(b.cliente.id)
          })
        }
        setIdsAlocados(ids)
      })
  }, [])

  function atualizarForm(campo: keyof NovoCliente, valor: string) {
    setForm(prev => ({ ...prev, [campo]: valor }))
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
        body: JSON.stringify({
          ...form,
          dia_vencimento: Number(form.dia_vencimento),
          desconto_percentual: Number(form.desconto_percentual),
        }),
      })
      setModalNovo(false)
      setForm({
        nome: '', telefone: '', email: '', cpf_cnpj: '',
        cep: '', logradouro: '', numero: '', bairro: '',
        cidade: '', estado_endereco: '', uc_beneficiaria: '',
        dia_vencimento: '10', desconto_percentual: '0'
      })
      await carregar()
    } catch {
      setErro('Erro ao salvar cliente')
    } finally {
      setLoadingSalvar(false)
    }
  }

  async function excluirCliente() {
    if (!clienteSelecionado) return
    setLoadingExcluir(true)
    try {
        await apiFetch(`/api/clientes/${clienteSelecionado.id}`, {
        method: 'DELETE',
        })
        setModalExcluir(false)
        setModalEditar(false)
        await carregar()
    } finally {
        setLoadingExcluir(false)
    }
  }

  function abrirEditar(c: Cliente) {
  setClienteSelecionado(c)
  setFormEditar({
    nome: c.nome || '',
    telefone: c.telefone || '',
    email: c.email || '',
    cpf_cnpj: c.cpf_cnpj || '',
    cep: c.cep || '',
    logradouro: c.logradouro || '',
    numero: c.numero || '',
    bairro: c.bairro || '',
    cidade: c.cidade || '',
    estado_endereco: c.estado_endereco || '',
    uc_beneficiaria: c.uc_beneficiaria || '',
    dia_vencimento: String(c.dia_vencimento || 10),
    desconto_percentual: String(c.desconto_percentual || 0),
  })
  setErroEditar('')
  setModalEditar(true)
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
      body: JSON.stringify({
        ...formEditar,
        dia_vencimento: Number(formEditar.dia_vencimento),
        desconto_percentual: Number(formEditar.desconto_percentual),
      }),
    })
    setModalEditar(false)
    await carregar()
  } catch {
    setErroEditar('Erro ao salvar alterações')
  } finally {
    setLoadingEditar(false)
  }
}

  const filtrados = clientes.filter(c =>
    c.nome.toLowerCase().includes(busca.toLowerCase()) ||
    c.telefone?.includes(busca) ||
    c.cidade?.toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Clientes</h1>
          <p className="text-muted-foreground text-sm mt-1">{clientes.length} clientes cadastrados</p>
        </div>
        <Button onClick={() => setModalNovo(true)}>
          <UserPlus size={16} />
          Novo cliente
        </Button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, telefone ou cidade..."
          className="pl-9"
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="text-muted-foreground text-sm">Carregando...</div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted text-muted-foreground text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-3 font-medium">Cliente</th>
                <th className="text-left px-4 py-3 font-medium">Telefone</th>
                <th className="text-left px-4 py-3 font-medium">Cidade</th>
                <th className="text-left px-4 py-3 font-medium">Desconto</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-muted-foreground">
                    Nenhum cliente encontrado
                  </td>
                </tr>
              ) : (
                filtrados.map((c, i) => (
                  <tr
                    key={c.id}
                    className={cn(
                      'border-t border-border transition-colors hover:bg-muted/50',
                      i % 2 === 0 ? 'bg-background' : 'bg-muted/20'
                    )}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                          {c.nome.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{c.nome}</p>
                          {c.email && <p className="text-xs text-muted-foreground">{c.email}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.telefone || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.cidade || '—'}{c.estado_endereco ? ` / ${c.estado_endereco}` : ''}</td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-green-500">{Number(c.desconto_percentual || 0).toFixed(0)}%</span>
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const temBenef = idsAlocados.has(c.id)
                        return (
                          <div className={cn(
                            'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium',
                            temBenef ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'
                          )}>
                            <div className={cn('w-1.5 h-1.5 rounded-full', temBenef ? 'bg-green-500' : 'bg-muted-foreground')} />
                            {temBenef ? 'Alocado' : 'Sem usina'}
                          </div>
                        )
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => abrirEditar(c)}
                        className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        title="Editar cliente"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={modalNovo} onOpenChange={setModalNovo}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo cliente</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>Nome *</Label>
              <Input
                placeholder="Nome completo"
                value={form.nome}
                onChange={e => atualizarForm('nome', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
                <Label>Telefone *</Label>
                <Input
                placeholder="(67) 99999-9999"
                value={form.telefone}
                onChange={e => atualizarForm('telefone', e.target.value)}
                />
            </div>
            <div className="flex flex-col gap-1.5">
                <Label>CPF/CNPJ *</Label>
                <Input
                placeholder="000.000.000-00"
                value={form.cpf_cnpj}
                onChange={e => atualizarForm('cpf_cnpj', e.target.value)}
                />
            </div>
            </div>

            <div className="flex flex-col gap-1.5">
            <Label>Email</Label>
            <Input
                placeholder="email@exemplo.com"
                value={form.email}
                onChange={e => atualizarForm('email', e.target.value)}
            />
            </div>

            <div className="flex flex-col gap-1.5">
            <Label>UC Beneficiária</Label>
            <Input
                placeholder="3647072"
                value={form.uc_beneficiaria}
                onChange={e => atualizarForm('uc_beneficiaria', e.target.value)}
            />
            </div>

            <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5 col-span-2">
                <Label>Logradouro</Label>
                <Input
                placeholder="Rua, Av..."
                value={form.logradouro}
                onChange={e => atualizarForm('logradouro', e.target.value)}
                />
            </div>
            <div className="flex flex-col gap-1.5">
                <Label>Número</Label>
                <Input
                placeholder="123"
                value={form.numero}
                onChange={e => atualizarForm('numero', e.target.value)}
                />
            </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
                <Label>Bairro</Label>
                <Input
                value={form.bairro}
                onChange={e => atualizarForm('bairro', e.target.value)}
                />
            </div>
            <div className="flex flex-col gap-1.5">
                <Label>Cidade</Label>
                <Input
                placeholder="Bataguassu"
                value={form.cidade}
                onChange={e => atualizarForm('cidade', e.target.value)}
                />
            </div>
            <div className="flex flex-col gap-1.5">
                <Label>UF</Label>
                <Input
                placeholder="MS"
                maxLength={2}
                value={form.estado_endereco}
                onChange={e => atualizarForm('estado_endereco', e.target.value.toUpperCase())}
                />
            </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
                <Label>Dia de vencimento</Label>
                <Input
                type="number" min={1} max={28}
                value={form.dia_vencimento}
                onChange={e => atualizarForm('dia_vencimento', e.target.value)}
                />
            </div>
            <div className="flex flex-col gap-1.5">
                <Label>Desconto (%)</Label>
                <Input
                type="number" min={0} max={100}
                value={form.desconto_percentual}
                onChange={e => atualizarForm('desconto_percentual', e.target.value)}
                />
            </div>
            </div>

            {erro && <p className="text-sm text-destructive">{erro}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalNovo(false)}>
              Cancelar
            </Button>
            <Button onClick={salvarCliente} disabled={loadingSalvar}>
              {loadingSalvar ? 'Salvando...' : 'Salvar cliente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={modalEditar} onOpenChange={setModalEditar}>
        <DialogContent className="max-w-lg">
            <DialogHeader>
            <DialogTitle>Editar cliente</DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
                <Label>Nome *</Label>
                <Input
                value={formEditar.nome}
                onChange={e => setFormEditar(p => ({ ...p, nome: e.target.value }))}
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                <Label>Telefone *</Label>
                <Input
                    value={formEditar.telefone}
                    onChange={e => setFormEditar(p => ({ ...p, telefone: e.target.value }))}
                />
                </div>
                <div className="flex flex-col gap-1.5">
                <Label>CPF/CNPJ *</Label>
                <Input
                    value={formEditar.cpf_cnpj}
                    onChange={e => setFormEditar(p => ({ ...p, cpf_cnpj: e.target.value }))}
                />
                </div>
            </div>

            <div className="flex flex-col gap-1.5">
                <Label>Email</Label>
                <Input
                value={formEditar.email}
                onChange={e => setFormEditar(p => ({ ...p, email: e.target.value }))}
                />
            </div>

            <div className="flex flex-col gap-1.5">
                <Label>UC Beneficiária</Label>
                <Input
                value={formEditar.uc_beneficiaria}
                onChange={e => setFormEditar(p => ({ ...p, uc_beneficiaria: e.target.value }))}
                />
            </div>

            <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col gap-1.5 col-span-2">
                <Label>Logradouro</Label>
                <Input
                    value={formEditar.logradouro}
                    onChange={e => setFormEditar(p => ({ ...p, logradouro: e.target.value }))}
                />
                </div>
                <div className="flex flex-col gap-1.5">
                <Label>Número</Label>
                <Input
                    value={formEditar.numero}
                    onChange={e => setFormEditar(p => ({ ...p, numero: e.target.value }))}
                />
                </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col gap-1.5">
                <Label>Bairro</Label>
                <Input
                    value={formEditar.bairro}
                    onChange={e => setFormEditar(p => ({ ...p, bairro: e.target.value }))}
                />
                </div>
                <div className="flex flex-col gap-1.5">
                <Label>Cidade</Label>
                <Input
                    value={formEditar.cidade}
                    onChange={e => setFormEditar(p => ({ ...p, cidade: e.target.value }))}
                />
                </div>
                <div className="flex flex-col gap-1.5">
                <Label>UF</Label>
                <Input
                    maxLength={2}
                    value={formEditar.estado_endereco}
                    onChange={e => setFormEditar(p => ({ ...p, estado_endereco: e.target.value.toUpperCase() }))}
                />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                <Label>Dia de vencimento</Label>
                <Input
                    type="number" min={1} max={28}
                    value={formEditar.dia_vencimento}
                    onChange={e => setFormEditar(p => ({ ...p, dia_vencimento: e.target.value }))}
                />
                </div>
                <div className="flex flex-col gap-1.5">
                <Label>Desconto (%)</Label>
                <Input
                    type="number" min={0} max={100}
                    value={formEditar.desconto_percentual}
                    onChange={e => setFormEditar(p => ({ ...p, desconto_percentual: e.target.value }))}
                />
                </div>
            </div>

            {erroEditar && <p className="text-sm text-destructive">{erroEditar}</p>}
            </div>

            <DialogFooter className="flex justify-between">
                <Button
                    variant="destructive"
                    onClick={() => setModalExcluir(true)}
                >
                    Excluir cliente
                </Button>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setModalEditar(false)}>
                    Cancelar
                    </Button>
                    <Button onClick={salvarEdicao} disabled={loadingEditar}>
                    {loadingEditar ? 'Salvando...' : 'Salvar alterações'}
                    </Button>
                </div>
            </DialogFooter>
        </DialogContent>
        </Dialog>
        <Dialog open={modalExcluir} onOpenChange={setModalExcluir}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                <DialogTitle>Excluir cliente</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">
                Tem certeza que deseja desativar <span className="font-medium text-foreground">{clienteSelecionado?.nome}</span>? Esta ação não pode ser desfeita.
                </p>
                <DialogFooter>
                <Button variant="outline" onClick={() => setModalExcluir(false)}>
                    Cancelar
                </Button>
                <Button variant="destructive" onClick={excluirCliente} disabled={loadingExcluir}>
                    {loadingExcluir ? 'Excluindo...' : 'Confirmar exclusão'}
                </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
  )
}