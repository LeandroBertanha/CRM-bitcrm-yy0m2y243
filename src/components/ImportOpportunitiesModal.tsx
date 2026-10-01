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
import { Checkbox } from '@/components/ui/checkbox'
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
  Sparkles,
  Info,
  Building,
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

  // Etapa atual: 1 = Upload (1 arquivo por vez), 2 = Revisão & Configurações, 3 = Progresso & Resultado
  const [step, setStep] = useState<1 | 2 | 3>(1)

  // Arquivo único carregado e dados estruturados
  const [parsedFile, setParsedFile] = useState<ParsedSheetData | null>(null)
  const [isParsingFile, setIsParsingFile] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)

  // Mapeamento automático de colunas do arquivo
  const [mapping, setMapping] = useState<Record<string, OppTargetField>>({})

  // Configurações da Importação
  const [assignedSellerId, setAssignedSellerId] = useState<string>(currentUserId || '')
  const [defaultStage, setDefaultStage] = useState<Opportunity['stage']>('Novo')
  const [defaultSource, setDefaultSource] = useState<Opportunity['source']>('Prospecção')
  const [defaultValue, setDefaultValue] = useState<string>('500')
  const [skipDuplicates, setSkipDuplicates] = useState<boolean>(true)

  // Opção de abrir detalhes avançados de mapeamento manual (colunas)
  const [showAdvancedMapping, setShowAdvancedMapping] = useState<boolean>(false)

  // Progresso de importação
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

  // Disparar processamento se vier arquivo arrastado da tela principal
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
    setShowAdvancedMapping(false)
    setIsDragOver(false)
    setImportStats({
      total: 0,
      successCount: 0,
      skippedDuplicatesCount: 0,
      errorCount: 0,
      errors: [],
    })
  }

  // Processador de UM único arquivo (se outro for enviado, substitui o anterior)
  const processIncomingFile = async (file: File) => {
    if (!file) return

    setIsParsingFile(true)
    try {
      const parsedSheets = await parseSpreadsheetFile(file)
      if (!parsedSheets || parsedSheets.length === 0) {
        throw new Error('Não conseguimos ler este arquivo. Tente XLSX, CSV ou TXT.')
      }

      const activeSheet = parsedSheets[0]
      if (activeSheet.rows.length === 0) {
        throw new Error('O arquivo selecionado não contém linhas com dados.')
      }

      // Mapeamento automático silencioso
      const autoMapping = guessInitialFileMappings(activeSheet.headers, activeSheet.rows)

      setParsedFile(activeSheet)
      setMapping(autoMapping)
      setStep(2)
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

  // Manipulador de input change (seleção manual: pega sempre files[0])
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      await processIncomingFile(files[0])
    }
  }

  // Drag & drop handlers seguros para a dropzone do modal
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
      // Pega o primeiro arquivo solto (substitui o anterior caso já existisse)
      await processIncomingFile(e.dataTransfer.files[0])
    }
  }

  // Atualizar campo de mapeamento manual nas opções avançadas
  const handleUpdateMapping = (header: string, targetField: OppTargetField) => {
    setMapping((prev) => ({
      ...prev,
      [header]: targetField,
    }))
  }

  // Converter dados do arquivo parseado conforme os mapeamentos
  const processedLeads: ProcessedLeadItem[] = useMemo(() => {
    if (!parsedFile) return []

    const result: ProcessedLeadItem[] = []
    const seenInBatch = new Set<string>()

    // Criar mapa de oportunidades já existentes no banco
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
      let rowStage: Opportunity['stage'] | undefined = undefined
      let rowValue: number | undefined = undefined
      let rowSource: Opportunity['source'] | undefined = undefined
      const notesList: string[] = []

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
          case 'message':
            messageText = val
            break
          case 'website':
            notesList.push(`Site próprio: ${val}`)
            break
          case 'source_ref': {
            notesList.push(`Fonte/validação: ${val}`)
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
          case 'stage': {
            if (!rowStage) {
              const stageMatch = normalizeStageValue(val)
              if (stageMatch) rowStage = stageMatch
            }
            break
          }
          case 'value': {
            if (rowValue === undefined) {
              const parsed = parseCurrencyValue(val)
              if (parsed !== null && parsed > 0) rowValue = parsed
            }
            break
          }
          default:
            break
        }
      })

      // Se a empresa ainda estiver vazia mas tiver nome de contato, use-o
      if (!company && contact_name) {
        company = contact_name
      }

      // Se mesmo assim continuar sem empresa, ignorar linha vazia
      if (!company) return

      // Montar mensagem completa combinando mensagem e notas
      let fullMessage = messageText
      if (notesList.length > 0) {
        const notesCombined = notesList.join(' | ')
        fullMessage = fullMessage ? `${fullMessage}\n[Info: ${notesCombined}]` : notesCombined
      }

      // Checar duplicatas contra o banco e contra o lote
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
        duplicateReason = 'Telefone já cadastrado'
      } else if (
        !pKey &&
        cKey &&
        cKey.length >= 5 &&
        (existingKeys.has(`c:${cKey}`) || seenInBatch.has(`c:${cKey}`))
      ) {
        isDuplicate = true
        duplicateReason = 'Empresa com mesmo nome (sem telefone)'
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
        notesList,
        fullMessage,
        isDuplicate,
        duplicateReason,
        sourceFile: parsedFile.fileName,
      })
    })

    return result
  }, [parsedFile, mapping, existingOpportunities])

  const totalDuplicates = useMemo(() => {
    return processedLeads.filter((l) => l.isDuplicate).length
  }, [processedLeads])

  const readyToImportCount = useMemo(() => {
    if (skipDuplicates) {
      return processedLeads.filter((l) => !l.isDuplicate).length
    }
    return processedLeads.length
  }, [processedLeads, skipDuplicates])

  // Validação para prosseguir
  const canProceedToImport = useMemo(() => {
    if (!parsedFile) return false
    return Object.values(mapping).includes('company')
  }, [parsedFile, mapping])

  // Iniciar Importação em Lote via PocketBase (pool concorrente controlado)
  const handleStartImport = async () => {
    setStep(3)
    setIsImporting(true)
    setImportProgress(0)

    const leadsToImport = skipDuplicates
      ? processedLeads.filter((l) => !l.isDuplicate)
      : processedLeads

    const skippedDuplicatesCount = processedLeads.filter((l) => l.isDuplicate).length

    const fallbackNumericValue = parseFloat(defaultValue.replace(',', '.')) || 500
    const finalSellerId =
      assignedSellerId ||
      currentUserId ||
      sellersList.find((s) => s.email.toLowerCase() === 'leandro.bertanha@lbertanha.com')?.id ||
      ''

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
        title: 'Nenhum lead a importar',
        description: 'Todos os registros foram pulados por serem duplicados.',
      })
      onSuccess()
      return
    }

    const buildPayload = (lead: ProcessedLeadItem) => ({
      company: lead.company,
      stage: defaultStage, // Estágio padrão da importação continua "Novo" (ou o que o usuário escolher)
      source: lead.source || defaultSource,
      value: lead.value !== undefined ? lead.value : fallbackNumericValue,
      seller: finalSellerId || null,
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

    const CONCURRENCY = 5
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
      description: `${successCount} oportunidades importadas com sucesso para o pipeline.`,
    })

    onSuccess()
  }

  // Baixar relatório de erros em CSV
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
    link.setAttribute('download', `relatorio_importacao_${Date.now()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

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
      <DialogContent className="bg-[#12141A] border-[#262A33] text-white max-w-2xl rounded-2xl shadow-2xl p-6 max-h-[90vh] flex flex-col">
        {/* Cabeçalho do Modal */}
        <DialogHeader className="shrink-0 pb-3 border-b border-[#262A33]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                  Importar Planilha de Oportunidades
                  <span className="text-[11px] font-semibold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                    1 arquivo por vez
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs text-gray-400 mt-0.5">
                  Importe contatos e listas diretamente para o funil do bitCRM
                </DialogDescription>
              </div>
            </div>

            {/* Stepper simples 3 etapas */}
            <div className="hidden sm:flex items-center gap-2 text-xs">
              {[
                { s: 1, label: '1. Arquivo' },
                { s: 2, label: '2. Confirmação' },
                { s: 3, label: '3. Conclusão' },
              ].map((item) => (
                <div key={item.s} className="flex items-center gap-1.5">
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
                    className={`text-[11px] font-medium ${
                      step === item.s ? 'text-white' : 'text-gray-500'
                    }`}
                  >
                    {item.label}
                  </span>
                  {item.s < 3 && <span className="text-gray-700">›</span>}
                </div>
              ))}
            </div>
          </div>
        </DialogHeader>

        {/* Conteúdo Dinâmico */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 custom-scrollbar">
          {/* ========================================================================= */}
          {/* ETAPA 1: ARRASTAR OU SELECIONAR UM ARQUIVO (SINGLE FILE, SEM MÚLTIPLOS) */}
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
                {/* Input estritamente single file (sem atributo multiple) */}
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
                      ? 'Lendo planilha e mapeando colunas...'
                      : isDragOver
                        ? 'Solte o arquivo aqui para iniciar a importação'
                        : 'Clique para escolher ou arraste UM arquivo aqui'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Formatos suportados: <strong className="text-gray-400">.xlsx</strong>,{' '}
                    <strong className="text-gray-400">.xls</strong>,{' '}
                    <strong className="text-gray-400">.ods</strong>,{' '}
                    <strong className="text-gray-400">.csv</strong>,{' '}
                    <strong className="text-gray-400">.tsv</strong>,{' '}
                    <strong className="text-gray-400">.txt</strong> e{' '}
                    <strong className="text-gray-400">.json</strong>
                  </p>
                </div>

                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#181B24] border border-[#262A33] text-[11px] text-gray-400">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  Importe um arquivo de cada vez com detecção automática silenciosa
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#0E1017] border border-[#262A33] flex items-start gap-3">
                <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <div className="text-xs text-gray-400 space-y-1">
                  <p className="font-semibold text-gray-300">Como funciona a importação:</p>
                  <ul className="list-disc pl-4 space-y-0.5 text-gray-400">
                    <li>Envie um arquivo por vez para manter o controle total do seu lote.</li>
                    <li>Se você soltar outro arquivo, ele substitui o anterior imediatamente.</li>
                    <li>
                      Colunas de Empresa, Telefone, Cidade e Mensagem são mapeadas automaticamente.
                    </li>
                    <li>
                      Estágio inicial padrão: <strong>Novo</strong> (pode ser alterado na revisão).
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ETAPA 2: CONFIRMAÇÃO / REVISÃO RESUMIDA E CONFIGURAÇÕES */}
          {/* ========================================================================= */}
          {step === 2 && parsedFile && (
            <div className="space-y-4">
              {/* Arquivo ativo */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#0E1017] border border-[#262A33]">
                <div className="flex items-center gap-2.5 truncate">
                  <FileSpreadsheet className="w-4 h-4 text-indigo-400 shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-white block truncate">
                      {parsedFile.fileName}
                    </span>
                    <span className="text-[11px] text-gray-400">
                      Aba: {parsedFile.sheetName} &bull; {parsedFile.rows.length} registros
                    </span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="border-[#262A33] text-gray-300 hover:text-white text-xs h-8"
                >
                  Substituir Arquivo
                </Button>
                {/* Input oculto para substituição de arquivo */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.ods,.csv,.tsv,.txt,.json"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {/* Cards de Resumo */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 bg-[#0E1017] border border-[#262A33] rounded-xl">
                  <span className="text-[11px] text-gray-400 block">Total de Leads</span>
                  <span className="text-xl font-bold text-white tabular-nums">
                    {processedLeads.length}
                  </span>
                  <span className="text-[10px] text-gray-500 block mt-0.5">
                    Identificados na planilha
                  </span>
                </div>

                <div className="p-3.5 bg-[#0E1017] border border-[#262A33] rounded-xl">
                  <span className="text-[11px] text-gray-400 block">Duplicados</span>
                  <span
                    className={`text-xl font-bold tabular-nums ${
                      totalDuplicates > 0 ? 'text-amber-400' : 'text-emerald-400'
                    }`}
                  >
                    {totalDuplicates}
                  </span>
                  <span className="text-[10px] text-gray-500 block mt-0.5">
                    Já cadastrados no sistema
                  </span>
                </div>

                <div className="p-3.5 bg-[#0E1017] border border-indigo-500/30 bg-indigo-600/5 rounded-xl">
                  <span className="text-[11px] text-indigo-300 block">Prontos para Criar</span>
                  <span className="text-xl font-bold text-indigo-400 tabular-nums">
                    {readyToImportCount}
                  </span>
                  <span className="text-[10px] text-indigo-300/70 block mt-0.5">
                    {skipDuplicates ? 'Duplicados serão pulados' : 'Incluindo duplicados'}
                  </span>
                </div>
              </div>

              {/* Configurações Padrão */}
              <div className="p-4 bg-[#0E1017] border border-[#262A33] rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Building className="w-3.5 h-3.5 text-indigo-400" />
                    Configurações do Lote
                  </h4>
                  <span className="text-[11px] text-gray-400">Definições para os novos cards</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-300">Vendedor Responsável</Label>
                    <Select value={assignedSellerId} onValueChange={setAssignedSellerId}>
                      <SelectTrigger className="bg-[#12141A] border-[#262A33] text-white text-xs h-9 rounded-xl">
                        <SelectValue placeholder="Selecione o vendedor" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#12141A] border-[#262A33] text-white text-xs">
                        {sellersList.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name || s.email} {s.email === currentUserEmail ? '(Você)' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-300">
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
                    <Label className="text-xs text-gray-300">Estágio Inicial</Label>
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
                    <Label className="text-xs text-gray-300">Origem Padrão</Label>
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

                {/* Checkbox de deduplicação */}
                <div className="pt-2 border-t border-[#262A33] flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <Checkbox
                      id="skipDuplicates"
                      checked={skipDuplicates}
                      onCheckedChange={(checked) => setSkipDuplicates(Boolean(checked))}
                      className="data-[state=checked]:bg-indigo-600 border-[#3A4050]"
                    />
                    <label
                      htmlFor="skipDuplicates"
                      className="text-xs text-gray-300 cursor-pointer select-none leading-none"
                    >
                      Pular registros duplicados automaticamente (recomendado)
                    </label>
                  </div>
                  {totalDuplicates > 0 && (
                    <span className="text-[11px] text-amber-400 font-medium">
                      {totalDuplicates} {totalDuplicates === 1 ? 'duplicata' : 'duplicatas'} a pular
                    </span>
                  )}
                </div>
              </div>

              {/* Amostra dos registros mapeados */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-400 block">
                    Prévia dos contatos ({processedLeads.length} identificados):
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAdvancedMapping(!showAdvancedMapping)}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors underline decoration-dotted"
                  >
                    {showAdvancedMapping
                      ? 'Ocultar ajuste avançado de colunas'
                      : 'Ver ou ajustar mapeamento de colunas'}
                  </button>
                </div>

                <div className="border border-[#262A33] rounded-xl overflow-hidden bg-[#0E1017] divide-y divide-[#262A33]/70 max-h-[160px] overflow-y-auto custom-scrollbar">
                  {processedLeads.slice(0, 10).map((lead, idx) => (
                    <div key={idx} className="p-2.5 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-[10px] text-gray-500 font-mono w-6">#{idx + 1}</span>
                        <span className="font-bold text-white truncate">{lead.company}</span>
                        {lead.contact_phone && (
                          <span className="text-[10px] text-indigo-300 font-mono bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                            {lead.contact_phone}
                          </span>
                        )}
                        {lead.city && (
                          <span className="text-[10px] text-gray-400 bg-[#181B24] px-1.5 py-0.5 rounded border border-[#262A33]">
                            {lead.city}
                          </span>
                        )}
                      </div>
                      <div>
                        {lead.isDuplicate ? (
                          <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                            Duplicado
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            Pronto
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {processedLeads.length > 10 && (
                    <div className="p-2 text-center text-[11px] text-gray-500">
                      + {processedLeads.length - 10} outros contatos prontos para importar
                    </div>
                  )}
                </div>
              </div>

              {/* Ajuste avançado de colunas (caso o usuário expanda) */}
              {showAdvancedMapping && (
                <div className="p-3 bg-[#0A0C11] border border-[#262A33] rounded-xl space-y-3">
                  <span className="text-xs font-bold text-indigo-300 block">
                    Mapeamento das Colunas ({parsedFile.fileName})
                  </span>
                  <div className="divide-y divide-[#262A33]/70 max-h-[180px] overflow-y-auto custom-scrollbar">
                    {parsedFile.headers.map((header) => {
                      const currentMapped = mapping[header] || 'ignore'
                      const sampleValue = parsedFile.rows[0]?.[header] || '—'

                      return (
                        <div
                          key={header}
                          className="grid grid-cols-12 gap-2 py-2 items-center text-xs"
                        >
                          <div className="col-span-5 text-gray-200 font-medium truncate">
                            {header}
                          </div>
                          <div className="col-span-4 text-gray-500 font-mono text-[10px] truncate">
                            {sampleValue}
                          </div>
                          <div className="col-span-3">
                            <Select
                              value={currentMapped}
                              onValueChange={(val) =>
                                handleUpdateMapping(header, val as OppTargetField)
                              }
                            >
                              <SelectTrigger className="h-7 text-[11px] bg-[#12141A] border-[#262A33] text-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-[#12141A] border-[#262A33] text-white text-xs">
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
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* ETAPA 3: PROGRESSO & RESULTADO FINAL */}
          {/* ========================================================================= */}
          {step === 3 && (
            <div className="space-y-5 py-4">
              {isImporting ? (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 mx-auto flex items-center justify-center text-indigo-400 animate-pulse">
                    <Loader2 className="w-8 h-8 animate-spin" />
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-white">Importando Oportunidades...</h3>
                    <p className="text-xs text-gray-400 mt-1">
                      Processando item {currentImportIndex} de {readyToImportCount}
                    </p>
                  </div>

                  <div className="max-w-md mx-auto space-y-2">
                    <Progress value={importProgress} className="h-3 bg-[#181B24]" />
                    <span className="text-xs font-mono text-indigo-400 tabular-nums">
                      {importProgress}%
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-2">
                    <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                    <h3 className="text-base font-bold text-white">
                      Importação Concluída com Sucesso!
                    </h3>
                    <p className="text-xs text-gray-300">
                      As novas oportunidades já estão disponíveis no kanban de vendas.
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 bg-[#0E1017] border border-[#262A33] rounded-xl">
                      <span className="text-xs text-gray-400 block">Importadas</span>
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
                      <span className="text-xs text-gray-400 block">Erros</span>
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
                        <span>{importStats.errorCount} registros não puderam ser importados.</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDownloadReport}
                        className="h-8 text-xs border-red-500/40 text-red-300 hover:bg-red-950/40"
                      >
                        <Download className="w-3.5 h-3.5 mr-1.5" />
                        Baixar Relatório
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rodapé com Navegação */}
        <DialogFooter className="shrink-0 pt-3 border-t border-[#262A33] flex items-center justify-between sm:justify-between w-full">
          {step === 1 && (
            <div className="flex items-center justify-end w-full">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="border-[#262A33] text-gray-300 text-xs"
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
                className="border-[#262A33] text-gray-300 text-xs"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                Trocar Arquivo
              </Button>

              <Button
                size="sm"
                onClick={handleStartImport}
                disabled={readyToImportCount === 0 || !canProceedToImport}
                className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                Confirmar e Importar ({readyToImportCount} Oportunidades)
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </div>
          )}

          {step === 3 && !isImporting && (
            <div className="flex items-center justify-end w-full gap-2">
              <Button
                onClick={() => {
                  handleReset()
                  onOpenChange(false)
                }}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
              >
                Concluir
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
