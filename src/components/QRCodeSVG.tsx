import React, { useEffect, useState } from 'react'
import QRCode from 'qrcode'

export type QRCodeCorrectionLevel = 'low' | 'medium' | 'quartile' | 'high' | 'L' | 'M' | 'Q' | 'H'

export interface QRCodeSVGProps {
  value: string
  size?: number
  className?: string
  ecl?: QRCodeCorrectionLevel
  includeMargin?: boolean
}

/**
 * Converte nível de correção curto ou longo para o padrão da biblioteca `qrcode`.
 */
function normalizeEcl(level: QRCodeCorrectionLevel): 'L' | 'M' | 'Q' | 'H' {
  switch (level) {
    case 'low':
      return 'L'
    case 'quartile':
      return 'Q'
    case 'high':
      return 'H'
    case 'medium':
    case 'M':
    case 'L':
    case 'Q':
    case 'H':
    default:
      return (level.toUpperCase() as 'L' | 'M' | 'Q' | 'H') || 'M'
  }
}

/**
 * Componente cliente para renderizar QR Code oficial via pacote `qrcode`.
 * Gera SVG vetorial 100% nítido, com quiet zone (margem) adequada e escaneabilidade garantida por qualquer smartphone.
 */
export const QRCodeSVG: React.FC<QRCodeSVGProps> = ({
  value,
  size = 220,
  className = '',
  ecl = 'M',
  includeMargin = true,
}) => {
  const [svgString, setSvgString] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isCancelled = false
    if (!value) {
      setSvgString('')
      setError(null)
      return
    }

    const marginModules = includeMargin ? 4 : 0
    const errorCorrectionLevel = normalizeEcl(ecl)

    QRCode.toString(value, {
      type: 'svg',
      errorCorrectionLevel,
      margin: marginModules,
      width: size,
      color: {
        dark: '#0A0B0E',
        light: '#FFFFFF',
      },
    })
      .then((rawSvg) => {
        if (!isCancelled) {
          // Ajusta atributos do svg gerado se necessário
          setSvgString(rawSvg)
          setError(null)
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          console.error('Erro ao gerar QR Code via biblioteca qrcode:', err)
          setError('Erro ao gerar QR Code')
        }
      })

    return () => {
      isCancelled = true
    }
  }, [value, size, ecl, includeMargin])

  if (!value || error) {
    return (
      <div
        style={{ width: size, height: size }}
        className="flex items-center justify-center text-xs text-gray-400 bg-gray-100 rounded-lg p-2"
      >
        {error || 'QR Code indisponível'}
      </div>
    )
  }

  if (!svgString) {
    return (
      <div
        style={{ width: size, height: size }}
        className="flex items-center justify-center text-xs text-gray-400 bg-gray-50 rounded-lg animate-pulse"
      >
        Gerando QR Code...
      </div>
    )
  }

  return (
    <div
      className={`select-none flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:block ${className}`}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svgString }}
    />
  )
}
