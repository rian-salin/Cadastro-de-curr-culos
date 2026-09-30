import { describe, expect, it, vi } from 'vitest'
import {
  createCandidate,
  fetchCandidate,
  fetchCandidates,
  type Candidate,
  type CandidateInput,
  type CandidateSummary,
} from './candidates'

const summary: CandidateSummary = {
  id: 1,
  fullName: 'Maria Souza',
  email: 'maria.souza@example.com',
  areaOfInterest: 'Desenvolvimento Backend',
  createdAt: '2026-09-30T14:05:00+00:00',
}

const candidate: Candidate = {
  ...summary,
  phone: '(11) 98888-7777',
  professionalSummary: 'Desenvolvedora .NET.',
}

const input: CandidateInput = {
  fullName: 'Maria Souza',
  email: 'maria.souza@example.com',
  phone: '(11) 98888-7777',
  areaOfInterest: 'Desenvolvimento Backend',
  professionalSummary: 'Desenvolvedora .NET.',
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response
}

// Resposta sem corpo: ler o JSON dela lança, como acontece no 404 do backend.
function emptyResponse(status: number): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      throw new SyntaxError('Unexpected end of JSON input')
    },
  } as unknown as Response
}

function stubFetch(response: Response) {
  const fetchMock = vi.fn<typeof fetch>(async () => response)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('fetchCandidates', () => {
  it('devolve a lista no 200', async () => {
    const fetchMock = stubFetch(jsonResponse(200, [summary]))

    await expect(fetchCandidates()).resolves.toEqual([summary])
    expect(fetchMock).toHaveBeenCalledWith('/api/candidates')
  })

  it('lança quando a resposta não é ok', async () => {
    stubFetch(jsonResponse(500, {}))

    await expect(fetchCandidates()).rejects.toThrow('Unexpected response: 500')
  })
})

describe('fetchCandidate', () => {
  it('devolve o candidato no 200', async () => {
    const fetchMock = stubFetch(jsonResponse(200, candidate))

    await expect(fetchCandidate('1')).resolves.toEqual(candidate)
    expect(fetchMock).toHaveBeenCalledWith('/api/candidates/1')
  })

  it('devolve null no 404, sem ler o corpo', async () => {
    stubFetch(emptyResponse(404))

    await expect(fetchCandidate('999999')).resolves.toBeNull()
  })

  it('devolve null quando o id não é numérico', async () => {
    stubFetch(emptyResponse(404))

    await expect(fetchCandidate('abc')).resolves.toBeNull()
  })

  it('lança quando a resposta não é ok nem 404', async () => {
    stubFetch(jsonResponse(500, {}))

    await expect(fetchCandidate('1')).rejects.toThrow('Unexpected response: 500')
  })
})

describe('createCandidate', () => {
  it('envia o candidato como JSON e devolve o criado no 201', async () => {
    const fetchMock = stubFetch(jsonResponse(201, candidate))

    await expect(createCandidate(input)).resolves.toEqual({ status: 'created', candidate })
    expect(fetchMock).toHaveBeenCalledWith('/api/candidates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
  })

  it('converte o 400 em erros de campo', async () => {
    stubFetch(
      jsonResponse(400, {
        title: 'Um ou mais campos são inválidos.',
        status: 400,
        errors: { fullName: ['Informe o nome completo.'], email: ['Informe um e-mail válido.'] },
      }),
    )

    await expect(createCandidate(input)).resolves.toEqual({
      status: 'invalid',
      title: 'Um ou mais campos são inválidos.',
      fieldErrors: {
        fullName: ['Informe o nome completo.'],
        email: ['Informe um e-mail válido.'],
      },
    })
  })

  it('converte o 409 em erro no campo e-mail', async () => {
    stubFetch(
      jsonResponse(409, {
        title: 'Candidato já cadastrado.',
        status: 409,
        errors: { email: ['Já existe um candidato com este e-mail.'] },
      }),
    )

    await expect(createCandidate(input)).resolves.toEqual({
      status: 'invalid',
      title: 'Candidato já cadastrado.',
      fieldErrors: { email: ['Já existe um candidato com este e-mail.'] },
    })
  })

  it('descarta chaves que não são campos, mas mantém o título', async () => {
    stubFetch(
      jsonResponse(400, {
        title: 'Um ou mais campos são inválidos.',
        status: 400,
        errors: { $: ['The JSON value could not be converted.'] },
      }),
    )

    await expect(createCandidate(input)).resolves.toEqual({
      status: 'invalid',
      title: 'Um ou mais campos são inválidos.',
      fieldErrors: {},
    })
  })

  it('lança em status inesperado', async () => {
    stubFetch(jsonResponse(500, {}))

    await expect(createCandidate(input)).rejects.toThrow('Unexpected response: 500')
  })
})
