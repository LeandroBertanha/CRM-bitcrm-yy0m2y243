import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BrandLogo } from '@/components/BrandLogo'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  FileText,
  Shield,
  ArrowLeft,
  Calendar,
  Building2,
  CheckCircle2,
  Mail,
  ExternalLink,
} from 'lucide-react'
import {
  TERMS_OF_SERVICE,
  PRIVACY_POLICY,
  CURRENT_TERMS_VERSION,
  TERMS_LAST_UPDATED,
} from '@/lib/terms-content'

export default function TermsPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'termos' | 'privacidade'>('termos')

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#0A0B0E] text-[#F5F6F8] relative overflow-hidden py-8 px-4 sm:px-6">
      {/* Glows de ambientação inspirados em lbertanha.com */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[300px] bg-blue-600/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Cabeçalho */}
      <header className="max-w-4xl w-full mx-auto flex items-center justify-between gap-4 pb-6 relative z-10 border-b border-[#262A33]">
        <BrandLogo variant="compact" size="md" showTagline={true} />
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(-1)}
          className="border-[#262A33] text-gray-300 hover:text-white rounded-xl text-xs h-9 gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Voltar
        </Button>
      </header>

      {/* Conteúdo Principal */}
      <main className="max-w-4xl w-full mx-auto relative z-10 animate-fadeInUp my-8">
        <div className="bg-[#12141A] border border-[#262A33] rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-md relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500/70 to-transparent" />

          {/* Cabeçalho do Documento */}
          <div className="mb-8">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Building2 className="w-3.5 h-3.5" />
                bit Consulting
              </span>
              <span className="text-xs text-gray-500 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Versão {CURRENT_TERMS_VERSION} &bull; Vigência a partir de {TERMS_LAST_UPDATED}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Termos de Serviço & Política de Privacidade
            </h1>
            <p className="text-sm text-gray-400 mt-2 max-w-2xl leading-relaxed">
              Diretrizes operacionais para desenvolvimento de sites, landing pages, suporte técnico
              contínuo e tratamento seguro de dados no ecossistema bit Consulting e bitCRM conforme
              a LGPD.
            </p>
          </div>

          {/* Destaque das regras de negócio */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="p-4 rounded-2xl bg-[#0E1017] border border-[#262A33]">
              <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold block mb-1">
                Desenvolvimento
              </span>
              <p className="text-lg font-bold text-white">A partir de R$ 350,00</p>
              <p className="text-xs text-gray-400 mt-1">
                Sites e Landing Pages profissionais com alta taxa de conversão.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-[#0E1017] border border-[#262A33]">
              <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold block mb-1">
                Infraestrutura & Suporte
              </span>
              <p className="text-lg font-bold text-indigo-400">R$ 55,00 / mês</p>
              <p className="text-xs text-gray-400 mt-1">
                Inclui hospedagem, domínio (.com.br ou .com), SSL e manutenção contínua.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-[#0E1017] border border-[#262A33]">
              <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold block mb-1">
                Privacidade & Segurança
              </span>
              <p className="text-lg font-bold text-emerald-400">100% LGPD</p>
              <p className="text-xs text-gray-400 mt-1">
                Proteção legal (Lei 13.709/2018), confidencialidade e guarda segura de leads.
              </p>
            </div>
          </div>

          {/* Abas com os textos completos */}
          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as 'termos' | 'privacidade')}
            className="w-full"
          >
            <TabsList className="bg-[#181B24] border border-[#262A33] p-1 h-11 w-full sm:w-auto grid grid-cols-2 mb-6">
              <TabsTrigger
                value="termos"
                className="text-xs sm:text-sm data-[state=active]:bg-indigo-600 data-[state=active]:text-white font-medium flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4" />
                Termos de Serviço
              </TabsTrigger>
              <TabsTrigger
                value="privacidade"
                className="text-xs sm:text-sm data-[state=active]:bg-indigo-600 data-[state=active]:text-white font-medium flex items-center justify-center gap-2"
              >
                <Shield className="w-4 h-4" />
                Política de Privacidade
              </TabsTrigger>
            </TabsList>

            {/* Seção 1: Termos de Serviço */}
            <TabsContent value="termos" className="space-y-6">
              {TERMS_OF_SERVICE.map((section) => (
                <div
                  key={section.id}
                  className="p-5 rounded-2xl bg-[#0E1017] border border-[#262A33] space-y-3"
                >
                  <h2 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                    {section.title}
                  </h2>
                  <div className="space-y-2 text-xs sm:text-sm text-gray-300 leading-relaxed">
                    {section.content.map((paragraph, idx) => (
                      <p key={idx}>{paragraph}</p>
                    ))}
                  </div>
                </div>
              ))}
            </TabsContent>

            {/* Seção 2: Política de Privacidade */}
            <TabsContent value="privacidade" className="space-y-6">
              {PRIVACY_POLICY.map((section) => (
                <div
                  key={section.id}
                  className="p-5 rounded-2xl bg-[#0E1017] border border-[#262A33] space-y-3"
                >
                  <h2 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
                    {section.title}
                  </h2>
                  <div className="space-y-2 text-xs sm:text-sm text-gray-300 leading-relaxed">
                    {section.content.map((paragraph, idx) => (
                      <p key={idx}>{paragraph}</p>
                    ))}
                  </div>
                </div>
              ))}
            </TabsContent>
          </Tabs>

          {/* Informações do Encarregado / Contato */}
          <div className="mt-8 pt-6 border-t border-[#262A33] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-400">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-indigo-400" />
              <span>Dúvidas ou solicitações LGPD:</span>
              <a
                href="mailto:leandro.bertanha@lbertanha.com"
                className="text-white hover:text-indigo-400 underline font-medium"
              >
                leandro.bertanha@lbertanha.com
              </a>
            </div>
            <Link
              to="/login"
              className="text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1 font-medium"
            >
              Ir para o Login do CRM
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </main>

      {/* Rodapé */}
      <footer className="max-w-4xl w-full mx-auto text-center pt-6 text-[11px] text-gray-500 relative z-10">
        <p>
          bit Consulting &bull; Transformação Digital e Estratégia Comercial &bull;{' '}
          <a
            href="https://lbertanha.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 hover:underline"
          >
            lbertanha.com
          </a>
        </p>
      </footer>
    </div>
  )
}
