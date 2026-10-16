import { describe, expect, it } from 'vitest'
import { normalizePhone } from '../lib/phone'

describe('normalizePhone', () => {
  it.each([
    ['+7 (999) 123-45-67', '79991234567'],
    ['79991234567', '79991234567'],
    ['8 999 123 45 67', '79991234567'],
    ['9991234567', '79991234567'],
    ['+375 29 123-45-67', '375291234567'],
  ])('normalizes %s', (input, digits) => {
    const result = normalizePhone(input)
    expect(result.ok && result.digits).toBe(digits)
  })

  it.each([
    ['', /Введите номер/],
    ['abc', /только цифры/],
    ['+7 999', /11 или 12 цифр/],
    ['+1 202 555 0143 1', /российские \(\+7\) и белорусские/],
    ['+380 44 123 45 67', /российские \(\+7\) и белорусские/],
  ])('rejects %j', (input, error) => {
    const result = normalizePhone(input)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(error)
  })

  it('does not produce a WhatsApp-style @c.us identifier', () => {
    const result = normalizePhone('+79991234567')
    expect(result.ok && result.digits).not.toContain('@')
  })
})
