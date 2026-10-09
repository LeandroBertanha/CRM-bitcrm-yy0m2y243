import React, { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import useRealtime from '@/hooks/use-realtime'
import pb from '@/lib/pocketbase/client'
import { Opportunity, getReturnAlertInfo } from '@/types/crm'
import { BrandLogo } from './BrandLogo'
import {
  LayoutDashboard,
  KanbanSquare,
  QrCode,
  BarChart3,
  Users,
  User,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Sparkles,
  Coins,
  Bell,
  Clock,
  AlertTriangle,
  Headset,
  Play,
  Phone,
  MapPin,
  MessageSquare,
  HelpCircle,
  ShieldAlert,
  DollarSign,
  History,
  Settings,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'

export default function Layout() {
  const { user, isAdmin, signOut, isLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [isScrolled, setIsScrolled] = useState(false)
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])

  // Buscar oportunidades para badge/sino de notificações de retornos
  const fetchOpps = React.useCallback(async () => {
    if (!user) return
    try {
      const records = await pb.collection('opportunities').getFullList<Opportunity>({
        fields: 'id,company,stage,seller,return_at',
      })
      setOpportunities(records)
    } catch {
      // Ignora erro
    }
  }, [user])

  useEffect(() => {
    fetchOpps()
  }, [fetchOpps])

  useRealtime<Opportunity>('opportunities', () => {
    fetchOpps()
  })

  // Contagem de alertas ativos para o usuário logado (ou todos para admin)
  const { overdueCount, todayCount } = React.useMemo(() => {
    if (!user) return { overdueCount: 0, todayCount: 0 }
    let overdue = 0
    let today = 0

    for (const opp of opportunities) {
      if (!opp.return_at) continue
      // Se não for admin, apenas da sua carteira
      if (!isAdmin) {
        const isMyOpp = !opp.seller || opp.seller === user.id
        if (!isMyOpp) continue
      }
      const info = getReturnAlertInfo(opp.return_at, opp.stage)
      if (info.status === 'overdue') overdue++
      else if (info.status === 'today') today++
    }

    return { overdueCount: overdue, todayCount: today }
  }, [opportunities, user, isAdmin])

  const totalAlertsCount = overdueCount + todayCount

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
    { label: 'Comissionamento', to: '/comissionamento', icon: Coins },
    ...(isAdmin
      ? [
          { label: 'Métricas da Equipe', to: '/metricas', icon: BarChart3 },
          { label: 'Usuários', to: '/usuarios', icon: Users },
        ]
      : []),
    { label: 'Formulário', to: '/formulario', icon: QrCode },
  ]

  return (
    <TooltipProvider delayDuration={0} skipDelayDuration={0}>
      <div className="min-h-screen flex flex-col bg-[#0A0B0E] text-[#F5F6F8]">
        {/* Header Superior Fixo com Backdrop Blur ao rolar */}
        <header
          className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 border-b ${
            isScrolled
              ? 'bg-[#0A0B0E]/85 backdrop-blur-md border-[#262A33] shadow-lg shadow-black/40'
              : 'bg-[#0A0B0E]/40 backdrop-blur-sm border-transparent'
          }`}
        >
          <div className="w-full px-3 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-2 sm:gap-4">
            {/* Logo oficial da bit Consulting */}
            <div className="flex items-center min-w-0 shrink">
              <NavLink to="/painel" className="focus:outline-none flex items-center py-1 min-w-0">
                <BrandLogo variant="compact" size="lg" showCrmBadge={false} />
              </NavLink>
            </div>

            {/* Área do Usuário / Notificações / Menu Dropdown */}
            <div className="flex items-center gap-3">
              {user && (
                <NavLink
                  to="/painel"
                  title={
                    totalAlertsCount > 0
                      ? `${totalAlertsCount} retorno(s) agendado(s): ${overdueCount} atrasado(s) e ${todayCount} para hoje. Clique para abrir.`
                      : 'Nenhum retorno agendado pendente'
                  }
                  className={`relative p-2 rounded-xl border transition-all ${
                    overdueCount > 0
                      ? 'bg-rose-950/40 border-rose-600/50 text-rose-300 hover:bg-rose-950/60 shadow-sm shadow-rose-900/30'
                      : todayCount > 0
                        ? 'bg-amber-950/40 border-amber-600/50 text-amber-300 hover:bg-amber-950/60 shadow-sm shadow-amber-900/30'
                        : 'bg-[#12141A] border-[#262A33] text-gray-400 hover:text-white hover:bg-[#181B24]'
                  }`}
                >
                  <Bell className={`w-4 h-4 ${overdueCount > 0 ? 'animate-bounce' : ''}`} />
                  {totalAlertsCount > 0 && (
                    <span
                      className={`absolute -top-1 -right-1 px-1.5 py-0.2 text-[10px] font-bold rounded-full border leading-tight ${
                        overdueCount > 0
                          ? 'bg-rose-600 text-white border-rose-400 shadow-sm shadow-rose-600/50'
                          : 'bg-amber-500 text-black border-amber-300'
                      }`}
                    >
                      {totalAlertsCount}
                    </span>
                  )}
                </NavLink>
              )}

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
                      <>
                        <DropdownMenuItem
                          onClick={() => navigate('/metricas')}
                          className="cursor-pointer text-xs flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-[#1A1D27] focus:bg-[#1A1D27] text-indigo-300 hover:text-white"
                        >
                          <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
                          Métricas da Equipe
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => navigate('/usuarios')}
                          className="cursor-pointer text-xs flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-[#1A1D27] focus:bg-[#1A1D27] text-indigo-300 hover:text-white"
                        >
                          <Users className="w-3.5 h-3.5 text-indigo-400" />
                          Gestão de Usuários
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuItem
                      onClick={() => navigate('/comissionamento')}
                      className="cursor-pointer text-xs flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-[#1A1D27] focus:bg-[#1A1D27] text-gray-300 hover:text-white"
                    >
                      <Coins className="w-3.5 h-3.5 text-indigo-400" />
                      Comissionamento
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => navigate('/perfil')}
                      className="cursor-pointer text-xs flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-[#1A1D27] focus:bg-[#1A1D27] text-gray-300 hover:text-white"
                    >
                      <User className="w-3.5 h-3.5 text-indigo-400" />
                      Meu Perfil
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => navigate('/perfil#alterar-senha')}
                      className="cursor-pointer text-xs flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-[#1A1D27] focus:bg-[#1A1D27] text-gray-300 hover:text-white"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      Alterar Senha
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
            </div>
          </div>
        </header>

        {/* Menu Dock Flutuante Estilo Instagram (Desktop na lateral, Mobile na base) */}
        <aside
          aria-label="Menu Lateral bitCRM"
          className="fixed z-40 transition-none
            md:top-1/2 md:-translate-y-1/2 md:left-4 md:bottom-auto
            bottom-3 left-1/2 -translate-x-1/2 md:translate-x-0
            max-w-[calc(100vw-1.5rem)]
            bg-[#0E1017]/85 backdrop-blur-md
            border border-[#262A33]/90
            rounded-2xl sm:rounded-3xl
            p-1.5 sm:p-2
            shadow-2xl shadow-black/70"
        >
          {/* Navegação Principal por Ícones (vertical no desktop, horizontal no mobile) */}
          <nav
            aria-label="Navegação Principal"
            className="flex flex-row md:flex-col items-center gap-1 sm:gap-1.5"
          >
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.to
              return (
                <Tooltip key={item.to}>
                  <TooltipTrigger asChild>
                    <NavLink
                      to={item.to}
                      aria-label={item.label}
                      className={`w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-xl sm:rounded-2xl border select-none transition-colors ${
                        isActive
                          ? 'bg-gradient-to-r from-indigo-600/90 to-blue-600/90 text-white border-indigo-500/60 shadow-sm shadow-indigo-500/30'
                          : 'border-transparent text-gray-400 hover:text-white hover:bg-[#1A1D27] hover:border-[#262A33]'
                      }`}
                    >
                      <Icon className="w-5 h-5 shrink-0" />
                    </NavLink>
                  </TooltipTrigger>
                  <TooltipContent
                    side="right"
                    sideOffset={10}
                    disableAnimation
                    className="bg-[#12141A] text-white border-[#262A33] text-xs font-semibold px-2.5 py-1.5 rounded-lg shadow-xl"
                  >
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              )
            })}

            {/* Separador sutil (vertical no mobile, horizontal no desktop) */}
            <div className="h-6 w-px md:w-8 md:h-px bg-[#262A33]/80 my-0.5" />

            {/* Menu Dropdown de Ícone: Guia de Abordagem Comercial */}
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="Guia de Abordagem Comercial"
                      className={`w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-xl sm:rounded-2xl border select-none transition-colors ${
                        location.pathname.startsWith('/abordagem')
                          ? 'bg-gradient-to-r from-indigo-600/90 to-blue-600/90 text-white border-indigo-500/60 shadow-sm shadow-indigo-500/30'
                          : 'border-transparent text-indigo-400 hover:text-white hover:bg-[#1A1D27] hover:border-[#262A33]'
                      }`}
                    >
                      <Headset className="w-5 h-5 shrink-0" />
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  sideOffset={10}
                  disableAnimation
                  className="bg-[#12141A] text-white border-[#262A33] text-xs font-semibold px-2.5 py-1.5 rounded-lg shadow-xl"
                >
                  Guia de Abordagem Comercial
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent
                side="top"
                align="center"
                sideOffset={12}
                className="w-64 bg-[#12141A] border-[#262A33] text-gray-200 p-1.5 rounded-xl shadow-2xl space-y-0.5 md:[transform:none] md:data-[side=right]:align-start"
              >
                <DropdownMenuLabel className="text-[10px] uppercase font-bold tracking-wider text-gray-500 px-2 py-1">
                  Playbook Comercial bitCRM
                </DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => navigate('/abordagem')}
                  className="cursor-pointer text-xs flex items-center gap-2 px-2 py-2 rounded-lg bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 font-bold"
                >
                  <Play className="w-3.5 h-3.5 fill-indigo-400 text-indigo-400" />
                  Iniciar Abordagem (Copiloto)
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-[#262A33]" />
                <DropdownMenuItem
                  onClick={() => navigate('/abordagem/telefone')}
                  className="cursor-pointer text-xs flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#1A1D27] text-gray-300 hover:text-white"
                >
                  <Phone className="w-3.5 h-3.5 text-indigo-400" />
                  Abordagem por Telefone
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => navigate('/abordagem/presencial')}
                  className="cursor-pointer text-xs flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#1A1D27] text-gray-300 hover:text-white"
                >
                  <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                  Abordagem Presencial
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => navigate('/abordagem/whatsapp')}
                  className="cursor-pointer text-xs flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#1A1D27] text-gray-300 hover:text-white"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                  WhatsApp
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => navigate('/abordagem/pitch')}
                  className="cursor-pointer text-xs flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#1A1D27] text-gray-300 hover:text-white"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Pitch de 30 segundos
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => navigate('/abordagem/diagnostico')}
                  className="cursor-pointer text-xs flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#1A1D27] text-gray-300 hover:text-white"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
                  Perguntas de Diagnóstico
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => navigate('/abordagem/objecoes')}
                  className="cursor-pointer text-xs flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#1A1D27] text-gray-300 hover:text-white"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                  Objeções
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => navigate('/abordagem/valores')}
                  className="cursor-pointer text-xs flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#1A1D27] text-gray-300 hover:text-white"
                >
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  Valores (R$ 500 / R$ 55)
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => navigate('/abordagem/historico')}
                  className="cursor-pointer text-xs flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#1A1D27] text-gray-300 hover:text-white"
                >
                  <History className="w-3.5 h-3.5 text-purple-400" />
                  Histórico de Abordagens
                </DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator className="bg-[#262A33]" />
                    <DropdownMenuItem
                      onClick={() => navigate('/abordagem/configuracoes')}
                      className="cursor-pointer text-xs flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#1A1D27] text-indigo-300 hover:text-white"
                    >
                      <Settings className="w-3.5 h-3.5 text-indigo-400" />
                      Configurações do Playbook
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Separador e Perfil no dock */}
            <div className="h-6 w-px md:w-8 md:h-px bg-[#262A33]/80 my-0.5" />

            <Tooltip>
              <TooltipTrigger asChild>
                <NavLink
                  to="/perfil"
                  aria-label="Meu Perfil"
                  className={`w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-xl sm:rounded-2xl border select-none transition-colors ${
                    location.pathname === '/perfil'
                      ? 'bg-gradient-to-r from-indigo-600/90 to-blue-600/90 text-white border-indigo-500/60 shadow-sm shadow-indigo-500/30'
                      : 'border-transparent text-gray-400 hover:text-white hover:bg-[#1A1D27] hover:border-[#262A33]'
                  }`}
                >
                  <User className="w-5 h-5 shrink-0" />
                </NavLink>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                sideOffset={10}
                disableAnimation
                className="bg-[#12141A] text-white border-[#262A33] text-xs font-semibold px-2.5 py-1.5 rounded-lg shadow-xl"
              >
                Meu Perfil
              </TooltipContent>
            </Tooltip>

            {user && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={handleLogout}
                    aria-label="Sair da Conta"
                    className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-xl sm:rounded-2xl border border-transparent text-gray-500 hover:text-red-400 hover:bg-red-950/20 hover:border-red-900/40 select-none transition-colors"
                  >
                    <LogOut className="w-5 h-5 shrink-0" />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  sideOffset={10}
                  disableAnimation
                  className="bg-[#12141A] text-red-300 border-[#262A33] text-xs font-semibold px-2.5 py-1.5 rounded-lg shadow-xl"
                >
                  Sair da Conta
                </TooltipContent>
              </Tooltip>
            )}
          </nav>
        </aside>

        {/* Conteúdo Principal com compensação: desktop pl-20 / mobile pb-24 para não sobrepor o dock */}
        <div className="flex-1 md:pl-20 flex flex-col">
          <main className="flex-1 pt-20 sm:pt-24 md:pt-24 pb-24 md:pb-16 px-4 sm:px-6 max-w-[1280px] w-full mx-auto">
            <Outlet />
          </main>

          {/* Rodapé Minimalista Elegante */}
          <footer className="border-t border-[#262A33]/80 bg-[#0A0B0E]/90 py-6 px-4 sm:px-6">
            <div className="max-w-[1280px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500">
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
      </div>
    </TooltipProvider>
  )
}
