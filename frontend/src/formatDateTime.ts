const formatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

export function formatDateTime(isoTimestamp: string): string {
  return formatter.format(new Date(isoTimestamp))
}
