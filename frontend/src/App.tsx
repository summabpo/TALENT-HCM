import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { TenantProvider } from '@/contexts/TenantContext'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'

// Admin
import TenantListPage from '@/pages/admin/TenantListPage'
import TenantFormPage from '@/pages/admin/TenantFormPage'
import TenantModulesPage from '@/pages/admin/TenantModulesPage'

// Personnel
import EmployeeListPage from '@/pages/personnel/EmployeeListPage'
import EmployeeDetailPage from '@/pages/personnel/EmployeeDetailPage'
import EmployeeFormPage from '@/pages/personnel/EmployeeFormPage'
import ContractDetailPage from '@/pages/personnel/ContractDetailPage'
import ContractFormPage from '@/pages/personnel/ContractFormPage'
import OnboardingPage from '@/pages/personnel/OnboardingPage'

// Hiring
import HiringProcessListPage from '@/pages/hiring/HiringProcessListPage'
import HiringProcessFormPage from '@/pages/hiring/HiringProcessFormPage'
import HiringProcessDetailPage from '@/pages/hiring/HiringProcessDetailPage'
import CandidateDetailPage from '@/pages/hiring/CandidateDetailPage'

// Quality
import QualityDashboardPage from '@/pages/quality/QualityDashboardPage'
import QualityProcessListPage from '@/pages/quality/QualityProcessListPage'
import QualityProcessDetailPage from '@/pages/quality/QualityProcessDetailPage'
import NonconformityListPage from '@/pages/quality/NonconformityListPage'
import NonconformityDetailPage from '@/pages/quality/NonconformityDetailPage'
import NonconformityFormPage from '@/pages/quality/NonconformityFormPage'

// Performance
import OKRPeriodListPage from '@/pages/performance/OKRPeriodListPage'
import OKRDashboardPage from '@/pages/performance/OKRDashboardPage'
import KPIListPage from '@/pages/performance/KPIListPage'
import KPIDashboardPage from '@/pages/performance/KPIDashboardPage'

// Admin — global catalogs
import AdminCatalogsIndexPage from '@/pages/admin/catalogs/AdminCatalogsIndexPage'
import AdminCountryPage from '@/pages/admin/catalogs/AdminCountryPage'
import AdminStatePage from '@/pages/admin/catalogs/AdminStatePage'
import AdminCityPage from '@/pages/admin/catalogs/AdminCityPage'
import AdminDocumentTypePage from '@/pages/admin/catalogs/AdminDocumentTypePage'
import AdminBankPage from '@/pages/admin/catalogs/AdminBankPage'
import AdminSocialSecurityPage from '@/pages/admin/catalogs/AdminSocialSecurityPage'

// Settings — tenant catalogs
import OrganizationalLevelPage from '@/pages/settings/catalogs/OrganizationalLevelPage'
import PositionPage from '@/pages/settings/catalogs/PositionPage'
import CostCenterPage from '@/pages/settings/catalogs/CostCenterPage'
import SubCostCenterPage from '@/pages/settings/catalogs/SubCostCenterPage'
import WorkLocationPage from '@/pages/settings/catalogs/WorkLocationPage'
import WorkCenterPage from '@/pages/settings/catalogs/WorkCenterPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
})

