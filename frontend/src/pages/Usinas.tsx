import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, Plus, Sun, Zap, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { apiFetch } from '@/hooks/useApi'

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
  const [usinas, setUsinas] = useState<Usina[]>([])
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch<{ data: Usina[] }>('/api/usinas')
      .then(r => setUsinas(r.data || []))
      .finally(() => setLoading(false))
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
        <Button>
          <Plus size={16} />
          Nova usina
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
            <Sun size={20} className="text-yellow-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total de usinas</p>
            <p className="text-2xl font-semibold">{usinas.length}</p>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <Zap size={20} className="text-blue-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Potência total</p>
            <p className="text-2xl font-semibold">{potenciaTotal.toFixed(1)} <span className="text-sm font-normal text-muted-foreground">kWp</span></p>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
            <Users size={20} className="text-green-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Distribuidoras</p>
            <p className="text-2xl font-semibold">
              {new Set(usinas.map(u => u.distribuidora)).size}
            </p>
          </div>
        </div>
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
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted text-muted-foreground">
                <th className="text-left px-4 py-3 font-medium">Nome</th>
                <th className="text-left px-4 py-3 font-medium">UC Geradora</th>
                <th className="text-left px-4 py-3 font-medium">Potência</th>
                <th className="text-left px-4 py-3 font-medium">Cidade</th>
                <th className="text-left px-4 py-3 font-medium">Distribuidora</th>
                <th className="text-left px-4 py-3 font-medium">Tipo</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-muted-foreground">
                    Nenhuma usina encontrada
                  </td>
                </tr>
              ) : (
                filtradas.map((u, i) => (
                  <tr
                    key={u.id}
                    className={cn(
                      'border-t border-border transition-colors hover:bg-muted/50 cursor-pointer',
                      i % 2 === 0 ? 'bg-background' : 'bg-muted/20'
                    )}
                  >
                    <td className="px-4 py-3 font-medium">{u.nome}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{u.uc_geradora}</td>
                    <td className="px-4 py-3 text-muted-foreground">{Number(u.potencia_kwp).toFixed(1)} kWp</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.cidade || '—'}{u.estado ? ` / ${u.estado}` : ''}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.distribuidora}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{u.tipo}</Badge>
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