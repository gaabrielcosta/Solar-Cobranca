import { useNavigate, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, BarChart2, Users, FileText, Sun, Moon,
  Bot, ClipboardList, LogOut, Upload, Zap, X,
} from 'lucide-react'
import { useTheme } from '@/components/ThemeProvider'

const grupos = [
  {
    label: 'PAINEL',
    itens: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
      { icon: BarChart2,       label: 'Analytics',  path: '/analytics' },
    ],
  },
  {
    label: 'GESTÃO',
    itens: [
      { icon: FileText, label: 'Faturas',  path: '/faturas' },
      { icon: Users,    label: 'Clientes', path: '/clientes' },
      { icon: Sun,      label: 'Usinas',   path: '/usinas' },
    ],
  },
  {
    label: 'OPERAÇÕES',
    itens: [
      { icon: Upload,        label: 'Upload de PDFs', path: '/upload' },
      { icon: Zap,           label: 'Créditos kWh',   path: '/creditos' },
      { icon: ClipboardList, label: 'Log',             path: '/logs' },
    ],
  },
  {
    label: 'AUTOMAÇÃO',
    itens: [
      { icon: Bot, label: 'Bot WhatsApp', path: '/bot' },
    ],
  },
]

interface SidebarProps {
  onClose?: () => void
}

export default function Sidebar({ onClose }: SidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { theme, toggleTheme } = useTheme()

  function sair() {
    localStorage.removeItem('token')
    navigate('/login')
  }

  function isAtivo(path: string) {
    const base = path.split('?')[0]
    return location.pathname === base || location.pathname.startsWith(base + '/')
  }

  function navegar(path: string) {
    navigate(path.split('?')[0])
    onClose?.()
  }

  return (
    <aside
      className="flex flex-col w-52 h-screen sticky top-0"
      style={{ background: 'var(--hc-surface)', borderRight: '1px solid var(--hc-border)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4" style={{ borderBottom: '1px solid var(--hc-border)' }}>
        <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center flex-shrink-0">
          <Zap size={15} className="text-black" fill="black" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold leading-none tracking-wide" style={{ color: 'var(--hc-text1)' }}>ACELIVRE</p>
          <p className="text-[10px] mt-0.5 tracking-wide" style={{ color: 'var(--hc-accent)', opacity: 0.7 }}>BACKOFFICE V1.0</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="lg:hidden p-1 rounded" style={{ color: 'var(--hc-text3)' }}>
            <X size={15} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-3 flex-1 px-3 py-3 overflow-y-auto">
        {grupos.map(grupo => (
          <div key={grupo.label}>
            <p className="text-[9px] font-semibold tracking-widest px-2 mb-1" style={{ color: 'var(--hc-text3)' }}>
              {grupo.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {grupo.itens.map(({ icon: Icon, label, path }) => {
                const ativo = isAtivo(path)
                return (
                  <button
                    key={path}
                    onClick={() => navegar(path)}
                    style={ativo ? {
                      background: 'linear-gradient(90deg, rgba(80,200,120,0.12) 0%, transparent 100%)',
                      borderLeft: '3px solid var(--hc-accent)',
                      color: 'var(--hc-accent)',
                      fontWeight: 600,
                    } : {
                      borderLeft: '3px solid transparent',
                      color: 'var(--hc-text3)',
                    }}
                    className="w-full flex items-center gap-3 px-3 h-9 rounded-lg text-xs transition-all text-left"
                  >
                    <Icon size={14} className="flex-shrink-0" />
                    <span className="truncate">{label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Rodapé */}
      <div className="px-3 py-3 flex flex-col gap-0.5" style={{ borderTop: '1px solid var(--hc-border)' }}>
        <div className="flex items-center gap-2 px-2 py-1.5 mb-0.5">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
          <span className="text-[10px]" style={{ color: 'var(--hc-text3)' }}>Sistema operacional</span>
        </div>
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-2.5 px-2.5 h-8 rounded-lg text-xs transition-colors"
          style={{ color: 'var(--hc-text3)' }}
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          <span>{theme === 'dark' ? 'Tema claro' : 'Tema escuro'}</span>
        </button>
        <button
          onClick={sair}
          className="w-full flex items-center gap-2.5 px-2.5 h-8 rounded-lg text-xs transition-colors hover:text-red-400"
          style={{ color: 'var(--hc-text3)' }}
        >
          <LogOut size={14} />
          <span>Sair</span>
        </button>
      </div>
    </aside>
  )
}