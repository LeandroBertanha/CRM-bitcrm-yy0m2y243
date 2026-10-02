import { describe, it, expect } from 'vitest'
import { CURRENT_TERMS_VERSION, TERMS_OF_SERVICE, PRIVACY_POLICY } from '@/lib/terms-content'

describe('Conteúdo e Regras de Negócio dos Termos e Privacidade', () => {
  it('deve ter versão definida e não vazia', () => {
    expect(CURRENT_TERMS_VERSION).toBe('2025.1')
  })

  it('deve conter as regras específicas de negócio da bit Consulting nos Termos de Serviço', () => {
    const allTermsText = TERMS_OF_SERVICE.flatMap((s) => s.content).join(' ')

    // Valores essenciais: R$ 500,00 e R$ 55,00/mês
    expect(allTermsText).toContain('500,00')
    expect(allTermsText).toContain('55,00')
    expect(allTermsText).toContain('hospedagem')
    expect(allTermsText).toContain('domínio')
    expect(allTermsText).toContain('suporte')

    // Menção ao bitCRM
    expect(allTermsText).toContain('bitCRM')
  })

  it('deve conter diretrizes da LGPD (Lei 13.709/2018) na Política de Privacidade', () => {
    const allPrivacyText = PRIVACY_POLICY.flatMap((s) => s.content).join(' ')

    // LGPD e dados
    expect(allPrivacyText).toContain('13.709/2018')
    expect(allPrivacyText).toContain('LGPD')
    expect(allPrivacyText).toContain('Leandro Bertanha')
    expect(allPrivacyText).toContain('leandro.bertanha@lbertanha.com')
  })
})
