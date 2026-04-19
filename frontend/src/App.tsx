import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { TenantProvider } from '@/contexts/TenantContext'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'

function AppLayout() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <span className="text-gray-500">Cargando...</span>
      </div>
    )
  }

  return (
    <TenantProvider tenant={user ? { id: user.tenantId, name: '', slug: '' } : null}>
      <div className="flex h-screen bg-gray-100">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-auto p-6">
            <Routes>
              <Route path="/" element={<Navigate to="/personnel" replace />} />
              <Route path="/personnel" element={<div>Personal (Sprint 3–4)</div>} />
              <Route path="/hiring" element={<div>Contratación (Sprint 5–6)</div>} />
              <Route path="/quality" element={<div>Calidad (Sprint 7–9)</div>} />
              <Route path="/performance" element={<div>Desempeño (Sprint 9–10)</div>} />
              <Route path="/catalogs" element={<div>Catálogos (Sprint 1–2)</div>} />
            </Routes>
          </main>
        </div>
      </div>
    </TenantProvider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    </AuthProvider>
  )
}
