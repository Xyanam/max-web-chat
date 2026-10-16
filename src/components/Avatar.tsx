import { avatarColor, initials } from '../lib/format'

export function Avatar({ title, seed, size = 48 }: { title: string; seed: string; size?: number }) {
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, background: avatarColor(seed), fontSize: size * 0.36 }}
      aria-hidden="true"
    >
      {initials(title)}
    </span>
  )
}
