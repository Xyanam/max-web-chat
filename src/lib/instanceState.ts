import type { InstanceState } from '../types'

const LABELS: Record<string, string> = {
  authorized: 'авторизован',
  notAuthorized: 'не авторизован',
  blocked: 'заблокирован',
  starting: 'запускается',
  suspended: 'ограничен',
  pendingPassword: 'ожидает пароль',
}

const HINTS: Record<string, string> = {
  notAuthorized: 'Инстанс не авторизован в MAX. Привяжите аккаунт MAX в консоли GREEN-API.',
  blocked: 'Аккаунт MAX этого инстанса заблокирован.',
  starting: 'Инстанс запускается. Это может занять до 5 минут.',
  suspended: 'Аккаунт MAX временно ограничен: писать можно только контактам, которые сохранили ваш номер.',
  pendingPassword: 'MAX запрашивает пароль двухфакторной аутентификации. Завершите авторизацию в консоли GREEN-API.',
}

export function instanceStateLabel(state: InstanceState | null): string {
  if (!state) return 'неизвестно'
  return LABELS[state] ?? state
}

/** Banner text for any state other than "authorized". */
export function instanceStateHint(state: InstanceState): string {
  return HINTS[state] ?? `Состояние инстанса: ${instanceStateLabel(state)}.`
}
