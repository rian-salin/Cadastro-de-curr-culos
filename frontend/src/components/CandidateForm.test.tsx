import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createCandidate, type Candidate, type CreateCandidateResult } from '../api/candidates'
import CandidateForm from './CandidateForm'

vi.mock('../api/candidates')

const createCandidateMock = vi.mocked(createCandidate)

type User = ReturnType<typeof userEvent.setup>

const candidate: Candidate = {
  id: 7,
  fullName: 'Maria Souza',
  email: 'maria@example.com',
  phone: null,
  areaOfInterest: null,
  professionalSummary: null,
  createdAt: '2026-09-30T14:05:00+00:00',
}

function renderForm() {
  const onSaved = vi.fn()
  render(<CandidateForm onSaved={onSaved} />)
  return onSaved
}

async function fillRequiredFields(user: User, name = 'Maria Souza', email = 'maria@example.com') {
  await user.type(screen.getByLabelText('Nome completo *'), name)
  await user.type(screen.getByLabelText('E-mail *'), email)
}

describe('CandidateForm', () => {
  it('acusa os campos obrigatórios sem chamar a API', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(screen.getByText('Informe o nome completo.')).toBeInTheDocument()
    expect(screen.getByText('Informe o e-mail.')).toBeInTheDocument()
    expect(createCandidateMock).not.toHaveBeenCalled()
  })

  it('envia os valores normalizados e avisa quem salvou', async () => {
    createCandidateMock.mockResolvedValue({ status: 'created', candidate })
    const user = userEvent.setup()
    const onSaved = renderForm()

    await fillRequiredFields(user, '  Maria Souza  ', '  maria@example.com ')
    await user.type(screen.getByLabelText('Telefone'), ' (11) 98888-7777 ')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(candidate))
    expect(createCandidateMock).toHaveBeenCalledWith({
      fullName: 'Maria Souza',
      email: 'maria@example.com',
      phone: '(11) 98888-7777',
      areaOfInterest: '',
      professionalSummary: '',
    })
  })

  it('mostra o erro de e-mail duplicado no campo e o título no topo', async () => {
    createCandidateMock.mockResolvedValue({
      status: 'invalid',
      title: 'Candidato já cadastrado.',
      fieldErrors: { email: ['Já existe um candidato com este e-mail.'] },
    })
    const user = userEvent.setup()
    const onSaved = renderForm()

    await fillRequiredFields(user, 'Maria Souza', 'MARIA@EXAMPLE.COM')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(
      await screen.findByText('Já existe um candidato com este e-mail.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Candidato já cadastrado.')).toBeInTheDocument()
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('avisa da falha de rede e preserva o que foi digitado', async () => {
    createCandidateMock.mockRejectedValue(new Error('rede'))
    const user = userEvent.setup()
    renderForm()

    await fillRequiredFields(user)
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(
      await screen.findByText(
        'Não foi possível salvar o cadastro. Verifique se a API está no ar e tente de novo.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Nome completo *')).toHaveValue('Maria Souza')
  })

  it('limpa o erro do campo quando ele é editado', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(screen.getByText('Informe o nome completo.')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Nome completo *'), 'M')

    expect(screen.queryByText('Informe o nome completo.')).not.toBeInTheDocument()
    expect(screen.getByText('Informe o e-mail.')).toBeInTheDocument()
  })

  it('desabilita o botão durante o envio e não envia duas vezes', async () => {
    let resolveCreate: (result: CreateCandidateResult) => void = () => {}
    createCandidateMock.mockReturnValue(
      new Promise<CreateCandidateResult>((resolve) => {
        resolveCreate = resolve
      }),
    )
    const user = userEvent.setup()
    const onSaved = renderForm()

    await fillRequiredFields(user)
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    const submitting = await screen.findByRole('button', { name: 'Salvando...' })
    expect(submitting).toBeDisabled()

    await user.click(submitting)
    expect(createCandidateMock).toHaveBeenCalledTimes(1)

    resolveCreate({ status: 'created', candidate })
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(candidate))
  })
})
