import React from 'react'

export interface BitLogoProps {
  className?: string
  /**
   * 'full': Logo oficial completo com texto "bit", subtítulo "consulting" e o símbolo à direita
   * 'compact': Versão reduzida ideal para navbar/header (mantendo "bit" + símbolo e tag CRM)
   * 'symbol-only': Apenas o símbolo de 3 losangos/paralelogramos
   */
  variant?: 'full' | 'compact' | 'symbol-only'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showTagline?: boolean
  showCrmBadge?: boolean
}

/**
 * Símbolo geométrico oficial da bit Consulting:
 * - Paralelogramo turquesa (#45C4C4) inclinado à esquerda formando o braço esquerdo em diagonal
 * - Losango verde (#3DA639) no topo direito
 * - Losango amarelo/dourado (#E8C34A) no quadrante inferior direito
 */
export const BitSymbol: React.FC<{ className?: string; size?: number | string }> = ({
  className = '',
  size = 48,
}) => {
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      {/* Losango Verde (#3DA639 / #43A93C) - Topo direito */}
      <rect
        x="116"
        y="22"
        width="56"
        height="56"
        rx="12"
        transform="rotate(45 116 22)"
        fill="#43A93C"
      />

      {/* Losango Amarelo (#E8C34A / #EEC852) - Direita inferior */}
      <rect
        x="166"
        y="72"
        width="56"
        height="56"
        rx="12"
        transform="rotate(45 166 72)"
        fill="#E8C34A"
      />

      {/* Paralelogramo / Barra Oblíqua Turquesa (#45C4C4) - Braço principal em diagonal */}
      <rect
        x="78"
        y="58"
        width="54"
        height="124"
        rx="22"
        transform="rotate(45 78 58)"
        fill="#45C4C4"
      />
    </svg>
  )
}

/**
 * Logo oficial completo vetorizado da bit Consulting:
 * Proporções idênticas ao anexo oficial:
 * - Palavra "bit" em minúsculas, arredondada e bold, cor turquesa #45C4C4
 * - Palavra "consulting" logo abaixo, alinhada à esquerda sob o "bit", cor cinza #9E9E9E, tracking estendido
 * - Símbolo de 3 polígonos/losangos à direita (turquesa + verde + amarelo)
 */
