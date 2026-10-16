const timeFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' })
const dayFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'long' })
const dayYearFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
const shortDateFmt = new Intl.DateTimeFormat(undefined, { day: '2-digit', month: '2-digit', year: '2-digit' })

function startOfDay(ts: number) {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function formatTime(ts: number): string {
  return timeFmt.format(ts)
}

/** Time for today's messages, otherwise a short date — used in the chat list. */
export function formatListTime(ts: number, now = Date.now()): string {
  return startOfDay(ts) === startOfDay(now) ? timeFmt.format(ts) : shortDateFmt.format(ts)
}

export function formatDaySeparator(ts: number, now = Date.now()): string {
  const day = startOfDay(ts)
  const today = startOfDay(now)
  if (day === today) return 'Today'
  if (day === today - 86_400_000) return 'Yesterday'
  return new Date(ts).getFullYear() === new Date(now).getFullYear() ? dayFmt.format(ts) : dayYearFmt.format(ts)
}

export function isSameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b)
}

export function initials(title: string): string {
  // Letters only: phone-number titles get a generic icon instead of digits.
  const words = title.replace(/[^\p{L}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean)
  if (!words.length) return ''
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

const AVATAR_COLORS = ['#f2994a', '#eb5757', '#9b51e0', '#2f80ed', '#27ae60', '#00a3b4', '#e056a0', '#6c5ce7']

export function avatarColor(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}
