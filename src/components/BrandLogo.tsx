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
  // Aumentado generosamente conforme solicitação ("Aumente o Logo") mantendo proporção original do webp
  // Mapeamento de alturas padronizadas e responsivas:
  // - No mobile: inicia em tamanhos proporcionais (ex: h-8 a h-11 no compact, h-10 a h-14 no full)
  // - No desktop: escala progressivamente mantendo o logo GRANDE (h-14, h-16, h-20/h-28)
  // - max-w-full e max-w-[min(...)] evitam estouro e sobreposição
  const heights = {
    sm: variant === 'compact' ? 'h-8 sm:h-10 md:h-11' : 'h-10 sm:h-12 md:h-14',
    md: variant === 'compact' ? 'h-9 sm:h-11 md:h-13' : 'h-12 sm:h-14 md:h-18',
    lg: variant === 'compact' ? 'h-9 sm:h-12 md:h-15 lg:h-16' : 'h-14 sm:h-18 md:h-22 lg:h-24',
    xl: variant === 'compact' ? 'h-10 sm:h-14 md:h-18 lg:h-20' : 'h-14 sm:h-20 md:h-24 lg:h-32',
  }

  // Largura máxima protetiva para nunca estourar containers em mobile
  const maxWidths = {
    sm: variant === 'compact' ? 'max-w-[120px] sm:max-w-[160px]' : 'max-w-[150px] sm:max-w-[200px]',
    md: variant === 'compact' ? 'max-w-[150px] sm:max-w-[200px]' : 'max-w-[180px] sm:max-w-[240px]',
    lg:
      variant === 'compact'
        ? 'max-w-[160px] sm:max-w-[230px] md:max-w-none'
        : 'max-w-[min(220px,65vw)] sm:max-w-[320px] md:max-w-none',
    xl:
      variant === 'compact'
        ? 'max-w-[180px] sm:max-w-[260px] md:max-w-none'
        : 'max-w-[min(240px,70vw)] sm:max-w-[340px] md:max-w-none',
  }

  const heightClass = heights[size] || heights.md
  const maxWidthClass = maxWidths[size] || maxWidths.md

  return (
    <div className={`inline-flex items-center gap-2 sm:gap-3 select-none max-w-full ${className}`}>
      <img
        src={bitLogoUrl}
        alt="bit Consulting"
        className={`${heightClass} ${maxWidthClass} w-auto object-contain shrink-0`}
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
