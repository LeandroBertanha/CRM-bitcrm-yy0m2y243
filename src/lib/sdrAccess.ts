export const SDR_AUTHORIZED_EMAIL = 'leandro.bertanha@lbertanha.com'

export function canAccessSdr(email?: string | null): boolean {
  return email?.trim().toLowerCase() === SDR_AUTHORIZED_EMAIL
}
