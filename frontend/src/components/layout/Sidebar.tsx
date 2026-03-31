import { useNavigate, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  BarChart2,
  Users,
  FileText,
  Sun,
  Moon,
  Bot,
  ClipboardList,
  LogOut,
  Upload,
  Zap,
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

export default function Sidebar() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { theme, toggleTheme } = useTheme()

  function sair() {
    localStorage.removeItem('token')
    navigate('/login')
  }

  function isAtivo(path: string) {
    const base = path.split('?')[0]
    return location.pathname === base || location.pathname.startsWith(base + '/')
  }

  return (
    <aside className="flex flex-col w-52 min-h-screen bg-card border-r border-border">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
          <Zap size={16} className="text-primary-foreground" />
        </div>
        <div>
          <p className="text-sm font-bold leading-none">ACELIVRE</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Backoffice v1.0</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-4 flex-1 px-3 py-4 overflow-y-auto">
        {grupos.map(grupo => (
          <div key={grupo.label}>
            <p className="text-[10px] font-semibold text-muted-foreground/60 tracking-widest px-2 mb-1">
              {grupo.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {grupo.itens.map(({ icon: Icon, label, path }) => {
                const ativo = isAtivo(path)
                return (
                  <button
                    key={path}
                    onClick={() => navigate(path.split('?')[0])}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 h-9 rounded-lg text-sm transition-colors text-left',
                      ativo
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <Icon size={16} className="flex-shrink-0" />
                    <span className="truncate">{label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Rodapé */}
      <div className="px-3 py-4 border-t border-border flex flex-col gap-1">
        <div className="flex items-center gap-2 px-3 py-2 mb-1">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[11px] text-muted-foreground">Sistema operacional</span>
        </div>
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-3 h-9 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          <span>{theme === 'dark' ? 'Tema claro' : 'Tema escuro'}</span>
        </button>
        <button
          onClick={sair}
          className="w-full flex items-center gap-3 px-3 h-9 rounded-lg text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <LogOut size={16} />
          <span>Sair</span>
        </button>
      </div>
    </aside>
  )
}