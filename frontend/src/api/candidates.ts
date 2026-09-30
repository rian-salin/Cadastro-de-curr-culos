export type CandidateSummary = {
  id: number
  fullName: string
  email: string
  areaOfInterest: string | null
  createdAt: string
}

export type Candidate = CandidateSummary & {
  phone: string | null
  professionalSummary: string | null
}

// O formulário produz string em todo campo: opcional vazio é '', e o backend
// grava null no lugar.
export type CandidateInput = {
  fullName: string
  email: string
  phone: string
  areaOfInterest: string
  professionalSummary: string
}

export type FieldErrors = Partial<Record<keyof CandidateInput, string[]>>

export type CreateCandidateResult =
  | { status: 'created'; candidate: Candidate }
  | { status: 'invalid'; title: string; fieldErrors: FieldErrors }

type ValidationProblemDetails = {
  title?: string
  errors?: Record<string, string[]>
}

const candidateFields: (keyof CandidateInput)[] = [
  'fullName',
  'email',
  'phone',
  'areaOfInterest',
  'professionalSummary',
]

export async function fetchCandidates(): Promise<CandidateSummary[]> {
  const response = await fetch('/api/candidates')

  if (!response.ok) {
    throw new Error(`Unexpected response: ${response.status}`)
  }

  return (await response.json()) as CandidateSummary[]
}

export async function fetchCandidate(id: string): Promise<Candidate | null> {
  const response = await fetch(`/api/candidates/${encodeURIComponent(id)}`)

  // O 404 da restrição de rota do backend não tem corpo: não leia o JSON dele.
  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new Error(`Unexpected response: ${response.status}`)
  }

  return (await response.json()) as Candidate
}

export async function createCandidate(input: CandidateInput): Promise<CreateCandidateResult> {
  const response = await fetch('/api/candidates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (response.status === 201) {
    return { status: 'created', candidate: (await response.json()) as Candidate }
  }

  // 400 e 409 chegam no mesmo formato (ValidationProblemDetails); o que muda é o título.
  if (response.status === 400 || response.status === 409) {
    const problem = (await response.json()) as ValidationProblemDetails

    return {
      status: 'invalid',
      title: problem.title ?? 'Não foi possível salvar o cadastro.',
      fieldErrors: toFieldErrors(problem.errors),
    }
  }

  throw new Error(`Unexpected response: ${response.status}`)
}

function toFieldErrors(errors: Record<string, string[]> | undefined): FieldErrors {
  const fieldErrors: FieldErrors = {}

  for (const field of candidateFields) {
    const messages = errors?.[field]

    if (messages && messages.length > 0) {
      fieldErrors[field] = messages
    }
  }

  return fieldErrors
}
