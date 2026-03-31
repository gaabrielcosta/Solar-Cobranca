import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw, Wifi, WifiOff, Play, MessageSquare, Settings, CheckCircle, XCircle, Clock, RotateCcw } from 'lucide-react'
import { apiFetch } from '@/hooks/useApi'
import { cn } from '@/lib/utils'

interface Status {
  configurado: boolean
  status: 'conectado' | 'desconectado' | 'nao_configurado' | 'erro'
  mensagem: string
  instancia?: string
}

interface Evento {
  id: string
  tipo: string
  descricao: string
  created_at: string
}

interface ConfigMsg {
  chave: string
  descricao: string
  valor: string
  personalizado: boolean
}

type Aba = 'status' | 'historico' | 'config'

export default function Bot() {
  const [aba, setAba] = useState<Aba>('status')
  const [status,        setStatus]        = useState<Status | null>(null)
  const [eventos,       setEventos]       = useState<Evento[]>([])
  const [configs,       setConfigs]       = useState<ConfigMsg[]>([])
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [loadingTestar, setLoadingTestar] = useState(false)
  const [loadingConfig, setLoadingConfig] = useState(false)
  const [mensagem,      setMensagem]      = useState('')
  const [editando,      setEditando]      = useState<string | null>(null)
  const [valorEditado,  setValorEditado]  = useState('')
  const [salvando,      setSalvando]      = useState(false)

  async function carregarStatus() {
    setLoadingStatus(true)
    try {
      const r = await apiFetch<Status>('/api/regua/status')
      setStatus(r)
    } finally {
      setLoadingStatus(false)
    }
  }

  async function carregarEventos() {
    const r = await apiFetch<{ data: Evento[] }>('/api/regua/historico')
    setEventos(r.data || [])
  }

  async function carregarConfig() {
    setLoadingConfig(true)
    try {
      const r = await apiFetch<{ data: ConfigMsg[] }>('/api/regua/config')
      setConfigs(r.data || [])
    } finally {
      setLoadingConfig(false)
    }
  }

  async function testarRegua() {
    setLoadingTestar(true)
    setMensagem('')
    try {
      const r = await apiFetch<{ sucesso: boolean; mensagem: string }>('/api/regua/testar', { method: 'POST' })
      setMensagem(r.mensagem || 'Régua processada com sucesso')
      carregarEventos()
    } catch {
      setMensagem('Erro ao processar régua')
    } finally {
      setLoadingTestar(false)
    }
  }

  async function salvarConfig(chave: string) {
    setSalvando(true)
    try {
      await apiFetch(`/api/regua/config/${chave}`, {
        method: 'PATCH',
        body: JSON.stringify({ valor: valorEditado }),
      })
      setEditando(null)
      await carregarConfig()
    } finally {
      setSalvando(false)
    }
  }

  async function restaurarConfig(chave: string) {
    await apiFetch(`/api/regua/config/${chave}`, { method: 'DELETE' })
    await carregarConfig()
  }

  useEffect(() => {
    carregarStatus()
    carregarEventos()
    carregarConfig()
  }, [])

  const isConectado = status?.status === 'conectado'

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Bot WhatsApp</h1>
          <p className="text-muted-foreground text-sm mt-1">Régua de cobrança automática</p>
        </div>
        <Button variant="outline" onClick={() => { carregarStatus(); carregarEventos() }} disabled={loadingStatus}>
          <RefreshCw size={16} className={loadingStatus ? 'animate-spin' : ''} />
          Atualizar
        </Button>
      </div>

      {/* Card de status */}
      <div className={cn(
        'rounded-xl border p-5 flex items-center justify-between',
        isConectado ? 'border-green-500/20 bg-green-500/5' : 'border-border bg-card'
      )}>
        <div className="flex items-center gap-4">
          <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', isConectado ? 'bg-green-500/10' : 'bg-muted')}>
            {isConectado
              ? <Wifi size={22} className="text-green-500" />
              : <WifiOff size={22} className="text-muted-foreground" />
            }
          </div>
          <div>
            <p className="font-medium">{isConectado ? 'WhatsApp Conectado' : 'WhatsApp Desconectado'}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{status?.mensagem}</p>
            {status?.instancia && <p className="text-xs text-muted-foreground mt-0.5">Instância: <span className="font-mono">{status.instancia}</span></p>}
          </div>
        </div>
        <div className={cn(
          'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium',
          isConectado ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
        )}>
          <div className={cn('w-2 h-2 rounded-full', isConectado ? 'bg-green-500 animate-pulse' : 'bg-red-500')} />
          {isConectado ? 'Online' : 'Offline'}
        </div>
      </div>

      {/* Card disparar régua */}
      <div className="rounded-xl border border-border bg-card p-5 flex items-center justify-between">
        <div>
          <p className="font-medium">Disparar régua manualmente</p>
          <p className="text-xs text-muted-foreground mt-0.5">Processa todas as faturas pendentes e envia notificações via WhatsApp</p>
          {mensagem && (
            <p className={cn('text-xs mt-2', mensagem.includes('Erro') ? 'text-destructive' : 'text-green-500')}>{mensagem}</p>
          )}
        </div>
        <Button onClick={testarRegua} disabled={loadingTestar}>
          <Play size={16} />
          {loadingTestar ? 'Processando...' : 'Disparar agora'}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border border-border rounded-lg overflow-hidden w-fit">
        {[
          { label: 'Histórico', value: 'historico', icon: MessageSquare },
          { label: 'Mensagens', value: 'config',    icon: Settings },
        ].map((t, i) => {
          const Icon = t.icon
          return (
            <button
              key={t.value}
              onClick={() => setAba(t.value as Aba)}
              className={cn(
                'px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2',
                i > 0 && 'border-l border-border',
                aba === t.value ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon size={14} />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Histórico */}
      {aba === 'historico' && (
        <div className="flex flex-col gap-4">
          {eventos.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhum evento registrado</p>
          ) : (() => {
            // Agrupa por dia
            const porDia: Record<string, Evento[]> = {}
            eventos.forEach(e => {
              const dia = new Date(e.created_at).toLocaleDateString('pt-BR')
              if (!porDia[dia]) porDia[dia] = []
              porDia[dia].push(e)
            })
            return Object.entries(porDia).map(([dia, evs]) => (
              <div key={dia} className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-1">{dia}</p>
                {evs.map(e => {
                  const dados = (e as any).dados || {}
                  const enviado = dados.whatsapp_enviado
                  const cliente = dados.cliente
                  const valor = dados.valor
                  return (
                    <div key={e.id} className={cn(
                      'rounded-lg border bg-card px-4 py-3 flex items-center gap-3',
                      enviado === true ? 'border-green-500/20' : enviado === false ? 'border-red-500/20' : 'border-border'
                    )}>
                      <div className={cn(
                        'w-2 h-2 rounded-full flex-shrink-0',
                        enviado === true ? 'bg-green-500' : enviado === false ? 'bg-red-500' : 'bg-muted-foreground'
                      )} />
                      <div className="flex-1 min-w-0">
                        {cliente && <p className="text-sm font-medium">{cliente}</p>}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {e.tipo}
                          {valor ? ` · R$ ${Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}
                          {dados.telefone ? ` · ${dados.telefone}` : ''}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={cn('text-xs font-medium', enviado === true ? 'text-green-500' : enviado === false ? 'text-red-500' : 'text-muted-foreground')}>
                          {enviado === true ? '✓ Enviado' : enviado === false ? '✗ Não enviado' : e.tipo}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {new Date(e.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))
          })()}
        </div>
      )}

      {/* Config mensagens */}
      {aba === 'config' && (
        <div className="flex flex-col gap-3">
          {loadingConfig ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : configs.map(c => (
            <div key={c.chave} className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{c.descricao}</p>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{c.chave}</p>
                </div>
                <div className="flex items-center gap-2">
                  {c.personalizado && (
                    <span className="text-xs text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full">Personalizado</span>
                  )}
                  {c.personalizado && (
                    <button onClick={() => restaurarConfig(c.chave)} className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="Restaurar padrão">
                      <RotateCcw size={13} />
                    </button>
                  )}
                  <button
                    onClick={() => { setEditando(c.chave); setValorEditado(c.valor) }}
                    className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    title="Editar mensagem"
                  >
                    <Settings size={13} />
                  </button>
                </div>
              </div>

              {editando === c.chave ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono resize-none"
                    rows={4}
                    value={valorEditado}
                    onChange={e => setValorEditado(e.target.value)}
                  />
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => setEditando(null)}>Cancelar</Button>
                    <Button size="sm" onClick={() => salvarConfig(c.chave)} disabled={salvando}>
                      {salvando ? 'Salvando...' : 'Salvar'}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 font-mono whitespace-pre-wrap">{c.valor}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}