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
  // Raw API details are only used to pick a message — they are never shown to the user.
  if (status === 401 || status === 403) {
    if (/suspend/i.test(detail)) {
      return new GreenApiError(
        'api',
        'Аккаунт MAX временно ограничен: писать можно только контактам, которые сохранили ваш номер.',
        status,
      )
    }
    return new GreenApiError('auth', 'Доступ запрещён. Проверьте idInstance и apiTokenInstance.', status)
  }
  if (status === 466) {
    return new GreenApiError('api', 'Исчерпан лимит запросов вашего тарифа GREEN-API.', status)
  }
  if (status === 429 || status === 469) {
    return new GreenApiError('rateLimit', 'Слишком много запросов. Подождите немного и попробуйте снова.', status)
  }
  if (status === 404) {
    return new GreenApiError('http', 'Метод API не найден. Проверьте адрес API.', status)
  }
  if (status === 400 && /webhook/i.test(detail)) {
    return new GreenApiError(
      'api',
      'Для инстанса задан адрес вебхука. Очистите поле webhookUrl в консоли GREEN-API, чтобы получать сообщения через HTTP API.',
      status,
    )
  }
  if (status === 400 && /4000|length/i.test(detail)) {
    return new GreenApiError('api', 'Сообщение слишком длинное: максимум 4000 символов.', status)
  }
  if (status === 400) {
    return new GreenApiError('http', 'GREEN-API отклонил запрос. Проверьте введённые данные.', status)
  }
  if (status === 413 || /too large/i.test(detail)) {
    return new GreenApiError('http', 'Запрос слишком большой.', status)
  }
  if (status >= 500) {
    return new GreenApiError('http', 'Сервер GREEN-API временно недоступен. Попробуйте позже.', status)
  }
  return new GreenApiError('http', `Ошибка GREEN-API (код ${status}). Попробуйте позже.`, status)
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
      if (options.signal?.aborted || isAbortError(err)) throw new GreenApiError('aborted', 'Запрос отменён.')
      throw new GreenApiError('network', 'Нет связи с GREEN-API. Проверьте адрес API и подключение к интернету.')
    }

    let text: string
    try {
      text = await response.text()
    } catch (err) {
      if (options.signal?.aborted || isAbortError(err)) throw new GreenApiError('aborted', 'Запрос отменён.')
      throw new GreenApiError('network', 'Сетевая ошибка при получении ответа GREEN-API.')
    }

    if (!response.ok) throw describeHttpError(response.status, errorDetail(text))

    const trimmed = text.trim()
    if (!trimmed || trimmed === 'null') return null
    try {
      return JSON.parse(trimmed) as T
    } catch {
      throw new GreenApiError('api', 'GREEN-API вернул неожиданный ответ.')
    }
  }

  /** GET getStateInstance — also used to verify credentials on connect. */
  async getStateInstance(signal?: AbortSignal): Promise<InstanceState> {
    const res = await this.request<{ stateInstance?: string }>('getStateInstance', { method: 'GET', signal })
    if (!res || typeof res.stateInstance !== 'string') {
      throw new GreenApiError('api', 'GREEN-API вернул неожиданный ответ.')
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
    if (!res) throw new GreenApiError('api', 'GREEN-API вернул пустой ответ.')
    if (res.status === false) {
      if (res.reason && /limit/i.test(res.reason)) {
        throw new GreenApiError('rateLimit', 'MAX ограничил проверку номеров. Сделайте паузу и попробуйте позже.')
      }
      if (res.reason && /not authorized|starting/i.test(res.reason)) {
        throw new GreenApiError('api', 'Инстанс запускается или не авторизован в MAX. Проверьте его в консоли GREEN-API.')
      }
      throw new GreenApiError('api', 'Не удалось проверить номер. Попробуйте позже.')
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
      throw new GreenApiError('api', 'GREEN-API не вернул идентификатор сообщения.')
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
