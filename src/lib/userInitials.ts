export function getUserInitials(name?: string | null, email?: string | null): string {
  const nameParts = (name ?? '').trim().split(/\s+/).filter(Boolean)

  if (nameParts.length >= 2) {
    return `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase()
  }

  if (nameParts.length === 1) {
    return nameParts[0].slice(0, 2).toUpperCase()
  }

  const emailLocalPart = (email ?? '').split('@')[0].trim()
  return emailLocalPart ? emailLocalPart.slice(0, 2).toUpperCase() : 'BC'
}
