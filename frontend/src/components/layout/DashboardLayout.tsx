import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import { Menu, X } from 'lucide-react'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarAberta, setSidebarAberta] = useState(false)

  // Fecha sidebar ao redimensionar para desktop
  useEffect(() => {
    function onResize() {
      if (window.innerWidth >= 1024) setSidebarAberta(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <div className="flex min-h-screen bg-background">

      {/* Overlay mobile */}
      {sidebarAberta && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarAberta(false)}
        />
      )}

      {/* Sidebar — fixa em desktop, drawer em mobile */}
      <div className={`
        fixed inset-y-0 left-0 z-40 transform transition-transform duration-300 ease-in-out
        lg:relative lg:translate-x-0 lg:flex lg:flex-shrink-0
        ${sidebarAberta ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <Sidebar onClose={() => setSidebarAberta(false)} />
      </div>

      {/* Conteúdo principal */}
      <main className="flex-1 overflow-auto">
        {/* Header mobile com hambúrguer */}
        <div className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3 border-b border-border bg-background/95 backdrop-blur lg:hidden">
          <button
            onClick={() => setSidebarAberta(true)}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
              <span className="text-[10px] font-bold text-primary-foreground">A</span>
            </div>
            <span className="text-sm font-bold">ACELIVRE</span>
          </div>
        </div>

        <div className="p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  )
}