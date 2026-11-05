import { describe, expect, it } from 'vitest'
import { getUserInitials } from '@/lib/userInitials'

describe('getUserInitials', () => {
  it('gera LB para o perfil principal', () => {
    expect(getUserInitials('Leandro Bertanha', 'leandro.bertanha@lbertanha.com')).toBe('LB')
  })

  it('ignora espaços excedentes no nome', () => {
    expect(getUserInitials('  Leandro   Bertanha  ')).toBe('LB')
  })

  it('usa o e-mail quando o nome não está disponível', () => {
    expect(getUserInitials('', 'leandro.bertanha@lbertanha.com')).toBe('LE')
  })

  it('usa a marca como fallback seguro', () => {
    expect(getUserInitials()).toBe('BC')
  })
})
