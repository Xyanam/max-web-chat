import { isValidPhoneNumber } from 'libphonenumber-js'

export type PhoneResult =
  | { ok: true; digits: string; formatted: string }
  | { ok: false; error: string }

/**
 * Normalizes a phone number for GREEN-API CheckAccount (MAX).
 *
 * The MAX CheckAccount method accepts an integer in international format,
 * 11 or 12 digits, and only Russian (+7) and Belarusian (+375) numbers.
 * The returned digits are later exchanged for a MAX chatId via CheckAccount —
 * they are never used as a chatId directly.
 */
export function normalizePhone(input: string): PhoneResult {
  const trimmed = input.trim()
  if (!trimmed) return { ok: false, error: 'Введите номер телефона.' }

  const stripped = trimmed.replace(/[\s\-().]/g, '').replace(/^\+/, '')
  if (!/^\d+$/.test(stripped)) {
    return { ok: false, error: 'Номер может содержать только цифры, пробелы, «+», «-» и скобки.' }
  }

  let digits = stripped
  // Russian domestic formats: 8XXXXXXXXXX → 7XXXXXXXXXX, 9XXXXXXXXX → 79XXXXXXXXX
  if (digits.length === 11 && digits.startsWith('8')) digits = `7${digits.slice(1)}`
  else if (digits.length === 10 && digits.startsWith('9')) digits = `7${digits}`

  if (digits.length === 11 && digits.startsWith('7')) {
    return { ok: true, digits, formatted: formatPhone(digits) }
  }
  if (digits.length === 12 && digits.startsWith('375')) {
    return { ok: true, digits, formatted: formatPhone(digits) }
  }
  if (digits.length < 11 || digits.length > 12) {
    return { ok: false, error: 'Номер должен содержать 11 или 12 цифр в международном формате, например +7 (999) 123-45-67.' }
  }
  return { ok: false, error: 'MAX поддерживает только российские (+7) и белорусские (+375) номера.' }
}

export function formatPhone(digits: string): string {
  if (digits.length === 11 && digits.startsWith('7')) {
    return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9)}`
  }
  if (digits.length === 12 && digits.startsWith('375')) {
    return `+375 (${digits.slice(3, 5)}) ${digits.slice(5, 8)}-${digits.slice(8, 10)}-${digits.slice(10)}`
  }
  return digits ? `+${digits}` : ''
}

export type PhoneCountry = 'RU' | 'BY'

interface CountryInfo {
  label: string
  dialCode: string
  /** Digits after the country code. */
  nationalLength: number
  /** IMask pattern: {…} is a fixed part kept in the unmasked value, 0 is any digit. */
  mask: string
  placeholder: string
}

/** Countries supported by GREEN-API CheckAccount for MAX. */
export const PHONE_COUNTRIES: Record<PhoneCountry, CountryInfo> = {
  RU: {
    label: 'Россия',
    dialCode: '7',
    nationalLength: 10,
    mask: '+{7} (000) 000-00-00',
    placeholder: '+7 (999) 123-45-67',
  },
  BY: {
    label: 'Беларусь',
    dialCode: '375',
    nationalLength: 9,
    mask: '+{375} (00) 000-00-00',
    placeholder: '+375 (29) 123-45-67',
  },
}

/**
 * Recognizes a complete number with a country code in pasted text, e.g.
 * "+375 29 123 45 67", "+7 999 123-45-67", "8 (999) 123-45-67", "79991234567".
 * Returns null when the text does not identify a country (for example a few
 * digits pasted into the middle of the number) — the mask handles those.
 */
export function detectPhoneCountry(text: string): { country: PhoneCountry; national: string } | null {
  const digits = text.replace(/\D/g, '')
  const hasPlus = text.trim().startsWith('+')
  if (digits.startsWith('375') && (hasPlus || digits.length === 12)) {
    return { country: 'BY', national: digits.slice(3, 12) }
  }
  if (digits.startsWith('7') && (hasPlus || digits.length === 11)) {
    return { country: 'RU', national: digits.slice(1, 11) }
  }
  if (digits.startsWith('8') && digits.length === 11 && !hasPlus) {
    return { country: 'RU', national: digits.slice(1) }
  }
  return null
}

/**
 * Validates the national part entered in the masked input and returns the
 * recipient number in the format expected by CheckAccount: digits only,
 * country code included (79991234567 / 375291234567).
 */
export function validatePhone(country: PhoneCountry, national: string): PhoneResult {
  const info = PHONE_COUNTRIES[country]
  const nationalDigits = national.replace(/\D/g, '')
  if (!nationalDigits) return { ok: false, error: 'Введите номер телефона.' }
  if (nationalDigits.length < info.nationalLength) {
    return {
      ok: false,
      error: `Номер введён не полностью: после кода +${info.dialCode} нужно ${info.nationalLength} цифр.`,
    }
  }
  if (nationalDigits.length > info.nationalLength || !isValidPhoneNumber(nationalDigits, country)) {
    return { ok: false, error: 'Такого номера не существует. Проверьте код оператора и номер.' }
  }
  return normalizePhone(info.dialCode + nationalDigits)
}
