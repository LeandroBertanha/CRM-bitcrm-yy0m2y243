import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
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

  it('mantem os ajustes de contraste restritos ao modo claro', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/main.css'), 'utf8')

    expect(css).toContain(".light [class*='bg-rose-950']")
    expect(css).toContain(".light [class*='bg-amber-950']")
    expect(css).toContain(".light [class*='bg-indigo-950']")
    expect(css).toContain(".light [class*='bg-emerald-950']")
    expect(css).not.toMatch(/(^|\n)\.dark \[class\*='bg-(rose|amber|indigo|emerald)-950'/)
  })

  it('garante contraste nos filtros e controles legados do modo claro', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/main.css'), 'utf8')

    expect(css).toContain(".light [role='combobox']")
    expect(css).toContain(".light [role='listbox']")
    expect(css).toContain(".light [role='option']")
    expect(css).toContain(".light [class*='bg-white/10']")
    expect(css).toContain(".light [class*='bg-slate-800']")
    expect(css).toContain(".light [class*='text-blue-300']")
    expect(css).toContain(".light [class*='text-cyan-300']")
    expect(css).toContain(".light [class*='border-blue-7']")
    expect(css).toContain("[class~='text-white']")
    expect(css).not.toContain("[class*='text-white']")
    expect(css).toContain('color: #172033 !important;')
    expect(css).not.toMatch(/(^|\n)\.dark \[role='(combobox|listbox|option)'\]/)
  })
})
