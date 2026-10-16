import { describe, expect, it } from 'vitest'
import { detectPhoneCountry, formatPhone, normalizePhone, validatePhone } from '../lib/phone'

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

describe('formatPhone', () => {
  it('formats RU and BY numbers with brackets', () => {
    expect(formatPhone('79991234567')).toBe('+7 (999) 123-45-67')
    expect(formatPhone('375291234567')).toBe('+375 (29) 123-45-67')
  })
})

describe('detectPhoneCountry', () => {
  it.each([
    ['+375 29 123-45-67', 'BY', '291234567'],
    ['375291234567', 'BY', '291234567'],
    ['+7 (999) 123-45-67', 'RU', '9991234567'],
    ['79991234567', 'RU', '9991234567'],
    ['8 (999) 123-45-67', 'RU', '9991234567'],
    ['+7 999 12', 'RU', '99912'],
  ])('detects %s', (text, country, national) => {
    expect(detectPhoneCountry(text)).toEqual({ country, national })
  })

  it.each(['123', '999 12', '9991234567', '+380 44 123 45 67'])('leaves partial or foreign text %j to the mask', (text) => {
    expect(detectPhoneCountry(text)).toBeNull()
  })
})

describe('validatePhone', () => {
  it('returns CheckAccount digits for valid numbers', () => {
    expect(validatePhone('RU', '9991234567')).toMatchObject({ ok: true, digits: '79991234567' })
    expect(validatePhone('BY', '291234567')).toMatchObject({ ok: true, digits: '375291234567' })
  })

  it('reports empty and incomplete numbers', () => {
    expect(validatePhone('RU', '')).toMatchObject({ ok: false, error: 'Введите номер телефона.' })
    expect(validatePhone('RU', '99912')).toMatchObject({
      ok: false,
      error: 'Номер введён не полностью: после кода +7 нужно 10 цифр.',
    })
    expect(validatePhone('BY', '2912')).toMatchObject({
      ok: false,
      error: 'Номер введён не полностью: после кода +375 нужно 9 цифр.',
    })
  })

  it('rejects numbers that do not exist', () => {
    expect(validatePhone('RU', '1234567890')).toMatchObject({ ok: false, error: expect.stringMatching(/не существует/) })
    expect(validatePhone('RU', '99912345678')).toMatchObject({ ok: false })
  })
})
