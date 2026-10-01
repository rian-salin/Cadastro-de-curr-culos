import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { fetchCandidate, type Candidate } from '../api/candidates'
import { formatDateTime } from '../formatDateTime'

type LoadState =
  | { status: 'loading' }
  | { status: 'loaded'; candidate: Candidate }
  | { status: 'notFound' }
  | { status: 'error' }

function CandidateDetailPage() {
  // A rota /candidates/:id só casa com o parâmetro presente.
  const { id } = useParams()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  // Descarta a resposta de uma chamada antiga (troca de :id ou retry) que
  // termine depois de uma mais recente.
  const requestIdRef = useRef(0)

  const load = useCallback(() => {
    const requestId = ++requestIdRef.current
    setState({ status: 'loading' })

    fetchCandidate(id!)
      .then((candidate) => {
        if (requestIdRef.current !== requestId) {
          return
        }

        setState(candidate ? { status: 'loaded', candidate } : { status: 'notFound' })
      })
      .catch(() => {
        if (requestIdRef.current !== requestId) {
          return
        }

        setState({ status: 'error' })
      })
  }, [id])

  useEffect(load, [load])

  return (
    <section>
      <h2>Detalhes do candidato</h2>

      {state.status === 'loading' && <p>Carregando candidato...</p>}

      {state.status === 'notFound' && <p>Candidato não encontrado.</p>}

      {state.status === 'error' && (
        <div className="banner banner-error">
          <p>Não foi possível carregar o candidato. Verifique se a API está no ar.</p>
          <button type="button" onClick={load}>
            Tentar de novo
          </button>
        </div>
      )}

      {state.status === 'loaded' && (
        <dl>
          <dt>Nome completo</dt>
          <dd>{state.candidate.fullName}</dd>
          <dt>E-mail</dt>
          <dd>{state.candidate.email}</dd>
          <dt>Telefone</dt>
          <dd>{state.candidate.phone ?? '—'}</dd>
          <dt>Área ou cargo de interesse</dt>
          <dd>{state.candidate.areaOfInterest ?? '—'}</dd>
          <dt>Resumo profissional</dt>
          <dd>{state.candidate.professionalSummary ?? '—'}</dd>
          <dt>Cadastrado em</dt>
          <dd>{formatDateTime(state.candidate.createdAt)}</dd>
        </dl>
      )}

      <p>
        <Link to="/candidates">Voltar para a listagem</Link>
      </p>
    </section>
  )
}

export default CandidateDetailPage
