import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { fetchCandidates, type CandidateSummary } from '../api/candidates'
import { formatDateTime } from '../formatDateTime'

type LoadState =
  | { status: 'loading' }
  | { status: 'loaded'; candidates: CandidateSummary[] }
  | { status: 'error' }

type NavigationState = { savedCandidateName?: string } | null

function CandidateListPage() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const location = useLocation()
  const navigate = useNavigate()
  // Lido uma vez para o estado local; o registro do histórico é limpo abaixo,
  // para um F5 não repetir a mensagem.
  const [savedCandidateName] = useState(
    () => (location.state as NavigationState)?.savedCandidateName ?? null,
  )

  useEffect(() => {
    if (location.state) {
      void navigate(location.pathname, { replace: true })
    }
  }, [location.pathname, location.state, navigate])

  const load = useCallback(() => {
    setState({ status: 'loading' })

    fetchCandidates()
      .then((candidates) => setState({ status: 'loaded', candidates }))
      .catch(() => setState({ status: 'error' }))
  }, [])

  useEffect(load, [load])

  return (
    <section>
      <h2>Candidatos</h2>

      {savedCandidateName && (
        <p className="banner banner-success">Cadastro de {savedCandidateName} salvo.</p>
      )}

      {state.status === 'loading' && <p>Carregando candidatos...</p>}

      {state.status === 'error' && (
        <div className="banner banner-error">
          <p>Não foi possível carregar os candidatos. Verifique se a API está no ar.</p>
          <button type="button" onClick={load}>
            Tentar de novo
          </button>
        </div>
      )}

      {state.status === 'loaded' && state.candidates.length === 0 && (
        <p>
          Nenhum candidato cadastrado ainda. <Link to="/candidates/new">Cadastrar o primeiro</Link>
        </p>
      )}

      {state.status === 'loaded' && state.candidates.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>E-mail</th>
              <th>Área de interesse</th>
              <th>Cadastrado em</th>
            </tr>
          </thead>
          <tbody>
            {state.candidates.map((candidate) => (
              <tr key={candidate.id}>
                <td>
                  <Link to={`/candidates/${candidate.id}`}>{candidate.fullName}</Link>
                </td>
                <td>{candidate.email}</td>
                <td>{candidate.areaOfInterest ?? '—'}</td>
                <td>{formatDateTime(candidate.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

export default CandidateListPage
