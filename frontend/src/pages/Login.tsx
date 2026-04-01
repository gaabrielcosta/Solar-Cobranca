import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Zap, ArrowRight, ShieldCheck } from 'lucide-react'

export default function Login() {
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senha }),
      })
      const data = await res.json()
      if (!res.ok || !data.token) {
        setErro(data.erro || 'Senha incorreta')
        return
      }
      localStorage.setItem('token', data.token)
      navigate('/dashboard')
    } catch {
      setErro('Erro ao conectar com o servidor')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col overflow-hidden"
      style={{ background: '#0a0f0a', color: '#e2e3df' }}
    >
      {/* Header */}
      <header className="fixed top-0 w-full h-16 flex items-center px-8 z-50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(80,200,120,0.12)' }}>
            <Zap size={16} style={{ color: '#50c878' }} fill="#50c878" />
          </div>
          <span className="text-sm font-extrabold tracking-widest uppercase" style={{ color: '#e2e3df' }}>ACELIVRE</span>
        </div>
      </header>

      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(circle at 50% 40%, rgba(80,200,120,0.06) 0%, transparent 60%)'
      }} />

      {/* Main */}
      <main className="flex-1 flex items-center justify-center relative px-6 pt-16">
        <div className="w-full max-w-md relative z-10">

          {/* Card */}
          <div
            className="rounded-2xl p-8 md:p-10 relative"
            style={{
              background: 'rgba(18,20,18,0.8)',
              backdropFilter: 'blur(40px)',
              border: '1px solid rgba(80,200,120,0.12)',
              boxShadow: '0 0 60px -15px rgba(80,200,120,0.2)',
            }}
          >
            {/* Logo */}
            <div className="flex flex-col items-center mb-8">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: 'rgba(80,200,120,0.1)', border: '1px solid rgba(80,200,120,0.2)' }}
              >
                <Zap size={16} style={{ color: '#50c878' }} fill="#50c878" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#e2e3df' }}>Portal de Acesso</h1>
              <p className="text-xs mt-1.5 text-center max-w-[240px]" style={{ color: '#5a6a5a' }}>
                Solar Cobrança — Insira sua senha para acessar o backoffice
              </p>
            </div>

            <form onSubmit={handleLogin} className="flex flex-col gap-5">
              {/* Campo senha */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(80,200,120,0.7)' }}>
                  Chave de Acesso
                </label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={senha}
                    onChange={e => setSenha(e.target.value)}
                    autoFocus
                    className="w-full h-12 px-4 rounded-xl text-sm outline-none transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: '#e2e3df',
                    }}
                    onFocus={e => (e.target.style.borderColor = 'rgba(80,200,120,0.4)')}
                    onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
                  />
                </div>
              </div>

              {/* Erro */}
              {erro && (
                <p className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(248,113,113,0.08)', color: '#f87171', border: '1px solid rgba(248,113,113,0.15)' }}>
                  {erro}
                </p>
              )}

              {/* Botão */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all group"
                style={{
                  background: loading ? 'rgba(80,200,120,0.15)' : 'linear-gradient(135deg, #50c878 0%, #3eb465 100%)',
                  color: loading ? '#50c878' : '#0a0f0a',
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? 'Entrando...' : (
                  <>
                    ENTRAR NO SISTEMA
                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Footer do card */}
          <div className="mt-6 flex flex-col items-center gap-2">
            <div className="h-px w-12" style={{ background: 'linear-gradient(90deg, transparent, rgba(80,200,120,0.3), transparent)' }} />
            <div className="flex items-center gap-2">
              <ShieldCheck size={12} style={{ color: 'rgba(80,200,120,0.4)' }} />
              <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'rgba(80,200,120,0.4)' }}>
                Protocolo de Segurança Ativo
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="flex justify-center items-center py-6 z-10">
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.15)' }}>
          <span className="w-6 h-px" style={{ background: 'rgba(255,255,255,0.1)' }} />
          <span>© {new Date().getFullYear()} ACELIVRE — Energia Solar Compartilhada</span>
          <span className="w-6 h-px" style={{ background: 'rgba(255,255,255,0.1)' }} />
        </div>
      </footer>
    </div>
  )
}