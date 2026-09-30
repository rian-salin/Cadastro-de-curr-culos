import { describe, expect, it } from 'vitest'
import type { CandidateInput } from './api/candidates'
import {
  candidateLimits,
  emptyCandidateInput,
  normalizeCandidateInput,
  validateCandidate,
} from './candidateValidation'

function inputWith(overrides: Partial<CandidateInput>): CandidateInput {
  return { ...emptyCandidateInput, fullName: 'Maria Souza', email: 'maria@example.com', ...overrides }
}

describe('normalizeCandidateInput', () => {
  it('remove espaços das pontas de todos os campos', () => {
    const normalized = normalizeCandidateInput({
      fullName: '  Maria Souza  ',
      email: '  maria@example.com ',
      phone: ' (11) 98888-7777 ',
      areaOfInterest: '   ',
      professionalSummary: ' Resumo ',
    })

    expect(normalized).toEqual({
      fullName: 'Maria Souza',
      email: 'maria@example.com',
      phone: '(11) 98888-7777',
      areaOfInterest: '',
      professionalSummary: 'Resumo',
    })
  })
})

describe('validateCandidate', () => {
  it('não acusa erro num cadastro válido', () => {
    expect(validateCandidate(inputWith({}))).toEqual({})
  })

  it('exige nome e e-mail', () => {
    expect(validateCandidate(emptyCandidateInput)).toEqual({
      fullName: ['Informe o nome completo.'],
      email: ['Informe o e-mail.'],
    })
  })

  it.each(['abc', 'a@b', 'a b@c.com', 'a@b@c.com'])('recusa o e-mail %s', (email) => {
    expect(validateCandidate(inputWith({ email }))).toEqual({
      email: ['Informe um e-mail válido.'],
    })
  })

  it('recusa telefone com caractere fora do permitido', () => {
    expect(validateCandidate(inputWith({ phone: '11 9999-abcd' }))).toEqual({
      phone: ['O telefone deve conter apenas números, espaços e os caracteres + ( ) -.'],
    })
  })

  it('aceita telefone com números, espaços e + ( ) -', () => {
    expect(validateCandidate(inputWith({ phone: '+55 (11) 98888-7777' }))).toEqual({})
  })

  it('aceita cada campo exatamente no limite', () => {
    const errors = validateCandidate({
      fullName: 'é'.repeat(candidateLimits.fullName),
      email: `${'a'.repeat(candidateLimits.email - 'ç@example.com'.length)}ç@example.com`,
      phone: '9'.repeat(candidateLimits.phone),
      areaOfInterest: 'ç'.repeat(candidateLimits.areaOfInterest),
      professionalSummary: 'ã'.repeat(candidateLimits.professionalSummary),
    })

    expect(errors).toEqual({})
  })

  it('recusa nome acima do limite', () => {
    const fullName = '1'.repeat(candidateLimits.fullName + 1)

    expect(validateCandidate(inputWith({ fullName }))).toEqual({
      fullName: ['O nome deve ter no máximo 150 caracteres.'],
    })
  })

  it('recusa telefone acima do limite', () => {
    const phone = '1'.repeat(candidateLimits.phone + 1)

    expect(validateCandidate(inputWith({ phone }))).toEqual({
      phone: ['O telefone deve ter no máximo 20 caracteres.'],
    })
  })

  it('recusa área de interesse acima do limite', () => {
    const areaOfInterest = '1'.repeat(candidateLimits.areaOfInterest + 1)

    expect(validateCandidate(inputWith({ areaOfInterest }))).toEqual({
      areaOfInterest: ['A área de interesse deve ter no máximo 100 caracteres.'],
    })
  })

  it('recusa resumo profissional acima do limite', () => {
    const professionalSummary = '1'.repeat(candidateLimits.professionalSummary + 1)

    expect(validateCandidate(inputWith({ professionalSummary }))).toEqual({
      professionalSummary: ['O resumo profissional deve ter no máximo 2000 caracteres.'],
    })
  })

  it('recusa e-mail acima do limite', () => {
    const email = `${'a'.repeat(243)}@example.com`

    expect(email).toHaveLength(candidateLimits.email + 1)
    expect(validateCandidate(inputWith({ email }))).toEqual({
      email: ['O e-mail deve ter no máximo 254 caracteres.'],
    })
  })

  it('acumula as mensagens de formato e de tamanho do e-mail', () => {
    const email = 'a'.repeat(candidateLimits.email + 1)

    expect(validateCandidate(inputWith({ email }))).toEqual({
      email: ['Informe um e-mail válido.', 'O e-mail deve ter no máximo 254 caracteres.'],
    })
  })

  it('não acusa formato quando o campo obrigatório está vazio', () => {
    expect(validateCandidate(inputWith({ email: '' }))).toEqual({
      email: ['Informe o e-mail.'],
    })
  })
})
