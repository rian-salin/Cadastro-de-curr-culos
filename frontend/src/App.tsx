import { useEffect, useState } from 'react'
import { fetchHealth, type HealthResponse } from './api/health'

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchHealth()
      .then(setHealth)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
  }, [])

  return (
    <main>
      <h1>Cadastro de Currículos</h1>
      {error && <p>Erro ao consultar a API: {error}</p>}
      {!error && !health && <p>Consultando a API...</p>}
      {health && (
        <p>
          API: {health.status} · Banco: {health.database}
        </p>
      )}
    </main>
  )
}

export default App
