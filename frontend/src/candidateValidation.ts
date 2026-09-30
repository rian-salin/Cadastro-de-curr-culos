import type { CandidateInput, FieldErrors } from './api/candidates'

export const candidateLimits = {
  fullName: 150,
  email: 254,
  phone: 20,
  areaOfInterest: 100,
  professionalSummary: 2000,
} as const

export const emptyCandidateInput: CandidateInput = {
  fullName: '',
  email: '',
  phone: '',
  areaOfInterest: '',
  professionalSummary: '',
}

// Os mesmos padrões do backend (CreateCandidateRequest).
const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const phonePattern = /^[0-9+()\s-]*$/

export function normalizeCandidateInput(input: CandidateInput): CandidateInput {
  return {
    fullName: input.fullName.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    areaOfInterest: input.areaOfInterest.trim(),
    professionalSummary: input.professionalSummary.trim(),
  }
}

// Recebe o valor já normalizado, como no backend, que valida depois de aplicar o trim.
export function validateCandidate(input: CandidateInput): FieldErrors {
  const errors: FieldErrors = {}

  if (!input.fullName) {
    errors.fullName = ['Informe o nome completo.']
  } else if (input.fullName.length > candidateLimits.fullName) {
    errors.fullName = [`O nome deve ter no máximo ${candidateLimits.fullName} caracteres.`]
  }

  if (!input.email) {
    errors.email = ['Informe o e-mail.']
  } else {
    const emailErrors: string[] = []

    if (!emailPattern.test(input.email)) {
      emailErrors.push('Informe um e-mail válido.')
    }

    if (input.email.length > candidateLimits.email) {
      emailErrors.push(`O e-mail deve ter no máximo ${candidateLimits.email} caracteres.`)
    }

    if (emailErrors.length > 0) {
      errors.email = emailErrors
    }
  }

  if (input.phone) {
    const phoneErrors: string[] = []

    if (!phonePattern.test(input.phone)) {
      phoneErrors.push('O telefone deve conter apenas números, espaços e os caracteres + ( ) -.')
    }

    if (input.phone.length > candidateLimits.phone) {
      phoneErrors.push(`O telefone deve ter no máximo ${candidateLimits.phone} caracteres.`)
    }

    if (phoneErrors.length > 0) {
      errors.phone = phoneErrors
    }
  }

  if (input.areaOfInterest.length > candidateLimits.areaOfInterest) {
    errors.areaOfInterest = [
      `A área de interesse deve ter no máximo ${candidateLimits.areaOfInterest} caracteres.`,
    ]
  }

  if (input.professionalSummary.length > candidateLimits.professionalSummary) {
    errors.professionalSummary = [
      `O resumo profissional deve ter no máximo ${candidateLimits.professionalSummary} caracteres.`,
    ]
  }

  return errors
}
