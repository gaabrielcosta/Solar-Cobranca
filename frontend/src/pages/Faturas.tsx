import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { apiFetch } from '@/hooks/useApi'

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
  pendente:   { label: 'Pendente',   variant: 'outline' },
  paga:       { label: 'Paga',       variant: 'default' },
  atrasada:   { label: 'Atrasada',   variant: 'destructive' },
  enviada:    { label: 'Enviada',    variant: 'secondary' },
  negociada:  { label: 'Negociada',  variant: 'secondary' },
}

function fmtMoeda(v: number) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtData(d: string) {
  if (!d) return '—'
  const s = typeof d === 'string' ? d : new Date(d).toISOString()
  const [yyyy, mm, dd] = s.substring(0, 10).split('-')
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

  useEffect(() => {
    apiFetch<{ data: Fatura[] }>('/api/faturas')
      .then(r => setFaturas(r.data || []))
      .finally(() => setLoading(false))
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
      <div>
        <h1 className="text-2xl font-semibold">Faturas</h1>
        <p className="text-muted-foreground text-sm mt-1">{total} faturas no total</p>
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
                      className={cn(
                        'border-t border-border transition-colors hover:bg-muted/50 cursor-pointer',
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
    </div>
  )
}