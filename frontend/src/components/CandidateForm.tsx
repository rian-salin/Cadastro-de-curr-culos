import { useState, type ChangeEvent, type FormEvent } from 'react'
import {
  createCandidate,
  type Candidate,
  type CandidateInput,
  type FieldErrors,
} from '../api/candidates'
import type { ExtractedResume } from '../api/resumes'
import {
  emptyCandidateInput,
  normalizeCandidateInput,
  validateCandidate,
} from '../candidateValidation'
import ResumeImport from './ResumeImport'

type CandidateFormProps = { onSaved: (candidate: Candidate) => void }

type FieldProps = {
  id: keyof CandidateInput
  label: string
  value: string
  messages: string[] | undefined
  multiline?: boolean
  onChange: (value: string) => void
}

const networkErrorMessage =
  'Não foi possível salvar o cadastro. Verifique se a API está no ar e tente de novo.'

const extractedFields = ['fullName', 'email', 'phone'] as const

function Field({ id, label, value, messages, multiline, onChange }: FieldProps) {
  const errors = messages ?? []
  const errorId = `${id}-error`
  const shared = {
    id,
    name: id,
    value,
    'aria-invalid': errors.length > 0,
    'aria-describedby': errors.length > 0 ? errorId : undefined,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(event.target.value),
  }

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {multiline ? (
        <textarea {...shared} rows={6} />
      ) : (
        <input {...shared} type={id === 'email' ? 'email' : 'text'} />
      )}
      {errors.length > 0 && (
        <div className="field-error" id={errorId}>
          {errors.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      )}
    </div>
  )
}

function CandidateForm({ onSaved }: CandidateFormProps) {
  const [values, setValues] = useState<CandidateInput>(emptyCandidateInput)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [warning, setWarning] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function updateField(field: keyof CandidateInput, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  // Só o que o PDF identificou sobrescreve: o resto fica como o usuário deixou.
  function applyExtracted(fields: ExtractedResume) {
    for (const field of extractedFields) {
      const value = fields[field]

      if (value) {
        updateField(field, value)
      }
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const input = normalizeCandidateInput(values)
    const validationErrors = validateCandidate(input)

    setWarning(null)

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setErrors({})
    setSubmitting(true)

    try {
      const result = await createCandidate(input)

      if (result.status === 'created') {
        onSaved(result.candidate)
        return
      }

      setErrors(result.fieldErrors)
      setWarning(result.title)
    } catch {
      setWarning(networkErrorMessage)
    }

    setSubmitting(false)
  }

  return (
    <>
      <ResumeImport onExtracted={applyExtracted} />
      {/* noValidate desliga a validação do navegador, que mostraria mensagem própria, em inglês. */}
      <form onSubmit={handleSubmit} noValidate>
        {warning && <p className="banner banner-error">{warning}</p>}

        <Field
          id="fullName"
          label="Nome completo *"
          value={values.fullName}
          messages={errors.fullName}
          onChange={(value) => updateField('fullName', value)}
        />
        <Field
          id="email"
          label="E-mail *"
          value={values.email}
          messages={errors.email}
          onChange={(value) => updateField('email', value)}
        />
        <Field
          id="phone"
          label="Telefone"
          value={values.phone}
          messages={errors.phone}
          onChange={(value) => updateField('phone', value)}
        />
        <Field
          id="areaOfInterest"
          label="Área ou cargo de interesse"
          value={values.areaOfInterest}
          messages={errors.areaOfInterest}
          onChange={(value) => updateField('areaOfInterest', value)}
        />
        <Field
          id="professionalSummary"
          label="Resumo profissional"
          value={values.professionalSummary}
          messages={errors.professionalSummary}
          multiline
          onChange={(value) => updateField('professionalSummary', value)}
        />

        <button type="submit" disabled={submitting}>
          {submitting ? 'Salvando...' : 'Salvar'}
        </button>
      </form>
    </>
  )
}

export default CandidateForm
