import { useNavigate, useLocation } from 'react-router-dom'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  FileText,
  Sun,
  Moon,
  Bot,
  ClipboardList,
  LogOut,
  Upload, 
} from 'lucide-react'
import { useTheme } from '@/components/ThemeProvider'


const itens = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: Users,           label: 'Clientes',  path: '/clientes' },
  { icon: FileText,        label: 'Faturas',   path: '/faturas' },
  { icon: Sun,             label: 'Usinas',    path: '/usinas' },
  { icon: Upload,          label: 'Upload',    path: '/upload' },
  { icon: Bot,             label: 'Bot',       path: '/bot' },
  { icon: ClipboardList,   label: 'Logs',      path: '/logs' },
]

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { theme, toggleTheme } = useTheme()

  function sair() {
    localStorage.removeItem('token')
    navigate('/login')
  }

  return (
    <aside className="flex flex-col items-center w-16 min-h-screen bg-card border-r border-border py-4 gap-2">
      <div className="mb-4">
        <img src="/acelivre_logo.png" alt="ACELIVRE" className="w-8 h-8 object-contain" />
      </div>

      <div className="flex flex-col gap-1 flex-1 w-full px-2">
        {itens.map(({ icon: Icon, label, path }) => {
          const ativo = location.pathname.startsWith(path)
          return (
            <Tooltip key={path}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => navigate(path)}
                  className={cn(
                    'w-full flex items-center justify-center h-10 rounded-md transition-colors',
                    ativo
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Icon size={20} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{label}</TooltipContent>
            </Tooltip>
          )
        })}
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
            <button
            onClick={toggleTheme}
            className="w-10 h-10 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
        </TooltipTrigger>
        <TooltipContent side="right">
            {theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
        </TooltipContent>
        </Tooltip>
        <Tooltip>
        <TooltipTrigger asChild>
            <button
            onClick={sair}
            className="w-10 h-10 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
            <LogOut size={20} />
            </button>
        </TooltipTrigger>
        <TooltipContent side="right">Sair</TooltipContent>
        </Tooltip>
    </aside>
  )
}