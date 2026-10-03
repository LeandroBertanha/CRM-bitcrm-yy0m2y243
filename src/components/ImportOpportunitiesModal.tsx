import React, { useState, useRef, useMemo } from 'react'
import pb from '@/lib/pocketbase/client'
import { STAGES, SOURCES, Opportunity } from '@/types/crm'
import {
  ParsedSheetData,
  OppTargetField,
  TARGET_FIELDS,
  ProcessedLeadItem,
  parseSpreadsheetFile,
  guessInitialFileMappings,
  normalizePhoneKey,
  normalizeCompanyKey,
  normalizeStageValue,
  normalizeSourceValue,
  parseCurrencyValue,
  matchSellerByName,
} from '@/lib/opportunityImportHelper'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Download,
  Loader2,
  Building,
  User,
  Phone,
  DollarSign,
  Layers,
  MapPin,
  Tag,
  Eye,
  Check,
  RotateCcw,
} from 'lucide-react'

export interface ImportOpportunitiesModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  currentUserEmail?: string
  currentUserId?: string
  existingOpportunities: Opportunity[]
  sellersList: { id: string; name?: string; email: string }[]
  initialDroppedFile?: File | null
  onClearInitialDroppedFile?: () => void
}

export function ImportOpportunitiesModal({
  open,
  onOpenChange,
  onSuccess,
  currentUserEmail,
  currentUserId,
  existingOpportunities,
  sellersList,
  initialDroppedFile,
  onClearInitialDroppedFile,
}: ImportOpportunitiesModalProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Etapas:
  // 1 = Upload de arquivo (.xlsx, .xls, .csv etc.)
  // 2 = Pré-visualização e Mapeamento de Colunas
  // 3 = Validação, Configuração & Duplicatas
  // 4 = Progresso de Criação em Lote & Resumo Final
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)

  // Arquivo carregado
  const [parsedFile, setParsedFile] = useState<ParsedSheetData | null>(null)
  const [isParsingFile, setIsParsingFile] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)

  // Mapeamento das colunas
  const [mapping, setMapping] = useState<Record<string, OppTargetField>>({})

  // Configurações e padrões
  const [assignedSellerId, setAssignedSellerId] = useState<string>(currentUserId || '')
  const [defaultStage, setDefaultStage] = useState<Opportunity['stage']>('Novo')
  const [defaultSource, setDefaultSource] = useState<Opportunity['source']>('Prospecção')
  const [defaultValue, setDefaultValue] = useState<string>('500')
  const [skipDuplicates, setSkipDuplicates] = useState<boolean>(true)

  // Filtro na visualização da validação (todas, com aviso, duplicadas)
  const [validationFilter, setValidationFilter] = useState<'all' | 'duplicates' | 'issues'>('all')

  // Progresso da importação
  const [isImporting, setIsImporting] = useState<boolean>(false)
  const [importProgress, setImportProgress] = useState<number>(0)
  const [currentImportIndex, setCurrentImportIndex] = useState<number>(0)
  const [importStats, setImportStats] = useState<{
    total: number
    successCount: number
    skippedDuplicatesCount: number
    errorCount: number
    errors: { company: string; phone: string; error: string }[]
  }>({
    total: 0,
    successCount: 0,
    skippedDuplicatesCount: 0,
    errorCount: 0,
    errors: [],
  })

  // Sincronizar vendedor padrão com o usuário autenticado quando abrir
  React.useEffect(() => {
    if (currentUserId && !assignedSellerId) {
      setAssignedSellerId(currentUserId)
    }
  }, [currentUserId, assignedSellerId])

  // Arquivo arrastado de fora diretamente no kanban
  React.useEffect(() => {
    if (open && initialDroppedFile) {
      processIncomingFile(initialDroppedFile)
      onClearInitialDroppedFile?.()
    }
  }, [open, initialDroppedFile])

  // Limpa tudo ao fechar
  const handleReset = () => {
    setStep(1)
    setParsedFile(null)
    setMapping({})
    setImportProgress(0)
    setCurrentImportIndex(0)
    setIsImporting(false)
    setIsDragOver(false)
    setValidationFilter('all')
    setImportStats({
      total: 0,
      successCount: 0,
      skippedDuplicatesCount: 0,
      errorCount: 0,
      errors: [],
    })
  }

  // Leitura e inferência inteligente do arquivo
  const processIncomingFile = async (file: File) => {
    if (!file) return

    setIsParsingFile(true)
    try {
      const parsedSheets = await parseSpreadsheetFile(file)
      if (!parsedSheets || parsedSheets.length === 0) {
        throw new Error(
          'Não foi possível ler este arquivo. Verifique se o formato é .xlsx, .xls ou .csv válido.',
        )
      }

      const activeSheet = parsedSheets[0]
      if (activeSheet.rows.length === 0) {
        throw new Error('A planilha selecionada está vazia ou não possui linhas de dados.')
      }

      // Detecção automática heurística por nome e conteúdo de coluna
      const autoMapping = guessInitialFileMappings(activeSheet.headers, activeSheet.rows)

      setParsedFile(activeSheet)
      setMapping(autoMapping)
      setStep(2) // Avança para a tela de pré-visualização e mapeamento
    } catch (err) {
      console.error(`Erro ao ler o arquivo ${file.name}:`, err)
      const msg = err instanceof Error ? err.message : 'Não conseguimos ler este arquivo.'
      toast({
        title: 'Erro na leitura do arquivo',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setIsParsingFile(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      await processIncomingFile(files[0])
    }
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy'
    }
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setIsDragOver(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processIncomingFile(e.dataTransfer.files[0])
    }
  }

  const handleUpdateMapping = (header: string, targetField: OppTargetField) => {
    setMapping((prev) => ({
      ...prev,
      [header]: targetField,
    }))
  }

  // Processamento e normalização linha a linha com detecção de duplicatas
  const processedLeads: ProcessedLeadItem[] = useMemo(() => {
    if (!parsedFile) return []

    const result: ProcessedLeadItem[] = []
    const seenInBatch = new Set<string>()

    // Chaves existentes no banco de dados (case/acento-insensitivas e dígitos de telefone)
    const existingKeys = new Set<string>()
    for (let i = 0; i < existingOpportunities.length; i++) {
      const opp = existingOpportunities[i]
      const cKey = normalizeCompanyKey(opp.company || '')
      const pKey = normalizePhoneKey(opp.contact_phone || '')
      if (cKey) existingKeys.add(`c:${cKey}`)
      if (pKey) existingKeys.add(`p:${pKey}`)
      if (cKey && pKey) existingKeys.add(`cp:${cKey}_${pKey}`)
    }

    parsedFile.rows.forEach((row) => {
      let company = ''
      let contact_name = ''
      let contact_phone = ''
      let contact_email = ''
      let city = ''
      let messageText = ''
      let rawSellerName = ''
      let rowStage: Opportunity['stage'] | undefined = undefined
      let rowValue: number | undefined = undefined
      let rowSource: Opportunity['source'] | undefined = undefined
      const notesList: string[] = []
      const validationIssues: string[] = []

      Object.entries(row).forEach(([colHeader, colVal]) => {
        const val = String(colVal || '').trim()
        if (!val) return

        const mappedTarget = mapping[colHeader] || 'ignore'
        switch (mappedTarget) {
          case 'company':
            company = val
            break
          case 'contact_name':
            contact_name = val
            break
          case 'contact_phone':
            contact_phone = val
            break
          case 'contact_email':
            contact_email = val
            break
          case 'city':
            city = val
            break
          case 'seller':
            rawSellerName = val
            break
          case 'source': {
            const srcMatch = normalizeSourceValue(val)
            if (srcMatch) {
              rowSource = srcMatch
            } else {
              notesList.push(`Origem original: ${val}`)
            }
            break
          }
          case 'stage': {
            const stageMatch = normalizeStageValue(val)
            if (stageMatch) {
              rowStage = stageMatch
            } else {
              validationIssues.push(
                `Estágio "${val}" desconhecido; será convertido em "${defaultStage}"`,
              )
            }
            break
          }
          case 'value': {
            const parsed = parseCurrencyValue(val)
            if (parsed !== null && parsed >= 0) {
              rowValue = parsed
            } else {
              validationIssues.push(
                `Valor "${val}" não reconhecido; assumirá padrão R$ ${defaultValue}`,
              )
            }
            break
          }
          case 'message':
            messageText = val
            break
          case 'website':
            notesList.push(`Site próprio: ${val}`)
            break
          case 'source_ref': {
            notesList.push(`Referência: ${val}`)
            if (!rowSource) {
              const srcMatch = normalizeSourceValue(val)
              if (srcMatch) rowSource = srcMatch
            }
            break
          }
          case 'last_contact':
            notesList.push(`Último contato: ${val}`)
            break
          case 'next_contact':
            notesList.push(`Próximo retorno: ${val}`)
            break
          default:
            break
        }
      })

      // Se a empresa ainda estiver vazia mas tiver nome de contato, usa como fallback
      if (!company && contact_name) {
        company = contact_name
        validationIssues.push('Nome da empresa ausente; utilizando nome do contato')
      }

      // Se nem empresa nem contato existirem, ignora linha vazia
      if (!company) return

      // Resolução do vendedor da linha se houver coluna mapeada
      let resolvedSellerId: string | undefined = undefined
      if (rawSellerName) {
        const matched = matchSellerByName(rawSellerName, sellersList)
        if (matched) {
          resolvedSellerId = matched
        } else {
          validationIssues.push(
            `Vendedor "${rawSellerName}" não encontrado; usará o vendedor padrão`,
          )
        }
      }

      // Montar mensagem completa combinando mensagem e notas
      let fullMessage = messageText
      if (notesList.length > 0) {
        const notesCombined = notesList.join(' | ')
        fullMessage = fullMessage ? `${fullMessage}\n[Info: ${notesCombined}]` : notesCombined
      }

      // Checar duplicatas contra o banco e contra o lote atual
      const cKey = normalizeCompanyKey(company)
      const pKey = normalizePhoneKey(contact_phone)
      let isDuplicate = false
      let duplicateReason = ''

      if (
        cKey &&
        pKey &&
        pKey.length >= 8 &&
        (existingKeys.has(`cp:${cKey}_${pKey}`) || seenInBatch.has(`cp:${cKey}_${pKey}`))
      ) {
        isDuplicate = true
        duplicateReason = 'Empresa e Telefone já cadastrados'
      } else if (
        pKey &&
        pKey.length >= 8 &&
        (existingKeys.has(`p:${pKey}`) || seenInBatch.has(`p:${pKey}`))
      ) {
        isDuplicate = true
        duplicateReason = 'Telefone já cadastrado no CRM'
      } else if (
        !pKey &&
        cKey &&
        cKey.length >= 4 &&
        (existingKeys.has(`c:${cKey}`) || seenInBatch.has(`c:${cKey}`))
      ) {
        isDuplicate = true
        duplicateReason = 'Mesmo nome de empresa já cadastrado'
      }

      // Marcar no lote
      if (cKey) seenInBatch.add(`c:${cKey}`)
      if (pKey && pKey.length >= 8) seenInBatch.add(`p:${pKey}`)
      if (cKey && pKey && pKey.length >= 8) seenInBatch.add(`cp:${cKey}_${pKey}`)

      result.push({
        company,
        contact_name,
        contact_phone,
        contact_email,
        city,
        stage: rowStage,
        value: rowValue,
        source: rowSource,
        sellerName: rawSellerName,
        sellerId: resolvedSellerId,
        notesList,
        fullMessage,
        isDuplicate,
        duplicateReason,
        sourceFile: parsedFile.fileName,
        validationIssues: validationIssues.length > 0 ? validationIssues : undefined,
      })
    })

    return result
  }, [parsedFile, mapping, existingOpportunities, sellersList, defaultStage, defaultValue])

  const totalDuplicates = useMemo(() => {
    return processedLeads.filter((l) => l.isDuplicate).length
  }, [processedLeads])

  const totalWithIssues = useMemo(() => {
    return processedLeads.filter(
      (l) => (l.validationIssues && l.validationIssues.length > 0) || l.isDuplicate,
    ).length
  }, [processedLeads])

  const readyToImportCount = useMemo(() => {
    if (skipDuplicates) {
      return processedLeads.filter((l) => !l.isDuplicate).length
    }
    return processedLeads.length
  }, [processedLeads, skipDuplicates])

  const canProceedToValidation = useMemo(() => {
    if (!parsedFile) return false
    return Object.values(mapping).includes('company')
  }, [parsedFile, mapping])

  // Iniciar Importação em Lote via PocketBase (com feedback de progresso em tempo real)
  const handleStartImport = async () => {
    setStep(4)
    setIsImporting(true)
    setImportProgress(0)

    const leadsToImport = skipDuplicates
      ? processedLeads.filter((l) => !l.isDuplicate)
      : processedLeads

    const skippedDuplicatesCount = processedLeads.filter((l) => l.isDuplicate).length

    const fallbackNumericValue = parseFloat(defaultValue.replace(',', '.')) || 500
    const finalFallbackSellerId = assignedSellerId || currentUserId || ''

    let successCount = 0
    let errorCount = 0
    const errors: { company: string; phone: string; error: string }[] = []

    const total = leadsToImport.length

    if (total === 0) {
      setIsImporting(false)
      setImportStats({
        total: processedLeads.length,
        successCount: 0,
        skippedDuplicatesCount: skipDuplicates ? skippedDuplicatesCount : 0,
        errorCount: 0,
        errors: [],
      })
      toast({
        title: 'Nenhuma oportunidade a importar',
        description: 'Todos os registros foram pulados por já existirem no banco.',
      })
      onSuccess()
      return
    }

    const buildPayload = (lead: ProcessedLeadItem) => ({
      company: lead.company,
      stage: lead.stage || defaultStage,
      source: lead.source || defaultSource,
      value: lead.value !== undefined ? lead.value : fallbackNumericValue,
      seller: lead.sellerId || finalFallbackSellerId || null,
      contact_name: lead.contact_name || '',
      contact_email: lead.contact_email || '',
      contact_phone: lead.contact_phone || '',
      city: lead.city || '',
      message: lead.fullMessage || '',
      payment_type: null,
      payment_installments: null,
    })

    const createSingleLead = async (lead: ProcessedLeadItem) => {
      try {
        await pb.collection('opportunities').create(buildPayload(lead))
        successCount++
      } catch (err: unknown) {
        errorCount++
        console.error(`Erro ao importar ${lead.company}:`, err)
        let errorMsg = 'Erro na criação da oportunidade'
        if (err && typeof err === 'object' && 'data' in err) {
          const d = (err as { data?: { message?: string } }).data
          if (d?.message) errorMsg = d.message
        }
        errors.push({
          company: lead.company,
          phone: lead.contact_phone,
          error: errorMsg,
        })
      }
    }

    const CONCURRENCY = 4
    let processedSoFar = 0

    for (let i = 0; i < total; i += CONCURRENCY) {
      const chunk = leadsToImport.slice(i, i + CONCURRENCY)
      await Promise.all(chunk.map((l) => createSingleLead(l)))
      processedSoFar += chunk.length
      setCurrentImportIndex(Math.min(total, processedSoFar))
      setImportProgress(Math.round((processedSoFar / total) * 100))
    }

    setIsImporting(false)
    setImportStats({
      total: processedLeads.length,
      successCount,
      skippedDuplicatesCount: skipDuplicates ? skippedDuplicatesCount : 0,
      errorCount,
      errors,
    })

    toast({
      title: 'Importação Concluída!',
      description: `${successCount} oportunidades adicionadas ao pipeline de vendas.`,
    })

    onSuccess()
  }

  // Baixar relatório com eventuais falhas
  const handleDownloadReport = () => {
    const lines = [
      ['Empresa', 'Telefone', 'Status', 'Detalhes'].join(';'),
      ...importStats.errors.map((e) =>
        [e.company, e.phone, 'ERRO', e.error].map((v) => `"${v}"`).join(';'),
      ),
    ]

    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `erros_importacao_${Date.now()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Filtragem dos leads para exibição na etapa 3
  const visibleLeadsInValidation = useMemo(() => {
    if (validationFilter === 'duplicates') {
      return processedLeads.filter((l) => l.isDuplicate)
    }
    if (validationFilter === 'issues') {
      return processedLeads.filter(
        (l) => (l.validationIssues && l.validationIssues.length > 0) || l.isDuplicate,
      )
    }
    return processedLeads
  }, [processedLeads, validationFilter])

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!isImporting) {
          if (!v) handleReset()
          onOpenChange(v)
        }
      }}
    >
      <DialogContent className="bg-[#12141A] border-[#262A33] text-white max-w-3xl rounded-2xl shadow-2xl p-6 max-h-[92vh] flex flex-col">
        {/* Cabeçalho do Modal com Stepper das 4 Etapas */}
        <DialogHeader className="shrink-0 pb-3 border-b border-[#262A33]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600/30 to-blue-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  Importar Planilha de Oportunidades
                </DialogTitle>
                <DialogDescription className="text-xs text-gray-400 mt-0.5">
                  Importe planilhas (.xlsx, .xls, .csv) direto para o funil comercial dos vendedores
                </DialogDescription>
              </div>
            </div>

            {/* Stepper das 4 etapas */}
            <div className="flex items-center gap-1 sm:gap-2 text-xs overflow-x-auto py-1">
              {[
                { s: 1, label: 'Upload' },
                { s: 2, label: 'Mapeamento' },
                { s: 3, label: 'Validação' },
                { s: 4, label: 'Importação' },
              ].map((item) => (
                <div key={item.s} className="flex items-center gap-1 shrink-0">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      step === item.s
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                        : step > item.s
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : 'bg-[#181B24] text-gray-500 border border-[#262A33]'
                    }`}
                  >
                    {step > item.s ? '✓' : item.s}
                  </div>
                  <span
                    className={`text-[11px] font-medium hidden md:inline ${
                      step === item.s ? 'text-white' : 'text-gray-500'
                    }`}
                  >
                    {item.label}
                  </span>
                  {item.s < 4 && <span className="text-gray-700 text-xs px-0.5">›</span>}
                </div>
              ))}
            </div>
          </div>
        </DialogHeader>

        {/* Conteúdo Dinâmico com Rolagem Suave */}
        <div className="flex-1 overflow-y-auto py-3 space-y-4 custom-scrollbar">
          {/* ========================================================================= */}
          {/* ETAPA 1: UPLOAD DE ARQUIVO (.XLSX / .XLS / .CSV) */}
          {/* ========================================================================= */}
          {step === 1 && (
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 group flex flex-col items-center justify-center space-y-3 ${
                  isDragOver
                    ? 'border-indigo-400 bg-indigo-950/40 scale-[1.01] shadow-lg shadow-indigo-600/20'
                    : 'border-[#2E3342] hover:border-indigo-500/70 bg-[#0E1017] hover:bg-[#12141F]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.ods,.csv,.tsv,.txt,.json"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div
                  className={`w-14 h-14 rounded-2xl border transition-all flex items-center justify-center ${
                    isDragOver
                      ? 'bg-indigo-600 text-white border-indigo-400 scale-110'
                      : 'bg-indigo-600/10 border-indigo-500/20 group-hover:scale-105 group-hover:bg-indigo-600/20 text-indigo-400'
                  }`}
                >
                  {isParsingFile ? (
                    <Loader2 className="w-7 h-7 animate-spin" />
                  ) : (
                    <UploadCloud className="w-7 h-7" />
                  )}
                </div>

                <div>
                  <p className="text-sm font-semibold text-white group-hover:text-indigo-300 transition-colors">
                    {isParsingFile
                      ? 'Lendo planilha e analisando colunas...'
                      : isDragOver
                        ? 'Solte o arquivo aqui para iniciar'
                        : 'Clique para escolher ou arraste sua planilha aqui'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Aceita arquivos nos formatos <strong className="text-gray-300">.xlsx</strong>,{' '}
                    <strong className="text-gray-300">.xls</strong> e{' '}
                    <strong className="text-gray-300">.csv</strong>
                  </p>
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#181B24] border border-[#262A33] text-[11px] text-gray-400">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  Leitura 100% no navegador com detecção inteligente de cabeçalhos
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-[#0E1017] border border-[#262A33] text-xs">
                  <div className="flex items-center gap-2 text-indigo-400 font-semibold mb-1">
                    <Building className="w-3.5 h-3.5" />
                    Empresa & Contato
                  </div>
                  <p className="text-gray-400 text-[11px]">
                    Nome da empresa, pessoa de contato, telefone/WhatsApp e cidade são identificados
                    automaticamente.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-[#0E1017] border border-[#262A33] text-xs">
                  <div className="flex items-center gap-2 text-indigo-400 font-semibold mb-1">
                    <User className="w-3.5 h-3.5" />
                    Vendedor Responsável
                  </div>
                  <p className="text-gray-400 text-[11px]">
                    Atribua aos vendedores existentes pelo nome na planilha ou defina você mesmo
                    como responsável.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-[#0E1017] border border-[#262A33] text-xs">
                  <div className="flex items-center gap-2 text-indigo-400 font-semibold mb-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    Proteção de Duplicatas
                  </div>
                  <p className="text-gray-400 text-[11px]">
                    Verifica se o telefone ou empresa já existem no banco e permite pular sem poluir
                    seu CRM.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ETAPA 2: PRÉ-VISUALIZAÇÃO DA TABELA E MAPEAMENTO DE COLUNAS */}
          {/* ========================================================================= */}
          {step === 2 && parsedFile && (
            <div className="space-y-4">
              {/* Barra de identificação do arquivo */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 rounded-xl bg-[#0E1017] border border-[#262A33] gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileSpreadsheet className="w-4 h-4 text-indigo-400 shrink-0" />
                  <div className="truncate">
                    <span className="text-xs font-bold text-white block truncate">
                      {parsedFile.fileName}
                    </span>
                    <span className="text-[11px] text-gray-400">
                      Aba: {parsedFile.sheetName} &bull; {parsedFile.rows.length} linhas de dados
                      encontradas
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const auto = guessInitialFileMappings(parsedFile.headers, parsedFile.rows)
                      setMapping(auto)
                      toast({ title: 'Mapeamento recalculado' })
                    }}
                    className="h-8 text-xs text-gray-300 hover:text-white"
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                    Auto-detectar
                  </Button>
                </div>
              </div>

              {/* Aviso caso campo obrigatório 'company' não esteja mapeado */}
              {!canProceedToValidation && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-2 text-xs text-amber-300">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>
                    Selecione qual coluna representa a{' '}
                    <strong>Empresa / Título da Oportunidade</strong> para avançar.
                  </span>
                </div>
              )}

              {/* Mapeamento de Colunas com Dropdowns para cada cabeçalho */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-white flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-indigo-400" />
                    Mapeamento de Colunas ({parsedFile.headers.length} colunas encontradas)
                  </Label>
                  <span className="text-[11px] text-gray-400">
                    O bitCRM já inferiu os campos automaticamente; altere se desejar
                  </span>
                </div>

                <div className="border border-[#262A33] rounded-xl overflow-hidden bg-[#0A0C11] divide-y divide-[#262A33]/70 max-h-[220px] overflow-y-auto custom-scrollbar">
                  {parsedFile.headers.map((header) => {
                    const currentMapped = mapping[header] || 'ignore'
                    const sampleValue = parsedFile.rows[0]?.[header] || '—'

                    return (
                      <div
                        key={header}
                        className="grid grid-cols-12 gap-2 p-2.5 items-center text-xs hover:bg-[#12141A]/60 transition-colors"
                      >
                        <div className="col-span-5 truncate">
                          <span className="font-semibold text-white block truncate" title={header}>
                            {header}
                          </span>
                          <span
                            className="text-[10px] text-gray-500 font-mono block truncate"
                            title={sampleValue}
                          >
                            Exemplo: {sampleValue}
                          </span>
                        </div>

                        <div className="col-span-1 flex items-center justify-center text-gray-600">
                          <ArrowRight className="w-3.5 h-3.5" />
                        </div>

                        <div className="col-span-6">
                          <Select
                            value={currentMapped}
                            onValueChange={(val) =>
                              handleUpdateMapping(header, val as OppTargetField)
                            }
                          >
                            <SelectTrigger
                              className={`h-8 text-xs rounded-lg border ${
                                currentMapped === 'company'
                                  ? 'border-indigo-500 bg-indigo-950/30 text-indigo-300 font-semibold'
                                  : currentMapped === 'ignore'
                                    ? 'border-[#262A33] bg-[#12141A] text-gray-400'
                                    : 'border-[#2E3342] bg-[#12141A] text-white'
                              }`}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-[#12141A] border-[#262A33] text-white text-xs max-h-56">
                              {TARGET_FIELDS.map((opt) => (
                                <SelectItem key={opt.key} value={opt.key}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Tabela de Pré-visualização das Primeiras Linhas da Planilha */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-gray-400" />
                    Pré-visualização dos Dados (primeiras {Math.min(5, parsedFile.rows.length)}{' '}
                    linhas lidas)
                  </Label>
                  <span className="text-[11px] text-gray-500">
                    Role horizontalmente para inspecionar todas as colunas
                  </span>
                </div>

                <div className="border border-[#262A33] rounded-xl overflow-x-auto bg-[#0E1017] max-h-[180px] custom-scrollbar">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#161822] text-gray-300 text-[11px] uppercase tracking-wider sticky top-0 border-b border-[#262A33]">
                      <tr>
                        <th className="p-2 text-center text-gray-500 w-10">#</th>
                        {parsedFile.headers.map((h) => {
                          const target = mapping[h] || 'ignore'
                          return (
                            <th
                              key={h}
                              className="p-2 font-semibold whitespace-nowrap min-w-[120px]"
                            >
                              <div>{h}</div>
                              <span
                                className={`text-[9px] normal-case px-1.5 py-0.2 rounded font-normal inline-block mt-0.5 ${
                                  target === 'company'
                                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                    : target === 'ignore'
                                      ? 'text-gray-500 bg-gray-800/40'
                                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                }`}
                              >
                                {TARGET_FIELDS.find((f) => f.key === target)?.label.split(' ')[0] ||
                                  target}
                              </span>
                            </th>
                          )
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#262A33]/50 text-gray-300 text-[11px]">
                      {parsedFile.rows.slice(0, 5).map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-[#12141A]/50">
                          <td className="p-2 text-center text-gray-500 font-mono">{rIdx + 1}</td>
                          {parsedFile.headers.map((h) => (
                            <td
                              key={h}
                              className="p-2 whitespace-nowrap max-w-[200px] truncate"
                              title={row[h]}
                            >
                              {row[h] || '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ETAPA 3: VALIDAÇÃO, DUPLICATAS E CONFIGURAÇÕES PADRÃO */}
          {/* ========================================================================= */}
          {step === 3 && (
            <div className="space-y-4">
              {/* Cards de Resumo da Validação */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div
                  onClick={() => setValidationFilter('all')}
                  className={`p-3.5 bg-[#0E1017] border rounded-xl cursor-pointer transition-all ${
                    validationFilter === 'all'
                      ? 'border-indigo-500 ring-1 ring-indigo-500/30'
                      : 'border-[#262A33] hover:border-gray-600'
                  }`}
                >
                  <span className="text-[11px] text-gray-400 block">Total Identificado</span>
                  <span className="text-xl font-bold text-white tabular-nums">
                    {processedLeads.length}
                  </span>
                  <span className="text-[10px] text-gray-500 block mt-0.5">
                    Leads válidos para importar
                  </span>
                </div>

                <div
                  onClick={() => setValidationFilter('duplicates')}
                  className={`p-3.5 bg-[#0E1017] border rounded-xl cursor-pointer transition-all ${
                    validationFilter === 'duplicates'
                      ? 'border-amber-500 ring-1 ring-amber-500/30'
                      : 'border-[#262A33] hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-400">Duplicatas</span>
                    {totalDuplicates > 0 && (
                      <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-medium">
                        Detectado
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-xl font-bold tabular-nums ${
                      totalDuplicates > 0 ? 'text-amber-400' : 'text-emerald-400'
                    }`}
                  >
                    {totalDuplicates}
                  </span>
                  <span className="text-[10px] text-gray-500 block mt-0.5">
                    Mesma empresa ou telefone
                  </span>
                </div>

                <div
                  onClick={() => setValidationFilter('issues')}
                  className={`p-3.5 bg-[#0E1017] border rounded-xl cursor-pointer transition-all ${
                    validationFilter === 'issues'
                      ? 'border-indigo-400 ring-1 ring-indigo-400/30'
                      : 'border-indigo-500/30 bg-indigo-600/5 hover:border-indigo-500/50'
                  }`}
                >
                  <span className="text-[11px] text-indigo-300 block">Prontos p/ Importar</span>
                  <span className="text-xl font-bold text-indigo-400 tabular-nums">
                    {readyToImportCount}
                  </span>
                  <span className="text-[10px] text-indigo-300/70 block mt-0.5">
                    {skipDuplicates ? 'Pulando as duplicadas' : 'Incluindo todas'}
                  </span>
                </div>
              </div>

              {/* Opções de Atribuição Padrão e Vendedor */}
              <div className="p-4 bg-[#0E1017] border border-[#262A33] rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-indigo-400" />
                    Atribuição e Valores Padrão
                  </h4>
                  <span className="text-[11px] text-gray-400">
                    Aplicados às oportunidades sem valores explícitos
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-300 flex items-center gap-1.5">
                      <User className="w-3 h-3 text-gray-400" />
                      Vendedor Padrão
                    </Label>
                    <Select value={assignedSellerId} onValueChange={setAssignedSellerId}>
                      <SelectTrigger className="bg-[#12141A] border-[#262A33] text-white text-xs h-9 rounded-xl">
                        <SelectValue placeholder="Selecione o vendedor" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#12141A] border-[#262A33] text-white text-xs">
                        {sellersList.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name || s.email} {s.id === currentUserId ? '(Você)' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-300 flex items-center gap-1.5">
                      <DollarSign className="w-3 h-3 text-gray-400" />
                      Valor Padrão da Oportunidade (R$)
                    </Label>
                    <Input
                      type="number"
                      step="any"
                      value={defaultValue}
                      onChange={(e) => setDefaultValue(e.target.value)}
                      placeholder="500"
                      className="bg-[#12141A] border-[#262A33] text-white text-xs h-9 rounded-xl"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-300 flex items-center gap-1.5">
                      <Layers className="w-3 h-3 text-gray-400" />
                      Estágio Inicial Padrão
                    </Label>
                    <Select
                      value={defaultStage}
                      onValueChange={(val) => setDefaultStage(val as Opportunity['stage'])}
                    >
                      <SelectTrigger className="bg-[#12141A] border-[#262A33] text-white text-xs h-9 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#12141A] border-[#262A33] text-white text-xs">
                        {STAGES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-300 flex items-center gap-1.5">
                      <Tag className="w-3 h-3 text-gray-400" />
                      Canal de Origem Padrão
                    </Label>
                    <Select
                      value={defaultSource}
                      onValueChange={(val) => setDefaultSource(val as Opportunity['source'])}
                    >
                      <SelectTrigger className="bg-[#12141A] border-[#262A33] text-white text-xs h-9 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#12141A] border-[#262A33] text-white text-xs">
                        {SOURCES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Ação de Duplicatas */}
                <div className="pt-2 border-t border-[#262A33] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="skipDuplicatesCheckbox"
                      checked={skipDuplicates}
                      onChange={(e) => setSkipDuplicates(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 bg-[#12141A] border-[#3A4050] focus:ring-indigo-500 cursor-pointer"
                    />
                    <label
                      htmlFor="skipDuplicatesCheckbox"
                      className="text-xs text-gray-300 cursor-pointer select-none"
                    >
                      Pular duplicatas automaticamente <strong>(recomendado)</strong>
                    </label>
                  </div>

                  {totalDuplicates > 0 && (
                    <span className="text-[11px] text-amber-400 font-medium">
                      {skipDuplicates
                        ? `${totalDuplicates} não serão adicionadas`
                        : `${totalDuplicates} serão criadas mesmo duplicadas`}
                    </span>
                  )}
                </div>
              </div>

              {/* Lista dos Itens Validados com filtro */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-400">
                    Visualização das linhas ({visibleLeadsInValidation.length} de{' '}
                    {processedLeads.length}):
                  </span>
                  <div className="flex items-center gap-1 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setValidationFilter('all')}
                      className={`px-2 py-0.5 rounded transition-colors ${
                        validationFilter === 'all'
                          ? 'bg-indigo-600 text-white'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Todas ({processedLeads.length})
                    </button>
                    {totalDuplicates > 0 && (
                      <button
                        type="button"
                        onClick={() => setValidationFilter('duplicates')}
                        className={`px-2 py-0.5 rounded transition-colors ${
                          validationFilter === 'duplicates'
                            ? 'bg-amber-600 text-white'
                            : 'text-amber-400 hover:text-amber-300'
                        }`}
                      >
                        Duplicadas ({totalDuplicates})
                      </button>
                    )}
                    {totalWithIssues > 0 && (
                      <button
                        type="button"
                        onClick={() => setValidationFilter('issues')}
                        className={`px-2 py-0.5 rounded transition-colors ${
                          validationFilter === 'issues'
                            ? 'bg-indigo-700 text-white'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        Com Avisos ({totalWithIssues})
                      </button>
                    )}
                  </div>
                </div>

                <div className="border border-[#262A33] rounded-xl overflow-hidden bg-[#0E1017] divide-y divide-[#262A33]/70 max-h-[190px] overflow-y-auto custom-scrollbar">
                  {visibleLeadsInValidation.slice(0, 50).map((lead, idx) => (
                    <div key={idx} className="p-2.5 flex items-start justify-between text-xs gap-3">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 truncate">
                          <span className="font-bold text-white truncate">{lead.company}</span>
                          {lead.contact_name && lead.contact_name !== lead.company && (
                            <span className="text-[10px] text-gray-400 truncate">
                              ({lead.contact_name})
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-gray-400">
                          {lead.contact_phone && (
                            <span className="flex items-center gap-1 text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20 font-mono">
                              <Phone className="w-2.5 h-2.5" />
                              {lead.contact_phone}
                            </span>
                          )}
                          {lead.city && (
                            <span className="flex items-center gap-1 bg-[#181B24] px-1.5 py-0.5 rounded border border-[#262A33]">
                              <MapPin className="w-2.5 h-2.5 text-gray-500" />
                              {lead.city}
                            </span>
                          )}
                          <span className="bg-[#181B24] px-1.5 py-0.5 rounded border border-[#262A33] text-gray-400">
                            Estágio:{' '}
                            <strong className="text-white">{lead.stage || defaultStage}</strong>
                          </span>
                          <span className="bg-[#181B24] px-1.5 py-0.5 rounded border border-[#262A33] text-gray-400">
                            Valor:{' '}
                            <strong className="text-emerald-400">
                              R$ {lead.value !== undefined ? lead.value : defaultValue}
                            </strong>
                          </span>
                        </div>

                        {/* Avisos de normalização da linha */}
                        {lead.validationIssues && lead.validationIssues.length > 0 && (
                          <div className="text-[10px] text-amber-400/90 space-y-0.5 pt-0.5">
                            {lead.validationIssues.map((issue, iIdx) => (
                              <div key={iIdx} className="flex items-center gap-1">
                                <span className="w-1 h-1 rounded-full bg-amber-400" />
                                <span>{issue}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Status da duplicata */}
                      <div className="shrink-0 text-right">
                        {lead.isDuplicate ? (
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 block">
                              Duplicado
                            </span>
                            <span
                              className="text-[9px] text-gray-500 block max-w-[120px] truncate"
                              title={lead.duplicateReason}
                            >
                              {lead.duplicateReason}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            Pronto
                          </span>
                        )}
                      </div>
                    </div>
                  ))}

                  {visibleLeadsInValidation.length > 50 && (
                    <div className="p-2 text-center text-[11px] text-gray-500">
                      + {visibleLeadsInValidation.length - 50} outras oportunidades na fila
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ETAPA 4: PROGRESSO DA CRIAÇÃO EM LOTE & RESUMO FINAL */}
          {/* ========================================================================= */}
          {step === 4 && (
            <div className="space-y-5 py-4">
              {isImporting ? (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 mx-auto flex items-center justify-center text-indigo-400 animate-pulse">
                    <Loader2 className="w-8 h-8 animate-spin" />
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-white">
                      Criando Oportunidades no bitCRM...
                    </h3>
                    <p className="text-xs text-gray-400 mt-1">
                      Processando item {currentImportIndex} de {readyToImportCount}
                    </p>
                  </div>

                  <div className="max-w-md mx-auto space-y-2">
                    <Progress value={importProgress} className="h-3 bg-[#181B24]" />
                    <span className="text-xs font-mono text-indigo-400 tabular-nums">
                      {importProgress}% concluído
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-2">
                    <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                    <h3 className="text-base font-bold text-white">Importação Finalizada!</h3>
                    <p className="text-xs text-gray-300">
                      As oportunidades foram criadas com sucesso e o kanban foi atualizado em tempo
                      real.
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 bg-[#0E1017] border border-[#262A33] rounded-xl">
                      <span className="text-xs text-gray-400 block">Criadas no Funil</span>
                      <span className="text-xl font-bold text-emerald-400 tabular-nums">
                        {importStats.successCount}
                      </span>
                    </div>

                    <div className="p-3 bg-[#0E1017] border border-[#262A33] rounded-xl">
                      <span className="text-xs text-gray-400 block">Puladas (Duplicadas)</span>
                      <span className="text-xl font-bold text-amber-400 tabular-nums">
                        {importStats.skippedDuplicatesCount}
                      </span>
                    </div>

                    <div className="p-3 bg-[#0E1017] border border-[#262A33] rounded-xl">
                      <span className="text-xs text-gray-400 block">Falhas / Erros</span>
                      <span
                        className={`text-xl font-bold tabular-nums ${
                          importStats.errorCount > 0 ? 'text-red-400' : 'text-gray-500'
                        }`}
                      >
                        {importStats.errorCount}
                      </span>
                    </div>
                  </div>

                  {importStats.errorCount > 0 && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-red-300">
                        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                        <span>{importStats.errorCount} linhas apresentaram erro na gravação.</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDownloadReport}
                        className="h-8 text-xs border-red-500/40 text-red-300 hover:bg-red-950/40"
                      >
                        <Download className="w-3.5 h-3.5 mr-1.5" />
                        Baixar Erros (CSV)
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rodapé com Navegação Entre as Etapas */}
        <DialogFooter className="shrink-0 pt-3 border-t border-[#262A33] flex items-center justify-between sm:justify-between w-full">
          {step === 1 && (
            <div className="flex items-center justify-end w-full">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="border-[#262A33] text-gray-300 text-xs h-9"
              >
                Cancelar
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="flex items-center justify-between w-full">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setParsedFile(null)
                  setStep(1)
                }}
                className="border-[#262A33] text-gray-300 text-xs h-9"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                Trocar Arquivo
              </Button>

              <Button
                size="sm"
                onClick={() => setStep(3)}
                disabled={!canProceedToValidation}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold h-9"
              >
                Avançar para Validação
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </div>
          )}

          {step === 3 && (
            <div className="flex items-center justify-between w-full">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep(2)}
                className="border-[#262A33] text-gray-300 text-xs h-9"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                Ajustar Mapeamento
              </Button>

              <Button
                size="sm"
                onClick={handleStartImport}
                disabled={readyToImportCount === 0}
                className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-semibold h-9 shadow-lg shadow-indigo-600/20"
              >
                <Check className="w-3.5 h-3.5 mr-1.5" />
                Confirmar e Criar ({readyToImportCount} Oportunidades)
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </div>
          )}

          {step === 4 && !isImporting && (
            <div className="flex items-center justify-end w-full gap-2">
              <Button
                onClick={() => {
                  handleReset()
                  onOpenChange(false)
                }}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold h-9"
              >
                Concluir e Ver no Kanban
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
