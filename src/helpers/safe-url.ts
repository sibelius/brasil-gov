export function safeUrl(value: unknown): string {
  try {
    const url = new URL(typeof value === 'string' ? value.trim() : '')
    const allowed = ['https:', 'http:'].includes(url.protocol)

    return allowed && !url.username && !url.password ? url.href : ''
  } catch {
    return ''
  }
}
