import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FileText, Shield, Check, ExternalLink, Calendar, Building2 } from 'lucide-react'
import {
  TERMS_OF_SERVICE,
  PRIVACY_POLICY,
  CURRENT_TERMS_VERSION,
  TERMS_LAST_UPDATED,
} from '@/lib/terms-content'
import { Link } from 'react-router-dom'

export interface TermsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialTab?: 'termos' | 'privacidade'
  onAccept?: () => void
  showAcceptButton?: boolean
}

export function TermsModal({
  open,
  onOpenChange,
  initialTab = 'termos',
  onAccept,
  showAcceptButton = false,
}: TermsModalProps) {
  const [activeTab, setActiveTab] = useState<'termos' | 'privacidade'>(initialTab)

  const handleAccept = () => {
    if (onAccept) {
      onAccept()
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-[#12141A] border-[#262A33] text-gray-200 p-0 overflow-hidden shadow-2xl">
        <DialogHeader className="p-6 pb-4 border-b border-[#262A33]">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Building2 className="w-3 h-3" />
              bit Consulting
            </span>
            <span className="text-[11px] text-gray-500 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Versão {CURRENT_TERMS_VERSION} &bull; Atualizado em {TERMS_LAST_UPDATED}
            </span>
          </div>
          <DialogTitle className="text-xl font-bold text-white tracking-tight">
            Termos de Serviço & Política de Privacidade
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-400">
            Diretrizes contratuais de prestação de serviços digitais e política de proteção de dados
            conforme a LGPD.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as 'termos' | 'privacidade')}
          className="w-full"
        >
          <div className="px-6 pt-3 pb-2 bg-[#0E1017] border-b border-[#262A33]">
            <TabsList className="bg-[#181B24] border border-[#262A33] p-1 h-9 w-full sm:w-auto grid grid-cols-2">
              <TabsTrigger
                value="termos"
                className="text-xs data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-sm flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" />
                Termos de Serviço
              </TabsTrigger>
              <TabsTrigger
                value="privacidade"
                className="text-xs data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-sm flex items-center gap-1.5"
              >
                <Shield className="w-3.5 h-3.5" />
                Política de Privacidade
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="h-[55vh] px-6 py-4">
            <TabsContent
              value="termos"
              className="m-0 space-y-6 text-xs leading-relaxed text-gray-300"
            >
              <div className="p-3.5 rounded-xl bg-indigo-950/20 border border-indigo-800/30 text-indigo-200">
                <p className="font-medium text-white mb-1">Resumo Executivo do Negócio:</p>
                <ul className="list-disc pl-4 space-y-1 text-gray-300">
                  <li>Criação de Sites e Landing Pages a partir de R$ 350,00.</li>
                  <li>Mensalidade de suporte, domínio e hospedagem gerenciada por R$ 55,00/mês.</li>
                  <li>Uso restrito do bitCRM para operação comercial autorizada.</li>
                </ul>
              </div>

              {TERMS_OF_SERVICE.map((section) => (
                <div key={section.id} className="space-y-2">
                  <h3 className="text-sm font-semibold text-white tracking-tight border-b border-[#262A33] pb-1">
                    {section.title}
                  </h3>
                  {section.content.map((paragraph, idx) => (
                    <p key={idx} className="text-gray-300 leading-normal">
                      {paragraph}
                    </p>
                  ))}
                </div>
              ))}
            </TabsContent>

            <TabsContent
              value="privacidade"
              className="m-0 space-y-6 text-xs leading-relaxed text-gray-300"
            >
              <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-800/30 text-emerald-200">
                <p className="font-medium text-white mb-1">Garantia LGPD (Lei 13.709/2018):</p>
                <p className="text-gray-300">
                  Seus dados comerciais e de clientes são tratados com confidencialidade, controle
                  de acesso e armazenamento criptografado em nuvem de ponta a ponta.
                </p>
              </div>

              {PRIVACY_POLICY.map((section) => (
                <div key={section.id} className="space-y-2">
                  <h3 className="text-sm font-semibold text-white tracking-tight border-b border-[#262A33] pb-1">
                    {section.title}
                  </h3>
                  {section.content.map((paragraph, idx) => (
                    <p key={idx} className="text-gray-300 leading-normal">
                      {paragraph}
                    </p>
                  ))}
                </div>
              ))}
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <div className="p-4 px-6 border-t border-[#262A33] bg-[#0E1017] flex flex-col sm:flex-row items-center justify-between gap-3">
          <Link
            to="/termos"
            target="_blank"
            className="text-xs text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1 order-2 sm:order-1"
          >
            Abrir página dedicada em nova aba
            <ExternalLink className="w-3 h-3" />
          </Link>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end order-1 sm:order-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="border-[#262A33] text-gray-300 hover:text-white rounded-xl text-xs h-9"
            >
              Fechar
            </Button>
            {showAcceptButton && (
              <Button
                type="button"
                size="sm"
                onClick={handleAccept}
                className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs h-9 gap-1.5 shadow-md shadow-indigo-600/30"
              >
                <Check className="w-3.5 h-3.5" />
                Aceitar Termos
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
export default TermsModal
