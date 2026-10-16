/**
 * Instance settings the chat needs to receive everything over the HTTP API.
 * GREEN-API creates instances with all notification types disabled.
 */
export const REQUIRED_NOTIFICATIONS = [
  { key: 'incomingWebhook', label: 'входящие сообщения' },
  { key: 'outgoingMessageWebhook', label: 'сообщения, отправленные с телефона' },
  { key: 'outgoingWebhook', label: 'статусы доставки и прочтения' },
] as const

export type RequiredNotification = (typeof REQUIRED_NOTIFICATIONS)[number]

export function missingNotifications(settings: Record<string, unknown>): RequiredNotification[] {
  return REQUIRED_NOTIFICATIONS.filter((n) => settings[n.key] !== 'yes')
}

/** SetSettings body that turns the missing notification types on. */
export function enableNotificationsBody(missing: RequiredNotification[]): Record<string, string> {
  return Object.fromEntries(missing.map((n) => [n.key, 'yes']))
}
