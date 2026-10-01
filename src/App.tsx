/* Main App Component - Handles routing (using react-router-dom), query client and other providers */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider, useAuth } from '@/hooks/use-auth'

import Index from './pages/Index'
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import VerifyEmail from './pages/VerifyEmail'
import ConfirmEmailChange from './pages/ConfirmEmailChange'
import SetPassword from './pages/SetPassword'

import Dashboard from './pages/Dashboard'
import Opportunities from './pages/Opportunities'
import FormManager from './pages/FormManager'
import PublicForm from './pages/PublicForm'
import Profile from './pages/Profile'
import NotFound from './pages/NotFound'
import AdminMetrics from './pages/AdminMetrics'
import UserManagement from './pages/UserManagement'
import Commission from './pages/Commission'
import Layout from './components/Layout'
import { Loader2 } from 'lucide-react'

// Componente para a rota de primeiro acesso /definir-senha
// Usuário precisa estar autenticado; se NÃO precisar trocar a senha, vai para /painel
const FirstAccessRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, mustChangePassword, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0B0E]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!mustChangePassword) {
    return <Navigate to="/painel" replace />
  }

  return <>{children}</>
}

// Componente para proteger rotas exclusivas de administradores
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAdmin, mustChangePassword, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0B0E]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (mustChangePassword) {
    return <Navigate to="/definir-senha" replace />
  }

  if (!isAdmin) {
    return <Navigate to="/painel" replace />
  }

  return <>{children}</>
}

// Componente para proteger rotas autenticadas comuns
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, mustChangePassword, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0B0E]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Se o usuário precisa definir nova senha no primeiro acesso, bloqueia navegação para o CRM
  if (mustChangePassword) {
    return <Navigate to="/definir-senha" replace />
  }

  return <>{children}</>
}

// Componente para rotas públicas de auth (redireciona para /painel ou /definir-senha se já logado)
const UnauthenticatedOnly = ({ children }: { children: React.ReactNode }) => {
  const { user, mustChangePassword, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0B0E]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    )
  }

  if (user) {
    if (mustChangePassword) {
      return <Navigate to="/definir-senha" replace />
    }
    return <Navigate to="/painel" replace />
  }

  return <>{children}</>
}

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Routes>
          {/* Rota Raiz */}
          <Route path="/" element={<Index />} />

          {/* Rota Protegida de Primeiro Acesso (Definir Nova Senha) */}
          <Route
            path="/definir-senha"
            element={
              <FirstAccessRoute>
                <SetPassword />
              </FirstAccessRoute>
            }
          />

          {/* Rotas de Autenticação Públicas */}
          <Route
            path="/login"
            element={
              <UnauthenticatedOnly>
                <Login />
              </UnauthenticatedOnly>
            }
          />
          <Route
            path="/esqueci-senha"
            element={
              <UnauthenticatedOnly>
                <ForgotPassword />
              </UnauthenticatedOnly>
            }
          />
          <Route path="/resetar-senha" element={<ResetPassword />} />
          <Route path="/verificar-email" element={<VerifyEmail />} />
          <Route path="/confirmar-alteracao-email" element={<ConfirmEmailChange />} />

          {/* Rota Pública do Formulário de Captação do Cliente */}
          <Route path="/formulario/publico" element={<PublicForm />} />
          <Route path="/formulario/:vendedorId" element={<PublicForm />} />

          {/* Rotas Autenticadas protegidas com Layout Global */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/painel" element={<Dashboard />} />
            <Route path="/oportunidades" element={<Opportunities />} />
            <Route path="/comissionamento" element={<Commission />} />
            <Route path="/formulario" element={<FormManager />} />
            <Route
              path="/metricas"
              element={
                <AdminRoute>
                  <AdminMetrics />
                </AdminRoute>
              }
            />
            <Route
              path="/usuarios"
              element={
                <AdminRoute>
                  <UserManagement />
                </AdminRoute>
              }
            />
            <Route path="/perfil" element={<Profile />} />
          </Route>

          {/* Rota 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
