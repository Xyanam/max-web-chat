import type { Credentials, InstanceState } from '../types'
import { normalizeApiUrl } from './config'

export type GreenApiErrorKind = 'auth' | 'network' | 'http' | 'api' | 'aborted' | 'rateLimit'

/**
 * Error with a user-facing message. It never includes the request URL, because
 * the GREEN-API URL contains apiTokenInstance.
 */
export class GreenApiError extends Error {
  readonly kind: GreenApiErrorKind
  readonly status?: number

  constructor(kind: GreenApiErrorKind, message: string, status?: number) {
    super(message)
    this.name = 'GreenApiError'
    this.kind = kind
    this.status = status
  }
}

export function isAbortError(err: unknown): boolean {
  return (
    (err instanceof GreenApiError && err.kind === 'aborted') ||
    (err instanceof DOMException && err.name === 'AbortError')
  )
}

export interface SendMessageResponse {
  idMessage: string
}

export interface CheckAccountResponse {
  exist: boolean
  chatId: string
}

export interface ReceivedNotification {
  receiptId: number
  body: unknown
}

type FetchFn = typeof fetch

interface RequestOptions {
  method: 'GET' | 'POST' | 'DELETE'
  /** Path segments appended after the token, e.g. receiptId for DeleteNotification. */
  suffix?: string
  query?: Record<string, string | number>
  body?: unknown
  signal?: AbortSignal
}

function describeHttpError(status: number, detail: string): GreenApiError {
  if (status === 401 || status === 403) {
    if (/suspend/i.test(detail)) {
      return new GreenApiError('api', 'Your MAX account is suspended: you can only message contacts who saved your number.', status)
    }
    return new GreenApiError('auth', 'Access denied. Check idInstance and apiTokenInstance.', status)
  }
  if (status === 466) {
    return new GreenApiError('api', 'The request quota of your GREEN-API plan is exhausted.', status)
  }
  if (status === 429 || status === 469) {
    return new GreenApiError('rateLimit', 'Too many requests. Please wait a little and try again.', status)
  }
  if (status === 404) {
    return new GreenApiError('http', 'API method not found. Check the API URL.', status)
  }
  if (status === 400 && /webhook/i.test(detail)) {
    return new GreenApiError(
      'api',
      'A webhook URL is set for this instance. Clear "webhookUrl" in the GREEN-API console to receive messages via HTTP API.',
      status,
    )
  }
  const shortDetail = detail.replace(/\s+/g, ' ').trim().slice(0, 200)
  return new GreenApiError(
    'http',
    shortDetail ? `GREEN-API error ${status}: ${shortDetail}` : `GREEN-API error ${status}.`,
    status,
  )
}

/** Extracts a human-readable message from a GREEN-API error body (JSON or text). */
function errorDetail(text: string): string {
  if (!text) return ''
  try {
    const json = JSON.parse(text) as Record<string, unknown>
    const parts = [json.message, json.description, json.reason, json.error].filter(
      (v): v is string => typeof v === 'string' && v.length > 0,
    )
    return parts.join(' — ')
  } catch {
    return text
  }
}

/**
 * Minimal client for the GREEN-API MAX HTTP API.
 * URL format: {apiUrl}/waInstance{idInstance}/{method}/{apiTokenInstance}
 */
export class GreenApiClient {
  private readonly credentials: Credentials
  private readonly fetchFn: FetchFn

  constructor(credentials: Credentials, fetchFn: FetchFn = (...args) => fetch(...args)) {
    this.credentials = { ...credentials, apiUrl: normalizeApiUrl(credentials.apiUrl) }
    this.fetchFn = fetchFn
  }

  get idInstance() {
    return this.credentials.idInstance
  }

