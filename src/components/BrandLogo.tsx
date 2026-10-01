import React from 'react'
import bitLogoUrl from '@/assets/logobit-0184e.webp'

export interface BitLogoProps {
  className?: string
  /**
   * 'full': Logo oficial completo com a imagem original enviada
   * 'compact': Versão para header / navbar (altura proporcional limpa)
   * 'symbol-only': Versão compacta para ícones reduzidos
   */
  variant?: 'full' | 'compact' | 'symbol-only'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showTagline?: boolean
  showCrmBadge?: boolean
}

/**
 * Componente oficial BrandLogo da bit Consulting:
 * Utiliza o arquivo original fornecido pelo usuário (logobit-0184e.webp),
 * com fidelidade absoluta de proporção, tipografia e cores,
 * sem nenhuma recriação artesanal em SVG.
 */
export const BrandLogo: React.FC<BitLogoProps> = ({
  className = '',
  variant = 'compact',
  size = 'md',
  showTagline = false,
  showCrmBadge = false,
}) => {
  // Mapeamento de alturas padronizadas (a largura se ajusta automaticamente com w-auto para nunca distorcer)
  const heights = {
    sm: variant === 'compact' ? 'h-6 sm:h-7' : 'h-8',
    md: variant === 'compact' ? 'h-7 sm:h-8' : 'h-10 sm:h-11',
    lg: variant === 'compact' ? 'h-9 sm:h-10' : 'h-12 sm:h-14',
    xl: variant === 'compact' ? 'h-11 sm:h-12' : 'h-14 sm:h-16',
  }

  const heightClass = heights[size] || heights.md

  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      <img
        src={bitLogoUrl}
        alt="bit Consulting"
        className={`${heightClass} w-auto object-contain shrink-0`}
        loading="eager"
        decoding="async"
      />

      {showCrmBadge && (
        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-teal-500/15 text-teal-300 border border-teal-500/30 tracking-wider self-center">
          CRM
        </span>
      )}

      {showTagline && (
        <span className="text-xs text-gray-400 tracking-tight hidden sm:inline ml-1 border-l border-gray-700/60 pl-2.5">
          Transformação Estratégica & Comercial
        </span>
      )}
    </div>
  )
}

export default BrandLogo
