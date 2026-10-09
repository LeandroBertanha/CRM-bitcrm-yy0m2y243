import React, { useState } from 'react'
import { MessageSquare, ExternalLink, Copy, Check, AlertCircle, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  normalizePhoneForWhatsApp,
  buildWhatsAppWebUrl,
  logWhatsAppInteractionToOpportunity,
} from '@/lib/whatsappApproachHelper'
import { useToast } from '@/hooks/use-toast'

export interface WhatsAppCopilotActionProps {
  phone?: string | null
  message: string
  companyName?: string
  contactName?: string
  opportunityId?: string
  authorId?: string
  /**
   * Título ou subtítulo contextual exibido no card
   */
  title?: string
  /**
   * Mostra ou oculta a caixa com o texto pré-visualizado da mensagem
   */
  showMessagePreview?: boolean
  className?: string
}

export const WhatsAppCopilotAction: React.FC<WhatsAppCopilotActionProps> = ({
  phone,
  message,
  companyName,
  contactName,
  opportunityId,
  authorId,
  title = 'Abertura de Abordagem via WhatsApp',
  showMessagePreview = true,
  className = '',
}) => {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)
  const [isOpening, setIsOpening] = useState(false)

  const phoneDigits = normalizePhoneForWhatsApp(phone)
  const hasPhone = Boolean(phoneDigits)

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      toast({
        title: 'Mensagem copiada!',
        description: 'Texto pronto para colar no WhatsApp.',
      })
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Falha ao copiar mensagem:', err)
      toast({
        title: 'Erro ao copiar',
        description: 'Não foi possível copiar o texto automaticamente.',
        variant: 'destructive',
      })
    }
  }

  const handleOpenWhatsApp = async () => {
    if (!hasPhone) return

    setIsOpening(true)
    const url = buildWhatsAppWebUrl(phoneDigits, message)

    // Abre o WhatsApp Web / aplicativo em nova aba
    window.open(url, '_blank', 'noopener,noreferrer')

    // Se houver oportunidade vinculada e autor, grava interação na timeline (opportunity_notes)
    if (opportunityId && authorId) {
      try {
        // Detecta se a mensagem é inicial ou de follow-up a partir do título
        const isFollowup =
          title.toLowerCase().includes('follow-up') || title.toLowerCase().includes('continuação')
        const actionType = isFollowup ? 'followup' : 'initial'

        const logged = await logWhatsAppInteractionToOpportunity({
          opportunityId,
          authorId,
          message,
          phone: phone || phoneDigits,
          actionType,
          opportunityDetails: {
            company: companyName,
            contact_name: contactName,
            contact_phone: phone || phoneDigits,
          },
        })
        if (logged) {
          toast({
            title: 'WhatsApp aberto & registrado',
            description:
              actionType === 'initial'
                ? 'Interação registrada e oportunidade qualificada automaticamente!'
                : 'Interação adicionada na timeline da oportunidade.',
          })
        }
      } catch (err) {
        console.error('Erro ao gravar interação de WhatsApp:', err)
      }
    } else {
      toast({
        title: 'WhatsApp aberto',
        description: 'Conversa iniciada em nova aba.',
      })
    }

    setIsOpening(false)
  }

  return (
    <div
      className={`rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-[#0F1C18] via-[#0E141B] to-[#0A0D12] p-4 sm:p-5 shadow-2xl relative overflow-hidden ${className}`}
    >
      {/* Detalhe sutil de brilho superior */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500/20 via-emerald-400/60 to-indigo-500/40" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#262A33]">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-md shadow-emerald-950/40">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-extrabold text-white tracking-tight">
                {title}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Canal WhatsApp
              </span>
            </div>
            <p className="text-xs text-gray-400">
              {companyName ? (
                <>
                  Destinatário:{' '}
                  <strong className="text-gray-200">
                    {companyName} {contactName ? `(${contactName})` : ''}
                  </strong>
                </>
              ) : (
                'Envie a mensagem de abertura direta para o lead em um clique'
              )}
            </p>
          </div>
        </div>

        {/* Telefone detectado */}
        <div className="flex items-center gap-2 text-xs">
          {hasPhone ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#161D22] border border-emerald-500/30 text-emerald-300 font-mono text-xs">
              <Phone className="w-3.5 h-3.5 text-emerald-400" />
              {phone}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
              Sem telefone informado
            </span>
          )}
        </div>
      </div>

      {/* Prévia da mensagem que será enviada */}
      {showMessagePreview && (
        <div className="py-3.5 space-y-1.5">
          <span className="text-[11px] font-bold text-gray-300 uppercase tracking-wider block">
            Mensagem pré-configurada para envio:
          </span>
          <div className="p-3.5 rounded-xl bg-[#0A0C10] border border-[#222734] text-xs sm:text-sm text-gray-200 whitespace-pre-line leading-relaxed shadow-inner">
            {message}
          </div>
        </div>
      )}

      {/* Ações: Botão Grande de Abrir WhatsApp Web + Botão de Copiar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-2">
        <TooltipProvider delayDuration={150}>
          {hasPhone ? (
            <Button
              type="button"
              onClick={handleOpenWhatsApp}
              disabled={isOpening}
              className="flex-1 h-12 sm:h-13 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-sm sm:text-base shadow-lg shadow-emerald-700/25 tracking-wide flex items-center justify-center gap-2.5 transition-all hover:scale-[1.01] active:scale-[0.99]"
            >
              <MessageSquare className="w-5 h-5 fill-white/20" />
              <span>Abrir WhatsApp Web</span>
              <ExternalLink className="w-4 h-4 ml-1 opacity-80" />
            </Button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex-1">
                  <Button
                    type="button"
                    disabled
                    className="w-full h-12 sm:h-13 rounded-xl bg-gray-800/80 border border-[#262A33] text-gray-400 font-bold text-sm sm:text-base cursor-not-allowed opacity-60 flex items-center justify-center gap-2"
                  >
                    <MessageSquare className="w-5 h-5" />
                    <span>Abrir WhatsApp Web</span>
                  </Button>
                </div>
              </TooltipTrigger>
              <TooltipContent className="bg-[#12141A] border-[#262A33] text-gray-200 text-xs p-2.5 max-w-xs shadow-xl">
                <p className="font-semibold text-amber-400 mb-0.5">Telefone não disponível</p>
                <p className="text-gray-300 text-[11px] leading-relaxed">
                  Para abrir o WhatsApp Web direto no contato, vincule uma oportunidade com telefone
                  ou informe o número na configuração da abordagem.
                </p>
              </TooltipContent>
            </Tooltip>
          )}
        </TooltipProvider>

        {/* Botão de Copiar Mensagem */}
        <Button
          type="button"
          variant="outline"
          onClick={handleCopyMessage}
          className={`h-12 sm:h-13 px-4 rounded-xl text-xs sm:text-sm font-semibold border transition-all ${
            copied
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              : 'bg-[#141824] border-[#262A33] text-gray-300 hover:text-white hover:bg-[#1E2332]'
          }`}
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 mr-1.5 text-emerald-400" />
              Copiado!
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 mr-1.5 text-gray-400" />
              Copiar Mensagem
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
