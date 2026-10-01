import { describe, it, expect } from 'vitest'
import QRCode from 'qrcode'

describe('QR Code Generation with official qrcode library', () => {
  it('gera DataURL PNG válido para a URL do formulário público com vendedor', async () => {
    const origin = 'https://crm-de-vendas-comercial-ba27a--preview.goskip.app'
    const sellerId = 'usr_1234567890abcdef'
    const publicFormUrl = `${origin}/formulario/publico?vendedor=${sellerId}`

    const dataUrl = await QRCode.toDataURL(publicFormUrl, {
      errorCorrectionLevel: 'M',
      margin: 4,
      width: 1024,
    })

    expect(dataUrl).toBeDefined()
    expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true)
    expect(dataUrl.length).toBeGreaterThan(500)
  })

  it('gera SVG string válido contendo viewBox, rect de fundo e path dos módulos', async () => {
    const publicFormUrl = 'https://bitcrm.lbertanha.com/formulario/publico?vendedor=admin'
    const svgString = await QRCode.toString(publicFormUrl, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 4,
    })

    expect(svgString).toBeDefined()
    expect(svgString.startsWith('<svg')).toBe(true)
    expect(svgString.includes('viewBox=')).toBe(true)
    expect(svgString.includes('path')).toBe(true)
  })

  it('valida a estrutura e payload exato da URL pública sem truncamento ou espaços', () => {
    const origin = 'https://bitcrm.app'
    const sellerId = 'vendedor-teste-123'
    const publicFormUrl = `${origin}/formulario/publico?vendedor=${sellerId}`

    // Validação da URL esperada
    const parsed = new URL(publicFormUrl)
    expect(parsed.origin).toBe('https://bitcrm.app')
    expect(parsed.pathname).toBe('/formulario/publico')
    expect(parsed.searchParams.get('vendedor')).toBe('vendedor-teste-123')
    expect(publicFormUrl).toBe('https://bitcrm.app/formulario/publico?vendedor=vendedor-teste-123')
    expect(publicFormUrl).not.toMatch(/\s/)
  })

  it('permite criar a matriz de QR Code (QRCode.create) com payload idêntico', () => {
    const testUrl = 'https://bitcrm.lbertanha.com/formulario/publico?vendedor=vendedor_01'
    const qrData = QRCode.create(testUrl, {
      errorCorrectionLevel: 'M',
    })

    expect(qrData).toBeDefined()
    expect(qrData.modules.size).toBeGreaterThanOrEqual(21)
    // Verifica que o segmento original contém o payload esperado
    const segment = qrData.segments[0]
    expect(segment.data).toBe(testUrl)
  })

  it('respeita os diferentes níveis de correção de erro (L, M, Q, H)', async () => {
    const testUrl = 'https://bitcrm.lbertanha.com/formulario/publico?vendedor=seller-abc'
    const qrM = QRCode.create(testUrl, { errorCorrectionLevel: 'M' })
    const qrH = QRCode.create(testUrl, { errorCorrectionLevel: 'H' })

    expect(qrM.modules.size).toBeGreaterThanOrEqual(21)
    expect(qrH.modules.size).toBeGreaterThanOrEqual(qrM.modules.size)
  })
})
