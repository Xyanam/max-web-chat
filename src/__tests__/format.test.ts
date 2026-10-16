import { describe, expect, it } from 'vitest'
import { initials } from '../lib/format'
import { suggestApiUrl, validateApiUrl } from '../api/config'

describe('initials', () => {
  it('uses letters only', () => {
    expect(initials('Ivan Petrov')).toBe('IP')
    expect(initials('Мария')).toBe('МА')
    expect(initials('+7 999 123-45-67')).toBe('')
  })
})

describe('api url helpers', () => {
  it('suggests the per-instance host from idInstance', () => {
    expect(suggestApiUrl('3100123456')).toBe('https://3100.api.green-api.com/v3')
    expect(suggestApiUrl('abc')).toBe('')
  })

  it('validates the API URL', () => {
    expect(validateApiUrl('https://3100.api.green-api.com/v3/')).toBeNull()
    expect(validateApiUrl('http://3100.api.green-api.com')).toMatch(/https/)
    expect(validateApiUrl('not a url')).toMatch(/valid/)
    expect(validateApiUrl('')).toMatch(/Enter/)
  })
})
