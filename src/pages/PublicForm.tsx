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
  DollarSign,
} from 'lucide-react'
import { formatBRL } from '@/types/crm'

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
  const [interest, setInterest] = useState<string>('WhatsApp Autônomo e Humanizado')
  const [productsList, setProductsList] = useState<
    Array<{ id: string; name: string; setup_price: number; monthly_price: number }>
  >([])

  useEffect(() => {
    async function loadProducts() {
      try {
        const records = await pb.collection('products').getFullList({
          filter: 'is_active = true',
          sort: 'display_order,name',
        })
        if (records.length > 0) {
          setProductsList(
            records.map((r) => ({
              id: r.id,
              name: r.name,
              setup_price: Number(r.setup_value ?? r.setup_price) || 350,
              monthly_price: Number(r.recurring_value ?? r.monthly_price) || 0,
            })),
          )
          const matched = records.find((r) => r.name === interest) || records[0]
          const initialSetup = Number(matched?.setup_value ?? matched?.setup_price) || 350
          setServiceValuePreset(String(initialSetup))
          setSubmittedValue(initialSetup)
        }
      } catch (err) {
        console.error('Erro ao carregar produtos no formulário:', err)
      }
    }
    loadProducts()
  }, [])
  const [serviceValuePreset, setServiceValuePreset] = useState<string>('350')
  const [customValueInput, setCustomValueInput] = useState('')
  const [submittedValue, setSubmittedValue] = useState<number>(350)
  const [paymentType, setPaymentType] = useState<'Débito' | 'PIX' | 'Parcelado'>('PIX')
  const [paymentInstallments, setPaymentInstallments] = useState<number>(1)
  const [message, setMessage] = useState('')

  // Estados de envio
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // ID do vendedor ativo para atribuição da oportunidade (se inativo, seller fica null)
  const [activeSellerId, setActiveSellerId] = useState<string | null>(null)

  // Busca o nome e status do vendedor se o sellerId foi fornecido
  useEffect(() => {
    if (sellerId) {
      pb.collection('users')
        .getOne<{ id: string; name?: string; email: string; disabled?: boolean }>(sellerId, {
          fields: 'id,name,email,disabled',
        })
        .then((seller) => {
          if (seller.disabled === true) {
            // Vendedor desativado: não atribuir oportunidade (seller: null)
            setActiveSellerId(null)
            setSellerName('')
          } else {
            setActiveSellerId(seller.id)
            setSellerName(seller.name || seller.email.split('@')[0])
          }
        })
        .catch(() => {
          // vendedor não encontrado ou restrito, segue normalmente
          setActiveSellerId(null)
          setSellerName('')
        })
    } else {
      setActiveSellerId(null)
      setSellerName('')
    }
  }, [sellerId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!name.trim() || !email.trim() || !company.trim() || !phone.trim()) {
      setErrorMessage('Por favor, preencha todos os campos obrigatórios.')
      return
    }

    let finalValue = 0
    if (serviceValuePreset === 'outro') {
      const parsedCustom = parseCustomValue(customValueInput)
      if (parsedCustom === null || parsedCustom <= 0) {
        setErrorMessage('Por favor, informe um valor de serviço válido e maior que zero.')
        return
      }
      finalValue = parsedCustom
    } else {
      finalValue = Number(serviceValuePreset)
    }

    // Validação: setup do produto ou serviço não deve ser inferior ao piso de R$ 350
    if (finalValue < 350) {
      setErrorMessage('O valor do setup comercial é a partir de R$ 350,00.')
      return
    }

    setSubmitting(true)

    try {
      // Cria a Oportunidade diretamente na coleção PocketBase
      const matchedProduct = productsList.find((p) => p.name === interest)
      const opportunityData = {
        company: company.trim(),
        stage: 'Novo',
        source: 'Formulário Público',
        value: finalValue,
        product: matchedProduct?.id || null,
        product_name: matchedProduct?.name || interest,
        seller: activeSellerId || null,
        contact_name: name.trim(),
        contact_email: email.trim(),
        contact_phone: phone.trim(),
        payment_type: paymentType,
        payment_installments: paymentType === 'Parcelado' ? Number(paymentInstallments) : null,
        message: `[Interesse: ${interest}] [Setup: ${formatBRL(finalValue)}${
          matchedProduct && matchedProduct.monthly_price > 0
            ? ` | Mensalidade: ${formatBRL(matchedProduct.monthly_price)}/mês`
            : ''
        }] [Pagamento: ${paymentType}${
          paymentType === 'Parcelado' ? ` em ${paymentInstallments}x` : ''
        }] ${message.trim()}`,
      }

      await pb.collection('opportunities').create(opportunityData)
      setSubmittedValue(finalValue)
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

  // Converte string BRL (ex: "1.250,50") para número float
  const parseCustomValue = (raw: string): number | null => {
    if (!raw) return null
    const cleaned = raw.replace(/[^\d]/g, '')
    if (!cleaned) return null
    const cents = parseInt(cleaned, 10)
    return isNaN(cents) ? null : cents / 100
  }

  // Máscara monetária BRL ao digitar
  const handleCustomValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawDigits = e.target.value.replace(/\D/g, '')
    if (!rawDigits) {
      setCustomValueInput('')
      return
    }
    const cents = parseInt(rawDigits, 10)
    const formatted = (cents / 100).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    setCustomValueInput(formatted)
  }

  const handleResetForm = () => {
    setName('')
    setEmail('')
    setPhone('')
    setCompany('')
    const defaultInterest =
      productsList.length > 0 ? productsList[0].name : 'Site ou Landing Page sob medida'
    setInterest(defaultInterest)
    const defaultSetup = productsList.length > 0 ? productsList[0].setup_price : 350
    setServiceValuePreset(String(defaultSetup))
    setCustomValueInput('')
    setSubmittedValue(defaultSetup)
    setPaymentType('PIX')
    setPaymentInstallments(1)
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
      <header className="max-w-xl w-full mx-auto flex items-center justify-between gap-3 sm:gap-4 pb-6 relative z-10">
        <div className="min-w-0 shrink">
          <BrandLogo variant="full" size="xl" showCrmBadge={false} />
        </div>
        {sellerName && (
          <div className="text-right shrink-0">
            <span className="text-[10px] sm:text-[11px] text-gray-500 block">Atendimento com</span>
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
                <div className="flex justify-between">
                  <span className="text-gray-500">Valor do Serviço:</span>
                  <span className="text-indigo-400 font-semibold">{formatBRL(submittedValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Forma de Pagamento:</span>
                  <span className="text-emerald-400 font-semibold">
                    {paymentType}
                    {paymentType === 'Parcelado' ? ` (${paymentInstallments}x)` : ''}
                  </span>
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
                      Principal Interesse / Solução *
                    </Label>
                    <Select
                      value={interest}
                      onValueChange={(val) => {
                        setInterest(val)
                        const matched = productsList.find((p) => p.name === val)
                        if (matched && matched.setup_price > 0) {
                          setServiceValuePreset(String(matched.setup_price))
                        }
                      }}
                    >
                      <SelectTrigger className="bg-[#0E1017] border-[#262A33] text-white text-xs h-11 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#12141A] border-[#262A33] text-white text-xs">
                        {productsList.length > 0 ? (
                          productsList.map((p) => {
                            const isWaAutonomous =
                              p.name.toLowerCase().includes('whatsapp') &&
                              (p.name.toLowerCase().includes('autônomo') ||
                                p.name.toLowerCase().includes('autonomo'))

                            // Regra do usuário: em WhatsApp Autônomo e Humanizado, retirar da frente os valores
                            const priceLabel =
                              !isWaAutonomous && p.monthly_price > 0
                                ? `(R$ ${p.setup_price} + R$ ${p.monthly_price}/mês)`
                                : ''

                            return (
                              <SelectItem key={p.id} value={p.name}>
                                {p.name} {priceLabel}
                              </SelectItem>
                            )
                          })
                        ) : (
                          <>
                            <SelectItem value="WhatsApp Autônomo e Humanizado">
                              WhatsApp Autônomo e Humanizado
                            </SelectItem>
                            <SelectItem value="Site">Site Profissional</SelectItem>
                            <SelectItem value="Landing Page">
                              Landing Page de Alta Conversão
                            </SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Campo Valor do Serviço */}
                <div className="space-y-2 p-3.5 rounded-2xl bg-[#0E1017] border border-[#262A33]">
                  <div className="space-y-1.5">
                    <Label htmlFor="service-value" className="text-xs font-medium text-gray-300">
                      Valor do Serviço *
                    </Label>
                    <Select
                      value={serviceValuePreset}
                      onValueChange={(val) => {
                        setServiceValuePreset(val)
                      }}
                    >
                      <SelectTrigger
                        id="service-value"
                        className="bg-[#12141A] border-[#262A33] text-white text-xs h-11 rounded-xl"
                      >
                        <SelectValue placeholder="Selecione o valor do serviço" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#12141A] border-[#262A33] text-white text-xs">
                        {/* Opções derivadas do banco de dados, começando pelo piso R$ 350,00 */}
                        <SelectItem value="350">R$ 350,00 (Piso do setup)</SelectItem>
                        <SelectItem value="500">R$ 500,00</SelectItem>
                        <SelectItem value="1000">R$ 1.000,00</SelectItem>
                        <SelectItem value="2500">R$ 2.500,00</SelectItem>
                        <SelectItem value="outro">Outro valor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {serviceValuePreset === 'outro' && (
                    <div className="space-y-1.5 pt-1 animate-fadeInUp">
                      <Label htmlFor="custom-value" className="text-xs font-medium text-indigo-300">
                        Digite o valor desejado (R$) *
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400 select-none">
                          R$
                        </span>
                        <Input
                          id="custom-value"
                          type="text"
                          inputMode="numeric"
                          required={serviceValuePreset === 'outro'}
                          placeholder="0,00"
                          value={customValueInput}
                          onChange={handleCustomValueChange}
                          className="pl-10 bg-[#12141A] border-indigo-500/40 text-white text-xs placeholder:text-gray-600 focus-visible:ring-indigo-500 rounded-xl h-11"
                        />
                      </div>
                      <p className="text-[11px] text-gray-500">
                        Informe o valor estimado para o seu projeto ou consultoria.
                      </p>
                    </div>
                  )}
                </div>

                {/* Tipo de Pagamento e Parcelas (limite até 10x) */}
                <div className="p-3.5 rounded-2xl bg-[#0E1017] border border-[#262A33] space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-300">Tipo de Pagamento *</Label>
                    <Select
                      value={paymentType}
                      onValueChange={(val) => setPaymentType(val as 'Débito' | 'PIX' | 'Parcelado')}
                    >
                      <SelectTrigger className="bg-[#12141A] border-[#262A33] text-white text-xs h-11 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#12141A] border-[#262A33] text-white text-xs">
                        <SelectItem value="PIX">PIX</SelectItem>
                        <SelectItem value="Débito">Débito</SelectItem>
                        <SelectItem value="Parcelado">Parcelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {paymentType === 'Parcelado' && (
                    <div className="space-y-1.5 pt-1 animate-fadeInUp">
                      <div className="flex items-center justify-between">
                        <Label
                          htmlFor="installments"
                          className="text-xs font-medium text-indigo-300"
                        >
                          Número de Parcelas (limite até 10x) *
                        </Label>
                        <span className="text-[11px] text-gray-400">Até 10 vezes</span>
                      </div>
                      <Select
                        value={String(paymentInstallments)}
                        onValueChange={(val) => setPaymentInstallments(Number(val))}
                      >
                        <SelectTrigger
                          id="installments"
                          className="bg-[#12141A] border-indigo-500/40 text-white text-xs h-11 rounded-xl"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#12141A] border-[#262A33] text-white text-xs">
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                            <SelectItem key={n} value={String(n)}>
                              {n === 1 ? '1x (à vista no crédito)' : `${n}x`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="message" className="text-xs font-medium text-gray-300">
                    Mensagem / Observações (opcional)
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
                <span>
                  Seus dados são protegidos conforme a LGPD. Consulte nossa{' '}
                  <Link to="/termos" target="_blank" className="text-indigo-400 hover:underline">
                    Política de Privacidade
                  </Link>
                  .
                </span>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Rodapé Público */}
      <footer className="max-w-xl w-full mx-auto text-center pt-6 text-[11px] text-gray-500 relative z-10 space-y-1">
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
        <p className="text-[10px] text-gray-600">
          <Link to="/termos" className="hover:text-indigo-400 transition-colors">
            Termos de Serviço & Política de Privacidade
          </Link>
        </p>
      </footer>
    </div>
  )
}
