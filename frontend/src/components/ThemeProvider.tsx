import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'dark' | 'light'

const darkVars = {
  '--hc-bg':      '#0a0f0a',
  '--hc-surface': '#121412',
  '--hc-text1':   '#e2e3df',
  '--hc-text2':   '#9aaa9a',
  '--hc-text3':   '#5a6a5a',
  '--hc-border':  'rgba(255,255,255,0.06)',
  '--hc-accent':  '#50c878',
}

const lightVars = {
  '--hc-bg':      '#f5f7f5',
  '--hc-surface': '#ffffff',
  '--hc-text1':   '#1a1c1a',
  '--hc-text2':   '#4b5563',
  '--hc-text3':   '#6b7280',
  '--hc-border':  'rgba(0,0,0,0.08)',
  '--hc-accent':  '#2d9c63',
}

const ThemeContext = createContext<{
  theme: Theme
  toggleTheme: () => void
}>({ theme: 'dark', toggleTheme: () => {} })

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('theme') as Theme) || 'dark'
  })

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(theme)
    // Shadcn usa .dark
    if (theme === 'dark') root.classList.add('dark')
    localStorage.setItem('theme', theme)
    const vars = theme === 'dark' ? darkVars : lightVars
    Object.entries(vars).forEach(([key, val]) => {
      root.style.setProperty(key, val)
    })
  }, [theme])

  function toggleTheme() {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark')
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}