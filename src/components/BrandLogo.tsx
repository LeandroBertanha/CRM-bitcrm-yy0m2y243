import React from 'react'

interface LogoProps {
  className?: string
  showTagline?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export const BrandLogo: React.FC<LogoProps> = ({
  className = '',
  showTagline = false,
  size = 'md',
}) => {
  const iconSize =
    size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-12 h-12 text-base' : 'w-9 h-9 text-sm'
  const titleSize = size === 'sm' ? 'text-base' : size === 'lg' ? 'text-2xl' : 'text-lg'

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Monograma geométrico bit Consulting (Placeholder elegante para futuro logo do cliente) */}
      <div
        className={`${iconSize} rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-blue-600 p-[1px] shadow-lg shadow-indigo-500/20 shrink-0 relative group`}
        title="Placeholder de logo (substituir por logo final anexado pelo cliente)"
      >
        <div className="w-full h-full bg-[#0E1017] rounded-[11px] flex items-center justify-center font-bold tracking-tight text-white transition-colors group-hover:bg-[#141722]">
          <span className="bg-gradient-to-r from-white via-indigo-100 to-indigo-300 bg-clip-text text-transparent">
            bC
          </span>
        </div>
        <div className="absolute -inset-0.5 bg-indigo-500/30 rounded-xl blur-sm -z-10 group-hover:opacity-100 opacity-60 transition-opacity" />
      </div>

      <div className="flex flex-col">
        <div className="flex items-center gap-1.5">
          <span className={`font-bold tracking-tight text-white ${titleSize}`}>
            bit <span className="font-light text-indigo-400">Consulting</span>
          </span>
          <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 tracking-wider">
            CRM
          </span>
        </div>
        {showTagline && (
          <span className="text-xs text-muted-foreground tracking-tight">
            Transformação Estratégica & Comercial
          </span>
        )}
      </div>
      {/* Comentário visual para o cliente: o logo oficial pode ser acoplado aqui */}
    </div>
  )
}
