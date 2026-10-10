import type { RecordModel } from 'pocketbase'

export type ApproachChannel = 'Telefone' | 'Presencial' | 'WhatsApp' | 'Reunião' | 'Retorno'

export type ApproachStatus =
  | 'Não abordado'
  | 'Tentativa de contato'
  | 'Contato realizado'
  | 'Diagnóstico realizado'
  | 'Interessado'
  | 'Exemplos enviados'
  | 'Reunião agendada'
  | 'Retorno agendado'
  | 'Proposta solicitada'
  | 'Proposta enviada'
  | 'Negociação'
  | 'Fechado'
  | 'Sem interesse'
  | 'Perdido'

export type LeadTemperature = 'frio' | 'morno' | 'quente'

export type DigitalSituation =
  | 'Não possui site'
  | 'Utiliza somente Instagram'
  | 'Utiliza somente WhatsApp'
  | 'Possui site antigo'
  | 'Possui site insatisfatório'
  | 'Possui site e quer melhorar'
  | 'Não sabemos ainda'

export interface PlaybookSegment extends RecordModel {
  name: string
  is_active: boolean
  display_order: number
}

export interface PlaybookScript extends RecordModel {
  channel: ApproachChannel
  situation?: string
  title: string
  script_text: string
  instructions?: string
  product?: string
  product_name?: string
  display_order: number
  is_active: boolean
}

export interface PlaybookQuestion extends RecordModel {
  type: 'diagnóstico' | 'qualificação' | 'fluxo'
  text: string
  category?: string
  triggers?: string
  product?: string
  product_name?: string
  display_order: number
  is_active: boolean
}

export interface PlaybookAnswer extends RecordModel {
  question?: string
  question_pattern?: string
  answer_text: string
  resulting_action?: string
  recommended_argument?: string
  next_suggested_question?: string
  display_order: number
}

export interface ObjectionSubScenario {
  scenario: string
  script: string
}

export interface PlaybookObjection extends RecordModel {
  name: string
  clarification_question?: string
  treatment_script: string
  sub_scenarios?: ObjectionSubScenario[]
  product?: string
  product_name?: string
  display_order: number
  is_active: boolean
}

export interface PlaybookArgument extends RecordModel {
  situation: string
  argument_text: string
  product?: string
  product_name?: string
  display_order: number
  is_active: boolean
}

export interface PlaybookValues extends RecordModel {
  title: string
  creation_value: number
  monthly_value: number
  inclusions?: string[]
  script: string
  closing_questions?: string[]
  product?: string
  product_name?: string
  is_active: boolean
}

export interface PlaybookNextStep extends RecordModel {
  action: string
  description: string
  trigger_condition?: string
  product?: string
  product_name?: string
  display_order: number
  is_active: boolean
}

export interface AnswerLogItem {
  question: string
  answer: string
  timestamp: string
  recommendedArgument?: string
}

export interface ObjectionLogItem {
  name: string
  clarificationQuestion?: string
  chosenSubScenario?: string
  timestamp: string
}

export interface ApproachSession extends RecordModel {
  opportunity?: string
  seller: string
  company_name?: string
  contact_name?: string
  contact_phone?: string
  city?: string
  channel: ApproachChannel
  segment?: string
  digital_situation?: DigitalSituation | string
  status: ApproachStatus
  temperature?: LeadTemperature
  temperature_reason?: string
  needs?: string
  interests?: string
  decision_maker?: string
  deadline?: string
  budget?: string
  next_action?: string
  next_contact_at?: string | null
  questions_asked?: string[]
  answers?: AnswerLogItem[]
  objections?: ObjectionLogItem[]
  quick_tags?: string[]
  notes?: string
  expand?: {
    seller?: {
      id: string
      name?: string
      email?: string
    }
    opportunity?: {
      id: string
      company: string
      stage: string
      value?: number
      contact_phone?: string
      city?: string
    }
  }
}

export interface PersonalizedPitchData {
  abertura: string
  pergunta1: string
  pergunta2: string
  pitch: string
  argumento: string
  possivelObjecao: {
    objecao: string
    clarificacao: string
    argumento: string
  }
  proximoPasso: string
}

export interface PlaybookBundle {
  segments: PlaybookSegment[]
  scripts: PlaybookScript[]
  questions: PlaybookQuestion[]
  answers: PlaybookAnswer[]
  objections: PlaybookObjection[]
  argumentsList: PlaybookArgument[]
  valuesConfig: PlaybookValues | null
  valuesList?: PlaybookValues[]
  nextSteps: PlaybookNextStep[]
}
