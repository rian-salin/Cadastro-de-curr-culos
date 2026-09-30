import { resumeTooLargeMessage } from '../resumeFileValidation'

export type ExtractedResume = {
  fullName: string | null
  email: string | null
  phone: string | null
}

export type ExtractResumeResult =
  | { status: 'extracted'; fields: ExtractedResume }
  | { status: 'rejected'; message: string }

type ProblemDetails = {
  title?: string
  errors?: Record<string, string[]>
}

export async function extractResume(file: File): Promise<ExtractResumeResult> {
  const body = new FormData()
  body.append('file', file)

  // Sem Content-Type à mão: o navegador monta o cabeçalho do multipart com o boundary.
  const response = await fetch('/api/resumes/extract', { method: 'POST', body })

  if (response.status === 200) {
    return { status: 'extracted', fields: (await response.json()) as ExtractedResume }
  }

  // O 413 vem do Nginx, em HTML: não leia o corpo.
  if (response.status === 413) {
    return { status: 'rejected', message: resumeTooLargeMessage }
  }

  if (response.status === 400) {
    const problem = (await response.json()) as ProblemDetails

    return {
      status: 'rejected',
      message: problem.errors?.file?.[0] ?? problem.title ?? 'O arquivo enviado não foi aceito.',
    }
  }

  if (response.status === 422) {
    const problem = (await response.json()) as ProblemDetails

    return {
      status: 'rejected',
      message:
        problem.title ?? 'Não foi possível ler o texto deste PDF. Preencha os dados manualmente.',
    }
  }

  throw new Error(`Unexpected response: ${response.status}`)
}
