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
}

export function ImportOpportunitiesModal({
  open,
  onOpenChange,
  onSuccess,
  currentUserEmail,
  currentUserId,
  existingOpportunities,
  sellersList,
}: ImportOpportunitiesModalProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Etapa atual: 1 = Upload, 2 = Mapeamento, 3 = Confirmação, 4 = Importação & Conclusão
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)

  // Arquivos carregados e dados brutos
  const [parsedFiles, setParsedFiles] = useState<ParsedSheetData[]>([])
  const [selectedFileIdx, setSelectedFileIdx] = useState<number>(0)
  const [isParsingFiles, setIsParsingFiles] = useState(false)

  // Mapeamento de colunas por arquivo: { [fileIndex]: { [headerName]: OppTargetField } }
  const [mappings, setMappings] = useState<Record<number, Record<string, OppTargetField>>>({})

  // Configurações da Importação
  const [assignedSellerId, setAssignedSellerId] = useState<string>(currentUserId || '')
  const [defaultStage, setDefaultStage] = useState<Opportunity['stage']>('Novo')
  const [defaultSource, setDefaultSource] = useState<Opportunity['source']>('Prospecção')
  const [defaultValue, setDefaultValue] = useState<string>('500')
  const [skipDuplicates, setSkipDuplicates] = useState<boolean>(true)

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
    setImportStats({
      total: 0,
      successCount: 0,
      skippedDuplicatesCount: 0,
      errorCount: 0,
      errors: [],
    })
  }

  // Manipulador de upload universal (XLSX/XLS/ODS/CSV/TSV/TXT/JSON)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsParsingFiles(true)
    const newParsedList: ParsedSheetData[] = []
    const newMappings: Record<number, Record<string, OppTargetField>> = {}
    const parseErrors: string[] = []

    try {
      for (let i = 0; i < files.length; i++) {
        try {
          const parsedSheets = await parseSpreadsheetFile(files[i])

          parsedSheets.forEach((parsedItem) => {
            const fileIndex = newParsedList.length
            newParsedList.push(parsedItem)
            // Criar mapeamento inicial automático adaptativo
            newMappings[fileIndex] = guessInitialFileMappings(parsedItem.headers, parsedItem.rows)
          })
        } catch (err) {
          console.error(`Erro ao ler o arquivo ${files[i].name}:`, err)
          const msg = err instanceof Error ? err.message : 'Não conseguimos ler este arquivo.'
          parseErrors.push(`${files[i].name}: ${msg}`)
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
      setStep(2) // Avançar para etapa de mapeamento
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

  // Atualizar campo de mapeamento
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
    for (const opp of existingOpportunities) {
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
        const cKey = normalizeCompanyKey(company)
        const pKey = normalizePhoneKey(contact_phone)
        let isDuplicate = false
        let duplicateReason = ''

        if (
          cKey &&
          pKey &&
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
          cKey &&
          cKey.length >= 4 &&
          (existingKeys.has(`c:${cKey}`) || seenInBatch.has(`c:${cKey}`))
        ) {
          isDuplicate = true
          duplicateReason = 'Empresa com nome idêntico'
        }

        // Marcar no lote
        if (cKey) seenInBatch.add(`c:${cKey}`)
        if (pKey) seenInBatch.add(`p:${pKey}`)
        if (cKey && pKey) seenInBatch.add(`cp:${cKey}_${pKey}`)

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

  // Iniciar Importação em Lote via API do PocketBase
  const handleStartImport = async () => {
    setStep(4)
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

    for (let i = 0; i < total; i++) {
      setCurrentImportIndex(i + 1)
      const lead = leadsToImport[i]

      try {
        await pb.collection('opportunities').create({
          company: lead.company,
          stage: lead.stage || defaultStage,
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

      setImportProgress(Math.round(((i + 1) / total) * 100))
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

            {/* Stepper de progresso */}
            <div className="hidden sm:flex items-center gap-2 text-xs">
              {[
                { s: 1, label: 'Upload' },
                { s: 2, label: 'Mapeamento' },
                { s: 3, label: 'Revisão' },
                { s: 4, label: 'Conclusão' },
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
                  {item.s < 4 && <span className="text-gray-700">›</span>}
                </div>
              ))}
            </div>
          </div>
        </DialogHeader>

        {/* Conteúdo Dinâmico por Etapa */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 custom-scrollbar">
          {/* ========================================================================= */}
          {/* ETAPA 1: UPLOAD DOS ARQUIVOS */}
          {/* ========================================================================= */}
          {step === 1 && (
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#2E3342] hover:border-indigo-500/70 bg-[#0E1017] hover:bg-[#12141F] rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 group flex flex-col items-center justify-center space-y-3"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.ods,.csv,.tsv,.txt,.json"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 group-hover:scale-105 group-hover:bg-indigo-600/20 transition-all flex items-center justify-center text-indigo-400">
                  {isParsingFiles ? (
                    <Loader2 className="w-7 h-7 animate-spin" />
                  ) : (
                    <UploadCloud className="w-7 h-7" />
                  )}
                </div>

                <div>
                  <p className="text-sm font-semibold text-white group-hover:text-indigo-300 transition-colors">
                    {isParsingFiles
                      ? 'Processando arquivos...'
                      : 'Clique para selecionar planilhas ou arraste aqui'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Suporta <strong className="text-gray-400">.XLSX</strong>,{' '}
                    <strong className="text-gray-400">.XLS</strong>,{' '}
                    <strong className="text-gray-400">.ODS</strong>,{' '}
                    <strong className="text-gray-400">.CSV</strong>,{' '}
                    <strong className="text-gray-400">.TSV</strong>,{' '}
                    <strong className="text-gray-400">.TXT</strong> e{' '}
                    <strong className="text-gray-400">.JSON</strong> (você pode selecionar mais de
                    um)
                  </p>
                </div>

                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#181B24] border border-[#262A33] text-[11px] text-gray-400">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  Reconhecimento automático de qualquer formato de lista
                </div>
              </div>

              {/* Informações de boas práticas */}
              <div className="p-3.5 rounded-xl bg-[#0E1017] border border-[#262A33] flex items-start gap-3">
                <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <div className="text-xs text-gray-400 space-y-1">
                  <p className="font-semibold text-gray-300">
                    Como funciona o processo de importação:
                  </p>
                  <ul className="list-disc pl-4 space-y-0.5 text-gray-400">
                    <li>O navegador lê o arquivo diretamente em memória com total segurança.</li>
                    <li>
                      O sistema reconhece automaticamente o formato, o separador e a linha de
                      cabeçalho — mesmo em planilhas sem títulos padronizados.
                    </li>
                    <li>
                      As colunas são mapeadas para os campos da oportunidade e podem ser ajustadas
                      manualmente.
                    </li>
                    <li>
                      Contatos duplicados podem ser ignorados automaticamente por telefone ou nome
                      de empresa.
                    </li>
                    <li>
                      Os leads são criados com valor padrão de R$ 500,00 e atribuídos ao seu
                      usuário.
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ETAPA 2: MAPEAMENTO DE COLUNAS */}
          {/* ========================================================================= */}
          {step === 2 && parsedFiles.length > 0 && (
            <div className="space-y-4">
              {/* Seletor de Arquivos caso haja mais de 1 */}
              {parsedFiles.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {parsedFiles.map((file, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedFileIdx(idx)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all ${
                        selectedFileIdx === idx
                          ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300'
                          : 'bg-[#0E1017] border-[#262A33] text-gray-400 hover:text-white'
                      }`}
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span className="truncate max-w-[200px]">{file.fileName}</span>
                      <span className="text-[10px] bg-[#181B24] px-1.5 py-0.2 rounded-full text-gray-400">
                        {file.rows.length}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Informação do arquivo ativo */}
              {parsedFiles[selectedFileIdx] && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-[#0E1017] border border-[#262A33]">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-indigo-400" />
                      <span className="text-xs font-bold text-white">
                        {parsedFiles[selectedFileIdx].fileName}
                      </span>
                      <span className="text-[11px] text-gray-400">
                        ({parsedFiles[selectedFileIdx].sheetName})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {!parsedFiles[selectedFileIdx].hasDetectedHeader && (
                        <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Sem cabeçalho — colunas inferidas pelo conteúdo
                        </span>
                      )}
                      <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                        {parsedFiles[selectedFileIdx].rows.length} registros detectados
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-gray-400">
                    Revise o mapeamento das colunas da planilha para os campos do CRM:
                  </p>

                  {/* Tabela de Mapeamento */}
                  <div className="border border-[#262A33] rounded-xl overflow-hidden bg-[#0E1017]">
                    <div className="grid grid-cols-12 gap-2 p-2.5 bg-[#181B24] text-[11px] font-bold text-gray-300 border-b border-[#262A33]">
                      <div className="col-span-5">Coluna da Planilha</div>
                      <div className="col-span-4">Exemplo da 1ª Linha</div>
                      <div className="col-span-3">Campo no CRM</div>
                    </div>

                    <div className="divide-y divide-[#262A33]/70 max-h-[320px] overflow-y-auto custom-scrollbar">
                      {parsedFiles[selectedFileIdx].headers.map((header) => {
                        const currentMapped = mappings[selectedFileIdx]?.[header] || 'ignore'
                        const sampleValue = parsedFiles[selectedFileIdx].rows[0]?.[header] || '—'

                        return (
                          <div
                            key={header}
                            className="grid grid-cols-12 gap-2 p-2.5 items-center text-xs hover:bg-[#12141A]/50 transition-colors"
                          >
                            <div className="col-span-5 font-medium text-white flex items-center gap-1.5 truncate">
                              <span className="truncate">{header}</span>
                            </div>

                            <div className="col-span-4 text-gray-400 truncate text-[11px] font-mono bg-[#12141A] px-2 py-1 rounded border border-[#262A33]/50">
                              {sampleValue}
                            </div>

                            <div className="col-span-3">
                              <Select
                                value={currentMapped}
                                onValueChange={(val) =>
                                  handleUpdateMapping(
                                    selectedFileIdx,
                                    header,
                                    val as OppTargetField,
                                  )
                                }
                              >
                                <SelectTrigger
                                  className={`h-8 text-xs rounded-lg ${
                                    currentMapped === 'company'
                                      ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300 font-semibold'
                                      : currentMapped !== 'ignore'
                                        ? 'bg-[#181B24] border-[#2E3342] text-white'
                                        : 'bg-[#12141A] border-[#262A33] text-gray-500'
                                  }`}
                                >
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

                  {!canProceedToConfirmation && (
                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>
                        É necessário mapear pelo menos uma coluna como{' '}
                        <strong>Empresa / Título da Oportunidade</strong>.
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* ETAPA 3: REVISÃO & CONFIGURAÇÕES DE IMPORTAÇÃO */}
          {/* ========================================================================= */}
          {step === 3 && (
            <div className="space-y-4">
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
                  <span className="text-[11px] text-gray-400 block">Duplicatas Detectadas</span>
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
                    {skipDuplicates ? 'Duplicatas serão ignoradas' : 'Incluindo duplicatas'}
                  </span>
                </div>
              </div>

              {/* Opções de Importação */}
              <div className="p-4 bg-[#0E1017] border border-[#262A33] rounded-xl space-y-4">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Building className="w-3.5 h-3.5 text-indigo-400" />
                  Parâmetros Padrão das Novas Oportunidades
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-300">Responsável (Vendedor / Admin)</Label>
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

                <div className="pt-2 flex items-center gap-2 text-[11px] text-gray-500">
                  <Wand2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span>
                    Se a planilha tiver colunas de Estágio, Valor ou Origem, cada lead usará o valor
                    da própria linha; caso contrário, os padrões acima.
                  </span>
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
                    <span className="text-[11px] text-amber-400">
                      {totalDuplicates}{' '}
                      {totalDuplicates === 1
                        ? 'duplicata será ignorada'
                        : 'duplicatas serão ignoradas'}
                    </span>
                  )}
                </div>
              </div>

              {/* Preview dos Primeiros Leads */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-gray-400 block">
                  Prévia dos primeiros leads a serem importados:
                </span>
                <div className="border border-[#262A33] rounded-xl overflow-hidden bg-[#0E1017] divide-y divide-[#262A33]/70 max-h-[180px] overflow-y-auto custom-scrollbar">
                  {processedLeads.slice(0, 5).map((lead, idx) => (
                    <div key={idx} className="p-2.5 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 truncate">
                        <span className="font-bold text-white truncate">{lead.company}</span>
                        {lead.city && (
                          <span className="text-[10px] text-gray-400 bg-[#181B24] px-1.5 py-0.5 rounded border border-[#262A33]">
                            {lead.city}
                          </span>
                        )}
                        {lead.contact_phone && (
                          <span className="text-[10px] text-gray-400 font-mono">
                            {lead.contact_phone}
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
                            Novo
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ETAPA 4: IMPORTAÇÃO EM PROGRESSO & RELATÓRIO FINAL */}
          {/* ========================================================================= */}
          {step === 4 && (
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

        {/* Rodapé com Navegação dos Passos */}
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
                onClick={() => setStep(1)}
                className="border-[#262A33] text-gray-300 text-xs"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                Voltar
              </Button>

              <Button
                size="sm"
                onClick={() => setStep(3)}
                disabled={!canProceedToConfirmation}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
              >
                Avançar para Revisão
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
                className="border-[#262A33] text-gray-300 text-xs"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                Ajustar Mapeamento
              </Button>

              <Button
                size="sm"
                onClick={handleStartImport}
                disabled={readyToImportCount === 0}
                className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                Importar {readyToImportCount} Oportunidades
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
