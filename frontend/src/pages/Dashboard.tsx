import { useEffect, useState } from 'react'
import { FileText, Users, Sun, Zap } from 'lucide-react'
import { apiFetch } from '@/hooks/useApi'

interface Resumo {
  clientes: number
  usinas: number
  faturas: { total: number; pendentes: number; pagas: number; atrasadas: number }
  valorPendente: number
  valorPago: number
}

function fmtMoeda(v: number) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function Dashboard() {
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      apiFetch<{ data: any[] }>('/api/clientes'),
      apiFetch<{ data: any[] }>('/api/usinas'),
      apiFetch<{ data: any[] }>('/api/faturas'),
    ]).then(([clientes, usinas, faturas]) => {
      const fs = faturas.data || []
      setResumo({
        clientes: clientes.data?.length || 0,
        usinas:   usinas.data?.length   || 0,
        faturas: {
          total:     fs.length,
          pendentes: fs.filter(f => f.status === 'pendente').length,
          pagas:     fs.filter(f => f.status === 'paga').length,
          atrasadas: fs.filter(f => f.status === 'atrasada').length,
        },
        valorPendente: fs.filter(f => f.status === 'pendente' || f.status === 'atrasada')
          .reduce((acc, f) => acc + Number(f.valor), 0),
        valorPago: fs.filter(f => f.status === 'paga')
          .reduce((acc, f) => acc + Number(f.valor), 0),
      })
    }).finally(() => setLoading(false))
  }, [])

  const cards = [
    { label: 'Clientes',       valor: resumo?.clientes,          icone: Users,    cor: 'text-blue-500',   bg: 'bg-blue-500/10' },
    { label: 'Usinas',         valor: resumo?.usinas,            icone: Sun,      cor: 'text-yellow-500', bg: 'bg-yellow-500/10' },
    { label: 'Faturas',        valor: resumo?.faturas.total,     icone: FileText, cor: 'text-purple-500', bg: 'bg-purple-500/10' },
    { label: 'Em aberto',      valor: resumo?.faturas.pendentes, icone: Zap,      cor: 'text-orange-500', bg: 'bg-orange-500/10' },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Visão geral do sistema</p>
      </div>

      {loading ? (
        <div className="text-muted-foreground text-sm">Carregando...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {cards.map(card => {
              const Icon = card.icone
              return (
                <div key={card.label} className="rounded-lg border border-border bg-card p-4 flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${card.bg}`}>
                    <Icon size={20} className={card.cor} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{card.label}</p>
                    <p className="text-2xl font-semibold">{card.valor ?? '—'}</p>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border bg-card p-6">
              <p className="text-sm text-muted-foreground mb-1">Valor a receber</p>
              <p className="text-3xl font-semibold text-orange-500">{fmtMoeda(resumo?.valorPendente || 0)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {resumo?.faturas.pendentes} pendente{resumo?.faturas.pendentes !== 1 ? 's' : ''} + {resumo?.faturas.atrasadas} atrasada{resumo?.faturas.atrasadas !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-6">
              <p className="text-sm text-muted-foreground mb-1">Valor recebido</p>
              <p className="text-3xl font-semibold text-green-500">{fmtMoeda(resumo?.valorPago || 0)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {resumo?.faturas.pagas} fatura{resumo?.faturas.pagas !== 1 ? 's' : ''} pagas
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}