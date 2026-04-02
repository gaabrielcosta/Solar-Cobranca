import { useState, useEffect, useRef, useCallback } from 'react'
import Sidebar from './Sidebar'
import { Menu, Search, Bell, AlertCircle, CheckCircle, X, Trash2, Users, FileText } from 'lucide-react'
import { apiFetch } from '@/hooks/useApi'
import { useNavigate } from 'react-router-dom'

interface Notificacao {
  id: string
  acao: string
  descricao: string
  cliente_nome: string
  created_at: string
}

interface ResultadoBusca {
  clientes: { id: string; nome: string; uc_beneficiaria: string; telefone: string }[]
  faturas:  { id: string; valor: number; status: string; beneficiario?: { uc_beneficiaria: string; cliente?: { nome: string } } }[]
}

const STATUS_COR: Record<string, string> = {
  paga: '#50c878', pendente: '#fbbf24', atrasada: '#f87171', enviada: '#60a5fa'
}

function fmtMoeda(v: number) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtTempo(d: string) {
  const diff = Date.now() - new Date(d).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 60) return `${min}m atrás`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h atrás`
  return `${Math.floor(h / 24)}d atrás`
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()

  const [sidebarAberta, setSidebarAberta] = useState(false)
  const [notifAberta,   setNotifAberta]   = useState(false)
  const [notificacoes,  setNotificacoes]  = useState<Notificacao[]>([])
  const [lidas,         setLidas]         = useState<Set<string>>(new Set())
  const [removidas,     setRemovidas]     = useState<Set<string>>(new Set())

  const [busca,         setBusca]         = useState('')
  const [buscaAberta,   setBuscaAberta]   = useState(false)
  const [resultados,    setResultados]    = useState<ResultadoBusca>({ clientes: [], faturas: [] })
  const [buscando,      setBuscando]      = useState(false)

  const notifRef  = useRef<HTMLDivElement>(null)
  const buscaRef  = useRef<HTMLDivElement>(null)
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Resize
  useEffect(() => {
    function onResize() { if (window.innerWidth >= 1024) setSidebarAberta(false) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Notificações
  useEffect(() => {
    async function carregar() {
      try {
        const [pagas, atrasadas] = await Promise.all([
          apiFetch<{ data: Notificacao[] }>('/api/logs?limit=10&acao=FATURA_PAGA'),
          apiFetch<{ data: Notificacao[] }>('/api/logs?limit=10&acao=FATURA_ATRASADA'),
        ])
        const todas = [...(pagas.data || []), ...(atrasadas.data || [])]
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 15)
        setNotificacoes(todas)
      } catch {}
    }
    carregar()
  }, [])

  // Fecha dropdowns ao clicar fora
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifAberta(false)
      if (buscaRef.current && !buscaRef.current.contains(e.target as Node)) setBuscaAberta(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Busca com debounce
  const pesquisar = useCallback(async (q: string) => {
    if (q.length < 2) { setResultados({ clientes: [], faturas: [] }); return }
    setBuscando(true)
    try {
      const [clientes, faturas] = await Promise.all([
        apiFetch<{ data: any[] }>('/api/clientes'),
        apiFetch<{ data: any[] }>('/api/faturas'),
      ])
      const ql = q.toLowerCase()
      const cls = (clientes.data || []).filter(c =>
        c.nome?.toLowerCase().includes(ql) ||
        c.uc_beneficiaria?.includes(ql) ||
        c.telefone?.includes(ql)
      ).slice(0, 5)
      const fts = (faturas.data || []).filter(f =>
        f.beneficiario?.cliente?.nome?.toLowerCase().includes(ql) ||
        f.beneficiario?.uc_beneficiaria?.includes(ql)
      ).slice(0, 4)
      setResultados({ clientes: cls, faturas: fts })
    } catch {}
    setBuscando(false)
  }, [])

  function onBuscaChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setBusca(v)
    setBuscaAberta(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => pesquisar(v), 300)
  }

  const visiveis  = notificacoes.filter(n => !removidas.has(n.id))
  const naoLidas  = visiveis.filter(n => !lidas.has(n.id)).length
  const temResult = resultados.clientes.length > 0 || resultados.faturas.length > 0

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--hc-bg)' }}>

      {sidebarAberta && (
        <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setSidebarAberta(false)} />
      )}

      <div className={`fixed inset-y-0 left-0 z-40 transform transition-transform duration-300 ease-in-out
        lg:relative lg:translate-x-0 lg:flex lg:flex-shrink-0
        ${sidebarAberta ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar onClose={() => setSidebarAberta(false)} />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 flex items-center justify-between px-4 lg:px-6 h-14"
          style={{ background: 'var(--hc-surface)', borderBottom: '1px solid var(--hc-border)' }}>

          {/* Busca */}
          <div className="flex items-center gap-3 flex-1">
            <button onClick={() => setSidebarAberta(true)} className="lg:hidden p-1.5 rounded-lg transition-colors" style={{ color: 'var(--hc-text3)' }}>
              <Menu size={20} />
            </button>

            <div className="relative hidden sm:flex items-center max-w-xs w-full" ref={buscaRef}>
              <Search size={14} className="absolute left-3 z-10" style={{ color: 'var(--hc-text3)' }} />
              <input
                type="text"
                value={busca}
                onChange={onBuscaChange}
                onFocus={() => busca.length >= 2 && setBuscaAberta(true)}
                placeholder="Buscar beneficiário ou fatura..."
                className="w-full h-8 pl-8 pr-3 rounded-lg text-xs focus:outline-none transition-colors"
                style={{ background: 'var(--hc-input-bg)', border: '1px solid var(--hc-border)', color: 'var(--hc-text1)' }}
              />

              {/* Dropdown busca */}
              {buscaAberta && busca.length >= 2 && (
                <div className="absolute top-10 left-0 w-80 rounded-xl shadow-2xl z-50 overflow-hidden"
                  style={{ background: 'var(--hc-surface)', border: '1px solid var(--hc-border)' }}>

                  {buscando ? (
                    <p className="text-xs text-center py-6" style={{ color: 'var(--hc-text3)' }}>Buscando...</p>
                  ) : !temResult ? (
                    <p className="text-xs text-center py-6" style={{ color: 'var(--hc-text3)' }}>Nenhum resultado para "{busca}"</p>
                  ) : (
                    <>
                      {resultados.clientes.length > 0 && (
                        <div>
                          <p className="px-4 pt-3 pb-1 text-[9px] font-semibold uppercase tracking-widest" style={{ color: 'var(--hc-text3)' }}>Clientes</p>
                          {resultados.clientes.map(c => (
                            <div key={c.id} onClick={() => { navigate('/clientes'); setBuscaAberta(false); setBusca('') }}
                              className="flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors"
                              style={{ borderTop: '1px solid var(--hc-divider)' }}
                              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--hc-row-alt)'}
                              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                            >
                              <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold"
                                style={{ background: 'rgba(80,200,120,0.12)', color: 'var(--hc-accent)' }}>
                                {c.nome?.substring(0, 2).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate" style={{ color: 'var(--hc-text1)' }}>{c.nome}</p>
                                <p className="text-[10px]" style={{ color: 'var(--hc-text3)' }}>
                                  UC {c.uc_beneficiaria || '—'}{c.telefone ? ` · ${c.telefone}` : ''}
                                </p>
                              </div>
                              <Users size={12} style={{ color: 'var(--hc-text3)' }} />
                            </div>
                          ))}
                        </div>
                      )}

                      {resultados.faturas.length > 0 && (
                        <div>
                          <p className="px-4 pt-3 pb-1 text-[9px] font-semibold uppercase tracking-widest" style={{ color: 'var(--hc-text3)' }}>Faturas</p>
                          {resultados.faturas.map(f => (
                            <div key={f.id} onClick={() => { navigate('/faturas'); setBuscaAberta(false); setBusca('') }}
                              className="flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors"
                              style={{ borderTop: '1px solid var(--hc-divider)' }}
                              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--hc-row-alt)'}
                              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                            >
                              <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold"
                                style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa' }}>
                                {(f.beneficiario?.cliente?.nome || '?').substring(0, 2).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate" style={{ color: 'var(--hc-text1)' }}>
                                  {f.beneficiario?.cliente?.nome || '—'}
                                </p>
                                <p className="text-[10px]" style={{ color: 'var(--hc-text3)' }}>
                                  UC {f.beneficiario?.uc_beneficiaria || '—'} · {fmtMoeda(f.valor)}
                                </p>
                              </div>
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                                style={{ background: `${STATUS_COR[f.status] || '#888'}20`, color: STATUS_COR[f.status] || 'var(--hc-text3)' }}>
                                {f.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Direita */}
          <div className="flex items-center gap-2">

            {/* Notificações */}
            <div className="relative" ref={notifRef}>
              <button onClick={() => setNotifAberta(v => !v)} className="p-2 rounded-lg transition-colors relative" style={{ color: 'var(--hc-text2)' }}>
                <Bell size={18} />
                {naoLidas > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center"
                    style={{ background: 'var(--hc-accent)', color: '#0a0f0a' }}>
                    {naoLidas > 9 ? '9+' : naoLidas}
                  </span>
                )}
              </button>

              {notifAberta && (
                <div className="absolute right-0 top-12 w-80 rounded-xl shadow-2xl z-50 overflow-hidden"
                  style={{ background: 'var(--hc-surface)', border: '1px solid var(--hc-border)' }}>
                  <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--hc-border)' }}>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--hc-text1)' }}>Notificações</p>
                      {naoLidas > 0 && <p className="text-[10px]" style={{ color: 'var(--hc-text3)' }}>{naoLidas} não lida{naoLidas !== 1 ? 's' : ''}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      {naoLidas > 0 && (
                        <button onClick={() => setLidas(new Set(notificacoes.map(n => n.id)))} className="text-[10px] underline" style={{ color: 'var(--hc-accent)' }}>
                          Marcar todas
                        </button>
                      )}
                      {visiveis.length > 0 && (
                        <button onClick={() => setRemovidas(new Set(notificacoes.map(n => n.id)))} className="text-[10px] underline" style={{ color: '#f87171' }}>
                          Limpar tudo
                        </button>
                      )}
                      <button onClick={() => setNotifAberta(false)} style={{ color: 'var(--hc-text3)' }}><X size={14} /></button>
                    </div>
                  </div>

                  <div className="max-h-80 overflow-y-auto">
                    {visiveis.length === 0 ? (
                      <p className="text-xs text-center py-8" style={{ color: 'var(--hc-text3)' }}>Nenhuma notificação</p>
                    ) : visiveis.map(n => {
                      const lida = lidas.has(n.id)
                      const isPaga = n.acao === 'FATURA_PAGA'
                      return (
                        <div key={n.id} onClick={() => setLidas(prev => new Set([...prev, n.id]))}
                          className="flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors"
                          style={{ borderBottom: '1px solid var(--hc-divider)', background: lida ? 'transparent' : 'var(--hc-row-alt)' }}>
                          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                            style={{ background: isPaga ? 'rgba(80,200,120,0.12)' : 'rgba(248,113,113,0.12)' }}>
                            {isPaga ? <CheckCircle size={13} style={{ color: 'var(--hc-accent)' }} /> : <AlertCircle size={13} style={{ color: '#f87171' }} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium leading-snug" style={{ color: 'var(--hc-text1)' }}>{n.descricao}</p>
                            {n.cliente_nome && <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--hc-text3)' }}>{n.cliente_nome}</p>}
                            <p className="text-[10px] mt-0.5" style={{ color: 'var(--hc-text3)' }}>{fmtTempo(n.created_at)}</p>
                          </div>
                          <div className="flex flex-col items-center gap-1 flex-shrink-0">
                            {!lida && <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--hc-accent)' }} />}
                            <button onClick={e => { e.stopPropagation(); setRemovidas(prev => new Set([...prev, n.id])) }}
                              className="p-0.5 rounded opacity-40 hover:opacity-100 transition-opacity" style={{ color: 'var(--hc-text3)' }}>
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Usuário */}
            <div className="flex items-center gap-2 pl-2 ml-1" style={{ borderLeft: '1px solid var(--hc-border)' }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'rgba(80,200,120,0.15)', border: '1px solid rgba(80,200,120,0.25)' }}>
                <span className="text-[10px] font-bold" style={{ color: 'var(--hc-accent)' }}>AD</span>
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-medium leading-none" style={{ color: 'var(--hc-text1)' }}>Administrador</p>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--hc-text3)' }}>acelivre.com.br</p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}