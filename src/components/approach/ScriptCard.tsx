import React, { useState } from 'react'
import { Copy, Check, MessageSquare, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface ScriptCardProps {
  title: string
  situation?: string
  scriptText: string
  instructions?: string
  onCopySuccess?: () => void
  highlight?: boolean
}

export const ScriptCard: React.FC<ScriptCardProps> = ({
  title,
  situation,
  scriptText,
  instructions,
  onCopySuccess,
  highlight = false,
}) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(scriptText)
      setCopied(true)
      if (onCopySuccess) onCopySuccess()
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Falha ao copiar:', err)
    }
  }

  return (
    <div
      className={`rounded-2xl border p-5 transition-all shadow-lg ${
        highlight
          ? 'bg-gradient-to-b from-[#141824] to-[#0F1118] border-indigo-500/40 shadow-indigo-950/20'
          : 'bg-[#12141A] border-[#262A33]'
      }`}
    >
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#262A33]/70">
        <div>
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white tracking-wide uppercase">{title}</h3>
          </div>
          {situation && <p className="text-xs text-gray-400 mt-0.5">{situation}</p>}
        </div>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleCopy}
          className={`h-8 px-3 rounded-xl text-xs border font-medium transition-all ${
            copied
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              : 'bg-[#181B24] border-[#262A33] text-gray-300 hover:text-white hover:bg-[#202430]'
          }`}
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 mr-1 text-emerald-400" />
              Copiado!
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 mr-1" />
              Copiar Script
            </>
          )}
        </Button>
      </div>

      <div className="py-4">
        <p className="text-sm leading-relaxed text-gray-200 whitespace-pre-line font-normal selection:bg-indigo-500/30">
          {scriptText}
        </p>
      </div>

      {instructions && (
        <div className="pt-3 border-t border-[#262A33]/70 flex items-center gap-2 text-xs text-amber-300/90 bg-amber-950/20 p-2.5 rounded-xl border border-amber-900/30">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="font-medium">{instructions}</span>
        </div>
      )}
    </div>
  )
}
