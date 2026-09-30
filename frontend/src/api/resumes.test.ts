import { describe, expect, it, vi } from 'vitest'
import { extractResume, type ExtractedResume } from './resumes'

const file = new File(['%PDF-1.7'], 'curriculo.pdf', { type: 'application/pdf' })

const fields: ExtractedResume = {
  fullName: 'Maria Souza',
  email: 'maria@example.com',
  phone: '(11) 98888-7777',
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response
}

// O 413 vem do Nginx em HTML: ler o JSON dele lança.
function htmlResponse(status: number): Response {
  return {
    ok: false,
    status,
    json: async () => {
      throw new SyntaxError('Unexpected token < in JSON')
    },
  } as unknown as Response
}

function stubFetch(response: Response) {
  const fetchMock = vi.fn<typeof fetch>(async () => response)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('extractResume', () => {
  it('envia o arquivo como multipart, no campo file', async () => {
    const fetchMock = stubFetch(jsonResponse(200, fields))

    await extractResume(file)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/resumes/extract')
    expect(init?.method).toBe('POST')
    expect(init?.headers).toBeUndefined()
    const body = init?.body
    expect(body).toBeInstanceOf(FormData)
    const sent = (body as FormData).get('file') as File
    expect(sent.name).toBe('curriculo.pdf')
  })

  it('devolve os campos no 200', async () => {
    stubFetch(jsonResponse(200, fields))

    await expect(extractResume(file)).resolves.toEqual({ status: 'extracted', fields })
  })

  it('usa a mensagem do campo file no 400', async () => {
    stubFetch(
      jsonResponse(400, {
        title: 'Arquivo inválido.',
        errors: { file: ['O arquivo precisa ser um PDF.'] },
      }),
    )

    await expect(extractResume(file)).resolves.toEqual({
      status: 'rejected',
      message: 'O arquivo precisa ser um PDF.',
    })
  })

  it('usa o título no 400 sem erro de campo', async () => {
    stubFetch(jsonResponse(400, { title: 'Arquivo inválido.' }))

    await expect(extractResume(file)).resolves.toEqual({
      status: 'rejected',
      message: 'Arquivo inválido.',
    })
  })

  it('traduz o 413 do Nginx sem ler o corpo', async () => {
    stubFetch(htmlResponse(413))

    await expect(extractResume(file)).resolves.toEqual({
      status: 'rejected',
      message: 'O arquivo deve ter no máximo 5 MB.',
    })
  })

  it('usa o título no 422', async () => {
    const title =
      'Não foi possível ler o texto deste PDF. Ele pode estar corrompido, protegido por senha ou ser uma imagem escaneada. Preencha os dados manualmente.'
    stubFetch(jsonResponse(422, { title }))

    await expect(extractResume(file)).resolves.toEqual({ status: 'rejected', message: title })
  })

  it('lança em status inesperado', async () => {
    stubFetch(jsonResponse(500, {}))

    await expect(extractResume(file)).rejects.toThrow('Unexpected response: 500')
  })
})
