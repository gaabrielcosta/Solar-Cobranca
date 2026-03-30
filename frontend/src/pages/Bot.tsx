import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, Wifi, WifiOff, Play } from 'lucide-react'
import { apiFetch } from '@/hooks/useApi'

interface Status {
  configurado: boolean
  status: 'conectado' | 'desconectado' | 'nao_configurado' | 'erro'
  mensagem: string
}

interface Evento {
  id: string
  tipo: string
  descricao: string
  created_at: string
}

function fmtData(d: string) {
  return new Date(d).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

export default function Bot() {
  const [status, setStatus] = useState<Status | null>(null)
  const [eventos, setEventos] = useState<Evento[]>([])
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [loadingTestar, setLoadingTestar] = useState(false)
  const [mensagem, setMensagem] = useState('')

  async function carregarStatus() {
    setLoadingStatus(true)
    const r = await apiFetch<Status>('/api/regua/status')
    setStatus(r)
    setLoadingStatus(false)
  }

  async function carregarEventos() {
    const r = await apiFetch<{ data: Evento[] }>('/api/regua/historico')
    setEventos(r.data || [])
  }

  async function testarRegua() {
    setLoadingTestar(true)
    setMensagem('')
    try {
      const r = await apiFetch<{ sucesso: boolean; mensagem: string }>('/api/regua/testar', {
        method: 'POST',
      })
      setMensagem(r.mensagem || 'Régua processada')
      carregarEventos()
    } catch {
      setMensagem('Erro ao processar régua')
    } finally {
      setLoadingTestar(false)
    }
  }

  useEffect(() => {
    carregarStatus()
    carregarEventos()
  }, [])

  const statusConfig = {
    conectado:        { label: 'Conectado',        variant: 'default' as const,      icone: <Wifi size={16} className="text-green-500" /> },
    desconectado:     { label: 'Desconectado',     variant: 'destructive' as const,  icone: <WifiOff size={16} className="text-red-500" /> },
    nao_configurado:  { label: 'Não configurado',  variant: 'secondary' as const,    icone: <WifiOff size={16} /> },
    erro:             { label: 'Erro',             variant: 'destructive' as const,  icone: <WifiOff size={16} className="text-red-500" /> },
  }

  const st = status ? statusConfig[status.status] : null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Bot WhatsApp</h1>
          <p className="text-muted-foreground text-sm mt-1">Régua de cobrança automática</p>
        </div>
        <Button variant="outline" onClick={carregarStatus} disabled={loadingStatus}>
          <RefreshCw size={16} className={loadingStatus ? 'animate-spin' : ''} />
          Atualizar
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {st?.icone}
          <div>
            <p className="text-sm font-medium">Status da conexão</p>
            <p className="text-xs text-muted-foreground mt-0.5">{status?.mensagem}</p>
          </div>
        </div>
        {st && <Badge variant={st.variant}>{st.label}</Badge>}
      </div>

      <div className="rounded-lg border border-border bg-card p-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Disparar régua manualmente</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Processa todas as faturas pendentes e envia notificações
          </p>
          {mensagem && (
            <p className="text-xs text-green-500 mt-2">{mensagem}</p>
          )}
        </div>
        <Button onClick={testarRegua} disabled={loadingTestar}>
          <Play size={16} />
          {loadingTestar ? 'Processando...' : 'Disparar agora'}
        </Button>
      </div>

      <div>
        <h2 className="text-sm font-medium mb-3">Últimos eventos</h2>
        {eventos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum evento registrado</p>
        ) : (
          <div className="flex flex-col gap-2">
            {eventos.slice(0, 20).map(e => (
              <div key={e.id} className="rounded-lg border border-border bg-card px-4 py-3 flex items-center justify-between">
                <p className="text-sm text-foreground">{e.descricao}</p>
                <span className="text-xs text-muted-foreground font-mono flex-shrink-0 ml-4">
                  {fmtData(e.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}