export const maxResumeFileSize = 5 * 1024 * 1024

const resumeNotPdfMessage = 'O arquivo precisa ser um PDF.'
export const resumeTooLargeMessage = 'O arquivo deve ter no máximo 5 MB.'

// Alguns sistemas não informam o tipo do arquivo: a extensão vale como alternativa.
// A assinatura %PDF- é conferida no backend, que é a fonte da verdade.
export function validateResumeFile(file: File): string | null {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')

  if (!isPdf) {
    return resumeNotPdfMessage
  }

  if (file.size > maxResumeFileSize) {
    return resumeTooLargeMessage
  }

  return null
}
