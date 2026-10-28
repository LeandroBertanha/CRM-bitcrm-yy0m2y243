import { isSystemOwner, SYSTEM_OWNER_EMAIL } from '@/lib/ownerAccess'

export const SDR_AUTHORIZED_EMAIL = SYSTEM_OWNER_EMAIL

export function canAccessSdr(email?: string | null): boolean {
  return isSystemOwner(email)
}
