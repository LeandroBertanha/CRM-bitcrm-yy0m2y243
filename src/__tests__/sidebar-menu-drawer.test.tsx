import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Layout from '@/components/Layout'

// Mock useAuth
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: {
      id: 'usr_test',
      name: 'Leandro Bertanha',
      email: 'leandro.bertanha@lbertanha.com',
      role: 'admin',
    },
    isAdmin: true,
    signOut: vi.fn(),
    isLoading: false,
  }),
}))

// Mock useRealtime
vi.mock('@/hooks/use-realtime', () => ({
  __esModule: true,
  default: vi.fn(),
  useRealtime: vi.fn(),
}))

// Mock PocketBase client
vi.mock('@/lib/pocketbase/client', () => ({
  __esModule: true,
  default: {
    collection: () => ({
      getFullList: vi.fn().mockResolvedValue([]),
    }),
  },
  pb: {
    collection: () => ({
      getFullList: vi.fn().mockResolvedValue([]),
    }),
  },
}))

describe('Layout do Drawer de Menu Lateral (Apenas Ícones com Tooltip Imediata)', () => {
  it('renderiza o aside do menu lateral como uma barra estreita w-16 fixa no desktop', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/painel']}>
        <Layout />
      </MemoryRouter>,
    )

    const aside = container.querySelector('aside[aria-label="Menu Lateral bitCRM"]')
    expect(aside).not.toBeNull()
    expect(aside?.className).toContain('w-16')
    expect(aside?.className).toContain('fixed')
    expect(aside?.className).toContain('bg-[#0E1017]')
    expect(aside?.className).toContain('border-r')
  })

  it('exibe todos os itens de navegação apenas com ícones e com atributos aria-label acessíveis para leitores de tela', () => {
    render(
      <MemoryRouter initialEntries={['/painel']}>
        <Layout />
      </MemoryRouter>,
    )

    // Verifica aria-labels
    expect(screen.getByRole('link', { name: 'Painel' })).toBeDefined()
    expect(screen.getByRole('link', { name: 'Oportunidades' })).toBeDefined()
    expect(screen.getByRole('link', { name: 'Comissionamento' })).toBeDefined()
    expect(screen.getByRole('link', { name: 'Métricas da Equipe' })).toBeDefined()
    expect(screen.getByRole('link', { name: 'Usuários' })).toBeDefined()
    expect(screen.getByRole('link', { name: 'Formulário' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Guia de Abordagem Comercial' })).toBeDefined()
  })

  it('aplica o realce indigo no item ativo correspondente à rota atual', () => {
    render(
      <MemoryRouter initialEntries={['/oportunidades']}>
        <Layout />
      </MemoryRouter>,
    )

    const oppLink = screen.getByRole('link', { name: 'Oportunidades' })
    // Deve possuir o gradiente indigo do sistema
    expect(oppLink.className).toContain('from-indigo-600/90')
    expect(oppLink.className).toContain('to-blue-600/90')
    expect(oppLink.className).toContain('text-white')

    // Itens inativos não devem ter o gradiente indigo
    const painelLink = screen.getByRole('link', { name: 'Painel' })
    expect(painelLink.className).not.toContain('from-indigo-600/90')
    expect(painelLink.className).toContain('text-gray-400')
  })

  it('não possui animações de expansão de largura no aside (sem w-64 em hover, sem transição de largura)', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/painel']}>
        <Layout />
      </MemoryRouter>,
    )

    const aside = container.querySelector('aside[aria-label="Menu Lateral bitCRM"]')
    expect(aside?.className).not.toContain('transition-all')
    expect(aside?.className).not.toContain('transition-width')
    expect(aside?.className).not.toContain('hover:w-')
  })

  it('o container principal compensa a barra lateral com md:pl-16', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/painel']}>
        <Layout />
      </MemoryRouter>,
    )

    const contentWrapper = container.querySelector('.md\\:pl-16')
    expect(contentWrapper).not.toBeNull()
  })
})
