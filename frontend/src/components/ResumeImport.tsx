import { useState, type ChangeEvent } from 'react'
import { extractResume, type ExtractedResume } from '../api/resumes'
import { validateResumeFile } from '../resumeFileValidation'

type ResumeImportProps = { onExtracted: (fields: ExtractedResume) => void }

type ResultMessage = { message: string; tone: 'success' | 'neutral' }

type ImportState =
  | { status: 'idle' }
  | { status: 'reading' }
  | ({ status: 'done' } & ResultMessage)
  | { status: 'error'; message: string }

const networkErrorMessage =
  'Não foi possível ler o currículo agora. Verifique se a API está no ar ou preencha os dados manualmente.'

const fieldLabels = [
  ['fullName', 'nome'],
  ['email', 'e-mail'],
  ['phone', 'telefone'],
] as const

function joinLabels(labels: string[]): string {
  return labels.length > 1
    ? `${labels.slice(0, -1).join(', ')} e ${labels[labels.length - 1]}`
    : labels.join('')
}

function describeResult(fields: ExtractedResume): ResultMessage {
  const found = fieldLabels.filter(([field]) => fields[field]).map(([, label]) => label)
  const missing = fieldLabels.filter(([field]) => !fields[field]).map(([, label]) => label)

  if (found.length === 0) {
    return {
      message:
        'Não identificamos nome, e-mail nem telefone neste currículo. Preencha os dados manualmente.',
      tone: 'neutral',
    }
  }

  if (missing.length === 0) {
    return {
      message: `Preenchemos ${joinLabels(found)} a partir do currículo. Confira antes de salvar.`,
      tone: 'success',
    }
  }

  return {
    message: `Preenchemos ${joinLabels(found)} a partir do currículo. Não identificamos ${joinLabels(missing)}: preencha manualmente.`,
    tone: 'success',
  }
}

function ResumeImport({ onExtracted }: ResumeImportProps) {
  const [state, setState] = useState<ImportState>({ status: 'idle' })

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Sem limpar, escolher o mesmo arquivo de novo (depois de um erro) não dispara outro change.
    event.target.value = ''

    if (!file) {
      return
    }

    const invalidMessage = validateResumeFile(file)

    if (invalidMessage) {
      setState({ status: 'error', message: invalidMessage })
      return
    }

    setState({ status: 'reading' })

    try {
      const result = await extractResume(file)

      if (result.status === 'rejected') {
        setState({ status: 'error', message: result.message })
        return
      }

      onExtracted(result.fields)
      setState({ status: 'done', ...describeResult(result.fields) })
    } catch {
      setState({ status: 'error', message: networkErrorMessage })
    }
  }

  return (
    <section className="resume-import">
      <h3>Tem o currículo em PDF?</h3>
      <label htmlFor="resume-file">Currículo em PDF</label>
      <input
        id="resume-file"
        type="file"
        accept="application/pdf,.pdf"
        disabled={state.status === 'reading'}
        onChange={handleChange}
      />
      <p className="hint">
        PDF de até 5 MB. O que identificarmos preenche o formulário abaixo, e você pode corrigir
        antes de salvar.
      </p>
      {state.status === 'reading' && <p role="status">Lendo o currículo...</p>}
      {state.status === 'done' && (
        <p
          role="status"
          className={state.tone === 'success' ? 'banner banner-success' : 'banner'}
        >
          {state.message}
        </p>
      )}
      {state.status === 'error' && (
        <p role="alert" className="banner banner-error">
          {state.message}
        </p>
      )}
    </section>
  )
}

export default ResumeImport
