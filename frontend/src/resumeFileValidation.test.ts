import { describe, expect, it } from 'vitest'
import { maxResumeFileSize, validateResumeFile } from './resumeFileValidation'

function fileOfSize(size: number, name = 'curriculo.pdf', type = 'application/pdf'): File {
  return new File([new Uint8Array(size)], name, { type })
}

describe('validateResumeFile', () => {
  it('aceita PDF pelo tipo', () => {
    expect(validateResumeFile(fileOfSize(10))).toBeNull()
  })

  it('aceita PDF pela extensão quando o navegador não informa o tipo', () => {
    expect(validateResumeFile(fileOfSize(10, 'CV.PDF', ''))).toBeNull()
  })

  it.each([
    ['curriculo.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    ['foto.png', 'image/png'],
  ])('recusa %s', (name, type) => {
    expect(validateResumeFile(fileOfSize(10, name, type))).toBe('O arquivo precisa ser um PDF.')
  })

  it('aceita exatamente 5 MB', () => {
    expect(validateResumeFile(fileOfSize(maxResumeFileSize))).toBeNull()
  })

  it('recusa 1 byte acima de 5 MB', () => {
    expect(validateResumeFile(fileOfSize(maxResumeFileSize + 1))).toBe(
      'O arquivo deve ter no máximo 5 MB.',
    )
  })
})
