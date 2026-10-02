import React from 'react'
import { HelpCircle, ChevronRight, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { PlaybookQuestion, PlaybookAnswer } from '@/types/playbook'

export interface QuestionCardProps {
  question: PlaybookQuestion | null
  possibleAnswers: PlaybookAnswer[]
  onSelectAnswer: (answer: PlaybookAnswer) => void
  onNextQuestion: () => void
  questionNumber?: number
  totalQuestions?: number
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  possibleAnswers,
  onSelectAnswer,
  onNextQuestion,
  questionNumber = 1,
  totalQuestions = 6,
}) => {
  if (!question) {
    return (
      <div className="rounded-2xl border border-[#262A33] bg-[#12141A] p-6 text-center">
        <HelpCircle className="w-8 h-8 text-indigo-400 mx-auto mb-2 opacity-50" />
        <p className="text-sm text-gray-300 font-semibold">
          Todas as perguntas principais foram realizadas
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Avance para o fechamento, apresentação de valores ou agendamento de retorno.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-b from-[#131622] to-[#0E1017] p-5 shadow-xl relative overflow-hidden">
      <div className="flex items-center justify-between pb-3 border-b border-[#262A33]">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <HelpCircle className="w-4 h-4" />
          </span>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300">
              Pergunta Sugerida Agora
            </span>
            <span className="text-[11px] text-gray-500 ml-2">
              (Etapa {questionNumber} de {totalQuestions})
            </span>
          </div>
        </div>

        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onNextQuestion}
          className="text-xs text-gray-400 hover:text-white hover:bg-[#1A1D27] h-8 px-2.5 rounded-xl"
        >
          Pular para a próxima
          <ChevronRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      </div>

      {/* Texto da Pergunta em Destaque */}
      <div className="py-4">
        <p className="text-lg sm:text-xl font-bold text-white tracking-tight leading-snug">
          &quot;{question.text}&quot;
        </p>
        {question.category && (
          <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
            Foco: {question.category}
          </span>
        )}
      </div>

      {/* Respostas Possíveis (Botões Grandes) */}
      <div className="pt-3 border-t border-[#262A33]">
        <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">
          Respostas Possíveis do Cliente (clique para direcionar o roteiro):
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {possibleAnswers.map((ans) => (
            <button
              key={ans.id || ans.answer_text}
              type="button"
              onClick={() => onSelectAnswer(ans)}
              className="text-left p-3.5 rounded-xl bg-[#171A24] border border-[#262A33] hover:border-indigo-500/70 hover:bg-[#1E2333] transition-all group flex items-center justify-between gap-2 shadow-sm"
            >
              <div className="min-w-0">
                <span className="text-xs font-semibold text-gray-200 group-hover:text-white block truncate">
                  {ans.answer_text}
                </span>
                {ans.resulting_action && (
                  <span className="text-[10px] text-gray-500 group-hover:text-indigo-300 block truncate mt-0.5">
                    {ans.resulting_action}
                  </span>
                )}
              </div>
              <CheckCircle2 className="w-4 h-4 text-gray-500 group-hover:text-indigo-400 shrink-0 transition-colors" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
