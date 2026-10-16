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
    return `+7 ${digits.slice(1, 4)} ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9)}`
  }
  if (digits.length === 12 && digits.startsWith('375')) {
    return `+375 ${digits.slice(3, 5)} ${digits.slice(5, 8)}-${digits.slice(8, 10)}-${digits.slice(10)}`
  }
  return digits ? `+${digits}` : ''
}
