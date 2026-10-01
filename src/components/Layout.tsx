import React, { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { BrandLogo } from './BrandLogo'
import {
  LayoutDashboard,
  KanbanSquare,
  QrCode,
  BarChart3,
  User,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Sparkles,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

export default function Layout() {
  const { user, isAdmin, signOut, isLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [isScrolled, setIsScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 15)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Fecha o menu mobile ao navegar
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  const handleLogout = () => {
    signOut()
    navigate('/login')
  }

  // Gera iniciais para o avatar
  const getInitials = (name?: string, email?: string) => {
    if (name) {
      const parts = name.trim().split(' ')
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase()
      }
      return name.slice(0, 2).toUpperCase()
    }
    if (email) {
      return email.slice(0, 2).toUpperCase()
    }
    return 'BC'
  }

  const navItems = [
    { label: 'Painel', to: '/painel', icon: LayoutDashboard },
    { label: 'Oportunidades', to: '/oportunidades', icon: KanbanSquare },
    ...(isAdmin ? [{ label: 'Métricas da Equipe', to: '/metricas', icon: BarChart3 }] : []),
    { label: 'Formulário', to: '/formulario', icon: QrCode },
  ]

  return (
    <div className="min-h-screen flex flex-col bg-[#0A0B0E] text-[#F5F6F8]">
      {/* Header Fixo com Backdrop Blur ao rolar */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 border-b ${
          isScrolled
            ? 'bg-[#0A0B0E]/85 backdrop-blur-md border-[#262A33] shadow-lg shadow-black/40'
            : 'bg-[#0A0B0E]/40 backdrop-blur-sm border-transparent'
        }`}
      >
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo & Marca */}
          <div className="flex items-center gap-6">
            <NavLink to="/painel" className="focus:outline-none flex items-center">
              <BrandLogo variant="compact" size="md" showCrmBadge={false} />
            </NavLink>
          </div>

          {/* Navegação Desktop */}
          <nav className="hidden md:flex items-center gap-1.5 bg-[#12141A]/70 p-1 rounded-xl border border-[#262A33]">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.to
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-600/90 to-blue-600/90 text-white shadow-sm shadow-indigo-500/20'
                      : 'text-gray-400 hover:text-white hover:bg-[#1A1D27]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                </NavLink>
              )
            })}
          </nav>

          {/* Área do Usuário / Menu Dropdown */}
          <div className="flex items-center gap-3">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2.5 p-1.5 pl-2.5 pr-2 rounded-xl bg-[#12141A] border border-[#262A33] hover:border-indigo-500/50 hover:bg-[#171A24] transition-all text-left group">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-600 to-blue-500 text-white font-semibold text-xs flex items-center justify-center shadow-inner">
                      {getInitials(user.name, user.email)}
                    </div>
                    <div className="hidden sm:flex flex-col text-left mr-1">
                      <span className="text-xs font-medium text-gray-200 line-clamp-1 max-w-[110px]">
                        {user.name || user.email.split('@')[0]}
                      </span>
                      <span className="text-[10px] text-gray-500 line-clamp-1">
                        {isAdmin ? 'Administrador' : 'Vendedor'}
                      </span>
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-gray-500 group-hover:text-gray-300 transition-colors" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-56 bg-[#12141A] border-[#262A33] text-gray-200 p-1.5 rounded-xl shadow-2xl"
                >
                  <DropdownMenuLabel className="font-normal px-2 py-1.5">
                    <div className="flex flex-col space-y-1">
                      <p className="text-xs font-semibold text-white leading-none">
                        {user.name || 'Usuário bitCRM'}
                      </p>
                      <p className="text-[11px] text-gray-400 leading-none truncate">
                        {user.email}
                      </p>
                      {isAdmin && (
                        <span className="text-[10px] text-indigo-400 font-semibold mt-1">
                          Perfil: Administrador
                        </span>
                      )}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-[#262A33]" />
                  {isAdmin && (
                    <DropdownMenuItem
                      onClick={() => navigate('/metricas')}
                      className="cursor-pointer text-xs flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-[#1A1D27] focus:bg-[#1A1D27] text-indigo-300 hover:text-white"
                    >
                      <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
                      Métricas da Equipe
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={() => navigate('/perfil')}
                    className="cursor-pointer text-xs flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-[#1A1D27] focus:bg-[#1A1D27] text-gray-300 hover:text-white"
                  >
                    <User className="w-3.5 h-3.5 text-indigo-400" />
                    Meu Perfil
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => navigate('/formulario')}
                    className="cursor-pointer text-xs flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-[#1A1D27] focus:bg-[#1A1D27] text-gray-300 hover:text-white"
                  >
                    <QrCode className="w-3.5 h-3.5 text-blue-400" />
                    Meu Link do Formulário
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-[#262A33]" />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="cursor-pointer text-xs flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-red-950/40 focus:bg-red-950/40 text-red-400 hover:text-red-300"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sair da Conta
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : !isLoading ? (
              <Button
                size="sm"
                onClick={() => navigate('/login')}
                className="bg-indigo-600 hover:bg-indigo-500 text-xs text-white"
              >
                Entrar
              </Button>
            ) : null}

            {/* Botão Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg bg-[#12141A] border border-[#262A33] text-gray-400 hover:text-white"
              aria-label="Abrir menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Drawer / Menu Mobile */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#0E1017] border-b border-[#262A33] px-4 py-4 space-y-2 animate-fadeInUp">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.to
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40'
                      : 'text-gray-400 hover:text-white hover:bg-[#151821]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </NavLink>
              )
            })}
            <div className="pt-2 border-t border-[#262A33]">
              <NavLink
                to="/perfil"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:bg-[#151821]"
              >
                <User className="w-4 h-4 text-indigo-400" />
                Meu Perfil
              </NavLink>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-950/30 text-left"
              >
                <LogOut className="w-4 h-4" />
                Sair
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-1 pt-20 pb-16 px-4 sm:px-6 max-w-[1240px] w-full mx-auto">
        <Outlet />
      </main>

      {/* Rodapé Minimalista Elegante */}
      <footer className="border-t border-[#262A33]/80 bg-[#0A0B0E]/90 py-6 px-4 sm:px-6">
        <div className="max-w-[1240px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-400">bit Consulting</span>
            <span>—</span>
            <span>Transformação Estratégica & Comercial</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-gray-400">
              <Sparkles className="w-3 h-3 text-indigo-400" />
              Feito com cuidado para equipes de alta performance
            </span>
            <span>&copy; {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