export const BitLogoSVG: React.FC<{
  className?: string
  height?: number
  variant?: 'full' | 'compact'
}> = ({ className = '', height = 44, variant = 'full' }) => {
  if (variant === 'compact') {
    // Versão compacta: 240 x 140
    return (
      <svg
        viewBox="0 0 240 140"
        height={height}
        style={{ width: 'auto', height }}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`shrink-0 ${className}`}
      >
        {/* Letra 'b' */}
        <path
          d="M 22 28 C 22 23 26 19 31 19 C 36 19 40 23 40 28 L 40 52 C 45 47 52 44 60 44 C 76 44 87 56 87 73 C 87 90 76 102 60 102 C 52 102 45 99 40 94 L 40 97 C 40 102 36 106 31 106 C 26 106 22 102 22 97 Z M 40 73 C 40 82 46 88 54 88 C 62 88 68 82 68 73 C 68 64 62 58 54 58 C 46 58 40 64 40 73 Z"
          fill="#45C4C4"
        />

        {/* Ponto do 'i' */}
        <circle cx="103" cy="28" r="9.5" fill="#45C4C4" />

        {/* Haste do 'i' */}
        <rect x="94" y="47" width="18" height="57" rx="9" fill="#45C4C4" />

        {/* Letra 't' */}
        <path
          d="M 125 58 L 138 58 L 138 31 C 138 26 142 22 147 22 C 152 22 156 26 156 31 L 156 58 L 169 58 C 174 58 178 62 178 67 C 178 72 174 76 169 76 L 156 76 L 156 84 C 156 90 159 93 165 93 C 168 93 171 92 173 90 C 177 87 182 88 185 92 C 188 96 187 101 183 104 C 178 108 171 110 163 110 C 147 110 138 100 138 85 L 138 76 L 125 76 C 120 76 116 72 116 67 C 116 62 120 58 125 58 Z"
          fill="#45C4C4"
        />

        {/* Símbolo à direita */}
        <g transform="translate(142, 6) scale(0.64)">
          {/* Losango Verde */}
          <rect
            x="84"
            y="12"
            width="40"
            height="40"
            rx="9"
            transform="rotate(45 84 12)"
            fill="#43A93C"
          />
          {/* Losango Amarelo */}
          <rect
            x="120"
            y="48"
            width="40"
            height="40"
            rx="9"
            transform="rotate(45 120 48)"
            fill="#E8C34A"
          />
          {/* Barra Turquesa */}
          <rect
            x="56"
            y="38"
            width="38"
            height="88"
            rx="16"
            transform="rotate(45 56 38)"
            fill="#45C4C4"
          />
        </g>
      </svg>
    )
  }

  // Versão completa: 460 x 200 (proporção idêntica ao anexo original bit consulting)
  return (
    <svg
      viewBox="0 0 460 200"
      height={height}
      style={{ width: 'auto', height }}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
    >
      {/* ============================================================ */}
      {/* 1. PALAVRA "bit" (Turquesa #45C4C4 / #4EC9C9)                  */}
      {/* ============================================================ */}

      {/* Letra 'b' */}
      <path
        d="M 28 28 C 28 21.5 33.5 16 40 16 C 46.5 16 52 21.5 52 28 L 52 54 C 58.5 47 67.5 43 78 43 C 98 43 113 58 113 80 C 113 102 98 117 78 117 C 67.5 117 58.5 113 52 106 L 52 109 C 52 115.5 46.5 121 40 121 C 33.5 121 28 115.5 28 109 Z M 52 80 C 52 91.5 59.5 99 71 99 C 82.5 99 90 91.5 90 80 C 90 68.5 82.5 61 71 61 C 59.5 61 52 68.5 52 80 Z"
        fill="#45C4C4"
      />

      {/* Ponto da letra 'i' */}
      <circle cx="138" cy="27" r="12" fill="#45C4C4" />

      {/* Haste da letra 'i' */}
      <rect x="126" y="47" width="24" height="72" rx="12" fill="#45C4C4" />

      {/* Letra 't' */}
      <path
        d="M 166 60 L 182 60 L 182 32 C 182 25.5 187.5 20 194 20 C 200.5 20 206 25.5 206 32 L 206 60 L 222 60 C 228.5 60 234 65.5 234 72 C 234 78.5 228.5 84 222 84 L 206 84 L 206 94 C 206 102 210 105 218 105 C 221.5 105 225 103.5 227.5 101 C 232.5 97 239.5 98 243.5 103 C 247.5 108 246.5 115 241.5 119 C 235 124 226.5 127 215 127 C 195 127 182 114 182 95 L 182 84 L 166 84 C 159.5 84 154 78.5 154 72 C 154 65.5 159.5 60 166 60 Z"
        fill="#45C4C4"
      />

      {/* ============================================================ */}
      {/* 2. SÍMBOLO À DIREITA                                         */}
      {/* ============================================================ */}
      <g transform="translate(260, 10)">
        {/* Losango Verde (#43A93C / #3DA639) - Topo direito */}
        <rect
          x="108"
          y="18"
          width="52"
          height="52"
          rx="12"
          transform="rotate(45 108 18)"
          fill="#43A93C"
        />

        {/* Losango Amarelo Dourado (#E8C34A) - Direita inferior */}
        <rect
          x="154"
          y="64"
          width="52"
          height="52"
          rx="12"
          transform="rotate(45 154 64)"
          fill="#E8C34A"
        />

        {/* Braço Turquesa (#45C4C4) - Grande paralelogramo inclinado */}
        <rect
          x="72"
          y="52"
          width="50"
          height="114"
          rx="20"
          transform="rotate(45 72 52)"
          fill="#45C4C4"
        />
      </g>

      {/* ============================================================ */}
      {/* 3. PALAVRA "consulting" (Cinza #9E9E9E)                       */}
      {/* ============================================================ */}
      <g fill="#9E9E9E" transform="translate(28, 142)">
        {/* c */}
        <path d="M 27 6 C 24 2 20 0 15 0 C 6 0 0 6 0 16 C 0 26 6 32 15 32 C 20 32 24 30 27 26 C 28.5 24 28 21.5 26 20 C 24 18.5 21.5 19 20 21 C 18.5 23 17 24 15 24 C 10.5 24 7.5 20.5 7.5 16 C 7.5 11.5 10.5 8 15 8 C 17 8 18.5 9 20 11 C 21.5 13 24 13.5 26 12 C 28 10.5 28.5 8 27 6 Z" />

        {/* o */}
        <path
          d="M 49 0 C 40 0 34 6 34 16 C 34 26 40 32 49 32 C 58 32 64 26 64 16 C 64 6 58 0 49 0 Z M 49 24 C 44 24 41.5 20.5 41.5 16 C 41.5 11.5 44 8 49 8 C 54 8 56.5 11.5 56.5 16 C 56.5 20.5 54 24 49 24 Z"
          fillRule="evenodd"
        />

        {/* n */}
        <path d="M 70 2 C 70 0.8 70.8 0 72 0 C 73.2 0 74 0.8 74 2 L 74 5 C 76.5 1.5 80.5 0 85 0 C 93 0 97 5 97 13 L 97 30 C 97 31.2 96.2 32 95 32 C 93.8 32 93 31.2 93 30 L 93 14 C 93 8 90 6 84 6 C 78 6 74 9.5 74 16 L 74 30 C 74 31.2 73.2 32 72 32 C 70.8 32 70 31.2 70 30 Z" />

        {/* s */}
        <path d="M 115 7 C 112 3 108 0 102 0 C 96 0 92 3.5 92 8 C 92 12.5 95 14.5 100 16 L 105 17.5 C 109 18.5 111 20.5 111 23.5 C 111 27.5 107 30 101.5 30 C 96.5 30 92.5 27 90.5 23 C 89.5 21.5 87.5 21 86 22 C 84.5 23 84 25 85 26.5 C 88 31.5 93.5 34 101.5 34 C 110.5 34 116 29 116 23 C 116 18 112 15 106 13.5 L 101 12 C 97.5 11 96 9.5 96 7 C 96 4 99 2.5 103 2.5 C 107 2.5 110 4.5 112 7.5 C 113 9 115 9.5 116.5 8.5 C 118 7.5 118.5 5.5 117.5 4 Z" />

        {/* u */}
        <path d="M 124 2 C 124 0.8 124.8 0 126 0 C 127.2 0 128 0.8 128 2 L 128 17 C 128 23 131.5 26 137.5 26 C 143.5 26 147 22.5 147 16 L 147 2 C 147 0.8 147.8 0 149 0 C 150.2 0 151 0.8 151 2 L 151 17 C 151 25.5 145.5 32 137.5 32 C 129.5 32 124 26 124 17 Z" />

        {/* l */}
        <path d="M 158 2 C 158 0.8 158.8 0 160 0 C 161.2 0 162 0.8 162 2 L 162 30 C 162 31.2 161.2 32 160 32 C 158.8 32 158 31.2 158 30 Z" />

        {/* t */}
        <path d="M 172 4 L 177 4 L 177 1 C 177 0.5 177.5 0 178 0 C 178.5 0 179 0.5 179 1 L 179 4 L 185 4 C 185.5 4 186 4.5 186 5 C 186 5.5 185.5 6 185 6 L 179 6 L 179 23 C 179 26 180.5 27.5 183.5 27.5 C 184.8 27.5 186 27 186.8 26.2 C 187.5 25.5 188.5 25.5 189.2 26.2 C 190 27 190 28 189.2 28.8 C 187.8 30.2 186 31 183.5 31 C 178 31 175 28 175 22 L 175 6 L 172 6 C 171.5 6 171 5.5 171 5 C 171 4.5 171.5 4 172 4 Z" />

        {/* i */}
        <circle cx="196" cy="1" r="2.2" />
        <path d="M 194.5 6 C 194.5 5 195 4.5 196 4.5 C 197 4.5 197.5 5 197.5 6 L 197.5 30 C 197.5 31 197 31.5 196 31.5 C 195 31.5 194.5 31 194.5 30 Z" />

        {/* n */}
        <path d="M 205 6 C 205 5 205.5 4.5 206.5 4.5 C 207.5 4.5 208 5 208 6 L 208 8.5 C 210.5 5.5 214.5 4 219 4 C 227 4 231 9 231 17 L 231 30 C 231 31.2 230.2 32 229 32 C 227.8 32 227 31.2 227 30 L 227 18 C 227 12 224 8 218 8 C 212 8 208 11.5 208 18 L 208 30 C 208 31.2 207.2 32 206 32 C 204.8 32 204 31.2 204 30 Z" />

        {/* g */}
        <path d="M 248 4 C 256.5 4 262 10 262 18 C 262 26 256.5 32 248 32 C 243.5 32 239.5 30 237 26.5 L 237 36 C 237 42 233 46 226 46 C 223 46 220 45 218 43.5 C 216.5 42.5 216 40.5 217 39 C 218 37.5 220 37 221.5 38 C 223 39 224.5 39.5 226 39.5 C 230.5 39.5 233 37 233 33 L 233 6 C 233 5 233.5 4.5 234.5 4.5 C 235.5 4.5 236 5 236 6 L 236 9.5 C 238.5 6 242.5 4 248 4 Z M 247.5 11 C 242 11 237 15 237 21 C 237 27 242 30.5 247.5 30.5 C 253 30.5 257 26.5 257 21 C 257 15.5 253 11 247.5 11 Z" />
      </g>
    </svg>
  )
}

