import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import { Menu, Search, Bell } from 'lucide-react'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarAberta, setSidebarAberta] = useState(false)

  useEffect(() => {
    function onResize() {
      if (window.innerWidth >= 1024) setSidebarAberta(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--hc-bg)' }}>

      {sidebarAberta && (
        <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setSidebarAberta(false)} />
      )}

      <div className={`
        fixed inset-y-0 left-0 z-40 transform transition-transform duration-300 ease-in-out
        lg:relative lg:translate-x-0 lg:flex lg:flex-shrink-0
        ${sidebarAberta ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <Sidebar onClose={() => setSidebarAberta(false)} />
      </div>

      <div className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <header
          className="sticky top-0 z-20 flex items-center justify-between px-4 lg:px-6 h-14"
          style={{ background: 'var(--hc-surface)', borderBottom: '1px solid var(--hc-border)' }}
        >
          <div className="flex items-center gap-3 flex-1">
            <button
              onClick={() => setSidebarAberta(true)}
              className="lg:hidden p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--hc-text3)' }}
            >
              <Menu size={20} />
            </button>
            <div className="relative hidden sm:flex items-center max-w-xs w-full">
              <Search size={14} className="absolute left-3" style={{ color: 'var(--hc-text3)' }} />
              <input
                type="text"
                placeholder="Buscar beneficiário ou fatura..."
                className="w-full h-8 pl-8 pr-3 rounded-lg text-xs focus:outline-none transition-colors"
                style={{
                  background: 'var(--hc-input-bg)',
                  border: '1px solid var(--hc-border)',
                  color: 'var(--hc-text1)',
                }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className="p-2 rounded-lg transition-colors relative" style={{ color: 'var(--hc-text2)' }}>
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-green-400" />
            </button>
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