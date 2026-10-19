import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { ThemeToggle } from '@/components/ThemeToggle'
import { getNextTheme, THEME_STORAGE_KEY } from '@/lib/theme'

vi.mock('next-themes', () => ({
  useTheme: () => ({
    resolvedTheme: 'dark',
    setTheme: vi.fn(),
  }),
}))

describe('preferencia de tema do bitCRM', () => {
  it('alterna somente entre os modos claro e escuro', () => {
    expect(getNextTheme('dark')).toBe('light')
    expect(getNextTheme('light')).toBe('dark')
    expect(getNextTheme()).toBe('light')
  })

  it('usa uma chave persistente exclusiva do bitCRM', () => {
    expect(THEME_STORAGE_KEY).toBe('bitcrm-theme')
  })

  it('oferece as duas escolhas de aparencia de forma acessivel', () => {
    const html = renderToStaticMarkup(<ThemeToggle variant="segmented" />)

    expect(html).toContain('Modo Claro')
    expect(html).toContain('Modo Escuro')
    expect(html).toContain('aria-label="Escolha do tema do bitCRM"')
  })
})
