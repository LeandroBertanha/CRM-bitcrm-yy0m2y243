export const SYSTEM_OWNER_EMAIL = 'leandro.bertanha@lbertanha.com'

export function isSystemOwner(email?: string | null): boolean {
  return email?.trim().toLowerCase() === SYSTEM_OWNER_EMAIL
}
