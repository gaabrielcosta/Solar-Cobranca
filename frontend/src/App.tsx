import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from '@/pages/Login'
import DashboardLayout from '@/components/layout/DashboardLayout'
import Clientes from '@/pages/Clientes'
import Faturas from '@/pages/Faturas'
import Usinas from '@/pages/Usinas'
import Logs from '@/pages/Logs'
import Dashboard from '@/pages/Dashboard'
import Bot from '@/pages/Bot'

function RotaProtegida({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token')
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

function ComLayout({ children }: { children: React.ReactNode }) {
  return (
    <RotaProtegida>
      <DashboardLayout>{children}</DashboardLayout>
    </RotaProtegida>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<ComLayout><Dashboard /></ComLayout>} />
        <Route path="/clientes" element={<ComLayout><Clientes /></ComLayout>} />
        <Route path="/faturas" element={<ComLayout><Faturas /></ComLayout>} />
        <Route path="/usinas"    element={<ComLayout><Usinas /></ComLayout>} />
        <Route path="/bot"       element={<ComLayout><Bot /></ComLayout>} />
        <Route path="/logs"      element={<ComLayout><Logs /></ComLayout>} />
        <Route path="*"          element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}