import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useAuthStore } from './stores/authStore'
import { useAppStore } from './stores/appStore'
import { getAppSettings } from './api/realService'
import ProtectedRoute from './components/layout/ProtectedRoute'
import AppLayout from './components/layout/AppLayout'
import { ToastContainer } from './components/ui/Toast'

import LoginPage from './pages/auth/LoginPage'
import DashboardPage from './pages/dashboard/DashboardPage'
import CompaniesPage from './pages/org/CompaniesPage'
import OrganizationPage from './pages/org/OrganizationPage'
import EmployeesPage from './pages/employees/EmployeesPage'
import ShiftsPage from './pages/shifts/ShiftsPage'
import AttendancePage from './pages/attendance/AttendancePage'
import DeviceIntegrationPage from './pages/attendance/DeviceIntegrationPage'
import OvertimePage from './pages/overtime/OvertimePage'
import PayrollPage from './pages/payroll/PayrollPage'
import ManualDeductionPage from './pages/payroll/ManualDeductionPage'
import LeavePage from './pages/leave/LeavePage'
import DocumentsPage from './pages/documents/DocumentsPage'
import ReportsPage from './pages/dashboard/ReportsPage'
import WorkSettingsPage from './pages/settings/WorkSettingsPage'
import WorkExceptionPage from './pages/settings/WorkExceptionPage'
import UsersPage from './pages/users/UsersPage'
import AuditPage from './pages/settings/AuditPage'
import AppSettingsPage from './pages/settings/AppSettingsPage'

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } })

function RootRedirect() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn())
  return <Navigate to={isLoggedIn ? '/dashboard' : '/login'} replace />
}

function AppSettingsLoader() {
  const setAppSettings = useAppStore(s => s.setAppSettings)
  useEffect(() => {
    getAppSettings().then(data => { if (data) setAppSettings(data) }).catch(() => {})
  }, [])
  return null
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppSettingsLoader />
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/companies" element={<CompaniesPage />} />
            <Route path="/organization" element={<OrganizationPage />} />
            <Route path="/employees" element={<EmployeesPage />} />
            <Route path="/shifts" element={<ShiftsPage />} />
            <Route path="/attendance" element={<AttendancePage />} />
            <Route path="/device-integration" element={<DeviceIntegrationPage />} />
            <Route path="/overtime" element={<OvertimePage />} />
            <Route path="/payroll" element={<PayrollPage />} />
            <Route path="/manual-deductions" element={<ManualDeductionPage />} />
            <Route path="/leave" element={<LeavePage />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/work-settings" element={<WorkSettingsPage />} />
            <Route path="/work-exceptions" element={<WorkExceptionPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/audit" element={<AuditPage />} />
            <Route path="/app-settings" element={<AppSettingsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <ToastContainer />
    </QueryClientProvider>
  )
}
