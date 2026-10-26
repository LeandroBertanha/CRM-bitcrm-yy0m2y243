import { describe, expect, it } from 'vitest'
import { canAccessSdr, SDR_AUTHORIZED_EMAIL } from '@/lib/sdrAccess'

describe('controle de acesso ao SDR Inteligente', () => {
  it('autoriza somente o e-mail proprietário configurado', () => {
    expect(canAccessSdr(SDR_AUTHORIZED_EMAIL)).toBe(true)
    expect(canAccessSdr(' LEANDRO.BERTANHA@LBERTANHA.COM ')).toBe(true)
  })

  it('bloqueia outros usuários e sessões sem e-mail', () => {
    expect(canAccessSdr('outro.admin@lbertanha.com')).toBe(false)
    expect(canAccessSdr('leandro.bertanha@gmail.com')).toBe(false)
    expect(canAccessSdr(undefined)).toBe(false)
    expect(canAccessSdr(null)).toBe(false)
  })
})
