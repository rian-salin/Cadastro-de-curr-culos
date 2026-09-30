import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { fetchCandidate, type Candidate } from '../api/candidates'
import CandidateDetailPage from './CandidateDetailPage'

vi.mock('../api/candidates')

const fetchCandidateMock = vi.mocked(fetchCandidate)

const candidate: Candidate = {
  id: 7,
  fullName: 'Maria Souza',
  email: 'maria.souza@example.com',
  phone: '(11) 98888-7777',
  areaOfInterest: 'Desenvolvimento Backend',
  professionalSummary: 'Desenvolvedora .NET com 5 anos de experiência.',
  createdAt: '2026-09-30T14:05:00+00:00',
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/candidates/7']}>
      <Routes>
        <Route path="/candidates/:id" element={<CandidateDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('CandidateDetailPage', () => {
  it('mostra os campos do candidato', async () => {
    fetchCandidateMock.mockResolvedValue(candidate)

    renderPage()

    expect(await screen.findByText('Maria Souza')).toBeInTheDocument()
    expect(fetchCandidateMock).toHaveBeenCalledWith('7')
    expect(screen.getByText('maria.souza@example.com')).toBeInTheDocument()
    expect(screen.getByText('(11) 98888-7777')).toBeInTheDocument()
    expect(screen.getByText('Desenvolvimento Backend')).toBeInTheDocument()
    expect(screen.getByText('Desenvolvedora .NET com 5 anos de experiência.')).toBeInTheDocument()
    expect(screen.getByText('30/09/2026, 14:05')).toBeInTheDocument()
  })

  it('mostra um traço nos campos opcionais não informados', async () => {
    fetchCandidateMock.mockResolvedValue({
      ...candidate,
      phone: null,
      areaOfInterest: null,
      professionalSummary: null,
    })

    renderPage()

    expect(await screen.findAllByText('—')).toHaveLength(3)
  })

  it('avisa quando o candidato não existe', async () => {
    fetchCandidateMock.mockResolvedValue(null)

    renderPage()

    expect(await screen.findByText('Candidato não encontrado.')).toBeInTheDocument()
  })

  it('mostra mensagem de falha e tenta de novo', async () => {
    fetchCandidateMock.mockRejectedValueOnce(new Error('rede'))
    const user = userEvent.setup()

    renderPage()

    expect(
      await screen.findByText(
        'Não foi possível carregar o candidato. Verifique se a API está no ar.',
      ),
    ).toBeInTheDocument()

    fetchCandidateMock.mockResolvedValue(candidate)
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }))

    expect(await screen.findByText('Maria Souza')).toBeInTheDocument()
  })
})
