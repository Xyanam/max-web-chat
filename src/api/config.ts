/**
 * GREEN-API hosts are per instance: the console shows an apiUrl such as
 * https://3100.api.green-api.com/v3 whose subdomain is the first four digits of
 * idInstance. This is only a suggestion — the user can paste the exact apiUrl
 * from the console.
 */
export function suggestApiUrl(idInstance: string): string {
  const id = idInstance.trim()
  return /^\d{4,}$/.test(id) ? `https://${id.slice(0, 4)}.api.green-api.com/v3` : ''
}

export function normalizeApiUrl(apiUrl: string): string {
  return apiUrl.trim().replace(/\/+$/, '')
}

export function validateApiUrl(apiUrl: string): string | null {
  const value = normalizeApiUrl(apiUrl)
  if (!value) return 'Enter the API URL from the GREEN-API console.'
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') return 'API URL must start with https://'
    if (url.search || url.hash) return 'API URL must not contain query parameters.'
  } catch {
    return 'API URL is not a valid URL.'
  }
  return null
}
