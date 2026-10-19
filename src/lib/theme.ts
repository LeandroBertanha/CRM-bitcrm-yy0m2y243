export type AppTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'bitcrm-theme'

export function getNextTheme(theme?: string): AppTheme {
  return theme === 'light' ? 'dark' : 'light'
}
