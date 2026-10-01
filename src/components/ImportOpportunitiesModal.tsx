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
  XCircle,
  ArrowRight,
  ArrowLeft,
  Download,
  Loader2,
  Sparkles,
  Info,
  Building,
  Phone,
  MapPin,
  FileText,
  User,
  Trash2,
  Wand2,
} from 'lucide-react'

export interface ImportOpportunitiesModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  currentUserEmail?: string
  currentUserId?: string
  existingOpportunities: Opportunity[]
  sellersList: { id: string; name?: string; email: string }[]
  initialDroppedFiles?: File[] | null
  onClearInitialDroppedFiles?: () => void
}

export function ImportOpportunitiesModal({
  open,
  onOpenChange,
  onSuccess,
  currentUserEmail,
  currentUserId,
  existingOpportunities,
  sellersList,
  initialDroppedFiles,
  onClearInitialDroppedFiles,
}: ImportOpportunitiesModalProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Etapa atual: 1 = Upload, 2 = Revisão Resumida & Configurações, 3 = Importação & Conclusão
  const [step, setStep] = useState<1 | 2 | 3>(1)

  // Arquivos carregados e dados brutos
  const [parsedFiles, setParsedFiles] = useState<ParsedSheetData[]>([])
  const [isParsingFiles, setIsParsingFiles] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)

  // Disparar processamento se vierem arquivos arrastados da tela principal
  React.useEffect(() => {
    if (open && initialDroppedFiles && initialDroppedFiles.length > 0) {
      processIncomingFiles(initialDroppedFiles)
      onClearInitialDroppedFiles?.()
    }
  }, [open, initialDroppedFiles])

  // Mapeamento de colunas por arquivo: { [fileIndex]: { [headerName]: OppTargetField } }
  const [mappings, setMappings] = useState<Record<number, Record<string, OppTargetField>>>({})

  // Configurações da Importação (Padrões solicitados pelo usuário)
  const [assignedSellerId, setAssignedSellerId] = useState<string>(currentUserId || '')
  const [defaultStage, setDefaultStage] = useState<Opportunity['stage']>('Novo')
  const [defaultSource, setDefaultSource] = useState<Opportunity['source']>('Prospecção')
  const [defaultValue, setDefaultValue] = useState<string>('500')
  const [skipDuplicates, setSkipDuplicates] = useState<boolean>(true)

  // Opção de abrir detalhes avançados de mapeamento (caso o usuário queira expandir)
  const [showAdvancedMapping, setShowAdvancedMapping] = useState<boolean>(false)
  const [selectedFileIdx, setSelectedFileIdx] = useState<number>(0)

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

  // Limpa tudo ao fechar
  const handleReset = () => {
    setStep(1)
    setParsedFiles([])
    setSelectedFileIdx(0)
    setMappings({})
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

  // Processador universal de arquivos (File[] ou FileList)
  const processIncomingFiles = async (filesList: FileList | File[]) => {
    const filesArray = Array.from(filesList)
    if (filesArray.length === 0) return

    setIsParsingFiles(true)
    const newParsedList: ParsedSheetData[] = []
    const newMappings: Record<number, Record<string, OppTargetField>> = {}
    const parseErrors: string[] = []

    try {
      for (let i = 0; i < filesArray.length; i++) {
        const file = filesArray[i]
        try {
          const parsedSheets = await parseSpreadsheetFile(file)

          parsedSheets.forEach((parsedItem) => {
            const fileIndex = newParsedList.length
            newParsedList.push(parsedItem)
            // Criar mapeamento inicial automático inteligente em segundo plano
            newMappings[fileIndex] = guessInitialFileMappings(parsedItem.headers, parsedItem.rows)
          })
        } catch (err) {
          console.error(`Erro ao ler o arquivo ${file.name}:`, err)
          const msg = err instanceof Error ? err.message : 'Não conseguimos ler este arquivo.'
          parseErrors.push(`${file.name}: ${msg}`)
        }
      }

      if (newParsedList.length === 0) {
        toast({
          title: 'Erro na leitura do arquivo',
          description:
            parseErrors.length > 0
              ? parseErrors.join('\n')
              : 'Não conseguimos ler este arquivo. Tente XLSX, CSV ou TXT.',
          variant: 'destructive',
        })
        return
      }

      if (parseErrors.length > 0) {
        toast({
          title: 'Alguns arquivos não puderam ser lidos',
          description: parseErrors.join('\n'),
          variant: 'destructive',
        })
      }

      setParsedFiles(newParsedList)
      setMappings(newMappings)
      setSelectedFileIdx(0)
      // Direto para Etapa 2: Confirmação / Revisão Resumida (pulando a etapa de mapeamento obrigatória)
      setStep(2)
    } catch (err) {
      console.error('Erro ao ler arquivos:', err)
      toast({
        title: 'Erro na leitura do arquivo',
        description: 'Não conseguimos ler este arquivo. Tente XLSX, CSV ou TXT.',
        variant: 'destructive',
      })
    } finally {
      setIsParsingFiles(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Manipulador de input change (seleção manual)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      await processIncomingFiles(e.target.files)
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
    // Apenas se sair do container alvo
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setIsDragOver(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processIncomingFiles(e.dataTransfer.files)
    }
  }

  // Atualizar campo de mapeamento manual se aberto nas opções avançadas
  const handleUpdateMapping = (fileIdx: number, header: string, targetField: OppTargetField) => {
    setMappings((prev) => ({
      ...prev,
      [fileIdx]: {
        ...(prev[fileIdx] || {}),
        [header]: targetField,
      },
    }))
  }

  // Converter todos os dados dos arquivos parseados conforme os mapeamentos
  const processedLeads: ProcessedLeadItem[] = useMemo(() => {
    if (parsedFiles.length === 0) return []

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

    parsedFiles.forEach((fileData, fileIdx) => {
      const fileMap = mappings[fileIdx] || {}

      fileData.rows.forEach((row) => {
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

          const mappedTarget = fileMap[colHeader] || 'ignore'
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
        // REGRA SEGURA:
        // 1. Se tiver telefone válido (>= 8 dígitos), deduplica se o mesmo telefone já existir no banco/lote.
        // 2. Se tiver empresa E telefone, deduplica pelo par.
        // 3. Se NÃO tiver telefone, deduplica apenas se o nome da empresa for suficientemente longo e idêntico.
        // NUNCA descartar empresas diferentes que apenas compartilham termos comuns.
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
          sourceFile: fileData.fileName,
        })
      })
    })

    return result
  }, [parsedFiles, mappings, existingOpportunities])

  const totalDuplicates = useMemo(() => {
    return processedLeads.filter((l) => l.isDuplicate).length
  }, [processedLeads])

  const readyToImportCount = useMemo(() => {
    if (skipDuplicates) {
      return processedLeads.filter((l) => !l.isDuplicate).length
    }
    return processedLeads.length
  }, [processedLeads, skipDuplicates])

  // Iniciar Importação em Lote via API do PocketBase otimizada (pb.createBatch + fallback concorrente)
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

    // Preparar payload de cada oportunidade: respeita a opção de estágio escolhida na Etapa 2 do modal
    const buildPayload = (lead: ProcessedLeadItem) => ({
      company: lead.company,
      stage: defaultStage, // A escolha da Etapa 2 define o estágio para todo o lote importado (padrão "Novo")
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

    // Função de criação individual para ser usada diretamente ou como fallback granular
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

    // Criamos as oportunidades uma a uma em paralelo controlado (pool concorrente de 5 requisições).
    // Isto evita abortar dezenas de leads caso um registro individual falhe (como ocorreria com createBatch transacional)
    // e garante que TODOS os registros válidos entrem com relatório preciso.
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

  // Baixar relatório simples em CSV dos resultados da importação
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

  // Validação para avançar do Mapeamento para Confirmação
  const canProceedToConfirmation = useMemo(() => {
    if (parsedFiles.length === 0) return false
    // Cada arquivo deve ter ao menos a coluna de empresa mapeada
    return parsedFiles.every((_, idx) => {
      const fileMap = mappings[idx] || {}
      return Object.values(fileMap).includes('company')
    })
  }, [parsedFiles, mappings])

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
      <DialogContent className="bg-[#12141A] border-[#262A33] text-white max-w-3xl rounded-2xl shadow-2xl p-6 max-h-[90vh] flex flex-col">
        {/* Cabeçalho do Modal */}
        <DialogHeader className="shrink-0 pb-3 border-b border-[#262A33]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                  Importar Oportunidades de Planilhas
                  <span className="text-[11px] font-semibold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                    XLSX / CSV / TXT / JSON
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs text-gray-400 mt-0.5">
                  Importe listas de prospecção diretamente para o pipeline do bitCRM
                </DialogDescription>
              </div>
            </div>

            {/* Stepper de progresso simplificado: 1 Upload -> 2 Revisão & Confirmação -> 3 Conclusão */}
            <div className="hidden sm:flex items-center gap-2 text-xs">
              {[
                { s: 1, label: '1. Upload' },
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

        {/* Conteúdo Dinâmico por Etapa */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 custom-scrollbar">
          {/* ========================================================================= */}
          {/* ETAPA 1: UPLOAD DOS ARQUIVOS (COM DROPZONE ATIVA) */}
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
                  multiple
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
                  {isParsingFiles ? (
                    <Loader2 className="w-7 h-7 animate-spin" />
                  ) : (
                    <UploadCloud className="w-7 h-7" />
                  )}
                </div>

                <div>
                  <p className="text-sm font-semibold text-white group-hover:text-indigo-300 transition-colors">
                    {isParsingFiles
                      ? 'Processando planilhas e mapeando dados silenciosamente...'
                      : isDragOver
                        ? 'Solte o arquivo de planilha aqui para carregar'
                        : 'Clique para selecionar ou arraste sua planilha aqui'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Suporta <strong className="text-gray-400">.XLSX</strong>,{' '}
                    <strong className="text-gray-400">.XLS</strong>,{' '}
                    <strong className="text-gray-400">.ODS</strong>,{' '}
                    <strong className="text-gray-400">.CSV</strong>,{' '}
                    <strong className="text-gray-400">.TSV</strong>,{' '}
                    <strong className="text-gray-400">.TXT</strong> e{' '}
                    <strong className="text-gray-400">.JSON</strong>
                  </p>
                </div>

                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#181B24] border border-[#262A33] text-[11px] text-gray-400">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  Mapeamento inteligente instantâneo sem telas desnecessárias
                </div>
              </div>

              {/* Informações resumidas */}
              <div className="p-3.5 rounded-xl bg-[#0E1017] border border-[#262A33] flex items-start gap-3">
                <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <div className="text-xs text-gray-400 space-y-1">
                  <p className="font-semibold text-gray-300">Importação direta e inteligente:</p>
                  <ul className="list-disc pl-4 space-y-0.5 text-gray-400">
                    <li>
                      O bitCRM detecta automaticamente colunas de empresa, telefone, cidade e
                      observações.
                    </li>
                    <li>
                      Colunas de numeração sequencial (#, Nº, Linha) e links fixos do WhatsApp são
                      desconsiderados automaticamente.
                    </li>
                    <li>
                      Contatos duplicados por telefone ou nome são identificados e prevenidos.
                    </li>
                    <li>
                      Configurações padrão: Vendedor Admin, Estágio Novo, Origem Prospecção e R$
                      500,00 por lead.
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ETAPA 2: REVISÃO RESUMIDA & CONFIGURAÇÕES (NOVO FLUXO DIRETO) */}
          {/* ========================================================================= */}
          {step === 2 && parsedFiles.length > 0 && (
            <div className="space-y-4">
              {/* Arquivos detectados com total de registros */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-gray-400 block">
                  Arquivos detectados e registros:
                </span>
                <div className="space-y-2">
                  {parsedFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-xl bg-[#0E1017] border border-[#262A33]"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <FileSpreadsheet className="w-4 h-4 text-indigo-400 shrink-0" />
                        <span className="text-xs font-bold text-white truncate">
                          {file.fileName}
                        </span>
                        <span className="text-[11px] text-gray-400 hidden sm:inline">
                          ({file.sheetName})
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                          {file.rows.length} registros detectados
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cards de Resumo */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 bg-[#0E1017] border border-[#262A33] rounded-xl">
                  <span className="text-[11px] text-gray-400 block">Total Identificado</span>
                  <span className="text-xl font-bold text-white tabular-nums">
                    {processedLeads.length} leads
                  </span>
                  <span className="text-[10px] text-gray-500 block mt-0.5">
                    De {parsedFiles.length} {parsedFiles.length === 1 ? 'arquivo' : 'arquivos'}
                  </span>
                </div>

                <div className="p-3.5 bg-[#0E1017] border border-[#262A33] rounded-xl">
                  <span className="text-[11px] text-gray-400 block">Duplicatas Encontradas</span>
                  <span
                    className={`text-xl font-bold tabular-nums ${
                      totalDuplicates > 0 ? 'text-amber-400' : 'text-emerald-400'
                    }`}
                  >
                    {totalDuplicates}
                  </span>
                  <span className="text-[10px] text-gray-500 block mt-0.5">
                    Nome ou telefone coincidente
                  </span>
                </div>

                <div className="p-3.5 bg-[#0E1017] border border-indigo-500/30 bg-indigo-600/5 rounded-xl">
                  <span className="text-[11px] text-indigo-300 block">Prontos para Importar</span>
                  <span className="text-xl font-bold text-indigo-400 tabular-nums">
                    {readyToImportCount} leads
                  </span>
                  <span className="text-[10px] text-indigo-300/70 block mt-0.5">
                    {skipDuplicates ? 'Duplicatas serão puladas' : 'Incluindo duplicatas'}
                  </span>
                </div>
              </div>

              {/* Opções de Importação com Valores Padrão */}
              <div className="p-4 bg-[#0E1017] border border-[#262A33] rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Building className="w-3.5 h-3.5 text-indigo-400" />
                    Configurações Padrão de Importação
                  </h4>
                  <span className="text-[11px] text-gray-400">Ajuste se necessário</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-300">Responsável (Admin / Vendedor)</Label>
                    <Select value={assignedSellerId} onValueChange={setAssignedSellerId}>
                      <SelectTrigger className="bg-[#12141A] border-[#262A33] text-white text-xs h-9 rounded-xl">
                        <SelectValue placeholder="Selecione o responsável" />
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
                    <Label className="text-xs text-gray-300">Valor da Proposta (R$)</Label>
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
                    <Label className="text-xs text-gray-300">Origem do Lead</Label>
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

                {/* Tratamento de Duplicatas */}
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
                      {totalDuplicates}{' '}
                      {totalDuplicates === 1 ? 'duplicata será pulada' : 'duplicatas serão puladas'}
                    </span>
                  )}
                </div>
              </div>

              {/* Resumo detalhado por arquivo e amostra dos registros mapeados */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-400 block">
                    Amostra dos registros mapeados ({processedLeads.length} no total):
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAdvancedMapping(!showAdvancedMapping)}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors underline decoration-dotted"
                  >
                    {showAdvancedMapping
                      ? 'Ocultar ajuste avançado de colunas'
                      : 'Personalizar colunas manualmente'}
                  </button>
                </div>

                <div className="border border-[#262A33] rounded-xl overflow-hidden bg-[#0E1017] divide-y divide-[#262A33]/70 max-h-[180px] overflow-y-auto custom-scrollbar">
                  {processedLeads.map((lead, idx) => (
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
                            Duplicado ({lead.duplicateReason})
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            Pronto para criar
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Se o usuário desejar abrir o ajuste avançado de mapeamento */}
              {showAdvancedMapping && parsedFiles[selectedFileIdx] && (
                <div className="p-3 bg-[#0A0C11] border border-[#262A33] rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-300">
                      Mapeamento das Colunas ({parsedFiles[selectedFileIdx].fileName})
                    </span>
                    {parsedFiles.length > 1 && (
                      <div className="flex items-center gap-1">
                        {parsedFiles.map((f, fIdx) => (
                          <button
                            key={fIdx}
                            onClick={() => setSelectedFileIdx(fIdx)}
                            className={`px-2 py-0.5 text-[10px] rounded font-semibold ${
                              selectedFileIdx === fIdx
                                ? 'bg-indigo-600 text-white'
                                : 'bg-[#181B24] text-gray-400'
                            }`}
                          >
                            {f.fileName}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="divide-y divide-[#262A33]/70 max-h-[200px] overflow-y-auto custom-scrollbar">
                    {parsedFiles[selectedFileIdx].headers.map((header) => {
                      const currentMapped = mappings[selectedFileIdx]?.[header] || 'ignore'
                      const sampleValue = parsedFiles[selectedFileIdx].rows[0]?.[header] || '—'

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
                                handleUpdateMapping(selectedFileIdx, header, val as OppTargetField)
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
          {/* ETAPA 3: IMPORTAÇÃO EM PROGRESSO & RELATÓRIO FINAL */}
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
                  {/* Conclusão */}
                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-2">
                    <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                    <h3 className="text-base font-bold text-white">
                      Importação Concluída com Sucesso!
                    </h3>
                    <p className="text-xs text-gray-300">
                      As oportunidades foram criadas e já constam no funil de vendas comercial.
                    </p>
                  </div>

                  {/* Estatísticas Finais */}
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

                  {/* Se houver erros, permitir download de relatório */}
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

        {/* Rodapé com Navegação dos Passos (Novo fluxo 3 etapas) */}
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
                  setParsedFiles([])
                  setStep(1)
                }}
                className="border-[#262A33] text-gray-300 text-xs"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                Trocar Arquivos
              </Button>

              <Button
                size="sm"
                onClick={handleStartImport}
                disabled={readyToImportCount === 0 || !canProceedToConfirmation}
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
