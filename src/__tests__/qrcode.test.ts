import { describe, it, expect } from 'vitest'
import { generateQRCode } from '../lib/qrcode'

describe('QR Code ISO/IEC 18004 Generator', () => {
  it('gera matriz para URL curta com dimensões corretas', () => {
    const qr = generateQRCode('https://bitcrm.lbertanha.com')
    expect(qr.size).toBeGreaterThanOrEqual(21)
    const matrix = qr.toMatrix()
    expect(matrix.length).toBe(qr.size)
    expect(matrix[0].length).toBe(qr.size)
  })

  it('gera matriz para URL longa de formulário com vendedor ID', () => {
    const url =
      'https://crm-de-vendas-comercial-ba27a--preview.goskip.app/formulario/publico?vendedor=usr_1234567890abcdef'
    const qr = generateQRCode(url)
    expect(qr.size).toBeGreaterThanOrEqual(25)
    expect(typeof qr.isDark(0, 0)).toBe('boolean')
    // Canto superior esquerdo deve conter finder pattern (0,0 é escuro)
    expect(qr.isDark(0, 0)).toBe(true)
    expect(qr.isDark(0, 6)).toBe(true)
    expect(qr.isDark(6, 0)).toBe(true)
    expect(qr.isDark(6, 6)).toBe(true)
    expect(qr.isDark(1, 1)).toBe(false)
  })

  it('suporta diferentes níveis de correção de erro', () => {
    const data = 'https://bitcrm.lbertanha.com/formulario/publico'
    const qrL = generateQRCode(data, 'L')
    const qrH = generateQRCode(data, 'H')
    // Nível H requer mais capacidade de dados, portanto tamanho >= L
    expect(qrH.size).toBeGreaterThanOrEqual(qrL.size)
  })
})
