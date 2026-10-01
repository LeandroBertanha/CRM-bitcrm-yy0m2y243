import React, { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { BrandLogo } from '@/components/BrandLogo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Send,
  Building,
  User,
  Mail,
  Phone,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react'

export default function PublicForm() {
  const [searchParams] = useSearchParams()
  const sellerId = searchParams.get('vendedor') || ''
  const allowRepeat = searchParams.get('repetir') === '1'

  // Dados do Vendedor caso fornecido
  const [sellerName, setSellerName] = useState<string | null>(null)

  // Campos do Formulário
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [company, setCompany] = useState('')
  const [interest, setInterest] = useState<string>('Consultoria')
  const [message, setMessage] = useState('')

  // Estados de envio
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Busca o nome do vendedor se o sellerId foi fornecido
  useEffect(() => {
    if (sellerId) {
      pb.collection('users')
        .getOne(sellerId, { fields: 'name,email' })
        .then((seller) => {
          setSellerName(seller.name || seller.email.split('@')[0])
        })
        .catch(() => {
          // vendedor não encontrado ou restrito, segue normalmente
        })
    }
  }, [sellerId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!name.trim() || !email.trim() || !company.trim() || !phone.trim()) {
      setErrorMessage('Por favor, preencha todos os campos obrigatórios.')
      return
    }

    setSubmitting(true)

    try {
      // Cria a Oportunidade diretamente na coleção PocketBase
      const opportunityData = {
        company: company.trim(),
        stage: 'Novo',
        source: 'Formulário Público',
        value: interest === 'Consultoria' ? 25000 : interest === 'Desenvolvimento' ? 35000 : 15000,
        seller: sellerId || null,
        contact_name: name.trim(),
        contact_email: email.trim(),
        contact_phone: phone.trim(),
        message: `[Interesse: ${interest}] ${message.trim()}`,
      }

      await pb.collection('opportunities').create(opportunityData)
      setSubmitted(true)
    } catch (err) {
      console.error('Erro ao enviar formulário público:', err)
      setErrorMessage(
        'Houve uma instabilidade momentânea ao registrar seu contato. Por favor, tente novamente.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleResetForm = () => {
    setName('')
    setEmail('')
    setPhone('')
    setCompany('')
    setInterest('Consultoria')
    setMessage('')
    setSubmitted(false)
    setErrorMessage(null)
  }

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#0A0B0E] text-[#F5F6F8] relative overflow-hidden py-8 px-4 sm:px-6">
      {/* Glows de ambientação inspirados em lbertanha.com */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[300px] bg-blue-600/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Cabeçalho Público */}
      <header className="max-w-xl w-full mx-auto flex items-center justify-between pb-6 relative z-10">
        <BrandLogo size="md" />
        {sellerName && (
          <div className="text-right">
            <span className="text-[11px] text-gray-500 block">Atendimento com</span>
            <span className="text-xs font-semibold text-indigo-400">{sellerName}</span>
          </div>
        )}
      </header>

      {/* Conteúdo Central */}
      <main className="max-w-xl w-full mx-auto relative z-10 animate-fadeInUp my-auto">
        <div className="bg-[#12141A] border border-[#262A33] rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md relative overflow-hidden">
          {/* Barra superior de gradiente */}
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500/70 to-transparent" />

          {submitted ? (
            /* Estado de Sucesso Animado */
            <div className="text-center py-8 space-y-6">
              <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10 animate-glow">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-extrabold text-white tracking-tight">
                  Recebemos seu contato!
                </h2>
                <p className="text-sm text-gray-400 max-w-sm mx-auto leading-relaxed">
                  Obrigado por nos procurar. Nossa equipe especializada entrará em contato em breve
                  para apresentar a melhor proposta.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#0E1017] border border-[#262A33] text-left max-w-sm mx-auto space-y-2 text-xs text-gray-300">
                <div className="flex justify-between">
                  <span className="text-gray-500">Empresa:</span>
                  <span className="font-semibold text-white">{company}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Responsável:</span>
                  <span className="font-semibold text-white">{name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Interesse:</span>
                  <span className="text-indigo-400 font-semibold">{interest}</span>
                </div>
              </div>

              {allowRepeat && (
                <div className="pt-2">
                  <Button
                    onClick={handleResetForm}
                    variant="outline"
                    className="border-[#262A33] text-gray-300 hover:text-white rounded-xl text-xs"
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-2" />
                    Enviar outro contato
                  </Button>
                </div>
              )}
            </div>
          ) : (
            /* Formulário de Envio */
            <>
              <div className="text-left mb-6">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-2">
                  <Sparkles className="w-3 h-3" />
                  Consultoria & Estratégia de Negócios
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                  Inicie sua Transformação Comercial
                </h1>
                <p className="text-xs sm:text-sm text-gray-400 mt-1">
                  Conte-nos sobre seus desafios e receba um diagnóstico exclusivo de atendimento e
                  processos.
                </p>
              </div>

              {errorMessage && (
                <div className="mb-5 flex items-center gap-2 p-3 text-xs text-red-300 bg-red-950/40 border border-red-800/60 rounded-xl">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs font-medium text-gray-300">
                    Nome Completo *
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <Input
                      id="name"
                      required
                      placeholder="Ex: Leandro Bertanha"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-10 bg-[#0E1017] border-[#262A33] text-white text-xs placeholder:text-gray-600 focus-visible:ring-indigo-500 rounded-xl h-11"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs font-medium text-gray-300">
                      E-mail corporativo *
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <Input
                        id="email"
                        type="email"
                        required
                        placeholder="contato@empresa.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10 bg-[#0E1017] border-[#262A33] text-white text-xs placeholder:text-gray-600 focus-visible:ring-indigo-500 rounded-xl h-11"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-xs font-medium text-gray-300">
                      Telefone / WhatsApp *
                    </Label>
                    <div className="relative">
                      <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <Input
                        id="phone"
                        required
                        placeholder="(11) 98765-4321"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="pl-10 bg-[#0E1017] border-[#262A33] text-white text-xs placeholder:text-gray-600 focus-visible:ring-indigo-500 rounded-xl h-11"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="company" className="text-xs font-medium text-gray-300">
                      Empresa *
                    </Label>
                    <div className="relative">
                      <Building className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <Input
                        id="company"
                        required
                        placeholder="Nome da sua empresa"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        className="pl-10 bg-[#0E1017] border-[#262A33] text-white text-xs placeholder:text-gray-600 focus-visible:ring-indigo-500 rounded-xl h-11"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="interest" className="text-xs font-medium text-gray-300">
                      Principal Interesse
                    </Label>
                    <Select value={interest} onValueChange={setInterest}>
                      <SelectTrigger className="bg-[#0E1017] border-[#262A33] text-white text-xs h-11 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#12141A] border-[#262A33] text-white text-xs">
                        <SelectItem value="Consultoria">Consultoria Estratégica</SelectItem>
                        <SelectItem value="Desenvolvimento">Desenvolvimento de Software</SelectItem>
                        <SelectItem value="Design">UI/UX & Design de Produto</SelectItem>
                        <SelectItem value="Outro">Outro Desafio Operacional</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="message" className="text-xs font-medium text-gray-300">
                    Mensagem / Desafio (opcional)
                  </Label>
                  <Textarea
                    id="message"
                    rows={3}
                    placeholder="Descreva brevemente o momento da sua operação, desafios de suporte ou tecnologia..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="bg-[#0E1017] border-[#262A33] text-white text-xs placeholder:text-gray-600 focus-visible:ring-indigo-500 rounded-xl resize-none"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-12 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/30 transition-all glow-button mt-3 text-sm flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Registrando seus dados...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Enviar e receber retorno
                    </>
                  )}
                </Button>
              </form>

              <div className="mt-5 pt-4 border-t border-[#262A33]/70 flex items-center justify-center gap-2 text-[11px] text-gray-500">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                <span>Seus dados são protegidos e tratados com sigilo profissional.</span>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Rodapé Público */}
      <footer className="max-w-xl w-full mx-auto text-center pt-6 text-[11px] text-gray-500 relative z-10">
        <p>
          bit Consulting &bull; Consultoria Estratégica e Transformação de Dentro para Fora &bull;{' '}
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
