import { describe, expect, it } from 'vitest'
import { formatDateTime } from './formatDateTime'

describe('formatDateTime', () => {
  it('formata um instante ISO como data e hora em pt-BR', () => {
    expect(formatDateTime('2026-09-30T14:05:00+00:00')).toBe('30/09/2026, 14:05')
  })

  it('converte o deslocamento de fuso do instante recebido', () => {
    expect(formatDateTime('2026-09-30T23:30:00-03:00')).toBe('01/10/2026, 02:30')
  })
})
