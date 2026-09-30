import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { fetchCandidates, type CandidateSummary } from '../api/candidates'
import CandidateListPage from './CandidateListPage'

vi.mock('../api/candidates')

const fetchCandidatesMock = vi.mocked(fetchCandidates)

const candidates: CandidateSummary[] = [
  {
    id: 2,
    fullName: 'Segundo Candidato',
    email: 'segundo@example.com',
    areaOfInterest: null,
    createdAt: '2026-09-30T14:05:00+00:00',
  },
  {
    id: 1,
    fullName: 'Primeiro Candidato',
    email: 'primeiro@example.com',
    areaOfInterest: 'Desenvolvimento Backend',
    createdAt: '2026-09-29T10:00:00+00:00',
  },
]

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/candidates']}>
      <CandidateListPage />
    </MemoryRouter>,
  )
}

describe('CandidateListPage', () => {
  it('mostra uma linha por candidato, na ordem recebida', async () => {
    fetchCandidatesMock.mockResolvedValue(candidates)

    renderPage()

    const rows = await screen.findAllByRole('row')
    // A primeira linha é a do cabeçalho.
    expect(rows).toHaveLength(3)
    expect(rows[1]).toHaveTextContent('Segundo Candidato')
    expect(rows[2]).toHaveTextContent('Primeiro Candidato')
    expect(screen.getByRole('link', { name: 'Primeiro Candidato' })).toHaveAttribute(
      'href',
      '/candidates/1',
    )
    expect(screen.getByText('30/09/2026, 14:05')).toBeInTheDocument()
  })

  it('mostra um traço na área de interesse não informada', async () => {
    fetchCandidatesMock.mockResolvedValue([candidates[0]])

    renderPage()

    const rows = await screen.findAllByRole('row')
    expect(rows[1]).toHaveTextContent('—')
  })

  it('mostra o estado vazio quando não há candidatos', async () => {
    fetchCandidatesMock.mockResolvedValue([])

    renderPage()

    expect(await screen.findByText('Nenhum candidato cadastrado ainda.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('mostra mensagem de falha e tenta de novo', async () => {
    fetchCandidatesMock.mockRejectedValueOnce(new Error('rede'))
    const user = userEvent.setup()

    renderPage()

    expect(
      await screen.findByText(
        'Não foi possível carregar os candidatos. Verifique se a API está no ar.',
      ),
    ).toBeInTheDocument()

    fetchCandidatesMock.mockResolvedValue(candidates)
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }))

    expect(await screen.findByText('Segundo Candidato')).toBeInTheDocument()
  })

  it('mostra a mensagem de cadastro salvo vinda da navegação', async () => {
    fetchCandidatesMock.mockResolvedValue(candidates)

    render(
      <MemoryRouter
        initialEntries={[{ pathname: '/candidates', state: { savedCandidateName: 'Maria Souza' } }]}
      >
        <CandidateListPage />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Cadastro de Maria Souza salvo.')).toBeInTheDocument()
  })
})