  private buildUrl(method: string, suffix?: string, query?: RequestOptions['query']): string {
    const { apiUrl, idInstance, apiTokenInstance } = this.credentials
    let url = `${apiUrl}/waInstance${encodeURIComponent(idInstance)}/${method}/${encodeURIComponent(apiTokenInstance)}`
    if (suffix) url += `/${encodeURIComponent(suffix)}`
    if (query) {
      const params = new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)]))
      url += `?${params.toString()}`
    }
    return url
  }

  private async request<T>(method: string, options: RequestOptions): Promise<T | null> {
    const url = this.buildUrl(method, options.suffix, options.query)
    let response: Response
    try {
      response = await this.fetchFn(url, {
        method: options.method,
        headers: options.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: options.signal,
      })
    } catch (err) {
      if (options.signal?.aborted || isAbortError(err)) throw new GreenApiError('aborted', 'Request cancelled.')
      throw new GreenApiError('network', 'Network error: GREEN-API is unreachable. Check the API URL and your connection.')
    }

    let text: string
    try {
      text = await response.text()
    } catch (err) {
      if (options.signal?.aborted || isAbortError(err)) throw new GreenApiError('aborted', 'Request cancelled.')
      throw new GreenApiError('network', 'Network error while reading the GREEN-API response.')
    }

    if (!response.ok) throw describeHttpError(response.status, errorDetail(text))

    const trimmed = text.trim()
    if (!trimmed || trimmed === 'null') return null
    try {
      return JSON.parse(trimmed) as T
    } catch {
      throw new GreenApiError('api', 'GREEN-API returned an unexpected response.')
    }
  }

  /** GET getStateInstance — also used to verify credentials on connect. */
  async getStateInstance(signal?: AbortSignal): Promise<InstanceState> {
    const res = await this.request<{ stateInstance?: string }>('getStateInstance', { method: 'GET', signal })
    if (!res || typeof res.stateInstance !== 'string') {
      throw new GreenApiError('api', 'GREEN-API returned an unexpected response.')
    }
    return res.stateInstance
  }

  /**
   * POST checkAccount — resolves a phone number (11–12 digits, +7 / +375 only)
   * to the MAX chatId that must be used for sending.
   */
  async checkAccount(phoneDigits: string, signal?: AbortSignal): Promise<CheckAccountResponse> {
    const res = await this.request<{ exist?: boolean; chatId?: string; status?: boolean; reason?: string }>(
      'checkAccount',
      { method: 'POST', body: { phoneNumber: Number(phoneDigits) }, signal },
    )
    if (!res) throw new GreenApiError('api', 'GREEN-API returned an empty response.')
    if (res.status === false) {
      if (res.reason && /limit/i.test(res.reason)) {
        throw new GreenApiError('rateLimit', 'MAX limited phone number checks. Pause new chats for a while and try later.')
      }
      if (res.reason && /not authorized|starting/i.test(res.reason)) {
        throw new GreenApiError('api', 'The instance is starting or not authorized in MAX. Check it in the GREEN-API console.')
      }
      throw new GreenApiError('api', res.reason ? `Could not check the number: ${res.reason}` : 'Could not check the number.')
    }
    return { exist: res.exist === true, chatId: typeof res.chatId === 'string' ? res.chatId : '' }
  }

  /** POST sendMessage — text only, up to 4000 characters. */
  async sendMessage(chatId: string, message: string, signal?: AbortSignal): Promise<SendMessageResponse> {
    const res = await this.request<{ idMessage?: string }>('sendMessage', {
      method: 'POST',
      body: { chatId, message },
      signal,
    })
    if (!res || typeof res.idMessage !== 'string' || !res.idMessage) {
      throw new GreenApiError('api', 'GREEN-API did not return a message ID.')
    }
    return { idMessage: res.idMessage }
  }

  /**
   * GET receiveNotification — long polls up to receiveTimeout seconds (5–60).
   * Returns null when the queue is empty.
   */
  async receiveNotification(receiveTimeout: number, signal?: AbortSignal): Promise<ReceivedNotification | null> {
    const timeout = Math.min(60, Math.max(5, Math.round(receiveTimeout)))
    const res = await this.request<{ receiptId?: number; body?: unknown }>('receiveNotification', {
      method: 'GET',
      query: { receiveTimeout: timeout },
      signal,
    })
    if (!res || typeof res.receiptId !== 'number') return null
    return { receiptId: res.receiptId, body: res.body }
  }

  /** DELETE deleteNotification/{receiptId} — acknowledges a processed notification. */
  async deleteNotification(receiptId: number, signal?: AbortSignal): Promise<boolean> {
    const res = await this.request<{ result?: boolean }>('deleteNotification', {
      method: 'DELETE',
      suffix: String(receiptId),
      signal,
    })
    return res?.result === true
  }
}