/**
 * Componente principal BrandLogo:
 * Renderiza o logo oficial da bit Consulting nos tamanhos e variantes solicitados.
 */
export const BrandLogo: React.FC<BitLogoProps> = ({
  className = '',
  variant = 'compact',
  size = 'md',
  showTagline = false,
  showCrmBadge = true,
}) => {
  // Ajustes de dimensões
  const heights = {
    sm: variant === 'full' ? 36 : 28,
    md: variant === 'full' ? 46 : 34,
    lg: variant === 'full' ? 62 : 44,
    xl: variant === 'full' ? 84 : 56,
  }

  const height = heights[size]

  if (variant === 'symbol-only') {
    const symbolSizes = { sm: 28, md: 36, lg: 50, xl: 68 }
    return (
      <div className={`inline-flex items-center ${className}`}>
        <BitSymbol size={symbolSizes[size]} />
      </div>
    )
  }

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <div className="relative group flex items-center">
        <BitLogoSVG height={height} variant={variant} />
      </div>

      {showCrmBadge && (
        <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-md bg-teal-500/15 text-teal-300 border border-teal-500/30 tracking-wider ml-0.5 self-center">
          CRM
        </span>
      )}

      {showTagline && (
        <span className="text-xs text-gray-400 tracking-tight hidden sm:inline ml-1 border-l border-gray-700/60 pl-2">
          Transformação Estratégica & Comercial
        </span>
      )}
    </div>
  )
}

export default BrandLogo
