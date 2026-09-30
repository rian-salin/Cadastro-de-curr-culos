import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createCandidate, type Candidate, type CreateCandidateResult } from '../api/candidates'
import {
  extractResume,
  type ExtractedResume,
  type ExtractResumeResult,
} from '../api/resumes'
import CandidateForm from './CandidateForm'

vi.mock('../api/candidates')
vi.mock('../api/resumes')

const createCandidateMock = vi.mocked(createCandidate)
const extractResumeMock = vi.mocked(extractResume)

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

const pdf = new File(['%PDF-1.7'], 'curriculo.pdf', { type: 'application/pdf' })

const allFields: ExtractedResume = {
  fullName: 'Maria Souza',
  email: 'maria@example.com',
  phone: '(11) 98888-7777',
}

const allFieldsMessage =
  'Preenchemos nome, e-mail e telefone a partir do currículo. Confira antes de salvar.'

function renderForm() {
  const onSaved = vi.fn()
  render(<CandidateForm onSaved={onSaved} />)
  return onSaved
}

function resumeInput() {
  return screen.getByLabelText('Currículo em PDF')
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
    expect(screen.getByLabelText('E-mail *')).toHaveAccessibleDescription(
      'Já existe um candidato com este e-mail.',
    )
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('mostra o título mesmo sem nenhum campo correspondente', async () => {
    createCandidateMock.mockResolvedValue({
      status: 'invalid',
      title: 'Um ou mais campos são inválidos.',
      fieldErrors: {},
    })
    const user = userEvent.setup()
    const onSaved = renderForm()

    await fillRequiredFields(user)
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(
      await screen.findByText('Um ou mais campos são inválidos.'),
    ).toBeInTheDocument()
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('normaliza antes de validar o limite de caracteres', async () => {
    createCandidateMock.mockResolvedValue({ status: 'created', candidate })
    const user = userEvent.setup()
    const onSaved = renderForm()

    const paddedName = `  ${'a'.repeat(150)}  `
    await user.click(screen.getByLabelText('Nome completo *'))
    await user.paste(paddedName)
    await user.type(screen.getByLabelText('E-mail *'), 'maria@example.com')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(candidate))
    expect(createCandidateMock).toHaveBeenCalledWith(
      expect.objectContaining({ fullName: 'a'.repeat(150) }),
    )
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

describe('CandidateForm com currículo em PDF', () => {
  it('preenche nome, e-mail e telefone a partir do PDF', async () => {
    extractResumeMock.mockResolvedValue({ status: 'extracted', fields: allFields })
    const user = userEvent.setup()
    renderForm()

    await user.upload(resumeInput(), pdf)

    expect(await screen.findByText(allFieldsMessage)).toBeInTheDocument()
    expect(extractResumeMock).toHaveBeenCalledWith(pdf)
    expect(screen.getByLabelText('Nome completo *')).toHaveValue('Maria Souza')
    expect(screen.getByLabelText('E-mail *')).toHaveValue('maria@example.com')
    expect(screen.getByLabelText('Telefone')).toHaveValue('(11) 98888-7777')
  })

  it('preenche só o identificado e mantém o que já foi digitado', async () => {
    extractResumeMock.mockResolvedValue({
      status: 'extracted',
      fields: { fullName: 'Maria Souza', email: null, phone: null },
    })
    const user = userEvent.setup()
    renderForm()

    await fillRequiredFields(user, 'Nome Digitado', 'digitado@example.com')
    await user.upload(resumeInput(), pdf)

    expect(
      await screen.findByText(
        'Preenchemos nome a partir do currículo. Não identificamos e-mail e telefone: preencha manualmente.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Nome completo *')).toHaveValue('Maria Souza')
    expect(screen.getByLabelText('E-mail *')).toHaveValue('digitado@example.com')
    expect(screen.getByLabelText('Telefone')).toHaveValue('')
  })

  it('avisa quando nada foi identificado e não mexe nos campos', async () => {
    extractResumeMock.mockResolvedValue({
      status: 'extracted',
      fields: { fullName: null, email: null, phone: null },
    })
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByLabelText('Nome completo *'), 'Nome Digitado')
    await user.upload(resumeInput(), pdf)

    expect(
      await screen.findByText(
        'Não identificamos nome, e-mail nem telefone neste currículo. Preencha os dados manualmente.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Nome completo *')).toHaveValue('Nome Digitado')
  })

  it('limpa o erro do campo preenchido pelo PDF', async () => {
    extractResumeMock.mockResolvedValue({ status: 'extracted', fields: allFields })
    const user = userEvent.setup()
    renderForm()

    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(screen.getByText('Informe o nome completo.')).toBeInTheDocument()

    await user.upload(resumeInput(), pdf)

    await screen.findByText(allFieldsMessage)
    expect(screen.queryByText('Informe o nome completo.')).not.toBeInTheDocument()
    expect(screen.queryByText('Informe o e-mail.')).not.toBeInTheDocument()
  })

  it('recusa arquivo que não é PDF sem chamar a API', async () => {
    const user = userEvent.setup({ applyAccept: false })
    renderForm()

    await user.upload(
      resumeInput(),
      new File(['texto'], 'curriculo.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }),
    )

    expect(await screen.findByText('O arquivo precisa ser um PDF.')).toBeInTheDocument()
    expect(extractResumeMock).not.toHaveBeenCalled()
  })

  it('mostra a recusa da API e continua salvando pelo fluxo manual', async () => {
    const message =
      'Não foi possível ler o texto deste PDF. Ele pode estar corrompido, protegido por senha ou ser uma imagem escaneada. Preencha os dados manualmente.'
    extractResumeMock.mockResolvedValue({ status: 'rejected', message })
    createCandidateMock.mockResolvedValue({ status: 'created', candidate })
    const user = userEvent.setup()
    const onSaved = renderForm()

    await user.upload(resumeInput(), pdf)
    expect(await screen.findByText(message)).toBeInTheDocument()

    await fillRequiredFields(user)
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(candidate))
  })

  it('avisa quando a API está fora do ar e deixa o formulário utilizável', async () => {
    extractResumeMock.mockRejectedValue(new Error('rede'))
    const user = userEvent.setup()
    renderForm()

    await user.upload(resumeInput(), pdf)

    expect(
      await screen.findByText(
        'Não foi possível ler o currículo agora. Verifique se a API está no ar ou preencha os dados manualmente.',
      ),
    ).toBeInTheDocument()
    await user.type(screen.getByLabelText('Nome completo *'), 'Maria Souza')
    expect(screen.getByLabelText('Nome completo *')).toHaveValue('Maria Souza')
  })

  it('salva os valores preenchidos pelo PDF', async () => {
    extractResumeMock.mockResolvedValue({ status: 'extracted', fields: allFields })
    createCandidateMock.mockResolvedValue({ status: 'created', candidate })
    const user = userEvent.setup()
    const onSaved = renderForm()

    await user.upload(resumeInput(), pdf)
    await screen.findByText(allFieldsMessage)
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

  it('ignora o cancelamento da escolha de arquivo', () => {
    renderForm()

    fireEvent.change(resumeInput(), { target: { files: [] } })

    expect(extractResumeMock).not.toHaveBeenCalled()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('lê de novo o mesmo arquivo escolhido depois de um erro', async () => {
    extractResumeMock
      .mockResolvedValueOnce({ status: 'rejected', message: 'Falhou.' })
      .mockResolvedValueOnce({ status: 'extracted', fields: allFields })
    const user = userEvent.setup()
    renderForm()

    await user.upload(resumeInput(), pdf)
    await screen.findByText('Falhou.')
    await user.upload(resumeInput(), pdf)

    expect(await screen.findByText(allFieldsMessage)).toBeInTheDocument()
    expect(extractResumeMock).toHaveBeenCalledTimes(2)
  })

  it('bloqueia outra escolha enquanto lê o currículo', async () => {
    let resolveExtract: (result: ExtractResumeResult) => void = () => {}
    extractResumeMock.mockReturnValue(
      new Promise<ExtractResumeResult>((resolve) => {
        resolveExtract = resolve
      }),
    )
    const user = userEvent.setup()
    renderForm()

    await user.upload(resumeInput(), pdf)

    expect(screen.getByText('Lendo o currículo...')).toBeInTheDocument()
    expect(resumeInput()).toBeDisabled()

    resolveExtract({ status: 'extracted', fields: allFields })

    expect(await screen.findByText(allFieldsMessage)).toBeInTheDocument()
    expect(resumeInput()).toBeEnabled()
  })
})
