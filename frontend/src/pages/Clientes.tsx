import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, UserPlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { apiFetch } from '@/hooks/useApi'

interface Cliente {
  id: string
  nome: string
  telefone: string
  email: string
  cidade: string
  ativo: boolean
}

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch<{ data: Cliente[] }>('/api/clientes')
      .then(r => setClientes(r.data || []))
      .finally(() => setLoading(false))
  }, [])

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
        <Button>
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
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted text-muted-foreground">
                <th className="text-left px-4 py-3 font-medium">Nome</th>
                <th className="text-left px-4 py-3 font-medium">Telefone</th>
                <th className="text-left px-4 py-3 font-medium">Cidade</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-muted-foreground">
                    Nenhum cliente encontrado
                  </td>
                </tr>
              ) : (
                filtrados.map((c, i) => (
                  <tr
                    key={c.id}
                    className={cn(
                      'border-t border-border transition-colors hover:bg-muted/50 cursor-pointer',
                      i % 2 === 0 ? 'bg-background' : 'bg-muted/20'
                    )}
                  >
                    <td className="px-4 py-3 font-medium">{c.nome}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.telefone || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.cidade || '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={c.ativo ? 'default' : 'secondary'}>
                        {c.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}