import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { getNextTheme } from '@/lib/theme'

type ThemeToggleProps = {
  variant?: 'icon' | 'segmented'
  className?: string
}

export function ThemeToggle({ variant = 'icon', className }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const isDark = !mounted || resolvedTheme !== 'light'

  if (variant === 'segmented') {
    return (
      <div
        className={cn(
          'inline-grid w-full max-w-sm grid-cols-2 rounded-xl border border-border bg-secondary p-1',
          className,
        )}
        role="group"
        aria-label="Escolha do tema do bitCRM"
      >
        <button
          type="button"
          onClick={() => setTheme('light')}
          aria-pressed={!isDark}
          className={cn(
            'flex h-10 items-center justify-center gap-2 rounded-lg text-xs font-semibold transition-colors',
            !isDark
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-muted-foreground hover:bg-background hover:text-foreground',
          )}
        >
          <Sun className="h-4 w-4" />
          Modo Claro
        </button>
        <button
          type="button"
          onClick={() => setTheme('dark')}
          aria-pressed={isDark}
          className={cn(
            'flex h-10 items-center justify-center gap-2 rounded-lg text-xs font-semibold transition-colors',
            isDark
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-muted-foreground hover:bg-background hover:text-foreground',
          )}
        >
          <Moon className="h-4 w-4" />
          Modo Escuro
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setTheme(getNextTheme(resolvedTheme))}
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
        className,
      )}
      aria-label={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
      title={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}
