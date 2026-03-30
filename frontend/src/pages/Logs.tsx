import { useEffect, useState, useRef, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, RefreshCw } from 'lucide-react'
import { apiFetch } from '@/hooks/useApi'

interface Log {
  id: string
  acao: string
  descricao: string
  cliente_nome: string
  usina_nome: string
  created_at: string
}

const acaoMeta: Record<string, { label: string; cor: string; icone: string }> = {
  CLIENTE_CRIADO:          { label: 'Cliente criado',          cor: '#52b788', icone: '👤' },
  CLIENTE_EDITADO:         { label: 'Cliente editado',         cor: '#60a5fa', icone: '✏️' },
  CLIENTE_EXCLUIDO:        { label: 'Cliente excluído',        cor: '#f87171', icone: '🗑️' },
  BENEFICIARIO_ADICIONADO: { label: 'Beneficiário adicionado', cor: '#52b788', icone: '🔗' },
  BENEFICIARIO_REMOVIDO:   { label: 'Beneficiário removido',   cor: '#f87171', icone: '🔗' },
  FATURA_PAGA:             { label: 'Fatura paga',             cor: '#52b788', icone: '💰' },
  PDF_PROCESSADO:          { label: 'PDF processado',          cor: '#fbbf24', icone: '📄' },
  PIX_EXTRAIDO:            { label: 'PIX extraído',            cor: '#fbbf24', icone: '⚡' },
}

function fmtHora(d: string) {
  return new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function fmtDia(d: string) {
  const data = new Date(d)
  const hoje = new Date(); hoje.setHours(0,0,0,0)
  const ontem = new Date(hoje); ontem.setDate(ontem.getDate() - 1)
  const dia = new Date(data); dia.setHours(0,0,0,0)
  if (dia.getTime() === hoje.getTime()) return 'Hoje'
  if (dia.getTime() === ontem.getTime()) return 'Ontem'
  return data.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
}

const LIMIT = 30

export default function Logs() {
  const [logs, setLogs] = useState<Log[]>([])
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingMais, setLoadingMais] = useState(false)
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)

  async function carregar(reset = true) {
    if (reset) setLoading(true)
    else setLoadingMais(true)

    const off = reset ? 0 : offset
    const r = await apiFetch<{ data: Log[]; total: number }>(
      `/api/logs?limit=${LIMIT}&offset=${off}`
    )

    if (reset) {
      setLogs(r.data || [])
    } else {
      setLogs(prev => [...prev, ...(r.data || [])])
    }

    setTotal(r.total || 0)
    setOffset(off + (r.data?.length || 0))
    setLoading(false)
    setLoadingMais(false)
  }

  useEffect(() => { carregar() }, [])

  const filtrados = logs.filter(l =>
    l.descricao?.toLowerCase().includes(busca.toLowerCase()) ||
    l.cliente_nome?.toLowerCase().includes(busca.toLowerCase()) ||
    l.acao?.toLowerCase().includes(busca.toLowerCase())
  )

  // Agrupa por data
  const grupos: Record<string, { label: string; logs: Log[] }> = {}
  filtrados.forEach(l => {
    const key = new Date(l.created_at).toISOString().substring(0, 10)
    if (!grupos[key]) grupos[key] = { label: fmtDia(l.created_at), logs: [] }
    grupos[key].logs.push(l)
  })

  const temMais = offset < total

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Logs</h1>
          <p className="text-muted-foreground text-sm mt-1">{total} eventos registrados</p>
        </div>
        <Button variant="outline" onClick={() => carregar()}>
          <RefreshCw size={16} />
          Atualizar
        </Button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por ação, cliente ou descrição..."
          className="pl-9"
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="text-muted-foreground text-sm">Carregando...</div>
      ) : (
        <div className="flex flex-col gap-6">
          {Object.entries(grupos)
            .sort((a, b) => b[0].localeCompare(a[0]))
            .map(([key, grupo]) => (
              <div key={key}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                    {grupo.label}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">{grupo.logs.length} evento{grupo.logs.length !== 1 ? 's' : ''}</span>
                </div>

                <div className="flex flex-col gap-2">
                  {grupo.logs.map(l => {
                    const meta = acaoMeta[l.acao] || { label: l.acao, cor: '#888', icone: '📋' }
                    return (
                      <div
                        key={l.id}
                        className="flex items-stretch gap-0 rounded-lg border border-border bg-card overflow-hidden"
                      >
                        <div className="w-1 flex-shrink-0" style={{ background: meta.cor }} />
                        <div className="w-11 flex items-center justify-center text-base flex-shrink-0 border-r border-border bg-muted/30">
                          {meta.icone}
                        </div>
                        <div className="flex-1 px-4 py-3 min-w-0">
                          <p className="text-sm font-medium text-foreground leading-snug">{l.descricao}</p>
                          {l.cliente_nome && (
                            <p className="text-xs text-muted-foreground mt-1">{l.cliente_nome}</p>
                          )}
                        </div>
                        <div className="flex flex-col items-end justify-center px-4 py-3 gap-1 flex-shrink-0">
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: meta.cor + '20', color: meta.cor }}>
                            {meta.label}
                          </span>
                          <span className="text-xs text-muted-foreground font-mono">{fmtHora(l.created_at)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}

          {temMais && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" onClick={() => carregar(false)} disabled={loadingMais}>
                {loadingMais ? 'Carregando...' : `Carregar mais (${total - offset} restantes)`}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}