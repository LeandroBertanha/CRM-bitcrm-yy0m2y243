import React, { useState, useMemo } from 'react'
import type { Opportunity } from '@/types/crm'
import { STAGE_CONFIG } from '@/types/crm'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Building,
  UserCheck,
  MapPin,
  Phone,
  Search,
  X,
  Check,
  User,
  ChevronDown,
  Sparkles,
  Layers,
  ArrowRight,
} from 'lucide-react'

export interface OpportunitySelectorSectionProps {
  opportunities: Opportunity[]
  selectedOppId: string
  onSelectOpp: (oppId: string) => void
  companyName: string
  onChangeCompanyName: (val: string) => void
  contactName: string
  onChangeContactName: (val: string) => void
  city: string
  onChangeCity: (val: string) => void
  phone: string
  onChangePhone: (val: string) => void
}

/**
 * Remove acentos e converte para minúsculas
 */
export function normalizeSearchTerm(term: string | null | undefined): string {
  if (!term) return ''
  return term
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

/**
 * Normaliza dígitos de telefone para busca numérica consistente
 */
export function normalizePhoneDigits(phone: string | null | undefined): string {
  if (!phone) return ''
  return phone.toString().replace(/\D/g, '')
}

/**
 * Filtra oportunidades em tempo real por empresa, contato, cidade, vendedor, estágio e telefone.
 * Suporta múltiplos termos digitados separados por espaço (ex: "sao paulo joao", "clinica perdidos").
 */
export function filterOpportunities(opps: Opportunity[], searchQuery: string): Opportunity[] {
  const normQuery = normalizeSearchTerm(searchQuery)
  if (!normQuery) return opps

  // Tokenizar por espaços para permitir buscas multi-palavra (ex: "silva curitiba")
  const tokens = normQuery.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return opps

  return opps.filter((opp) => {
    const normCompany = normalizeSearchTerm(opp.company)
    const normContact = normalizeSearchTerm(opp.contact_name)
    const normCity = normalizeSearchTerm(opp.city)
    const normSeller = normalizeSearchTerm(
      opp.expand?.seller?.name ||
        opp.expand?.seller?.email ||
        (typeof opp.seller === 'string' ? opp.seller : ''),
    )
    const normStage = normalizeSearchTerm(opp.stage)
    const normNotes = normalizeSearchTerm(opp.message)
    const phoneDigits = normalizePhoneDigits(opp.contact_phone)

    // Agrupar texto pesquisável
    const searchableText = `${normCompany} ${normContact} ${normCity} ${normSeller} ${normStage} ${normNotes}`

    // Todos os tokens digitados precisam casar com algum campo do registro
    return tokens.every((token) => {
      // 1. Casa no texto geral (empresa, contato, cidade, vendedor, estágio, mensagem)
      if (searchableText.includes(token)) return true

      // 2. Se o token contiver dígitos, testa contra os dígitos do telefone
      const tokenDigits = token.replace(/\D/g, '')
      if (tokenDigits.length >= 2 && phoneDigits.includes(tokenDigits)) {
        return true
      }

      return false
    })
  })
}

export function OpportunitySelectorSection({
  opportunities,
  selectedOppId,
  onSelectOpp,
  companyName,
  onChangeCompanyName,
  contactName,
  onChangeContactName,
  city,
  onChangeCity,
  phone,
  onChangePhone,
}: OpportunitySelectorSectionProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  // Oportunidade atualmente selecionada
  const selectedOpp = useMemo(
    () => opportunities.find((o) => o.id === selectedOppId),
    [opportunities, selectedOppId],
  )

  // Filtragem em tempo real
  const filteredOpps = useMemo(() => {
    return filterOpportunities(opportunities, searchQuery)
  }, [opportunities, searchQuery])

  const handleChooseOpportunity = (opp: Opportunity) => {
    onSelectOpp(opp.id)
    setIsOpen(false)
  }

  const handleClearSelection = () => {
    onSelectOpp('')
    setIsOpen(false)
  }

  const handleClearSearch = () => {
    setSearchQuery('')
  }

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-[#0E1017] border border-[#262A33] shadow-lg space-y-4">
      {/* Cabeçalho da Seção */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#262A33]">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Building className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-gray-200 uppercase tracking-wider block">
              Escolha uma oportunidade da carteira
            </span>
            <span className="text-[11px] text-gray-400">
              Vincule uma oportunidade existente ou insira os dados manualmente
            </span>
          </div>
        </div>

        {selectedOpp ? (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              <Check className="w-3.5 h-3.5" />
              Oportunidade Vinculada
            </span>
            <button
              type="button"
              onClick={handleClearSelection}
              className="text-xs text-gray-400 hover:text-rose-400 transition-colors p-1"
              title="Remover vínculo com a oportunidade"
            >
              Desvincular
            </button>
          </div>
        ) : (
          <span className="text-[11px] text-indigo-400 font-medium">Opcional</span>
        )}
      </div>

      {/* Caixa de Seleção / Gatilho do Seletor */}
      <div className="space-y-3">
        {/* Card de resumo da selecionada ou Botão para abrir busca */}
        {selectedOpp ? (
          <div className="p-3.5 rounded-xl bg-[#12141A] border border-indigo-500/40 relative group">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-white truncate">
                    {selectedOpp.company}
                  </span>
                  {selectedOpp.stage && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border ${
                        STAGE_CONFIG[selectedOpp.stage]?.bg || 'bg-slate-800'
                      } ${STAGE_CONFIG[selectedOpp.stage]?.color || 'text-slate-300'} ${
                        STAGE_CONFIG[selectedOpp.stage]?.border || 'border-slate-700'
                      }`}
                    >
                      {selectedOpp.stage}
                    </span>
                  )}
                  {selectedOpp.expand?.seller?.name && (
                    <span className="text-[10px] text-gray-400 flex items-center gap-1">
                      <User className="w-3 h-3 text-gray-500" />
                      {selectedOpp.expand.seller.name}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 pt-0.5">
                  {selectedOpp.contact_name && (
                    <span className="flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
                      {selectedOpp.contact_name}
                    </span>
                  )}
                  {selectedOpp.city && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                      {selectedOpp.city}
                    </span>
                  )}
                  {selectedOpp.contact_phone && (
                    <span className="flex items-center gap-1 font-mono text-[11px]">
                      <Phone className="w-3.5 h-3.5 text-indigo-400" />
                      {selectedOpp.contact_phone}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsOpen(!isOpen)}
                  className="h-9 px-3 text-xs border-[#262A33] bg-[#181B24] text-gray-300 hover:text-white rounded-xl"
                >
                  Trocar
                  <ChevronDown
                    className={`w-3.5 h-3.5 ml-1 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClearSelection}
                  title="Remover vínculo"
                  className="h-9 px-2.5 text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div>
            {!isOpen ? (
              <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="w-full min-h-[48px] p-3 rounded-xl bg-[#12141A] border border-[#262A33] hover:border-indigo-500/50 text-left transition-all flex items-center justify-between gap-3 text-xs text-gray-300 group"
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Search className="w-4 h-4 text-gray-500 group-hover:text-indigo-400 transition-colors" />
                  <span className="text-gray-400 group-hover:text-gray-200">
                    Clique para buscar uma oportunidade por empresa, contato ou cidade...
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 text-[11px] text-indigo-400 font-medium">
                  <span>{opportunities.length} disponíveis</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </div>
              </button>
            ) : null}
          </div>
        )}

        {/* Bloco de Busca e Lista de Oportunidades (Aberto quando isOpen ou quando não há selecionada e clica) */}
        {isOpen && (
          <div className="rounded-xl border border-indigo-500/30 bg-[#12141A] p-3.5 space-y-3 animate-fadeIn shadow-xl">
            {/* Campo de Busca em Destaque */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                autoFocus
                placeholder="Buscar por empresa, contato, cidade, vendedor ou telefone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10 bg-[#0A0B0E] border-[#262A33] focus-visible:border-indigo-500 text-white text-xs placeholder:text-gray-500 rounded-xl h-11"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-white rounded-md"
                  title="Limpar busca"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Informações da busca / Ações rápidas */}
            <div className="flex items-center justify-between px-1 text-[11px] text-gray-400">
              <span>
                {filteredOpps.length}{' '}
                {filteredOpps.length === 1
                  ? 'oportunidade encontrada'
                  : 'oportunidades encontradas'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="text-gray-400 hover:text-indigo-300 underline"
                >
                  Não vincular nenhuma
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-white"
                >
                  Fechar
                </button>
              </div>
            </div>

            {/* Lista com scroll suave e itens touch-friendly */}
            <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
              {filteredOpps.length === 0 ? (
                <div className="py-8 text-center space-y-2 border border-dashed border-[#262A33] rounded-xl bg-[#0A0B0E]/60">
                  <p className="text-xs text-gray-400">
                    Nenhuma oportunidade encontrada para &quot;
                    <span className="text-white font-medium">{searchQuery}</span>&quot;
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleClearSearch}
                    className="h-8 text-xs border-[#262A33] bg-[#12141A] text-indigo-400 hover:text-indigo-300 rounded-lg"
                  >
                    Limpar filtro de busca
                  </Button>
                </div>
              ) : (
                filteredOpps.map((opp) => {
                  const isCurrent = opp.id === selectedOppId
                  const stageStyle = STAGE_CONFIG[opp.stage]
                  return (
                    <button
                      key={opp.id}
                      type="button"
                      onClick={() => handleChooseOpportunity(opp)}
                      className={`w-full text-left p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                        isCurrent
                          ? 'bg-indigo-600/20 border-indigo-500 shadow-md ring-1 ring-indigo-500/50'
                          : 'bg-[#0A0B0E] border-[#262A33] hover:border-indigo-500/40 hover:bg-[#141722]'
                      }`}
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-white truncate">
                            {opp.company}
                          </span>
                          {opp.stage && (
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border ${
                                stageStyle?.bg || 'bg-slate-800'
                              } ${stageStyle?.color || 'text-slate-300'} ${
                                stageStyle?.border || 'border-slate-700'
                              }`}
                            >
                              {opp.stage}
                            </span>
                          )}
                          {opp.expand?.seller?.name && (
                            <span className="text-[10px] text-gray-400 flex items-center gap-1">
                              <User className="w-3 h-3 text-gray-500" />
                              {opp.expand.seller.name}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-400">
                          {opp.contact_name && (
                            <span className="flex items-center gap-1 truncate">
                              <UserCheck className="w-3 h-3 text-gray-500" />
                              {opp.contact_name}
                            </span>
                          )}
                          {opp.city && (
                            <span className="flex items-center gap-1 truncate">
                              <MapPin className="w-3 h-3 text-gray-500" />
                              {opp.city}
                            </span>
                          )}
                          {opp.contact_phone && (
                            <span className="flex items-center gap-1 font-mono">
                              <Phone className="w-3 h-3 text-gray-500" />
                              {opp.contact_phone}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
                        {isCurrent ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-400">
                            <Check className="w-3.5 h-3.5" />
                            Selecionada
                          </span>
                        ) : (
                          <span className="text-[11px] text-indigo-400/80 group-hover:text-indigo-300 font-medium flex items-center gap-0.5">
                            Selecionar
                            <ArrowRight className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Campos Rápidos para Personalização */}
      <div className="pt-2 border-t border-[#262A33]/70 space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            Dados para Personalizar os Roteiros
          </Label>
          <span className="text-[10px] text-gray-500">
            {selectedOpp ? 'Preenchidos via oportunidade' : 'Preencha livremente'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div>
            <Label className="text-[10px] text-gray-400">Nome da Empresa</Label>
            <Input
              placeholder="Ex: Restaurante Sabor & Arte"
              value={companyName}
              onChange={(e) => onChangeCompanyName(e.target.value)}
              className="bg-[#12141A] border-[#262A33] text-white text-xs rounded-xl h-10 mt-1 focus-visible:border-indigo-500"
            />
          </div>
          <div>
            <Label className="text-[10px] text-gray-400">Nome do Contato</Label>
            <Input
              placeholder="Ex: Carlos Mendes"
              value={contactName}
              onChange={(e) => onChangeContactName(e.target.value)}
              className="bg-[#12141A] border-[#262A33] text-white text-xs rounded-xl h-10 mt-1 focus-visible:border-indigo-500"
            />
          </div>
          <div>
            <Label className="text-[10px] text-gray-400">Cidade / Região</Label>
            <Input
              placeholder="Ex: Carapicuíba"
              value={city}
              onChange={(e) => onChangeCity(e.target.value)}
              className="bg-[#12141A] border-[#262A33] text-white text-xs rounded-xl h-10 mt-1 focus-visible:border-indigo-500"
            />
          </div>
          <div>
            <Label className="text-[10px] text-gray-400">Telefone / WhatsApp</Label>
            <Input
              placeholder="Ex: (11) 98765-4321"
              value={phone}
              onChange={(e) => onChangePhone(e.target.value)}
              className="bg-[#12141A] border-[#262A33] text-white text-xs rounded-xl h-10 mt-1 focus-visible:border-indigo-500"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
