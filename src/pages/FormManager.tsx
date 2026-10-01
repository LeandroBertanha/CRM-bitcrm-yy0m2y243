import React, { useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { QRCodeSVG } from '@/components/QRCodeSVG'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import {
  Copy,
  Check,
  Share2,
  ExternalLink,
  MessageCircle,
  Sparkles,
  ShieldCheck,
  Download,
  Info,
} from 'lucide-react'

export default function FormManager() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)

  // URL pública do formulário vinculada ao ID do vendedor
  const sellerId = user?.id || ''
  const origin = window.location.origin
  const publicFormUrl = `${origin}/formulario/publico?vendedor=${sellerId}`

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicFormUrl)
    setCopied(true)
    toast({
      title: 'Link copiado!',
      description:
        'O link com seu identificador de vendedor foi copiado para a área de transferência.',
    })
    setTimeout(() => {
      setCopied(false)
    }, 2500)
  }

  const handleOpenWhatsApp = () => {
    const text = encodeURIComponent(
      `Olá! Por favor, preencha seus dados neste formulário rápido para avaliarmos sua demanda de consultoria/tecnologia e agendarmos um contato: ${publicFormUrl}`,
    )
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  return (
    <div className="space-y-8 animate-fadeInUp max-w-4xl mx-auto">
      {/* Cabeçalho da Página */}
      <div className="pb-2 border-b border-[#262A33]">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Formulário Público de Captação
          </h1>
          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            Integração Automática
          </span>
        </div>
        <p className="text-sm text-gray-400 mt-1">
          Envie o link ou exiba o QR Code para seus clientes. Todo envio gera automaticamente uma
          nova Oportunidade atribuída a você no pipeline.
        </p>
      </div>

      {/* Caixa de Callout: Como Funciona */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-950/40 via-[#12141A] to-blue-950/30 border border-indigo-500/30 flex items-start gap-3.5 shadow-lg">
        <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-300 shrink-0 mt-0.5">
          <Sparkles className="w-5 h-5" />
        </div>
        <div className="space-y-1 text-xs">
          <h3 className="font-bold text-white text-sm">
            Como funciona a integração em tempo real?
          </h3>
          <p className="text-gray-300 leading-relaxed">
            Quando o cliente acessa seu link e clica em{' '}
            <strong>&quot;Enviar e receber retorno&quot;</strong>, um registro é instantaneamente
            inserido na tabela de <strong>Oportunidades</strong> no estágio{' '}
            <span className="text-slate-200 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
              Novo
            </span>{' '}
            com a origem{' '}
            <span className="text-emerald-300 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800">
              Formulário Público
            </span>{' '}
            e vinculado diretamente à sua carteira de vendedor. Seu Painel e Pipeline atualizam
            automaticamente sem precisar recarregar a página!
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Card do QR Code e Ações Rápidas (7 Colunas) */}
        <div className="md:col-span-7 bg-[#12141A] border border-[#262A33] rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-[#262A33]">
            <h2 className="text-base font-bold text-white">Seu Link Exclusivo</h2>
            <span className="text-xs text-gray-500">
              Vendedor ID: <span className="font-mono text-gray-300">{sellerId || 'Nenhum'}</span>
            </span>
          </div>

          {/* Campo de Link com Copiar */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-400">URL para envio direto</label>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={publicFormUrl}
                className="bg-[#0E1017] border-[#262A33] text-gray-200 font-mono text-xs h-11 rounded-xl truncate"
              />
              <Button
                onClick={handleCopyLink}
                className="h-11 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shrink-0 transition-all font-medium"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-1.5 text-emerald-300" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-1.5" />
                    Copiar
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <Button
              onClick={handleOpenWhatsApp}
              className="h-11 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-4 h-4" />
              Enviar pelo WhatsApp
            </Button>

            <Button
              variant="outline"
              asChild
              className="h-11 border-[#262A33] bg-[#161922] text-gray-200 hover:text-white hover:bg-[#1E2330] rounded-xl flex items-center justify-center gap-2"
            >
              <a href={publicFormUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 text-indigo-400" />
                Testar Formulário
              </a>
            </Button>
          </div>

          <div className="pt-3 border-t border-[#262A33]/80 space-y-2 text-xs text-gray-400">
            <div className="flex items-center gap-2 text-gray-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Rota pública sem exigência de login para o cliente final</span>
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <Info className="w-4 h-4 text-indigo-400" />
              <span>
                O cliente visualiza a marca e a identidade de alta tecnologia da bit Consulting
              </span>
            </div>
          </div>
        </div>

        {/* Card do QR Code em Caixa Branca (5 Colunas) */}
        <div className="md:col-span-5 bg-[#12141A] border border-[#262A33] rounded-2xl p-6 shadow-xl flex flex-col items-center justify-center text-center space-y-4">
          <div>
            <h3 className="text-base font-bold text-white">QR Code para Escaneamento</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Ideal para apresentações, eventos ou tela do celular
            </p>
          </div>

          {/* Caixa branca com bordas arredondadas para máxima legibilidade óptica */}
          <div className="p-4 bg-white rounded-2xl shadow-2xl border-4 border-indigo-500/20 group hover:border-indigo-500/40 transition-all">
            <QRCodeSVG value={publicFormUrl} size={190} />
          </div>

          <p className="text-[11px] text-gray-400 max-w-xs leading-tight">
            Aponte a câmera do celular para abrir o formulário com seu vínculo comercial já
            aplicado.
          </p>

          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyLink}
            className="border-[#262A33] text-gray-300 hover:text-white rounded-xl text-xs h-9"
          >
            <Share2 className="w-3.5 h-3.5 mr-1.5" />
            Copiar Link Direto
          </Button>
        </div>
      </div>
    </div>
  )
}
