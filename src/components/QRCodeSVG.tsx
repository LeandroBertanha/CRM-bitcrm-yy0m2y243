import React, { useMemo } from 'react'
import { generateQRCode, ErrorCorrectionLevel } from '@/lib/qrcode'

export interface QRCodeSVGProps {
  value: string
  size?: number
  className?: string
  ecl?: ErrorCorrectionLevel
  includeMargin?: boolean
}

/**
 * Componente cliente para renderizar QR Code real compatível com ISO/IEC 18004.
 * Gera SVG vetorial 100% nítido e escaneável por qualquer câmera de smartphone.
 */
export const QRCodeSVG: React.FC<QRCodeSVGProps> = ({
  value,
  size = 200,
  className = '',
  ecl = 'M',
  includeMargin = true,
}) => {
  const qr = useMemo(() => {
    if (!value) return null
    try {
      return generateQRCode(value, ecl)
    } catch (err) {
      console.error('Erro ao gerar matriz de QR Code:', err)
      return null
    }
  }, [value, ecl])

  if (!qr) {
    return (
      <div
        style={{ width: size, height: size }}
        className="flex items-center justify-center text-xs text-gray-400 bg-gray-100 rounded-lg p-2"
      >
        QR Code indisponível
      </div>
    )
  }

  const margin = includeMargin ? 2 : 0
  const matrixSize = qr.size
  const totalSize = matrixSize + margin * 2

  // Cria caminho SVG otimizado (path) para todos os módulos escuros
  let path = ''
  for (let r = 0; r < matrixSize; r++) {
    for (let c = 0; c < matrixSize; c++) {
      if (qr.isDark(r, c)) {
        const x = c + margin
        const y = r + margin
        path += `M${x},${y}h1v1h-1z `
      }
    }
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${totalSize} ${totalSize}`}
      shapeRendering="crispEdges"
      className={`select-none ${className}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width={totalSize} height={totalSize} fill="#FFFFFF" />
      <path d={path} fill="#0A0B0E" />
    </svg>
  )
}