function ProtectedLayout() {
  const { user, tenant, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return (
    <TenantProvider tenant={tenant}>
      <div className="flex h-screen bg-summa-surface">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-auto p-6">
            <Routes>
              <Route path="/" element={<DashboardPage />} />

              {/* Personnel */}
              <Route path="/personnel" element={<Navigate to="/personnel/employees" replace />} />
              <Route path="/personnel/employees" element={<EmployeeListPage />} />
              <Route path="/personnel/employees/create" element={<EmployeeFormPage />} />
              <Route path="/personnel/employees/:id" element={<EmployeeDetailPage />} />
              <Route path="/personnel/employees/:id/edit" element={<EmployeeFormPage />} />
              <Route path="/personnel/employees/:id/contracts/create" element={<ContractFormPage />} />
              <Route path="/personnel/employees/:id/contracts/:contractId/edit" element={<ContractFormPage />} />
              <Route path="/personnel/employees/:id/contracts/:contractId" element={<ContractDetailPage />} />
              <Route path="/personnel/employees/:id/onboarding" element={<OnboardingPage />} />

              {/* Hiring */}
              <Route path="/hiring" element={<Navigate to="/hiring/processes" replace />} />
              <Route path="/hiring/processes" element={<HiringProcessListPage />} />
              <Route path="/hiring/processes/create" element={<HiringProcessFormPage />} />
              <Route path="/hiring/processes/:id/edit" element={<HiringProcessFormPage />} />
              <Route path="/hiring/processes/:id" element={<HiringProcessDetailPage />} />
              <Route path="/hiring/processes/:processId/candidates/:id" element={<CandidateDetailPage />} />

              {/* Quality */}
              <Route path="/quality" element={<Navigate to="/quality/dashboard" replace />} />
              <Route path="/quality/dashboard" element={<QualityDashboardPage />} />
              <Route path="/quality/processes" element={<QualityProcessListPage />} />
              <Route path="/quality/processes/:id" element={<QualityProcessDetailPage />} />
              <Route path="/quality/nonconformities" element={<NonconformityListPage />} />
              <Route path="/quality/nonconformities/create" element={<NonconformityFormPage />} />
              <Route path="/quality/nonconformities/:id/edit" element={<NonconformityFormPage />} />
              <Route path="/quality/nonconformities/:id" element={<NonconformityDetailPage />} />

              {/* Performance */}
              <Route path="/performance" element={<Navigate to="/performance/periods" replace />} />
              <Route path="/performance/periods" element={<OKRPeriodListPage />} />
              <Route path="/performance/periods/:periodId/dashboard" element={<OKRDashboardPage />} />
              <Route path="/performance/kpis" element={<KPIListPage />} />
              <Route path="/performance/kpis/:id/dashboard" element={<KPIDashboardPage />} />

              {/* Admin — UI en el SPA (no Django /admin/…) */}
              <Route path="/admin" element={<Navigate to="/admin/tenants" replace />} />
              <Route path="/admin/tenants" element={<TenantListPage />} />
              <Route path="/admin/tenants/create" element={<TenantFormPage />} />
              <Route path="/admin/tenants/:id/edit" element={<TenantFormPage />} />
              <Route path="/admin/tenants/:id/modules" element={<TenantModulesPage />} />

              {/* Admin — global catalogs */}
              <Route path="/admin/catalogs" element={<AdminCatalogsIndexPage />} />
              <Route path="/admin/catalogs/countries" element={<AdminCountryPage />} />
              <Route path="/admin/catalogs/states" element={<AdminStatePage />} />
              <Route path="/admin/catalogs/cities" element={<AdminCityPage />} />
              <Route path="/admin/catalogs/document-types" element={<AdminDocumentTypePage />} />
              <Route path="/admin/catalogs/banks" element={<AdminBankPage />} />
              <Route path="/admin/catalogs/social-security" element={<AdminSocialSecurityPage />} />

              {/* Settings — tenant catalogs */}
              <Route path="/settings" element={<Navigate to="/settings/catalogs/organizational-levels" replace />} />
              <Route path="/settings/catalogs" element={<Navigate to="/settings/catalogs/organizational-levels" replace />} />
              <Route path="/settings/catalogs/organizational-levels" element={<OrganizationalLevelPage />} />
              <Route path="/settings/catalogs/positions" element={<PositionPage />} />
              <Route path="/settings/catalogs/cost-centers" element={<CostCenterPage />} />
              <Route path="/settings/catalogs/sub-cost-centers" element={<SubCostCenterPage />} />
              <Route path="/settings/catalogs/work-locations" element={<WorkLocationPage />} />
              <Route path="/settings/catalogs/work-centers" element={<WorkCenterPage />} />

              {/* Legacy redirect */}
              <Route path="/catalogs" element={<Navigate to="/settings/catalogs" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </TenantProvider>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/*" element={<ProtectedLayout />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
