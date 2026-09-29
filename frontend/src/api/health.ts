export type HealthResponse = {
  status: 'ok' | 'degraded'
  database: 'connected' | 'unavailable'
}

export async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch('/api/health')

  if (!response.ok && response.status !== 503) {
    throw new Error(`Unexpected response: ${response.status}`)
  }

  return (await response.json()) as HealthResponse
}
